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
    ChevronRight,
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
            className="flex items-center justify-center w-9 h-9 rounded-lg text-fg-subtle hover:text-fg hover:bg-hover transition-colors"
        >
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
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
    const currentSection = NAV_SECTIONS.find(section => section.items.some(item => item.id === currentPage))?.title || "Painel";
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
            <div className="relative flex w-full min-h-screen bg-bg text-fg-muted font-sans antialiased overflow-x-hidden">

                {/* OVERLAY MOBILE */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* SIDEBAR */}
                <aside className={`fixed inset-y-0 left-0 w-[248px] bg-surface border-r border-line flex flex-col z-50 transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? "translate-x-0 shadow-2xl lg:shadow-none" : "-translate-x-full lg:translate-x-0"}`}>

                    {/* Marca */}
                    <div className="h-16 px-4 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <img src={logo} className="h-7 w-auto object-contain" alt="Solucell" />
                            <span className="rounded-md bg-subtle border border-line px-1.5 py-0.5 text-[11px] font-medium text-fg-subtle">
                                Gávea
                            </span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-1.5 rounded-lg text-fg-subtle hover:text-fg hover:bg-hover lg:hidden transition-colors"
                            aria-label="Fechar menu"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Ação principal */}
                    <div className="px-3 pb-2">
                        <button
                            onClick={() => { setIsNewSaleModalOpen(true); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                            className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors shadow-[var(--ui-shadow)]"
                        >
                            <Plus className="w-4 h-4" strokeWidth={2.5} />
                            Nova operação
                        </button>
                    </div>

                    {/* Navegação */}
                    <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
                        {navSections.map(section => (
                            <div key={section.title}>
                                <p className="px-2.5 mb-1 text-[11px] font-medium text-fg-faint">
                                    {section.title}
                                </p>
                                <div className="space-y-px">
                                    {section.items.map(item => {
                                        const Icon = item.icon;
                                        const active = currentPage === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => handleNavigation(item.id)}
                                                aria-current={active ? "page" : undefined}
                                                className={`w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-sm transition-colors ${active
                                                    ? "bg-hover text-fg font-medium"
                                                    : "text-fg-subtle hover:text-fg hover:bg-hover/70"
                                                    }`}
                                            >
                                                <Icon className={`w-[18px] h-[18px] ${active ? "text-primary" : ""}`} strokeWidth={active ? 2.2 : 1.8} />
                                                <span>{item.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </nav>

                    {/* Perfil & Logout */}
                    <div className="p-3 border-t border-line shrink-0">
                        <div className="flex items-center gap-2.5 p-1.5">
                            <div className="w-8 h-8 rounded-full bg-primary-soft text-primary-text flex items-center justify-center text-sm font-semibold uppercase shrink-0">
                                {userName.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-fg truncate capitalize" title={currentUser.email}>
                                    {userName}
                                </p>
                                <p className="text-xs text-fg-subtle truncate">{currentUser.role}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                title="Sair do sistema"
                                aria-label="Sair do sistema"
                                className="p-2 rounded-lg text-fg-subtle hover:text-danger hover:bg-danger-soft transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </aside>

                {/* ÁREA PRINCIPAL */}
                <main className="relative flex-1 flex flex-col min-h-screen w-full min-w-0 lg:pl-[248px]">
                    <header className="sticky top-0 z-30 h-14 shrink-0 flex items-center gap-3 px-4 md:px-8 bg-bg/85 backdrop-blur-md border-b border-line">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 -ml-2 rounded-lg text-fg-subtle hover:text-fg hover:bg-hover transition-colors lg:hidden"
                            aria-label="Abrir menu"
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        <nav className="flex-1 min-w-0 flex items-center gap-1.5 text-sm" aria-label="Você está em">
                            <span className="hidden sm:inline text-fg-subtle">{currentSection}</span>
                            <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-fg-faint" />
                            <span className="font-medium text-fg truncate">{currentNav?.name || "Painel"}</span>
                        </nav>

                        <div className="flex items-center gap-1">
                            <span className="hidden md:inline text-xs text-fg-subtle mr-2">{today}</span>
                            <ThemeToggle />
                            <button
                                onClick={() => setIsNewSaleModalOpen(true)}
                                className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-white"
                                aria-label="Nova operação"
                            >
                                <Plus size={18} strokeWidth={2.5} />
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
