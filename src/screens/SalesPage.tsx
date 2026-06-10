// src/screens/Sales.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    Plus, Search, CreditCard, Smartphone,
    DollarSign, Undo2,
    TrendingUp, Eye, EyeOff,
    Pencil, Clock, Calendar, User, Wrench, Layers
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

    useEffect(() => {
        const handleKeyPress = async (e: KeyboardEvent) => {
            if (e.key !== "Enter") return;

            const code = barcodeInput.trim();

            if (!code) return;

            try {
                const productsSnapshot = await getDocs(
                    query(
                        collection(db, "products"),
                        where("store", "==", storeEmail),
                        where("barcode", "==", code)
                    )
                );

                if (productsSnapshot.empty) {
                    alert("Produto não encontrado.");
                    setBarcodeInput("");
                    return;
                }

                const product = {
                    id: productsSnapshot.docs[0].id,
                    ...productsSnapshot.docs[0].data()
                };

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
    }, [barcodeInput, storeEmail]);

    const [hideValues, setHideValues] = useState(false);
    const [sales, setSales] = useState<SaleWithClient[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const fetchSalesFromFirestore = useCallback(async () => {
        console.log("BUSCANDO VENDAS");
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
                .sort((a, b) => (b.dateObject?.getTime() || 0) - (a.dateObject?.getTime() || 0));

            setSales(list);
        } catch (error) {
            console.error(
                "ERRO FIREBASE:",
                error.code,
                error.message,
                error
            );
        } finally {
            setIsLoading(false);
        }
    }, [storeEmail]);

    useEffect(() => {
        fetchSalesFromFirestore();
    }, [fetchSalesFromFirestore]);

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

    // Função auxiliar para calcular o total por método de pagamento (considerando múltiplos pagamentos)
    const getSumByMethod = (salesList: SaleWithClient[], method: string) => {
        return salesList
            .filter(s => s.status !== "refunded" && s.status !== "cancelled")
            .reduce((acc, sale) => {
                if (sale.multiplePayments && sale.multiplePayments.length > 0) {
                    const match = sale.multiplePayments.find(p => p.method.toUpperCase().includes(method));
                    return acc + (match ? match.value : 0);
                }
                return acc + (sale.payment.toUpperCase().includes(method) ? sale.total : 0);
            }, 0);
    };

    // Cômputo dos cards atualizado para verificar se há pagamentos múltiplos splitados
    const stats = {
        pix: getSumByMethod(filteredByPeriod, "PIX"),
        cartao: getSumByMethod(filteredByPeriod, "CARTÃO") + getSumByMethod(filteredByPeriod, "CARTAO"),
        dinheiro: getSumByMethod(filteredByPeriod, "DINHEIRO"),
        total: filteredByPeriod.filter(s => s.status !== "refunded" && s.status !== "cancelled").reduce((acc, curr) => acc + curr.total, 0)
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

    return (
        <div className="min-h-screen bg-[#020617] text-slate-300 p-4 md:p-8 font-sans antialiased">
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

            <div className="max-w-6xl mx-auto space-y-6">

                {/* HEADER */}
                <header className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 border-b border-slate-800 pb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-2.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">
                                Painel Operacional
                            </span>
                            <span className="bg-slate-950 text-slate-500 text-[9px] font-black px-2.5 py-0.5 rounded border border-slate-800/80 uppercase tracking-widest">
                                23/04/2026
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black italic text-white">
                            FLUXO DE <span className="text-emerald-500">CAIXA</span>
                            <span className="text-emerald-500">.</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-3 self-start lg:self-end">
                        <button
                            onClick={() => setHideValues(!hideValues)}
                            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2 rounded-xl text-xs font-bold text-slate-400 transition-all active:scale-[0.97]"
                        >
                            {hideValues ? <EyeOff size={14} /> : <Eye size={14} />}
                            <span>{hideValues ? "Mostrar Valores" : "Ocultar Valores"}</span>
                        </button>

                        <button
                            onClick={() => setIsNewSaleModal(true)}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-500 flex items-center gap-1.5 transition-all active:scale-[0.97] shadow-sm"
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

                {/* CARDS DE ESTATÍSTICAS CLICÁVEIS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* CARD PIX */}
                    <button
                        onClick={() => handleCardClick("PIX")}
                        className={`text-left p-5 rounded-xl border transition-all flex flex-col justify-between ${selectedMethodCard === "PIX"
                            ? "bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                            : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                            }`}
                    >
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <Smartphone className={selectedMethodCard === "PIX" ? "text-emerald-400" : "text-emerald-500"} size={14} />
                                <p className="text-slate-500 text-[9px] font-black uppercase tracking-wider">PIX</p>
                            </div>
                            <p className="text-2xl font-black tracking-tight text-white">
                                {hideValues ? "••••••" : `R$ ${stats.pix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                            </p>
                        </div>
                    </button>

                    {/* CARD CARTÃO */}
                    <button
                        onClick={() => handleCardClick("CARTAO")}
                        className={`text-left p-5 rounded-xl border transition-all flex flex-col justify-between ${selectedMethodCard === "CARTAO"
                            ? "bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                            : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                            }`}
                    >
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <CreditCard className={selectedMethodCard === "CARTAO" ? "text-blue-400" : "text-blue-500"} size={14} />
                                <p className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Cartão</p>
                            </div>
                            <p className="text-2xl font-black tracking-tight text-white">
                                {hideValues ? "••••••" : `R$ ${stats.cartao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                            </p>
                        </div>
                    </button>

                    {/* CARD DINHEIRO */}
                    <button
                        onClick={() => handleCardClick("DINHEIRO")}
                        className={`text-left p-5 rounded-xl border transition-all flex flex-col justify-between ${selectedMethodCard === "DINHEIRO"
                            ? "bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                            : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                            }`}
                    >
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <DollarSign className={selectedMethodCard === "DINHEIRO" ? "text-amber-400" : "text-amber-500"} size={14} />
                                <p className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Dinheiro</p>
                            </div>
                            <p className="text-2xl font-black tracking-tight text-white">
                                {hideValues ? "••••••" : `R$ ${stats.dinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                            </p>
                        </div>
                    </button>

                    {/* CARD FATURAMENTO TOTAL */}
                    <button
                        onClick={() => handleCardClick("TOTAL")}
                        className={`text-left p-5 rounded-xl border transition-all flex flex-col justify-between relative overflow-hidden ${selectedMethodCard === "TOTAL"
                            ? "bg-emerald-600/20 border-emerald-400"
                            : "bg-emerald-600/10 border-emerald-500/20 hover:border-emerald-500/40"
                            }`}
                    >
                        <div className="absolute right-4 top-4 text-emerald-500/5">
                            <TrendingUp size={38} />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <TrendingUp className="text-emerald-400" size={14} />
                                <p className="text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                                    {filter === "today" ? "Faturamento Dia" : filter === "week" ? "Faturamento Semana" : filter === "month" ? "Faturamento Mês" : "Faturamento Período"}
                                </p>
                            </div>
                            <p className="text-2xl font-black tracking-tight text-emerald-400">
                                {hideValues ? "••••••" : `R$ ${stats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                            </p>
                        </div>
                    </button>
                </div>

                {/* FILTROS DE DATA E BUSCA */}
                <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 items-center">
                    <div className="flex flex-wrap sm:flex-nowrap bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1 w-full sm:w-auto shrink-0">
                        {(["today", "week", "month", "custom"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => {
                                    setFilter(f);
                                    setSelectedMethodCard(null);
                                }}
                                className={`px-4 py-2.5 rounded-lg text-xs font-black transition-all ${filter === f
                                    ? "bg-white text-slate-950"
                                    : "text-slate-400 hover:text-slate-200"
                                    }`}
                            >
                                {f === "today" ? "HOJE" : f === "week" ? "SEMANA" : f === "month" ? "MÊS" : "DATA ESPECÍFICA"}
                            </button>
                        ))}

                        {filter === "custom" && (
                            <input
                                type="date"
                                value={customDate}
                                onChange={(e) => {
                                    setCustomDate(e.target.value);
                                    setSelectedMethodCard(null);
                                }}
                                className="bg-slate-950 text-white border border-slate-800 rounded-lg px-3 py-1 text-xs font-bold outline-none focus:border-emerald-500 transition-colors ml-1"
                            />
                        )}
                    </div>

                    <div className="relative w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder={selectedMethodCard ? `Buscando em ${selectedMethodCard}...` : "Buscar venda no fluxo por item ou cliente..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3.5 pl-12 pr-4 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
                        />
                    </div>
                </div>

                {/* AVISO DE FILTRO ATIVO NOS CARDS */}
                {selectedMethodCard && (
                    <div className="flex items-center justify-between bg-slate-900/40 border border-slate-800/80 px-4 py-2.5 rounded-xl text-xs text-slate-400">
                        <span>
                            Filtrando fluxo apenas por operações via: <strong className="text-white uppercase font-black">{selectedMethodCard}</strong>
                        </span>
                        <button
                            onClick={() => setSelectedMethodCard(null)}
                            className="text-[10px] text-emerald-500 hover:text-emerald-400 uppercase font-black tracking-wider"
                        >
                            [ Limpar Filtro ]
                        </button>
                    </div>
                )}

                {/* LISTA DE VENDAS REFINADA */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="py-20 text-center border border-slate-800 rounded-xl text-slate-600 font-bold animate-pulse uppercase text-[10px] tracking-widest">
                            Sincronizando fluxo de caixa...
                        </div>
                    ) : finalFilteredSales.length === 0 ? (
                        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-16 text-center text-slate-500 font-bold text-sm">
                            Nenhuma operação encontrada para os filtros aplicados.
                        </div>
                    ) : (
                        finalFilteredSales.map((sale) => {
                            const isRefunded = sale.status === "refunded";
                            const isCancelled = sale.status === "cancelled";

                            // Cálculos para Manutenção
                            const partCost = sale.partCost || 0;
                            const profit = sale.total - partCost;

                            return (
                                <div
                                    key={sale.id}
                                    className={`bg-slate-900/40 border rounded-xl p-5 hover:border-slate-700/50 transition-all ${isRefunded
                                        ? "border-red-900/40 bg-red-950/5 opacity-80"
                                        : isCancelled
                                            ? "border-slate-800 bg-slate-950/30 opacity-60"
                                            : "border-slate-800"
                                        }`}
                                >
                                    <div className="flex flex-col xl:flex-row gap-6">

                                        <div className="flex-1 space-y-4">
                                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        <h3 className={`text-base font-bold tracking-tight ${isRefunded || isCancelled ? "line-through text-slate-500" : "text-white"}`}>
                                                            {sale.items.map((item, idx) => (
                                                                <span key={idx}>
                                                                    <span className="text-emerald-500 font-bold mr-1">{item.saleQty}x</span>
                                                                    {item.name}
                                                                    {idx < sale.items.length - 1 ? ", " : ""}
                                                                </span>
                                                            ))}
                                                        </h3>

                                                        {/* INDICADORES DE CONDIÇÃO / TIPO */}
                                                        {sale.type === "manutencao" && (
                                                            <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black rounded uppercase tracking-wider flex items-center gap-1">
                                                                <Wrench size={10} /> MANUTENÇÃO
                                                            </span>
                                                        )}
                                                      
                                                        {isRefunded && <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black rounded uppercase tracking-wider">REEMBOLSADO</span>}
                                                        {isCancelled && <span className="px-2 py-0.5 bg-slate-800 text-slate-500 text-[9px] font-black rounded uppercase tracking-wider">CANCELADO</span>}
                                                        {sale.status === "pending" && <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-black rounded uppercase tracking-wider">FIADO PENDENTE</span>}
                                                    </div>

                                                    <div className="flex flex-wrap gap-1.5">
                                                        <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                                            <Clock size={10} />
                                                            {sale.time}
                                                        </div>
                                                        <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                                            <Calendar size={10} />
                                                            {sale.date}
                                                        </div>
                                                        {sale.clientName && (
                                                            <div className="bg-slate-950/60 border border-slate-800/60 rounded px-2 py-0.5 text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                                                <User size={10} className="text-slate-500" />
                                                                {sale.clientName}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* BLOCO DE VISUALIZAÇÃO SE FOR MANUTENÇÃO */}
                                                    {sale.type === "manutencao" && !isRefunded && !isCancelled && (
                                                        <div className="mt-3 bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 grid grid-cols-3 gap-2 max-w-md">
                                                            <div>
                                                                <p className="text-[8px] font-black text-slate-500 uppercase">Custo Peça</p>
                                                                <p className="text-xs font-bold text-red-400">{hideValues ? "•••" : `R$ ${partCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[8px] font-black text-slate-500 uppercase">Venda Bruta</p>
                                                                <p className="text-xs font-bold text-slate-300">{hideValues ? "•••" : `R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[8px] font-black text-emerald-500 uppercase">Lucro Líquido</p>
                                                                <p className="text-xs font-black text-emerald-400">{hideValues ? "•••" : `R$ ${profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="text-left md:text-right flex flex-col md:items-end justify-between">
                                                    <div>
                                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-0.5">Valor Total</p>
                                                        <p className={`text-xl font-bold tracking-tight ${isRefunded || isCancelled ? "line-through text-slate-500" : "text-white"}`}>
                                                            {hideValues ? "•••••" : `R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                                        </p>
                                                    </div>

                                                    {/* FORMA(S) DE PAGAMENTO */}
                                                    <div className="mt-2">
                                                        {sale.multiplePayments && sale.multiplePayments.length > 0 ? (
                                                            <div className="flex flex-col gap-1 items-start md:items-end">
                                                                <p className="text-[8px] font-bold text-slate-500 uppercase">Divisão de Pagamento:</p>
                                                                <div className="flex flex-wrap gap-1 justify-start md:justify-end">
                                                                    {sale.multiplePayments.map((p, pIdx) => (
                                                                        <span key={pIdx} className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-950/40 border border-purple-900/40 text-purple-300 uppercase">
                                                                            {p.method}: {hideValues ? "••" : `R$ ${p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 uppercase inline-block">
                                                                {sale.payment}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="xl:w-36 flex xl:flex-col gap-2 justify-center shrink-0 border-t xl:border-t-0 xl:border-l border-slate-800/60 pt-4 xl:pt-0 xl:pl-4">
                                            {!isRefunded && !isCancelled && (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setSaleToEdit(sale);
                                                            setIsEditModalOpen(true);
                                                        }}
                                                        className="flex-1 xl:w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg py-2 font-bold text-slate-400 hover:text-white flex items-center justify-center gap-1.5 transition-all text-xs active:scale-[0.97]"
                                                    >
                                                        <Pencil size={13} />
                                                        Editar
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            setRefundSaleId(sale.id);
                                                            setIsModalOpen(true);
                                                        }}
                                                        className="flex-1 xl:w-full bg-slate-950 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/30 rounded-lg py-2 font-bold text-slate-500 hover:text-rose-400 flex items-center justify-center gap-1.5 transition-all text-xs active:scale-[0.97]"
                                                    >
                                                        <Undo2 size={13} />
                                                        Estornar
                                                    </button>

                                                    <button
                                                        onClick={() => handlePrintSale(sale)}
                                                        className="flex-1 xl:w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 font-bold text-xs transition-all active:scale-[0.97]"
                                                    >
                                                        Imprimir Cupom
                                                    </button>
                                                </>
                                            )}
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