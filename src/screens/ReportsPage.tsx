import React, { useEffect, useState, useMemo, useRef } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
    Calendar, DollarSign, ShoppingCart, CreditCard, 
    Download, Clock, Search, ArrowUpDown 
} from "lucide-react";

interface SaleData {
    id: string;
    items: any[];
    timestamp: any;
    total: number;
    status: string;
    store: string;
    paymentMethod?: string;
}

const EXCLUDED_STORE_EMAIL = "minha-loja@exemplo.com";
const EXCLUDED_STORE_NORMALIZED = EXCLUDED_STORE_EMAIL.toLowerCase().trim();

export default function Reports() {
    const [sales, setSales] = useState<SaleData[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("day");
    const [searchTerm, setSearchTerm] = useState("");
    const [paymentFilter, setPaymentFilter] = useState("all");
    const reportRef = useRef<HTMLDivElement>(null);

    // Buscar todas as vendas
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

    // Filtro principal com período funcionando
    const filteredSales = useMemo(() => {
        const now = new Date();
        let startDate = new Date();

        switch (period) {
            case "day":
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case "week":
                startDate.setDate(now.getDate() - 7);
                break;
            case "month":
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case "year":
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
        }

        return sales.filter(sale => {
            const saleDate = sale.timestamp?.toDate();
            if (!saleDate || saleDate < startDate) return false;
            if (!isSaleValid(sale)) return false;

            // Busca
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = 
                sale.id.toLowerCase().includes(searchLower) ||
                sale.items?.some((item: any) => 
                    item.name?.toLowerCase().includes(searchLower)
                );

            // Pagamento
            const matchesPayment = 
                paymentFilter === "all" || 
                (sale.paymentMethod || "").toUpperCase() === paymentFilter.toUpperCase();

            return matchesSearch && matchesPayment;
        });
    }, [sales, period, searchTerm, paymentFilter]);

    const totalRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);
    const totalSales = filteredSales.length;
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const getPaymentBadge = (method?: string) => {
        const m = (method || "").toUpperCase();
        if (m.includes("PIX")) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
        if (m.includes("CARTÃO") || m.includes("CARTAO")) return "bg-blue-500/10 text-blue-400 border-blue-500/30";
        if (m.includes("DINHEIRO")) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
        if (m.includes("FIADO")) return "bg-purple-500/10 text-purple-400 border-purple-500/30";
        return "bg-slate-700 text-slate-400 border-slate-600";
    };

    const exportToPDF = async () => {
        if (!reportRef.current) return;
        const canvas = await html2canvas(reportRef.current, { scale: 2 });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        
        pdf.setFontSize(18);
        pdf.text("SOLUCELL.", 14, 20);
        pdf.setFontSize(11);
        pdf.text("Relatório Administrativo de Vendas", 14, 28);
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, "PNG", 5, 35, pdfWidth - 10, pdfHeight);
        pdf.save(`relatorio_vendas_${period}_${new Date().toISOString().slice(0,10)}.pdf`);
    };

    if (loading) {
        return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">Carregando relatório...</div>;
    }

    return (
        <div ref={reportRef} className="p-4 md:p-10 bg-[#020617] min-h-screen space-y-8 text-slate-300">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-white italic tracking-tighter">
                        SOLUCELL<span className="text-blue-600">.</span>
                    </h1>
                    <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-blue-500">✓</span>
                        Relatórios Administrativos
                    </p>
                </div>

                <button
                    onClick={exportToPDF}
                    className="no-export flex items-center gap-3 px-8 py-4 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"
                >
                    <Download size={16} />
                    Exportar PDF
                </button>
            </header>

            {/* Filtros */}
            <section className="no-export bg-slate-900/40 border border-slate-800/50 p-6 rounded-[24px] grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Períodos Rápidos */}
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-slate-500">Períodos Rápidos</p>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: "Hoje", value: "day" },
                            { label: "Semana", value: "week" },
                            { label: "Mês Atual", value: "month" },
                            { label: "Ano", value: "year" }
                        ].map(({ label, value }) => (
                            <button
                                key={value}
                                onClick={() => setPeriod(value as any)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                                    period === value ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mês Específico */}
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-slate-500">Filtrar por Mês Específico</p>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <select className="w-full bg-slate-800 border-none rounded-xl px-4 py-2.5 text-[10px] font-black text-white outline-none appearance-none cursor-pointer">
                                {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i} value={i}>
                                        {new Date(2026, i).toLocaleString('pt-BR', { month: 'long' }).toUpperCase()}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <input 
                            type="number" 
                            defaultValue="2026" 
                            className="w-24 bg-slate-800 border-none rounded-xl px-4 py-2 text-[10px] font-black text-white outline-none" 
                        />
                    </div>
                </div>

                {/* Dia Específico */}
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-slate-500">Dia Específico</p>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input 
                            type="date" 
                            className="w-full bg-slate-800 border-none rounded-xl pl-10 pr-4 py-2.5 text-[10px] font-black text-white outline-none" 
                        />
                    </div>
                </div>
            </section>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400 border p-6 rounded-[24px]">
                    <div className="p-3 bg-slate-950/50 rounded-2xl border border-white/5 w-fit mb-4">
                        <DollarSign size={20} />
                    </div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Receita no Período</p>
                    <h3 className="text-2xl font-black text-white tracking-tight">R$ {totalRevenue.toFixed(2)}</h3>
                </div>

                <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400 border p-6 rounded-[24px]">
                    <div className="p-3 bg-slate-950/50 rounded-2xl border border-white/5 w-fit mb-4">
                        <ShoppingCart size={20} />
                    </div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Total de Vendas</p>
                    <h3 className="text-2xl font-black text-white tracking-tight">{totalSales}</h3>
                </div>

                <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-400 border p-6 rounded-[24px]">
                    <div className="p-3 bg-slate-950/50 rounded-2xl border border-white/5 w-fit mb-4">
                        <CreditCard size={20} />
                    </div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Ticket Médio</p>
                    <h3 className="text-2xl font-black text-white tracking-tight">R$ {avgTicket.toFixed(2)}</h3>
                </div>
            </div>

            {/* Tabela com Busca e Filtro de Pagamento */}
            <section className="bg-slate-900/40 border border-slate-800/50 rounded-[32px] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-950/40 border-b border-slate-800/50">
                                <th className="px-8 py-6">
                                    <div className="flex flex-col gap-3">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Produto / Busca</span>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                                            <input
                                                placeholder="Filtrar por produto ou ID..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-[11px] text-white outline-none focus:border-blue-500 transition-all"
                                            />
                                        </div>
                                    </div>
                                </th>
                                <th className="px-8 py-6">
                                    <div className="flex flex-col gap-3">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Valor</span>
                                        <button className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-[10px] font-black text-white flex items-center gap-2 w-fit hover:border-blue-500 transition-all">
                                            MAIOR <ArrowUpDown size={12} />
                                        </button>
                                    </div>
                                </th>
                                <th className="px-8 py-6">
                                    <div className="flex flex-col items-center gap-3">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pagamento</span>
                                        <select
                                            value={paymentFilter}
                                            onChange={(e) => setPaymentFilter(e.target.value)}
                                            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[10px] font-black text-white outline-none cursor-pointer hover:border-blue-500 transition-all"
                                        >
                                            <option value="all">TODOS</option>
                                            <option value="pix">PIX</option>
                                            <option value="cartão">CARTÃO</option>
                                            <option value="dinheiro">DINHEIRO</option>
                                        </select>
                                    </div>
                                </th>
                                <th className="px-8 py-6 text-right">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Data / Horário</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                            {filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-16 text-slate-500">
                                        Nenhuma venda encontrada para os filtros selecionados.
                                    </td>
                                </tr>
                            ) : (
                                filteredSales
                                    .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())
                                    .map(sale => (
                                        <tr key={sale.id} className="hover:bg-blue-600/[0.03] transition-colors">
                                            <td className="px-8 py-6">
                                                <p className="text-sm text-white font-bold">
                                                    {sale.items?.map((i: any) => i.name).join(", ") || "Venda Avulsa"}
                                                </p>
                                                <p className="text-[9px] text-slate-600 font-mono mt-1 uppercase tracking-tighter">
                                                    REF: {sale.id.toUpperCase().slice(0, 20)}
                                                </p>
                                            </td>
                                            <td className="px-8 py-6 font-black text-white">R$ {sale.total.toFixed(2)}</td>
                                            <td className="px-8 py-6 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black border ${getPaymentBadge(sale.paymentMethod)}`}>
                                                    {(sale.paymentMethod || "NÃO INF.").toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-right font-black text-slate-500 text-[10px]">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-slate-300">
                                                        {sale.timestamp.toDate().toLocaleDateString("pt-BR")}
                                                    </span>
                                                    <span className="text-slate-700 flex items-center gap-1 mt-1">
                                                        <Clock size={10} /> 
                                                        {sale.timestamp.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}