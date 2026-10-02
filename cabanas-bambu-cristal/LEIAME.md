# Cabanas Bambu Cristal — site + painel

Site de hospedagem inspirado no estilo minimalista do Treehotel, com:

- **Página inicial**: capa com foto ou vídeo de fundo, apresentação, grade das cabanas, experiências, sobre, galeria com ampliação, depoimentos, perguntas frequentes, mapa e políticas.
- **Página de cada cabana**: galeria, detalhes, comodidades, vídeo, tabela de diárias e calendário de reserva.
- **Calendário de disponibilidade**: mostra o valor de cada noite, risca as datas ocupadas, respeita o mínimo de noites e impede escolher um período que cruze uma data ocupada.
- **Pré-reserva pelo WhatsApp**: o hóspede escolhe as datas, o número de hóspedes e os adicionais, e vê o total na hora. Também vê uma **prévia da mensagem** antes de enviar. A mensagem chega pronta no WhatsApp da proprietária, com cabana, datas, noites, valores, total, nome e observações.
- **Painel da proprietária** (`/#/admin`):
  - **Pré-reservas**: cada pedido enviado pelo site fica guardado aqui. Botões *Responder no WhatsApp*, *Confirmar e bloquear datas* (bloqueia o calendário automaticamente), *Recusar* e *Cancelar*.
  - **Calendário**: marque noites como reservadas ou bloqueadas, ou libere-as, em uma cabana ou em todas.
  - **Cabanas**: nome, textos, diárias de semana e de fim de semana, taxa de limpeza, mínimo de noites, hóspede extra, capacidade, comodidades, fotos (envio direto), vídeo, ordem e visível/oculta.
  - **Preços especiais**: feriados, Réveillon, temporada etc., com mínimo de noites próprio.
  - **Textos e contato**: todos os textos do site, foto e vídeo da capa, WhatsApp, Instagram, endereço, mapa, horários, políticas, forma de pagamento e cor de destaque.
  - **Adicionais**: café da manhã, decoração etc., cobrados por estadia, por noite ou por pessoa.
  - **Experiências, FAQ, depoimentos e galeria de fotos.**
  - **Configurações**: troca de senha e backup (baixar e restaurar).

## Rodar no computador

```bash
cd cabanas-bambu-cristal
npm install
npm run dev
```

Sem configurar nada, o site roda em **modo local**: tudo é salvo só no navegador. A senha do painel é `bambu123`. Esse modo serve para testar e montar o conteúdo.

## Colocar no ar (Firebase, plano gratuito)

1. Crie um projeto em <https://console.firebase.google.com>.
2. **Authentication** › Método de login › ative **E-mail/senha**. Em *Usuários*, adicione o e-mail e a senha da proprietária.
3. **Firestore Database** › Criar banco. Em *Regras*, cole o conteúdo de `firestore.rules`.
4. (Opcional) **Storage**, para enviar vídeos e fotos em alta qualidade. Ele exige o plano Blaze; sem ele, as fotos são guardadas comprimidas no Firestore, e os vídeos podem ser links do YouTube ou Vimeo. Cole as regras de `storage.rules`.
5. Em *Configurações do projeto › Seus apps*, crie um app **Web** e copie os dados para um arquivo `.env` (use `.env.example` como modelo).
6. `npm run build` gera a pasta `dist/`. Envie essa pasta para qualquer hospedagem: Firebase Hosting (`npx firebase-tools deploy`), Netlify, Vercel, GitHub Pages ou Hostinger.

Depois disso, tudo o que for salvo no painel aparece na hora para todos os visitantes.

> Dica: se você montou o conteúdo no modo local, use **Configurações › Baixar backup** e depois, já com o Firebase, **Restaurar backup**.

## Fotos provisórias

As imagens em `public/img/` são ilustrações provisórias. Troque-as pelas fotos reais no painel.
