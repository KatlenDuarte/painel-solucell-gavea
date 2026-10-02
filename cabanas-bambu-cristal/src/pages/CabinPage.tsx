import { ArrowLeft, BedDouble, Check, Maximize, Moon, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { BookingWidget } from "../components/BookingWidget";
import { Lightbox } from "../components/Lightbox";
import { Img, Video } from "../components/Media";
import { brl } from "../lib/booking";
import { useSite } from "../lib/SiteContext";
import { paragraphs } from "./Home";

export function CabinPage() {
  const { slug } = useParams();
  const { content, ready } = useSite();
  const cabin = content.cabins.find((c) => c.slug === slug && c.active);
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (!cabin) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-24 pt-40 text-center">
        {ready && (
          <>
            <h1 className="display text-4xl">Cabana não encontrada</h1>
            <Link to="/" className="btn-dark mt-8">
              Voltar ao início
            </Link>
          </>
        )}
      </div>
    );
  }

  const others = content.cabins.filter((c) => c.active && c.id !== cabin.id);
  const imgs = cabin.images.length ? cabin.images : [""];

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-24 md:px-8 md:pt-32">
        <Link to="/#cabanas" className="label inline-flex items-center gap-2 text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Todas as cabanas
        </Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="display text-5xl md:text-7xl">{cabin.name}</h1>
            <p className="mt-3 text-lg text-ink-soft">{cabin.tagline}</p>
          </div>
          <a href="#reservar" className="btn-dark">
            Ver datas e valores
          </a>
        </div>
      </section>

      {/* Galeria */}
      <section className="mx-auto mt-10 max-w-7xl px-2 md:px-8">
        <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2">
          {imgs.slice(0, 5).map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightbox(i)}
              className={`relative overflow-hidden bg-sand ${
                i === 0 ? "aspect-[4/3] md:col-span-2 md:row-span-2 md:aspect-auto md:h-full" : "hidden aspect-[4/3] md:block"
              }`}
            >
              <Img src={src} alt={cabin.name} className="absolute inset-0 h-full w-full object-cover transition duration-700 hover:scale-105" />
              {i === 4 && imgs.length > 5 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white">+{imgs.length - 5} fotos</span>
              )}
            </button>
          ))}
        </div>
        {imgs.length > 1 && (
          <button type="button" onClick={() => setLightbox(0)} className="label link-line mt-4 md:hidden">
            Ver as {imgs.length} fotos
          </button>
        )}
      </section>

      {/* Detalhes */}
      <section className="mx-auto grid max-w-7xl gap-14 px-4 py-20 md:grid-cols-[2fr_1fr] md:px-8">
        <div>
          <div className="grid grid-cols-2 gap-6 border-y border-line py-6 sm:grid-cols-4">
            <Fact icon={<Users />} label="Hóspedes" value={`até ${cabin.capacity}`} />
            <Fact icon={<BedDouble />} label="Camas" value={cabin.beds} />
            <Fact icon={<Maximize />} label="Área" value={cabin.size} />
            <Fact icon={<Moon />} label="Mínimo" value={`${cabin.minNights} ${cabin.minNights > 1 ? "noites" : "noite"}`} />
          </div>
          <div className="mt-10 space-y-5 text-lg leading-relaxed text-ink-soft">
            {paragraphs(cabin.description).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {cabin.video && <Video url={cabin.video} className="mt-12" />}
        </div>
        <div>
          <div className="label mb-5 text-accent">Comodidades</div>
          <ul className="space-y-3">
            {cabin.amenities.map((a) => (
              <li key={a} className="flex items-center gap-3 border-b border-line pb-3">
                <Check className="h-4 w-4 text-accent" /> {a}
              </li>
            ))}
          </ul>
          <div className="mt-10 bg-sand/60 p-6">
            <div className="label mb-4 text-ink-soft">Diárias</div>
            <div className="flex justify-between py-1">
              <span>Domingo a quinta</span>
              <span>{brl(cabin.priceWeekday)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Sexta e sábado</span>
              <span>{brl(cabin.priceWeekend)}</span>
            </div>
            {cabin.extraGuestFee > 0 && (
              <div className="flex justify-between py-1 text-sm text-ink-soft">
                <span>Hóspede extra (acima de {cabin.baseGuests})</span>
                <span>{brl(cabin.extraGuestFee)}/noite</span>
              </div>
            )}
            {cabin.cleaningFee > 0 && (
              <div className="flex justify-between py-1 text-sm text-ink-soft">
                <span>Taxa de limpeza</span>
                <span>{brl(cabin.cleaningFee)}</span>
              </div>
            )}
            <p className="mt-3 text-xs text-ink-soft">Feriados e datas especiais podem ter valores diferentes — o calendário já mostra o valor de cada noite.</p>
          </div>
        </div>
      </section>

      {/* Reserva */}
      <section id="reservar" className="scroll-mt-20 border-t border-line bg-paper">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8">
          <div className="label mb-4 text-accent">Disponibilidade</div>
          <h2 className="display mb-12 text-4xl md:text-5xl">Escolha suas datas</h2>
          <BookingWidget cabin={cabin} />
        </div>
      </section>

      {others.length > 0 && (
        <section className="border-t border-line">
          <div className="mx-auto max-w-7xl px-4 py-20 md:px-8">
            <h2 className="display mb-10 text-3xl md:text-4xl">Outras cabanas</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((c) => (
                <Link key={c.id} to={`/cabana/${c.slug}`} className="group">
                  <div className="aspect-[4/3] overflow-hidden bg-sand">
                    <Img src={c.images[0]} alt={c.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  </div>
                  <div className="mt-4 font-serif text-2xl">{c.name}</div>
                  <div className="text-sm text-ink-soft">a partir de {brl(Math.min(c.priceWeekday, c.priceWeekend))}/noite</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {lightbox !== null && <Lightbox images={imgs} index={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="mb-2 text-accent [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
      <div className="label text-[10px] text-ink-soft">{label}</div>
      <div className="mt-1">{value}</div>
    </div>
  );
}
