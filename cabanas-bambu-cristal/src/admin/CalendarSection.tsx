import { Loader2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { MonthPager } from "../components/MonthGrid";
import { addDays, fmtDate, nightPrice, specialFor, todayKey } from "../lib/booking";
import { saveCalendar } from "../lib/store";
import type { Calendar, DayMark, SiteContent } from "../lib/types";

type Action = "blocked" | "booked" | "free";

const ACTIONS: { id: Action; label: string; cls: string }[] = [
  { id: "booked", label: "Marcar como reservado", cls: "bg-moss text-paper" },
  { id: "blocked", label: "Bloquear (manutenção, uso próprio…)", cls: "bg-[repeating-linear-gradient(45deg,#d9d2c3_0_4px,#f5f2ec_4px_8px)]" },
  { id: "free", label: "Liberar", cls: "bg-white border border-line" },
];

export function CalendarSection({ content, calendar }: { content: SiteContent; calendar: Calendar }) {
  const [cabinId, setCabinId] = useState(content.cabins[0]?.id ?? "");
  const [action, setAction] = useState<Action>("booked");
  const [note, setNote] = useState("");
  const [allCabins, setAllCabins] = useState(false);
  const [anchor, setAnchor] = useState("");
  const [hover, setHover] = useState("");
  const [offset, setOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const cabin = content.cabins.find((c) => c.id === cabinId) ?? content.cabins[0];
  const today = todayKey();
  const days = calendar[cabin?.id ?? ""] || {};

  const apply = async (from: string, to: string) => {
    const [a, b] = from <= to ? [from, to] : [to, from];
    const targets = allCabins ? content.cabins.map((c) => c.id) : [cabin.id];
    const next: Calendar = { ...calendar };
    for (const id of targets) {
      const d = { ...(next[id] || {}) };
      for (let k = a; k <= b; k = addDays(k, 1)) {
        if (action === "free") delete d[k];
        else d[k] = { status: action, ...(note.trim() ? { note: note.trim() } : {}) };
      }
      next[id] = d;
    }
    setSaving(true);
    try {
      await saveCalendar(next);
    } finally {
      setSaving(false);
    }
  };

  const click = (k: string) => {
    if (!anchor) return setAnchor(k);
    const a = anchor;
    setAnchor("");
    apply(a, k);
  };

  const ranges = useMemo(() => {
    const keys = Object.keys(days)
      .filter((k) => k >= today)
      .sort();
    const out: { start: string; end: string; mark: DayMark }[] = [];
    for (const k of keys) {
      const last = out[out.length - 1];
      const m = days[k];
      if (last && addDays(last.end, 1) === k && last.mark.status === m.status && (last.mark.note || "") === (m.note || "")) last.end = k;
      else out.push({ start: k, end: k, mark: m });
    }
    return out;
  }, [days, today]);

  if (!cabin) return <p>Cadastre uma cabana primeiro.</p>;

  const cell = (k: string) => {
    const mark = days[k];
    const past = k < today;
    const lo = anchor && hover ? (anchor < hover ? anchor : hover) : anchor;
    const hi = anchor && hover ? (anchor < hover ? hover : anchor) : anchor;
    const inSel = anchor && k >= lo && k <= hi;
    const sp = specialFor(content, cabin.id, k);
    const price = nightPrice(content, cabin, k).price;
    return (
      <button
        type="button"
        onClick={() => click(k)}
        onMouseEnter={() => setHover(k)}
        title={mark?.note || (sp ? sp.label : undefined)}
        className={[
          "relative flex h-14 w-full flex-col items-center justify-center border border-transparent text-sm transition hover:border-ink",
          mark?.status === "booked" ? "bg-moss text-paper" : "",
          mark?.status === "blocked" ? ACTIONS[1].cls : "",
          inSel ? "!border-accent ring-2 ring-accent ring-inset" : "",
          past ? "opacity-35" : "",
        ].join(" ")}
      >
        <span>{Number(k.slice(8))}</span>
        <span className={`text-[9px] ${mark?.status === "booked" ? "text-paper/70" : "text-ink-soft"}`}>{Math.round(price)}</span>
        {sp && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {content.cabins.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setCabinId(c.id);
              setAnchor("");
            }}
            className={`border px-4 py-2 text-sm ${c.id === cabin.id ? "border-ink bg-ink text-paper" : "border-line bg-white hover:border-ink"}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="border border-line bg-white p-4 md:p-6" onMouseLeave={() => setHover("")}>
          <MonthPager offset={offset} setOffset={setOffset} minOffset={-12} cell={cell} />
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-ink-soft">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 bg-moss" /> Reservado
            </span>
            <span className="flex items-center gap-2">
              <span className={`h-3 w-3 ${ACTIONS[1].cls}`} /> Bloqueado
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Preço especial
            </span>
            <span>O número pequeno é a diária daquela noite.</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-line bg-white p-5">
            <div className="label mb-3 text-ink-soft">O que fazer</div>
            <div className="space-y-2">
              {ACTIONS.map((a) => (
                <label key={a.id} className={`flex cursor-pointer items-center gap-3 border p-3 text-sm ${action === a.id ? "border-ink" : "border-line"}`}>
                  <input type="radio" checked={action === a.id} onChange={() => setAction(a.id)} />
                  <span className={`h-4 w-4 shrink-0 ${a.cls}`} />
                  {a.label}
                </label>
              ))}
            </div>
            {action !== "free" && (
              <input
                className="field mt-3"
                placeholder={action === "booked" ? "Nome do hóspede / observação" : "Motivo (opcional)"}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allCabins} onChange={(e) => setAllCabins(e.target.checked)} /> Aplicar em todas as cabanas
            </label>
            <p className="mt-4 bg-sand p-3 text-xs leading-relaxed">
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
                </span>
              ) : anchor ? (
                <>
                  Início: <strong>{fmtDate(anchor)}</strong>. Agora toque na <strong>última noite</strong> do período (ou no mesmo dia para marcar só ele).{" "}
                  <button className="underline" onClick={() => setAnchor("")}>
                    cancelar
                  </button>
                </>
              ) : (
                <>
                  Toque na <strong>primeira noite</strong> e depois na <strong>última noite</strong>. Cada dia representa a noite: uma estadia de 10 a 12
                  ocupa as noites 10 e 11. Salva na hora.
                </>
              )}
            </p>
          </div>

          <div className="border border-line bg-white p-5">
            <div className="label mb-3 text-ink-soft">Próximas ocupações · {cabin.name}</div>
            {ranges.length === 0 ? (
              <p className="text-sm text-ink-soft">Nenhuma data marcada.</p>
            ) : (
              <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
                {ranges.map((r) => (
                  <li key={r.start} className="flex items-start justify-between gap-2 border-b border-line pb-2">
                    <div>
                      <div>
                        {fmtDate(r.start)}
                        {r.end !== r.start && ` → ${fmtDate(r.end)}`}
                      </div>
                      <div className="text-xs text-ink-soft">
                        {r.mark.status === "booked" ? "Reservado" : "Bloqueado"}
                        {r.mark.note && ` · ${r.mark.note}`}
                      </div>
                    </div>
                    <button
                      title="Liberar estas noites"
                      className="p-1 text-ink-soft hover:text-red-700"
                      onClick={async () => {
                        if (!window.confirm("Liberar estas noites?")) return;
                        const d = { ...days };
                        for (let k = r.start; k <= r.end; k = addDays(k, 1)) delete d[k];
                        await saveCalendar({ ...calendar, [cabin.id]: d });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
