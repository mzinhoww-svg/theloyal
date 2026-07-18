# M2 · Slice — Template de e-mail Daily no brand system (SPEC, antes de código)

> **Por que agora.** Não toca score, CPM, predict nem produção de dado — é camada de
> apresentação sobre um contrato JSON já existente. Roda em paralelo à calibração sem
> colisão. **Não é o Digest Engine** (que renderiza a partir do contrato v2 completo
> quando os vetores fecharem) — é o **template e o renderer** que o Digest Engine vai
> alimentar depois. Construir agora significa que, quando o Digest Engine ligar, ele
> empurra JSON num renderer já testado, em vez de nascerem os dois juntos.

---

## 0. Achado que muda o desenho — dois contratos divergentes no repo hoje

Antes de desenhar a peça nova, uma auditoria do que já existe encontrou uma **divergência
real** que precisa ser resolvida nesta spec, não descoberta depois em produção:

- **`content/edition.schema.json`** (JSON Schema versionado, `$id` presente) define o
  contrato **camelCase**: `signal`, `deals[]`, `fechaLogo[]`, `shoppingWatch[]`, `radar`,
  `sources[]`, `disclaimer` (const). `fechaLogo` é um **array** de itens (`tag`, `text`,
  `cpm`, `note`, `vigencia`).
- **`renderer/email.mjs`** (o renderer que já existe) lê **snake_case**: `abertura`,
  `na_edicao_de_hoje`, `sinal_do_dia`, `deal_desk`, `conta_feita`, `fecha_logo`,
  `o_que_evitaria`, `program_watch`/`bank_cards_watch`/`retail_coalition`, `loyalty_lab`,
  `sinais_rapidos`, `sua_leitura`, `fontes_metodologia`, `footer` — e trata `fecha_logo`
  como **uma string narrativa única** dentro de um destaque amarelo, não como array.

**Ou seja: o renderer que existe não roda contra o schema que existe.** São dois
contratos editoriais diferentes convivendo no repo (provavelmente um resquício do
"Operating Manual v1" antes do schema JSON ser versionado). Publicar hoje exigiria
adivinhar qual dos dois é o real. Esta spec resolve isso como pré-requisito do template,
não como detalhe de implementação.

**Proposta (a ratificar):** `content/edition.schema.json` é o canônico — é o único dos
dois que é um JSON Schema versionado com `$id`, e é o ponto de partida que o Digest
Engine vai estender para o contrato v2 (`schemaVersion`, `estado`, `tl_breakdown`,
`fontes[]`, `predicoes[]` — REQ-32, trabalho futuro). `renderer/email.mjs` é **realinhado**
a ele nesta slice (nomes de campo + `fechaLogo` como array), não o contrário.

---

## 1. Achado da verificação do Beehiiv MCP (cruza com a Slice 2) — dois alvos de render

A verificação em paralelo das capacidades do Beehiiv MCP (`SPEC-SLICE-VERIFICACAO-BEEHIIV-MCP.md`)
encontrou algo que muda o que "template de e-mail" significa aqui: `save_post`/`edit_post_content`
**não aceitam HTML livre**. O `html_content` é **parseado no contrato Tiptap do editor**
(nós fixos: `paragraph`, `heading`, `section`, `columns`, `table`, `button`, `image` etc.).
Achado crítico: **`style="..."` inline é descartado no parse, exceto na mark `textStyle`**
(um `<span style="color:...">` específico). Layout de card usa o nó `section` com atributos
`data-*` (não `style=`); tabelas usam tokens de tema para borda/grid (não CSS por-célula).

**Consequência direta:** o `renderer/email.mjs` (HTML cru, `style=` inline em toda tag,
`<table role="presentation">` aninhada, comentários MSO) é exatamente o padrão certo para
um **e-mail Gmail-safe standalone** — mas **não é injetável como está** no `html_content`
que o MCP manda pro Beehiiv. São **dois alvos de render diferentes**:

