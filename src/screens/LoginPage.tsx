import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";

interface LoginPageProps {
  onLoginSuccess?: (email: string) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
      <form
        onSubmit={handleSubmit}
        className="p-10 rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl shadow-2xl w-96 text-center"
      >
        <h2 className="text-white text-3xl font-bold mb-6">
          Acesso ao Sistema 🔑
        </h2>

        <div className="space-y-4 mb-6">
          <input
            type="email"
            placeholder="Email da loja"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-3 rounded-lg bg-slate-800 text-white border border-slate-700 focus:ring-emerald-500"
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-3 rounded-lg bg-slate-800 text-white border border-slate-700 focus:ring-emerald-500"
          />
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-lg transition disabled:opacity-50"
        >
          {isLoading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
