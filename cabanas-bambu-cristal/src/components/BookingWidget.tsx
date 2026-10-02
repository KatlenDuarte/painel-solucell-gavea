import { Check, Copy, Minus, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  brl,
  buildWhatsAppMessage,
  firstTakenAfter,
  fmtDateLong,
  isNightTaken,
  minNightsFor,
  nightPrice,
  nightsBetween,
  onlyDigits,
  quote,
  todayKey,
  whatsappUrl,
} from "../lib/booking";
import { useSite } from "../lib/SiteContext";
import { createRequest } from "../lib/store";
import type { Cabin } from "../lib/types";
import { WhatsAppIcon } from "./Icons";
import { MonthPager } from "./MonthGrid";

/** Calendário de disponibilidade + orçamento + pré-reserva pelo WhatsApp. */
export function BookingWidget({ cabin: fixedCabin }: { cabin?: Cabin }) {
  const { content, calendar } = useSite();
  const cabins = content.cabins.filter((c) => c.active);
  const [cabinId, setCabinId] = useState(fixedCabin?.id ?? cabins[0]?.id ?? "");
  const cabin = fixedCabin ?? cabins.find((c) => c.id === cabinId) ?? cabins[0];

  const [offset, setOffset] = useState(0);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [hover, setHover] = useState("");
  const [guests, setGuests] = useState(2);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [guest, setGuest] = useState({ name: "", phone: "", email: "", notes: "" });
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const today = todayKey();
  const limit = checkIn && !checkOut ? firstTakenAfter(calendar, cabin?.id ?? "", checkIn) : null;
  const minNights = cabin && checkIn ? minNightsFor(content, cabin, checkIn) : 1;

  const q = useMemo(
    () => (cabin && checkIn && checkOut ? quote(content, calendar, cabin, checkIn, checkOut, guests, extraIds) : null),
    [content, calendar, cabin, checkIn, checkOut, guests, extraIds],
  );

  if (!cabin) return <p className="text-ink-soft">Nenhuma cabana disponível no momento.</p>;

  const resetDates = () => {
    setCheckIn("");
    setCheckOut("");
    setSent(false);
  };

  const pickDay = (k: string) => {
    setSent(false);
    const taken = isNightTaken(calendar, cabin.id, k);
    if (!checkIn || checkOut || k <= checkIn) {
      if (taken || k < today) return;
      setCheckIn(k);
      setCheckOut("");
      return;
    }
    if (limit && k > limit) return;
    if (nightsBetween(checkIn, k).length < minNights) return;
    setCheckOut(k);
  };

  const cell = (k: string) => {
    const past = k < today;
    const taken = isNightTaken(calendar, cabin.id, k);
    const selecting = Boolean(checkIn && !checkOut);
    const end = checkOut || (selecting && hover > checkIn ? hover : "");
    const inRange = checkIn && end && k > checkIn && k < end;
    const isStart = k === checkIn;
    const isEnd = k === checkOut;
    const tooShort = selecting && k > checkIn && nightsBetween(checkIn, k).length < minNights;
    const beyond = selecting && limit !== null && k > limit;
    // Durante a escolha do check-out, a primeira noite ocupada ainda pode ser o dia de saída
    const checkoutOnly = selecting && taken && k > checkIn && !beyond && !tooShort;
    const disabled = past || (selecting ? k > checkIn && (tooShort || beyond) : taken);
    const showTaken = taken && !checkoutOnly;
    const price = !past && !taken ? nightPrice(content, cabin, k).price : null;

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => pickDay(k)}
        onMouseEnter={() => setHover(k)}
        title={
          showTaken ? "Indisponível" : tooShort ? `Mínimo de ${minNights} noites` : checkoutOnly ? "Somente saída" : undefined
        }
        className={[
          "relative mx-auto flex h-12 w-full flex-col items-center justify-center text-sm transition",
          isStart || isEnd ? "bg-ink text-paper" : inRange ? "bg-sand" : "",
          !isStart && !isEnd && !disabled && !showTaken ? "hover:bg-sand" : "",
          past ? "text-ink/20" : "",
          showTaken && !past ? "text-ink/30 line-through" : "",
          (tooShort || beyond) && !showTaken ? "text-ink/30" : "",
        ].join(" ")}
      >
        <span className={isStart || isEnd ? "font-medium" : ""}>{Number(k.slice(8))}</span>
        {price !== null && !(tooShort || beyond) && (
          <span className={`text-[9px] leading-none ${isStart || isEnd ? "text-paper/70" : "text-ink-soft"}`}>
            {Math.round(price)}
          </span>
        )}
      </button>
    );
  };

  const validPhone = onlyDigits(guest.phone).length >= 10;
  const ready = Boolean(q && q.available && q.nights.length >= minNights && guest.name.trim() && validPhone);
  const message = q ? buildWhatsAppMessage(content, cabin, checkIn, checkOut, guests, q, guest) : "";
  const waLink = whatsappUrl(content.general.whatsapp, message);

  const onSend = () => {
    if (!q) return;
    setSent(true);
    createRequest({
      cabinId: cabin.id,
      cabinName: cabin.name,
      checkIn,
      checkOut,
      nights: q.nights.length,
      guests,
      name: guest.name.trim(),
      phone: guest.phone,
      email: guest.email,
      notes: guest.notes,
      extras: q.extras.map((e) => ({ name: e.label, total: e.amount })),
      total: q.total,
      status: "new",
      createdAt: Date.now(),
    }).catch(() => {});
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* navegador sem permissão */
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr]">
      {/* ---------------- Calendário ---------------- */}
      <div>
        {!fixedCabin && cabins.length > 1 && (
          <div className="mb-8">
            <div className="label mb-3 text-ink-soft">1 · Escolha a cabana</div>
            <div className="flex flex-wrap gap-2">
              {cabins.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCabinId(c.id);
                    resetDates();
                    setGuests(Math.min(guests, c.capacity));
                  }}
                  className={`border px-4 py-2 text-sm transition ${
                    c.id === cabin.id ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="label mb-1 text-ink-soft">{fixedCabin ? "1" : "2"} · Escolha as datas</div>
        <p className="mb-6 text-sm text-ink-soft">
          {!checkIn
            ? "Toque no dia de chegada."
            : !checkOut
              ? `Agora toque no dia de saída (mínimo de ${minNights} ${minNights > 1 ? "noites" : "noite"}).`
              : `${q?.nights.length} ${q && q.nights.length > 1 ? "noites" : "noite"} selecionadas.`}
          {(checkIn || checkOut) && (
            <button type="button" onClick={resetDates} className="ml-2 inline-flex items-center gap-1 underline">
              <X className="h-3 w-3" /> limpar
            </button>
          )}
        </p>

        <div onMouseLeave={() => setHover("")}>
          <MonthPager offset={offset} setOffset={setOffset} cell={cell} />
        </div>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-soft">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 border border-line bg-white" /> Disponível (valor da diária)
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 bg-ink" /> Selecionado
          </span>
          <span className="flex items-center gap-2">
            <span className="text-ink/30 line-through">12</span> Indisponível
          </span>
        </div>
      </div>

      {/* ---------------- Resumo e envio ---------------- */}
      <aside className="h-fit border border-line bg-white p-6 lg:sticky lg:top-24">
        <div className="font-serif text-2xl">{cabin.name}</div>
        <div className="mt-1 text-sm text-ink-soft">
          a partir de {brl(Math.min(cabin.priceWeekday, cabin.priceWeekend))} / noite
        </div>

        <div className="mt-5 grid grid-cols-2 border border-line text-sm">
          <div className="border-r border-line p-3">
            <div className="label text-[9px] text-ink-soft">Chegada</div>
            <div className="mt-1">{checkIn ? fmtDateLong(checkIn) : "—"}</div>
          </div>
          <div className="p-3">
            <div className="label text-[9px] text-ink-soft">Saída</div>
            <div className="mt-1">{checkOut ? fmtDateLong(checkOut) : "—"}</div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border border-line p-3 text-sm">
          <div>
            <div className="label text-[9px] text-ink-soft">Hóspedes</div>
            <div className="text-xs text-ink-soft">máximo {cabin.capacity}</div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Menos hóspedes" onClick={() => setGuests(Math.max(1, guests - 1))} className="border border-line p-1.5 hover:border-ink">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-4 text-center">{guests}</span>
            <button
              type="button"
              aria-label="Mais hóspedes"
              onClick={() => setGuests(Math.min(cabin.capacity, guests + 1))}
              className="border border-line p-1.5 hover:border-ink"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {content.extras.some((e) => e.active) && (
          <div className="mt-5">
            <div className="label mb-2 text-[10px] text-ink-soft">Adicionais (opcional)</div>
            <div className="space-y-2">
              {content.extras
                .filter((e) => e.active)
                .map((e) => {
                  const on = extraIds.includes(e.id);
                  return (
                    <label key={e.id} className={`flex cursor-pointer gap-3 border p-3 text-sm transition ${on ? "border-ink" : "border-line"}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setExtraIds(on ? extraIds.filter((x) => x !== e.id) : [...extraIds, e.id])}
                        className="mt-1 accent-[var(--color-ink)]"
                      />
                      <span className="flex-1">
                        <span className="flex flex-wrap justify-between gap-x-2">
                          <span className="font-normal">{e.name}</span>
                          <span className="whitespace-nowrap text-ink-soft">
                            {brl(e.price)}
                            {e.unit === "night" ? "/noite" : e.unit === "guest" ? "/pessoa/noite" : ""}
                          </span>
                        </span>
                        {e.description && <span className="block text-xs text-ink-soft">{e.description}</span>}
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>
        )}

        {q && (
          <div className="mt-6 space-y-1.5 border-t border-line pt-4 text-sm">
            {q.nightLines.map((l, i) => (
              <Row key={i} label={l.label} value={l.amount} />
            ))}
            {q.extraGuests && <Row label={q.extraGuests.label} value={q.extraGuests.amount} />}
            {q.cleaning > 0 && <Row label="Taxa de limpeza" value={q.cleaning} />}
            {q.extras.map((e, i) => (
              <Row key={`e${i}`} label={e.label} value={e.amount} />
            ))}
            <div className="flex justify-between border-t border-line pt-3 text-base font-medium">
              <span>Total estimado</span>
              <span>{brl(q.total)}</span>
            </div>
            {content.general.paymentInfo && <p className="pt-1 text-xs text-ink-soft">{content.general.paymentInfo}</p>}
          </div>
        )}

        {q && (
          <div className="mt-6 space-y-3 border-t border-line pt-5">
            <div className="label text-[10px] text-ink-soft">Seus dados</div>
            <input className="field" placeholder="Nome completo *" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} />
            <input
              className="field"
              placeholder="WhatsApp com DDD *"
              inputMode="tel"
              value={guest.phone}
              onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
            />
            <input className="field" placeholder="E-mail (opcional)" type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} />
            <textarea
              className="field min-h-20"
              placeholder="Alguma observação? (aniversário, horário de chegada, restrição alimentar…)"
              value={guest.notes}
              onChange={(e) => setGuest({ ...guest, notes: e.target.value })}
            />
          </div>
        )}

        {q && ready && (
          <div className="mt-5">
            <div className="label mb-2 text-[10px] text-ink-soft">Prévia da mensagem</div>
            <div className="max-h-72 overflow-y-auto rounded-sm bg-[#e5ddd5] p-3">
              <div className="ml-auto max-w-[95%] whitespace-pre-wrap rounded-lg rounded-tr-none bg-[#d9fdd3] p-3 text-[13px] leading-snug text-[#111b21] shadow-sm">
                <WaText text={message} />
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 space-y-2">
          {ready ? (
            <a href={waLink} target="_blank" rel="noopener noreferrer" onClick={onSend} className="btn-wa w-full">
              <WhatsAppIcon /> Enviar pré-reserva pelo WhatsApp
            </a>
          ) : (
            <button type="button" disabled className="btn-wa w-full">
              <WhatsAppIcon /> Enviar pré-reserva pelo WhatsApp
            </button>
          )}
          {ready && (
            <button type="button" onClick={copy} className="btn w-full border border-line text-ink hover:border-ink">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copiado" : "Copiar mensagem"}
            </button>
          )}
          {!ready && (
            <p className="text-center text-xs text-ink-soft">
              {!checkIn || !checkOut
                ? "Selecione as datas no calendário para ver o valor."
                : q && !q.available
                  ? "Há noites indisponíveis nesse período."
                  : "Preencha nome e WhatsApp para enviar."}
            </p>
          )}
          {sent && (
            <p className="bg-sand p-3 text-center text-xs">
              Pronto! Sua pré-reserva foi aberta no WhatsApp. É só tocar em enviar por lá — respondemos confirmando a disponibilidade.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-soft">{label}</span>
      <span className="whitespace-nowrap">{brl(value)}</span>
    </div>
  );
}

/** Mostra *negrito* como no WhatsApp. */
function WaText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <strong key={i} className="font-semibold">{part.slice(1, -1)}</strong> : <span key={i}>{part}</span>,
      )}
    </>
  );
}
