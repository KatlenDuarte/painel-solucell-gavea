import React, { useState, useEffect, useCallback } from "react";
import { 
    Plus, Trash2, Loader2, Package, Wallet, 
    CheckCircle2, FileText, XCircle, ArrowUpCircle, ArrowDownCircle,
    AlertCircle, Landmark
} from "lucide-react";

import { 
    collection, getDocs, query, where, addDoc, 
    serverTimestamp, deleteDoc, doc, updateDoc, limit, orderBy, Timestamp 
} from "firebase/firestore";
import { db } from "../lib/firebase";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface Outflow {
    id: string;
    description: string;
    amount: number;
    time: string;
    type: 'in' | 'out';
}

interface SoldItem {
    name: string;
    qty: number;
}

export default function FechamentoPage({ storeEmail }: { storeEmail: string }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isClosing, setIsClosing] = useState(false);
    const [isOpening, setIsOpening] = useState(false);

    const [isCashOpen, setIsCashOpen] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [openedAtTimestamp, setOpenedAtTimestamp] = useState<Timestamp | null>(null);

    const [cashOpenedAt, setCashOpenedAt] = useState("");
    const [initialBalance, setInitialBalance] = useState(0);
    const [tempInitialBalance, setTempInitialBalance] = useState<string>(""); 

    const [summary, setSummary] = useState({ pix: 0, cartao: 0, dinheiro: 0, fiado: 0 });
    const [soldItems, setSoldItems] = useState<SoldItem[]>([]);
    const [movements, setMovements] = useState<Outflow[]>([]);

    const [newDesc, setNewDesc] = useState("");
    const [newAmount, setNewAmount] = useState("");

    // CORREÇÃO: Busca dados filtrados pela SESSÃO e pelo TEMPO de abertura
