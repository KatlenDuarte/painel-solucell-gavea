// src/screens/FiadoPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { 
    Search, User, Calendar, Clock, MessageCircle, 
    Check, ChevronLeft, Loader2, AlertCircle, X 
} from "lucide-react";

import { 
    collection, getDocs, query, where, updateDoc, doc, serverTimestamp, deleteDoc 
} from "firebase/firestore";
import { db } from "../lib/firebase";

interface FiadoSale {
    id: string;
    clientName: string;
    date: string;
    time: string;
    total: number;
    items: { name: string; qty?: number }[];
    phone?: string;
    note?: string;
    status: string;
    timestamp?: any;
}

export default function FiadoPage({ storeEmail }: { storeEmail: string }) {
    const [fiados, setFiados] = useState<FiadoSale[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"pendentes" | "historico">("pendentes");
    const [selectedMonth, setSelectedMonth] = useState<string>("all");

    const fetchFiados = useCallback(async () => {
        if (!storeEmail) return;
        setLoading(true);

        try {
            const statusFilter = activeTab === "pendentes" ? "pending" : "completed";

            const q = query(
                collection(db, "sales"),
                where("store", "==", storeEmail),
                where("status", "==", statusFilter)
            );

            const snapshot = await getDocs(q);
            const list: FiadoSale[] = [];

            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const isFiado = data.paymentMethod === "Fiado" || data.fiado;

                if (isFiado) {
                    const itemsList = Array.isArray(data.items) 
                        ? data.items.map((item: any) => ({
                            name: item.name || "Item",
                            qty: item.saleQty || 1
                          }))
                        : [{ name: "Serviço", qty: 1 }];

                    list.push({
                        id: docSnap.id,
                        clientName: data.fiado?.nome || data.clientName || "Cliente não informado",
                        date: data.timestamp?.toDate()?.toLocaleDateString("pt-BR") || "--",
                        time: data.timestamp?.toDate()?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) || "--",
                        total: Number(data.total) || data.fiado?.valor || 0,
                        items: itemsList,
                        phone: data.fiado?.whatsapp || "",
                        note: data.note || "Sem observações...",
                        status: data.status,
                        timestamp: data.timestamp
                    });
                }
            });

            list.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
            setFiados(list);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [storeEmail, activeTab]);

    useEffect(() => {
        fetchFiados();
    }, [fetchFiados]);

    // Filtragem combinada (busca + mês)
    const filteredFiados = fiados.filter(f => {
        const matchesSearch = 
            f.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.phone && f.phone.includes(searchTerm));

        if (selectedMonth === "all") return matchesSearch;

        const saleMonth = f.timestamp?.toDate()?.toISOString().slice(0, 7); // YYYY-MM
        return matchesSearch && saleMonth === selectedMonth;
    });

    const totalPendente = fiados.reduce((acc, cur) => acc + cur.total, 0);

    const handleMarkAsPaid = async (id: string) => {
        if (!confirm("Marcar este fiado como pago?")) return;
        try {
            await updateDoc(doc(db, "sales", id), {
                status: "completed",
                paidAt: serverTimestamp(),
                paymentMethod: "Fiado (Quitado)"
            });
            alert("Fiado quitado com sucesso!");
            fetchFiados();
        } catch (e) { alert("Erro ao atualizar"); }
    };

    const handleCancelFiado = async (id: string) => {
        if (!confirm("Tem certeza que deseja CANCELAR este fiado?")) return;
        try {
            await updateDoc(doc(db, "sales", id), {
                status: "cancelled",
                cancelledAt: serverTimestamp()
            });
            alert("Fiado cancelado com sucesso!");
            fetchFiados();
        } catch (e) { alert("Erro ao cancelar"); }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-10 font-sans">
            <div className="max-w-6xl mx-auto space-y-10">

                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-2">
                        <button className="group flex items-center gap-2 text-slate-500 hover:text-cyan-400 transition-all text-xs font-bold uppercase tracking-[0.2em]">
                            <ChevronLeft className="group-hover:-translate-x-1 transition-transform" size={16} />
                            Painel de Controle
                        </button>
                        <h1 className="text-4xl font-extrabold tracking-tight text-white">
                            Gestão de <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Fiado</span>
                        </h1>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                        <div className="relative overflow-hidden bg-slate-900/40 border border-slate-800 p-5 rounded-[2rem]">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">A RECEBER</p>
                            <p className="text-3xl font-black text-rose-500">R$ {totalPendente.toFixed(2)}</p>
                        </div>
                        <div className="relative overflow-hidden bg-slate-900/40 border border-slate-800 p-5 rounded-[2rem]">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">PENDENTES</p>
                            <p className="text-3xl font-black text-white">{fiados.filter(f => f.status === "pending").length}</p>
                        </div>
                    </div>
                </header>

                {/* Filtros */}
                <section className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                        <input
                            placeholder="Buscar por nome do cliente ou telefone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-800 focus:border-cyan-500/50 rounded-2xl pl-12 pr-4 py-4 text-sm outline-none"
                        />
                    </div>

                    <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
                        <button onClick={() => setActiveTab("pendentes")} className={`px-6 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === "pendentes" ? "bg-white text-slate-950 shadow-lg" : "text-slate-400 hover:bg-slate-800"}`}>
                            PENDENTES
                        </button>
                        <button onClick={() => setActiveTab("historico")} className={`px-6 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === "historico" ? "bg-white text-slate-950 shadow-lg" : "text-slate-400 hover:bg-slate-800"}`}>
                            HISTÓRICO
                        </button>
                    </div>

                    {/* Filtro por Mês */}
                    <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-slate-900 border border-slate-800 text-xs rounded-xl px-4 py-3 w-full md:w-auto"
                    >
                        <option value="all">Todos os meses</option>
                        <option value="2026-04">Abril 2026</option>
                        <option value="2026-03">Março 2026</option>
                        <option value="2026-02">Fevereiro 2026</option>
                        <option value="2026-01">Janeiro 2026</option>
                    </select>
                </section>

                {/* Lista */}
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cyan-500" size={48} /></div>
                ) : filteredFiados.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
                        Nenhum fiado encontrado
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {filteredFiados.map((sale) => (
                            <div key={sale.id} className="group relative bg-gradient-to-b from-slate-900/40 to-slate-950/40 border border-slate-800/60 rounded-[2.5rem] p-6 md:p-8 hover:border-cyan-500/30 transition-all duration-300">
                                <div className="flex flex-col lg:flex-row gap-8">
                                    <div className="flex-1 space-y-6">
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border border-slate-700">
                                                    <User className="text-cyan-400" size={28} />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-white tracking-tight">{sale.clientName}</h3>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                                                            <Calendar size={12} /> {sale.date}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                                                            <Clock size={12} /> {sale.time}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter mb-1">TOTAL DEVIDO</p>
                                                <p className="text-3xl font-black text-white">R$ {sale.total.toFixed(2)}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {sale.items.map((item, i) => (
                                                <span key={i} className="bg-slate-800/30 border border-slate-700/50 text-slate-300 text-[11px] px-4 py-2 rounded-full">
                                                    <span className="text-cyan-500 font-bold mr-1">×{item.qty}</span> {item.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Ações */}
                                    <div className="lg:w-64 flex flex-col gap-3 border-t lg:border-t-0 lg:border-l border-slate-800/60 pt-6 lg:pt-0 lg:pl-8">
                                        {activeTab === "pendentes" && (
                                            <>
                                                <button 
                                                    onClick={() => handleMarkAsPaid(sale.id)}
                                                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-cyan-600/20"
                                                >
                                                    <Check size={20} strokeWidth={3} /> PAGAMENTO
                                                </button>

                                                <button 
                                                    onClick={() => handleCancelFiado(sale.id)}
                                                    className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all border border-rose-500/30"
                                                >
                                                    <X size={18} /> CANCELAR FIADO
                                                </button>
                                            </>
                                        )}

                                        {sale.phone && (
                                            <a 
                                                href={`https://wa.me/${sale.phone.replace(/\D/g, '')}?text=Olá ${encodeURIComponent(sale.clientName)}, passando para lembrar sobre o fiado pendente no valor de R$ ${sale.total.toFixed(2)}.`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="w-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all border border-slate-700/50"
                                            >
                                                <MessageCircle className="text-emerald-500" size={20} /> WHATSAPP
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}