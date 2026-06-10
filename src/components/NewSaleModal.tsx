// src/components/NewSaleModal.tsx
import React, { useState, useMemo, useEffect } from "react";
import {
    X, Search, Tag, Trash2, Minus, Plus,
    Wrench, PackageX, ShoppingCart,
    CreditCard, Banknote, QrCode, Layers, UserX
} from "lucide-react";

// Firebase
import { db } from "../lib/firebase";
import { collection, serverTimestamp, doc, runTransaction } from "firebase/firestore";
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

interface NewSaleModalProps {
    onClose: () => void;
    storeEmail: string | null;
    onSaleComplete: () => void;
}

const NewSaleModal: React.FC<NewSaleModalProps> = ({ onClose, storeEmail, onSaleComplete }) => {
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

    // Inputs auxiliares mascarados para a aba de Múltiplos e Fiado
    const [multiPixInput, setMultiPixInput] = useState("");
    const [multiCartaoInput, setMultiCartaoInput] = useState("");
    const [multiDinheiroInput, setMultiDinheiroInput] = useState("");
    const [fiadoValorInput, setFiadoValorInput] = useState("");

    const [nonCatalogItem, setNonCatalogItem] = useState({ name: "", price: 0 });
    const [nonCatalogPriceInput, setNonCatalogPriceInput] = useState("");

    // --- ESTADOS MANUTENÇÃO ---
    const [maint, setMaint] = useState({ client: "", device: "", problem: "", partCost: 0, totalService: 0 });
    const [maintPartInput, setMaintPartInput] = useState("");
    const [maintTotalInput, setMaintTotalInput] = useState("");

    // --- ESTADOS PERDA ---
    const [lossProducts, setLossProducts] = useState<SaleItem[]>([]);
    const [lossReason, setLossReason] = useState("");

    // Leitor de Código de Barras
    useEffect(() => {
        let barcodeBuffer = "";
        let timeout: NodeJS.Timeout | null = null;

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;

            clearTimeout(timeout);

            if (e.key === "Enter") {
                const code = barcodeBuffer.trim();
                if (code.length >= 4) {
                    const product = stock.find(p => String(p.barcode).trim() === code);
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

    // Carregar estoque inicial
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

    // Cálculos Reativos
    const subtotal = useMemo(() => selectedProducts.reduce((acc, curr) => acc + curr.total, 0), [selectedProducts]);
    const totalVenda = Math.max(0, subtotal - discount);
    const totalLoss = useMemo(() => lossProducts.reduce((acc, curr) => acc + curr.total, 0), [lossProducts]);
    const filteredStock = stock.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode?.includes(productSearch));

    const totalFinalCalculado = useMemo(() => {
        if (activeTab === 'venda') return totalVenda;
        if (activeTab === 'manutencao') return maint.totalService;
        return totalLoss;
    }, [activeTab, totalVenda, maint.totalService, totalLoss]);

    // Soma dos múltiplos pagamentos para validação
    const totalMultiPreenchido = useMemo(() => {
        return payments.pix + payments.cartao + payments.dinheiro;
    }, [payments.pix, payments.cartao, payments.dinheiro]);

    const handleFinish = async () => {
        console.log("SALVANDO VENDA");
        if (!storeEmail) return alert("Erro: Email da loja não identificado.");
        setIsLoading(true);

        try {
            let saleData: any = {
                store: storeEmail,
                timestamp: serverTimestamp(),
                type: activeTab,
            };

            if (paymentMethod === "Fiado" && activeTab !== 'perda') {
                if (!payments.fiado.nome || payments.fiado.valor <= 0) {
                    throw new Error("Preencha o nome e o valor correto do fiado.");
                }
                saleData.status = "pending";
                saleData.paymentMethod = "Fiado";
                saleData.total = totalFinalCalculado;
                saleData.fiado = payments.fiado;
                saleData.items = activeTab === 'venda'
                    ? selectedProducts.map(i => ({ id: i.id, name: i.name, price: i.price, saleQty: i.saleQty }))
                    : [{ name: `MNT: ${maint.device}`, price: maint.totalService, saleQty: 1 }];
            } else if (paymentMethod === "Múltiplos" && activeTab !== 'perda') {
                if (Math.abs(totalMultiPreenchido - totalFinalCalculado) > 0.01) {
                    throw new Error(`A soma dos valores (R$ ${totalMultiPreenchido.toFixed(2)}) deve ser exatamente igual ao total geral (R$ ${totalFinalCalculado.toFixed(2)}).`);
                }
                saleData.status = "completed";
                saleData.paymentMethod = "Múltiplos";
     saleData.multiplePayments = [];

if (payments.pix > 0) {
    saleData.multiplePayments.push({
        method: "PIX",
        value: payments.pix
    });
}

if (payments.cartao > 0) {
    saleData.multiplePayments.push({
        method: "CARTÃO",
        value: payments.cartao
    });
}

if (payments.dinheiro > 0) {
    saleData.multiplePayments.push({
        method: "DINHEIRO",
        value: payments.dinheiro
    });
}
                saleData.total = totalFinalCalculado;
                saleData.items = activeTab === 'venda'
                    ? selectedProducts.map(i => ({ id: i.id, name: i.name, price: i.price, saleQty: i.saleQty }))
                    : [{ name: `MNT: ${maint.device}`, price: maint.totalService, saleQty: 1 }];
            } else {
                saleData.status = activeTab === 'perda' ? "loss" : "completed";
                let finalPayments = { ...payments };

                if (paymentMethod === "PIX") {
                    finalPayments = { pix: totalFinalCalculado, cartao: 0, dinheiro: 0, fiado: { valor: 0, nome: "", whatsapp: "", data: "" } };
                } else if (paymentMethod === "Cartão") {
                    finalPayments = { pix: 0, cartao: totalFinalCalculado, dinheiro: 0, fiado: { valor: 0, nome: "", whatsapp: "", data: "" } };
                } else if (paymentMethod === "Dinheiro") {
                    finalPayments = { pix: 0, cartao: 0, dinheiro: totalFinalCalculado, fiado: { valor: 0, nome: "", whatsapp: "", data: "" } };
                }

                saleData.payments = finalPayments;
                saleData.paymentMethod = activeTab === 'perda' ? "N/A" : paymentMethod;

                if (activeTab === 'venda') {
                    if (selectedProducts.length === 0) throw new Error("Adicione ao menos um produto.");
                    saleData.items = selectedProducts.map(i => ({ id: i.id, name: i.name, price: i.price, saleQty: i.saleQty }));
                    saleData.total = totalFinalCalculado;
                    saleData.discount = discount;
                    saleData.type = 'venda_direta';
                } else if (activeTab === 'manutencao') {
                    if (!maint.client || maint.totalService <= 0) throw new Error("Preencha os dados da manutenção.");
                    saleData.clientName = maint.client;
                    saleData.items = [{ name: `MNT: ${maint.device}`, price: maint.totalService, saleQty: 1 }];
                    saleData.total = maint.totalService;
                    saleData.partCost = maint.partCost;
                    saleData.maintenanceDetails = maint;
                    saleData.type = 'manutencao';
                } else if (activeTab === 'perda') {
                    if (lossProducts.length === 0) throw new Error("Selecione os produtos da perda.");
                    saleData.items = lossProducts.map(i => ({ id: i.id, name: i.name, price: i.price, saleQty: i.saleQty }));
                    saleData.total = totalFinalCalculado;
                    saleData.lossReason = lossReason || "Não informado";
                    saleData.type = 'perda';
                }
            }

            // TRANSACTION - Baixa de estoque segura
   await runTransaction(db, async (transaction) => {

    console.log(
        "Produtos na venda:",
        activeTab === "perda"
            ? lossProducts.length
            : selectedProducts.length
    );

    const itemsToUpdate =
        activeTab === "perda"
            ? lossProducts
            : selectedProducts;

    const productsToUpdate: any[] = [];

    // 1º PASSO - LER TUDO
    for (const item of itemsToUpdate) {

        if (item.id.startsWith("avulso-")) continue;

        const productRef = doc(db, "products", item.id);

        const productSnap =
            await transaction.get(productRef);

        productsToUpdate.push({
            ref: productRef,
            snap: productSnap,
            qty: item.saleQty
        });
    }

    // 2º PASSO - ESCREVER TUDO
    for (const product of productsToUpdate) {

        if (!product.snap.exists()) continue;

        const currentStock =
            product.snap.data().stock || 0;

        transaction.update(product.ref, {
            stock: Math.max(
                0,
                currentStock - product.qty
            )
        });
    }

    const newSaleRef = doc(collection(db, "sales"));

    transaction.set(newSaleRef, saleData);
});

            try {
                await fetch("http://localhost:3333/print", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        items: saleData.items,
                        total: saleData.total,
                        paymentMethod: saleData.paymentMethod,
                        discount: saleData.discount || 0
                    })
                });
            } catch (pErr) { console.log("Impressora offline."); }

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

    const handleAddProduct = (p: Product, target: "venda" | "perda") => {
        const setList = target === "venda" ? setSelectedProducts : setLossProducts;
        setList(prev => {
            const existing = prev.find(item => item.id === p.id);
            if (existing) {
                if (existing.saleQty >= p.stock) return prev;
                return prev.map(item => item.id === p.id ? { ...item, saleQty: item.saleQty + 1, total: item.price * (item.saleQty + 1) } : item);
            }
            return [...prev, { ...p, saleQty: 1, total: p.price }];
        });
        setProductSearch("");
    };

    const handleQtyChange = (
        id: string,
        qty: number,
        target: 'venda' | 'perda'
    ) => {
        const setList =
            target === 'venda'
                ? setSelectedProducts
                : setLossProducts;

        setList(prev =>
            prev.map(item => {
                if (item.id === id) {

                    const newQty = Math.min(
                        Math.max(1, qty),
                        item.stock
                    );

                    return {
                        ...item,
                        saleQty: newQty,
                        total: item.price * newQty
                    };
                }

                return item;
            })
        );
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
        venda: { border: 'border-emerald-500/30', text: 'text-emerald-400', icon: <ShoppingCart size={18} /> },
        manutencao: { border: 'border-blue-500/30', text: 'text-blue-400', icon: <Wrench size={18} /> },
        perda: { border: 'border-rose-500/30', text: 'text-rose-400', icon: <PackageX size={18} /> }
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
                        {((['venda', 'manutencao', 'perda'] as const)).map((tab) => (
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

                    {/* Left Column */}
                    <section className="flex-1 overflow-y-auto p-6 space-y-6">
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

                                {activeTab === 'perda' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">Justificativa da Baixa / Perda</label>
                                        <textarea className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs h-20 outline-none text-white placeholder-slate-600 focus:border-slate-700 resize-none" placeholder="Informe o motivo detalhado..." value={lossReason} onChange={e => setLossReason(e.target.value)} />
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'manutencao' && (
                            <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-xl space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Nome do Cliente</label>
                                        <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-slate-700" placeholder="Ex: João Silva da Costa" value={maint.client} onChange={e => setMaint({ ...maint, client: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Aparelho / Dispositivo</label>
                                        <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-slate-700" placeholder="Ex: iPhone 13 Pro Max" value={maint.device} onChange={e => setMaint({ ...maint, device: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Laudo Técnico / Serviço Realizado</label>
                                    <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-slate-700" placeholder="Ex: Troca de tela" value={maint.problem} onChange={e => setMaint({ ...maint, problem: e.target.value })} />
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

                    {/* Right Column - Summary & Checkout */}
                    <aside className="w-full lg:w-[380px] bg-slate-950/40 border-t lg:border-t-0 lg:border-l border-slate-800/60 p-6 flex flex-col gap-6 justify-between overflow-y-auto">
                        <div className="space-y-6">
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>Subtotal</span>
                                    <span className="font-mono">R$ {(activeTab === 'venda' ? subtotal : activeTab === 'manutencao' ? maint.totalService : totalLoss).toFixed(2)}</span>
                                </div>
                                {activeTab === 'venda' && (
                                    <div className="flex justify-between items-center text-xs text-slate-400">
                                        <span>Desconto</span>
                                        <input
                                            className="w-20 bg-slate-950 border border-slate-800 p-1 rounded font-mono text-right text-rose-400 text-xs focus:border-slate-700 outline-none"
                                            placeholder="R$ 0,00"
                                            value={discountInput}
                                            onChange={e => {
                                                const [v, s] = formatCurrencyInput(e.target.value);
                                                setDiscountInput(s);
                                                setDiscount(v);
                                            }}
                                        />
                                    </div>
                                )}
                                <div className="h-px bg-slate-800/60 my-1" />
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-white uppercase tracking-wider">Total Geral</span>
                                    <span className="text-lg font-bold font-mono text-emerald-400">R$ {totalFinalCalculado.toFixed(2)}</span>
                                </div>
                            </div>

                            {activeTab !== 'perda' && (
                                <div className="space-y-4">
                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block px-1">Método de Pagamento</span>
                                    <div className="grid grid-cols-3 gap-2">
                                        {((['PIX', 'Cartão', 'Dinheiro', 'Múltiplos', 'Fiado'] as const)).map(method => (
                                            <button
                                                key={method}
                                                onClick={() => setPaymentMethod(method)}
                                                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${paymentMethod === method ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white'}`}
                                            >
                                                {method === 'PIX' && <QrCode size={14} />}
                                                {method === 'Cartão' && <CreditCard size={14} />}
                                                {method === 'Dinheiro' && <Banknote size={14} />}
                                                {method === 'Múltiplos' && <Layers size={14} />}
                                                {method === 'Fiado' && <UserX size={14} />}
                                                <span className="text-[10px] font-medium font-sans">{method}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Sub-interface para Múltiplos Formas de Pagamento */}
                                    {paymentMethod === "Múltiplos" && (
                                        <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl space-y-3.5">
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-xs text-slate-400 flex items-center gap-1"><QrCode size={12} /> PIX</span>
                                                <input className="w-28 bg-slate-900 border border-slate-800 p-1.5 rounded font-mono text-right text-xs text-white outline-none" placeholder="R$ 0,00" value={multiPixInput} onChange={e => { const [v, s] = formatCurrencyInput(e.target.value); setMultiPixInput(s); setPayments(p => ({ ...p, pix: v })); }} />
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-xs text-slate-400 flex items-center gap-1"><CreditCard size={12} /> Cartão</span>
                                                <input className="w-28 bg-slate-900 border border-slate-800 p-1.5 rounded font-mono text-right text-xs text-white outline-none" placeholder="R$ 0,00" value={multiCartaoInput} onChange={e => { const [v, s] = formatCurrencyInput(e.target.value); setMultiCartaoInput(s); setPayments(p => ({ ...p, cartao: v })); }} />
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-xs text-slate-400 flex items-center gap-1"><Banknote size={12} /> Dinheiro</span>
                                                <input className="w-28 bg-slate-900 border border-slate-800 p-1.5 rounded font-mono text-right text-xs text-white outline-none" placeholder="R$ 0,00" value={multiDinheiroInput} onChange={e => { const [v, s] = formatCurrencyInput(e.target.value); setMultiDinheiroInput(s); setPayments(p => ({ ...p, dinheiro: v })); }} />
                                            </div>
                                            <div className="h-px bg-slate-800/50" />
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-slate-500">Total Informado:</span>
                                                <span className={`font-mono font-bold ${Math.abs(totalMultiPreenchido - totalFinalCalculado) < 0.01 ? 'text-emerald-400' : 'text-rose-400'}`}>R$ {totalMultiPreenchido.toFixed(2)} / R$ {totalFinalCalculado.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sub-interface para Fiado */}
                                    {paymentMethod === "Fiado" && (
                                        <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl space-y-2.5">
                                            <input className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-xs text-white outline-none" placeholder="Nome do Devedor" value={payments.fiado.nome} onChange={e => setPayments(p => ({ ...p, fiado: { ...p.fiado, nome: e.target.value } }))} />
                                            <input className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-xs text-white outline-none" placeholder="WhatsApp (Opcional)" value={payments.fiado.whatsapp} onChange={e => setPayments(p => ({ ...p, fiado: { ...p.fiado, whatsapp: e.target.value } }))} />
                                            <div className="flex gap-2">
                                                <input type="date" className="flex-1 bg-slate-900 border border-slate-800 p-2 rounded text-xs text-slate-300 outline-none" value={payments.fiado.data} onChange={e => setPayments(p => ({ ...p, fiado: { ...p.fiado, data: e.target.value } }))} />
                                                <input className="w-28 bg-slate-900 border border-slate-800 p-2 rounded font-mono text-right text-xs text-white outline-none" placeholder="R$ 0,00" value={fiadoValorInput} onChange={e => { const [v, s] = formatCurrencyInput(e.target.value); setFiadoValorInput(s); setPayments(p => ({ ...p, fiado: { ...p.fiado, valor: v } })); }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleFinish}
                            disabled={isLoading || totalFinalCalculado <= 0}
                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/20"
                        >
                            {isLoading ? "Processando..." : "Concluir Lançamento"}
                        </button>
                    </aside>

                </main>
            </div>
        </div>
    );
};

export default NewSaleModal;