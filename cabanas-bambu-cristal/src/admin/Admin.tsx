import {
  CalendarDays,
  Check,
  ExternalLink,
  Gift,
  HelpCircle,
  Home,
  Image as ImageIcon,
  Inbox,
  Loader2,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  Tag,
  Type,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useSite } from "../lib/SiteContext";
import { adminLogin, adminLogout, isFirebase, LOCAL_DEFAULT_PASSWORD, onAdminChange, saveContent, subscribeRequests } from "../lib/store";
import type { BookingRequest, SiteContent } from "../lib/types";
import { CabinsSection } from "./CabinsSection";
import { CalendarSection } from "./CalendarSection";
import { ContentLists, ExtrasSection, GallerySection } from "./ListsSections";
import { GeneralSection } from "./GeneralSection";
import { PricesSection } from "./PricesSection";
import { RequestsSection } from "./RequestsSection";
import { SettingsSection } from "./SettingsSection";

export type SetDraft = (fn: (d: SiteContent) => SiteContent) => void;

const TABS = [
  { id: "pedidos", label: "Pré-reservas", icon: Inbox },
  { id: "calendario", label: "Calendário", icon: CalendarDays },
  { id: "cabanas", label: "Cabanas", icon: Home },
  { id: "precos", label: "Preços especiais", icon: Tag },
  { id: "textos", label: "Textos e contato", icon: Type },
  { id: "adicionais", label: "Adicionais", icon: Gift },
  { id: "conteudo", label: "Experiências e FAQ", icon: Sparkles },
  { id: "galeria", label: "Galeria de fotos", icon: ImageIcon },
  { id: "config", label: "Configurações", icon: Settings },
] as const;
type TabId = (typeof TABS)[number]["id"];

// Abas que editam o rascunho do conteúdo (precisam do botão Salvar)
const DRAFT_TABS: TabId[] = ["cabanas", "precos", "textos", "adicionais", "conteudo", "galeria"];

export function AdminApp() {
  const [logged, setLogged] = useState<boolean | null>(null);
  useEffect(() => onAdminChange(setLogged), []);
  if (logged === null)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  return logged ? <AdminShell /> : <Login />;
}

function Login() {
  const { content } = useSite();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminLogin(email, password);
    } catch {
      setError(isFirebase ? "E-mail ou senha incorretos." : "Senha incorreta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-moss p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-paper p-8">
        <div className="label text-accent">Área da proprietária</div>
        <h1 className="display mt-2 text-4xl">{content.general.name}</h1>
        <div className="mt-8 space-y-4">
          {isFirebase && (
            <input className="field" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          )}
          <input
            className="field"
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn-dark w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
          </button>
        </div>
        {!isFirebase && (
          <p className="mt-6 bg-sand p-3 text-xs text-ink-soft">
            Modo local (sem Firebase). Senha inicial: <strong>{LOCAL_DEFAULT_PASSWORD}</strong> — troque em Configurações.
          </p>
        )}
        <Link to="/" className="mt-6 block text-center text-xs text-ink-soft underline">
          Voltar ao site
        </Link>
      </form>
    </div>
  );
}