const fetchData = useCallback(async (sessionId: string, openedAt: Timestamp) => {
    if (!storeEmail || !sessionId) return;
    
    try {
        // Criar o timestamp do início do dia atual (00:00:00)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startOfDayTimestamp = Timestamp.fromDate(startOfDay);

        // 1. Buscar Vendas do DIA TODO (desde as 00:00)
        const qSales = query(
            collection(db, "sales"),
            where("store", "==", storeEmail),
            where("timestamp", ">=", startOfDayTimestamp), // ⬅️ Alterado para pegar tudo de hoje
            orderBy("timestamp", "desc")
        );
        const salesSnap = await getDocs(qSales);
        
        let pix = 0, cartao = 0, din = 0, fiado = 0;
        const itemsMap: Record<string, number> = {};

        salesSnap.forEach(doc => {
            const d = doc.data();
            const valor = Number(d.total) || 0;
            if (d.paymentMethod === "PIX") pix += valor;
            else if (d.paymentMethod === "Cartão") cartao += valor;
            else if (d.paymentMethod === "Dinheiro") din += valor;
            else if (d.paymentMethod === "Fiado") fiado += valor;

            d.items?.forEach((it: any) => {
                itemsMap[it.name] = (itemsMap[it.name] || 0) + (it.quantity || 1);
            });
        });

        setSummary({ pix, cartao, dinheiro: din, fiado });
        setSoldItems(Object.entries(itemsMap).map(([name, qty]) => ({ name, qty })));

        // 2. Buscar Movimentações vinculadas APENAS a esta sessão atual
        // Isso garante que sangrias antigas não apareçam no novo caixa
        const qMov = query(
            collection(db, "outflows"),
            where("store", "==", storeEmail),
            where("sessionId", "==", sessionId),
            orderBy("timestamp", "asc")
        );
        
        const movSnap = await getDocs(qMov);
        setMovements(movSnap.docs.map(d => ({
            id: d.id,
            description: d.data().description,
            amount: Number(d.data().amount),
            type: d.data().type || 'out',
            time: d.data().timestamp?.toDate()?.toLocaleTimeString("pt-BR") || "--:--"
        })));

    } catch (e) { 
        console.error("Erro ao carregar dados:", e); 
    }
}, [storeEmail]);
    const checkActiveSession = useCallback(async () => {
        if (!storeEmail) return;
        setIsLoading(true);
        try {
            const q = query(
                collection(db, "cash_sessions"), 
                where("store", "==", storeEmail), 
                where("status", "==", "open"), 
                limit(1)
            );
            const snap = await getDocs(q);
            
            if (!snap.empty) {
                const session = snap.docs[0];
                const data = session.data();
                const sessionOpenedAt = data.openedAt as Timestamp;

                setCurrentSessionId(session.id);
                setOpenedAtTimestamp(sessionOpenedAt);
                setInitialBalance(Number(data.initialBalance) || 0);
                setCashOpenedAt(sessionOpenedAt?.toDate()?.toLocaleString("pt-BR") || "Data indisponível");
                setIsCashOpen(true);
                
                // Dispara a busca de dados usando os valores recém encontrados
                await fetchData(session.id, sessionOpenedAt);
            } else { 
                setIsCashOpen(false); 
                setCurrentSessionId(null);
            }
        } catch (e) { 
            console.error(e); 
        } finally { 
            setIsLoading(false); 
        }
    }, [storeEmail, fetchData]);

    useEffect(() => { 
        checkActiveSession(); 
    }, [checkActiveSession]);

    const totalOut = movements.filter(m => m.type === 'out').reduce((acc, i) => acc + i.amount, 0);
    const totalIn = movements.filter(m => m.type === 'in').reduce((acc, i) => acc + i.amount, 0);
    const saldoFinalGaveta = initialBalance + summary.dinheiro + totalIn - totalOut;

    const generateDetailedPDF = (physical: number, diff: number) => {
        const docPdf = new jsPDF();
        const now = new Date().toLocaleString("pt-BR");

        docPdf.setFontSize(18);
        docPdf.text("RELATÓRIO DE FECHAMENTO - SOLUCELL", 14, 20);
        
        docPdf.setFontSize(10);
        docPdf.text(`Loja: ${storeEmail}`, 14, 28);
        docPdf.text(`Abertura: ${cashOpenedAt} | Fechamento: ${now}`, 14, 33);

        autoTable(docPdf, {
            startY: 40,
            head: [['Resumo de Gaveta (Dinheiro)', 'Valor']],
            body: [
                ['Fundo Inicial', `R$ ${initialBalance.toFixed(2)}`],
                ['Vendas em Dinheiro', `R$ ${summary.dinheiro.toFixed(2)}`],
                ['Entradas (Aportes)', `R$ ${totalIn.toFixed(2)}`],
                ['Saídas (Sangrias)', `R$ ${totalOut.toFixed(2)}`],
                ['SALDO ESPERADO', `R$ ${saldoFinalGaveta.toFixed(2)}`],
                ['SALDO CONTADO', `R$ ${physical.toFixed(2)}`],
                ['DIFERENÇA', `R$ ${diff.toFixed(2)}`],
            ],
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] },
        });

        autoTable(docPdf, {
            startY: (docPdf as any).lastAutoTable.finalY + 10,
            head: [['Outros Recebimentos', 'Valor']],
            body: [
                ['Vendas PIX', `R$ ${summary.pix.toFixed(2)}`],
                ['Vendas Cartão', `R$ ${summary.cartao.toFixed(2)}`],
                ['Vendas Fiado', `R$ ${summary.fiado.toFixed(2)}`],
            ],
            theme: 'grid',
            headStyles: { fillColor: [71, 85, 105] },
        });

        if (soldItems.length > 0) {
            autoTable(docPdf, {
                startY: (docPdf as any).lastAutoTable.finalY + 10,
                head: [['Produto Vendido', 'Quantidade']],
                body: soldItems.map(i => [i.name, `${i.qty} un`]),
                headStyles: { fillColor: [16, 185, 129] },
            });
        }

        docPdf.save(`Fechamento_${storeEmail}_${Date.now()}.pdf`);
    };

    const handleCloseCash = async () => {
        const userInput = prompt("CONFERÊNCIA DE GAVETA:\nInforme o valor total em dinheiro contado:");
        if (userInput === null) return;
        const physicalCash = parseFloat(userInput.replace(',', '.'));
        if (isNaN(physicalCash)) return alert("Valor inválido.");

        const diff = physicalCash - saldoFinalGaveta;
        const diffMsg = diff === 0 ? "Tudo certo! O caixa bateu." : diff > 0 ? `Sobrou R$ ${diff.toFixed(2)}` : `Faltou R$ ${Math.abs(diff).toFixed(2)}`;

        if (!confirm(`${diffMsg}\nEncerrar definitivamente?`)) return;

        setIsClosing(true);
        try {
            generateDetailedPDF(physicalCash, diff);
            if (currentSessionId) {
                await updateDoc(doc(db, "cash_sessions", currentSessionId), { 
                    status: "closed", 
                    closedAt: serverTimestamp(),
                    expected: saldoFinalGaveta,
                    physical: physicalCash,
                    difference: diff
                });
            }
            setIsCashOpen(false);
            setCurrentSessionId(null);
            setMovements([]);
            setSummary({ pix: 0, cartao: 0, dinheiro: 0, fiado: 0 });
        } catch (e) { 
            alert("Erro ao fechar."); 
        } finally { 
            setIsClosing(false); 
        }
    };

    const handleAddMovement = async (type: 'in' | 'out') => {
        const numericValue = parseFloat(newAmount.replace(',', '.'));
        if (!newDesc || isNaN(numericValue) || !currentSessionId || !openedAtTimestamp) {
            return alert("Preencha os campos corretamente.");
        }
        
        try {
            await addDoc(collection(db, "outflows"), { 
                store: storeEmail, 
                description: newDesc, 
                amount: numericValue, 
                type: type, 
                sessionId: currentSessionId, // CRITICAL: Vincula à sessão
                timestamp: serverTimestamp() 
            });
            setNewDesc(""); 
            setNewAmount(""); 
            await fetchData(currentSessionId, openedAtTimestamp);
        } catch (e) { 
            alert("Erro ao salvar."); 
        }
    };

    const handleDeleteMovement = async (id: string) => {
        if(!confirm("Excluir esta movimentação?")) return;
        try {
            await deleteDoc(doc(db, "outflows", id));
            if(currentSessionId && openedAtTimestamp) await fetchData(currentSessionId, openedAtTimestamp);
        } catch(e) {
            alert("Erro ao deletar.");
        }
    };

    if (isLoading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={50} /></div>;

    if (!isCashOpen) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
                <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] w-full max-w-md text-center">
                    <Wallet className="mx-auto text-blue-500 mb-6" size={50} />
                    <h2 className="text-2xl font-black text-white italic mb-8 uppercase">Abrir Caixa</h2>
                    <input 
                        type="text" 
                        placeholder="R$ 0,00" 
                        className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-5 text-3xl font-black text-white text-center mb-6 focus:border-blue-600 outline-none"
                        value={tempInitialBalance} 
                        onChange={e => setTempInitialBalance(e.target.value)}
                    />
                    <button 
                        onClick={async () => {
                            const val = parseFloat(tempInitialBalance.replace(',', '.'));
                            if (isNaN(val)) return alert("Valor inválido");
                            setIsOpening(true);
                            try {
                                await addDoc(collection(db, "cash_sessions"), {
                                    store: storeEmail, 
                                    initialBalance: val, 
                                    openedAt: serverTimestamp(), 
                                    status: "open"
                                });
                                setTempInitialBalance("");
                                await checkActiveSession();
                            } catch (e) {
                                alert("Erro ao abrir caixa.");
                            } finally {
                                setIsOpening(false);
                            }
                        }}
                        disabled={isOpening}
                        className="w-full bg-blue-600 py-5 rounded-2xl font-black text-white hover:bg-blue-500 transition-all"
                    >
                        {isOpening ? <Loader2 className="animate-spin mx-auto"/> : "ABRIR AGORA"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <header className="flex justify-between items-end border-b border-slate-800 pb-6">
                    <div>
                        <h1 className="text-3xl font-black text-white italic">SOLUCELL<span className="text-blue-600">.</span></h1>
                        <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Caixa em Operação</p>
                    </div>
                    <div className="text-right text-[10px] font-bold text-slate-500 uppercase">Abertura: {cashOpenedAt}</div>
                </header>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                        <p className="text-slate-500 text-[9px] font-black uppercase mb-1">Início</p>
                        <p className="text-blue-400 font-black text-lg">R$ {initialBalance.toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                        <p className="text-slate-500 text-[9px] font-black uppercase mb-1">Vendas (Din)</p>
                        <p className="text-emerald-400 font-black text-lg">R$ {summary.dinheiro.toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                        <p className="text-slate-500 text-[9px] font-black uppercase mb-1">Entradas</p>
                        <p className="text-emerald-500 font-black text-lg">R$ {totalIn.toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                        <p className="text-slate-500 text-[9px] font-black uppercase mb-1">Saídas</p>
                        <p className="text-rose-500 font-black text-lg">R$ {totalOut.toFixed(2)}</p>
                    </div>
                    <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/20 col-span-2 lg:col-span-1">
                        <p className="text-blue-400 text-[9px] font-black uppercase mb-1">Pix + Cartão</p>
                        <p className="text-white font-black text-lg">R$ {(summary.pix + summary.cartao).toFixed(2)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-6">
                        <h3 className="text-white font-black text-[10px] uppercase mb-4 tracking-widest">Movimentação Manual</h3>
                        <div className="flex flex-col gap-2 mb-6">
                            <div className="flex gap-2">
                                <input placeholder="Descrição" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white outline-none" />
                                <input placeholder="Valor" value={newAmount} onChange={e => setNewAmount(e.target.value)} className="w-24 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => handleAddMovement('in')} className="bg-emerald-600 p-3 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2 transition-all"><ArrowUpCircle size={14}/> ENTRADA</button>
                                <button onClick={() => handleAddMovement('out')} className="bg-rose-600 p-3 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2 transition-all"><ArrowDownCircle size={14}/> SAÍDA</button>
                            </div>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {movements.map(m => (
                                <div key={m.id} className="flex justify-between bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-xs">
                                    <div className="flex flex-col">
                                        <p className="font-bold">{m.description}</p>
                                        <p className={m.type === 'in' ? 'text-emerald-500 text-[8px]' : 'text-rose-500 text-[8px]'}>{m.type === 'in' ? 'Aporte' : 'Sangria'} • {m.time}</p>
                                    </div>
                                    <div className="flex gap-4 items-center">
                                        <p className={m.type === 'in' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>R$ {m.amount.toFixed(2)}</p>
                                        <button onClick={() => handleDeleteMovement(m.id)} className="text-slate-600 hover:text-rose-500"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900 border-2 border-slate-800 rounded-[2.5rem] p-8 text-center flex flex-col justify-center relative">
                        <div className="absolute top-4 right-6 text-slate-700"><Landmark size={40}/></div>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Total Esperado em Dinheiro</p>
                        <p className="text-5xl font-black text-white italic mb-4">R$ {saldoFinalGaveta.toFixed(2)}</p>
                        <div className="flex items-center justify-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                            <CheckCircle2 size={14}/> Sistema atualizado
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/30 border border-slate-800 rounded-3xl overflow-hidden">
                    <div className="p-4 bg-slate-900/50 border-b border-slate-800 text-[10px] font-black uppercase flex items-center gap-2">
                        <Package size={14} className="text-blue-500"/> Itens Vendidos no Turno
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <tbody className="divide-y divide-slate-800/50">
                                {soldItems.map((item, i) => (
                                    <tr key={`item-${i}`} className="text-xs hover:bg-slate-800/20">
                                        <td className="px-6 py-4 font-bold text-slate-300">{item.name}</td>
                                        <td className="px-6 py-4 text-right font-black text-white">{item.qty} un</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4">
                    <div className="flex items-center gap-2 text-rose-500 bg-rose-500/10 px-4 py-2 rounded-full border border-rose-500/20">
                        <AlertCircle size={14}/>
                        <p className="text-[10px] font-black uppercase">Fiado Pendente: R$ {summary.fiado.toFixed(2)}</p>
                    </div>
                    <button 
                        onClick={handleCloseCash} 
                        disabled={isClosing} 
                        className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-black px-10 py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                    >
                        {isClosing ? <Loader2 className="animate-spin"/> : <><FileText size={20}/> ENCERRAR CAIXA</>}
                    </button>
                </div>
            </div>
        </div>
    );
}