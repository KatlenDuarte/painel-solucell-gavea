// src/screens/Sales.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Plus, Search, CreditCard, Smartphone,
    DollarSign, Undo2,
    TrendingUp, Eye, EyeOff,
    Pencil, Clock, Calendar, User, ArrowUpRight
} from "lucide-react";

import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

import RefundConfirmationModal from "../components/RefundConfirmationModal";
import NewSaleModal from "../components/NewSaleModal";
import EditSaleModal from "../components/EditSaleModal";

interface SaleItem {
    id: string;
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
    status: "completed" | "pending" | "refunded" | "cancelled" | "loss";
    dateObject?: Date;
    clientName?: string;
}

interface SalesProps {
    storeEmail: string;
}

export default function Sales({ storeEmail }: SalesProps) {
    const [filter, setFilter] = useState<"today" | "week" | "month">("today");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [refundSaleId, setRefundSaleId] = useState<string | null>(null);
    const [isNewSaleModalOpen, setIsNewSaleModal] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [saleToEdit, setSaleToEdit] = useState<SaleWithClient | null>(null);

    // Estado para ocultar valores
    const [hideValues, setHideValues] = useState(false);

    const [sales, setSales] = useState<SaleWithClient[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const fetchSalesFromFirestore = useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "sales"), where("store", "==", storeEmail));
            const snapshot = await getDocs(q);

            const list: SaleWithClient[] = snapshot.docs.map((doc) => {
                const data = doc.data() as any;
                const ts = data.timestamp?.toDate();

                return {
                    id: doc.id,
                    dateObject: ts,
                    date: ts ? ts.toLocaleDateString("pt-BR") : "--/--/----",
                    time: ts ? ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--",
                    items: data.items || [],
                    total: Number(data.total) || 0,
                    payment: data.paymentMethod || "PIX",
                    status: data.status || (data.paymentMethod === "Fiado" ? "pending" : "completed"),
                    clientName: data.clientName || data.fiado?.nome || data.payments?.fiado?.nome
                };
            })
                .sort((a, b) => (b.dateObject?.getTime() || 0) - (a.dateObject?.getTime() || 0));

            setSales(list);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [storeEmail]);

    useEffect(() => {
        fetchSalesFromFirestore();
    }, [fetchSalesFromFirestore]);

    const filteredByPeriod = sales.filter(sale => {
        if (!sale.dateObject) return false;
        const now = new Date();
        const saleDate = sale.dateObject;

        if (filter === "today") return saleDate.toDateString() === now.toDateString();
        if (filter === "week") {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            return saleDate >= oneWeekAgo;
        }
        if (filter === "month") {
            return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
        }
        return true;
    });

    const stats = {
        pix: filteredByPeriod.filter(s => s.payment.toUpperCase().includes("PIX") && s.status !== "refunded" && s.status !== "cancelled").reduce((acc, curr) => acc + curr.total, 0),
        cartao: filteredByPeriod.filter(s => (s.payment.toUpperCase().includes("CARTÃO") || s.payment.toUpperCase().includes("CARTAO")) && s.status !== "refunded" && s.status !== "cancelled").reduce((acc, curr) => acc + curr.total, 0),
        dinheiro: filteredByPeriod.filter(s => s.payment.toUpperCase().includes("DINHEIRO") && s.status !== "refunded" && s.status !== "cancelled").reduce((acc, curr) => acc + curr.total, 0),
        total: filteredByPeriod.filter(s => s.status !== "refunded" && s.status !== "cancelled").reduce((acc, curr) => acc + curr.total, 0)
    };

    const finalFilteredSales = filteredByPeriod.filter((sale) => {
        const search = searchTerm.toLowerCase();
        return search === "" ||
            sale.items.some(i => i.name.toLowerCase().includes(search)) ||
            sale.clientName?.toLowerCase().includes(search);
    });

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 p-4 sm:p-8 font-sans">
            <RefundConfirmationModal
                saleId={refundSaleId}
                onClose={() => {
                    setIsModalOpen(false);
                    setRefundSaleId(null);
                }}
                onRefundSuccess={fetchSalesFromFirestore}
            />

            {isNewSaleModalOpen && (
                <NewSaleModal
                    onClose={() => {
                        setIsNewSaleModal(false);
                        fetchSalesFromFirestore();
                    }}
                    storeEmail={storeEmail}
                    onSaleComplete={fetchSalesFromFirestore}
                />
            )}

            <EditSaleModal
                sale={saleToEdit}
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSaleToEdit(null);
                }}
                onSave={fetchSalesFromFirestore}
            />

            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">

                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">Painel Operacional</span>
                            <span className="bg-slate-900 text-slate-400 text-[10px] font-black px-3 py-1 rounded-full border border-slate-800 uppercase tracking-widest">23/04/2026</span>
                                           <button
                            onClick={() => setHideValues(!hideValues)}
                            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 px-5 py-2.5 rounded-2xl text-sm font-medium transition-all active:scale-95"
                        >
                            {hideValues ? <EyeOff size={18} /> : <Eye size={18} />}
                            <span>{hideValues}</span>
                        </button>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tighter">Fluxo de <span className="text-emerald-500">Caixa</span></h1>

         

                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setIsNewSaleModal(true)}
                            className="px-6 py-2.5 bg-emerald-500 text-[#020617] rounded-2xl font-black text-sm hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Plus size={20} strokeWidth={3} /> Nova Operação
                        </button>
                    </div>

                </header>


                {/* Cards de Estatísticas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="relative text-left bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border rounded-[2rem] p-6 border-slate-800/50 hover:border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 rounded-2xl bg-slate-950/50 border border-emerald-500/30">
                                <Smartphone className="text-emerald-400" size={20} />
                            </div>
                        </div>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">PIX</p>
                        <h3 className="text-2xl font-black text-white">
                            {hideValues ? "••••••" : `R$ ${stats.pix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        </h3>
                    </div>

                    <div className="relative text-left bg-gradient-to-br from-blue-500/20 to-blue-500/5 border rounded-[2rem] p-6 border-slate-800/50 hover:border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 rounded-2xl bg-slate-950/50 border border-blue-500/30">
                                <CreditCard className="text-blue-400" size={20} />
                            </div>
                        </div>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Cartão</p>
                        <h3 className="text-2xl font-black text-white">
                            {hideValues ? "••••••" : `R$ ${stats.cartao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        </h3>
                    </div>

                    <div className="relative text-left bg-gradient-to-br from-amber-500/20 to-amber-500/5 border rounded-[2rem] p-6 border-slate-800/50 hover:border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 rounded-2xl bg-slate-950/50 border border-amber-500/30">
                                <DollarSign className="text-amber-400" size={20} />
                            </div>
                        </div>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Dinheiro</p>
                        <h3 className="text-2xl font-black text-white">
                            {hideValues ? "••••••" : `R$ ${stats.dinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        </h3>
                    </div>

                    <div className="relative text-left bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border rounded-[2rem] p-6 border-slate-800/50 hover:border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 rounded-2xl bg-slate-950/50 border border-indigo-500/30">
                                <TrendingUp className="text-indigo-400" size={20} />
                            </div>
                        </div>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">
                            {filter === "today" ? "Lucro do Dia" : filter === "week" ? "Lucro da Semana" : "Lucro do Mês"}
                        </p>
                        <h3 className="text-2xl font-black text-white">
                            {hideValues ? "••••••" : `R$ ${stats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        </h3>
                    </div>
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
                    ) : finalFilteredSales.map((sale) => {
                        const isRefunded = sale.status === "refunded";
                        const isCancelled = sale.status === "cancelled";

                        return (
                            <div
                                key={sale.id}
                                className={`group border rounded-[1.5rem] p-5 transition-all shadow-sm ${isRefunded
                                    ? "bg-red-950/30 border-red-700/60 opacity-75"
                                    : isCancelled
                                        ? "bg-gray-900/50 border-gray-700 opacity-75"
                                        : "bg-slate-900/20 border-slate-800/50 hover:border-slate-700"
                                    }`}
                            >
                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2 items-center">
                                            <span className={`text-lg font-black ${isRefunded || isCancelled ? "line-through text-gray-400" : "text-white"}`}>
                                                {sale.items.map((item, idx) => (
                                                    <span key={idx}>
                                                        {item.saleQty}x {item.name}
                                                        {idx < sale.items.length - 1 ? ", " : ""}
                                                    </span>
                                                ))}
                                            </span>

                                            {isRefunded && <span className="px-3 py-1 bg-red-600 text-white text-xs font-black rounded-full">REEMBOLSADO</span>}
                                            {isCancelled && <span className="px-3 py-1 bg-gray-700 text-gray-400 text-xs font-black rounded-full">CANCELADO</span>}
                                            {sale.status === "pending" && <span className="px-3 py-1 bg-rose-600 text-white text-xs font-black rounded-full">FIADO</span>}
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
                                            <p className={`text-xl font-black ${isRefunded || isCancelled ? "line-through text-gray-400" : "text-white"}`}>
                                                {hideValues ? "••••••" : `R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                            </p>
                                            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-500 uppercase mt-1 inline-block">
                                                {sale.payment}
                                            </span>
                                        </div>

                                        <div className="flex gap-2">
                                            {!isRefunded && !isCancelled && (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setSaleToEdit(sale);
                                                            setIsEditModalOpen(true);
                                                        }}
                                                        className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-400 hover:text-blue-500 hover:border-blue-500/30 transition-all"
                                                    >
                                                        <Pencil size={18} />
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            setRefundSaleId(sale.id);
                                                            setIsModalOpen(true);
                                                        }}
                                                        className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-slate-600 hover:text-rose-500 hover:border-rose-500/30 transition-all group/btn"
                                                    >
                                                        <Undo2 size={18} className="group-hover/btn:-rotate-45 transition-transform" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}