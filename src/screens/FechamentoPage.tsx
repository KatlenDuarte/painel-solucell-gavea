import React, { useState, useEffect, useCallback } from "react";
import { 
    Plus, Trash2, Loader2, Package, Wallet, 
    CheckCircle2, FileText, XCircle, ArrowUpCircle, ArrowDownCircle,
    AlertCircle, Landmark, X
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
    type: 'in' | 'out';
    time: string;
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

    // Estados do Modal de Fechamento Customizado
    const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
    const [physicalCashInput, setPhysicalCashInput] = useState("");

    const fetchData = useCallback(async (sessionId: string, openedAt: Timestamp) => {
        if (!storeEmail || !sessionId) return;
        
        try {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const startOfDayTimestamp = Timestamp.fromDate(startOfDay);

            const qSales = query(
                collection(db, "sales"),
                where("store", "==", storeEmail),
                where("timestamp", ">=", startOfDayTimestamp),
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

    const parsedPhysicalCash = parseFloat(physicalCashInput.replace(',', '.')) || 0;
    const currentDifference = parsedPhysicalCash - saldoFinalGaveta;

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

    const handleExecuteCloseCash = async () => {
        const physicalCash = parseFloat(physicalCashInput.replace(',', '.'));
        if (isNaN(physicalCash)) return alert("Por favor, insira um valor válido para o dinheiro contado.");

        setIsClosing(true);
        try {
            generateDetailedPDF(physicalCash, currentDifference);
            if (currentSessionId) {
                await updateDoc(doc(db, "cash_sessions", currentSessionId), { 
                    status: "closed", 
                    closedAt: serverTimestamp(),
                    expected: saldoFinalGaveta,
                    physical: physicalCash,
                    difference: currentDifference
                });
            }
            setIsClosingModalOpen(false);
            setPhysicalCashInput("");
            setIsCashOpen(false);
            setCurrentSessionId(null);
            setMovements([]);
            setSummary({ pix: 0, cartao: 0, dinheiro: 0, fiado: 0 });
        } catch (e) { 
            alert("Erro ao fechar o caixa."); 
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
                sessionId: currentSessionId,
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
            <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8">
                <div className="max-w-5xl mx-auto space-y-6">
                    <header className="flex justify-between items-end border-b border-slate-800 pb-6">
                        <div>
                            <h1 className="text-3xl font-black text-white italic">SOLUCELL<span className="text-blue-600">.</span></h1>
                            <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest">Caixa Fechado</p>
                        </div>
                        <div className="text-right text-[10px] font-bold text-slate-500 uppercase">Aguardando Operador</div>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Painel do Fundo Inicial / Abertura */}
                        <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
                            <div>
                                <h3 className="text-white font-black text-[10px] uppercase mb-4 tracking-widest">Abertura de Turno</h3>
                                <p className="text-xs text-slate-400 mb-6">Informe o montante em dinheiro separado para troco e fundo de gaveta.</p>
                                
                                <div className="space-y-2 mb-4">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block pl-1">Fundo de Caixa</label>
                                    <input 
                                        type="text" 
                                        placeholder="R$ 0,00" 
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xl font-black text-white outline-none focus:border-blue-600 transition-all"
                                        value={tempInitialBalance} 
                                        onChange={e => setTempInitialBalance(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-slate-500 bg-slate-950/40 px-4 py-2 rounded-xl border border-slate-800 text-[10px] font-bold uppercase">
                                <AlertCircle size={14} className="text-blue-500"/> Defina o valor para liberar o terminal.
                            </div>
                        </div>

                        {/* Card do Lado Direito - Minimalista e Alinhado */}
                        <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between relative">
                            <div className="absolute top-6 right-6 text-slate-800"><Wallet size={24}/></div>
                            
                            <div>
                                <h3 className="text-white font-black text-[10px] uppercase mb-4 tracking-widest">Confirmação</h3>
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-black text-amber-400 uppercase tracking-wider mb-2">
                                    ● Aguardando Início
                                </div>
                                <p className="text-xs text-slate-400 max-w-xs">Após confirmar, o terminal estará pronto para registrar novas vendas e fluxos de caixa.</p>
                            </div>

                            <button 
                                onClick={async () => {
                                    const val = parseFloat(tempInitialBalance.replace(',', '.'));
                                    if (isNaN(val)) return alert("Por favor, insira um valor inicial válido.");
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
                                disabled={isOpening || !tempInitialBalance}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all uppercase text-xs tracking-wider mt-6"
                            >
                                {isOpening ? <Loader2 className="animate-spin text-white" size={16}/> : <>INICIAR OPERAÇÃO</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8 relative">
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
                        onClick={() => setIsClosingModalOpen(true)} 
                        className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-black px-10 py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                    >
                        <FileText size={20}/> ENCERRAR CAIXA
                    </button>
                </div>
            </div>

            {/* MODAL CUSTOMIZADO DE FECHAMENTO */}
            {isClosingModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-lg p-8 relative shadow-2xl">
                        <button 
                            onClick={() => {
                                setIsClosingModalOpen(false);
                                setPhysicalCashInput("");
                            }} 
                            className="absolute top-6 right-6 text-slate-400 hover:text-white transition-all"
                        >
                            <X size={20} />
                        </button>

                        <div className="text-center mb-6">
                            <Landmark className="mx-auto text-blue-500 mb-3" size={40} />
                            <h3 className="text-xl font-black text-white uppercase italic tracking-wide">Conferência de Caixa</h3>
                            <p className="text-xs text-slate-400 mt-1">Insira o montante total em dinheiro físico presente na gaveta</p>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-6 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">Saldo Esperado:</span>
                            <span className="text-lg font-black text-slate-300">R$ {saldoFinalGaveta.toFixed(2)}</span>
                        </div>

                        <div className="space-y-2 mb-6">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Valor Contado (Dinheiro)</label>
                            <input 
                                type="text" 
                                placeholder="R$ 0,00" 
                                value={physicalCashInput}
                                onChange={e => setPhysicalCashInput(e.target.value)}
                                className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-2xl font-black text-white text-center focus:border-blue-600 outline-none transition-all"
                                autoFocus
                            />
                        </div>

                        {/* Painel Informativo da Diferença em tempo real */}
                        {physicalCashInput.trim() !== "" && (
                            <div className={`p-4 rounded-2xl border text-center mb-6 transition-all ${
                                currentDifference === 0 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                : currentDifference > 0 
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            }`}>
                                <p className="text-xs font-black uppercase tracking-wider">
                                    {currentDifference === 0 && "Caixa perfeito! Tudo bateu."}
                                    {currentDifference > 0 && `Sobra no caixa: R$ ${currentDifference.toFixed(2)}`}
                                    {currentDifference < 0 && `Falta no caixa: R$ ${Math.abs(currentDifference).toFixed(2)}`}
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => {
                                    setIsClosingModalOpen(false);
                                    setPhysicalCashInput("");
                                }}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleExecuteCloseCash}
                                disabled={isClosing || !physicalCashInput}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                            >
                                {isClosing ? <Loader2 className="animate-spin text-white" size={16}/> : "CONFIRMAR E FECHAR"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}