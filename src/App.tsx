import { useState, useEffect } from "react";
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    BarChart3,
    Settings,
    LogOut,
    Menu, // Ícone Sanduíche
    X,    // Ícone Fechar
    Sun,
    Wrench,
} from "lucide-react";

// Importações dos componentes de tela e segurança
import Dashboard from "./screens/DashboardPage";
import ProtectedRoute from "./components/ProtectedRoute"; // Componente de validação de PIN
import Sales from "./screens/SalesPage";
import Reports from "./screens/ReportsPage";
import ProductsContent from "./screens/ProductsPage";
import LoginPage from "./screens/LoginPage";
import Maintenance from "./screens/MaintenancePage";
import SettingsPage from "./screens/SettingsPage";

import { auth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import logo from "./assets/logo-solucell.png";

// --- Tipagens ---

interface UserInfo {
    email: string;
    role: string;
}

interface ProtectedPageProps {
    storeEmail: string;
}

// --- Constantes e Helpers ---

const VALID_STORES = [
    "vilaesportiva@solucell.com",
    "jardimdagloria@solucell.com",
];

// Função auxiliar para inicializar o PIN (com persistência)
const getInitialPin = () => {
    return localStorage.getItem("app_security_pin") || "9838";
};

// Função para obter o estado inicial de desbloqueio do localStorage
const getInitialUnlockedState = (pageId: string) => {
    return localStorage.getItem(`unlocked_${pageId}`) === 'true';
};

// --- Componente Principal ---

function App() {
    const [currentPage, setCurrentPage] = useState("dashboard");
    // Inicializa a sidebar aberta se for desktop (>= 768px), senão fechada (para mobile/tablet)
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState<UserInfo>({
        email: "",
        role: "",
    });

    const [productPin, setProductPin] = useState(getInitialPin);

    // Inicialização dos estados de desbloqueio lendo o localStorage (persistência)
    const [isProductsUnlocked, setProductsUnlocked] = useState(() => getInitialUnlockedState("products"));
    const [isSalesUnlocked, setSalesUnlocked] = useState(() => getInitialUnlockedState("sales"));
    const [isMaintenanceUnlocked, setMaintenanceUnlocked] = useState(() => getInitialUnlockedState("maintenance"));
    const [isReportsUnlocked, setReportsUnlocked] = useState(() => getInitialUnlockedState("reports"));
    const [isSettingsUnlocked, setSettingsUnlocked] = useState(() => getInitialUnlockedState("settings"));

    // Função de utilidade para atualizar o estado e o localStorage
    const updateUnlockedState = (pageId: string, isUnlocked: boolean, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
        setter(isUnlocked);
        if (isUnlocked) {
            localStorage.setItem(`unlocked_${pageId}`, 'true');
        } else {
            // Mantém o estado como 'false' no localStorage para ser lido no próximo reload
            localStorage.setItem(`unlocked_${pageId}`, 'false');
        }
    };


    // Efeito para aplicar o tema escuro e ajustar a sidebar no redimensionamento
    useEffect(() => {
        // Aplica o tema escuro
        document.documentElement.classList.add("dark");

        const handleResize = () => {
            // Força a sidebar aberta se a tela for maior que 768px (desktop)
            if (window.innerWidth >= 768) {
                setSidebarOpen(true);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Controla navegação, bloqueia as páginas e fecha sidebar se for mobile
    const handleNavigation = (pageId: string) => {
        setCurrentPage(pageId);

        // Bloqueia as páginas protegidas ao sair delas
        if (pageId !== "products") updateUnlockedState("products", false, setProductsUnlocked);
        if (pageId !== "sales") updateUnlockedState("sales", false, setSalesUnlocked);
        if (pageId !== "maintenance") updateUnlockedState("maintenance", false, setMaintenanceUnlocked);
        if (pageId !== "reports") updateUnlockedState("reports", false, setReportsUnlocked);
        if (pageId !== "settings") updateUnlockedState("settings", false, setSettingsUnlocked);

        // Fecha a sidebar no mobile/tablet (abaixo de 768px)
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    };

    // Mantém usuário logado via Firebase
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && VALID_STORES.includes(user.email || "")) {
                setCurrentUser({
                    email: user.email || "",
                    role: "Administrador",
                });
                setIsLoggedIn(true);
            } else {
                setIsLoggedIn(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const toggleTheme = () =>
        document.documentElement.classList.toggle("dark");

    const handleLogout = () => {
        auth.signOut();
        setCurrentUser({ email: "", role: "" });
        setIsLoggedIn(false);
        setCurrentPage("dashboard");

        // Limpar todos os marcadores de desbloqueio no logout (Boa Prática de Segurança)
        ['products', 'sales', 'maintenance', 'reports', 'settings'].forEach(id => {
            localStorage.removeItem(`unlocked_${id}`);
        });
        setProductsUnlocked(false);
        setSalesUnlocked(false);
        setMaintenanceUnlocked(false);
        setReportsUnlocked(false);
        setSettingsUnlocked(false);
    };

    const handleLoginSuccess = (storeEmail: string) => {
        setCurrentUser({
            email: storeEmail,
            role: "Administrador",
        });
        setIsLoggedIn(true);
    };

    const navigation = [
        { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
        { id: "products", name: "Produtos", icon: Package },
        { id: "sales", name: "Vendas", icon: ShoppingCart },
        { id: "maintenance", name: "Manutenção", icon: Wrench },
        { id: "reports", name: "Relatórios", icon: BarChart3 },
        { id: "settings", name: "Configurações", icon: Settings },
    ];

    // Função de utilidade para envolver a página com a proteção de PIN
    const wrapWithProtection = (
        PageComponent: React.FC<ProtectedPageProps>,
        isUnlocked: boolean,
        setUnlocked: React.Dispatch<React.SetStateAction<boolean>>,
        pageId: string
    ) => (
        <ProtectedRoute
            isUnlocked={isUnlocked}
            // Função que atualiza o estado local E o localStorage
            setUnlocked={(isUnl) => updateUnlockedState(pageId, isUnl, setUnlocked)}
            requiredPin={productPin}
        >
            <PageComponent storeEmail={currentUser.email} />
        </ProtectedRoute>
    );

    const renderPage = () => {
        if (!isLoggedIn)
            return <LoginPage auth={auth} onLoginSuccess={handleLoginSuccess} />;

        switch (currentPage) {
            case "dashboard":
                return <Dashboard storeEmail={currentUser.email} />;

            case "products":
                return wrapWithProtection(
                    ProductsContent as React.FC<ProtectedPageProps>,
                    isProductsUnlocked,
                    setProductsUnlocked,
                    "products"
                );

            case "sales":
                return wrapWithProtection(
                    Sales as React.FC<ProtectedPageProps>,
                    isSalesUnlocked,
                    setSalesUnlocked,
                    "sales"
                );

            case "maintenance":
                return wrapWithProtection(
                    Maintenance as React.FC<ProtectedPageProps>,
                    isMaintenanceUnlocked,
                    setMaintenanceUnlocked,
                    "maintenance"
                );

            case "reports":
                return wrapWithProtection(
                    Reports as React.FC<ProtectedPageProps>,
                    isReportsUnlocked,
                    setReportsUnlocked,
                    "reports"
                );

            case "settings":
                // Página Settings (passando props extras para gestão do PIN)
                return (
                    <ProtectedRoute
                        isUnlocked={isSettingsUnlocked}
                        setUnlocked={(isUnl) => updateUnlockedState("settings", isUnl, setSettingsUnlocked)}
                        requiredPin={productPin}
                    >
                        <SettingsPage
                            currentPin={productPin}
                            onPinChange={setProductPin}
                            storeEmail={currentUser.email}
                        />
                    </ProtectedRoute>
                );

            default:
                return <Dashboard storeEmail={currentUser.email} />;
        }
    };

    return (
        <div className="bg-slate-100 dark:bg-slate-950 flex w-full min-h-screen">
            {isLoggedIn && (
                <>
                    {/* 📱 Overlay Mobile/Tablet: aparece quando a sidebar está aberta em telas pequenas */}
                    {sidebarOpen && window.innerWidth < 768 && (
                        <div
                            className="fixed inset-0 bg-black/50 z-40 md:hidden"
                            onClick={() => setSidebarOpen(false)} // Fecha ao clicar fora
                        ></div>
                    )}

                    {/* Sidebar */}
                    <aside
                        className={`
                            bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800 
                            transition-transform duration-300 overflow-y-auto flex flex-col h-full z-50
                            
                            // 🖥️ Desktop (md e acima): Fica estática e visível.
                            md:w-64 md:fixed md:translate-x-0
                            
                            // 📱 Mobile/Tablet (abaixo de md): Fica fixa, mas é controlada pelo JS.
                            w-64 fixed top-0 left-0
                            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} // Lógica do Toggle
                        `}
                    >
                        {/* Conteúdo da Sidebar */}
                        <div className="p-6">
                            <img src={logo} className="w-40 h-auto" alt="Logo Solucell" />
                            <p className="text-slate-700 dark:text-slate-400 text-xs mt-4">
                                Painel Solucell
                            </p>
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
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active
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

                        <div
                            className={`p-6 border-t border-slate-300 dark:border-slate-800`}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div>
                                    <p className="text-slate-900 dark:text-white font-medium text-sm">
                                        {currentUser.email}
                                    </p>
                                    <p className="text-slate-600 dark:text-slate-400 text-xs">
                                        {currentUser.role}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
                            >
                                <LogOut className="w-4 h-4" /> Sair
                            </button>
                        </div>
                    </aside>
                </>
            )}

            {/* Conteúdo Principal (Main) */}
            <main
                className={`flex-1 flex flex-col min-h-screen transition-all w-full
                    // Desktop (md e acima): Adiciona margem à esquerda para dar espaço à sidebar visível
                    md:ml-64
                `}
            >
                {isLoggedIn && (
                    <header className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40">

                        {/* Botão de Toggle da Sidebar (visível apenas no mobile/tablet: md:hidden) */}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="text-slate-700 dark:text-slate-400 md:hidden"
                        >
                            {sidebarOpen ? (
                                <X className="w-6 h-6" /> // Ícone X para fechar
                            ) : (
                                <Menu className="w-6 h-6" /> // Ícone Sanduíche para abrir
                            )}
                        </button>

                        <div className="flex items-center gap-4">
                            {/* Título da Página Atual (Visível apenas no Mobile/Tablet) */}
                            <span className="md:hidden text-lg font-semibold text-slate-800 dark:text-white">
                                {navigation.find(item => item.id === currentPage)?.name || 'Painel'}
                            </span>

                            <button
                                onClick={toggleTheme}
                                className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800"
                            >
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