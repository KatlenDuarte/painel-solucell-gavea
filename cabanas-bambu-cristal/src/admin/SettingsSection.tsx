import { Download, KeyRound, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { DEFAULT_CONTENT } from "../lib/defaults";
import { changeAdminPassword, downloadJson, isFirebase, saveCalendar, saveContent, withDefaults } from "../lib/store";
import type { BookingRequest, Calendar, SiteContent } from "../lib/types";
import { Card } from "./ui";

export function SettingsSection({ content, calendar, requests }: { content: SiteContent; calendar: Calendar; requests: BookingRequest[] }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const changePw = async () => {
    if (pw.length < 6) return setMsg("A senha precisa ter pelo menos 6 caracteres.");
    if (pw !== pw2) return setMsg("As senhas não conferem.");
    try {
      await changeAdminPassword(pw);
      setPw("");
      setPw2("");
      setMsg("Senha alterada ✓");
    } catch (e) {
      setMsg(e instanceof Error ? `Erro: ${e.message}. Saia e entre de novo antes de trocar a senha.` : "Erro ao trocar a senha.");
    }
  };

  const importBackup = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (!data.content) throw new Error("Arquivo inválido");
      if (!window.confirm("Substituir todo o conteúdo e o calendário pelo backup?")) return;
      await saveContent(withDefaults(data.content));
      if (data.calendar) await saveCalendar(data.calendar);
      setMsg("Backup restaurado ✓");
    } catch {
      setMsg("Não foi possível ler este arquivo de backup.");
    }
  };

  return (
    <div className="space-y-6">
      {msg && <div className="bg-sand p-3 text-sm">{msg}</div>}

      <Card title="Senha do painel">
        <div className="grid max-w-md gap-3">
          <input className="field" type="password" placeholder="Nova senha" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          <input className="field" type="password" placeholder="Repita a nova senha" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          <button onClick={changePw} className="btn-dark w-fit">
            <KeyRound className="h-4 w-4" /> Trocar senha
          </button>
        </div>
      </Card>

      <Card title="Backup">
        <p className="mb-4 text-sm text-ink-soft">
          Baixe uma cópia de tudo (textos, cabanas, preços, calendário e pré-reservas). Bom fazer de vez em quando, ou antes de grandes mudanças.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => downloadJson(`backup-bambu-cristal-${new Date().toISOString().slice(0, 10)}.json`, { content, calendar, requests })}
            className="btn-dark"
          >
            <Download className="h-4 w-4" /> Baixar backup
          </button>
          <button onClick={() => file.current?.click()} className="btn border border-line hover:border-ink">
            <Upload className="h-4 w-4" /> Restaurar backup
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) importBackup(f);
            }}
          />
        </div>
      </Card>

      <Card title="Conteúdo de exemplo">
        <p className="mb-4 text-sm text-ink-soft">Volta os textos, cabanas e fotos para o modelo inicial. O calendário e as pré-reservas não são apagados.</p>
        <button
          onClick={async () => {
            if (!window.confirm("Tem certeza? Todos os textos, cabanas e fotos voltarão ao exemplo.")) return;
            await saveContent(structuredClone(DEFAULT_CONTENT));
            setMsg("Conteúdo restaurado para o exemplo.");
          }}
          className="btn border border-line text-red-700 hover:border-red-700"
        >
          <RotateCcw className="h-4 w-4" /> Restaurar exemplo
        </button>
      </Card>

      <Card title="Sobre o armazenamento">
        <p className="text-sm text-ink-soft">
          {isFirebase
            ? "Conectado ao Firebase: tudo o que você salva aparece na hora para todos os visitantes, de qualquer aparelho."
            : "Modo local: os dados ficam somente neste navegador. Para publicar de verdade, configure o Firebase seguindo o arquivo LEIAME.md."}
        </p>
      </Card>
    </div>
  );
}
