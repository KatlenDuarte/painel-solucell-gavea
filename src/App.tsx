import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BookOpenText, 
  Receipt, 
  Wrench, 
  BarChart3, 
  Settings, 
  X, 
  Menu, 
  Plus, 
  LogOut, 
  PenLine 
} from "lucide-react";

// Imports das telas
import Dashboard from "./screens/DashboardPage";
import Sales from "./screens/SalesPage";               // Admin
import Reports from "./screens/ReportsPage";
import ProductsContent from "./screens/ProductsPage";
import LoginPage from "./screens/LoginPage";
import Maintenance from "./screens/MaintenancePage";
import SettingsPage from "./screens/SettingsPage";
import FiadoPage from "./screens/FiadoPage";
import FechamentoPage from "./screens/FechamentoPage";
import SalesFuncionarioPage from "./screens/SalesFuncionarioPage";  // Funcionário

// Import do modal de nova venda
import NewSaleModal from "./components/NewSaleModal";

import { auth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import logo from "./assets/logo-solucelll.png";

interface UserInfo {
    email: string;
    role: string;
    storeEmail: string;
    permissions: string[];
}

// ==================== CONFIGURAÇÃO ====================
const VALID_STORES = [
    "kluivert@solucell.com",
    "funcionarios@solucell.com",
];

const STORE_MAPPING: Record<string, string> = {
    "kluivert@solucell.com": "kluivert@solucell.com",
    "funcionarios@solucell.com": "kluivert@solucell.com",
};

function App() {
    const [currentPage, setCurrentPage] = useState("sales");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState<UserInfo>({
        email: "",
        role: "",
        storeEmail: "",
        permissions: [],
    });

    // Estado para o modal de nova venda (corrigido para setIsNewSaleModalOpen)
    const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);

    // Garante que o tema claro fique ativo no HTML
    useEffect(() => {
        document.documentElement.classList.remove("dark");
    }, []);

    // Controla abertura automática baseado no tamanho da tela
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setSidebarOpen(true);
            } else {
                setSidebarOpen(false);
            }
        };
        window.addEventListener("resize", handleResize);
        handleResize();
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const handleNavigation = (pageId: string) => {
        if (currentUser.permissions.includes(pageId)) {
            setCurrentPage(pageId);
            if (window.innerWidth < 768) setSidebarOpen(false);
        }
    };

    // ==================== AUTENTICAÇÃO + PERMISSÕES ====================
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && VALID_STORES.includes(user.email || "")) {
                const storeEmail = STORE_MAPPING[user.email!] || user.email!;
                const isAdmin = user.email === "kluivert@solucell.com";

                const permissions = isAdmin
                    ? ["dashboard", "products", "sales", "fiado", "fechamento", "maintenance", "reports", "settings"]
                    : ["sales", "fiado", "fechamento", "maintenance", "settings"];

                setCurrentUser({
                    email: user.email || "",
                    storeEmail: storeEmail,
                    role: isAdmin ? "Administrador" : "Funcionário",
                    permissions,
                });
                setIsLoggedIn(true);

                if (!isAdmin) setCurrentPage("sales");
            } else {
                setIsLoggedIn(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = () => {
        auth.signOut();
        setIsLoggedIn(false);
    };

    const allNavigation = [
        { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
        { id: "products", name: "Produtos", icon: Package },
        { id: "sales", name: "Vendas", icon: ShoppingCart },
        { id: "fiado", name: "Fiado", icon: BookOpenText },
        { id: "fechamento", name: "Fechamento", icon: Receipt },
        { id: "maintenance", name: "Manutenção", icon: Wrench },
        { id: "reports", name: "Relatórios", icon: BarChart3 },
        { id: "settings", name: "Configurações", icon: Settings },
    ];

    const navigation = allNavigation.filter(item => currentUser.permissions.includes(item.id));

    const renderPage = () => {
        if (!isLoggedIn) return <LoginPage onLoginSuccess={() => {}} />;

        switch (currentPage) {
            case "dashboard": return <Dashboard storeEmail={currentUser.storeEmail} />;
            case "products": return <ProductsContent storeEmail={currentUser.storeEmail} />;
            case "sales":
                return currentUser.role === "Funcionário"
                    ? <SalesFuncionarioPage storeEmail={currentUser.storeEmail} />
                    : <Sales storeEmail={currentUser.storeEmail} />;
            case "fiado": return <FiadoPage storeEmail={currentUser.storeEmail} />;
            case "fechamento": return <FechamentoPage storeEmail={currentUser.storeEmail} />;
            case "maintenance": return <Maintenance storeEmail={currentUser.storeEmail} />;
            case "reports": return <Reports storeEmail={currentUser.storeEmail} />;
            case "settings": return <SettingsPage storeEmail={currentUser.storeEmail} />;
            default: return currentUser.role === "Funcionário"
                ? <SalesFuncionarioPage storeEmail={currentUser.storeEmail} />
                : <Sales storeEmail={currentUser.storeEmail} />;
        }
    };

    return (
        <div className="relative bg-[#F8FAFC] text-slate-700 flex w-full min-h-screen font-sans antialiased overflow-x-hidden">

            {/* DECORAÇÃO DE FUNDO LUMINOSA */}
            {isLoggedIn && (
                <div className="pointer-events-none fixed inset-x-0 top-0 h-[300px] overflow-hidden z-0">
                    <div className="absolute -top-20 left-[10%] w-[380px] h-[380px] rounded-full bg-emerald-400/15 blur-[120px]" />
                    <div className="absolute -top-24 right-[10%] w-[320px] h-[320px] rounded-full bg-sky-400/15 blur-[120px]" />
                </div>
            )}

            {/* OVERLAY MOBILE */}
            {isLoggedIn && sidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* SIDEBAR LATERAL (TEMA CLARO) */}
            {isLoggedIn && (
                <aside className={`fixed top-0 left-0 bottom-0 w-64 bg-white/95 backdrop-blur-md border-r border-slate-200/80 transition-all duration-300 ease-in-out overflow-y-auto flex flex-col z-50
                    ${sidebarOpen ? "translate-x-0 shadow-xl md:shadow-none" : "-translate-x-full md:translate-x-0"}`}>

                    {/* Logo & Header */}
                    <div className="p-6 flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <img src={logo} className="w-32 h-auto object-contain" alt="Logo Solucell" />
                            <span className="text-[10px] tracking-widest uppercase font-bold text-slate-400 mt-1 pl-0.5">
                                SISTEMA INTERNO
                            </span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 md:hidden transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navegação */}
                    <div className="flex-1 px-4 py-2">
                        <nav className="space-y-1">
                            {navigation.map((item) => {
                                const Icon = item.icon;
                                const active = currentPage === item.id;
                                return (
                                    <div key={item.id}>
                                        <button
                                            onClick={() => handleNavigation(item.id)}
                                            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 group ${
                                                active
                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs"
                                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                                            }`}
                                        >
                                            <Icon className={`w-4 h-4 transition-transform duration-200 ${
                                                active ? "scale-110 text-emerald-600" : "text-slate-400 group-hover:text-slate-600 group-hover:scale-105"
                                            }`} />
                                            <span>{item.name}</span>
                                        </button>

                                        {/* Atalho Registrar Venda */}
                                        {item.id === "sales" && (
                                            <button
                                                onClick={() => setIsNewSaleModalOpen(true)}
                                                className="w-full flex items-center gap-3 px-4 py-2 ml-3 mt-1 rounded-xl text-xs font-semibold text-slate-500 hover:text-emerald-700 hover:bg-emerald-50/60 transition-all duration-200 group"
                                            >
                                                <PenLine className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:scale-105" />
                                                <span>Registrar Venda</span>
                                                <span className="ml-auto bg-emerald-100 text-emerald-700 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">
                                                    Novo
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Perfil & Logout */}
                    <div className="p-4 m-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs">
                        <div className="mb-3 px-1">
                            <p className="text-slate-800 font-bold text-xs truncate" title={currentUser.email}>
                                {currentUser.email.split('@')[0]}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                                {currentUser.role}
                            </p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-xl text-xs font-bold transition-all duration-200 border border-rose-200/80 hover:border-transparent"
                        >
                            <LogOut className="w-3.5 h-3.5" /> Sair do Sistema
                        </button>
                    </div>
                </aside>
            )}

            {/* ÁREA PRINCIPAL */}
            <main className={`relative z-10 flex-1 flex flex-col min-h-screen w-full transition-all duration-300 ${isLoggedIn ? "md:pl-64" : ""}`}>
                {isLoggedIn && (
                    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-30 h-16 shadow-2xs">

                        {/* Botão Menu Mobile */}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors md:hidden"
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        {/* Título */}
                        <div className="flex-1 md:flex-none pl-3 md:pl-0">
                            <span className="text-sm font-bold tracking-wide uppercase text-slate-800">
                                {navigation.find(item => item.id === currentPage)?.name || "Painel"}
                            </span>
                        </div>

                        {/* Botão Nova Operação */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsNewSaleModalOpen(true)}
                                className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all active:scale-[0.97] shadow-sm shadow-emerald-600/30"
                            >
                                <Plus size={16} strokeWidth={2.5} />
                                Nova Operação
                            </button>
                        </div>
                    </header>
                )}

                {/* Conteúdo das Páginas */}
                <div className="flex-1 p-4 md:p-8 w-full max-w-full overflow-x-hidden">
                    {renderPage()}
                </div>
            </main>

            {/* MODAL DE NOVA VENDA */}
            {isLoggedIn && isNewSaleModalOpen && (
                <NewSaleModal
                    onClose={() => setIsNewSaleModalOpen(false)}
                    storeEmail={currentUser.storeEmail}
                    onSaleComplete={() => {
                        setIsNewSaleModalOpen(false); // Fecha o modal ao concluir a venda
                        setCurrentPage(currentPage);
                    }}
                />
            )}
        </div>
    );
}

export default App;