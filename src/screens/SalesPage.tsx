// src/screens/Sales.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Plus, Search, CreditCard, Smartphone,
    DollarSign, Undo2,
    TrendingUp, TrendingDown, Eye, EyeOff,
    Pencil, Clock, User, Wrench, Layers, Printer
} from "lucide-react";

import { useStoreData } from "../contexts/StoreDataContext";

import RefundConfirmationModal from "../components/RefundConfirmationModal";
import NewSaleModal from "../components/NewSaleModal";
import EditSaleModal from "../components/EditSaleModal";

interface SaleItem {
    id: string;
    name: string;
    saleQty: number;
    price: number;
}


// Interface para suportar múltiplos pagamentos na mesma venda
interface MultiplePayment {
    method: "PIX" | "CARTÃO" | "DINHEIRO" | string;
    value: number;
}

interface SaleWithClient {
    id: string;
    date: string;
    time: string;
    items: SaleItem[];
    total: number;
    payment: string; // Mantido para compatibilidade anterior
    status: "completed" | "pending" | "refunded" | "cancelled" | "loss";
    dateObject?: Date;
    clientName?: string;

    // NOVOS CAMPOS ADICIONADOS:
    type: "venda" | "manutencao";
    partCost?: number;          // Custo da peça se for manutenção
    multiplePayments?: MultiplePayment[]; // Array se houver mais de uma forma de pagamento
}

interface SalesProps {
    storeEmail: string;
}

