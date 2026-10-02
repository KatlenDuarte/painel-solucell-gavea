import { CalendarCheck, Inbox, Trash2, Undo2, XCircle } from "lucide-react";
import { useState } from "react";
import { WhatsAppIcon } from "../components/Icons";
import { brl, fmtDateLong, nightsBetween, whatsappUrl } from "../lib/booking";
import { deleteRequest, saveCalendar, updateRequest } from "../lib/store";
import type { BookingRequest, Calendar, RequestStatus, SiteContent } from "../lib/types";

const FILTERS: { id: RequestStatus | "all"; label: string }[] = [
  { id: "new", label: "Novas" },
  { id: "confirmed", label: "Confirmadas" },
  { id: "declined", label: "Recusadas" },
  { id: "all", label: "Todas" },
];

const STATUS_STYLE: Record<RequestStatus, string> = {
  new: "bg-wa/15 text-[#0b6b34]",
  confirmed: "bg-moss text-paper",
  declined: "bg-line text-ink-soft",
};
const STATUS_LABEL: Record<RequestStatus, string> = { new: "Nova", confirmed: "Confirmada", declined: "Recusada" };

export function RequestsSection({ requests, content, calendar }: { requests: BookingRequest[]; content: SiteContent; calendar: Calendar }) {
  const [filter, setFilter] = useState<RequestStatus | "all">("new");
  const [msg, setMsg] = useState("");
  const list = requests.filter((r) => filter === "all" || r.status === filter);

  const confirm = async (r: BookingRequest) => {
    const nights = nightsBetween(r.checkIn, r.checkOut);
    const days = { ...(calendar[r.cabinId] || {}) };
    const conflicts = nights.filter((n) => days[n] && days[n].requestId !== r.id);
    if (conflicts.length && !window.confirm(`Atenção: ${conflicts.length} noite(s) desse período já estão ocupadas/bloqueadas. Confirmar mesmo assim?`))
      return;
    for (const n of nights) days[n] = { status: "booked", note: `${r.name} · ${r.phone}`, requestId: r.id };
    await saveCalendar({ ...calendar, [r.cabinId]: days });
    await updateRequest(r.id, { status: "confirmed" });
    setMsg(`Reserva de ${r.name} confirmada e datas bloqueadas no calendário.`);
  };

  const releaseDates = async (r: BookingRequest) => {
    const days = { ...(calendar[r.cabinId] || {}) };
    let changed = false;
    for (const k of Object.keys(days))
      if (days[k].requestId === r.id) {
        delete days[k];
        changed = true;
      }
    if (changed) await saveCalendar({ ...calendar, [r.cabinId]: days });
  };

  const setStatus = async (r: BookingRequest, status: RequestStatus) => {
    if (r.status === "confirmed") await releaseDates(r);
    await updateRequest(r.id, { status });
    setMsg(status === "declined" ? "Pré-reserva marcada como recusada." : "Pré-reserva voltou para Novas.");
  };

  const remove = async (r: BookingRequest) => {
    if (!window.confirm(`Excluir a pré-reserva de ${r.name}?`)) return;
    if (r.status === "confirmed" && window.confirm("Liberar também as datas no calendário?")) await releaseDates(r);
    await deleteRequest(r.id);
  };

  const reply = (r: BookingRequest) =>
    whatsappUrl(
      r.phone.replace(/\D/g, "").length <= 11 ? `55${r.phone}` : r.phone,
      `Olá, ${r.name.split(" ")[0]}! Aqui é do ${content.general.name} 🌿\nRecebemos sua pré-reserva da *${r.cabinName}* de ${fmtDateLong(r.checkIn)} a ${fmtDateLong(
        r.checkOut,
      )} (${r.nights} noites, ${r.guests} hóspedes), total estimado de *${brl(r.total)}*.\n\n`,
    );

  return (
    <div>
      <p className="mb-6 text-sm text-ink-soft">
        Toda vez que um visitante toca em “Enviar pré-reserva pelo WhatsApp”, uma cópia fica guardada aqui. Ao confirmar, as noites são bloqueadas
        automaticamente no calendário do site.
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const n = f.id === "all" ? requests.length : requests.filter((r) => r.status === f.id).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`border px-4 py-2 text-sm ${filter === f.id ? "border-ink bg-ink text-paper" : "border-line bg-white hover:border-ink"}`}
            >
              {f.label} <span className="opacity-60">({n})</span>
            </button>
          );
        })}
      </div>
      {msg && (
        <div className="mb-4 flex items-center justify-between bg-sand p-3 text-sm">
          {msg}
          <button onClick={() => setMsg("")} aria-label="Fechar">
            ×
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border border-dashed border-line py-16 text-ink-soft">
          <Inbox className="h-8 w-8" /> Nenhuma pré-reserva aqui.
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((r) => (
            <div key={r.id} className="border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-serif text-2xl">{r.name}</span>
                    <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </div>
                  <div className="text-sm text-ink-soft">
                    {r.phone}
                    {r.email && ` · ${r.email}`} · recebida em {new Date(r.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-serif text-2xl">{brl(r.total)}</div>
                  <div className="text-xs text-ink-soft">total estimado</div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-4">
                <Info label="Cabana" value={r.cabinName} />
                <Info label="Chegada" value={fmtDateLong(r.checkIn)} />
                <Info label="Saída" value={fmtDateLong(r.checkOut)} />
                <Info label="Noites · hóspedes" value={`${r.nights} · ${r.guests}`} />
              </div>
              {(r.extras.length > 0 || r.notes) && (
                <div className="mt-3 space-y-1 text-sm">
                  {r.extras.length > 0 && (
                    <div>
                      <span className="text-ink-soft">Adicionais: </span>
                      {r.extras.map((e) => `${e.name} (${brl(e.total)})`).join(", ")}
                    </div>
                  )}
                  {r.notes && (
                    <div>
                      <span className="text-ink-soft">Observações: </span>
                      {r.notes}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <a href={reply(r)} target="_blank" rel="noopener noreferrer" className="btn-wa px-4 py-2">
                  <WhatsAppIcon className="h-4 w-4" /> Responder
                </a>
                {r.status !== "confirmed" && (
                  <button onClick={() => confirm(r)} className="btn-dark px-4 py-2">
                    <CalendarCheck className="h-4 w-4" /> Confirmar e bloquear datas
                  </button>
                )}
                {r.status !== "declined" && (
                  <button onClick={() => setStatus(r, "declined")} className="btn border border-line px-4 py-2 hover:border-ink">
                    <XCircle className="h-4 w-4" /> {r.status === "confirmed" ? "Cancelar reserva" : "Recusar"}
                  </button>
                )}
                {r.status !== "new" && (
                  <button onClick={() => setStatus(r, "new")} className="btn border border-line px-4 py-2 hover:border-ink">
                    <Undo2 className="h-4 w-4" /> Voltar para novas
                  </button>
                )}
                <button onClick={() => remove(r)} className="btn ml-auto px-3 py-2 text-red-700 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label text-[9px] text-ink-soft">{label}</div>
      <div>{value}</div>
    </div>
  );
}
