// src/screens/FiadoPage.tsx

import React, { useState, useEffect, useCallback } from "react";
import {
    Search,
    User,
    Calendar,
    Clock,
    MessageCircle,
    Check,
    ChevronLeft,
    Loader2,
    AlertCircle,
    X,
    Wallet,
    Landmark,
    DollarSign,
    CheckCircle2
} from "lucide-react";

import {
    collection,
    getDocs,
    query,
    where,
    updateDoc,
    doc,
    serverTimestamp
} from "firebase/firestore";
import QuitarFiadoModal from "../components/QuitarFiadoModal";

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

export default function FiadoPage({
    storeEmail
}: {
    storeEmail: string;
}) {

    const [fiados, setFiados] = useState<FiadoSale[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState("");

    const [activeTab, setActiveTab] = useState<
        "pendentes" | "historico"
    >("pendentes");
    const [showQuitarModal, setShowQuitarModal] = useState(false);

    const [selectedFiado, setSelectedFiado] =
        useState<FiadoSale | null>(null);

    const [selectedMonth, setSelectedMonth] =
        useState<string>("all");

    const fetchFiados = useCallback(async () => {

        if (!storeEmail) return;

        setLoading(true);

        try {

            const statusFilter =
                activeTab === "pendentes"
                    ? "pending"
                    : "completed";

            const q = query(
                collection(db, "sales"),
                where("store", "==", storeEmail),
                where("status", "==", statusFilter)
            );

            const snapshot = await getDocs(q);

            const list: FiadoSale[] = [];

            snapshot.docs.forEach((docSnap) => {

                const data = docSnap.data();

                const isFiado =
                    data.paymentMethod === "Fiado" ||
                    data.paymentMethod === "Fiado (Quitado)" ||
                    data.fiado;

                if (isFiado) {

                    const itemsList = Array.isArray(data.items)
                        ? data.items.map((item: any) => ({
                            name: item.name || "Item",
                            qty:
                                item.saleQty ||
                                item.quantity ||
                                1
                        }))
                        : [{ name: "Serviço", qty: 1 }];

                    list.push({
                        id: docSnap.id,

                        clientName:
                            data.fiado?.nome ||
                            data.clientName ||
                            "Cliente não informado",

                        date:
                            data.timestamp
                                ?.toDate()
                                ?.toLocaleDateString("pt-BR") || "--",

                        time:
                            data.timestamp
                                ?.toDate()
                                ?.toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit"
                                }) || "--",

                        total:
                            Number(data.total) ||
                            data.fiado?.valor ||
                            0,

                        items: itemsList,

                        phone:
                            data.fiado?.whatsapp ||
                            "",

                        note:
                            data.note ||
                            "Sem observações.",

                        status: data.status,

                        timestamp: data.timestamp
                    });
                }

            });

            list.sort(
                (a, b) =>
                    (b.timestamp?.toMillis?.() || 0) -
                    (a.timestamp?.toMillis?.() || 0)
            );

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

    const filteredFiados = fiados.filter((f) => {

        const matchesSearch =
            f.clientName
                .toLowerCase()
                .includes(searchTerm.toLowerCase()) ||

            (f.phone || "")
                .includes(searchTerm);

        if (selectedMonth === "all") {
            return matchesSearch;
        }

        const saleMonth =
            f.timestamp
                ?.toDate()
                ?.toISOString()
                ?.slice(0, 7);

        return (
            matchesSearch &&
            saleMonth === selectedMonth
        );

    });

    const totalPendente = filteredFiados.reduce(
        (acc, cur) => acc + cur.total,
        0
    );

    const handleMarkAsPaid = async (id: string) => {

        if (
            !confirm("Marcar este fiado como pago?")
        ) return;

        try {

            await updateDoc(doc(db, "sales", id), {
                status: "completed",
                paidAt: serverTimestamp(),
                originalPaymentMethod: "Fiado",
                paymentMethod: "Fiado (Quitado)"
            });

            alert("Fiado quitado com sucesso!");

            fetchFiados();

        } catch (e) {

            alert("Erro ao atualizar.");

        }

    };

    const handleCancelFiado = async (id: string) => {

        if (
            !confirm(
                "Tem certeza que deseja CANCELAR este fiado?"
            )
        ) return;

        try {

            await updateDoc(doc(db, "sales", id), {
                status: "cancelled",
                cancelledAt: serverTimestamp()
            });

            alert("Fiado cancelado.");

            fetchFiados();

        } catch (e) {

            alert("Erro ao cancelar.");

        }

    };

    const openQuitarModal = (sale: FiadoSale) => {
        setSelectedFiado(sale);
        setShowQuitarModal(true);
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-300 p-4 md:p-8 font-sans antialiased">

            {showQuitarModal && selectedFiado && (
                <QuitarFiadoModal
                    saleId={selectedFiado.id}
                    total={selectedFiado.total}
                    onClose={() => {
                        setShowQuitarModal(false);
                        setSelectedFiado(null);
                    }}
                    onSuccess={() => {
                        setShowQuitarModal(false);
                        setSelectedFiado(null);
                        fetchFiados();
                    }} clientName={""} />
            )}

            <div className="max-w-6xl mx-auto space-y-6">

                {/* HEADER */}

                <header className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 border-b border-slate-800 pb-6">

                    <div>
                        <h1 className="text-3xl md:text-4xl font-black italic text-white">
                            SOLUCELL
                            <span className="text-blue-600">.</span>
                        </h1>

                        <p className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
                            Gestão de Fiado
                        </p>
                    </div>

                    <div className="text-left lg:text-right">
                        <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">
                            Controle financeiro
                        </p>

                        <p className="text-sm text-slate-400 font-bold">
                            Clientes pendentes e histórico
                        </p>
                    </div>

                </header>

                {/* CARDS */}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                    <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
                        <p className="text-slate-500 text-[9px] font-black uppercase mb-2">
                            Total Pendente
                        </p>

                        <p className="text-2xl font-black text-rose-500">
                            R$ {totalPendente.toFixed(2)}
                        </p>
                    </div>

                    <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
                        <p className="text-slate-500 text-[9px] font-black uppercase mb-2">
                            Quantidade
                        </p>

                        <p className="text-2xl font-black text-white">
                            {filteredFiados.length}
                        </p>
                    </div>

                    <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
                        <p className="text-slate-500 text-[9px] font-black uppercase mb-2">
                            Pendentes
                        </p>

                        <p className="text-2xl font-black text-yellow-400">
                            {
                                fiados.filter(
                                    f => f.status === "pending"
                                ).length
                            }
                        </p>
                    </div>

                    <div className="bg-blue-600/10 p-5 rounded-xl border border-blue-500/20 relative overflow-hidden">

                        <div className="absolute right-4 top-4 text-blue-500/20">
                            <Wallet size={38} />
                        </div>

                        <p className="text-blue-400 text-[9px] font-black uppercase mb-2">
                            Histórico Pago
                        </p>

                        <p className="text-2xl font-black text-white">
                            {
                                fiados.filter(
                                    f => f.status === "completed"
                                ).length
                            }
                        </p>

                    </div>

                </div>

                {/* FILTROS */}

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-4">

                    <div className="relative">
                        <Search
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                            size={18}
                        />

                        <input
                            placeholder="Buscar cliente ou telefone..."
                            value={searchTerm}
                            onChange={(e) =>
                                setSearchTerm(e.target.value)
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-cyan-500"
                        />
                    </div>

                    <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">

                        <button
                            onClick={() =>
                                setActiveTab("pendentes")
                            }
                            className={`px-6 py-3 rounded-xl text-xs font-black transition-all ${activeTab === "pendentes"
                                ? "bg-white text-slate-950"
                                : "text-slate-400"
                                }`}
                        >
                            PENDENTES
                        </button>

                        <button
                            onClick={() =>
                                setActiveTab("historico")
                            }
                            className={`px-6 py-3 rounded-xl text-xs font-black transition-all ${activeTab === "historico"
                                ? "bg-white text-slate-950"
                                : "text-slate-400"
                                }`}
                        >
                            HISTÓRICO
                        </button>

                    </div>

                    <select
                        value={selectedMonth}
                        onChange={(e) =>
                            setSelectedMonth(e.target.value)
                        }
                        className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-4 text-sm outline-none text-slate-400"
                    >
                        <option value="all">
                            Todos os meses
                        </option>

                        <option value="2026-01">
                            Janeiro 2026
                        </option>

                        <option value="2026-02">
                            Fevereiro 2026
                        </option>

                        <option value="2026-03">
                            Março 2026
                        </option>

                        <option value="2026-04">
                            Abril 2026
                        </option>

                    </select>

                </div>

                {/* LISTA */}

                {loading ? (

                    <div className="flex justify-center py-20">
                        <Loader2
                            className="animate-spin text-cyan-500"
                            size={50}
                        />
                    </div>

                ) : filteredFiados.length === 0 ? (

                    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-16 text-center">

                        <AlertCircle
                            size={50}
                            className="mx-auto text-slate-600 mb-4"
                        />

                        <p className="text-slate-400 font-bold">
                            Nenhum fiado encontrado.
                        </p>

                    </div>

                ) : (

                    <div className="space-y-4">

                        {filteredFiados.map((sale) => (

                            <div
                                key={sale.id}
                                className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 hover:border-cyan-500/20 transition-all"
                            >

                                <div className="flex flex-col xl:flex-row gap-6">

                                    {/* INFO */}

                                    <div className="flex-1 space-y-4">

                                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">

                                            <div className="flex gap-3">

                                                <div className="h-11 w-11 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                                                    <User
                                                        className="text-slate-500"
                                                        size={18}
                                                    />
                                                </div>

                                                <div>

                                                    <h3 className="text-base font-bold text-white tracking-tight">
                                                        {sale.clientName}
                                                    </h3>

                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">

                                                        <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                                            <Calendar size={10} />
                                                            {sale.date}
                                                        </div>

                                                        <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                                            <Clock size={10} />
                                                            {sale.time}
                                                        </div>

                                                    </div>

                                                </div>

                                            </div>

                                            <div className="text-left md:text-right">

                                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-0.5">
                                                    Total Devido
                                                </p>

                                                <p className="text-xl font-bold text-white font-mono">
                                                    R$ {sale.total.toFixed(2)}
                                                </p>

                                            </div>

                                        </div>

                                        {/* ITENS */}

                                        <div className="flex flex-wrap gap-1.5">

                                            {sale.items.map((item, i) => (

                                                <div
                                                    key={i}
                                                    className="bg-slate-950 border border-slate-800/50 rounded px-2.5 py-1 text-[10px] text-slate-400 font-medium"
                                                >
                                                    <span className="text-cyan-500 font-bold mr-1">
                                                        {item.qty}x
                                                    </span>

                                                    {item.name}
                                                </div>

                                            ))}

                                        </div>

                                        {/* OBS */}

                                        <div className="bg-slate-950/40 border border-slate-800/40 rounded-lg p-3">

                                            <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                                                Observação
                                            </p>

                                            <p className="text-xs text-slate-400">
                                                {sale.note}
                                            </p>

                                        </div>

                                    </div>

                                    {/* AÇÕES */}

                                    <div className="xl:w-60 flex flex-col gap-2 justify-center shrink-0 border-t xl:border-t-0 xl:border-l border-slate-800/60 pt-4 xl:pt-0 xl:pl-4">

                                        {activeTab === "pendentes" && (

                                            <>
                                                <button
                                                    onClick={() =>
                                                        openQuitarModal(sale)
                                                    }
                                                    className="w-full bg-cyan-600 hover:bg-cyan-500 rounded-lg py-2 font-bold text-white flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] text-xs shadow-sm"
                                                >
                                                    <CheckCircle2 size={14} />
                                                    QUITAR FIADO
                                                </button>

                                                <button
                                                    onClick={() =>
                                                        handleCancelFiado(sale.id)
                                                    }
                                                    className="w-full bg-slate-950 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/30 rounded-lg py-1.5 font-bold text-slate-500 hover:text-rose-400 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] text-[11px]"
                                                >
                                                    <X size={12} />
                                                    CANCELAR
                                                </button>
                                            </>

                                        )}

                                        {!!sale.phone && (

                                            <a
                                                href={`https://wa.me/${sale.phone.replace(/\D/g, "")}?text=Olá ${encodeURIComponent(sale.clientName)}, passando para lembrar sobre o fiado pendente no valor de R$ ${sale.total.toFixed(2)}.`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg py-1.5 font-bold text-slate-400 flex items-center justify-center gap-1.5 transition-all text-[11px]"
                                            >
                                                <MessageCircle
                                                    className="text-emerald-500"
                                                    size={13}
                                                />

                                                WHATSAPP
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