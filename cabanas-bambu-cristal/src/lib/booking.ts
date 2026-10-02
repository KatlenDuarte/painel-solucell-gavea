// Datas, cálculo de valores e montagem da mensagem de WhatsApp.
// Convenção: as datas do calendário representam NOITES. Uma estadia de
// check-in 10/10 a check-out 12/10 ocupa as noites 10/10 e 11/10.

import type { Cabin, Calendar, SiteContent } from "./types";

export const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const pad = (n: number) => String(n).padStart(2, "0");
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (k: string, n: number) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};
export const todayKey = () => toKey(new Date());

export function nightsBetween(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  for (let k = checkIn; k < checkOut; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Sexta e sábado são noites de fim de semana. */
export const isWeekendNight = (k: string) => [5, 6].includes(fromKey(k).getDay());

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtDate = (k: string) => fromKey(k).toLocaleDateString("pt-BR");
export const fmtDateShort = (k: string) => {
  const d = fromKey(k);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};
export const fmtDateLong = (k: string) => `${WEEKDAYS_SHORT[fromKey(k).getDay()]}, ${fmtDate(k)}`;

export function specialFor(content: SiteContent, cabinId: string, night: string) {
  return content.specialPrices.find(
    (s) => (s.cabinId === "all" || s.cabinId === cabinId) && s.start <= night && night <= s.end,
  );
}

export function nightPrice(content: SiteContent, cabin: Cabin, night: string) {
  const sp = specialFor(content, cabin.id, night);
  if (sp) return { price: sp.price, label: sp.label };
  return isWeekendNight(night)
    ? { price: cabin.priceWeekend, label: "fim de semana" }
    : { price: cabin.priceWeekday, label: "" };
}

export function minNightsFor(content: SiteContent, cabin: Cabin, checkIn: string) {
  const sp = specialFor(content, cabin.id, checkIn);
  return Math.max(1, cabin.minNights || 1, sp?.minNights || 0);
}

export const isNightTaken = (calendar: Calendar, cabinId: string, night: string) =>
  Boolean(calendar[cabinId]?.[night]);

/** Primeira noite ocupada a partir de `from` (limite para escolher o check-out). */
export function firstTakenAfter(calendar: Calendar, cabinId: string, from: string, horizon = 400) {
  const days = calendar[cabinId] || {};
  let best: string | null = null;
  for (const k of Object.keys(days)) if (k >= from && (!best || k < best)) best = k;
  if (best && best <= addDays(from, horizon)) return best;
  return null;
}

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface Quote {
  nights: string[];
  nightLines: QuoteLine[];
  lodging: number;
  extraGuests: QuoteLine | null;
  cleaning: number;
  extras: QuoteLine[];
  total: number;
  minNights: number;
  available: boolean;
}

export function quote(
  content: SiteContent,
  calendar: Calendar,
  cabin: Cabin,
  checkIn: string,
  checkOut: string,
  guests: number,
  extraIds: string[],
): Quote {
  const nights = nightsBetween(checkIn, checkOut);
  const priced = nights.map((n) => ({ night: n, ...nightPrice(content, cabin, n) }));
  const lodging = priced.reduce((s, p) => s + p.price, 0);

  // Agrupa noites de mesmo valor para a mensagem não ficar enorme
  let nightLines: QuoteLine[];
  if (priced.length <= 4) {
    nightLines = priced.map((p) => ({
      label: `Noite ${fmtDateShort(p.night)} (${WEEKDAYS_SHORT[fromKey(p.night).getDay()]})${p.label && p.label !== "fim de semana" ? ` · ${p.label}` : ""}`,
      amount: p.price,
    }));
  } else {
    const groups = new Map<string, { count: number; price: number; label: string }>();
    for (const p of priced) {
      const key = `${p.price}|${p.label}`;
      const g = groups.get(key) || { count: 0, price: p.price, label: p.label };
      g.count++;
      groups.set(key, g);
    }
    nightLines = [...groups.values()].map((g) => ({
      label: `${g.count} ${g.count > 1 ? "noites" : "noite"}${g.label ? ` (${g.label})` : ""} × ${brl(g.price)}`,
      amount: g.count * g.price,
    }));
  }

  const extraCount = Math.max(0, guests - (cabin.baseGuests || cabin.capacity));
  const extraGuests =
    extraCount > 0 && cabin.extraGuestFee > 0
      ? {
          label: `${extraCount} hóspede(s) extra × ${nights.length} noite(s)`,
          amount: extraCount * cabin.extraGuestFee * nights.length,
        }
      : null;

  const extras = content.extras
    .filter((e) => e.active && extraIds.includes(e.id))
    .map((e) => {
      const mult = e.unit === "stay" ? 1 : e.unit === "night" ? nights.length : nights.length * guests;
      const detail =
        e.unit === "stay" ? "" : e.unit === "night" ? ` (${nights.length} noite(s))` : ` (${guests} hósp. × ${nights.length} noite(s))`;
      return { label: `${e.name}${detail}`, amount: e.price * mult };
    });

  const cleaning = nights.length ? cabin.cleaningFee || 0 : 0;
  const total = lodging + (extraGuests?.amount || 0) + cleaning + extras.reduce((s, e) => s + e.amount, 0);

  return {
    nights,
    nightLines,
    lodging,
    extraGuests,
    cleaning,
    extras,
    total,
    minNights: checkIn ? minNightsFor(content, cabin, checkIn) : cabin.minNights,
    available: nights.every((n) => !isNightTaken(calendar, cabin.id, n)),
  };
}

export interface GuestInfo {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

export function buildWhatsAppMessage(
  content: SiteContent,
  cabin: Cabin,
  checkIn: string,
  checkOut: string,
  guests: number,
  q: Quote,
  guest: GuestInfo,
) {
  const g = content.general;
  const L: string[] = [];
  L.push(g.whatsappIntro);
  L.push("");
  L.push(`*PRÉ-RESERVA · ${g.name.toUpperCase()}*`);
  L.push("");
  L.push(`🏡 *Cabana:* ${cabin.name}`);
  L.push(`📅 *Check-in:* ${fmtDateLong(checkIn)}${g.checkInTime ? ` (a partir das ${g.checkInTime})` : ""}`);
  L.push(`📅 *Check-out:* ${fmtDateLong(checkOut)}${g.checkOutTime ? ` (até ${g.checkOutTime})` : ""}`);
  L.push(`🌙 *Noites:* ${q.nights.length}`);
  L.push(`👥 *Hóspedes:* ${guests}`);
  L.push("");
  L.push("💰 *Valores estimados*");
  for (const l of q.nightLines) L.push(`• ${l.label}: ${brl(l.amount)}`);
  if (q.extraGuests) L.push(`• ${q.extraGuests.label}: ${brl(q.extraGuests.amount)}`);
  if (q.cleaning) L.push(`• Taxa de limpeza: ${brl(q.cleaning)}`);
  for (const e of q.extras) L.push(`• ${e.label}: ${brl(e.amount)}`);
  L.push(`*Total estimado: ${brl(q.total)}*`);
  L.push("");
  L.push(`👤 *Nome:* ${guest.name}`);
  if (guest.phone) L.push(`📱 *Telefone:* ${guest.phone}`);
  if (guest.email) L.push(`✉️ *E-mail:* ${guest.email}`);
  if (guest.notes.trim()) L.push(`📝 *Observações:* ${guest.notes.trim()}`);
  L.push("");
  L.push("Aguardo a confirmação da disponibilidade. Obrigado! 😊");
  return L.join("\n");
}

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

export function whatsappUrl(number: string, text: string) {
  return `https://api.whatsapp.com/send?phone=${onlyDigits(number)}&text=${encodeURIComponent(text)}`;
}
