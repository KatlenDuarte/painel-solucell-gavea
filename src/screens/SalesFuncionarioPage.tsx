// src/screens/SalesFuncionarioPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Plus,
    Search,
    CreditCard,
    Smartphone,
    DollarSign,
    Eye,
    EyeOff,
    Clock,
    Calendar,
    User,
    TrendingUp
} from "lucide-react";

import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

import NewSaleModal from "../components/NewSaleModal";

interface SaleItem {
    name: string;
    saleQty: number;
    price: number;
}

interface FormattedPayment {
    method: string;
    value: number;
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
    splitPayments?: FormattedPayment[];
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

    // ================= FETCH =================
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
                const isFiadoQuitado =
                    data.paidAt &&
                    (
                        data.paymentMethod === "Fiado (Quitado)" ||
                        data.originalPaymentMethod === "Fiado"
                    );

                const ts = isFiadoQuitado
                    ? data.paidAt.toDate()
                    : data.timestamp?.toDate();

                const dbPayments = data.payments || {};
                const splitPayments: FormattedPayment[] = [];

                if (data.paymentMethod === "Múltiplos" || !data.paymentMethod) {
                    if (Number(dbPayments.pix) > 0) {
                        splitPayments.push({
                            method: "PIX",
                            value: Number(dbPayments.pix)
                        });
                    }

                    if (Number(dbPayments.cartao) > 0) {
                        splitPayments.push({
                            method: "CARTÃO",
                            value: Number(dbPayments.cartao)
                        });
                    }

                    if (Number(dbPayments.dinheiro) > 0) {
                        splitPayments.push({
                            method: "DINHEIRO",
                            value: Number(dbPayments.dinheiro)
                        });
                    }
                }

