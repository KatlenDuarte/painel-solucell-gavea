import { ArrowRight, ChevronDown, Plus, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Lightbox } from "../components/Lightbox";
import { BackgroundVideo, Img } from "../components/Media";
import { brl } from "../lib/booking";
import { useSite } from "../lib/SiteContext";

export function mapsSrc(value: string) {
  const v = value.trim();
  const iframe = v.match(/src="([^"]+)"/);
  if (iframe) return iframe[1];
  if (v.startsWith("http") && v.includes("embed")) return v;
  return `https://maps.google.com/maps?q=${encodeURIComponent(v)}&z=12&output=embed`;
}

export const paragraphs = (t: string) => t.split(/\n\s*\n/).filter(Boolean);

export function Home() {
  const { content } = useSite();
  const g = content.general;
  const cabins = content.cabins.filter((c) => c.active);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [faq, setFaq] = useState<string | null>(null);

  return (
    <>
      {/* HERO */}
      <section className="relative flex h-[100svh] min-h-[560px] items-end overflow-hidden bg-moss text-white">
        <Img src={g.heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        {g.heroVideo && <BackgroundVideo url={g.heroVideo} poster={g.heroImage} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/30" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-20 md:px-8 md:pb-28">
          <div className="label fade-in mb-5 text-white/80">{g.tagline}</div>
          <h1 className="display fade-in max-w-4xl text-5xl md:text-7xl lg:text-8xl">{g.heroTitle}</h1>
          <p className="fade-in mt-6 max-w-xl text-base text-white/85 md:text-lg">{g.heroSubtitle}</p>
          <div className="fade-in mt-10 flex flex-wrap gap-3">
            <Link to="/reservar" className="btn bg-white text-ink hover:bg-paper">
              Ver datas disponíveis
            </Link>
            <a href="#cabanas" className="btn-light">
              Conhecer as cabanas
            </a>
          </div>
        </div>
        <a href="#intro" aria-label="Rolar" className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce text-white/70">
          <ChevronDown />
        </a>
      </section>

      {/* INTRO */}
      <section id="intro" className="mx-auto grid max-w-7xl gap-10 px-4 py-24 md:grid-cols-2 md:px-8 md:py-36">
        <div>
          <div className="label mb-5 text-accent">{g.name}</div>
          <h2 className="display text-4xl md:text-6xl">{g.introTitle}</h2>
        </div>
        <div className="space-y-5 text-lg leading-relaxed text-ink-soft md:pt-12">
          {paragraphs(g.introText).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      {/* CABANAS */}
      <section id="cabanas" className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 py-24 md:px-8">
          <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="label mb-4 text-accent">Hospedagem</div>
              <h2 className="display text-4xl md:text-6xl">As cabanas</h2>
            </div>
            <Link to="/reservar" className="label link-line flex items-center gap-2">
              Disponibilidade de todas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
            {cabins.map((c, i) => (
              <Link key={c.id} to={`/cabana/${c.slug}`} className="group block">
                <div className="aspect-[4/5] overflow-hidden bg-sand">
                  <Img src={c.images[0]} alt={c.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                </div>
                <div className="mt-5 flex items-baseline justify-between gap-4">
                  <div>
                    <div className="label text-ink-soft">{String(i + 1).padStart(2, "0")}</div>
                    <h3 className="mt-2 font-serif text-3xl">{c.name}</h3>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
                </div>
                <p className="mt-2 text-ink-soft">{c.tagline}</p>
                <div className="mt-4 flex items-center gap-4 border-t border-line pt-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" /> até {c.capacity}
                  </span>
                  <span className="text-ink-soft">·</span>
                  <span>a partir de {brl(Math.min(c.priceWeekday, c.priceWeekend))}/noite</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* EXPERIÊNCIAS */}
      {content.experiences.length > 0 && (
        <section id="experiencias" className="bg-moss text-paper">
          <div className="mx-auto max-w-7xl px-4 py-24 md:px-8">
            <div className="label mb-4 text-paper/60">Viver o lugar</div>
            <h2 className="display mb-14 text-4xl md:text-6xl">Experiências</h2>
            <div className="grid gap-10 md:grid-cols-3">
              {content.experiences.map((e) => (
                <div key={e.id}>
                  <div className="aspect-[4/3] overflow-hidden bg-black/20">
                    <Img src={e.image} alt={e.title} className="h-full w-full object-cover" />
                  </div>
                  <h3 className="mt-5 font-serif text-2xl">{e.title}</h3>
                  <p className="mt-2 text-paper/70">{e.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SOBRE */}
      <section id="sobre" className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 md:grid-cols-2 md:px-8 md:py-32">
        <div className="aspect-[4/5] overflow-hidden bg-sand">
          <Img src={g.aboutImage} alt="" className="h-full w-full object-cover" />
        </div>
        <div>
          <div className="label mb-4 text-accent">Sobre nós</div>
          <h2 className="display text-4xl md:text-5xl">{g.aboutTitle}</h2>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink-soft">
            {paragraphs(g.aboutText).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* GALERIA */}
      {content.gallery.length > 0 && (
        <section className="px-2 pb-24 md:px-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            {content.gallery.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setLightbox(i)}
                className={`overflow-hidden bg-sand ${i % 5 === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`}
              >
                <Img src={src} alt="" className="h-full w-full object-cover transition duration-700 hover:scale-105" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* DEPOIMENTOS */}
      {content.testimonials.length > 0 && (
        <section className="border-y border-line bg-sand/50">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-2 md:px-8">
            {content.testimonials.map((t) => (
              <figure key={t.id}>
                <blockquote className="font-serif text-2xl italic leading-snug md:text-3xl">“{t.text}”</blockquote>
                <figcaption className="label mt-5 text-ink-soft">— {t.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-24 text-center md:px-8">
        <div className="label mb-4 text-accent">Reservas</div>
        <h2 className="display mx-auto max-w-3xl text-4xl md:text-6xl">Veja as datas livres e mande sua pré-reserva pelo WhatsApp</h2>
        <p className="mx-auto mt-5 max-w-xl text-ink-soft">
          Escolha a cabana e as datas, veja o valor na hora e envie tudo prontinho para nossa equipe confirmar.
        </p>
        <Link to="/reservar" className="btn-dark mt-10">
          Ver disponibilidade
        </Link>
      </section>

      {/* FAQ */}
      {content.faqs.length > 0 && (
        <section id="duvidas" className="border-t border-line">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 md:grid-cols-[1fr_2fr] md:px-8">
            <div>
              <div className="label mb-4 text-accent">Dúvidas</div>
              <h2 className="display text-4xl md:text-5xl">Perguntas frequentes</h2>
            </div>
            <div className="border-t border-line">
              {content.faqs.map((f) => (
                <div key={f.id} className="border-b border-line">
                  <button
                    type="button"
                    onClick={() => setFaq(faq === f.id ? null : f.id)}
                    className="flex w-full items-center justify-between gap-6 py-5 text-left text-lg"
                  >
                    {f.question}
                    <Plus className={`h-5 w-5 shrink-0 transition ${faq === f.id ? "rotate-45" : ""}`} />
                  </button>
                  {faq === f.id && <p className="whitespace-pre-line pb-6 text-ink-soft">{f.answer}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* LOCALIZAÇÃO */}
      <section id="localizacao" className="bg-sand/60">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 md:grid-cols-2 md:px-8">
          <div>
            <div className="label mb-4 text-accent">Como chegar</div>
            <h2 className="display text-4xl md:text-5xl">Localização</h2>
            <p className="mt-6 text-lg">{g.address}</p>
            <div className="mt-10 grid grid-cols-2 gap-6 border-t border-line pt-6">
              <div>
                <div className="label text-ink-soft">Check-in</div>
                <div className="mt-1 font-serif text-3xl">{g.checkInTime}</div>
              </div>
              <div>
                <div className="label text-ink-soft">Check-out</div>
                <div className="mt-1 font-serif text-3xl">{g.checkOutTime}</div>
              </div>
            </div>
            {g.policies && (
              <div className="mt-8 border-t border-line pt-6">
                <div className="label mb-3 text-ink-soft">Políticas</div>
                <ul className="space-y-2 text-sm text-ink-soft">
                  {g.policies.split("\n").filter(Boolean).map((p, i) => (
                    <li key={i}>— {p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {g.mapsEmbed && (
            <iframe
              title="Mapa"
              src={mapsSrc(g.mapsEmbed)}
              className="min-h-[380px] w-full border-0 grayscale-[40%]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
        </div>
      </section>

      {lightbox !== null && <Lightbox images={content.gallery} index={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}
