import { whatsappUrl } from "../lib/booking";
import type { General, SiteContent } from "../lib/types";
import type { SetDraft } from "./Admin";
import { Area, Card, Field, ImageField, Text, VideoField } from "./ui";

export function GeneralSection({ draft, setDraft }: { draft: SiteContent; setDraft: SetDraft }) {
  const g = draft.general;
  const set = (patch: Partial<General>) => setDraft((d) => ({ ...d, general: { ...d.general, ...patch } }));

  return (
    <div className="space-y-6">
      <Card title="Identidade">
        <div className="grid gap-4 md:grid-cols-3">
          <Text label="Nome do lugar" value={g.name} onChange={(v) => set({ name: v })} />
          <Text label="Slogan (acima do título da capa)" value={g.tagline} onChange={(v) => set({ tagline: v })} />
          <Field label="Cor de destaque">
            <div className="flex gap-2">
              <input type="color" className="h-[42px] w-14 cursor-pointer border border-line bg-white p-1" value={g.accentColor} onChange={(e) => set({ accentColor: e.target.value })} />
              <input className="field" value={g.accentColor} onChange={(e) => set({ accentColor: e.target.value })} />
            </div>
          </Field>
        </div>
      </Card>

      <Card title="Capa do site">
        <div className="grid gap-4">
          <Text label="Título principal" value={g.heroTitle} onChange={(v) => set({ heroTitle: v })} />
          <Area label="Subtítulo" rows={2} value={g.heroSubtitle} onChange={(v) => set({ heroSubtitle: v })} />
          <ImageField label="Imagem de fundo" value={g.heroImage} onChange={(v) => set({ heroImage: v })} hint="Foto horizontal, de preferência com 1920px de largura." />
          <VideoField
            label="Vídeo de fundo (opcional)"
            value={g.heroVideo}
            onChange={(v) => set({ heroVideo: v })}
            hint="Toca sem som, em loop, por cima da imagem. Link .mp4 fica mais rápido; YouTube também funciona."
          />
        </div>
      </Card>

      <Card title="Apresentação">
        <div className="grid gap-4">
          <Text label="Título" value={g.introTitle} onChange={(v) => set({ introTitle: v })} />
          <Area label="Texto" rows={5} value={g.introText} onChange={(v) => set({ introText: v })} hint="Linha em branco = novo parágrafo." />
        </div>
      </Card>

      <Card title="Sobre nós">
        <div className="grid gap-4">
          <Text label="Título" value={g.aboutTitle} onChange={(v) => set({ aboutTitle: v })} />
          <Area label="Texto" rows={5} value={g.aboutText} onChange={(v) => set({ aboutText: v })} />
          <ImageField label="Foto" value={g.aboutImage} onChange={(v) => set({ aboutImage: v })} />
        </div>
      </Card>

      <Card title="Contato e localização">
        <div className="grid gap-4 md:grid-cols-2">
          <Text
            label="WhatsApp que recebe as reservas"
            value={g.whatsapp}
            onChange={(v) => set({ whatsapp: v.replace(/\D/g, "") })}
            hint="Só números, com 55 + DDD. Ex.: 5511987654321"
          />
          <Field label="Testar">
            <a href={whatsappUrl(g.whatsapp, "Teste do site ✅")} target="_blank" rel="noopener noreferrer" className="btn-wa w-full py-2.5">
              Abrir conversa de teste
            </a>
          </Field>
          <Text label="Telefone (exibição)" value={g.phone} onChange={(v) => set({ phone: v })} />
          <Text label="E-mail" value={g.email} onChange={(v) => set({ email: v })} />
          <Text label="Instagram (sem @)" value={g.instagram} onChange={(v) => set({ instagram: v.replace("@", "") })} />
          <Text label="Endereço" value={g.address} onChange={(v) => set({ address: v })} />
          <Area
            label="Mapa"
            rows={2}
            value={g.mapsEmbed}
            onChange={(v) => set({ mapsEmbed: v })}
            hint='Escreva o endereço, ou no Google Maps vá em Compartilhar › Incorporar um mapa e cole o código aqui.'
            className="md:col-span-2"
          />
        </div>
      </Card>

      <Card title="Reservas e regras">
        <div className="grid gap-4 md:grid-cols-2">
          <Text label="Horário de check-in" value={g.checkInTime} onChange={(v) => set({ checkInTime: v })} />
          <Text label="Horário de check-out" value={g.checkOutTime} onChange={(v) => set({ checkOutTime: v })} />
          <Area label="Políticas (uma por linha)" rows={5} value={g.policies} onChange={(v) => set({ policies: v })} className="md:col-span-2" />
          <Area label="Forma de pagamento (aparece no resumo da reserva)" rows={2} value={g.paymentInfo} onChange={(v) => set({ paymentInfo: v })} className="md:col-span-2" />
          <Text
            label="Primeira frase da mensagem de WhatsApp"
            value={g.whatsappIntro}
            onChange={(v) => set({ whatsappIntro: v })}
            className="md:col-span-2"
          />
        </div>
      </Card>

      <Card title="Rodapé">
        <Area label="Texto do rodapé" rows={2} value={g.footerText} onChange={(v) => set({ footerText: v })} />
      </Card>
    </div>
  );
}
