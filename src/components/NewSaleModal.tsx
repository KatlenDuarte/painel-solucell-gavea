import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
    Plus, X, Search, CreditCard, Tag,
    Check, Trash2, Minus, PlusCircle, AlertTriangle, Printer
} from "lucide-react";

import { fetchProducts, fetchProductByBarcode } from "../services/productsService";
import { registerSaleAndAdjustStock } from "../services/salesService";
import { generateReceiptHtml } from "../utils/generateReceiptHtml"; // Importação da função de recibo

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

interface NewSaleModalProps {
    onClose: () => void;
    storeEmail: string | null;
    onSaleComplete: () => void;
}

interface DistributedPayment {
    method: string;
    value: number;
    valueInput: string;
}

interface SaleData {
    store: string;
    clientName: string;
    clientPhone: string;
    isFiado: boolean;
    expectedPaymentDate: string;
    paymentMethod: string;
    subtotal: number;
    discount: number;
    total: number;
    distributedPayments: Array<{
        method: string;
        value: number;
    }>;
    items: Array<{
        id: string;
        name: string;
        price: number;
        saleQty: number;
    }>;
}

const formatCurrencyInput = (raw: string): [number, string] => {
    let clean = raw.replace(/[^\d]/g, "");

    if (!clean) return [0, ""];

    const num = parseFloat(clean) / 100;

    const display = num.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return [num, display];
};

const paymentOptions = ["PIX", "Cartão", "Dinheiro"];

