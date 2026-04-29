import { useState, useEffect } from "react";
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    BarChart3,
    Settings,
    LogOut,
    Menu,
    X,
    Sun,
    Wrench,
    BookOpenText,
    Receipt,
} from "lucide-react";

// Imports das telas
import Dashboard from "./screens/DashboardPage";
import Sales from "./screens/SalesPage";                    // Admin
import Reports from "./screens/ReportsPage";
import ProductsContent from "./screens/ProductsPage";
import LoginPage from "./screens/LoginPage";
import Maintenance from "./screens/MaintenancePage";
import SettingsPage from "./screens/SettingsPage";
import FiadoPage from "./screens/FiadoPage";
import FechamentoPage from "./screens/FechamentoPage";
import SalesFuncionarioPage from "./screens/SalesFuncionarioPage";  // Funcionário

import { auth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import logo from "./assets/logo-solucell.png";

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
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState<UserInfo>({
        email: "",
        role: "",
        storeEmail: "",
        permissions: [],
    });

    useEffect(() => {
        document.documentElement.classList.add("dark");
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
                    : ["sales", "fiado", "fechamento", "maintenance", "settings"];   // ← Adicionado Manutenção

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

    const toggleTheme = () => document.documentElement.classList.toggle("dark");

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
        if (!isLoggedIn) return <LoginPage auth={auth} onLoginSuccess={() => {}} />;

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
            default: return <SalesFuncionarioPage storeEmail={currentUser.storeEmail} />;
        }
    };

    return (
        <div className="bg-slate-100 dark:bg-slate-950 flex w-full min-h-screen">
            {isLoggedIn && (
                <aside className={`bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800 transition-transform duration-300 overflow-y-auto flex flex-col h-full z-50
                    md:w-64 md:fixed md:translate-x-0 w-64 fixed top-0 left-0
                    ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                    
                    <div className="p-6">
                        <img src={logo} className="w-40 h-auto" alt="Logo Solucell" />
                        <p className="text-slate-700 dark:text-slate-400 text-xs mt-4">Painel Solucell</p>
                    </div>

                    <div className="flex-1 px-6">
                        <nav className="space-y-2 pb-6">
                            {navigation.map((item) => {
                                const Icon = item.icon;
                                const active = currentPage === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleNavigation(item.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                                            active
                                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                                : "text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        }`}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span>{item.name}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="p-6 border-t border-slate-300 dark:border-slate-800">
                        <div className="mb-4">
                            <p className="text-slate-900 dark:text-white font-medium text-sm">{currentUser.email}</p>
                            <p className="text-slate-600 dark:text-slate-400 text-xs">{currentUser.role}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
                        >
                            <LogOut className="w-4 h-4" /> Sair
                        </button>
                    </div>
                </aside>
            )}

            <main className={`flex-1 flex flex-col min-h-screen transition-all w-full ${isLoggedIn ? "md:ml-64" : ""}`}>
                {isLoggedIn && (
                    <header className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="text-slate-700 dark:text-slate-400 md:hidden"
                        >
                            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>

                        <div className="flex items-center gap-4">
                            <span className="md:hidden text-lg font-semibold text-slate-800 dark:text-white">
                                {navigation.find(item => item.id === currentPage)?.name || "Vendas"}
                            </span>
                            <button onClick={toggleTheme} className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800">
                                <Sun className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                            </button>
                        </div>
                    </header>
                )}
                <div className="flex-1">{renderPage()}</div>
            </main>
        </div>
    );
}

export default App;