// src/screens/DashboardPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
    DollarSign, CreditCard, Package, Zap, AlertTriangle, Users, Calendar
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

    // Filtros
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

    const stats = useMemo(() => {
        let filteredSales = [...sales];

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Filtro por botão
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
        // 'all' = sem filtro

        // Filtro por data específica
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

        return {
            totalRevenue,
            salesCount: filteredSales.length,
            fiadosCount: fiados.length,
            fiadosTotal,
            lowStockCount: lowStock.length,
            lowStockItems: lowStock,
            pendingFiados: fiados
        };
    }, [sales, products, activeFilter, selectedDate]);

    if (loading) {
        return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-400">Carregando dashboard...</div>;
    }

    return (
        <div className="p-4 md:p-8 space-y-8 bg-[#020617] min-h-screen text-slate-200 font-sans">
            <header className="flex flex-col xl:flex-row justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        <span className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em]">Sistema de Gestão Ativo</span>
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tighter italic">DASHBOARD<span className="text-emerald-500">.</span></h1>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Filtros Principais */}
                    <div className="flex items-center gap-3 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
                        <div className="flex px-2">
                            <button 
                                onClick={() => setActiveFilter('today')}
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeFilter === 'today' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Hoje
                            </button>
                            <button 
                                onClick={() => setActiveFilter('month')}
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeFilter === 'month' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Mês
                            </button>
                            <button 
                                onClick={() => setActiveFilter('all')}
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeFilter === 'all' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Geral
                            </button>
                        </div>

                        <div className="h-6 w-[1px] bg-slate-700"></div>

                        {/* Filtro por Data */}
                        <div className="flex items-center gap-2 px-3">
                            <Calendar className="text-emerald-500" size={16} />
                            <input 
                                type="date" 
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-[10px] font-black outline-none text-white cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-6 hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-2xl text-emerald-500 bg-emerald-500/10 border border-emerald-500/20">
                            <DollarSign size={20} />
                        </div>
                    </div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Receita Período</p>
                    <h3 className="text-2xl font-black text-white">R$ {stats.totalRevenue.toLocaleString('pt-BR')}</h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-2">{stats.salesCount} vendas</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-6 hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-2xl text-rose-500 bg-rose-500/10 border border-rose-500/20">
                            <CreditCard size={20} />
                        </div>
                    </div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Fiados Ativos</p>
                    <h3 className="text-2xl font-black text-white">{stats.fiadosCount}</h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-2">Total: R$ {stats.fiadosTotal.toLocaleString('pt-BR')}</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-6 hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-2xl text-amber-500 bg-amber-500/10 border border-amber-500/20">
                            <Package size={20} />
                        </div>
                    </div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Estoque Crítico</p>
                    <h3 className="text-2xl font-black text-white">{stats.lowStockCount}</h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-2">Itens p/ repor</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-6 hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-2xl text-blue-500 bg-blue-500/10 border border-blue-500/20">
                            <Zap size={20} />
                        </div>
                    </div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Ticket Médio</p>
                    <h3 className="text-2xl font-black text-white">
                        R$ {(stats.salesCount > 0 ? stats.totalRevenue / stats.salesCount : 0).toFixed(2)}
                    </h3>
                </div>
            </div>

            {/* Tabela Fiados + Reposição */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 bg-slate-900/40 border border-slate-800 rounded-[2.5rem] overflow-hidden">
                    <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black text-white">CONTAS A RECEBER</h3>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Fiados Pendentes</p>
                        </div>
                        <AlertTriangle className="text-rose-500" size={24} />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] bg-slate-950/50">
                                    <th className="px-8 py-5">Cliente</th>
                                    <th className="px-8 py-5">Data</th>
                                    <th className="px-8 py-5 text-right">Total Devido</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {stats.pendingFiados.map((sale: any) => (
                                    <tr key={sale.id} className="hover:bg-emerald-500/[0.02]">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
                                                    <Users size={18} />
                                                </div>
                                                <span className="text-white font-black">{sale.clientName || "Sem nome"}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-slate-400 text-xs">
                                            {sale.timestamp?.toDate().toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-8 py-6 text-right font-black text-rose-400">
                                            R$ {sale.total.toLocaleString('pt-BR')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Reposição */}
                <div className="bg-gradient-to-br from-amber-500/20 to-transparent border border-amber-500/20 rounded-[2.5rem] p-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl">
                            <AlertTriangle size={22} />
                        </div>
                        <h4 className="text-white font-black tracking-tight uppercase">Reposição Urgente</h4>
                    </div>

                    <div className="space-y-4">
                        {stats.lowStockItems.slice(0, 8).map((item: Product) => (
                            <div key={item.id} className="flex justify-between items-center p-4 bg-slate-950/40 rounded-2xl border border-slate-800/50">
                                <div>
                                    <p className="text-white font-bold">{item.name}</p>
                                    <p className="text-slate-500 text-xs">{item.brand}</p>
                                </div>
                                <span className="font-black text-rose-500">{item.stock} un</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}