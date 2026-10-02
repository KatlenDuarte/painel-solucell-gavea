// Componentes de formulário do painel.
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ImagePlus, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Img, parseVideo } from "../components/Media";
import { uploadImage, uploadVideo } from "../lib/store";

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="border border-line bg-white p-5 md:p-6">
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {title && <h3 className="font-serif text-2xl">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

export function Text({
  label,
  value,
  onChange,
  hint,
  placeholder,
  className,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  className?: string;
  type?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input type={type} className="field" value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function Area({
  label,
  value,
  onChange,
  hint,
  rows = 4,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <textarea className="field" rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function Num({
  label,
  value,
  onChange,
  hint,
  prefix,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  prefix?: string;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <div className="flex">
        {prefix && <span className="flex items-center border border-r-0 border-line bg-sand px-3 text-sm text-ink-soft">{prefix}</span>}
        <input
          type="number"
          min={0}
          step="any"
          className="field"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
      </div>
    </Field>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-3 text-sm">
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-moss" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-5.5" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

export function IconBtn({ onClick, title, children, danger }: { onClick: () => void; title: string; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`border border-line bg-white p-1.5 transition hover:border-ink ${danger ? "text-red-700 hover:border-red-700" : ""}`}
    >
      {children}
    </button>
  );
}

export function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function MoveButtons({ onUp, onDown, horizontal }: { onUp: () => void; onDown: () => void; horizontal?: boolean }) {
  return (
    <>
      <IconBtn onClick={onUp} title={horizontal ? "Mover para a esquerda" : "Subir"}>
        {horizontal ? <ArrowLeft className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
      </IconBtn>
      <IconBtn onClick={onDown} title={horizontal ? "Mover para a direita" : "Descer"}>
        {horizontal ? <ArrowRight className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
      </IconBtn>
    </>
  );
}

function useUploader() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async <T,>(fn: () => Promise<T>) => {
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no envio");
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** Uma imagem: enviar arquivo ou colar link. */
export function ImageField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const { busy, error, run } = useUploader();
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="aspect-[4/3] w-full shrink-0 overflow-hidden bg-sand sm:w-48">
          {value && <Img src={value} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <button type="button" className="btn border border-line text-ink hover:border-ink" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Enviar foto
          </button>
          <input
            className="field"
            placeholder="…ou cole o link da imagem"
            value={value.startsWith("data:") || value.startsWith("media:") ? "" : value}
            onChange={(e) => onChange(e.target.value)}
          />
          {hint && <span className="text-xs text-ink-soft">{hint}</span>}
          {error && <span className="text-xs text-red-700">{error}</span>}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const url = await run(() => uploadImage(f));
          if (url) onChange(url);
        }}
      />
    </div>
  );
}

/** Lista de fotos com envio múltiplo, ordenação e exclusão. */
export function ImageList({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const { busy, error, run } = useUploader();
  const [link, setLink] = useState("");
  return (
    <div>
      <span className="field-label">{label}</span>
      {hint && <p className="mb-3 text-xs text-ink-soft">{hint}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {value.map((src, i) => (
          <div key={`${i}-${src.slice(-24)}`} className="group relative">
            <div className="aspect-[4/3] overflow-hidden bg-sand">
              <Img src={src} alt="" className="h-full w-full object-cover" />
            </div>
            {i === 0 && <span className="absolute left-1 top-1 bg-ink px-2 py-0.5 text-[10px] uppercase tracking-widest text-paper">Capa</span>}
            <div className="mt-1 flex gap-1">
              <MoveButtons horizontal onUp={() => onChange(move(value, i, -1))} onDown={() => onChange(move(value, i, 1))} />
              <IconBtn danger title="Remover" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </IconBtn>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-2 border border-dashed border-ink-soft text-sm text-ink-soft transition hover:border-ink hover:text-ink"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
          {busy ? "Enviando…" : "Adicionar fotos"}
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <input className="field" placeholder="Colar link de imagem" value={link} onChange={(e) => setLink(e.target.value)} />
        <button
          type="button"
          className="btn border border-line text-ink hover:border-ink"
          disabled={!link.trim()}
          onClick={() => {
            onChange([...value, link.trim()]);
            setLink("");
          }}
        >
          <Link2 className="h-4 w-4" /> Adicionar
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = [...(e.target.files || [])];
          e.target.value = "";
          if (!files.length) return;
          const urls = await run(async () => {
            const out: string[] = [];
            for (const f of files) out.push(await uploadImage(f));
            return out;
          });
          if (urls) onChange([...value, ...urls]);
        }}
      />
    </div>
  );
}

/** Link de vídeo (YouTube, Vimeo, .mp4) ou envio de arquivo. */
export function VideoField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const { busy, error, run } = useUploader();
  const v = parseVideo(value);
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex gap-2">
        <input className="field" placeholder="Link do YouTube, Vimeo ou arquivo .mp4" value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="btn shrink-0 border border-line text-ink hover:border-ink" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span className="hidden sm:inline">Enviar</span>
        </button>
        {value && (
          <IconBtn danger title="Remover vídeo" onClick={() => onChange("")}>
            <Trash2 className="h-4 w-4" />
          </IconBtn>
        )}
      </div>
      {v && <p className="mt-1 text-xs text-ink-soft">Reconhecido como: {v.kind === "file" ? "arquivo de vídeo" : v.kind === "youtube" ? "YouTube" : "Vimeo"}</p>}
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="video/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const url = await run(() => uploadVideo(f));
          if (url) onChange(url);
        }}
      />
    </div>
  );
}

/** Lista de textos curtos (ex.: comodidades). */
export function Chips({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="mb-2 flex flex-wrap gap-2">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-2 bg-sand px-3 py-1 text-sm">
            {v}
            <button type="button" aria-label={`Remover ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="text-ink-soft hover:text-red-700">
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="field"
          placeholder="Digite e aperte Enter"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" onClick={add} className="btn border border-line text-ink hover:border-ink">
          Adicionar
        </button>
      </div>
    </div>
  );
}