| Alvo | O que é | Quem consome | Nesta slice? |
|---|---|---|---|
| **HTML standalone Gmail-safe** | Tabelas + CSS 100% inline, sem depender de motor nenhum | Preview manual, teste em clientes de e-mail reais, versão web/arquivo, QA (`tl-qa`) | **Sim — é o escopo desta slice.** |
| **Dialeto Tiptap para `save_post`** | Blocos `section`/`columns`/`table`/`textStyle` nos limites do editor Beehiiv; o Beehiiv gera o HTML final do e-mail a partir disso | Envio real via MCP (REQ-33) | **Não — fora de escopo aqui.** Fica registrado como dependência para quando M2.7 (Beehiiv MCP + Daily) ligar o envio de fato. A Slice 2 traz a pergunta ao operador sobre esse caminho. |

Isto **não bloqueia** esta slice — o HTML standalone continua sendo o artefato certo para
preview/QA/versão web independente de como o envio real for resolvido depois. Só evita a
armadilha de construir o renderer standalone achando que ele vai direto pro MCP sem
tradução.

---

## 2. Seções canônicas do brief — mapeadas ao schema atual

| Seção do brief | Campo no schema | Estado |
|---|---|---|
| Sinal do Dia | `signal` (string, obrigatório) | ✅ existe, 1:1 |
| Deal Desk (até 3) | `deals[]` (`$defs/deal`) | ✅ existe; **schema não limita a 3** — ver §3 |
| Conta Feita | — | ⚠️ **não existe como seção própria** — ver §3 |
| Fecha Logo | `fechaLogo[]` (`$defs/fecha`) | ✅ existe como array (renderer legado trata como string única — bug a corrigir) |
| O que evitar | — | ⚠️ **não existe no schema** — ver §3 |
| Disclaimer fixo | `disclaimer` (const, obrigatório) | ✅ existe, já trava o texto exato |

Dois buracos reais (Conta Feita como bloco próprio, O que evitar) exigem uma decisão do
operador antes de codar — não são inventados aqui.

## 3. Decisões a ratificar

1. **"Conta Feita" como bloco de destaque próprio (Ink block, CLAUDE.md `ContaBlock`).**
   Hoje `conta` só existe **dentro** de cada deal (`deal.conta`). O brief trata "Conta
   Feita" como seção **separada** do Deal Desk — o número do dia em destaque. Proposta:
   adicionar campo **opcional** `contaFeita` ao schema (reusa `$defs/conta`, mesmo shape
   de `deal.conta`), preenchido por quem monta a edição. Regra de render: se `contaFeita`
   ausente, elevar automaticamente a `conta` do **primeiro** item de `deals[]`. Ratificar
   este design, ou prefere fonte diferente (ex.: sempre o deal de maior `tlScore`, quando o
   score existir)?
2. **"O que evitar" não existe no schema.** Proposta: campo opcional `oQueEvitar` (string),
   mesma forma de `signal`. Sem isto a seção obrigatória do brief não tem de onde nascer.
   Ratificar a adição (é aditiva, não quebra edições existentes — `additionalProperties:false`
   do schema atual exige que o campo seja declarado para não ser rejeitado)?
3. **Cap de 3 no Deal Desk — no schema ou só no render?** Proposta: **não** mudar o schema
   (não impor `maxItems:3` — quem decide quantas ofertas fortes existem num dia é o gate/
   engine, não o template). O renderer aplica o limite **defensivamente**: renderiza os 3
   primeiros e, se `deals.length > 3`, **não trunca em silêncio** — emite um aviso no log/
   relatório de render (mesmo espírito de "sem corte silencioso" do resto do projeto). Points
   além de 3 são um sinal de que algo upstream está errado, não uma decisão de layout.
   Ratificar?
4. **Contrato canônico = `content/edition.schema.json`, `renderer/email.mjs` realinhado
   (não o contrário).** Ver §0. Ratificar?

---

## 4. Regra do "dia fraco" — fallback obrigatório

`deals` pode legalmente ser um array vazio no schema atual (sem `minItems`). Quando
`deals.length === 0`:

- A seção **Deal Desk é OMITIDA por completo** — nunca renderizada como card vazio, título
  sem conteúdo, ou placeholder. Isto é regra de produto (D-050/D-051: o produto recusa
  quando não há oferta forte, não finge que tem).