                return {
                    id: doc.id,
                    dateObject: ts,
                    date: ts
                        ? ts.toLocaleDateString("pt-BR")
                        : "--/--/----",
                    time: ts
                        ? ts.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit"
                        })
                        : "--:--",
                    items: data.items || [],
                    total: Number(data.total) || 0,
                    payment: data.paymentMethod || "Não informado",
                    status: data.status || "completed",
                    clientName:
                        data.clientName ||
                        data.fiado?.nome ||
                        data.payments?.fiado?.nome ||
                        null,
                    splitPayments:
                        splitPayments.length > 0
                            ? splitPayments
                            : undefined
                };
            });

            setSales(
                list.sort(
                    (a, b) =>
                        (b.dateObject?.getTime() || 0) -
                        (a.dateObject?.getTime() || 0)
                )
            );
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [storeEmail]);

    useEffect(() => {
        fetchSales();
    }, [fetchSales]);

    // ================= FILTROS =================
    const filteredByPeriod = sales.filter((sale) => {
        if (!sale.dateObject) return false;

        const now = new Date();
        const saleDate = sale.dateObject;

        if (filter === "today") {
            return saleDate.toDateString() === now.toDateString();
        }

        if (filter === "week") {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);

            return saleDate >= oneWeekAgo;
        }

        if (filter === "month") {
            return (
                saleDate.getMonth() === now.getMonth() &&
                saleDate.getFullYear() === now.getFullYear()
            );
        }

        return true;
    });

    const normalize = (text: string) =>
        text
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase();

    // ================= STATS =================
    const stats = filteredByPeriod.reduce(
        (acc, sale) => {
            if (
                sale.status === "refunded" ||
                sale.status === "cancelled"
            ) {
                return acc;
            }

            if (sale.splitPayments && sale.splitPayments.length > 0) {
                sale.splitPayments.forEach((p) => {
                    const method = normalize(p.method);

                    if (method.includes("PIX")) {
                        acc.pix += p.value;
                    }

                    if (method.includes("CARTAO")) {
                        acc.cartao += p.value;
                    }

                    if (method.includes("DINHEIRO")) {
                        acc.dinheiro += p.value;
                    }
                });
            } else {
                const method = normalize(sale.payment);

                if (method.includes("PIX")) {
                    acc.pix += sale.total;
                }

                if (method.includes("CARTAO")) {
                    acc.cartao += sale.total;
                }

                if (method.includes("DINHEIRO")) {
                    acc.dinheiro += sale.total;
                }
            }

            acc.total += sale.total;

            return acc;
        },
        {
            pix: 0,
            cartao: 0,
            dinheiro: 0,
            total: 0
        }
    );

    const finalFilteredSales = filteredByPeriod.filter((sale) => {
        const search = searchTerm.toLowerCase();

        return (
            search === "" ||
            sale.items.some((i) =>
                i.name.toLowerCase().includes(search)
            ) ||
            sale.clientName?.toLowerCase().includes(search)
        );
    });

    return (
        <div className="min-h-screen bg-[#020617] text-slate-300 p-4 md:p-8 font-sans antialiased">
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

            <div className="max-w-6xl mx-auto space-y-6">
                {/* HEADER */}
                <header className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 border-b border-slate-800 pb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-2.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">
                                Painel Operacional
                            </span>

                            <span className="bg-slate-950 text-slate-500 text-[9px] font-black px-2.5 py-0.5 rounded border border-slate-800/80 uppercase tracking-widest">
                                {new Date().toLocaleDateString("pt-BR")}
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-4xl font-black italic text-white">
                            FLUXO DE{" "}
                            <span className="text-emerald-500">
                                CAIXA
                            </span>
                            <span className="text-emerald-500">.</span>
                        </h1>

                        <p className="text-slate-500 text-sm mt-2 font-medium">
                            Modo Funcionário
                        </p>
                    </div>

                    <div className="flex items-center gap-3 self-start lg:self-end">
                        <button
                            onClick={() =>
                                setHideValues(!hideValues)
                            }
                            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2 rounded-xl text-xs font-bold text-slate-400 transition-all active:scale-[0.97]"
                        >
                            {hideValues ? (
                                <EyeOff size={14} />
                            ) : (
                                <Eye size={14} />
                            )}

                            <span>
                                {hideValues
                                    ? "Mostrar Valores"
                                    : "Ocultar Valores"}
                            </span>
                        </button>

                        <button
                            onClick={() =>
                                setIsNewSaleModalOpen(true)
                            }
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-500 flex items-center gap-1.5 transition-all active:scale-[0.97] shadow-sm"
                        >
                            <Plus
                                size={16}
                                strokeWidth={2.5}
                            />
                            Nova Venda
                        </button>
                    </div>
                </header>

                {/* CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* PIX */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <Smartphone
                                    className="text-emerald-500"
                                    size={14}
                                />

                                <p className="text-slate-500 text-[9px] font-black uppercase tracking-wider">
                                    PIX
                                </p>
                            </div>

                            <p className="text-2xl font-black tracking-tight text-white">
                                {hideValues
                                    ? "••••••"
                                    : `R$ ${stats.pix.toLocaleString(
                                        "pt-BR",
                                        {
                                            minimumFractionDigits: 2
                                        }
                                    )}`}
                            </p>
                        </div>
                    </div>

                    {/* CARTÃO */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <CreditCard
                                    className="text-blue-500"
                                    size={14}
                                />

                                <p className="text-slate-500 text-[9px] font-black uppercase tracking-wider">
                                    Cartão
                                </p>
                            </div>

                            <p className="text-2xl font-black tracking-tight text-white">
                                {hideValues
                                    ? "••••••"
                                    : `R$ ${stats.cartao.toLocaleString(
                                        "pt-BR",
                                        {
                                            minimumFractionDigits: 2
                                        }
                                    )}`}
                            </p>
                        </div>
                    </div>

                    {/* DINHEIRO */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <DollarSign
                                    className="text-amber-500"
                                    size={14}
                                />

                                <p className="text-slate-500 text-[9px] font-black uppercase tracking-wider">
                                    Dinheiro
                                </p>
                            </div>

                            <p className="text-2xl font-black tracking-tight text-white">
                                {hideValues
                                    ? "••••••"
                                    : `R$ ${stats.dinheiro.toLocaleString(
                                        "pt-BR",
                                        {
                                            minimumFractionDigits: 2
                                        }
                                    )}`}
                            </p>
                        </div>
                    </div>

                    {/* TOTAL */}
                    <div className="bg-emerald-600/10 border border-emerald-500/20 rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute right-4 top-4 text-emerald-500/5">
                            <TrendingUp size={38} />
                        </div>

                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <TrendingUp
                                    className="text-emerald-400"
                                    size={14}
                                />

                                <p className="text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                                    {filter === "today"
                                        ? "Faturamento Dia"
                                        : filter === "week"
                                            ? "Faturamento Semana"
                                            : "Faturamento Mês"}
                                </p>
                            </div>

                            <p className="text-2xl font-black tracking-tight text-emerald-400">
                                {hideValues
                                    ? "••••••"
                                    : `R$ ${stats.total.toLocaleString(
                                        "pt-BR",
                                        {
                                            minimumFractionDigits: 2
                                        }
                                    )}`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* FILTROS */}
                <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 items-center">
                    <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1 w-full sm:w-auto shrink-0">
                        {(["today", "week", "month"] as const).map(
                            (f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-4 py-2.5 rounded-lg text-xs font-black transition-all ${filter === f
                                        ? "bg-white text-slate-950"
                                        : "text-slate-400 hover:text-slate-200"
                                        }`}
                                >
                                    {f === "today"
                                        ? "HOJE"
                                        : f === "week"
                                            ? "SEMANA"
                                            : "MÊS"}
                                </button>
                            )
                        )}
                    </div>

                    <div className="relative w-full">
                        <Search
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                            size={18}
                        />

                        <input
                            type="text"
                            placeholder="Buscar venda no fluxo..."
                            value={searchTerm}
                            onChange={(e) =>
                                setSearchTerm(e.target.value)
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3.5 pl-12 pr-4 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
                        />
                    </div>
                </div>

                {/* LISTAGEM */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="py-20 text-center border border-slate-800 rounded-xl text-slate-600 font-bold animate-pulse uppercase text-[10px] tracking-widest">
                            Sincronizando fluxo de caixa...
                        </div>
                    ) : finalFilteredSales.length === 0 ? (
                        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-16 text-center text-slate-500 font-bold text-sm">
                            Nenhuma venda encontrada.
                        </div>
                    ) : (
                        finalFilteredSales.map((sale) => {
                            const isFiado =
                                sale.status === "pending";

                            return (
                                <div
                                    key={sale.id}
                                    className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 hover:border-slate-700/50 transition-all"
                                >
                                    <div className="flex flex-col xl:flex-row gap-6">
                                        <div className="flex-1 space-y-4">
                                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        <h3 className="text-base font-bold tracking-tight text-white">
                                                            {sale.items.map(
                                                                (
                                                                    item,
                                                                    idx
                                                                ) => (
                                                                    <span
                                                                        key={
                                                                            idx
                                                                        }
                                                                    >
                                                                        <span className="text-emerald-500 font-bold mr-1">
                                                                            {
                                                                                item.saleQty
                                                                            }
                                                                            x
                                                                        </span>

                                                                        {
                                                                            item.name
                                                                        }

                                                                        {idx <
                                                                            sale
                                                                                .items
                                                                                .length -
                                                                            1
                                                                            ? ", "
                                                                            : ""}
                                                                    </span>
                                                                )
                                                            )}
                                                        </h3>

                                                        {isFiado && (
                                                            <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-black rounded uppercase tracking-wider">
                                                                FIADO
                                                                PENDENTE
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap gap-1.5">
                                                        <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                                            <Clock
                                                                size={
                                                                    10
                                                                }
                                                            />
                                                            {
                                                                sale.time
                                                            }
                                                        </div>

                                                        <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                                            <Calendar
                                                                size={
                                                                    10
                                                                }
                                                            />
                                                            {
                                                                sale.date
                                                            }
                                                        </div>

                                                        {sale.clientName && (
                                                            <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                                                <User
                                                                    size={
                                                                        10
                                                                    }
                                                                    className="text-slate-500"
                                                                />
                                                                {
                                                                    sale.clientName
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="text-left md:text-right flex flex-col md:items-end justify-between">
                                                    <div>
                                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-0.5">
                                                            Valor Total
                                                        </p>

                                                        <p className="text-xl font-bold tracking-tight text-white">
                                                            {hideValues
                                                                ? "•••••"
                                                                : `R$ ${sale.total.toLocaleString(
                                                                    "pt-BR",
                                                                    {
                                                                        minimumFractionDigits: 2
                                                                    }
                                                                )}`}
                                                        </p>
                                                    </div>

                                                    <div className="mt-2">
                                                        {sale.splitPayments &&
                                                            sale
                                                                .splitPayments
                                                                .length >
                                                            0 ? (
                                                            <div className="flex flex-wrap gap-1 justify-start md:justify-end">
                                                                {sale.splitPayments.map(
                                                                    (
                                                                        p,
                                                                        idx
                                                                    ) => (
                                                                        <span
                                                                            key={
                                                                                idx
                                                                            }
                                                                            className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-950/40 border border-purple-900/40 text-purple-300 uppercase"
                                                                        >
                                                                            {
                                                                                p.method
                                                                            }

                                                                            :{" "}
                                                                            {hideValues
                                                                                ? "••"
                                                                                : `R$ ${p.value.toLocaleString(
                                                                                    "pt-BR",
                                                                                    {
                                                                                        minimumFractionDigits: 2
                                                                                    }
                                                                                )}`}
                                                                        </span>
                                                                    )
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 uppercase inline-block">
                                                                {
                                                                    sale.payment
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
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