const NewSaleModal: React.FC<NewSaleModalProps> = ({ onClose, storeEmail, onSaleComplete }) => {
    const modalRef = useRef<HTMLDivElement>(null);

    const [stock, setStock] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [productSearch, setProductSearch] = useState("");

    const [discount, setDiscount] = useState(0);
    const [discountInput, setDiscountInput] = useState("");

    const [paymentMethod, setPaymentMethod] = useState("");
    const [useMultiplePayments, setUseMultiplePayments] = useState(false);
    const [distributedPayments, setDistributedPayments] = useState<DistributedPayment[]>([]);

    const [selectedProducts, setSelectedProducts] = useState<SaleItem[]>([]);

    const [nonCatalogItem, setNonCatalogItem] = useState({ name: "", price: 0 });
    const [nonCatalogPriceInput, setNonCatalogPriceInput] = useState("");

    const [barcodeInput, setBarcodeInput] = useState('');

    const handleAddProduct = useCallback((product: Product) => {
        if (product.stock === 0) {
            alert(`O produto "${product.name}" está esgotado.`);
            return;
        }

        const existingItem = selectedProducts.find((p) => p.id === product.id);

        if (existingItem) {
            if (existingItem.saleQty < product.stock) {
                handleQtyChange(product.id, existingItem.saleQty + 1);
            } else {
                alert(`Quantidade máxima em estoque (${product.stock}) atingida para o produto "${product.name}".`);
            }
        } else {
            setSelectedProducts((prev) => [
                ...prev,
                {
                    ...product,
                    saleQty: 1,
                    total: product.price,
                },
            ]);
        }
        setProductSearch("");
        setBarcodeInput('');
    }, [selectedProducts, stock]);


    const handleQtyChange = (id: string, qty: number) => {
        const isNonCatalog = id.startsWith('non-catalog-');
        const stockItem = stock.find((s) => s.id === id);

        const maxStock = isNonCatalog ? 999999 : (stockItem ? stockItem.stock : 1);

        const final = Math.min(Math.max(1, qty), maxStock);

        setSelectedProducts((prev) =>
            prev.map((item) =>
                item.id === id
                    ? { ...item, saleQty: final, total: item.price * final }
                    : item
            )
        );
    };

    const handleRemoveProduct = (id: string) => {
        setSelectedProducts((prev) => prev.filter((i) => i.id !== id));
    };

    const handleAddNonCatalogItem = () => {
        if (!nonCatalogItem.name.trim() || nonCatalogItem.price <= 0) {
            alert("Preencha o nome e um preço válido para o item avulso.");
            return;
        }

        const newId = `non-catalog-${Date.now()}`;

        const newItem: SaleItem = {
            id: newId,
            name: nonCatalogItem.name.trim(),
            price: nonCatalogItem.price,
            stock: 999999,
            saleQty: 1,
            total: nonCatalogItem.price,
        };

        setSelectedProducts((prev) => [...prev, newItem]);
        setNonCatalogItem({ name: "", price: 0 });
        setNonCatalogPriceInput("");
    };

    useEffect(() => {
        const loadProducts = async () => {
            if (!storeEmail) {
                setIsLoading(false);
                return;
            }

            try {
                const products = await fetchProducts(storeEmail);
                const normalized = products.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    stock: p.stock ?? 0,
                    barcode: p.barcode,
                }));
                setStock(normalized);
            } catch (error) {
                console.error("Error loading products:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadProducts();
    }, [storeEmail]);

    useEffect(() => {
        const reFocus = () => {
            if (modalRef.current) {
                modalRef.current.focus();
            }
        };
        
        reFocus(); 

        window.addEventListener('focus', reFocus);

        return () => {
            window.removeEventListener('focus', reFocus);
        };
    }, []);

    useEffect(() => {
        const handleKeyPress = async (event: KeyboardEvent) => {
            const activeElement = document.activeElement;
            const isInputFocused = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;

            if (isInputFocused && activeElement?.id !== "product-search-input") {
                return;
            }

            if (event.key >= '0' && event.key <= '9') {
                if (productSearch.length > 0) {
                    setProductSearch(""); 
                }
                setBarcodeInput(prev => prev + event.key);
            } 
            else if (event.key === 'Enter') {
                event.preventDefault();

                if (barcodeInput.length > 0 && storeEmail) {
                    const product = await fetchProductByBarcode(storeEmail, barcodeInput);

                    if (product) {
                        handleAddProduct(product as Product);
                    } else {
                        console.warn(`Código de barras não encontrado: ${barcodeInput}`);
                        alert(`Código de barras "${barcodeInput}" não encontrado.`);
                    }
                }
                setBarcodeInput('');
            } 
            else if (event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt') {
                return;
            } 
            else if (barcodeInput.length > 0 && event.key.length > 1) { 
                setBarcodeInput('');
            }
        };

        document.addEventListener('keydown', handleKeyPress);

        return () => {
            document.removeEventListener('keydown', handleKeyPress);
        };
    }, [storeEmail, barcodeInput, handleAddProduct, productSearch]);


    const filteredProducts = stock.filter((p) =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.barcode?.includes(productSearch) 
    );

    const subtotal = useMemo(
        () => selectedProducts.reduce((sum, item) => sum + item.total, 0),
        [selectedProducts]
    );

    const discountValid = Math.max(0, Math.min(discount, subtotal));
    const total = useMemo(() => Math.max(0, subtotal - discountValid), [subtotal, discountValid]);

    const distributedSum = useMemo(
        () => distributedPayments.reduce((sum, p) => sum + p.value, 0),
        [distributedPayments]
    );

    const remainingToPay = total - distributedSum;

    const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [num, display] = formatCurrencyInput(e.target.value);
        setDiscount(num);
        setDiscountInput(display);
    };

    const handleNonCatalogPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [num, display] = formatCurrencyInput(e.target.value);
        setNonCatalogPriceInput(display);
        setNonCatalogItem(prev => ({ ...prev, price: num }));
    };

    const handleToggleMultiplePayments = (value: boolean) => {
        setUseMultiplePayments(value);
        if (value) {
            setPaymentMethod("");
            setDistributedPayments([]);
        } else {
            setDistributedPayments([]);
        }
    };

    const handleAddDistributedPayment = () => {
        if (distributedPayments.length >= paymentOptions.length) return;

        const availableMethod = paymentOptions.find(
            (opt) => !distributedPayments.some((p) => p.method === opt)
        ) || "Outro";

        const initialValue = remainingToPay > 0 ? Math.max(0, remainingToPay) : 0;
        const initialValueDisplay = initialValue > 0 ? formatCurrencyInput(String(Math.round(initialValue * 100)))[1] : "";

        setDistributedPayments((prev) => [
            ...prev,
            { method: availableMethod, value: initialValue, valueInput: initialValueDisplay },
        ]);
    };

    const handleRemoveDistributedPayment = (index: number) => {
        setDistributedPayments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleDistributedPaymentMethodChange = (
        e: React.ChangeEvent<HTMLSelectElement>,
        index: number
    ) => {
        const newMethod = e.target.value;

        const isMethodTaken = distributedPayments.some(
            (p, i) => i !== index && p.method === newMethod && newMethod !== "Outro"
        );

        if (isMethodTaken) {
            alert(`O método de pagamento "${newMethod}" já foi selecionado.`);
            return;
        }

        setDistributedPayments((prev) =>
            prev.map((item, i) => (i === index ? { ...item, method: newMethod } : item))
        );
    };

    const handleDistributedPaymentValueChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const [num, display] = formatCurrencyInput(e.target.value);

        setDistributedPayments(prev =>
            prev.map((item, i) =>
                i === index
                    ? { ...item, value: num, valueInput: display }
                    : item
            )
        );
    };

    const printReceipt = (saleData: SaleData) => {
        const printWindow = window.open('', '_blank', 'width=300,height=600');
        if (!printWindow) {
            alert("O navegador bloqueou a janela de impressão. Permita pop-ups.");
            return;
        }

        // CHAMA A FUNÇÃO SEPARADA PARA GERAR O HTML
        const receiptHtml = generateReceiptHtml(saleData); 

        printWindow.document.write(receiptHtml);
        printWindow.document.close();
        printWindow.focus(); 
        
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500); 
    };


    const handleFinishSale = async () => {
        if (selectedProducts.length === 0) return alert("Adicione pelo menos um item.");

        if (useMultiplePayments) {
            if (distributedPayments.length === 0) return alert("Adicione pelo menos uma forma de pagamento distribuída.");

            if (Math.abs(remainingToPay) > 0.01) {
                return alert(`O total dos pagamentos (R$ ${distributedSum.toFixed(2)}) não corresponde ao Total da Venda (R$ ${total.toFixed(2)}). Falta R$ ${remainingToPay.toFixed(2)}.`);
            }
        } else if (!paymentMethod) {
            return alert("Selecione a forma de pagamento.");
        }

        if (!storeEmail) return alert("Erro de autenticação: Email da loja não encontrado.");

        setIsLoading(true);

        try {
            const finalPayments = useMultiplePayments
                ? distributedPayments.map(p => ({ method: p.method, value: p.value }))
                : paymentMethod ? [{ method: paymentMethod, value: total }] : [];

            const saleData: SaleData = {
                store: storeEmail,
                clientName: "Consumidor Final",
                clientPhone: "N/A",
                isFiado: false,
                expectedPaymentDate: "",
                paymentMethod: useMultiplePayments
                    ? "Múltiplo"
                    : paymentMethod,
                distributedPayments: finalPayments,
                subtotal,
                discount: discountValid,
                total,
                items: selectedProducts.map((item) => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    saleQty: item.saleQty,
                })),
            };

            await registerSaleAndAdjustStock(saleData);

            printReceipt(saleData);

            alert(`Venda registrada com sucesso! Total: R$ ${total.toFixed(2)}`);
            onSaleComplete();
            onClose();
        } catch (err) {
            console.error("Erro ao finalizar venda", err);
            alert("Erro ao finalizar venda. Tente novamente. Verifique o console para detalhes.");
        } finally {
            setIsLoading(false);
        }
    };


    if (isLoading && selectedProducts.length === 0 && stock.length === 0) {
        return (
            <div className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-50 p-4">
                <div className="text-gray-200 text-xl">Carregando produtos...</div>
            </div>
        );
    }

    const quickPaymentOptions = ["Dinheiro", "Cartão", "PIX"];

    return (
        <div ref={modalRef} tabIndex={-1} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-6xl p-8 shadow-2xl relative overflow-y-auto max-h-[95vh] text-white">

                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors p-2 z-10 bg-slate-800/50 rounded-full hover:bg-slate-800">
                    <X className="w-6 h-6" />
                </button>

                <div className="text-center mb-8 border-b border-slate-700 pb-4">
                    <h2 className="text-3xl font-extrabold text-white flex items-center justify-center gap-3">
                        <Plus className="w-7 h-7 text-green-500" />
                        Nova Venda
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Detalhe o pedido e finalize o pagamento.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

                    <div className="lg:col-span-3 space-y-6">
                        <h3 className="text-xl font-bold text-slate-300">Itens e Produtos</h3>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 w-5 h-5" />
                            <input
                                id="product-search-input"
                                type="text"
                                placeholder="Buscar produto cadastrado por nome ou CÓDIGO DE BARRAS..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="pl-12 pr-4 py-3 w-full bg-slate-800 border border-slate-700 focus:border-green-500 rounded-lg text-white placeholder-slate-500 transition-colors text-base shadow-inner"
                            />

                            {productSearch && (
                                <div className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-64 overflow-y-auto z-20">
                                    {filteredProducts.length > 0 ? (
                                        filteredProducts.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleAddProduct(p)}
                                                disabled={p.stock === 0}
                                                className={`w-full px-4 py-3 text-left border-b border-slate-700 last:border-none transition-colors flex justify-between items-center text-sm ${p.stock === 0 ? "bg-red-900/40 text-red-400 opacity-60 cursor-not-allowed" : "hover:bg-slate-700 text-slate-200"}`}
                                            >
                                                <span>
                                                    {p.name}
                                                    <span className={`text-xs ml-3 font-light ${p.stock === 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                                        {p.stock === 0 ? "(ESGOTADO)" : `(${p.stock} em estoque)`}
                                                    </span>
                                                </span>
                                                <span className="text-green-400 font-bold">R$ {p.price.toFixed(2)}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <p className="p-4 text-slate-500 text-center text-sm">Nenhum produto encontrado.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {barcodeInput && (
                            <p className="text-sm text-yellow-400 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Lendo código de barras: **{barcodeInput}** (Aguardando Enter...)
                            </p>
                        )}


                        <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg space-y-3">
                            <p className="text-yellow-400 font-semibold flex items-center gap-2 border-b border-yellow-800 pb-2">
                                <PlusCircle className="w-5 h-5 text-yellow-500" /> Adicionar Item Avulso (Não-Catalogado)
                            </p>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    placeholder="Nome do Item/Serviço"
                                    value={nonCatalogItem.name}
                                    onChange={(e) => setNonCatalogItem(prev => ({ ...prev, name: e.target.value }))}
                                    className="grow bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm placeholder-slate-500 focus:border-yellow-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Preço R$"
                                    value={nonCatalogPriceInput}
                                    onChange={handleNonCatalogPriceChange}
                                    className="w-28 text-right bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm placeholder-slate-500 focus:border-yellow-500"
                                />
                                <button
                                    onClick={handleAddNonCatalogItem}
                                    disabled={!nonCatalogItem.name.trim() || nonCatalogItem.price <= 0}
                                    className="bg-yellow-600 hover:bg-yellow-500 text-white p-2 rounded-lg disabled:bg-slate-600 disabled:opacity-50 transition-colors shadow-md"
                                    title="Adicionar item avulso"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 max-h-[35vh] lg:max-h-[50vh] overflow-y-auto pr-2 pt-2">
                            {selectedProducts.length === 0 ? (
                                <div className="text-center p-8 bg-slate-800 border border-slate-700 rounded-lg">
                                    <p className="text-slate-400 font-medium">Use a busca acima para adicionar produtos à venda.</p>
                                </div>
                            ) : (
                                selectedProducts.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between bg-slate-800 p-4 rounded-lg border border-slate-700 shadow-lg">

                                        <div className="flex-1 pr-4">
                                            <p className="text-white font-semibold text-base">
                                                {item.name}
                                                {item.id.startsWith('non-catalog-') && (
                                                    <span className="text-xs ml-2 text-yellow-400 font-normal">(AVULSO)</span>
                                                )}
                                            </p>
                                            <p className="text-slate-500 text-xs mt-0.5">R$ {item.price.toFixed(2)} / un.</p>
                                        </div>

                                        <div className="flex items-center gap-2 bg-slate-900 rounded-full p-1 border border-slate-700">
                                            <button
                                                onClick={() => handleQtyChange(item.id, item.saleQty - 1)}
                                                disabled={item.saleQty <= 1}
                                                className="text-slate-400 hover:text-white disabled:opacity-30 p-1 rounded-full hover:bg-slate-700 transition-colors"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>

                                            <span className="w-5 text-center text-white text-sm font-bold">{item.saleQty}</span>

                                            <button
                                                onClick={() => handleQtyChange(item.id, item.saleQty + 1)}
                                                disabled={!item.id.startsWith('non-catalog-') && item.saleQty >= item.stock}
                                                className="text-slate-400 hover:text-white disabled:opacity-30 p-1 rounded-full hover:bg-slate-700 transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <p className="text-green-400 font-extrabold w-28 text-right text-lg ml-4">
                                            R$ {item.total.toFixed(2)}
                                        </p>

                                        <button onClick={() => handleRemoveProduct(item.id)} className="text-red-500 hover:text-red-400 p-1 ml-3">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>


                    <div className="lg:col-span-2 space-y-6 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-2xl">
                        <h3 className="text-xl font-bold text-slate-300 border-b border-slate-700 pb-3">Resumo e Pagamento</h3>

                        <div className="space-y-4 border-b border-slate-700 pb-4">
                            <div className="flex justify-between text-slate-400 text-base">
                                <span>Subtotal:</span>
                                <span className="font-semibold">R$ {subtotal.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between items-center">
                                <label className="text-slate-400 flex items-center gap-2 text-base">
                                    <Tag className="w-5 h-5 text-red-500" /> Desconto (R$)
                                </label>

                                <input
                                    type="text"
                                    value={discountInput}
                                    onChange={handleDiscountChange}
                                    className="w-28 text-right px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-base focus:border-red-500"
                                    placeholder="0,00"
                                />
                            </div>

                            {discount > subtotal && (
                                <p className="text-red-500 text-xs mt-1 text-right">Desconto máximo permitido é R$ {subtotal.toFixed(2)}.</p>
                            )}

                            <div className="flex justify-between text-1xl font-extrabold pt-3">
                                <span className="text-white">Total:</span>
                                <span className="text-green-400">R$ {total.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="space-y-4">

                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-300 font-semibold flex items-center gap-2">
                                        <CreditCard className="w-5 h-5 text-blue-400" /> Forma de Pagamento
                                    </span>

                                    <button
                                        onClick={() => handleToggleMultiplePayments(!useMultiplePayments)}
                                        className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${useMultiplePayments ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-300"}`}
                                    >
                                        {useMultiplePayments ? "Múltiplas Formas" : "Única Forma"}
                                    </button>
                                </div>
                            </div>

                            {!useMultiplePayments ? (

                                <div className="grid grid-cols-3 gap-3">
                                    {quickPaymentOptions.map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => setPaymentMethod(opt)}
                                            className={`
                                                flex items-center justify-center
                                                py-3 px-2 rounded-lg font-bold text-sm transition-all shadow-md 
                                                ${paymentMethod === opt
                                                    ? "bg-blue-600 border-blue-400 text-white shadow-blue-500/30"
                                                    : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                                                } border-2
                                            `}
                                        >
                                            <Check className={`w-4 h-4 ${paymentMethod === opt ? "mr-2" : "hidden"}`} />
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4 pt-2">
                                    {distributedPayments.map((p, index) => (
                                        <div key={index} className="flex gap-2 items-center bg-slate-700 p-3 rounded-lg border border-slate-600">
                                            <select
                                                value={p.method}
                                                onChange={(e) => handleDistributedPaymentMethodChange(e, index)}
                                                className="grow bg-slate-900 border border-slate-600 text-white p-2 rounded-md text-sm focus:border-purple-400"
                                            >
                                                {paymentOptions.filter(opt => opt !== "Fiado").map(opt => (
                                                    <option key={opt} value={opt} disabled={opt !== p.method && distributedPayments.some(dp => dp.method === opt)}>
                                                        {opt}
                                                    </option>
                                                ))}
                                                <option value="Outro">Outro</option>
                                            </select>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">R$</span>
                                                <input
                                                    type="text"
                                                    value={p.valueInput}
                                                    onChange={(e) => handleDistributedPaymentValueChange(e, index)}
                                                    placeholder="0,00"
                                                    className="w-28 text-right pl-7 px-2 py-2 bg-slate-900 border border-slate-600 rounded-md text-white text-sm focus:border-purple-400"
                                                />
                                            </div>

                                            <button
                                                onClick={() => handleRemoveDistributedPayment(index)}
                                                className="text-red-400 hover:text-red-300 p-1"
                                                disabled={distributedPayments.length === 1 && Math.abs(remainingToPay) > 0.01}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}

                                    <button
                                        onClick={handleAddDistributedPayment}
                                        className="w-full py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                        disabled={distributedPayments.length >= paymentOptions.length}
                                    >
                                        <Plus className="w-4 h-4" /> Adicionar Parcela
                                    </button>
                                    
                                    {Math.abs(remainingToPay) > 0.01 && (
                                        <p className="text-red-500 text-sm font-semibold mt-3 text-center">
                                            Resta pagar: R$ {remainingToPay.toFixed(2)}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleFinishSale}
                            disabled={selectedProducts.length === 0 || isLoading || (useMultiplePayments && Math.abs(remainingToPay) > 0.01)}
                            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white text-xl font-extrabold rounded-lg shadow-xl shadow-green-500/30 transition-all disabled:bg-slate-700 disabled:shadow-none disabled:text-slate-500 mt-6 flex items-center justify-center gap-3"
                        >
                            {isLoading ? (
                                "Finalizando Venda..."
                            ) : (
                                <>
                                    <Printer className="w-6 h-6" />
                                    FINALIZAR E IMPRIMIR (R$ {total.toFixed(2)})
                                </>
                            )}
                        </button>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewSaleModal;