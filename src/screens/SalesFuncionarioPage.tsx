// src/screens/SalesFuncionarioPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Plus, Search, CreditCard, Smartphone,
    DollarSign, Eye, EyeOff,
    Clock, Calendar, User, TrendingUp
} from "lucide-react";

import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";

import NewSaleModal from "../components/NewSaleModal";

interface SaleItem {
    name: string;
    saleQty: number;
    price: number;
}

interface SaleWithClient {
    id: string;
    date: string;
    time: string;
    items: SaleItem[];
    total: number;
    payment: string;
    status: string;
    dateObject?: Date;
    clientName?: string;
}

interface Props {
    storeEmail: string;
}

export default function SalesFuncionarioPage({ storeEmail }: Props) {
    const [filter, setFilter] = useState<"today" | "week" | "month">("today");
    const [searchTerm, setSearchTerm] = useState("");
    const [hideValues, setHideValues] = useState(false);

    const [sales, setSales] = useState<SaleWithClient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);

    // ==================== BUSCAR VENDAS ====================
    const fetchSales = useCallback(async () => {
        setIsLoading(true);
        try {
       const q = query(
  collection(db, "sales"),
  where("store", "==", storeEmail)
);

            const snapshot = await getDocs(q);

            const list: SaleWithClient[] = snapshot.docs.map((doc) => {
                const data = doc.data();
                const ts = data.timestamp?.toDate();

                return {
                    id: doc.id,
                    dateObject: ts,
                    date: ts ? ts.toLocaleDateString("pt-BR") : "--/--/----",
                    time: ts ? ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--",
                    items: data.items || [],
                    total: Number(data.total) || 0,
                    payment: data.paymentMethod || "Não informado",
                    status: data.status || "completed",
                    clientName: data.clientName || data.fiado?.nome || null,
                };
            });

            setSales(list);
        } catch (error) {
            console.error("Erro ao buscar vendas:", error);
        } finally {
            setIsLoading(false);
        }
    }, [storeEmail]);

    useEffect(() => {
        fetchSales();
    }, [fetchSales]);

    // ==================== FILTROS ====================
    const filteredByPeriod = sales.filter((sale) => {
        if (!sale.dateObject) return false;
        const now = new Date();
        const saleDate = sale.dateObject;

        if (filter === "today") return saleDate.toDateString() === now.toDateString();
        if (filter === "week") {
            const oneWeekAgo = new Date(now);
            oneWeekAgo.setDate(now.getDate() - 7);
            return saleDate >= oneWeekAgo;
        }
        if (filter === "month") {
            return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
        }
        return true;
    });

    const stats = {
        pix: filteredByPeriod.filter(s => s.payment.toUpperCase().includes("PIX")).reduce((acc, s) => acc + s.total, 0),
        cartao: filteredByPeriod.filter(s => s.payment.toUpperCase().includes("CARTÃO") || s.payment.toUpperCase().includes("CARTAO")).reduce((acc, s) => acc + s.total, 0),
        dinheiro: filteredByPeriod.filter(s => s.payment.toUpperCase().includes("DINHEIRO")).reduce((acc, s) => acc + s.total, 0),
        total: filteredByPeriod.reduce((acc, s) => acc + s.total, 0),
    };

    const finalFilteredSales = filteredByPeriod.filter((sale) =>
        searchTerm === "" ||
        sale.items.some((i) => i.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (sale.clientName && sale.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 p-4 sm:p-8 font-sans">
            {isNewSaleModalOpen && (
                <NewSaleModal
                    storeEmail={storeEmail}
                    onClose={() => {
                        setIsNewSaleModalOpen(false);
                        fetchSales();
                    }}
                    onSaleComplete={fetchSales}
                />
            )}

            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                                PAINEL OPERACIONAL
                            </span>
                            <span className="bg-slate-900 text-slate-400 text-[10px] font-black px-3 py-1 rounded-full border border-slate-800">
                                {new Date().toLocaleDateString("pt-BR")}
                            </span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tighter">
                            Fluxo de <span className="text-emerald-500">Caixa</span>
                        </h1>
                        <p className="text-slate-400 text-sm">Modo Funcionário</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setHideValues(!hideValues)}
                            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 px-5 py-2.5 rounded-2xl text-sm font-medium transition-all"
                        >
                            {hideValues ? <EyeOff size={18} /> : <Eye size={18} />}
                            {hideValues ? "Mostrar Valores" : "Ocultar Valores"}
                        </button>

                        <button
                            onClick={() => setIsNewSaleModalOpen(true)}
                            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-2xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/30"
                        >
                            <Plus size={20} strokeWidth={3} /> Nova Venda
                        </button>
                    </div>
                </header>

                {/* Cards de Estatísticas - Igual ao SalesPage */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: "PIX", value: stats.pix, color: "emerald", icon: Smartphone },
                        { label: "Cartão", value: stats.cartao, color: "blue", icon: CreditCard },
                        { label: "Dinheiro", value: stats.dinheiro, color: "amber", icon: DollarSign },
                        { label: filter === "today" ? "Total Hoje" : filter === "week" ? "Total Semana" : "Total Mês", value: stats.total, color: "indigo", icon: TrendingUp },
                    ].map((item, i) => {
                        const Icon = item.icon;
                        return (
                            <div key={i} className={`bg-gradient-to-br from-${item.color}-500/20 to-${item.color}-500/5 border border-${item.color}-500/20 rounded-[2rem] p-6 hover:border-${item.color}-500/40 transition-all`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-2xl bg-slate-950/50 border border-${item.color}-500/30`}>
                                        <Icon className={`text-${item.color}-400`} size={22} />
                                    </div>
                                </div>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{item.label}</p>
                                <h3 className="text-3xl font-black text-white">
                                    {hideValues ? "••••••" : `R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                </h3>
                            </div>
                        );
                    })}
                </div>

                {/* Filtros */}
                <div className="flex flex-col xl:flex-row gap-4 items-center bg-slate-900/30 p-2 rounded-[2.5rem] border border-slate-800/50 backdrop-blur-sm">
                    <div className="flex p-1 bg-slate-950/50 rounded-full border border-slate-800 shrink-0">
                        {["today", "week", "month"].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f as any)}
                                className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase transition-all ${filter === f ? "bg-emerald-500 text-slate-950" : "text-slate-500 hover:text-slate-300"}`}
                            >
                                {f === "today" ? "Hoje" : f === "week" ? "Semana" : "Mês"}
                            </button>
                        ))}
                    </div>

                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar venda no fluxo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent py-3 pl-12 pr-6 text-sm text-white outline-none"
                        />
                    </div>
                </div>

                {/* Lista de Vendas */}
                <div className="grid gap-4">
                    {isLoading ? (
                        <div className="py-20 text-center border border-slate-800 rounded-[2rem] text-slate-600 font-bold animate-pulse uppercase text-xs tracking-widest">
                            Sincronizando Dados...
                        </div>
                    ) : finalFilteredSales.length === 0 ? (
                        <div className="py-20 text-center text-slate-500">Nenhuma venda encontrada</div>
                    ) : (
                        finalFilteredSales.map((sale) => {
                            const isFiado = sale.status === "pending";

                            return (
                                <div
                                    key={sale.id}
                                    className="group border rounded-[1.5rem] p-5 transition-all shadow-sm bg-slate-900/20 border-slate-800/50 hover:border-slate-700"
                                >
                                    <div className="flex flex-col md:flex-row justify-between gap-6">
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <span className="text-lg font-black text-white">
                                                    {sale.items.map((item, idx) => (
                                                        <span key={idx}>
                                                            {item.saleQty}x {item.name}
                                                            {idx < sale.items.length - 1 ? ", " : ""}
                                                        </span>
                                                    ))}
                                                </span>
                                                {isFiado && <span className="px-3 py-1 bg-rose-600 text-white text-xs font-black rounded-full">FIADO</span>}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-4 text-[10px] font-black text-slate-500 uppercase">
                                                <div className="flex items-center gap-1.5"><Clock size={12} className="text-emerald-500" /> {sale.time}</div>
                                                <div className="flex items-center gap-1.5"><Calendar size={12} className="text-blue-500" /> {sale.date}</div>
                                                {sale.clientName && (
                                                    <div className="px-2 py-0.5 bg-slate-800/50 border border-slate-700 rounded-md text-slate-300 flex items-center gap-1">
                                                        <User size={10} /> {sale.clientName}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-6">
                                            <div className="text-right">
                                                <p className="text-xl font-black text-white">
                                                    {hideValues ? "••••••" : `R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                                </p>
                                                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-500 uppercase mt-1 inline-block">
                                                    {sale.payment}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}