import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { uid } from "../lib/store";
import type { Experience, Extra, Faq, SiteContent, Testimonial } from "../lib/types";
import type { SetDraft } from "./Admin";
import { Area, Card, Field, IconBtn, ImageField, ImageList, MoveButtons, Num, Text, Toggle, move } from "./ui";

type ListKey = "extras" | "experiences" | "faqs" | "testimonials";

/** Editor genérico de listas: adicionar, remover, reordenar. */
function ListEditor<T extends { id: string }>({
  draft,
  setDraft,
  k,
  empty,
  addLabel,
  render,
}: {
  draft: SiteContent;
  setDraft: SetDraft;
  k: ListKey;
  empty: () => T;
  addLabel: string;
  render: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
}) {
  const items = draft[k] as unknown as T[];
  const setItems = (fn: (l: T[]) => T[]) => setDraft((d) => ({ ...d, [k]: fn(d[k] as unknown as T[]) }));
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={item.id} className="border border-line bg-paper/50 p-4">
          <div className="mb-3 flex justify-end gap-1">
            <MoveButtons onUp={() => setItems((l) => move(l, i, -1))} onDown={() => setItems((l) => move(l, i, 1))} />
            <IconBtn danger title="Remover" onClick={() => window.confirm("Remover este item?") && setItems((l) => l.filter((x) => x.id !== item.id))}>
              <Trash2 className="h-4 w-4" />
            </IconBtn>
          </div>
          {render(item, (patch) => setItems((l) => l.map((x) => (x.id === item.id ? { ...x, ...patch } : x))))}
        </div>
      ))}
      <button onClick={() => setItems((l) => [...l, empty()])} className="btn border border-dashed border-ink-soft text-ink hover:border-ink">
        <Plus className="h-4 w-4" /> {addLabel}
      </button>
    </div>
  );
}

export function ExtrasSection({ draft, setDraft }: { draft: SiteContent; setDraft: SetDraft }) {
  return (
    <Card>
      <p className="mb-5 text-sm text-ink-soft">
        Serviços que o hóspede pode marcar ao montar a pré-reserva. O valor entra no total e aparece na mensagem do WhatsApp.
      </p>
      <ListEditor<Extra>
        draft={draft}
        setDraft={setDraft}
        k="extras"
        addLabel="Adicionar serviço"
        empty={() => ({ id: uid(), name: "Novo adicional", description: "", price: 100, unit: "stay", active: true })}
        render={(e, up) => (
          <div className="grid gap-4 md:grid-cols-4">
            <Text label="Nome" value={e.name} onChange={(v) => up({ name: v })} className="md:col-span-2" />
            <Num label="Valor" prefix="R$" value={e.price} onChange={(v) => up({ price: v })} />
            <Field label="Cobrança">
              <select className="field" value={e.unit} onChange={(ev) => up({ unit: ev.target.value as Extra["unit"] })}>
                <option value="stay">Por estadia</option>
                <option value="night">Por noite</option>
                <option value="guest">Por pessoa, por noite</option>
              </select>
            </Field>
            <Text label="Descrição" value={e.description} onChange={(v) => up({ description: v })} className="md:col-span-3" />
            <div className="flex items-end pb-2">
              <Toggle label={e.active ? "Ativo" : "Desativado"} checked={e.active} onChange={(v) => up({ active: v })} />
            </div>
          </div>
        )}
      />
    </Card>
  );
}

export function ContentLists({ draft, setDraft }: { draft: SiteContent; setDraft: SetDraft }) {
  return (
    <div className="space-y-6">
      <Card title="Experiências">
        <ListEditor<Experience>
          draft={draft}
          setDraft={setDraft}
          k="experiences"
          addLabel="Adicionar experiência"
          empty={() => ({ id: uid(), title: "Nova experiência", text: "", image: "" })}
          render={(e, up) => (
            <div className="grid gap-4">
              <Text label="Título" value={e.title} onChange={(v) => up({ title: v })} />
              <Area label="Texto" rows={2} value={e.text} onChange={(v) => up({ text: v })} />
              <ImageField label="Foto" value={e.image} onChange={(v) => up({ image: v })} />
            </div>
          )}
        />
      </Card>

      <Card title="Perguntas frequentes">
        <ListEditor<Faq>
          draft={draft}
          setDraft={setDraft}
          k="faqs"
          addLabel="Adicionar pergunta"
          empty={() => ({ id: uid(), question: "Nova pergunta?", answer: "" })}
          render={(f, up) => (
            <div className="grid gap-4">
              <Text label="Pergunta" value={f.question} onChange={(v) => up({ question: v })} />
              <Area label="Resposta" rows={3} value={f.answer} onChange={(v) => up({ answer: v })} />
            </div>
          )}
        />
      </Card>

      <Card title="Depoimentos">
        <ListEditor<Testimonial>
          draft={draft}
          setDraft={setDraft}
          k="testimonials"
          addLabel="Adicionar depoimento"
          empty={() => ({ id: uid(), name: "", text: "" })}
          render={(t, up) => (
            <div className="grid gap-4">
              <Area label="Depoimento" rows={2} value={t.text} onChange={(v) => up({ text: v })} />
              <Text label="Nome" value={t.name} onChange={(v) => up({ name: v })} />
            </div>
          )}
        />
      </Card>
    </div>
  );
}

export function GallerySection({ draft, setDraft }: { draft: SiteContent; setDraft: SetDraft }) {
  return (
    <Card>
      <ImageList
        label="Fotos da galeria (página inicial)"
        value={draft.gallery}
        onChange={(v) => setDraft((d) => ({ ...d, gallery: v }))}
        hint="As fotos são reduzidas automaticamente para carregar rápido. A 1ª, 6ª, 11ª… aparecem em destaque (maiores)."
      />
    </Card>
  );
}
