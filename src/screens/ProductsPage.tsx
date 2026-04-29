import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Plus, Search, Smartphone, Shield, Cable, Headphones, 
    Edit, Trash2, Package, TriangleAlert, FileText, 
    ArrowUp, ArrowDown
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { fetchProducts, deleteProduct, updateProduct } from "../services/productsService";

import AddProductModal from "../components/AddProductModal";
import EditStockModal from "../components/EditStockModal";

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
}

type SortField = "name" | "stock" | "price";
type SortDirection = "asc" | "desc";

export default function ProductsContent() {
    const auth = getAuth();

    const [userEmail, setUserEmail] = useState<string | null>(null);
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

    const STORE_MAPPING: Record<string, string> = {
        "kluivert@solucell.com": "kluivert@solucell.com",
        "funcionarios@solucell.com": "kluivert@solucell.com",
    };

    // Função para determinar status visual com base no estoque
    const determineStatus = (stock: number, minStock: number) => {
        if (stock <= 0) return "critical";
        if (stock <= minStock) return "low";
        return "ok";
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                const realStore = STORE_MAPPING[user.email!] || user.email!;
                setUserEmail(user.email);
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

// ✅ CORREÇÃO DEFINITIVA: Atualiza o banco E o estado local instantaneamente
const handleUpdateProduct = async (
    productId: string,
    newStock: number,
    operation: string,
    newName: string,
    newPrice: number,
    newMinStock: number
) => {
    try {
        // 1. Envia para o Firebase
        await updateProduct(productId, {
            name: newName,
            price: newPrice,
            stock: newStock,
            minStock: newMinStock
        });

        // 2. ATUALIZAÇÃO LOCAL (O "Pulo do Gato"): 
        // Em vez de só esperar o banco, mudamos o estado 'products' manualmente
        setProducts(prevProducts => 
            prevProducts.map(p => 
                p.id === productId 
                    ? { 
                        ...p, 
                        name: newName, 
                        price: newPrice, 
                        stock: newStock, 
                        minStock: newMinStock,
                        // Recalcula o status na hora para a cor mudar (verde/amarelo/vermelho)
                        status: determineStatus(newStock, newMinStock) 
                      } 
                    : p
            )
        );

        // 3. Fecha os modais
        setIsEditStockModalOpen(false);
        setSelectedProduct(null);

        // 4. (Opcional) Recarrega do banco apenas para garantir sincronia total
        await loadProducts(); 

    } catch (err) {
        console.error("Erro ao atualizar produto:", err);
        alert("Erro ao salvar alterações no banco de dados.");
    }
};

    useEffect(() => {
        if (effectiveStoreEmail) loadProducts();
    }, [effectiveStoreEmail, loadProducts]);

    const filteredProducts = useMemo(() => {
        let result = products.filter(p => {
            const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
            const matchesSearch = 
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.model.toLowerCase().includes(searchTerm.toLowerCase());
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

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection(field === "name" ? "asc" : "desc");
        }
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("SOLUCELL - Relatório de Estoque", 14, 20);
        autoTable(doc, {
            startY: 35,
            head: [["Produto", "Marca/Modelo", "Estoque", "Mínimo", "Preço", "Status"]],
            body: filteredProducts.map(p => [
                p.name, 
                `${p.brand} ${p.model}`, 
                `${p.stock} un`, 
                `${p.minStock} un`,
                `R$ ${p.price.toFixed(2)}`, 
                p.status.toUpperCase()
            ]),
            headStyles: { fillColor: [16, 185, 129] }
        });
        doc.save("estoque-solucell.pdf");
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-10 space-y-8">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">Inventário</h1>
                    <p className="text-slate-500">Gestão completa de produtos</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={exportPDF} className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-sm font-medium">
                        <FileText size={18} /> Exportar PDF
                    </button>
                    <button onClick={() => setIsAddProductModalOpen(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-bold text-black">
                        <Plus size={20} /> Novo Produto
                    </button>
                </div>
            </div>

            {/* FILTROS */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por nome, marca ou modelo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-12 py-3 text-sm focus:border-emerald-500 outline-none"
                        />
                    </div>
                    <button onClick={() => setIsReplenishmentMode(!isReplenishmentMode)} className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all ${isReplenishmentMode ? "bg-red-600 text-white" : "bg-slate-800 hover:bg-slate-700"}`}>
                        <TriangleAlert size={18} />
                        {isReplenishmentMode ? "Ver Todos" : "Somente Reposição"}
                    </button>
                </div>

                <div className="flex flex-wrap gap-2">
                    <CategoryBtn active={selectedCategory === "all"} onClick={() => setSelectedCategory("all")} icon={<Package size={16}/>} label="Todos" />
                    <CategoryBtn active={selectedCategory === "peliculas"} onClick={() => setSelectedCategory("peliculas")} icon={<Shield size={16}/>} label="Películas" />
                    <CategoryBtn active={selectedCategory === "cases"} onClick={() => setSelectedCategory("cases")} icon={<Smartphone size={16}/>} label="Cases" />
                    <CategoryBtn active={selectedCategory === "cabos"} onClick={() => setSelectedCategory("cabos")} icon={<Cable size={16}/>} label="Cabos" />
                    <CategoryBtn active={selectedCategory === "acessorios"} onClick={() => setSelectedCategory("acessorios")} icon={<Headphones size={16}/>} label="Acessórios" />
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
                    <span className="text-xs uppercase font-bold text-slate-500 tracking-widest">Ordenar por:</span>
                    <div className="flex gap-2 flex-wrap">
                        <SortButton field="stock" label="Estoque" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                        <SortButton field="price" label="Preço" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                        <SortButton field="name" label="Nome" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                    </div>
                </div>
            </div>

            {/* TABELA */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[800px]">
                    <thead>
                        <tr className="bg-slate-950 text-xs uppercase font-bold text-slate-400 border-b border-slate-800">
                            <th className="px-8 py-5 text-left">Produto</th>
                            <th className="px-8 py-5 text-left">Marca / Modelo</th>
                            <th className="px-8 py-5 text-center">Mínimo</th>
                            <th className="px-8 py-5 text-center">Estoque</th>
                            <th className="px-8 py-5 text-right">Preço</th>
                            <th className="px-8 py-5 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {filteredProducts.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-800/70 transition-colors group">
                                <td className="px-8 py-5 font-medium">{p.name}</td>
                                <td className="px-8 py-5 text-slate-400">{p.brand} • {p.model}</td>
                                <td className="px-8 py-5 text-center text-slate-500 font-medium">{p.minStock}</td>
                                <td className="px-8 py-5 text-center">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        p.status === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                                        p.status === 'low' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
                                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    }`}>
                                        {p.stock} un
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-right font-bold text-emerald-400">
                                    R$ {p.price.toFixed(2)}
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                        <button onClick={() => { setSelectedProduct(p); setIsEditStockModalOpen(true); }} className="p-3 hover:bg-emerald-500/10 rounded-2xl text-emerald-400">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => { if (window.confirm(`Excluir ${p.name}?`)) deleteProduct(p.id).then(loadProducts); }} className="p-3 hover:bg-red-500/10 rounded-2xl text-red-400">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAIS */}
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
        </div>
    );
}

function CategoryBtn({ active, onClick, icon, label }: any) {
    return (
        <button onClick={onClick} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all border ${active ? "bg-emerald-600 border-emerald-500 text-white" : "bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700"}`}>
            {icon} {label}
        </button>
    );
}

function SortButton({ field, label, currentField, direction, onClick }: any) {
    const isActive = currentField === field;
    return (
        <button onClick={() => onClick(field)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "hover:bg-slate-800 text-slate-400"}`}>
            {label}
            {isActive && (direction === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
        </button>
    );
}