function AdminShell() {
  const { content, calendar, ready } = useSite();
  const [tab, setTab] = useState<TabId>(() => {
    const saved = sessionStorage.getItem("bc-admin-tab") as TabId | null;
    return saved && TABS.some((t) => t.id === saved) ? saved : "pedidos";
  });
  const [draft, setDraftState] = useState<SiteContent>(content);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  // Enquanto não há edição pendente, o rascunho acompanha o conteúdo salvo
  useEffect(() => {
    if (!dirtyRef.current) setDraftState(content);
  }, [content]);

  useEffect(() => subscribeRequests(setRequests), []);

  useEffect(() => {
    sessionStorage.setItem("bc-admin-tab", tab);
  }, [tab]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const setDraft: SetDraft = (fn) => {
    setDraftState((d) => fn(d));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await saveContent(draft);
      setDirty(false);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setDraftState(content);
    setDirty(false);
  };

  const newCount = requests.filter((r) => r.status === "new").length;
  const current = TABS.find((t) => t.id === tab)!;
  const isDraftTab = DRAFT_TABS.includes(tab);

  let body: ReactNode = null;
  if (!ready) body = <Loader2 className="animate-spin" />;
  else if (tab === "pedidos") body = <RequestsSection requests={requests} content={content} calendar={calendar} />;
  else if (tab === "calendario") body = <CalendarSection content={content} calendar={calendar} />;
  else if (tab === "cabanas") body = <CabinsSection draft={draft} setDraft={setDraft} />;
  else if (tab === "precos") body = <PricesSection draft={draft} setDraft={setDraft} />;
  else if (tab === "textos") body = <GeneralSection draft={draft} setDraft={setDraft} />;
  else if (tab === "adicionais") body = <ExtrasSection draft={draft} setDraft={setDraft} />;
  else if (tab === "conteudo") body = <ContentLists draft={draft} setDraft={setDraft} />;
  else if (tab === "galeria") body = <GallerySection draft={draft} setDraft={setDraft} />;
  else if (tab === "config") body = <SettingsSection content={content} calendar={calendar} requests={requests} />;

  return (
    <div className="min-h-screen bg-paper lg:flex">
      {/* Menu lateral */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-moss text-paper/80 transition lg:static lg:translate-x-0 ${
          menu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div>
            <div className="font-serif text-lg text-paper">{content.general.name}</div>
            <div className="text-[10px] uppercase tracking-widest text-paper/50">Painel</div>
          </div>
          <button className="lg:hidden" onClick={() => setMenu(false)} aria-label="Fechar menu">
            <X />
          </button>
        </div>
        <nav className="p-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setMenu(false);
              }}
              className={`mb-1 flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                tab === t.id ? "bg-white/10 text-paper" : "hover:bg-white/5 hover:text-paper"
              }`}
            >
              <t.icon className="h-4 w-4" />
              <span className="flex-1">{t.label}</span>
              {t.id === "pedidos" && newCount > 0 && <span className="rounded-full bg-wa px-2 text-xs text-white">{newCount}</span>}
            </button>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 space-y-1 border-t border-white/10 p-3">
          <a href="#/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 text-sm hover:text-paper">
            <ExternalLink className="h-4 w-4" /> Ver o site
          </a>
          <button onClick={() => adminLogout()} className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:text-paper">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>
      {menu && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMenu(false)} />}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur md:px-8">
          <button className="lg:hidden" onClick={() => setMenu(true)} aria-label="Abrir menu">
            <Menu />
          </button>
          <h1 className="flex-1 truncate font-serif text-2xl">{current.label}</h1>
          {isDraftTab && (
            <div className="flex items-center gap-2">
              {dirty ? (
                <>
                  <span className="hidden text-xs text-ink-soft sm:inline">Alterações não salvas</span>
                  <button onClick={discard} className="btn border border-line px-3 py-2 text-ink hover:border-ink">
                    Desfazer
                  </button>
                  <button onClick={save} disabled={saving} className="btn-dark px-4 py-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
                  </button>
                </>
              ) : (
                savedAt > 0 && <span className="text-xs text-ink-soft">Salvo ✓ — já está no site</span>
              )}
            </div>
          )}
        </header>
        {!isFirebase && (
          <div className="flex items-start gap-2 border-b border-line bg-[#fff6e0] px-4 py-2 text-xs md:px-8">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Modo local: as alterações ficam salvas só neste navegador. Para os visitantes verem, configure o Firebase (veja o LEIAME).
          </div>
        )}
        {error && <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 md:px-8">{error}</div>}
        <div className="mx-auto max-w-6xl p-4 md:p-8">{body}</div>
      </div>
    </div>
  );
}
