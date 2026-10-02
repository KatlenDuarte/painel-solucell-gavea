import { Plus, Trash2 } from "lucide-react";
import { fmtDate, todayKey } from "../lib/booking";
import { uid } from "../lib/store";
import type { SiteContent, SpecialPrice } from "../lib/types";
import type { SetDraft } from "./Admin";
import { Field, Num, Text } from "./ui";

export function PricesSection({ draft, setDraft }: { draft: SiteContent; setDraft: SetDraft }) {
  const list = [...draft.specialPrices].sort((a, b) => a.start.localeCompare(b.start));
  const today = todayKey();

  const update = (id: string, patch: Partial<SpecialPrice>) =>
    setDraft((d) => ({ ...d, specialPrices: d.specialPrices.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const add = () =>
    setDraft((d) => ({
      ...d,
      specialPrices: [...d.specialPrices, { id: uid(), label: "Feriado", cabinId: "all", start: today, end: today, price: 900, minNights: 0 }],
    }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Use para feriados, Réveillon, Carnaval, alta temporada ou promoções. Nessas noites o site usa o valor abaixo no lugar da diária normal — e pode
        exigir um mínimo de noites diferente.
      </p>
      {list.length === 0 && <p className="border border-dashed border-line p-8 text-center text-ink-soft">Nenhum preço especial cadastrado.</p>}
      {list.map((s) => (
        <div key={s.id} className={`border border-line bg-white p-5 ${s.end < today ? "opacity-60" : ""}`}>
          <div className="grid gap-4 md:grid-cols-6">
            <Text label="Nome" value={s.label} onChange={(v) => update(s.id, { label: v })} className="md:col-span-2" />
            <Field label="Cabana" className="md:col-span-2">
              <select className="field" value={s.cabinId} onChange={(e) => update(s.id, { cabinId: e.target.value })}>
                <option value="all">Todas as cabanas</option>
                {draft.cabins.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Num label="Diária" prefix="R$" value={s.price} onChange={(v) => update(s.id, { price: v })} />
            <Num label="Mín. noites" value={s.minNights} onChange={(v) => update(s.id, { minNights: Math.round(v) })} hint="0 = padrão" />
            <Text label="Primeira noite" type="date" value={s.start} onChange={(v) => update(s.id, { start: v, end: s.end < v ? v : s.end })} className="md:col-span-2" />
            <Text label="Última noite" type="date" value={s.end} onChange={(v) => update(s.id, { end: v })} className="md:col-span-2" />
            <div className="flex items-end justify-between gap-2 md:col-span-2">
              <span className="pb-2 text-xs text-ink-soft">
                {fmtDate(s.start)} a {fmtDate(s.end)}
                {s.end < today && " · já passou"}
              </span>
              <button
                onClick={() => setDraft((d) => ({ ...d, specialPrices: d.specialPrices.filter((x) => x.id !== s.id) }))}
                className="btn px-3 py-2 text-red-700 hover:bg-red-50"
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
      <button onClick={add} className="btn border border-dashed border-ink-soft text-ink hover:border-ink">
        <Plus className="h-4 w-4" /> Adicionar preço especial
      </button>
    </div>
  );
}
