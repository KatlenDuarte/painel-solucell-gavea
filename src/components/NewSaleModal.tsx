import React, { useState, useMemo, useEffect } from "react";
import {
    Plus, X, Search, Tag, Trash2, Minus, 
    PlusCircle, Wrench, PackageX, ShoppingCart,
    DollarSign, ArrowRight, Info, Layers, TrendingUp, CreditCard, Banknote, QrCode, UserPlus, Layers3
} from "lucide-react";

// Firebase
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { fetchProducts } from "../services/productsService";

// --- Interfaces ---
interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
    barcode?: string;
}

interface SaleItem extends Product {
    saleQty: number;
    total: number;
}

interface MultiPayment {
    pix: number;
    cartao: number;
    dinheiro: number;
    fiado: {
        valor: number;
        nome: string;
        whatsapp: string;
        data: string;
    };
}

const formatCurrencyInput = (raw: string): [number, string] => {
    let clean = raw.replace(/[^\d]/g, "");
    if (!clean) return [0, ""];
    const num = parseFloat(clean) / 100;
    const display = num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return [num, display];
};

const NewSaleModal: React.FC<{ onClose: () => void; storeEmail: string | null; onSaleComplete: () => void }> = ({ 
    onClose, storeEmail, onSaleComplete 
}) => {
    const [activeTab, setActiveTab] = useState<'venda' | 'manutencao' | 'perda'>('venda');
    const [isLoading, setIsLoading] = useState(false);
    const [stock, setStock] = useState<Product[]>([]);
    const [productSearch, setProductSearch] = useState("");

    // --- ESTADOS VENDA ---
    const [selectedProducts, setSelectedProducts] = useState<SaleItem[]>([]);
    const [discount, setDiscount] = useState(0);
    const [discountInput, setDiscountInput] = useState("");
    
    // Controle de qual método de pagamento está visível
    const [paymentMethod, setPaymentMethod] = useState<"PIX" | "Cartão" | "Dinheiro" | "Múltiplos" | "Fiado">("PIX");

    const [payments, setPayments] = useState<MultiPayment>({
        pix: 0,
        cartao: 0,
        dinheiro: 0,
        fiado: { valor: 0, nome: "", whatsapp: "", data: "" }
    });

    const [nonCatalogItem, setNonCatalogItem] = useState({ name: "", price: 0 });
    const [nonCatalogPriceInput, setNonCatalogPriceInput] = useState("");

    // --- ESTADOS MANUTENÇÃO ---
    const [maint, setMaint] = useState({ client: "", device: "", problem: "", partCost: 0, totalService: 0 });
    const [maintPartInput, setMaintPartInput] = useState("");
    const [maintTotalInput, setMaintTotalInput] = useState("");

    // --- ESTADOS PERDA ---
    const [lossProducts, setLossProducts] = useState<SaleItem[]>([]);
    const [lossReason, setLossReason] = useState("");

    useEffect(() => {
        const load = async () => {
            if (!storeEmail) return;
            try {
                const data = await fetchProducts(storeEmail);
                setStock(data);
            } catch (err) { console.error(err); }
        };
        load();
    }, [storeEmail]);

const handleFinish = async () => {
    if (!storeEmail) return alert("Erro: Email da loja não identificado.");
    setIsLoading(true);

    try {
        let saleData: any = {
            store: storeEmail,
            timestamp: serverTimestamp(),
            type: activeTab,
        };

        const totalFinal = activeTab === 'venda' 
            ? totalVenda 
            : activeTab === 'manutencao' 
                ? maint.totalService 
                : totalLoss;

        // ==================== CASO FIADO ====================
        if (paymentMethod === "Fiado") {
            if (!payments.fiado.nome || payments.fiado.valor <= 0) {
                throw new Error("Preencha o nome e valor do fiado.");
            }

            saleData = {
                ...saleData,
                status: "pending",
                paymentMethod: "Fiado",
                total: totalFinal,
                fiado: payments.fiado,
                items: activeTab === 'venda' 
                    ? selectedProducts.map(i => ({
                        id: i.id,
                        name: i.name,
                        price: i.price,
                        saleQty: i.saleQty
                      }))
                    : activeTab === 'manutencao'
                        ? [{ name: `MNT: ${maint.device}`, price: maint.totalService, saleQty: 1 }]
                        : lossProducts.map(i => ({
                            id: i.id,
                            name: i.name,
                            price: i.price,
                            saleQty: i.saleQty
                          }))
            };
        } 
        // ==================== OUTROS MÉTODOS ====================
        else {
            saleData.status = "completed";

            let finalPayments = { ...payments };

            if (paymentMethod === "PIX") finalPayments = { pix: totalFinal, cartao: 0, dinheiro: 0, fiado: { valor: 0, nome: "", whatsapp: "", data: "" } };
            if (paymentMethod === "Cartão") finalPayments = { pix: 0, cartao: totalFinal, dinheiro: 0, fiado: { valor: 0, nome: "", whatsapp: "", data: "" } };
            if (paymentMethod === "Dinheiro") finalPayments = { pix: 0, cartao: 0, dinheiro: totalFinal, fiado: { valor: 0, nome: "", whatsapp: "", data: "" } };
            if (paymentMethod === "Múltiplos") finalPayments = { ...payments };

            saleData.payments = finalPayments;
            saleData.paymentMethod = paymentMethod;

            if (activeTab === 'venda') {
                if (selectedProducts.length === 0) throw new Error("Adicione ao menos um produto.");
                saleData.items = selectedProducts.map(i => ({
                    id: i.id, name: i.name, price: i.price, saleQty: i.saleQty
                }));
                saleData.total = totalFinal;
                saleData.discount = discount;
                saleData.type = 'venda_direta';
            } 
            else if (activeTab === 'manutencao') {
                if (!maint.client || maint.totalService <= 0) throw new Error("Preencha os dados da manutenção.");
                saleData.clientName = maint.client;
                saleData.items = [{ name: `MNT: ${maint.device}`, price: maint.totalService, saleQty: 1 }];
                saleData.total = maint.totalService;
                saleData.maintenanceDetails = maint;
                saleData.type = 'manutencao';
            } 
            else if (activeTab === 'perda') {
                if (lossProducts.length === 0) throw new Error("Selecione os produtos da perda.");
                saleData.items = lossProducts.map(i => ({
                    id: i.id, name: i.name, price: i.price, saleQty: i.saleQty
                }));
                saleData.total = totalFinal;
                saleData.status = "loss";
                saleData.lossReason = lossReason || "Não informado";
                saleData.type = 'perda';
            }
        }

        // Salvar venda
        await addDoc(collection(db, "sales"), saleData);

        // Atualizar estoque (exceto avulsos e perdas)
        const itemsToUpdate = activeTab === 'perda' ? lossProducts : selectedProducts;
        for (const item of itemsToUpdate) {
            if (!item.id.includes('avulso')) {
                const productRef = doc(db, "products", item.id);
                await updateDoc(productRef, { stock: increment(-item.saleQty) });
            }
        }

        alert("Operação registrada com sucesso!");
        onSaleComplete();
        onClose();

    } catch (error: any) {
        console.error(error);
        alert(error.message || "Erro ao salvar operação.");
    } finally {
        setIsLoading(false);
    }
};

    const handleAddProduct = (p: Product, target: 'venda' | 'perda') => {
        const list = target === 'venda' ? selectedProducts : lossProducts;
        const setList = target === 'venda' ? setSelectedProducts : setLossProducts;
        const existing = list.find(item => item.id === p.id);
        if (existing) {
            setList(prev => prev.map(item => item.id === p.id ? { ...item, saleQty: item.saleQty + 1, total: item.price * (item.saleQty + 1) } : item ));
        } else {
            setList([...list, { ...p, saleQty: 1, total: p.price }]);
        }
        setProductSearch("");
    };

    const handleQtyChange = (id: string, qty: number, target: 'venda' | 'perda') => {
        const setList = target === 'venda' ? setSelectedProducts : setLossProducts;
        setList(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, qty);
                return { ...item, saleQty: newQty, total: item.price * newQty };
            }
            return item;
        }));
    };

    const handleAddNonCatalog = () => {
        if (!nonCatalogItem.name || nonCatalogItem.price <= 0) return;
        const newItem: SaleItem = {
            id: `avulso-${Date.now()}`,
            name: `(AVULSO) ${nonCatalogItem.name}`,
            price: nonCatalogItem.price,
            stock: 999, saleQty: 1, total: nonCatalogItem.price
        };
        setSelectedProducts([...selectedProducts, newItem]);
        setNonCatalogItem({ name: "", price: 0 });
        setNonCatalogPriceInput("");
    };

    const subtotal = useMemo(() => selectedProducts.reduce((acc, curr) => acc + curr.total, 0), [selectedProducts]);
    const totalVenda = Math.max(0, subtotal - discount);
    const totalLoss = useMemo(() => lossProducts.reduce((acc, curr) => acc + curr.total, 0), [lossProducts]);
    const filteredStock = stock.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode?.includes(productSearch));

    const theme = {
        venda: { color: 'emerald', icon: <ShoppingCart size={20}/> },
        manutencao: { color: 'blue', icon: <Wrench size={20}/> },
        perda: { color: 'rose', icon: <PackageX size={20}/> }
    }[activeTab];

    return (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-50 p-2 md:p-6 text-slate-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-7xl h-[95vh] shadow-2xl flex flex-col overflow-hidden">
                
                <header className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl text-white ${activeTab === 'venda' ? 'bg-emerald-500' : activeTab === 'manutencao' ? 'bg-blue-500' : 'bg-rose-500'} transition-colors`}>
                            {theme.icon}
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">
                            {activeTab === 'venda' ? 'Nova Venda' : activeTab === 'manutencao' ? 'Manutenção' : 'Registro de Perda'}
                        </h2>
                    </div>
                    
                    <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
                        <button onClick={() => setActiveTab('venda')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'venda' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500'}`}>VENDA</button>
                        <button onClick={() => setActiveTab('manutencao')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'manutencao' ? 'bg-slate-800 text-blue-400' : 'text-slate-500'}`}>MANUTENÇÃO</button>
                        <button onClick={() => setActiveTab('perda')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'perda' ? 'bg-slate-800 text-rose-400' : 'text-slate-500'}`}>PERDA</button>
                    </div>

                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </header>

                <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    <section className="flex-1 overflow-y-auto p-6 border-r border-slate-800 bg-slate-950/20">
                        <div className="space-y-6">
                            {(activeTab === 'venda' || activeTab === 'perda') && (
                                <>
                                    <div className="relative group">
                                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input 
                                            placeholder="Buscar produto..." 
                                            className="w-full bg-slate-950 border border-slate-800 py-4 pl-14 pr-12 rounded-2xl text-sm focus:outline-none focus:border-emerald-500/50 transition-all text-white"
                                            type="text" 
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                        />
                                        {productSearch && (
                                            <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto p-2">
                                                {filteredStock.map(p => (
                                                    <button key={p.id} onClick={() => handleAddProduct(p, activeTab)} className="w-full p-3 flex justify-between items-center rounded-xl hover:bg-slate-800 transition-colors text-left">
                                                        <div>
                                                            <p className="font-bold text-white text-sm">{p.name}</p>
                                                            <p className="text-[10px] text-slate-500 uppercase font-black">Estoque: {p.stock}</p>
                                                        </div>
                                                        <span className="font-black text-emerald-400">R$ {p.price.toFixed(2)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Itens Adicionados</label>
                                        {(activeTab === 'venda' ? selectedProducts : lossProducts).map(item => (
                                            <div key={item.id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group hover:border-slate-700 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className={`h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-${theme.color}-500`}>
                                                        <Tag size={18} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white text-sm">{item.name}</h4>
                                                        <p className="text-[10px] text-slate-500 uppercase font-black">R$ {item.price.toFixed(2)} unit.</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center bg-slate-900 rounded-xl border border-slate-800 p-1">
                                                        <button onClick={() => handleQtyChange(item.id, item.saleQty - 1, activeTab)} className="p-1 hover:text-white text-slate-500 transition-colors"><Minus size={14}/></button>
                                                        <span className="px-3 font-bold text-white text-xs">{item.saleQty}</span>
                                                        <button onClick={() => handleQtyChange(item.id, item.saleQty + 1, activeTab)} className="p-1 hover:text-white text-slate-500 transition-colors"><Plus size={14}/></button>
                                                    </div>
                                                    <button onClick={() => activeTab === 'venda' ? setSelectedProducts(prev => prev.filter(p => p.id !== item.id)) : setLossProducts(prev => prev.filter(p => p.id !== item.id))} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {activeTab === 'venda' && (
                                        <div className="bg-emerald-500/5 border border-dashed border-emerald-500/20 p-5 rounded-2xl flex flex-wrap gap-4 items-end">
                                            <div className="flex-1 min-w-[200px] space-y-2">
                                                <label className="text-[10px] font-black text-emerald-500 uppercase">Item Avulso</label>
                                                <input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm outline-none" placeholder="Descrição do item" value={nonCatalogItem.name} onChange={e => setNonCatalogItem({...nonCatalogItem, name: e.target.value})} />
                                            </div>
                                            <div className="w-32 space-y-2">
                                                <label className="text-[10px] font-black text-emerald-500 uppercase">Preço</label>
                                                <input className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm font-bold text-right outline-none" value={nonCatalogPriceInput} onChange={e => {const [v, s] = formatCurrencyInput(e.target.value); setNonCatalogPriceInput(s); setNonCatalogItem({...nonCatalogItem, price: v});}} />
                                            </div>
                                            <button onClick={handleAddNonCatalog} className="bg-emerald-600 hover:bg-emerald-500 text-white p-3.5 rounded-xl shadow-lg transition-all"><Plus size={20}/></button>
                                        </div>
                                    )}

                                    {activeTab === 'perda' && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-rose-500 uppercase ml-1">Motivo da Saída</label>
                                            <textarea className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm h-24 outline-none focus:border-rose-500/50 resize-none" placeholder="Explique o motivo..." value={lossReason} onChange={e => setLossReason(e.target.value)} />
                                        </div>
                                    )}
                                </>
                            )}

                            {activeTab === 'manutencao' && (
                                <div className="space-y-6">
                                    <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Cliente</label>
                                                <input className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-blue-500" placeholder="Nome do cliente" value={maint.client} onChange={e => setMaint({...maint, client: e.target.value})} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Aparelho</label>
                                                <input className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-blue-500" placeholder="Ex: iPhone 13" value={maint.device} onChange={e => setMaint({...maint, device: e.target.value})} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Descrição</label>
                                            <input className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-blue-500" placeholder="Serviço realizado..." value={maint.problem} onChange={e => setMaint({...maint, problem: e.target.value})} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-rose-500 uppercase">Custo Peça</label>
                                                <input className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" value={maintPartInput} onChange={e => {const [v, s] = formatCurrencyInput(e.target.value); setMaintPartInput(s); setMaint({...maint, partCost: v});}} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-emerald-500 uppercase">Valor Final</label>
                                                <input className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" value={maintTotalInput} onChange={e => {const [v, s] = formatCurrencyInput(e.target.value); setMaintTotalInput(s); setMaint({...maint, totalService: v});}} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className="w-full lg:w-[460px] bg-slate-950/50 p-6 flex flex-col gap-6 overflow-y-auto">
                        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4 shadow-xl">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Info size={14} /> Resumo Financeiro
                            </h3>
                            
                            <div className="space-y-3">
                                {activeTab === 'venda' ? (
                                    <>
                                        <div className="flex justify-between text-slate-400 font-medium">
                                            <span>Subtotal</span>
                                            <span>R$ {subtotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">Desconto</span>
                                            <div className="relative">
                                                <input className="w-32 bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-right text-amber-500 font-black outline-none focus:border-amber-500/50" value={discountInput} onChange={e => {const [n, d] = formatCurrencyInput(e.target.value); setDiscountInput(d); setDiscount(n);}} />
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600">R$</span>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-slate-800 flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold text-lg">Total Final</span>
                                                <span className="text-[10px] text-emerald-500 font-bold uppercase">Finalizar agora</span>
                                            </div>
                                            <span className="text-4xl font-black text-emerald-400 tracking-tighter">R$ {totalVenda.toFixed(2)}</span>
                                        </div>
                                    </>
                                ) : activeTab === 'manutencao' ? (
                                    <>
                                        <div className="pt-4 border-t border-slate-800 flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold text-lg">Total Final</span>
                                                <span className="text-[10px] text-rose-500 font-bold uppercase">Custo: -R$ {maint.partCost.toFixed(2)}</span>
                                            </div>
                                            <span className="text-4xl font-black text-emerald-400">R$ {maint.totalService.toFixed(2)}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="pt-4 border-t border-slate-800 flex justify-between items-end">
                                        <div className="flex flex-col">
                                            <span className="text-white font-bold text-lg">Prejuízo</span>
                                            <span className="text-[10px] text-rose-500 font-bold uppercase">Saída de estoque</span>
                                        </div>
                                        <span className="text-4xl font-black text-rose-500 tracking-tighter">R$ {totalLoss.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* PAGAMENTO - SELEÇÃO INTELIGENTE SOLUCELL */}
                        {activeTab !== 'perda' && (
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Forma de Pagamento</label>
                                
                                {/* Grade de Botões */}
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => setPaymentMethod('PIX')} className={`flex flex-col items-center gap-2 py-3 rounded-xl border text-[9px] font-black uppercase transition-all ${paymentMethod === 'PIX' ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                                        <QrCode size={16}/> PIX
                                    </button>
                                    <button onClick={() => setPaymentMethod('Cartão')} className={`flex flex-col items-center gap-2 py-3 rounded-xl border text-[9px] font-black uppercase transition-all ${paymentMethod === 'Cartão' ? 'bg-blue-500 text-white border-blue-500' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                                        <CreditCard size={16}/> CARTÃO
                                    </button>
                                    <button onClick={() => setPaymentMethod('Dinheiro')} className={`flex flex-col items-center gap-2 py-3 rounded-xl border text-[9px] font-black uppercase transition-all ${paymentMethod === 'Dinheiro' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                                        <Banknote size={16}/> DINHEIRO
                                    </button>
                                    <button onClick={() => setPaymentMethod('Múltiplos')} className={`flex flex-col items-center gap-2 py-3 rounded-xl border text-[9px] font-black uppercase transition-all ${paymentMethod === 'Múltiplos' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                                        <Layers3 size={16}/> MÚLTIPLOS
                                    </button>
                                    <button onClick={() => setPaymentMethod('Fiado')} className={`flex flex-col items-center gap-2 py-3 rounded-xl border text-[9px] font-black uppercase transition-all ${paymentMethod === 'Fiado' ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                                        <UserPlus size={16}/> FIADO
                                    </button>
                                </div>

                                {/* CAMPOS CONDICIONAIS */}
                                {paymentMethod === 'Múltiplos' && (
                                    <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-2xl grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-2">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase">Pix</span>
                                            <input type="number" placeholder="0.00" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white" onChange={e => setPayments({...payments, pix: parseFloat(e.target.value) || 0})}/>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase">Cartão</span>
                                            <input type="number" placeholder="0.00" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white" onChange={e => setPayments({...payments, cartao: parseFloat(e.target.value) || 0})}/>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase">Dinh.</span>
                                            <input type="number" placeholder="0.00" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white" onChange={e => setPayments({...payments, dinheiro: parseFloat(e.target.value) || 0})}/>
                                        </div>
                                    </div>
                                )}

                                {paymentMethod === 'Fiado' && (
                                    <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="number" placeholder="Valor Devedor" className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none" onChange={e => setPayments({...payments, fiado: {...payments.fiado, valor: parseFloat(e.target.value) || 0}})}/>
                                            <input type="date" className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none" onChange={e => setPayments({...payments, fiado: {...payments.fiado, data: e.target.value}})}/>
                                        </div>
                                        <input type="text" placeholder="Nome Completo do Cliente" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none" onChange={e => setPayments({...payments, fiado: {...payments.fiado, nome: e.target.value}})}/>
                                        <input type="text" placeholder="WhatsApp (Opcional)" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none" onChange={e => setPayments({...payments, fiado: {...payments.fiado, whatsapp: e.target.value}})}/>
                                    </div>
                                )}
                            </div>
                        )}

                        <button 
                            onClick={handleFinish}
                            disabled={isLoading}
                            className={`w-full py-5 rounded-3xl font-black text-white transition-all shadow-xl active:scale-95 disabled:opacity-20 flex items-center justify-center gap-3 ${
                                activeTab === 'venda' ? 'bg-emerald-600 hover:bg-emerald-500' :
                                activeTab === 'manutencao' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-rose-600 hover:bg-rose-500'
                            }`}
                        >
                            {isLoading ? "PROCESSANDO..." : `FINALIZAR ${activeTab.toUpperCase()}`}
                            {!isLoading && <ArrowRight size={20} />}
                        </button>
                    </aside>
                </main>
            </div>
        </div>
    );
};

export default NewSaleModal;