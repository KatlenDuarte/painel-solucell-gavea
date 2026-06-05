// src/screens/Reports.tsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
    Calendar, DollarSign, ShoppingCart, CreditCard,
    Download, Clock, Search, ArrowUp, ArrowDown
} from "lucide-react";

interface SaleData {
    id: string;
    items: any[];
    timestamp: any;
    total: number;
    status: string;
    store: string;
    paymentMethod?: string;
    payments?: {
        pix?: number;
        cartao?: number;
        dinheiro?: number;
    };
}

interface FormattedPayment {
    method: string;
    value: number;
}

const EXCLUDED_STORE_EMAIL = "minha-loja@exemplo.com";
const EXCLUDED_STORE_NORMALIZED = EXCLUDED_STORE_EMAIL.toLowerCase().trim();

export default function Reports() {
    const [sales, setSales] = useState<SaleData[]>([]);
    const [loading, setLoading] = useState(true);

    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Estados dos Filtros
    const [period, setPeriod] = useState<
        | "day"
        | "week"
        | "month"
        | "year"
        | "custom_month"
        | "custom_day"
        | "custom"
    >("day");
    const [searchTerm, setSearchTerm] = useState("");
    const [paymentFilter, setPaymentFilter] = useState("all");

    // Estado de Ordenação por Valor
    const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

    // Estados para Filtros Específicos
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedDay, setSelectedDay] = useState("");

    const reportRef = useRef<HTMLDivElement>(null);

    // Buscar todas as vendas do Firebase
    useEffect(() => {
        async function fetchSales() {
            setLoading(true);
            try {
                const q = query(collection(db, "sales"), orderBy("timestamp", "desc"));
                const snapshot = await getDocs(q);

                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    total: Number(doc.data().total) || 0,
                    store: (doc.data().store || "").trim()
                } as SaleData));

                setSales(data);
            } catch (error) {
                console.error("Erro ao buscar vendas:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchSales();
    }, []);

    const isSaleValid = (sale: SaleData) => {
        const status = sale.status?.toLowerCase();
        const isCompleted = !status || status === "completed" || status === "active";
        const isNotExcluded = sale.store.toLowerCase().trim() !== EXCLUDED_STORE_NORMALIZED;
        return isCompleted && isNotExcluded;
    };

    // Helper para decodificar múltiplos pagamentos
    const getSplitPayments = (sale: SaleData): FormattedPayment[] => {
        const dbPayments = sale.payments || {};
        const splits: FormattedPayment[] = [];

        if (sale.paymentMethod === "Múltiplos" || !sale.paymentMethod) {
            if (Number(dbPayments.pix) > 0) splits.push({ method: "PIX", value: Number(dbPayments.pix) });
            if (Number(dbPayments.cartao) > 0) splits.push({ method: "CARTÃO", value: Number(dbPayments.cartao) });
            if (Number(dbPayments.dinheiro) > 0) splits.push({ method: "DINHEIRO", value: Number(dbPayments.dinheiro) });
        }
        return splits;
    };

    // Lógica de Filtragem e Ordenação
    const processedSales = useMemo(() => {
        const now = new Date();
        let startDateFilter: Date;
        let endDateFilter: Date | null = null;

        switch (period) {
            case "day":
                startDateFilter = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate()
                );
                break;

            case "week":
                startDateFilter = new Date();
                startDateFilter.setDate(now.getDate() - 7);
                break;

            case "month":
                startDateFilter = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    1
                );
                break;

            case "year":
                startDateFilter = new Date(
                    now.getFullYear(),
                    0,
                    1
                );
                break;

            case "custom_month":
                startDateFilter = new Date(
                    selectedYear,
                    selectedMonth,
                    1
                );

                endDateFilter = new Date(
                    selectedYear,
                    selectedMonth + 1,
                    0,
                    23,
                    59,
                    59
                );
                break;

            case "custom_day":
                if (!selectedDay) {
                    startDateFilter = new Date(0);
                } else {
                    const [y, m, d] = selectedDay
                        .split("-")
                        .map(Number);

                    startDateFilter = new Date(
                        y,
                        m - 1,
                        d,
                        0,
                        0,
                        0
                    );

                    endDateFilter = new Date(
                        y,
                        m - 1,
                        d,
                        23,
                        59,
                        59
                    );
                }
                break;

            case "custom":
                startDateFilter = startDate
                    ? new Date(startDate + "T00:00:00")
                    : new Date(0);

                endDateFilter = endDate
                    ? new Date(endDate + "T23:59:59")
                    : null;
                break;

            default:
                startDateFilter = new Date(0);
        }

        const filtered = sales.filter(sale => {
            const saleDate = sale.timestamp?.toDate();
            if (!saleDate) return false;

            const matchesDate = endDateFilter
                ? (
                    saleDate >= startDateFilter &&
                    saleDate <= endDateFilter
                )
                : (
                    saleDate >= startDateFilter
                );
            if (!matchesDate) return false;

            if (!isSaleValid(sale)) return false;

            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                sale.id.toLowerCase().includes(searchLower) ||
                sale.items?.some((item: any) =>
                    item.name?.toLowerCase().includes(searchLower)
                );
            if (!matchesSearch) return false;

            const splits = getSplitPayments(sale);
            if (paymentFilter !== "all") {
                if (sale.paymentMethod?.toUpperCase() === "MÚLTIPLOS" || !sale.paymentMethod) {
                    const hasMethod = splits.some(p => p.method.toUpperCase().includes(paymentFilter.toUpperCase()));
                    if (!hasMethod) return false;
                } else {
                    const matchesPayment = (sale.paymentMethod || "").toUpperCase().includes(paymentFilter.toUpperCase());
                    if (!matchesPayment) return false;
                }
            }

            return true;
        });

        return [...filtered].sort((a, b) => {
            if (sortDirection === "asc") return a.total - b.total;
            return b.total - a.total;
        });
    }, [sales, period, searchTerm, paymentFilter, sortDirection, selectedMonth, selectedYear, selectedDay]);

    // Métricas
    const metrics = useMemo(() => {
        let totalRevenue = 0;
        let totalPix = 0;
        let totalCartao = 0;
        let totalDinheiro = 0;

        processedSales.forEach(sale => {
            totalRevenue += sale.total;
            const splits = getSplitPayments(sale);

            if (splits.length > 0) {
                splits.forEach(p => {
                    if (p.method.includes("PIX")) totalPix += p.value;
                    if (p.method.includes("CARTÃO")) totalCartao += p.value;
                    if (p.method.includes("DINHEIRO")) totalDinheiro += p.value;
                });
            } else {
                const method = (sale.paymentMethod || "").toUpperCase();
                if (method.includes("PIX")) totalPix += sale.total;
                if (method.includes("CARTA")) totalCartao += sale.total;
                if (method.includes("DINHEIRO")) totalDinheiro += sale.total;
            }
        });

        const totalSales = processedSales.length;
        const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

        return { totalRevenue, totalPix, totalCartao, totalDinheiro, totalSales, avgTicket };
    }, [processedSales]);

    const getPaymentBadge = (method?: string) => {
        const m = (method || "").toUpperCase();
        if (m.includes("PIX")) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        if (m.includes("CARTÃO") || m.includes("CARTAO")) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
        if (m.includes("DINHEIRO")) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
        if (m.includes("FIADO")) return "bg-rose-500/10 text-rose-400 border-rose-500/20";
        return "bg-slate-800 text-slate-400 border-slate-700";
    };

    const toggleSort = () => {
        setSortDirection(prev => prev === "desc" ? "asc" : "desc");
    };

    const exportToPDF = async () => {
        const btn = document.querySelector('.no-export') as HTMLElement;
        if (btn) btn.style.display = 'none';

        if (!reportRef.current) return;
        const canvas = await html2canvas(reportRef.current, { scale: 2 });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");

        pdf.setFontSize(18);
        pdf.text("SOLUCELL.", 14, 20);
        pdf.setFontSize(11);
        pdf.text(`Relatório de Vendas - Período: ${period}`, 14, 28);

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, "PNG", 5, 35, pdfWidth - 10, pdfHeight);
        pdf.save(`relatorio_${new Date().getTime()}.pdf`);

        if (btn) btn.style.display = 'flex';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-400 text-xs font-semibold uppercase tracking-widest animate-pulse">
                Carregando relatório de movimentações...
            </div>
        );
    }

    return (
        <div ref={reportRef} className="p-4 md:p-8 bg-[#020617] min-h-screen space-y-6 text-slate-300 antialiased selection:bg-blue-500/30">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-6">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight uppercase">
                        Relatório de <span className="text-blue-500">vendas</span>
                    </h1>
                    <p className="text-slate-500 text-[11px] font-medium tracking-wide mt-1">
                        Auditoria de transações, filtros por competência e exportações de performance.
                    </p>
                </div>

                <button
                    onClick={exportToPDF}
                    className="no-export flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs tracking-wide transition-all shadow-lg active:scale-[0.98]"
                >
                    <Download size={14} />
                    Exportar Relatório (.PDF)
                </button>
            </header>

            {/* Filtros Administrativos */}
            <section className="no-export bg-slate-900/20 border border-slate-900 p-5 rounded-2xl grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Períodos Rápidos */}
                <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Período de Análise</p>
                    <div className="flex flex-wrap gap-1.5">
                        {[
                            { label: "Hoje", value: "day" },
                            { label: "7 Dias", value: "week" },
                            { label: "Mês Atual", value: "month" },
                            { label: "Ano", value: "year" }
                        ].map(({ label, value }) => (
                            <button
                                key={value}
                                onClick={() => setPeriod(value as any)}
                                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${period === value ? "bg-slate-800 text-white border border-slate-700" : "bg-transparent text-slate-500 hover:text-slate-300 border border-transparent"
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mês Específico */}
                <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Histórico por Mês</p>
                    <div className="flex gap-2">
                        <select
                            value={selectedMonth}
                            onChange={(e) => {
                                setSelectedMonth(Number(e.target.value));
                                setPeriod("custom_month");
                            }}
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white outline-none focus:border-slate-700 transition-colors"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i} value={i} className="bg-slate-950 text-slate-300">
                                    {new Date(2026, i).toLocaleString('pt-BR', { month: 'long' }).toUpperCase()}
                                </option>
                            ))}
                        </select>
                        <input
                            type="number"
                            value={selectedYear}
                            onChange={(e) => {
                                setSelectedYear(Number(e.target.value));
                                setPeriod("custom_month");
                            }}
                            className="w-20 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white outline-none text-center focus:border-slate-700 transition-colors"
                        />
                    </div>
                </div>

                {/* Dia Específico */}
                <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Período Personalizado
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setPeriod("custom");
                            }}
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                        />

                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setPeriod("custom");
                            }}
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                        />
                    </div>

                    <p className="text-[10px] text-slate-500">
                        {startDate || "--/--/----"} até {endDate || "--/--/----"}
                    </p>
                </div>
            </section>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl relative overflow-hidden">
                    <div className="absolute right-4 top-4 text-slate-800">
                        <DollarSign size={24} />
                    </div>
                    <p className="text-slate-500 text-xs font-medium uppercase">Faturamento Líquido</p>
                    <h3 className="text-2xl font-bold text-white tracking-tight mt-1">R$ {metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-medium text-slate-400">
                        <span className="bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 text-emerald-400">PIX: R$ {metrics.totalPix.toFixed(0)}</span>
                        <span className="bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10 text-blue-400">Card: R$ {metrics.totalCartao.toFixed(0)}</span>
                        <span className="bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 text-amber-400">Cash: R$ {metrics.totalDinheiro.toFixed(0)}</span>
                    </div>
                </div>

                <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl relative overflow-hidden">
                    <div className="absolute right-4 top-4 text-slate-800">
                        <ShoppingCart size={24} />
                    </div>
                    <p className="text-slate-500 text-xs font-medium uppercase">Volume Total</p>
                    <h3 className="text-2xl font-bold text-white tracking-tight mt-1">{metrics.totalSales} Vendas</h3>
                    <p className="text-slate-600 text-[10px] font-medium mt-3 uppercase tracking-wider">Período ativo selecionado</p>
                </div>

                <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl relative overflow-hidden">
                    <div className="absolute right-4 top-4 text-slate-800">
                        <CreditCard size={24} />
                    </div>
                    <p className="text-slate-500 text-xs font-medium uppercase">Ticket Médio</p>
                    <h3 className="text-2xl font-bold text-white tracking-tight mt-1">R$ {metrics.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    <p className="text-slate-600 text-[10px] font-medium mt-3 uppercase tracking-wider">Média geométrica por pedido</p>
                </div>
            </div>

            {/* Tabela Customizada baseada no estilo do Sales */}
            <section className="bg-slate-900/10 border border-slate-900 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/40 border-b border-slate-900">
                                <th className="px-6 py-4 min-w-[280px]">
                                    <div className="flex flex-col gap-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Descrição dos itens</span>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700" size={12} />
                                            <input
                                                placeholder="Localizar venda..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-slate-700 transition-all placeholder-slate-700"
                                            />
                                        </div>
                                    </div>
                                </th>
                                <th className="px-6 py-4">
                                    <div className="flex flex-col gap-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</span>
                                        <button
                                            onClick={toggleSort}
                                            className="bg-slate-950 hover:bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-slate-400 flex items-center gap-1.5 transition-all w-fit"
                                        >
                                            Valor
                                            {sortDirection === "desc" ? (
                                                <ArrowDown size={11} className="text-blue-500" />
                                            ) : (
                                                <ArrowUp size={11} className="text-emerald-500" />
                                            )}
                                        </button>
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Modalidade</span>
                                        <select
                                            value={paymentFilter}
                                            onChange={(e) => setPaymentFilter(e.target.value)}
                                            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-slate-400 outline-none cursor-pointer"
                                        >
                                            <option value="all">TODOS</option>
                                            <option value="pix">PIX</option>
                                            <option value="cartão">CARTÃO</option>
                                            <option value="dinheiro">DINHEIRO</option>
                                            <option value="fiado">FIADO</option>
                                        </select>
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-right">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Timestamp</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/50">
                            {processedSales.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12 text-slate-600 text-xs font-medium uppercase tracking-wider">
                                        Nenhuma movimentação listada neste escopo.
                                    </td>
                                </tr>
                            ) : (
                                processedSales.map(sale => {
                                    const splits = getSplitPayments(sale);

                                    return (
                                        <tr key={sale.id} className="hover:bg-slate-900/20 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="text-xs text-slate-200 font-semibold line-clamp-1">
                                                    {sale.items?.map((i: any) => `${i.saleQty || 1}x ${i.name}`).join(", ") || "Venda Direta / Serviço"}
                                                </p>
                                                <p className="text-[10px] text-slate-600 font-mono mt-0.5 select-all">
                                                    {sale.id}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-white text-xs">
                                                R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center justify-center">
                                                    {splits.length > 0 ? (
                                                        <div className="flex flex-wrap justify-center gap-1 max-w-[180px]">
                                                            {splits.map((p, idx) => (
                                                                <span key={idx} className="bg-slate-950 border border-slate-900 text-[9px] font-semibold px-1.5 py-0.5 rounded text-slate-400">
                                                                    {p.method}: R${p.value}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-semibold border ${getPaymentBadge(sale.paymentMethod)}`}>
                                                            {(sale.paymentMethod || "N/I").toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs">
                                                <div className="inline-flex flex-col items-end">
                                                    <span className="text-slate-400 font-medium">
                                                        {sale.timestamp?.toDate().toLocaleDateString("pt-BR")}
                                                    </span>
                                                    <span className="text-slate-600 text-[10px] flex items-center gap-1 mt-0.5 font-normal">
                                                        <Clock size={10} />
                                                        {sale.timestamp?.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}