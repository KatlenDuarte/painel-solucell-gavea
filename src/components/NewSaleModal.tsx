import React, { useState, useMemo, useEffect } from "react";
import {
    X, Search, Tag, Trash2, Minus, Plus,
    Wrench, PackageX, ShoppingCart, Info,
    CreditCard, Banknote, QrCode, UserPlus, Layers3, Calendar
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
    const [paymentMethod, setPaymentMethod] = useState<"PIX" | "Cartão" | "Dinheiro" | "Múltiplos" | "Fiado">("PIX");

    const [payments, setPayments] = useState<MultiPayment>({
        pix: 0,
        cartao: 0,
        dinheiro: 0,
        fiado: { valor: 0, nome: "", whatsapp: "", data: "" }
    });

    // Inputs auxiliares mascarados para a aba de Múltiplos
    const [multiPixInput, setMultiPixInput] = useState("");
    const [multiCartaoInput, setMultiCartaoInput] = useState("");
    const [multiDinheiroInput, setMultiDinheiroInput] = useState("");

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
    let barcodeBuffer = "";
    let timeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
        // Ignora se estiver digitando em textarea
        if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;

        clearTimeout(timeout);

        if (e.key === "Enter") {
            if (barcodeBuffer.length >= 4) {
                const product = stock.find(
                    p => p.barcode === barcodeBuffer
                );

                if (product) {
                    handleAddProduct(product, activeTab === "perda" ? "perda" : "venda");
                }
            }

            barcodeBuffer = "";
            return;
        }

        if (/^[0-9A-Za-z]$/.test(e.key)) {
            barcodeBuffer += e.key;
        }

        timeout = setTimeout(() => {
            barcodeBuffer = "";
        }, 100);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
        window.removeEventListener("keydown", handleKeyDown);
        clearTimeout(timeout);
    };
}, [stock, activeTab]);

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

    const subtotal = useMemo(() => selectedProducts.reduce((acc, curr) => acc + curr.total, 0), [selectedProducts]);
    const totalVenda = Math.max(0, subtotal - discount);
    const totalLoss = useMemo(() => lossProducts.reduce((acc, curr) => acc + curr.total, 0), [lossProducts]);
    const filteredStock = stock.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode?.includes(productSearch));

    const totalFinalCalculado = useMemo(() => {
        if (activeTab === 'venda') return totalVenda;
        if (activeTab === 'manutencao') return maint.totalService;
        return totalLoss;
    }, [activeTab, totalVenda, maint.totalService, totalLoss]);

    const handleFinish = async () => {
        if (!storeEmail) return alert("Erro: Email da loja não identificado.");
        setIsLoading(true);

        try {
            let saleData: any = {
                store: storeEmail,
                timestamp: serverTimestamp(),
                type: activeTab,
            };

            // ==================== CASO FIADO ====================
            if (paymentMethod === "Fiado" && activeTab !== 'perda') {
                if (!payments.fiado.nome || payments.fiado.valor <= 0) {
                    throw new Error("Preencha o nome e o valor do fiado.");
                }

                saleData = {
                    ...saleData,
                    status: "pending",
                    paymentMethod: "Fiado",
                    total: totalFinalCalculado,
                    fiado: payments.fiado,
                    items: activeTab === 'venda'
                        ? selectedProducts.map(i => ({ id: i.id, name: i.name, price: i.price, saleQty: i.saleQty }))
                        : [{ name: `MNT: ${maint.device}`, price: maint.totalService, saleQty: 1 }]
                };
            }
            // ==================== OUTROS MÉTODOS / PERDA ====================
            else {
                saleData.status = activeTab === 'perda' ? "loss" : "completed";

                let finalPayments = { ...payments };

                if (paymentMethod === "PIX") {
                    finalPayments = { pix: totalFinalCalculado, cartao: 0, dinheiro: 0, fiado: { valor: 0, nome: "", whatsapp: "", data: "" } };
                } else if (paymentMethod === "Cartão") {
                    finalPayments = { pix: 0, cartao: totalFinalCalculado, dinheiro: 0, fiado: { valor: 0, nome: "", whatsapp: "", data: "" } };
                } else if (paymentMethod === "Dinheiro") {
                    finalPayments = { pix: 0, cartao: 0, dinheiro: totalFinalCalculado, fiado: { valor: 0, nome: "", whatsapp: "", data: "" } };
                } else if (paymentMethod === "Múltiplos") {
                    // CORREÇÃO DOS MÚLTIPLOS: Mapeia diretamente os valores processados das inputs auxiliares
                    finalPayments = {
                        pix: payments.pix,
                        cartao: payments.cartao,
                        dinheiro: payments.dinheiro,
                        fiado: { valor: 0, nome: "", whatsapp: "", data: "" }
                    };
                }

                saleData.payments = finalPayments;
                saleData.paymentMethod = activeTab === 'perda' ? "N/A" : paymentMethod;

                if (paymentMethod === "Múltiplos") {
                    const multiplePayments = [];

                    if (finalPayments.pix > 0) {
                        multiplePayments.push({
                            method: "PIX",
                            value: finalPayments.pix
                        });
                    }

                    if (finalPayments.cartao > 0) {
                        multiplePayments.push({
                            method: "CARTÃO",
                            value: finalPayments.cartao
                        });
                    }

                    if (finalPayments.dinheiro > 0) {
                        multiplePayments.push({
                            method: "DINHEIRO",
                            value: finalPayments.dinheiro
                        });
                    }

                    saleData.multiplePayments = multiplePayments;
                }

                if (activeTab === 'venda') {
                    if (selectedProducts.length === 0) throw new Error("Adicione ao menos um produto.");
                    saleData.items = selectedProducts.map(i => ({ id: i.id, name: i.name, price: i.price, saleQty: i.saleQty }));
                    saleData.total = totalFinalCalculado;
                    saleData.discount = discount;
                    saleData.type = 'venda_direta';
                }
                else if (activeTab === 'manutencao') {
                    if (!maint.client || maint.totalService <= 0) throw new Error("Preencha os dados da manutenção.");
                    saleData.clientName = maint.client;
                    saleData.items = [{ name: `MNT: ${maint.device}`, price: maint.totalService, saleQty: 1 }];
                    saleData.total = maint.totalService;

                    // CORREÇÃO DA MANUTENÇÃO: Garante que partCost e totalService vão salvos explicitamente
                    saleData.partCost = maint.partCost; // Enviado na raiz caso seu dashboard use assim
                    saleData.maintenanceDetails = {
                        client: maint.client,
                        device: maint.device,
                        problem: maint.problem,
                        partCost: maint.partCost,
                        totalService: maint.totalService
                    };
                    saleData.type = 'manutencao';
                }
                else if (activeTab === 'perda') {
                    if (lossProducts.length === 0) throw new Error("Selecione os produtos da perda.");
                    saleData.items = lossProducts.map(i => ({ id: i.id, name: i.name, price: i.price, saleQty: i.saleQty }));
                    saleData.total = totalFinalCalculado;
                    saleData.lossReason = lossReason || "Não informado";
                    saleData.type = 'perda';
                }
            }

            // Salvar no Firebase
            await addDoc(collection(db, "sales"), saleData);

            // Atualizar estoque
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
            setList(prev => prev.map(item => item.id === p.id ? { ...item, saleQty: item.saleQty + 1, total: item.price * (item.saleQty + 1) } : item));
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

    const theme = {
        venda: { color: 'emerald', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: <ShoppingCart size={18} /> },
        manutencao: { color: 'blue', border: 'border-blue-500/30', text: 'text-blue-400', icon: <Wrench size={18} /> },
        perda: { color: 'rose', border: 'border-rose-500/30', text: 'text-rose-400', icon: <PackageX size={18} /> }
    }[activeTab];

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-slate-300">
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <header className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between gap-4 bg-slate-900/40">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-slate-950 border ${theme.border} ${theme.text}`}>
                            {theme.icon}
                        </div>
                        <h2 className="text-sm font-semibold text-white tracking-wider uppercase">
                            {activeTab === 'venda' ? 'Nova Venda' : activeTab === 'manutencao' ? 'Ordem de Manutenção' : 'Registro de Perda'}
                        </h2>
                    </div>

                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80">
                        {(['venda', 'manutencao', 'perda'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => { setActiveTab(tab); setPaymentMethod('PIX'); }}
                                className={`px-4 py-1.5 rounded-lg text-xs font-medium tracking-wide transition-all uppercase ${activeTab === tab ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white border border-transparent hover:border-slate-800 rounded-lg transition-all">
                        <X size={16} />
                    </button>
                </header>

                {/* Main Content */}
                <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">

                    {/* Left Column - Work Area */}
                    <section className="flex-1 overflow-y-auto p-6 space-y-6">

                        {/* Search & Stock Item Selection */}
                        {(activeTab === 'venda' || activeTab === 'perda') && (
                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                    <input
                                        placeholder="Buscar produto por nome ou código..."
                                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-xs focus:outline-none focus:border-slate-700 transition-all text-white placeholder-slate-500"
                                        type="text"
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                    />
                                    {productSearch && (
                                        <div className="absolute top-full left-0 w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto p-1 divide-y divide-slate-900">
                                            {filteredStock.length === 0 ? (
                                                <p className="text-xs text-slate-500 p-3 text-center">Nenhum produto encontrado.</p>
                                            ) : filteredStock.map(p => (
                                                <button key={p.id} onClick={() => handleAddProduct(p, activeTab)} className="w-full p-2.5 flex justify-between items-center rounded-lg hover:bg-slate-900 text-left transition-colors">
                                                    <div>
                                                        <p className="font-medium text-slate-200 text-xs">{p.name}</p>
                                                        <p className="text-[10px] text-slate-500 mt-0.5">Disponível: {p.stock}</p>
                                                    </div>
                                                    <span className="text-xs font-semibold text-slate-400">R$ {p.price.toFixed(2)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Items Added List */}
                                <div className="space-y-2">
                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block px-1">Itens da Lista</span>
                                    {(activeTab === 'venda' ? selectedProducts : lossProducts).length === 0 ? (
                                        <div className="border border-dashed border-slate-800 p-8 rounded-xl text-center text-xs text-slate-500">
                                            Nenhum item selecionado. Use o campo de busca acima.
                                        </div>
                                    ) : (activeTab === 'venda' ? selectedProducts : lossProducts).map(item => (
                                        <div key={item.id} className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl flex items-center justify-between hover:border-slate-800 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400">
                                                    <Tag size={14} />
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-slate-200 text-xs">{item.name}</h4>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">R$ {item.price.toFixed(2)} un.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-0.5">
                                                    <button onClick={() => handleQtyChange(item.id, item.saleQty - 1, activeTab)} className="p-1 hover:text-white text-slate-500 transition-colors"><Minus size={12} /></button>
                                                    <span className="px-2 font-mono text-white text-xs">{item.saleQty}</span>
                                                    <button onClick={() => handleQtyChange(item.id, item.saleQty + 1, activeTab)} className="p-1 hover:text-white text-slate-500 transition-colors"><Plus size={12} /></button>
                                                </div>
                                                <button onClick={() => activeTab === 'venda' ? setSelectedProducts(prev => prev.filter(p => p.id !== item.id)) : setLossProducts(prev => prev.filter(p => p.id !== item.id))} className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Custom Non-Catalog Item Input */}
                                {activeTab === 'venda' && (
                                    <div className="bg-slate-950/30 border border-slate-800/80 p-4 rounded-xl flex items-end gap-3">
                                        <div className="flex-1 space-y-1.5">
                                            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Item Avulso (Fora do Catálogo)</label>
                                            <input className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs outline-none text-white placeholder-slate-600 focus:border-slate-700" placeholder="Descrição rápida da mercadoria/serviço" value={nonCatalogItem.name} onChange={e => setNonCatalogItem({ ...nonCatalogItem, name: e.target.value })} />
                                        </div>
                                        <div className="w-28 space-y-1.5">
                                            <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Preço</label>
                                            <input className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs font-mono text-right outline-none text-white focus:border-slate-700" value={nonCatalogPriceInput} placeholder="R$ 0,00" onChange={e => { const [v, s] = formatCurrencyInput(e.target.value); setNonCatalogPriceInput(s); setNonCatalogItem({ ...nonCatalogItem, price: v }); }} />
                                        </div>
                                        <button onClick={handleAddNonCatalog} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white p-2.5 rounded-lg transition-all"><Plus size={16} /></button>
                                    </div>
                                )}

                                {/* Loss Reason Form Area */}
                                {activeTab === 'perda' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">Justificativa da Baixa / Perda</label>
                                        <textarea className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs h-20 outline-none text-white placeholder-slate-600 focus:border-slate-700 resize-none" placeholder="Informe o motivo detalhado (Ex: Produto quebrado, vencido, avaria de bancada)..." value={lossReason} onChange={e => setLossReason(e.target.value)} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Maintenance Form View */}
                        {activeTab === 'manutencao' && (
                            <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-xl space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Nome do Cliente</label>
                                        <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-slate-700" placeholder="Ex: João Silva da Costa" value={maint.client} onChange={e => setMaint({ ...maint, client: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Aparelho / Dispositivo</label>
                                        <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-slate-700" placeholder="Ex: iPhone 13 Pro Max Blue" value={maint.device} onChange={e => setMaint({ ...maint, device: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Laudo Técnico / Serviço Realizado</label>
                                    <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-slate-700" placeholder="Ex: Troca de tela frontal e conector de carga danificado" value={maint.problem} onChange={e => setMaint({ ...maint, problem: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-medium text-rose-500 uppercase tracking-wider">Custo da Peça (Bancada)</label>
                                        <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-white outline-none focus:border-slate-700" placeholder="R$ 0,00" value={maintPartInput} onChange={e => { const [v, s] = formatCurrencyInput(e.target.value); setMaintPartInput(s); setMaint({ ...maint, partCost: v }); }} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider">Valor Cobrado do Cliente</label>
                                        <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-white outline-none focus:border-slate-700" placeholder="R$ 0,00" value={maintTotalInput} onChange={e => { const [v, s] = formatCurrencyInput(e.target.value); setMaintTotalInput(s); setMaint({ ...maint, totalService: v }); }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Right Column - Financial Summary & Checkout */}
                    <aside className="w-full lg:w-[380px] bg-slate-950/40 border-t lg:border-t-0 lg:border-l border-slate-800/60 p-6 flex flex-col gap-6 justify-between overflow-y-auto">
                        <div className="space-y-6">

                            {/* Financial Calculations Box */}
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Info size={12} /> Painel Financeiro
                                </h3>

                                <div className="space-y-2 text-xs">
                                    {activeTab === 'venda' ? (
                                        <>
                                            <div className="flex justify-between text-slate-400">
                                                <span>Subtotal</span>
                                                <span className="font-mono">R$ {subtotal.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-1">
                                                <span className="text-slate-400">Desconto Aplicado</span>
                                                <div className="relative">
                                                    <input className="w-24 bg-slate-950 border border-slate-800 rounded-md py-1 px-2 text-right text-amber-500 font-mono text-xs outline-none focus:border-slate-700" value={discountInput} placeholder="0,00" onChange={e => { const [n, d] = formatCurrencyInput(e.target.value); setDiscountInput(d); setDiscount(n); }} />
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-600 font-bold">R$</span>
                                                </div>
                                            </div>
                                            <div className="pt-3 mt-2 border-t border-slate-800/60 flex justify-between items-baseline">
                                                <span className="text-white text-xs font-medium">Total Líquido</span>
                                                <span className="text-2xl font-bold text-emerald-400 font-mono tracking-tight">R$ {totalVenda.toFixed(2)}</span>
                                            </div>
                                        </>
                                    ) : activeTab === 'manutencao' ? (
                                        <>
                                            <div className="flex justify-between text-slate-400">
                                                <span>Custo da Peça</span>
                                                <span className="font-mono text-rose-400">- R$ {maint.partCost.toFixed(2)}</span>
                                            </div>
                                            <div className="pt-3 border-t border-slate-800/60 flex justify-between items-baseline">
                                                <span className="text-white text-xs font-medium">Total de Caixa</span>
                                                <span className="text-2xl font-bold text-emerald-400 font-mono tracking-tight">R$ {maint.totalService.toFixed(2)}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="py-2 flex justify-between items-baseline">
                                            <span className="text-slate-400 text-xs">Prejuízo de Estoque</span>
                                            <span className="text-2xl font-bold text-rose-500 font-mono tracking-tight">R$ {totalLoss.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Intelligent Payment Selector */}
                            {activeTab !== 'perda' && (
                                <div className="space-y-2.5">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider ml-1">Método de Liquidação</label>

                                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                        <button onClick={() => setPaymentMethod('PIX')} className={`flex items-center gap-2 p-2.5 rounded-lg border font-medium transition-all ${paymentMethod === 'PIX' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-400'}`}>
                                            <QrCode size={13} /> PIX
                                        </button>
                                        <button onClick={() => setPaymentMethod('Cartão')} className={`flex items-center gap-2 p-2.5 rounded-lg border font-medium transition-all ${paymentMethod === 'Cartão' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-400'}`}>
                                            <CreditCard size={13} /> CARTÃO
                                        </button>
                                        <button onClick={() => setPaymentMethod('Dinheiro')} className={`flex items-center gap-2 p-2.5 rounded-lg border font-medium transition-all ${paymentMethod === 'Dinheiro' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-400'}`}>
                                            <Banknote size={13} /> DINHEIRO
                                        </button>
                                        <button onClick={() => setPaymentMethod('Múltiplos')} className={`flex items-center gap-2 p-2.5 rounded-lg border font-medium transition-all ${paymentMethod === 'Múltiplos' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-400'}`}>
                                            <Layers3 size={13} /> MÚLTIPLOS
                                        </button>
                                    </div>

                                    <button onClick={() => setPaymentMethod('Fiado')} className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border text-[10px] font-medium transition-all ${paymentMethod === 'Fiado' ? 'bg-rose-950/20 border-rose-800/50 text-rose-400' : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-400'}`}>
                                        <UserPlus size={13} /> VENDER FIADO (CONTA CLIENTE)
                                    </button>

                                    {/* Conditional Form Fields based on selection */}
                                    {paymentMethod === 'Múltiplos' && (
                                        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl grid grid-cols-3 gap-2 mt-2 animate-in fade-in zoom-in-95 duration-150">
                                            <div className="space-y-1">
                                                <span className="text-[8px] font-medium text-slate-500 uppercase tracking-wide">Pix un.</span>
                                                <input type="text" placeholder="0,00" value={multiPixInput} className="w-full font-mono bg-slate-950 border border-slate-800 rounded-md p-1.5 text-xs text-white outline-none" onChange={e => {
                                                    const [v, s] = formatCurrencyInput(e.target.value); setMultiPixInput(s); setPayments({ ...payments, pix: v });
                                                }} />
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[8px] font-medium text-slate-500 uppercase tracking-wide">Cartão un.</span>
                                                <input type="text" placeholder="0,00" value={multiCartaoInput} className="w-full font-mono bg-slate-950 border border-slate-800 rounded-md p-1.5 text-xs text-white outline-none" onChange={e => {
                                                    const [v, s] = formatCurrencyInput(e.target.value); setMultiCartaoInput(s); setPayments({ ...payments, cartao: v });
                                                }} />
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[8px] font-medium text-slate-500 uppercase tracking-wide">Dinheiro</span>
                                                <input type="text" placeholder="0,00" value={multiDinheiroInput} className="w-full font-mono bg-slate-950 border border-slate-800 rounded-md p-1.5 text-xs text-white outline-none" onChange={e => {
                                                    const [v, s] = formatCurrencyInput(e.target.value); setMultiDinheiroInput(s); setPayments({ ...payments, dinheiro: v });
                                                }} />
                                            </div>
                                        </div>
                                    )}

                                    {paymentMethod === 'Fiado' && (
                                        <div className="bg-slate-950/60 border border-rose-950/40 p-3 rounded-xl space-y-2 mt-2 animate-in fade-in zoom-in-95 duration-150">
                                            <div className="space-y-1">
                                                <span className="text-[8px] font-semibold text-rose-400 uppercase tracking-wider">Nome de devedor</span>
                                                <input type="text" placeholder="Nome completo do cliente" value={payments.fiado.nome} className="w-full bg-slate-950 border border-slate-800 rounded-md p-1.5 text-xs text-white outline-none" onChange={e => setPayments({ ...payments, fiado: { ...payments.fiado, nome: e.target.value, valor: totalFinalCalculado } })} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <span className="text-[8px] font-semibold text-rose-400 uppercase tracking-wider">WhatsApp</span>
                                                    <input type="text" placeholder="(00) 00000-0000" value={payments.fiado.whatsapp} className="w-full bg-slate-950 border border-slate-800 rounded-md p-1.5 text-xs text-white outline-none" onChange={e => setPayments({ ...payments, fiado: { ...payments.fiado, whatsapp: e.target.value } })} />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[8px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1"><Calendar size={10} /> Vencimento</span>
                                                    <input type="date" value={payments.fiado.data} className="w-full bg-slate-950 border border-slate-800 rounded-md p-1.5 text-xs text-white outline-none" onChange={e => setPayments({ ...payments, fiado: { ...payments.fiado, data: e.target.value } })} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* CTA Finish Button */}
                        <div className="pt-4 border-t border-slate-800/60">
                            <button
                                onClick={handleFinish}
                                disabled={isLoading}
                                className={`w-full py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider text-white shadow-lg transition-all ${activeTab === 'perda' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'} disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                                {isLoading ? "Gravando dados no sistema..." : "Confirmar e Lançar Operação"}
                            </button>
                        </div>
                    </aside>
                </main>
            </div>
        </div>
    );
};

export default NewSaleModal;