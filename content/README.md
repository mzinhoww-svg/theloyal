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

## Radar de VPM não-aéreo (Shopping) por SKU

Feed de **VPM observado** (custo de fabricação de resgate não-aéreo) por concorrente,
derivado de **preço público de catálogo** — nunca CMI interno. A fórmula
`VPM = cash_brl / (points/1000)` roda em código determinístico (`scripts/collect/stats.mjs`);
o LLM (OpenRouter) só faz match de SKU, promo-vs-base e extração — nunca a conta.

```bash
npm run collect            # coleta: live se houver SUPABASE_SERVICE_KEY, senão mock
npm run collect -- --mock  # força mock (usa mockCash/mockPoints de content/sku-basket.json)
npm run pro:vpm            # imprime VPM por player da banda mais recente (Supabase/mock)
npm run pro:vpm -- --write content/pro/AAAA-MM.json   # injeta na matriz do Pro (revisar)
```

- **Anti-promo (a dor do não-aéreo):** promo fora da banda; mediana (não média);
  outliers descartados por MAD; amostra mínima 3 senão `n/c`.
- **Supabase:** `sku_catalog`, `sku_sources`, `sku_observations`, `retail_valuations`
  (migration em `supabase/migrations/0001_retail_vpm.sql`). Escrita com SERVICE key
  server-only; anon só lê o agregado público.
- **Admin** (`/admin`, Basic-Auth): seção "Shopping · VPM observado", curadoria do
  catálogo (aprovar/rejeitar) e botão de disparar a rodada (`collect.yml` via
  workflow_dispatch). Escrita em `/admin/sku` e `/admin/collect`.
- **Daily:** seção opcional `shoppingWatch[]` (schema `content/edition.schema.json`)
  renderizada em e-mail/web. **Pro:** coluna `vpmObservado` na matriz competitiva.
- **Automação:** `.github/workflows/collect.yml` (cron diário + manual). Sem secrets,
  roda em mock e grava o payload em `out/collect/`.

> Secrets do Radar (Supabase, Tavily, OpenRouter, GH dispatch): ver
> [`docs/GO-LIVE.md`](../docs/GO-LIVE.md) §3 e `.env.example`.

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

Produto semanal que **consolida a Daily** por Fio (thread ancorado na identidade
canônica `entityKey`/`routeKey` do deal). Seções, na ordem de leitura: tese da
semana → **o que mudou** (`movements` — abriram/seguem/encerraram) → **o que
pesou** (`highlights`) → **onde está o valor** (`ranking`) → **o que vem** (Radar
+ `watch`) → fontes, disclaimer. O Radar deixou de ser o centro: entra como o
bloco "O que vem" (ponte para o Predict). Schema em `content/weekly.schema.json`;
saída em `out/weekly*`. Mesmas regras invioláveis do daily.

Ver o desenho completo em `docs/design/weekly-daily-consolidation.md` e o plano
em `docs/design/weekly-daily-consolidation-plan.md`.

### Fluxo de curadoria (máquina sugere, humano aprova)

```
npm run weekly:draft -- --start AAAA-MM-DD --end AAAA-MM-DD --number N [--prev content/weekly/AAAA-Wpp.json]
```

1. `weekly:draft` lê as edições da Daily da semana (`content/editions/*.json`) e
   grava um **rascunho** `content/weekly/AAAA-Wnn.draft.json`, consolidando por
   Fio: `movements` integral, candidatos de `highlights`, ordem de `ranking` e
   `watch` — tudo com **lineage** `{edition, deal}` até a edição de origem. É
   read-only nas edições, determinístico e **separado do render** (o motor que
   consolida não é o que publica).
2. **Curadoria humana** copia o rascunho para o final `AAAA-Wnn.json` e: escreve
   a **tese** (`signal`), escreve as **notas** dos `highlights`, **aprova** a
   ordem do `ranking`, confirma o `watch`, e **remove o `_meta`** e qualquer
   texto `(rascunho)`. Enquanto o TL Score for digitado, a máquina sugere o
   ranking mas quem publica ordem de valor é a curadoria.
3. `npm run weekly:build -- content/weekly/AAAA-Wnn.json` valida e renderiza
   (e-mail/plain/web). Gates: um Fio em no máximo um bloco; rumor
   (`nao-confirmado`) não ranqueia; nenhum placeholder `(rascunho)` num final.

Idempotência: `weekly:draft` só escreve o `*.draft.json`; **nunca** toca no final
curado. Rodar de novo regenera o rascunho sem destruir a curadoria.

### Costura de acurácia (`out/weekly-signals/AAAA-Wnn.json`)

Junto do rascunho, `weekly:draft` grava um arquivo de **sinais de acurácia**: por
Fio, a transição `verdictStart→verdictEnd` da semana, `tlScoreStart/End`,
`vigenciaEnd` e o lineage. É a **entrada futura do motor de medição de acurácia**
— gerado pelo consolidador, **separado do render e da publicação** (o motor que
publica não é o que mede; nada em `beehiiv-publish`/`render-weekly` importa o
consolidador). Não é veredito nem vai para o e-mail.

## Regras que o validador aplica (gate de publicação)

- Disclaimer oficial presente e íntegro.
- Zero emoji; zero urgência artificial (imperdível/corra/última chance…).
- Cada deal com **fonte**; Conta Block com resultado.
- **Sem vigência confirmada → veredito obrigatoriamente `nao-confirmado`** (overrule 5.4).
- TL Score coerente com a faixa do veredito (85–100 Vale agir … 0–39 Evitaria).
- Se houver `scoreBreakdown`, a soma ponderada fecha com o `tlScore`.
- Toda fonte com URL válida.
