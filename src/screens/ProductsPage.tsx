import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Plus, Search, Smartphone, Shield, Cable, Headphones,
    Edit, Trash2, Package, TriangleAlert, FileText,
    ArrowUp, ArrowDown, DollarSign, Layers, AlertCircle, Scan, Printer
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import bwipjs from "bwip-js"; // 🌟 Biblioteca para gerar o desenho do código de barras real no PDF

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { fetchProducts, deleteProduct, updateProduct } from "../services/productsService";

import AddProductModal from "../components/AddProductModal";
import EditStockModal from "../components/EditStockModal";
import LabelActionModal from "../components/LabelActionModal";

interface Product {
    id: string;
    name: string;
    category: string;
    brand: string;
    model: string;
    stock: number;
    minStock: number;
    price: number;
    status: "ok" | "low" | "critical";
    costPrice?: number | null;
    barcode?: string | null;
}

// 🌟 Interface para os itens que vão para a fila de impressão
interface LabelItem {
    id: string;
    name: string;
    brand: string;
    model: string;
    price: number;
    barcode: string;
    quantity: number;
}

type SortField = "name" | "stock" | "price";
type SortDirection = "asc" | "desc";

export default function ProductsContent() {
    const auth = getAuth();

    const [effectiveStoreEmail, setEffectiveStoreEmail] = useState<string>("");
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedCategory, setSelectedCategory] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [isReplenishmentMode, setIsReplenishmentMode] = useState(false);

    const [sortField, setSortField] = useState<SortField>("stock");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
    const [isEditStockModalOpen, setIsEditStockModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    // 🌟 ESTADOS DA FILA DE IMPRESSÃO DE ETIQUETAS
    const [labelQueue, setLabelQueue] = useState<LabelItem[]>([]);
    const [isGeneratingLabels, setIsGeneratingLabels] = useState(false);

    // 🌟 NOVOS ESTADOS PARA O MODAL DE ETIQUETAS COLETADAS
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [productPendingLabel, setProductPendingLabel] = useState<Product | null>(null);

    // Referências para o leitor de código de barras físico
    const barcodeBuffer = useRef<string>("");
    const lastKeyTime = useRef<number>(0);

    const STORE_MAPPING: Record<string, string> = {
        "kluivert@solucell.com": "kluivert@solucell.com",
        "funcionarios@solucell.com": "kluivert@solucell.com",
    };

    const determineStatus = (stock: number, minStock: number) => {
        if (stock <= 0) return "critical";
        if (stock <= minStock) return "low";
        return "ok";
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                const realStore = STORE_MAPPING[user.email!] || user.email!;
                setEffectiveStoreEmail(realStore);
            }
        });
        return () => unsubscribe();
    }, [auth]);

    const loadProducts = useCallback(async () => {
        if (!effectiveStoreEmail) return;
        setLoading(true);
        try {
            const data = await fetchProducts(effectiveStoreEmail);
            const formatted = data.map((p: any) => {
                const stock = Number(p.stock || 0);
                const minStock = Number(p.minStock || 5);
                return {
                    ...p,
                    stock,
                    minStock,
                    price: Number(p.price || 0),
                    costPrice: p.costPrice !== undefined ? p.costPrice : null,
                    barcode: p.barcode || null,
                    status: determineStatus(stock, minStock)
                };
            });
            setProducts(formatted);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [effectiveStoreEmail]);

    useEffect(() => {
        if (effectiveStoreEmail) loadProducts();
    }, [effectiveStoreEmail, loadProducts]);

    // 🌟 ADICIONAR PRODUTO À FILA DE ETIQUETAS
// 🌟 ADICIONAR PRODUTO À FILA DE ETIQUETAS (AGORA VIA MODAL)
const handleAddToLabelQueue = (product: Product, customQty?: number) => {
    if (!product.barcode) {
        alert("Este produto não possui código de barras cadastrado!");
        return;
    }

    // Se não veio uma quantidade definida, abre o modal customizado para coletar
    if (customQty === undefined) {
        setProductPendingLabel(product);
        setIsLabelModalOpen(true);
        return;
    }

    const qty = customQty;
    if (qty <= 0) return;

    setLabelQueue(prev => {
        const existing = prev.find(item => item.id === product.id);
        if (existing) {
            return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + qty } : item);
        }
        return [...prev, {
            id: product.id,
            name: product.name,
            brand: product.brand,
            model: product.model,
            price: product.price,
            barcode: product.barcode,
            quantity: qty
        }];
    });
};

    // 🌟 CAPTURA GLOBAL DO LEITOR DE CÓDIGO DE BARRAS
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
                return;
            }

            const currentTime = Date.now();
            if (currentTime - lastKeyTime.current > 100) {
                barcodeBuffer.current = "";
            }
            lastKeyTime.current = currentTime;

            if (e.key === "Enter") {
                if (barcodeBuffer.current.length > 3) {
                    const scannedCode = barcodeBuffer.current.trim();
                    barcodeBuffer.current = "";

                    const productFound = products.find(p => p.barcode === scannedCode);

                    if (productFound) {
                        // Ao bipar, ele já oferece para colocar na folha de impressão mista
                        handleAddToLabelQueue(productFound);
                    } else {
                        alert(`Código "${scannedCode}" não encontrado no inventário.`);
                    }
                }
            } else if (e.key.length === 1) {
                barcodeBuffer.current += e.key;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [products]);

    // 🌟 IMPRESSÃO OTIMIZADA DE FOLHA MISTA (PIMACO 3 COLUNAS X 10 LINHAS COMO EXEMPLO)
    const exportMixedLabelsPDF = async () => {
        if (labelQueue.length === 0) {
            alert("A fila de etiquetas está vazia!");
            return;
        }

        const iniciarNaPosicao = Number(window.prompt("Deseja pular etiquetas já usadas nesta folha? Digite de qual posição iniciar (1 a 30):", "1"));
        if (isNaN(iniciarNaPosicao) || iniciarNaPosicao < 1 || iniciarNaPosicao > 30) return;

        setIsGeneratingLabels(true);

        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        // Configurações de Margem padrão Folha A4 Pimaco
        const marginLeft = 7;
        const marginTop = 12;
        const labelWidth = 63.5;
        const labelHeight = 25.4;
        const gapX = 2.5;
        const gapY = 0;

        const maxColumns = 3;
        const maxRows = 10;

        // Posição inicial baseada na escolha do usuário (ajuste para index 0)
        let currentColumn = (iniciarNaPosicao - 1) % maxColumns;
        let currentRow = Math.floor((iniciarNaPosicao - 1) / maxColumns);

        // Planifica a fila multiplicando pelas quantidades escolhidas
        const flattenedLabels: LabelItem[] = [];
        labelQueue.forEach(item => {
            for (let i = 0; i < item.quantity; i++) {
                flattenedLabels.push(item);
            }
        });

        // Função auxiliar para gerar a imagem do código de barras em formato buffer/canvas
        const generateBarcodeImage = (text: string): Promise<string> => {
            return new Promise((resolve, reject) => {
                const canvas = document.createElement("canvas");
                bwipjs.toCanvas(canvas, {
                    bcid: "code128",       // Tipo do código de barras
                    text: text,            // Valor numérico
                    scale: 3,              // Resolução
                    height: 10,            // Altura do traçado
                    includetext: false,    // Remove o texto debaixo das barras (escrevemos manualmente menor)
                });
                resolve(canvas.toDataURL("image/png"));
            });
        };

        for (let i = 0; i < flattenedLabels.length; i++) {
            const label = flattenedLabels[i];

            if (currentRow >= maxRows) {
                doc.addPage();
                currentRow = 0;
                currentColumn = 0;
            }

            const x = marginLeft + currentColumn * (labelWidth + gapX);
            const y = marginTop + currentRow * (labelHeight + gapY);

            // Nome do Produto
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text(label.name.substring(0, 32), x + 3, y + 5);

            // Detalhes / Modelo
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(80, 80, 80);
            doc.text(`${label.brand} ${label.model}`.substring(0, 38), x + 3, y + 9);

            // Preço Comercial
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(16, 185, 129); // Cor Verde comercial
            doc.text(`R$ ${label.price.toFixed(2)}`, x + 3, y + 14);

            // Desenha a imagem das barras reais
            try {
                const barcodeImgData = await generateBarcodeImage(label.barcode);
                doc.addImage(barcodeImgData, "PNG", x + 3, y + 16, labelWidth - 6, 6);
            } catch (err) {
                console.error("Falha ao gerar barras gráficas", err);
            }

            // Código legível por extenso abaixo das barras
            doc.setFontSize(5.5);
            doc.setFont("Courier", "normal");
            doc.setTextColor(0, 0, 0);
            doc.text(label.barcode, x + (labelWidth / 2), y + 23.5, { align: "center" });

            currentColumn++;
            if (currentColumn >= maxColumns) {
                currentColumn = 0;
                currentRow++;
            }
        }

        doc.save("folha-etiquetas-mistas.pdf");
        setLabelQueue([]); // Limpa a fila após gerar com sucesso
        setIsGeneratingLabels(false);
    };

    const handleUpdateProduct = async (
        productId: string,
        newStock: number,
        operation: string,
        newName: string,
        newPrice: number,
        newMinStock: number,
        newCostPrice: number | null,
        newBarcode: string | null
    ) => {
        try {
            await updateProduct(productId, {
                name: newName, price: newPrice, stock: newStock, minStock: newMinStock, costPrice: newCostPrice, barcode: newBarcode,
            });

            setProducts(prevProducts =>
                prevProducts.map(p =>
                    p.id === productId
                        ? { ...p, name: newName, price: newPrice, stock: newStock, minStock: newMinStock, costPrice: newCostPrice, barcode: newBarcode, status: determineStatus(newStock, newMinStock) }
                        : p
                )
            );
            setIsEditStockModalOpen(false);
            setSelectedProduct(null);
            await loadProducts();
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar alterações.");
        }
    };

    const handleDeleteProduct = async (id: string, name: string) => {
        if (!window.confirm(`Tem certeza que deseja excluir ${name}?`)) return;
        try {
            await deleteProduct(id);
            setProducts(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    const filteredProducts = useMemo(() => {
        let result = products.filter(p => {
            const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
            const matchesSearch =
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.barcode && p.barcode.includes(searchTerm));
            const matchesReplenishment = !isReplenishmentMode || p.status !== "ok";
            return matchesCategory && matchesSearch && matchesReplenishment;
        });

        return result.sort((a, b) => {
            let valA: any = a[sortField];
            let valB: any = b[sortField];
            if (sortField === "name") {
                return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return sortDirection === "asc" ? valA - valB : valB - valA;
        });
    }, [products, selectedCategory, searchTerm, isReplenishmentMode, sortField, sortDirection]);

    const inventoryStats = useMemo(() => {
        const totalItems = products.reduce((acc, p) => acc + p.stock, 0);
        const totalValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
        const criticalAlerts = products.filter(p => p.status !== "ok").length;
        return { totalItems, totalValue, criticalAlerts };
    }, [products]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection(field === "name" ? "asc" : "desc");
        }
    };

    const totalLabelsInQueue = labelQueue.reduce((acc, item) => acc + item.quantity, 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col gap-3 items-center justify-center text-slate-400 font-sans">
                <div className="h-7 w-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs uppercase font-bold tracking-widest text-slate-500">Buscando Inventário...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 font-sans antialiased">

            {/* Topo / Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">INVENTÁRIO<span className="text-emerald-500">.</span></h1>
                    <p className="text-slate-500 text-xs sm:text-sm flex items-center gap-1.5">
                        <Scan size={14} className="text-emerald-500 animate-pulse" /> Scanner ativo: ao bipar, o item entra na fila de impressão.
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                    {/* Botão Dinâmico da Fila de Etiquetas */}
                    {totalLabelsInQueue > 0 && (
                        <button
                            onClick={exportMixedLabelsPDF}
                            disabled={isGeneratingLabels}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-amber-600/20"
                        >
                            <Printer size={16} /> Imprimir {totalLabelsInQueue} Etiqueta(s) Mista(s)
                        </button>
                    )}

                    <button onClick={() => setIsAddProductModalOpen(true)} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 px-5 py-2.5 rounded-xl font-black text-slate-950 text-xs uppercase transition-all shadow-lg shadow-emerald-500/10">
                        <Plus size={18} /> Novo Produto
                    </button>
                </div>
            </div>

            {/* Cards Informativos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20"><Layers size={20} /></div>
                    <div>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Volume de Itens</p>
                        <h4 className="text-xl font-black text-white">{inventoryStats.totalItems} un</h4>
                    </div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20"><DollarSign size={20} /></div>
                    <div>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Custo de Estoque</p>
                        <h4 className="text-xl font-black text-white">R$ {inventoryStats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                    </div>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20"><AlertCircle size={20} /></div>
                    <div>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Produtos Instáveis</p>
                        <h4 className="text-xl font-black text-white">{inventoryStats.criticalAlerts} pendentes</h4>
                    </div>
                </div>
            </div>

            {/* Painel de Filtros Avançados */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl md:rounded-3xl p-4 md:p-5 space-y-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nome, marca, modelo ou código..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-xs font-medium focus:border-emerald-500 outline-none placeholder-slate-600 text-white transition-colors"
                        />
                    </div>
                    <button
                        onClick={() => setIsReplenishmentMode(!isReplenishmentMode)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all border ${isReplenishmentMode ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800/50"
                            }`}
                    >
                        <TriangleAlert size={16} />
                        {isReplenishmentMode ? "Ver Tudo" : "Filtro Reposição"}
                    </button>
                </div>

                {/* Categorias */}
                <div className="overflow-x-auto pb-1 flex gap-2 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
                    <CategoryBtn active={selectedCategory === "all"} onClick={() => setSelectedCategory("all")} icon={<Package size={14} />} label="Todos" />
                    <CategoryBtn active={selectedCategory === "peliculas"} onClick={() => setSelectedCategory("peliculas")} icon={<Shield size={14} />} label="Películas" />
                    <CategoryBtn active={selectedCategory === "cases"} onClick={() => setSelectedCategory("cases")} icon={<Smartphone size={14} />} label="Cases" />
                    <CategoryBtn active={selectedCategory === "cabos"} onClick={() => setSelectedCategory("cabos")} icon={<Cable size={14} />} label="Cabos" />
                    <CategoryBtn active={selectedCategory === "acessorios"} onClick={() => setSelectedCategory("acessorios")} icon={<Headphones size={14} />} label="Acessórios" />
                </div>

                {/* Ordenação rápida */}
                <div className="flex flex-col xs:flex-row xs:items-center gap-2 pt-3 border-t border-slate-800/60">
                    <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Ordenar por:</span>
                    <div className="flex gap-1.5 flex-wrap">
                        <SortButton field="stock" label="Estoque" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                        <SortButton field="price" label="Preço" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                        <SortButton field="name" label="Nome" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                    </div>
                </div>
            </div>

            {/* Grid Mobile / Tabela Desktop */}
            <div>
                {/* VISÃO EM CARDS (Mobile) */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                    {filteredProducts.length === 0 ? (
                        <div className="text-center py-10 bg-slate-900/30 border border-slate-800 rounded-2xl text-slate-500 text-xs font-medium">
                            Nenhum produto atende aos filtros atuais.
                        </div>
                    ) : (
                        filteredProducts.map((p) => (
                            <div key={p.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-3">
                                <div className="flex justify-between items-start gap-2">
                                    <div>
                                        <h4 className="font-bold text-white text-sm leading-tight">{p.name}</h4>
                                        <p className="text-slate-500 text-[11px] mt-0.5">{p.brand} • {p.model}</p>
                                    </div>
                                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase shrink-0 ${p.status === 'critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                            p.status === 'low' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        }`}>{p.stock} un</span>
                                </div>

                                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-900">
                                    <div>
                                        <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">Preço base</span>
                                        <span className="font-black text-emerald-400 text-sm">R$ {p.price.toFixed(2)}</span>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button
                                            onClick={() => handleAddToLabelQueue(p)}
                                            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-amber-400 transition-colors"
                                            title="Adicionar à fila de etiquetas"
                                        >
                                            <Printer size={14} />
                                        </button>
                                        <button
                                            onClick={() => { setSelectedProduct(p); setIsEditStockModalOpen(true); }}
                                            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-emerald-400 transition-colors"
                                        >
                                            <Edit size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteProduct(p.id, p.name)}
                                            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-red-400 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* VISÃO EM TABELA TRADICIONAL (Desktop) */}
                <div className="hidden md:block bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950 text-[10px] uppercase font-black text-slate-400 tracking-wider border-b border-slate-800">
                                <th className="px-6 py-4">Produto</th>
                                <th className="px-6 py-4">Marca / Modelo</th>
                                <th className="px-6 py-4 text-center">Mínimo</th>
                                <th className="px-6 py-4 text-center">Estoque</th>
                                <th className="px-6 py-4 text-right">Preço</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-sm text-slate-500 font-medium">Nenhum produto correspondente.</td>
                                </tr>
                            ) : (
                                filteredProducts.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-900/50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-white text-sm">{p.name}</td>
                                        <td className="px-6 py-4 text-slate-400 text-xs font-medium">{p.brand} <span className="text-slate-600">•</span> {p.model}</td>
                                        <td className="px-6 py-4 text-center text-slate-400 text-sm font-semibold">{p.minStock}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-black inline-block min-w-[65px] ${p.status === 'critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                    p.status === 'low' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                }`}>{p.stock} un</span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-emerald-400 text-sm">R$ {p.price.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleAddToLabelQueue(p)} className="p-2 hover:bg-amber-500/10 rounded-xl text-amber-400 transition-colors" title="Adicionar à fila de etiquetas">
                                                    <Printer size={16} />
                                                </button>
                                                <button onClick={() => { setSelectedProduct(p); setIsEditStockModalOpen(true); }} className="p-2 hover:bg-emerald-500/10 rounded-xl text-emerald-400 transition-colors">
                                                    <Edit size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteProduct(p.id, p.name)} className="p-2 hover:bg-red-500/10 rounded-xl text-red-400 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modais */}
            <AddProductModal
                isOpen={isAddProductModalOpen}
                onClose={() => setIsAddProductModalOpen(false)}
                onSubmit={loadProducts}
                storeEmail={effectiveStoreEmail}
            />

            {selectedProduct && (
                <EditStockModal
                    isOpen={isEditStockModalOpen}
                    onClose={() => { setIsEditStockModalOpen(false); setSelectedProduct(null); }}
                    product={selectedProduct}
                    onSubmit={handleUpdateProduct}
                />
            )}

            {/* 🌟 NOVO MODAL CUSTOMIZADO DE ETIQUETAS */}
            <LabelActionModal 
                isOpen={isLabelModalOpen}
                onClose={() => { setIsLabelModalOpen(false); setProductPendingLabel(null); }}
                productName={productPendingLabel?.name || ""}
                onConfirm={(qty) => {
                    if (productPendingLabel) {
                        handleAddToLabelQueue(productPendingLabel, qty);
                    }
                }}
            />
        </div>
    );
}

function CategoryBtn({ active, onClick, icon, label }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap shrink-0 ${active ? "bg-emerald-500 border-emerald-400 text-slate-950 font-black" : "bg-slate-900/90 border-slate-800 text-slate-400 hover:bg-slate-800"
                }`}
        >
            {icon} {label}
        </button>
    );
}

function SortButton({ field, label, currentField, direction, onClick }: any) {
    const isActive = currentField === field;
    return (
        <button
            onClick={() => onClick(field)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all uppercase ${isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black" : "hover:bg-slate-900 text-slate-400"
                }`}
        >
            {label}
            {isActive && (direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
        </button>
    );
}