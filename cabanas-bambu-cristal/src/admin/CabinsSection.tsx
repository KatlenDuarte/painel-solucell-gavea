import { Copy, Eye, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Img } from "../components/Media";
import { brl } from "../lib/booking";
import { uid } from "../lib/store";
import type { Cabin, SiteContent } from "../lib/types";
import type { SetDraft } from "./Admin";
import { Area, Card, Chips, ImageList, MoveButtons, Num, Text, Toggle, VideoField, move } from "./ui";

export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function CabinsSection({ draft, setDraft }: { draft: SiteContent; setDraft: SetDraft }) {
  const [selected, setSelected] = useState(draft.cabins[0]?.id ?? "");
  const idx = draft.cabins.findIndex((c) => c.id === selected);
  const cabin = draft.cabins[idx];

  const update = (patch: Partial<Cabin>) =>
    setDraft((d) => ({ ...d, cabins: d.cabins.map((c) => (c.id === selected ? { ...c, ...patch } : c)) }));

  const add = (base?: Cabin) => {
    const id = uid();
    const name = base ? `${base.name} (cópia)` : "Nova cabana";
    const fresh: Cabin = base
      ? { ...structuredClone(base), id, name, slug: slugify(name) }
      : {
          id,
          slug: `nova-cabana-${id.slice(0, 4)}`,
          name,
          tagline: "",
          description: "",
          capacity: 2,
          beds: "1 cama de casal",
          size: "",
          priceWeekday: 500,
          priceWeekend: 650,
          extraGuestFee: 0,
          baseGuests: 2,
          cleaningFee: 0,
          minNights: 1,
          images: [],
          video: "",
          amenities: [],
          active: false,
        };
    setDraft((d) => ({ ...d, cabins: [...d.cabins, fresh] }));
    setSelected(id);
  };

  const remove = () => {
    if (!cabin || !window.confirm(`Excluir a ${cabin.name}? Isso não pode ser desfeito depois de salvar.`)) return;
    setDraft((d) => ({ ...d, cabins: d.cabins.filter((c) => c.id !== cabin.id) }));
    setSelected(draft.cabins.find((c) => c.id !== cabin.id)?.id ?? "");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <div className="space-y-2">
        {draft.cabins.map((c, i) => (
          <div
            key={c.id}
            className={`flex items-center gap-3 border p-2 ${c.id === selected ? "border-ink bg-white" : "border-line bg-white/60"}`}
          >
            <button className="flex flex-1 items-center gap-3 text-left" onClick={() => setSelected(c.id)}>
              <div className="h-12 w-14 shrink-0 overflow-hidden bg-sand">{c.images[0] && <Img src={c.images[0]} alt="" className="h-full w-full object-cover" />}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-normal">{c.name}</div>
                <div className="text-xs text-ink-soft">{c.active ? brl(c.priceWeekday) : "oculta do site"}</div>
              </div>
            </button>
            <div className="flex flex-col gap-1 [&_button]:p-0.5">
              <MoveButtons
                onUp={() => setDraft((d) => ({ ...d, cabins: move(d.cabins, i, -1) }))}
                onDown={() => setDraft((d) => ({ ...d, cabins: move(d.cabins, i, 1) }))}
              />
            </div>
          </div>
        ))}
        <button onClick={() => add()} className="btn w-full border border-dashed border-ink-soft text-ink hover:border-ink">
          <Plus className="h-4 w-4" /> Nova cabana
        </button>
      </div>

      {cabin ? (
        <div className="space-y-6">
          <Card
            title={cabin.name}
            actions={
              <div className="flex flex-wrap items-center gap-3">
                <Toggle label={cabin.active ? "Visível no site" : "Oculta"} checked={cabin.active} onChange={(v) => update({ active: v })} />
                <a href={`#/cabana/${cabin.slug}`} target="_blank" rel="noopener noreferrer" className="btn border border-line px-3 py-2 hover:border-ink">
                  <Eye className="h-4 w-4" /> Ver
                </a>
                <button onClick={() => add(cabin)} className="btn border border-line px-3 py-2 hover:border-ink">
                  <Copy className="h-4 w-4" /> Duplicar
                </button>
                <button onClick={remove} className="btn border border-line px-3 py-2 text-red-700 hover:border-red-700">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Text label="Nome" value={cabin.name} onChange={(v) => update({ name: v })} />
              <Text
                label="Endereço da página"
                value={cabin.slug}
                onChange={(v) => update({ slug: slugify(v) })}
                hint={`site/#/cabana/${cabin.slug}`}
              />
              <Text label="Frase curta (aparece no card)" value={cabin.tagline} onChange={(v) => update({ tagline: v })} className="md:col-span-2" />
              <Area
                label="Descrição"
                rows={6}
                value={cabin.description}
                onChange={(v) => update({ description: v })}
                hint="Deixe uma linha em branco para começar um novo parágrafo."
                className="md:col-span-2"
              />
            </div>
          </Card>

          <Card title="Valores">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Num label="Diária de domingo a quinta" prefix="R$" value={cabin.priceWeekday} onChange={(v) => update({ priceWeekday: v })} />
              <Num label="Diária de sexta e sábado" prefix="R$" value={cabin.priceWeekend} onChange={(v) => update({ priceWeekend: v })} />
              <Num label="Taxa de limpeza (por estadia)" prefix="R$" value={cabin.cleaningFee} onChange={(v) => update({ cleaningFee: v })} />
              <Num label="Mínimo de noites" value={cabin.minNights} onChange={(v) => update({ minNights: Math.max(1, Math.round(v)) })} />
              <Num
                label="Hóspedes incluídos na diária"
                value={cabin.baseGuests}
                onChange={(v) => update({ baseGuests: Math.max(1, Math.round(v)) })}
              />
              <Num
                label="Valor por hóspede extra / noite"
                prefix="R$"
                value={cabin.extraGuestFee}
                onChange={(v) => update({ extraGuestFee: v })}
                hint="0 = sem cobrança extra"
              />
            </div>
            <p className="mt-4 text-xs text-ink-soft">Para feriados e temporadas use a aba “Preços especiais”.</p>
          </Card>

          <Card title="Acomodação">
            <div className="grid gap-4 sm:grid-cols-3">
              <Num label="Capacidade máxima" value={cabin.capacity} onChange={(v) => update({ capacity: Math.max(1, Math.round(v)) })} />
              <Text label="Camas" value={cabin.beds} onChange={(v) => update({ beds: v })} />
              <Text label="Área" value={cabin.size} onChange={(v) => update({ size: v })} placeholder="ex.: 40 m²" />
            </div>
            <div className="mt-5">
              <Chips label="Comodidades" value={cabin.amenities} onChange={(v) => update({ amenities: v })} />
            </div>
          </Card>

          <Card title="Fotos e vídeo">
            <ImageList
              label="Fotos"
              value={cabin.images}
              onChange={(v) => update({ images: v })}
              hint="A primeira foto é a capa. Use as setas para reordenar."
            />
            <div className="mt-6">
              <VideoField label="Vídeo da cabana (opcional)" value={cabin.video} onChange={(v) => update({ video: v })} />
            </div>
          </Card>
        </div>
      ) : (
        <p className="text-ink-soft">Selecione ou crie uma cabana.</p>
      )}
    </div>
  );
}
