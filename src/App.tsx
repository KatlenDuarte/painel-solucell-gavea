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
import Sales from "./screens/SalesPage";                  // Admin
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
    const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile inicia fechado por padrão
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

    // Controla abertura automática baseado no tamanho da tela inicial
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setSidebarOpen(true);
            } else {
                setSidebarOpen(false);
            }
        };
        window.addEventListener("resize", handleResize);
        handleResize(); // Executa ao montar
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
        <div className="bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 flex w-full min-h-screen font-sans antialiased">
            
            {/* OVERLAY MOBILE: Fecha o menu ao clicar fora dele */}
            {isLoggedIn && sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {isLoggedIn && (
                <aside className={`fixed top-0 left-0 bottom-0 w-64 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800/80 transition-all duration-300 ease-in-out overflow-y-auto flex flex-col z-50
                    ${sidebarOpen ? "translate-x-0 shadow-2xl md:shadow-none" : "-translate-x-full md:translate-x-0"}`}>
                    
                    {/* Brand / Logo Area */}
                    <div className="p-6 flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <img src={logo} className="w-32 h-auto object-contain brightness-100 dark:brightness-110" alt="Logo Solucell" />
                            <span className="text-[10px] tracking-widest uppercase font-bold text-slate-400 dark:text-slate-500 mt-1 pl-0.5">SISTEMA INTERNO</span>
                        </div>
                        {/* Botão X para fechar o menu no mobile */}
                        <button 
                            onClick={() => setSidebarOpen(false)}
                            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation Links */}
                    <div className="flex-1 px-4 py-2">
                        <nav className="space-y-1">
                            {navigation.map((item) => {
                                const Icon = item.icon;
                                const active = currentPage === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleNavigation(item.id)}
                                        className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 group ${
                                            active
                                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm"
                                                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/50"
                                        }`}
                                    >
                                        <Icon className={`w-4 h-4 transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-105 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"}`} />
                                        <span>{item.name}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* User Profile & Logout Box */}
                    <div className="p-4 m-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60">
                        <div className="mb-3.5 px-2">
                            <p className="text-slate-800 dark:text-slate-200 font-bold text-xs truncate" title={currentUser.email}>
                                {currentUser.email.split('@')[0]}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider mt-0.5">
                                {currentUser.role}
                            </p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-rose-500/10 hover:bg-rose-600 dark:hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white dark:hover:text-white rounded-xl text-xs font-bold transition-all duration-200 border border-rose-500/10"
                        >
                            <LogOut className="w-3.5 h-3.5" /> Sair do Sistema
                        </button>
                    </div>
                </aside>
            )}

            {/* Main Area */}
            <main className={`flex-1 flex flex-col min-h-screen w-full transition-all duration-300 ${isLoggedIn ? "md:pl-64" : ""}`}>
                {isLoggedIn && (
                    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-30 h-16">
                        
                        {/* Botão de Menu para Mobile */}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors md:hidden"
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        {/* Título Dinâmico Identificador no Mobile */}
                        <div className="flex-1 md:flex-none pl-3 md:pl-0">
                            <span className="text-sm font-bold tracking-wide uppercase text-slate-700 dark:text-slate-200">
                                {navigation.find(item => item.id === currentPage)?.name || "Painel"}
                            </span>
                        </div>

                        {/* Top Right Actions */}
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={toggleTheme} 
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors"
                            >
                                <Sun className="w-4 h-4" />
                            </button>
                        </div>
                    </header>
                )}
                
                {/* Content Container */}
                <div className="flex-1 p-4 md:p-8 w-full max-w-full overflow-x-hidden">
                    {renderPage()}
                </div>
            </main>
        </div>
    );
}

export default App;