export default function Sales({ storeEmail }: SalesProps) {
    const [filter, setFilter] = useState<"today" | "week" | "month" | "custom">("today");
    const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split("T")[0]);

    const [selectedMethodCard, setSelectedMethodCard] = useState<"PIX" | "CARTAO" | "DINHEIRO" | "TOTAL" | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [refundSaleId, setRefundSaleId] = useState<string | null>(null);
    const [isNewSaleModalOpen, setIsNewSaleModal] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [saleToEdit, setSaleToEdit] = useState<SaleWithClient | null>(null);
    const [barcodeInput, setBarcodeInput] = useState("");
    const barcodeRef = useRef<HTMLInputElement>(null);
    const { sales: salesDocs, salesLoading: isLoading, products: productDocs } = useStoreData();

    useEffect(() => {
        const handleKeyPress = async (e: KeyboardEvent) => {
            if (e.key !== "Enter") return;

            const code = barcodeInput.trim();

            if (!code) return;

            try {
                // Busca no estoque já carregado em memória (sem leitura extra no Firestore)
                const found = productDocs.find(d => String(d.data().barcode ?? "").trim() === code);

                if (!found) {
                    alert("Produto não encontrado.");
                    setBarcodeInput("");
                    return;
                }

                const product = { id: found.id, ...found.data() };

                setIsNewSaleModal(true);

                setTimeout(() => {
                    window.dispatchEvent(
                        new CustomEvent("scanner-product", {
                            detail: product
                        })
                    );
                }, 300);

                setBarcodeInput("");
            } catch (err) {
                console.error(err);
            }
        };

        window.addEventListener("keydown", handleKeyPress);

        return () =>
            window.removeEventListener("keydown", handleKeyPress);
    }, [barcodeInput, productDocs]);

    const [hideValues, setHideValues] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Vendas em tempo real pelo listener compartilhado (StoreDataContext).
    const sales = useMemo<SaleWithClient[]>(() => salesDocs.map((doc) => {
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
                    clientName: data.clientName || data.fiado?.nome || data.payments?.fiado?.nome,

                    // Tratamento dos novos campos vindo do Firebase
                    type: data.type || "venda",
                    partCost: Number(data.partCost) || 0,
                    multiplePayments:
                        data.multiplePayments ||
                        (data.payments
                            ? [
                                ...(data.payments.pix > 0
                                    ? [{ method: "PIX", value: data.payments.pix }]
                                    : []),

                                ...(data.payments.cartao > 0
                                    ? [{ method: "CARTÃO", value: data.payments.cartao }]
                                    : []),

                                ...(data.payments.dinheiro > 0
                                    ? [{ method: "DINHEIRO", value: data.payments.dinheiro }]
                                    : [])
                            ]
                            : null)
                };
            })
                .sort((a, b) => (b.dateObject?.getTime() || 0) - (a.dateObject?.getTime() || 0)), [salesDocs]);

    // Mantido para os callbacks dos modais: o listener já reflete as alterações.
    const fetchSalesFromFirestore = useCallback(() => {}, []);


    const handlePrintSale = async (sale: SaleWithClient) => {
        try {
            const response = await fetch("http://localhost:3333/print", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    customer: sale.clientName || "",
                    paymentMethod: sale.payment,
                    total: sale.total,
                    items: sale.items,
                    isOS: sale.type === "manutencao"
                }),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Erro ao imprimir");
            }

            alert("Cupom enviado para impressão!");
        } catch (err) {
            console.error(err);
            alert("Erro ao imprimir.");
        }
    };

    // 1. Filtragem estrita por período/data
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
        if (filter === "custom" && customDate) {
            const [year, month, day] = customDate.split("-").map(Number);
            return (
                saleDate.getDate() === day &&
                saleDate.getMonth() === month - 1 &&
                saleDate.getFullYear() === year
            );
        }
        return true;
    });

    const isLoss = (sale: SaleWithClient) =>
        sale.status === "loss" || sale.type === "perda";

    const getSumByMethod = (salesList: SaleWithClient[], method: string) => {
        return salesList
            .filter(s =>
                s.status !== "refunded" &&
                s.status !== "cancelled" &&
                !isLoss(s)
            )
            .reduce((acc, sale) => {
                if (sale.multiplePayments?.length) {
                    const totalMetodo = sale.multiplePayments
                        .filter(p => p.method.toUpperCase().includes(method))
                        .reduce((t, p) => t + p.value, 0);

                    return acc + totalMetodo;
                }

                return acc +
                    (sale.payment.toUpperCase().includes(method)
                        ? sale.total
                        : 0);
            }, 0);
    };

    // Cômputo dos cards atualizado para verificar se há pagamentos múltiplos splitados
    const losses = filteredByPeriod
        .filter(isLoss)
        .reduce((acc, sale) => acc + sale.total, 0);

    const stats = {
        pix: getSumByMethod(filteredByPeriod, "PIX"),

        cartao:
            getSumByMethod(filteredByPeriod, "CARTÃO") +
            getSumByMethod(filteredByPeriod, "CARTAO"),

        dinheiro: getSumByMethod(filteredByPeriod, "DINHEIRO"),

        total: filteredByPeriod
            .filter(s =>
                s.status !== "refunded" &&
                s.status !== "cancelled" &&
                !isLoss(s)
            )
            .reduce((acc, curr) => acc + curr.total, 0),

        perdas: losses
    };

    // 2. Aplica filtro do Card Selecionado + Busca por Texto
    const normalize = (text: string) =>
        text
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase();

    const finalFilteredSales = filteredByPeriod.filter((sale) => {
        // Filtro do Card Clicado (Verifica tanto o payment fixo quanto a lista de múltiplos pagamentos)
        if (selectedMethodCard) {
            const searchMap: Record<string, string> = { PIX: "PIX", CARTAO: "CARTAO", DINHEIRO: "DINHEIRO" };
            const target = searchMap[selectedMethodCard];

            if (target) {
                const hasInMultiple = sale.multiplePayments?.some(
                    p => normalize(p.method).includes(target)
                );

                const hasInSingle = normalize(sale.payment).includes(target);

                if (!hasInMultiple && !hasInSingle) return false;
            }
        }

        // Filtro de Busca por Input
        const search = searchTerm.toLowerCase();
        return search === "" ||
            sale.items.some(i => i.name.toLowerCase().includes(search)) ||
            sale.clientName?.toLowerCase().includes(search);
    });

    const handleCardClick = (cardType: "PIX" | "CARTAO" | "DINHEIRO" | "TOTAL") => {
        if (selectedMethodCard === cardType) {
            setSelectedMethodCard(null);
        } else {
            setSelectedMethodCard(cardType);
        }
    };

    // 3. Agrupamento por data para a linha do tempo (extrato)
    const groupedSales = finalFilteredSales.reduce<Record<string, SaleWithClient[]>>((acc, sale) => {
        if (!acc[sale.date]) acc[sale.date] = [];
        acc[sale.date].push(sale);
        return acc;
    }, {});

    const todayLabel = new Date().toLocaleDateString("pt-BR");

    const methodPct = (value: number) =>
        stats.total > 0 ? Math.min(100, (value / stats.total) * 100) : 0;

    const dotClasses = (sale: SaleWithClient) => {
        if (isLoss(sale)) return "bg-red-500 ring-red-500/30";
        if (sale.status === "refunded") return "bg-red-300 ring-red-500/30";
        if (sale.status === "cancelled") return "bg-slate-700 ring-slate-800";
        if (sale.status === "pending") return "bg-amber-400 ring-amber-500/30";
        return "bg-emerald-500 ring-emerald-500/30";
    };

    return (
        <div className="text-slate-300 p-4 md:p-8 font-sans antialiased relative overflow-x-hidden">

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

            <div className="max-w-7xl mx-auto space-y-6 relative z-10">

                {/* HEADER ENXUTO */}
                <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-widest">
                                Painel Operacional
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black italic text-slate-50 tracking-tight">
                            FLUXO DE <span className="text-emerald-400">CAIXA</span>
                            <span className="text-emerald-400">.</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setHideValues(!hideValues)}
                            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 shadow-sm transition-all active:scale-[0.97]"
                        >
                            {hideValues ? <EyeOff size={14} /> : <Eye size={14} />}
                            <span className="hidden sm:inline">{hideValues ? "Mostrar Valores" : "Ocultar Valores"}</span>
                        </button>

                        <button
                            onClick={() => setIsNewSaleModal(true)}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-500 flex items-center gap-1.5 transition-all active:scale-[0.97] shadow-md shadow-emerald-600/20"
                        >
                            <Plus size={16} strokeWidth={2.5} /> Nova Operação
                        </button>
                    </div>
                </header>

                <input
                    ref={barcodeRef}
                    autoFocus
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="absolute opacity-0 pointer-events-none"
                    type="text"
                />

                {/* LAYOUT PRINCIPAL: PAINEL LATERAL (EXTRATO) + LINHA DO TEMPO */}
                <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">

                    {/* ===== COLUNA ESQUERDA — RESUMO FIXO ===== */}
                    <aside className="space-y-4 lg:sticky lg:top-6">

                        {/* HERO DE FATURAMENTO */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                            <div className="absolute -right-6 -top-6 text-emerald-500/[0.06]">
                                <TrendingUp size={110} />
                            </div>

                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 relative">
                                {filter === "today" ? "Faturamento de Hoje" : filter === "week" ? "Faturamento da Semana" : filter === "month" ? "Faturamento do Mês" : "Faturamento do Período"}
                            </p>
                            <p className="text-4xl font-black tracking-tight text-slate-50 font-mono relative">
                                {hideValues ? "••••••" : `R$ ${stats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                            </p>

                            {losses > 0 && (
                                <p className="mt-1.5 text-[11px] font-bold text-red-500 flex items-center gap-1 relative">
                                    <TrendingDown size={12} />
                                    {hideValues ? "••••" : `R$ ${losses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} em prejuízos
                                </p>
                            )}

                            {/* SELETOR DE PERÍODO — pílulas */}
                            <div className="mt-5 grid grid-cols-4 gap-1 bg-slate-800 p-1 rounded-full relative">
                                {(["today", "week", "month", "custom"] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => {
                                            setFilter(f);
                                            setSelectedMethodCard(null);
                                        }}
                                        className={`py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${filter === f
                                            ? "bg-slate-900 text-slate-50 shadow-sm"
                                            : "text-slate-500 hover:text-slate-300"
                                            }`}
                                    >
                                        {f === "today" ? "Hoje" : f === "week" ? "7 dias" : f === "month" ? "Mês" : "Data"}
                                    </button>
                                ))}
                            </div>

                            {filter === "custom" && (
                                <input
                                    type="date"
                                    value={customDate}
                                    onChange={(e) => {
                                        setCustomDate(e.target.value);
                                        setSelectedMethodCard(null);
                                    }}
                                    className="mt-2 w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-400 transition-colors relative"
                                />
                            )}
                        </div>

                        {/* QUEBRA POR FORMA DE PAGAMENTO */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1 mb-2">
                                Formas de Recebimento
                            </p>

                            {/* PIX */}
                            <button
                                onClick={() => handleCardClick("PIX")}
                                className={`w-full text-left rounded-xl p-2.5 transition-all ${selectedMethodCard === "PIX" ? "bg-emerald-500/10 ring-1 ring-emerald-500/30" : "hover:bg-slate-950"
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <Smartphone size={13} className="text-emerald-500" />
                                        <span className="text-xs font-bold text-slate-300">PIX</span>
                                    </div>
                                    <span className="text-xs font-black font-mono text-slate-50">
                                        {hideValues ? "••••" : `R$ ${stats.pix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${methodPct(stats.pix)}%` }} />
                                </div>
                            </button>

                            {/* CARTÃO */}
                            <button
                                onClick={() => handleCardClick("CARTAO")}
                                className={`w-full text-left rounded-xl p-2.5 transition-all ${selectedMethodCard === "CARTAO" ? "bg-blue-500/10 ring-1 ring-blue-500/30" : "hover:bg-slate-950"
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <CreditCard size={13} className="text-blue-500" />
                                        <span className="text-xs font-bold text-slate-300">Cartão</span>
                                    </div>
                                    <span className="text-xs font-black font-mono text-slate-50">
                                        {hideValues ? "••••" : `R$ ${stats.cartao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${methodPct(stats.cartao)}%` }} />
                                </div>
                            </button>

                            {/* DINHEIRO */}
                            <button
                                onClick={() => handleCardClick("DINHEIRO")}
                                className={`w-full text-left rounded-xl p-2.5 transition-all ${selectedMethodCard === "DINHEIRO" ? "bg-amber-500/10 ring-1 ring-amber-500/30" : "hover:bg-slate-950"
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <DollarSign size={13} className="text-amber-500" />
                                        <span className="text-xs font-bold text-slate-300">Dinheiro</span>
                                    </div>
                                    <span className="text-xs font-black font-mono text-slate-50">
                                        {hideValues ? "••••" : `R$ ${stats.dinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                    <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${methodPct(stats.dinheiro)}%` }} />
                                </div>
                            </button>

                            {selectedMethodCard && (
                                <button
                                    onClick={() => setSelectedMethodCard(null)}
                                    className="w-full text-center mt-1 py-1.5 text-[9px] text-emerald-400 hover:text-emerald-400 uppercase font-black tracking-wider"
                                >
                                    [ Limpar Filtro ]
                                </button>
                            )}
                        </div>

                        {/* BUSCA */}
                        <div className="relative w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar item ou cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-xs text-slate-50 placeholder-slate-500 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 shadow-sm transition-all"
                            />
                        </div>
                    </aside>

                    {/* ===== COLUNA DIREITA — EXTRATO EM LINHA DO TEMPO ===== */}
                    <div className="min-w-0">
                        {isLoading ? (
                            <div className="py-24 text-center border border-dashed border-slate-700 bg-slate-900/60 rounded-3xl text-slate-500 font-bold animate-pulse uppercase text-[10px] tracking-widest">
                                Sincronizando fluxo de caixa...
                            </div>
                        ) : finalFilteredSales.length === 0 ? (
                            <div className="bg-slate-900 border border-dashed border-slate-700 rounded-3xl p-20 text-center text-slate-500 font-bold text-sm">
                                Nenhuma operação encontrada para os filtros aplicados.
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {Object.entries(groupedSales).map(([dateKey, salesForDate]) => (
                                    <div key={dateKey}>
                                        {/* CABEÇALHO DO DIA */}
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">
                                                {dateKey === todayLabel ? "Hoje" : dateKey}
                                            </span>
                                            <div className="flex-1 h-px bg-slate-800" />
                                            <span className="text-[10px] font-bold text-slate-700 whitespace-nowrap">
                                                {salesForDate.length} {salesForDate.length === 1 ? "operação" : "operações"}
                                            </span>
                                        </div>

                                        {/* LINHA DO TEMPO */}
                                        <div className="relative border-l-2 border-slate-800 ml-1.5 space-y-3">
                                            {salesForDate.map((sale) => {
                                                const isRefunded = sale.status === "refunded";
                                                const isCancelled = sale.status === "cancelled";
                                                const isLossSale = isLoss(sale);
                                                const partCost = sale.partCost || 0;
                                                const profit = sale.total - partCost;

                                                return (
                                                    <div key={sale.id} className="relative pl-6">
                                                        {/* MARCADOR NA LINHA DO TEMPO */}
                                                        <span className={`absolute -left-[7px] top-5 w-3 h-3 rounded-full ring-4 ${dotClasses(sale)}`} />

                                                        <div
                                                            className={`rounded-2xl border p-4 transition-shadow ${isLossSale
                                                                    ? "bg-red-500/10 border-red-500/30"
                                                                    : isRefunded
                                                                        ? "bg-red-500/10 border-red-500/30 opacity-80"
                                                                        : isCancelled
                                                                            ? "bg-slate-950/60 border-slate-800 opacity-60"
                                                                            : "bg-slate-900 border-slate-800 shadow-sm hover:shadow-md"
                                                                }`}
                                                        >
                                                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">

                                                                {/* CONTEÚDO PRINCIPAL */}
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                                                        <span className="text-[10px] font-bold text-slate-500 font-mono flex items-center gap-1">
                                                                            <Clock size={10} /> {sale.time}
                                                                        </span>

                                                                        {sale.type === "manutencao" && (
                                                                            <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[9px] font-black rounded-full uppercase tracking-wider flex items-center gap-1">
                                                                                <Wrench size={9} /> Manutenção
                                                                            </span>
                                                                        )}
                                                                        {isLossSale && (
                                                                            <span className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-full uppercase tracking-wider flex items-center gap-1">
                                                                                <TrendingDown size={9} /> Prejuízo
                                                                            </span>
                                                                        )}
                                                                        {isRefunded && <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-500 text-[9px] font-black rounded-full uppercase tracking-wider">Reembolsado</span>}
                                                                        {isCancelled && <span className="px-2 py-0.5 bg-slate-800 text-slate-500 text-[9px] font-black rounded-full uppercase tracking-wider">Cancelado</span>}
                                                                        {sale.status === "pending" && <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-black rounded-full uppercase tracking-wider">Fiado Pendente</span>}
                                                                    </div>

                                                                    <h3 className={`text-sm font-bold tracking-tight truncate ${isRefunded || isCancelled ? "line-through text-slate-500" : "text-slate-50"}`}>
                                                                        {sale.items.map((item, idx) => (
                                                                            <span key={idx}>
                                                                                <span className="text-emerald-400 font-bold mr-1">{item.saleQty}x</span>
                                                                                {item.name}
                                                                                {idx < sale.items.length - 1 ? ", " : ""}
                                                                            </span>
                                                                        ))}
                                                                    </h3>

                                                                    {sale.clientName && (
                                                                        <p className="text-[11px] text-slate-500 font-bold mt-0.5 flex items-center gap-1">
                                                                            <User size={10} /> {sale.clientName}
                                                                        </p>
                                                                    )}

                                                                    {sale.type === "manutencao" && !isRefunded && !isCancelled && !isLossSale && (
                                                                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold">
                                                                            <span className="text-red-500">Peça: {hideValues ? "•••" : `R$ ${partCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
                                                                            <span className="text-emerald-400">Lucro: {hideValues ? "•••" : `R$ ${profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
                                                                        </div>
                                                                    )}

                                                                    {isLossSale && (
                                                                        <p className="mt-2 text-[11px] font-bold text-red-500">
                                                                            Prejuízo assumido nesta operação.
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                {/* VALOR + PAGAMENTO + AÇÕES */}
                                                                <div className="flex flex-row md:flex-col items-end justify-between md:justify-start gap-2 shrink-0 md:text-right md:min-w-[130px]">
                                                                    <div>
                                                                        <p className={`text-lg font-black font-mono tracking-tight ${isLossSale
                                                                                ? "text-red-400"
                                                                                : isRefunded || isCancelled
                                                                                    ? "line-through text-slate-500"
                                                                                    : "text-slate-50"
                                                                            }`}>
                                                                            {hideValues ? "•••••" : `R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                                                        </p>

                                                                        {sale.multiplePayments && sale.multiplePayments.length > 0 ? (
                                                                            <div className="flex flex-wrap gap-1 justify-end mt-1">
                                                                                {sale.multiplePayments.map((p, pIdx) => (
                                                                                    <span key={pIdx} className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 uppercase">
                                                                                        {p.method}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400 uppercase inline-block mt-1">
                                                                                {sale.payment}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {!isRefunded && !isCancelled && (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <button
                                                                                onClick={() => {
                                                                                    setSaleToEdit(sale);
                                                                                    setIsEditModalOpen(true);
                                                                                }}
                                                                                title="Editar"
                                                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-500 hover:text-slate-50 border border-slate-800 transition-colors"
                                                                            >
                                                                                <Pencil size={12} />
                                                                            </button>

                                                                            <button
                                                                                onClick={() => {
                                                                                    setRefundSaleId(sale.id);
                                                                                    setIsModalOpen(true);
                                                                                }}
                                                                                title="Estornar"
                                                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-950 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 transition-colors"
                                                                            >
                                                                                <Undo2 size={12} />
                                                                            </button>

                                                                            <button
                                                                                onClick={() => handlePrintSale(sale)}
                                                                                title="Imprimir Cupom"
                                                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 transition-colors"
                                                                            >
                                                                                <Printer size={12} />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}