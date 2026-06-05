// src/screens/DashboardPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  DollarSign, CreditCard, Package, Zap, AlertTriangle, Users, Calendar, ArrowUpRight, TrendingUp
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  brand: string;
  stock: number;
  minStock: number;
  store: string;
}

interface Sale {
  id: string;
  clientName?: string;
  timestamp: Timestamp;
  total: number;
  isFiado?: boolean;
  items: any[];
  store: string;
}

interface DashboardProps {
  storeEmail: string | null;
}

export default function DashboardPage({ storeEmail }: DashboardProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros de Escopo
  const [activeFilter, setActiveFilter] = useState<'today' | 'month' | 'all'>('today');
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    if (!storeEmail) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const prodQuery = query(collection(db, "products"), where("store", "==", storeEmail));
        const prodSnap = await getDocs(prodQuery);
        setProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));

        const salesQuery = query(collection(db, "sales"), where("store", "==", storeEmail));
        const salesSnap = await getDocs(salesQuery);
        setSales(salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [storeEmail]);

  // Pipeline Analítico (Engine de Inteligência Computacional do Dashboard)
  const stats = useMemo(() => {
    let filteredSales = [...sales];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filtro Cronológico por Botão
    if (activeFilter === 'today') {
      filteredSales = filteredSales.filter(s => {
        const d = s.timestamp?.toDate();
        return d && d >= todayStart;
      });
    } else if (activeFilter === 'month') {
      filteredSales = filteredSales.filter(s => {
        const d = s.timestamp?.toDate();
        return d && d >= monthStart;
      });
    }

    // Filtro por Calendário Específico
    if (selectedDate) {
      const filterDate = new Date(selectedDate);
      filterDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);

      filteredSales = filteredSales.filter(s => {
        const d = s.timestamp?.toDate();
        return d && d >= filterDate && d < nextDay;
      });
    }

    const totalRevenue = filteredSales.reduce((acc, s) => acc + (s.total || 0), 0);
    const fiados = filteredSales.filter(s => s.isFiado === true);
    const fiadosTotal = fiados.reduce((acc, s) => acc + (s.total || 0), 0);
    const lowStock = products.filter(p => p.stock <= (p.minStock || 5));

    // NOVA METRICA: Proporção de risco sobre o faturamento
    const fiadoRatio = totalRevenue > 0 ? (fiadosTotal / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      salesCount: filteredSales.length,
      fiadosCount: fiados.length,
      fiadosTotal,
      fiadoRatio,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock,
      pendingFiados: fiados
    };
  }, [sales, products, activeFilter, selectedDate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-500 text-xs font-black uppercase tracking-widest animate-pulse">
        Sincronizando métricas de rede...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 p-4 md:p-8 antialiased selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-6">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border border-emerald-500/20">
                Sistema de Gestão Ativo
              </span>
              <span className="bg-slate-950 border border-slate-900 text-slate-500 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md">
                Live Data
              </span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">
              Dashboard<span className="text-emerald-500">.</span>
            </h1>
          </div>

          {/* CONTROLE DE FILTROS SUPER COMPACTO */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/30 border border-slate-900 p-1.5 rounded-xl">
            <div className="flex gap-1">
              {(['today', 'month', 'all'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    activeFilter === filter
                      ? "bg-slate-800 text-white border border-slate-700 shadow-md"
                      : "bg-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {filter === 'today' ? 'Hoje' : filter === 'month' ? 'Mês' : 'Geral'}
                </button>
              ))}
            </div>

            <div className="h-4 w-[1px] bg-slate-800 hidden sm:block"></div>

            <div className="flex items-center gap-2 px-2 py-1 bg-slate-950 border border-slate-900 rounded-lg">
              <Calendar className="text-emerald-500" size={12} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase tracking-wider outline-none text-white cursor-pointer"
              />
            </div>
          </div>
        </header>

        {/* METRICS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 01 - Receita */}
          <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute right-4 top-4 text-emerald-500/20 bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
              <DollarSign size={16} />
            </div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Receita Período</p>
            <h3 className="text-2xl font-black tracking-tight text-white mt-2">
              R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp size={12} className="text-emerald-500" />
              {stats.salesCount} ordens fechadas
            </p>
          </div>

          {/* Card 02 - Fiados */}
          <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute right-4 top-4 text-rose-500/20 bg-rose-500/5 p-2 rounded-xl border border-rose-500/10">
              <CreditCard size={16} />
            </div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Fiados Ativos</p>
            <h3 className="text-2xl font-black tracking-tight text-white mt-2">{stats.fiadosCount}</h3>
            <p className="text-[10px] font-bold text-rose-400 mt-1">
              Total: R$ {stats.fiadosTotal.toLocaleString('pt-BR')} <span className="text-slate-600 font-medium">({stats.fiadoRatio.toFixed(0)}% do total)</span>
            </p>
          </div>

          {/* Card 03 - Estoque Crítico */}
          <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute right-4 top-4 text-amber-500/20 bg-amber-500/5 p-2 rounded-xl border border-amber-500/10">
              <Package size={16} />
            </div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Estoque Crítico</p>
            <h3 className="text-2xl font-black tracking-tight text-white mt-2">{stats.lowStockCount}</h3>
            <p className="text-[10px] font-bold text-amber-400 mt-1">Gargalos de reposição</p>
          </div>

          {/* Card 04 - Ticket Médio */}
          <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute right-4 top-4 text-blue-500/20 bg-blue-500/5 p-2 rounded-xl border border-blue-500/10">
              <Zap size={16} />
            </div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Ticket Médio</p>
            <h3 className="text-2xl font-black tracking-tight text-white mt-2">
              R$ {(stats.salesCount > 0 ? stats.totalRevenue / stats.salesCount : 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] font-bold text-blue-400 mt-1">Média de valor bruto por venda</p>
          </div>

        </div>

        {/* WORKSPACE SECTIONS */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* TABELA CONTAS A RECEBER (ESQUERDA) */}
          <div className="xl:col-span-2 bg-slate-900/10 border border-slate-900 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-900 flex justify-between items-center bg-slate-900/20">
              <div>
                <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest block">Créditos de Risco</span>
                <h3 className="text-sm font-black text-white uppercase tracking-tight mt-0.5">Contas a Receber</h3>
              </div>
              <span className="px-2 py-1 rounded border border-rose-500/20 bg-rose-500/10 text-rose-400 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle size={10} /> Inadimplência Alvo
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-slate-500 text-[9px] font-black uppercase tracking-wider bg-slate-950/40 border-b border-slate-900">
                    <th className="px-6 py-3.5">Cliente</th>
                    <th className="px-6 py-3.5">Data de Emissão</th>
                    <th className="px-6 py-3.5 text-right">Total Devido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {stats.pendingFiados.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-slate-600 text-xs font-semibold uppercase tracking-wider">
                        Nenhum registro de fiado pendente encontrado.
                      </td>
                    </tr>
                  ) : (
                    stats.pendingFiados.map((sale: any) => (
                      <tr key={sale.id} className="hover:bg-slate-900/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-950 border border-slate-900 rounded-xl flex items-center justify-center text-slate-400">
                              <Users size={14} />
                            </div>
                            <span className="text-white font-bold text-xs tracking-tight">{sale.clientName || "Cliente não Identificado"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                          {sale.timestamp?.toDate().toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-rose-400 text-xs tracking-tight">
                          R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PAINEL REPOSIÇÃO (DIREITA) */}
          <div className="bg-slate-900/10 border border-slate-900 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                  <Package size={14} />
                </div>
                <div>
                  <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest block">Insumos Mínimos</span>
                  <h4 className="text-xs font-black text-white uppercase tracking-tight">Reposição Urgente</h4>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
              {stats.lowStockItems.length === 0 ? (
                <p className="text-center py-8 text-slate-600 text-xs font-semibold uppercase tracking-wider">Almoxarifado em níveis estáveis.</p>
              ) : (
                stats.lowStockItems.slice(0, 8).map((item: Product) => {
                  const missingUnits = (item.minStock || 5) - item.stock;
                  return (
                    <div key={item.id} className="flex justify-between items-center p-3.5 bg-slate-950/40 rounded-xl border border-slate-900/60">
                      <div>
                        <p className="text-white font-bold text-xs tracking-tight">{item.name}</p>
                        <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wide mt-0.5">{item.brand}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <span className="font-black text-red-400 text-xs block">{item.stock} un</span>
                        {/* NOVA FUNCIONALIDADE: Indicador dinâmico de criticidade de unidades */}
                        <span className="inline-block px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[9px] text-red-400 font-bold">
                          Faltam {missingUnits > 0 ? missingUnits : 1}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}