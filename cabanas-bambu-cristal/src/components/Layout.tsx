import { Mail, MapPin, Menu, Phone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { whatsappUrl } from "../lib/booking";
import { useSite } from "../lib/SiteContext";
import { InstagramIcon, WhatsAppIcon } from "./Icons";

const NAV = [
  { to: "/#cabanas", label: "Cabanas" },
  { to: "/#experiencias", label: "Experiências" },
  { to: "/#sobre", label: "Sobre" },
  { to: "/#duvidas", label: "Dúvidas" },
  { to: "/#localizacao", label: "Localização" },
];

export function Layout() {
  const { content } = useSite();
  const g = content.general;
  const { pathname, hash } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const overHero = pathname === "/" && !scrolled && !open;

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Rola até a âncora (#cabanas…) ou para o topo ao trocar de página
  useEffect(() => {
    setOpen(false);
    if (hash) {
      const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 60);
      return () => clearTimeout(t);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  const waGeneral = whatsappUrl(g.whatsapp, `Olá! Vim pelo site do ${g.name} e gostaria de mais informações.`);

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
          overHero ? "bg-transparent text-white" : "border-b border-line bg-paper/95 text-ink backdrop-blur"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-20 md:px-8">
          <Link to="/" className="font-serif text-xl tracking-wide md:text-2xl">
            {g.name}
          </Link>
          <nav className="hidden items-center gap-8 lg:flex">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="label link-line">
                {n.label}
              </Link>
            ))}
            <Link to="/reservar" className={overHero ? "btn-light" : "btn-dark"}>
              Ver datas e reservar
            </Link>
          </nav>
          <button className="p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-line bg-paper px-4 pb-6 pt-2 lg:hidden">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="label block border-b border-line py-4">
                {n.label}
              </Link>
            ))}
            <Link to="/reservar" className="btn-dark mt-5 w-full">
              Ver datas e reservar
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-moss text-paper/80">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-3 md:px-8">
          <div>
            <div className="font-serif text-3xl text-paper">{g.name}</div>
            <p className="mt-3 max-w-xs text-sm">{g.footerText}</p>
          </div>
          <div className="space-y-3 text-sm">
            <div className="label mb-4 text-paper">Contato</div>
            {g.phone && (
              <a href={waGeneral} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-paper">
                <Phone className="h-4 w-4" /> {g.phone}
              </a>
            )}
            {g.email && (
              <a href={`mailto:${g.email}`} className="flex items-center gap-3 hover:text-paper">
                <Mail className="h-4 w-4" /> {g.email}
              </a>
            )}
            {g.instagram && (
              <a
                href={`https://instagram.com/${g.instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:text-paper"
              >
                <InstagramIcon className="h-4 w-4" /> @{g.instagram.replace("@", "")}
              </a>
            )}
            {g.address && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {g.address}
              </div>
            )}
          </div>
          <div className="space-y-3 text-sm">
            <div className="label mb-4 text-paper">Hospedagem</div>
            {content.cabins
              .filter((c) => c.active)
              .map((c) => (
                <Link key={c.id} to={`/cabana/${c.slug}`} className="block hover:text-paper">
                  {c.name}
                </Link>
              ))}
            <Link to="/reservar" className="block hover:text-paper">
              Disponibilidade
            </Link>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-4 py-5 text-xs text-paper/50 md:px-8">
            <span>
              © {new Date().getFullYear()} {g.name}
            </span>
            <Link to="/admin" className="hover:text-paper">
              Área da proprietária
            </Link>
          </div>
        </div>
      </footer>

      <a
        href={waGeneral}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-wa text-white shadow-lg transition hover:scale-105"
      >
        <WhatsAppIcon className="h-7 w-7" />
      </a>
    </div>
  );
}