- **`signal` carrega a explicação honesta** de por que não há oferta forte hoje, e pode
  incluir a conta que descartou os candidatos (ex.: "Testamos X, Y, Z; nenhum passou do
  portão de vigência/fonte" — sem inventar número, sem promessa).
- **Este comportamento entra no template AGORA**, embora o Digest Engine (que decide
  *quando* o dia é fraco) só exista depois. A vantagem de construir aqui: o template já
  nasce correto, e quando o Digest Engine ligar, ele só decide o conteúdo de `signal` e o
  tamanho de `deals[]` — a lógica de omissão já está testada.

## 5. Checklist Gmail-safe (o que o renderer atual já cobre, e o que falta)

Já presente em `renderer/email.mjs` (manter):
- Tabela `role="presentation"`, uma coluna, 600px, `cellpadding/cellspacing/border=0`.
- CSS 100% inline (sem `<style>` de bloco para estrutura crítica).
- Comentário condicional MSO (`<!--[if mso]-->`) para `border-collapse`/espaçamento Outlook.
- Preheader oculto (`display:none; mso-hide:all`) com padding de caracteres invisíveis.
- Fontes web-safe com fallback: Georgia/Times para a sensação de Fraunces (serif não
  carrega via Google Fonts em e-mail — fallback correto), Courier New para a sensação de
  JetBrains Mono, Arial/Helvetica para Inter.
- Zero JavaScript, zero flexbox/grid, zero emoji.

**Falta (achado desta auditoria):**
- **`<meta name="color-scheme" content="light">` + `<meta name="supported-color-schemes"
  content="light">` ausentes.** Sem isso, clientes com dark mode automático (Gmail app,
  Outlook.com) podem reinverter cores e quebrar o contraste da marca (Ink sobre Paper vira
  Paper sobre Ink sem controle). O sistema é **light-locked** (CLAUDE.md: Paper nunca
  branco puro, Ink fixo no `ContaBlock`) — precisa travar isso explicitamente para e-mail.
- Nenhum teste real em clientes (Gmail web/app, Outlook, Apple Mail) registrado no repo —
  incluir pelo menos uma rodada manual como parte da Definição de Pronto.

## 6. Fixtures de teste (Definição de Pronto usa isto, não uma inspeção visual solta)

Duas fixtures novas em `v2/M2/fixtures/` (ou onde os goldens já vivem), validadas via a
skill **`tl-qa`** (já existe, audita e-mail/JSON/web de uma vez contra o contrato de marca):

1. **`dia-forte.json`** — 3 deals, `fechaLogo` com 2 itens, `contaFeita` presente,
   `oQueEvitar` presente. Cobre o caminho cheio.
2. **`dia-fraco.json`** — `deals: []`, `signal` explicando a ausência com a conta dos
   candidatos descartados, `fechaLogo: []`. Cobre a omissão total do Deal Desk.

## 7. Entregas desta slice

- `renderer/email.mjs` realinhado ao schema atual (camelCase, `fechaLogo[]` como array,
  `contaFeita`/`oQueEvitar` novos campos opcionais consumidos).
- Patch aditivo em `content/edition.schema.json`: `contaFeita` (opcional, `$ref` a
  `$defs/conta`) e `oQueEvitar` (opcional, string). Nenhum campo existente muda de forma;
  edições antigas continuam válidas.
- `<meta name="color-scheme">`/`supported-color-schemes` no `<head>`.
- Lógica de omissão total do Deal Desk quando `deals.length === 0`.
- Aviso (não corte silencioso) quando `deals.length > 3`.
- Duas fixtures (`dia-forte`, `dia-fraco`) validadas via `tl-qa`.

## 8. Fora de escopo

- Dialeto Tiptap para envio real via MCP (§1 — depende da Slice 2 e de M2.7).
- Contrato v2 completo (`schemaVersion`, `estado`, `tl_breakdown`, `fontes[]` por item,
  `predicoes[]`) — isso é o Digest Engine, espera os vetores fecharem.
- Qualquer dado real de campanha — as fixtures são sintéticas/ilustrativas.
- Weekly, Pro, páginas web de edição.

## 9. Definição de pronto

1. `renderer/email.mjs` lê só campos de `content/edition.schema.json` (zero snake_case).
2. `fechaLogo` renderiza como lista de itens, não string única.
3. `dia-forte.json` e `dia-fraco.json` passam `tl-qa` sem violação de regra inviolável.
4. Dia fraco: Deal Desk ausente do HTML gerado (não vazio — ausente); `signal` presente e
   explicando o porquê.
5. `color-scheme` travado light no `<head>`.
6. As 4 decisões do §3 ratificadas pelo operador antes do código.

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
