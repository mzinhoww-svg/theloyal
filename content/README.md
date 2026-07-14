# Conteúdo editorial — The Loyal

Pipeline de validação, renderização e publicação das edições do Daily.
Segue a estrutura e os checklists do Operating Manual v1. **Sem dependências**
(scripts ESM Node puros).

## Fluxo

```bash
npm run validate    # QA de cada edição → out/qa/NNNN.md (bloqueia em erro)
npm run render      # gera out/email/NNNN.html e out/plain/NNNN.txt
npm run publish     # valida + escreve content/latest.json e content/index.json
npm run edition     # validate → render → publish
npm run forecast    # gera content/forecast.json a partir do ledger (Supabase)
npm run weekly      # valida + renderiza o weekly digest (e-mail/plain/web)
npm run beehiiv     # publica no Beehiiv o conteúdo já renderizado (draft por padrão)
```

O `forecast` **não envia nada** — só gera o artefato de previsão. Sem rede/
credenciais opera em modo offline (preserva o `forecast.json` atual).

O `publish` **não envia e-mail** — apenas escreve os índices locais. O envio ao
Beehiiv é o passo `beehiiv`, e por padrão cria só um **rascunho**.

> Ativação em produção (GitHub Actions, secrets, checklist de go-live): ver
> [`docs/GO-LIVE.md`](../docs/GO-LIVE.md).

### Fluxo canônico vs. legado

Existem dois conjuntos de renderer/schema no repositório. O **canônico** é este,
em `scripts/` + `content/edition.schema.json`, wired em todos os `npm run`
(`validate`, `render`, `render:web`, `render:system`, `publish`, `qa`, `pro`,
`beehiiv`, `edition`).

O conjunto em `renderer/*.mjs` + `scripts/render-daily.mjs` +
`scripts/validate-daily.mjs` + `renderer/edition.schema.json` é **legado** (protótipo
"The Loyal Daily", com schema em snake_case incompatível com `content/editions/`).
Não está ligado a nenhum `npm run` e não participa do build. Mantido por ora; não
usar no fluxo atual.

### Publisher Beehiiv (`npm run beehiiv`)

Publica a peça **já renderizada** (`out/email/NNNN.html`) sem reescrever nada.
Roda o QA gate antes; é idempotente (o mesmo conteúdo nunca dispara duas vezes);
registra tudo em `content/beehiiv-status.json` e em `out/beehiiv/NNNN.*`.

```bash
npm run beehiiv                                   # última edição, rascunho
npm run beehiiv content/editions/0028.json        # edição específica
npm run beehiiv -- --schedule 2026-07-09T08:00:00-03:00   # agenda o envio
npm run beehiiv -- --publish                      # confirma e envia agora
npm run beehiiv -- --test voce@exemplo.com        # registra pedido de teste
npm run beehiiv -- --force                        # re-dispara conscientemente
```

Sem `BEEHIIV_API_KEY`/`BEEHIIV_PUBLICATION_ID` (ou com `--dry-run`) roda em
**modo mock**: valida e grava o payload em `out/beehiiv/NNNN.request.json` sem
tocar na API. Endpoint real: `POST /v2/publications/{pub_id}/posts` (escopo
`posts:write`, beta/Enterprise). Campos do post derivados da edição:
`subject → title` + `email_settings.subject_line`, `preheader →
email_settings.preview_text`, `slug → web_settings.slug` (default
`daily-NNNN`), `tags → content_tags`, `scheduledAt → scheduled_at`.

## Modelo da edição (`content/editions/NNNN.json`)

| Campo | Obrigatório | Nota |
|---|---|---|
| `number`, `date`, `weekday`, `publishTime`, `readingMinutes` | sim | cabeçalho |
| `subject`, `preheader` | não | assunto/preheader do e-mail |
| `slug`, `tags`, `productType`, `scheduledAt` | não | metadados do post no Beehiiv (Publisher) |
| `signal` | sim | O sinal do dia |
| `deals[]` | sim | Deal Desk (ver abaixo) |
| `fechaLogo[]` | não | itens que vencem em ≤72h |
| `radar` | não | Radar de janelas: `{ note?, windows: [{ label, confidence, window, basis?, bonus? }] }` (projeção, nunca veredito) |
| `sources[]` | sim | `{ label, url }` — URL http obrigatória |
| `disclaimer` | sim | frase oficial completa |
| `illustrative` | não | marca a edição como exemplo |

### Deal
`category`, `title`, `context`, `conta { rows: [chave, valor][], result: [chave, valor] }`,
`verdict`, `verdictNote`, `source`, `sourceUrl`, `vigencia` (ISO), `tlScore`,
`scoreBreakdown?` (os 8 critérios do Operating Manual 5.2).

## Camada de previsão (Radar de janelas)

O motor é `lib/predictions.ts` (fonte da verdade, TS) com espelho ESM em
`scripts/predictions.mjs` (usado pelo pipeline de render sem build). Ele prevê a
**próxima janela** de cada transferência por recorrência do histórico do ledger,
aproveitando o backfill:

- usa a **data real** da janela (`vigencia_inicio` → data no `id` →
  `vigencia_fim`), nunca `observed_at`/`first_seen` (artefatos de ingestão);
- normaliza programas e produz duas visões: **por rota** (origem→destino) e
  **por programa** (cluster do destino, consolidando campanhas program-wide);
- colapsa "ondas" quase simultâneas antes de medir cadência;
- confiança calibrada por **regularidade** (coef. de variação), não só contagem;
- é **projeção estatística, nunca veredito nem garantia** — sem base suficiente
  → `em-formacao`, que jamais vira linha de Radar.

`npm run forecast` grava `content/forecast.json` (schema em
`content/forecast.schema.json`) com `routes`, `clusters` e fatias prontas para os
digests (`digest.radarDaily`, `digest.radarWeekly`). O admin (`/admin`) e o
weekly consomem o motor; o **daily** pode trazer um bloco `radar` opcional na
edição.

## Weekly digest (`content/weekly/AAAA-Wnn.json`)

Produto semanal centrado no Radar. Se o JSON **não** trouxer `radar`, o render
puxa `digest.radarWeekly` de `content/forecast.json`. Seções: tese da semana,
Radar, movimentos do ledger (`movements` — abriram/seguem/encerraram),
destaques, o que monitorar, fontes, disclaimer. Schema em
`content/weekly.schema.json`; saída em `out/weekly*`. Mesmas regras invioláveis
do daily (validadas por `scripts/render-weekly.mjs` e pelo gate global `qa`).

## Regras que o validador aplica (gate de publicação)

- Disclaimer oficial presente e íntegro.
- Zero emoji; zero urgência artificial (imperdível/corra/última chance…).
- Cada deal com **fonte**; Conta Block com resultado.
- **Sem vigência confirmada → veredito obrigatoriamente `nao-confirmado`** (overrule 5.4).
- TL Score coerente com a faixa do veredito (85–100 Vale agir … 0–39 Evitaria).
- Se houver `scoreBreakdown`, a soma ponderada fecha com o `tlScore`.
- Toda fonte com URL válida.
