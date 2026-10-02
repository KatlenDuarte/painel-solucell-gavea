import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { MONTHS, toKey } from "../lib/booking";

const HEAD = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Grade de um mês. `cell` desenha cada dia (chave YYYY-MM-DD). */
export function MonthGrid({ year, month, cell }: { year: number; month: number; cell: (key: string) => ReactNode }) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const blanks = first.getDay();
  return (
    <div>
      <div className="mb-3 text-center font-serif text-xl capitalize">
        {MONTHS[month]} <span className="text-ink-soft">{year}</span>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {HEAD.map((h, i) => (
          <div key={i} className="pb-2 text-[10px] font-medium tracking-widest text-ink-soft">
            {h}
          </div>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => (
          <div key={i}>{cell(toKey(new Date(year, month, i + 1)))}</div>
        ))}
      </div>
    </div>
  );
}

/** Navegação entre meses mostrando `count` meses lado a lado (1 no celular). */
export function MonthPager({
  offset,
  setOffset,
  count = 2,
  minOffset = 0,
  cell,
}: {
  offset: number;
  setOffset: (n: number) => void;
  count?: number;
  minOffset?: number;
  cell: (key: string) => ReactNode;
}) {
  const now = new Date();
  const months = Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset + i, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOffset(Math.max(minOffset, offset - 1))}
        disabled={offset <= minOffset}
        className="absolute left-0 top-0 p-1.5 text-ink transition hover:bg-sand disabled:opacity-20"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => setOffset(offset + 1)}
        className="absolute right-0 top-0 p-1.5 text-ink transition hover:bg-sand"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <div className={`grid gap-8 ${count > 1 ? "md:grid-cols-2" : ""}`}>
        {months.map((mo, i) => (
          <div key={`${mo.y}-${mo.m}`} className={i > 0 ? "hidden md:block" : ""}>
            <MonthGrid year={mo.y} month={mo.m} cell={cell} />
          </div>
        ))}
      </div>
    </div>
  );
}
