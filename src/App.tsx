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
    Sun,
    Moon,
    type LucideIcon,
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
import { StoreDataProvider } from "./contexts/StoreDataContext";
import { useTheme } from "./contexts/ThemeContext";
import logo from "./assets/logo-solucelll.png";

interface UserInfo {
    email: string;
    role: string;
    storeEmail: string;
    permissions: string[];
}

interface NavItem {
    id: string;
    name: string;
    icon: LucideIcon;
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

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
    {
        title: "Operação",
        items: [
            { id: "sales", name: "Vendas", icon: ShoppingCart },
            { id: "fiado", name: "Fiado", icon: BookOpenText },
            { id: "fechamento", name: "Fechamento", icon: Receipt },
            { id: "maintenance", name: "Manutenção", icon: Wrench },
        ],
    },
    {
        title: "Gestão",
        items: [
            { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
            { id: "products", name: "Produtos", icon: Package },
            { id: "reports", name: "Relatórios", icon: BarChart3 },
        ],
    },
    {
        title: "Sistema",
        items: [
            { id: "settings", name: "Configurações", icon: Settings },
        ],
    },
];

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap(section => section.items);

function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === "dark";
    return (
        <button
            onClick={toggleTheme}
            title={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
            aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-50 hover:border-slate-700 transition-colors"
        >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
    );
}

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

    const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);

    // Controla abertura automática baseado no tamanho da tela
    useEffect(() => {
        const handleResize = () => setSidebarOpen(window.innerWidth >= 1024);
        window.addEventListener("resize", handleResize);
        handleResize();
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const handleNavigation = (pageId: string) => {
        if (currentUser.permissions.includes(pageId)) {
            setCurrentPage(pageId);
            if (window.innerWidth < 1024) setSidebarOpen(false);
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

    const navSections = NAV_SECTIONS
        .map(section => ({ ...section, items: section.items.filter(item => currentUser.permissions.includes(item.id)) }))
        .filter(section => section.items.length > 0);

    const currentNav = ALL_NAV_ITEMS.find(item => item.id === currentPage);
    const userName = currentUser.email.split("@")[0];
    const todayRaw = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

    const renderPage = () => {
        switch (currentPage) {
            case "dashboard": return <Dashboard />;
            case "products": return <ProductsContent />;
            case "sales":
                return currentUser.role === "Funcionário"
                    ? <SalesFuncionarioPage storeEmail={currentUser.storeEmail} />
                    : <Sales storeEmail={currentUser.storeEmail} />;
            case "fiado": return <FiadoPage />;
            case "fechamento": return <FechamentoPage storeEmail={currentUser.storeEmail} />;
            case "maintenance": return <Maintenance storeEmail={currentUser.storeEmail} />;
            case "reports": return <Reports storeEmail={currentUser.storeEmail} />;
            case "settings": return <SettingsPage storeEmail={currentUser.storeEmail} />;
            default: return currentUser.role === "Funcionário"
                ? <SalesFuncionarioPage storeEmail={currentUser.storeEmail} />
                : <Sales storeEmail={currentUser.storeEmail} />;
        }
    };

    if (!isLoggedIn) return <LoginPage onLoginSuccess={() => {}} />;

    return (
        <StoreDataProvider storeEmail={currentUser.storeEmail}>
            <div className="relative flex w-full min-h-screen bg-slate-950 text-slate-300 font-sans antialiased overflow-x-hidden">

                {/* OVERLAY MOBILE */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* SIDEBAR */}
                <aside className={`fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-50 transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? "translate-x-0 shadow-2xl lg:shadow-none" : "-translate-x-full lg:translate-x-0"}`}>

                    {/* Marca */}
                    <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-3">
                            <img src={logo} className="h-7 w-auto object-contain" alt="Logo Solucell" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-l border-slate-800 pl-3">
                                Gávea
                            </span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-50 hover:bg-slate-800 lg:hidden transition-colors"
                            aria-label="Fechar menu"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navegação */}
                    <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
                        {navSections.map(section => (
                            <div key={section.title}>
                                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    {section.title}
                                </p>
                                <div className="space-y-0.5">
                                    {section.items.map(item => {
                                        const Icon = item.icon;
                                        const active = currentPage === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => handleNavigation(item.id)}
                                                aria-current={active ? "page" : undefined}
                                                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors group ${active
                                                    ? "bg-emerald-500/10 text-emerald-400"
                                                    : "text-slate-400 hover:text-slate-50 hover:bg-slate-800/60"
                                                    }`}
                                            >
                                                {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-emerald-500" />}
                                                <Icon className={`w-[18px] h-[18px] ${active ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                                                <span>{item.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </nav>

                    {/* Perfil & Logout */}
                    <div className="p-3 border-t border-slate-800 shrink-0">
                        <div className="flex items-center gap-3 p-2 rounded-xl">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-sm font-bold uppercase shrink-0">
                                {userName.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-50 truncate capitalize" title={currentUser.email}>
                                    {userName}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">{currentUser.role}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                title="Sair do sistema"
                                aria-label="Sair do sistema"
                                className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </aside>

                {/* ÁREA PRINCIPAL */}
                <main className="relative flex-1 flex flex-col min-h-screen w-full min-w-0 lg:pl-64">
                    <header className="sticky top-0 z-30 h-16 shrink-0 flex items-center gap-3 px-4 md:px-8 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-slate-50 hover:bg-slate-800 transition-colors lg:hidden"
                            aria-label="Abrir menu"
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        <div className="flex-1 min-w-0">
                            <h1 className="text-[15px] font-semibold text-slate-50 leading-tight truncate">
                                {currentNav?.name || "Painel"}
                            </h1>
                            <p className="hidden sm:block text-xs text-slate-500 truncate">{today}</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <ThemeToggle />
                            <button
                                onClick={() => setIsNewSaleModalOpen(true)}
                                className="flex items-center gap-1.5 h-9 px-3 sm:px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs transition-colors active:scale-[0.98] shadow-sm shadow-emerald-600/20"
                            >
                                <Plus size={16} strokeWidth={2.5} />
                                <span className="hidden sm:inline">Nova operação</span>
                            </button>
                        </div>
                    </header>

                    {/* Conteúdo das Páginas */}
                    <div className="flex-1 w-full max-w-full overflow-x-hidden">
                        {renderPage()}
                    </div>
                </main>

                {/* MODAL DE NOVA VENDA */}
                {isNewSaleModalOpen && (
                    <NewSaleModal
                        onClose={() => setIsNewSaleModalOpen(false)}
                        storeEmail={currentUser.storeEmail}
                        onSaleComplete={() => setIsNewSaleModalOpen(false)}
                    />
                )}
            </div>
        </StoreDataProvider>
    );
}

export default App;
