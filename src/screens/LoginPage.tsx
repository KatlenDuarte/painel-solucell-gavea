import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import logo from "../assets/logo-solucelll.png";

interface LoginPageProps {
  onLoginSuccess?: (email: string) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      onLoginSuccess?.(user.email || "");
    } catch (err: any) {
      let message = "Erro ao tentar logar";

      if (err.code === "auth/invalid-credential") message = "E-mail ou senha inválidos";
      if (err.code === "auth/user-not-found") message = "Usuário não encontrado";
      if (err.code === "auth/wrong-password") message = "Senha incorreta";

      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-950 p-4 font-sans">
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Alternar tema"
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-50 transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm p-8 rounded-2xl border border-slate-800 bg-slate-900 shadow-xl"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <img src={logo} alt="Solucell" className="h-9 w-auto object-contain mb-5" />
          <h2 className="text-slate-50 text-xl font-semibold">Acesse o painel</h2>
          <p className="text-slate-500 text-sm mt-1">Entre com as credenciais da loja</p>
        </div>

        <div className="space-y-4 mb-6">
          <label className="block">
            <span className="block text-xs font-medium text-slate-400 mb-1.5">E-mail</span>
            <input
              type="email"
              placeholder="loja@solucell.com"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 text-slate-50 placeholder-slate-600 border border-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-400 mb-1.5">Senha</span>
            <input
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 text-slate-50 placeholder-slate-600 border border-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
            />
          </label>
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-sm shadow-emerald-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
