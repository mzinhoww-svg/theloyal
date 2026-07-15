# Auditoria profunda — Forecast & Predict (The Loyal)

> **Escopo:** auditoria de leitura. Nenhum código, dado, migration, snapshot,
> backfill ou digest foi alterado. Levantamento de contexto, evidências e
> hipóteses de causa para embasar decisões posteriores.
>
> **Data da auditoria:** 2026-07-15 · **Banco:** Supabase `qjqnqcsdnpvvmyzkavoq` (the-loyalty) ·
> **Ledger no momento da auditoria:** `campaigns` = 2.438 linhas; `tipo=transferencia` = 488.
>
> **Método:** leitura de `lib/forecast.ts`, `lib/predict-engine.ts`, camadas
> `lib/admin-*.ts`, telas `app/admin/(panel)/*`, scripts `scripts/*.mjs`,
> `supabase/functions/campaigns/index.ts`, migrations e RFC-009; reprodução da
> lógica dos motores em SQL contra o banco real; agentes de exploração paralelos
> para telas, ingestão, digest e testes.

---

## 1. Resumo executivo

Existem **dois motores distintos** com nomes cruzados: `forecast` (recorrência
simples, `lib/forecast.ts`, `/admin/forecast`) e `predict v2`
(`campaign_predict_v2`, hazard/sobrevivência, `lib/predict-engine.ts`,
`/admin/predict`). **Só o Forecast chega ao leitor**; o Predict é exclusivamente
de admin.

Os cinco achados mais graves:

1. **~140 de 488 campanhas de transferência (29%) são invisíveis aos motores** por
   não terem data resolvível — e **142 delas são campanhas ATIVAS (`status='continua'`),
   recentes (criadas nos últimos 60 dias) e permanentes (`vigencia_fim='na'`)**. É a
   causa direta de "campanhas recentes não entram no cálculo". (§4, §5, §8, §15)
2. **A janela de "18 meses" não existe em código.** Nenhum filtro de data em SQL,
   TS ou MJS. O motor consome a tabela inteira; **263 de 483 campanhas (54%) são
   mais antigas que 18 meses** e ainda assim entram na série. (§4, §8)
3. **Nenhum motor detecta outliers.** Um intervalo de 943 dias entra cru na
   média/mediana/hazard e joga a data prevista para ~1,5 ano no futuro, sem alerta. (§8, §16)
4. **`windowDate` usa a data de FIM (`vigencia_fim`) como âncora da série em ~90%
   dos casos**, porque `vigencia_inicio` é nulo em 438 de 488 registros. A cadência
   é medida fim-a-fim, não início-a-início. (§6, §8)
5. **O snapshot que alimenta o Weekly (`content/forecast.json`) foi gerado com 119
   linhas de ledger** (2026-07-14), enquanto o banco tem 2.438. O radar semanal
   está desconectado do estado atual. (§12)

Respostas diretas às perguntas de fechamento estão em §18/§19 e no chat de entrega.

---

## 2. Arquitetura atual

```
Portais ──ingest (edge fn, 3×/dia)────────────┐
Sitemaps ─backfill/backfill-daily (edge fn)──►─┤► news_raw ──campaigns (edge fn, LLM llama-4-maverick, a cada 5min)──► campaigns (tabela única)
          backfill_tracker → backfill_queue ───┘        (processed=false)         upsert onConflict=id                     │
                                                                                                                            │
        ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ├──► lib/forecast.ts  (buildForecast)  ──► lib/admin-forecast.ts ─► /admin/forecast, /admin/observability
        │                                       └► scripts/forecast.mjs ─► content/forecast.json (snapshot) ─► render-weekly.mjs ─► Weekly
        │                                                                                                   └► (radarDaily é só cópia-cola manual p/ Daily)
        └──► lib/predict-engine.ts (buildPredict) ─► lib/admin-predict.ts ─► /admin/predict  ─► predict_snapshots  (NÃO chega ao leitor)
```

Fatos estruturais:

- **Motor Forecast** — `lib/forecast.ts` (`buildForecast`, `radarItems`,
  `upcomingWindows`). Espelhado à mão em `scripts/forecast-engine.mjs`
  (comentário `lib/forecast.ts:16` — "Ao alterar o algoritmo aqui, replique lá";
  **sem teste que garanta o espelho**).
- **Motor Predict v2** — `lib/predict-engine.ts` (`buildPredict`,
  `MODEL_VERSION="campaign_predict_v2"`, `BACKTEST_VERSION="walk_forward_v1"`).
- **Nomes cruzados na navegação** (`components/admin/Sidebar.tsx:31-32`):
  `/admin/forecast` recebe o hint "Janelas previstas" mas roda o motor de
  *recorrência*; `/admin/predict` recebe "Motor de recorrência" mas roda o motor
  *preditivo*. Vocabulário de confiança incompatível: `em-formacao` (forecast) vs
  `insuficiente` (predict); `minSamples` 2 vs 3.
- **Extração única**: `supabase/functions/campaigns/index.ts` é o único escritor da
  tabela `campaigns`. `ingest` e `backfill` só populam `news_raw` (os edge
  functions `ingest`/`backfill` **não estão versionados**, só no Supabase —
  `supabase/functions/README.md:7-14`).
- **RFC-009** existe: `docs/architecture/rfc/RFC-009-predict-engine-v2.md`
  (Status: Proposto). Descreve o modelo-alvo (series_key de 6 partes, dedup_key,
  catálogo de aliases, readiness com backfill-completeness). **A maior parte é
  spec, não implementação.**

---

## 3. Linhagem de dados

| Etapa | Entrada | Processamento | Saída | Fonte de verdade | Consumidores | Riscos |
|---|---|---|---|---|---|---|
| Fonte externa | Portais / sitemaps | ingest/backfill edge fns | HTML/RSS bruto | Site do portal | ingest/backfill | Cobertura desigual → lacunas históricas |
| Notícia bruta | URL do artigo | fetch → linha | `news_raw` (`url,title,published_at,fetched_at,processed,error`) | `news_raw` | extrator `campaigns` | Notícia com `error` vira `processed=true` (some da fila) |
| Extração | `news_raw.processed=false` | LLM llama-4-maverick, temp 0.1, prompt JSON estrito | `{campaigns:[…]}` | Edge fn `campaigns/index.ts:31-42` | upsert | Sem validação de enum/bounds; datas podem vir `null` |
| Campanha candidata | JSON do LLM | `makeId`, `deaccent`, `vigencia_fim??"na"` | linha p/ upsert | `campaigns/index.ts:79-141` | `campaigns` | `id=origem-destino-tipo-vigencia_fim` — URL fora da chave |
| Validação | — | filtra entradas falsy (`index.ts:107`) | linhas válidas | — | — | **Praticamente inexistente** (§5) |
| Campanha persistida | linhas | `upsert onConflict=id` | `campaigns` | tabela `campaigns` | motores, admin, digest | Reprocesso com `vigencia_fim` diferente duplica |
| Backfill | sitemaps | crawl → `backfill_tracker`/`backfill_queue` → `news_raw` | notícias históricas | `campaigns` (via news_raw) | extrator | `origin=backfill/daily`; progresso ≠ campanhas válidas |
| Série histórica | `campaigns` | `windowDate` + `normProgram` + `collapseWaves` | eventos por rota/cluster | `lib/forecast.ts` / `lib/predict-engine.ts` | motores | Sem data → row invisível; sem filtro de janela |
| Forecast | eventos | mediana de intervalos | janela + confiança | `buildForecast` | admin, `forecast.json` | Sem outlier; minSamples 2 |
| Predict | eventos | hazard ponderado + backtest | P{7..180}, bônus, gate | `buildPredict` | admin, `predict_snapshots` | Não chega ao leitor |
| Snapshot | resultado | serialização | `forecast_snapshots` / `predict_snapshots` / `content/forecast.json` | tabelas / arquivo | Weekly / auditoria | `forecast.json` gerado com 119 linhas (stale) |
| Digest | snapshot / radar manual | render | Daily/Weekly/Pro | edição JSON / `forecast.json` | Beehiiv/web | Daily é manual e pode divergir; Weekly lê snapshot stale |
| Beehiiv/web | HTML | publish | e-mail/página | Beehiiv | leitor | Nenhum recálculo em render |
| Tela admin | `campaigns` (limit 2000) | recomputa ao vivo | UI | `/admin/*` | operador | limit<total → drop silencioso (§4) |

**Fonte de verdade de armazenamento é única e correta**: backfill e notícias
recentes escrevem na **mesma** tabela `campaigns`. O problema não é a origem dos
dados, é o que o motor lê dela (janela, datas nulas, chave de série).

---

## 4. Backfill

1. **Onde está "18 meses"?** Só num comentário: `lib/forecast.ts:4` ("aproveitando
   o backfill de 18 meses"). **Nenhuma constante, config ou filtro de data.**
   `grep '18 mes|lookback|windowMonths'` → só o comentário.
2. **Fixo/config/nominal?** **Nominal.** Não é aplicado em lugar nenhum.
3. **Qual campo de data filtra a entrada no motor?** Nenhum. O motor não filtra
   por data; ele *seleciona* a data-da-janela por linha com `windowDate`
   (`lib/forecast.ts:111-117`): prioridade `vigencia_inicio` → data no `id`
   (`…-YYYY-MM-DD`) → `vigencia_fim`. Nunca `observed_at`/`first_seen`.
4. **O fetch é limitado por quê?** `scripts/forecast.mjs:69` →
   `campaigns?select=*&order=observed_at.desc&limit=2000`. O admin
   (`lib/admin-forecast.ts:157-159` e `lib/admin-predict.ts:33-34`) usa
   `campaigns?select=…&limit=2000` **sem `order`**. Com 2.438 linhas, ~438 são
   descartadas arbitrariamente (sem ordenação). ⚠️ Risco adicional: o `max-rows`
   padrão do PostgREST pode reduzir ainda mais.
5. **Busca notícias ou campanhas?** Backfill busca **notícias**; escreve em
   `backfill_tracker`, `backfill_queue` e `news_raw`. **Nunca escreve em
   `campaigns` direto.**
6. **Recentes e backfill na mesma tabela?** Sim — ambos convergem em `news_raw` e
   depois em `campaigns` pelo mesmo extrator. Distinguíveis só por
   `campaigns.origin` (`auto`/`backfill`/`daily`).
7. **Backfill cria campanhas fora dos 18 meses?** Sim (2023-02 em diante). Ex.:
   `livelo-connectmiles-transferencia-2023-12-12` tem `first_seen=2026-07-12`,
   `created_at=2026-07-13`, mas vigência de dez/2023.
8. **Campanhas antigas continuam disponíveis?** Sim, todas — sem expurgo.
9. **Há limpeza/limitação antes do cálculo?** Só o `limit=2000` do fetch e o
   descarte de linhas sem `windowDate`. Nenhuma winsorization/truncamento.
10. **Toda a tabela ou últimos 18 meses?** **Toda a tabela** (até 2000 linhas).
11. **Datas nulas/invertidas?** 438/488 têm `vigencia_inicio` nulo;
    `vigencia_fim` é **TEXT** e aceita lixo (`'na'`, etc.).
12. **Datas inferidas pela IA?** Sim — `vigencia_inicio`/`vigencia_fim` vêm da
    extração LLM (`index.ts:31-42`); o prompt proíbe inventar, mas o valor é do modelo.
13. **Distinção entre datas:** `news_raw.published_at`/`fetched_at` (coletor);
    `campaigns.vigencia_*` (LLM); `first_seen=published_at??hoje`;
    `last_seen`/`observed_at=hoje` (extração). `windowDate` usa só vigência.
14. **Reprocessar URL duplica?** Sim se o LLM extrair `vigencia_fim`/origem/destino/tipo
    diferente (chave `id` muda). Mesma tupla → upsert (sem duplicar).
15. **Páginas republicadas?** `first_seen` é sobrescrito no upsert
    (`index.ts:133`); `last_seen`/`observed_at` resetam para hoje.
16. **Progresso = quê?** URLs **coletadas** para `news_raw` (contadores
    `tracker`/`queue`), **não** campanhas válidas. Backfill pode marcar 100% com
    backlog de extração pendente e/ou artigos sem campanha/sem data → **"concluído"
    ≠ "ledger populado".** (`app/admin/(panel)/backfill/page.tsx:21-57`)

**Estados de fila:** `news_raw.processed` (bool) + `error`; `erro` ⇒ `processed=true`
(`index.ts:161`), some da fila permanentemente sem reprocesso manual.
`backfill_queue.status` (`pending`/done/error); `backfill_tracker` conta
`urls_found` vs `urls_inserted` (URLs, não campanhas).

---

## 5. Notícias recentes

| Aspecto | Backfill | Notícias recentes |
|---|---|---|
| Origem | Sitemaps dos portais | Feeds/HTML dos portais |
| Job | `backfill`/`backfill-daily` edge fn | `ingest` edge fn |
| Frequência | admin-triggered ("vários") | `ingest-*`, 3×/dia |
| Janela | nominal 18m (não aplicada) | nenhuma |
| Extrator | **`campaigns` edge fn (mesmo)** | **`campaigns` edge fn (mesmo)** |
| Modelo/prompt/schema | llama-4-maverick, prompt `index.ts:31-42` | idêntico |
| Deduplicação | `id=origem-destino-tipo-vigencia_fim` | idêntico |
| Validação | mínima (`deaccent`, `??"na"`) | idêntica |
| Tabela destino | `news_raw` → `campaigns` (`origin=backfill/daily`) | `news_raw` → `campaigns` (`origin=auto`) |
| Disponibilidade no Forecast | imediata **se** houver data válida + `tipo=transferencia` | idem |
| Disponibilidade no Predict | idem (min 3 eventos) | idem |

Respostas: (1) `ingest`; (2) 3×/dia; (3) portais; (4) dedup por `id` compartilhado;
(5-6) **mesmo extrator/prompt/modelo/schema**; (7) uma notícia pode gerar N
campanhas (`campaigns:[…]`); (8) uma campanha pode vir de várias notícias e colapsa
por `id`; (9-10) mescla por upsert `onConflict=id`, prevalece a última escrita;
(11) **não há aprovação** — campanha auto-extraída é usada pelo motor no instante do
upsert; (12) atraso = ciclo do extrator (5 min) + backlog; (13) **sim** — erro de
extração deixa a campanha visível no admin mas fora do motor (sem data →
`windowDate` nulo); (14) notícias com `error` não são consideradas; (15) sem filtro
de fonte confiável/relevância — o LLM decide se há campanha.

---

## 6. Modelo de campanha

Colunas reais de `public.campaigns` (via `information_schema`):

| Coluna | Tipo | Nulo | Origem | Editável | Entra série | Entra data | Entra bônus | Entra confiança |
|---|---|---|---|---|---|---|---|---|
| `id` | text | não | calculado (`makeId`) | não | chave (data trailing) | **sim** (fallback) | não | não |
| `origem` | text | não | observado (LLM) | sim | **sim** (chave rota) | não | não | não |
| `destino` | text | não | observado (LLM) | sim | **sim** (chave rota/cluster) | não | não | não |
| `tipo` | text | não | observado (LLM) | sim | **filtro** (=transferencia) | não | não | não |
| `percentual` | numeric | sim | observado (LLM) | sim | não | não | **sim** | não |
| `range_low` | numeric | sim | observado | sim | não | não | não | não |
| `paridade` | text | sim | observado | sim | não | não | não | não |
| `vigencia_inicio` | **date** | sim | inferido (LLM) | sim | não | **sim (1ª prioridade)** | não | não |
| `vigencia_fim` | **text** | sim | inferido (LLM) | sim | não | **sim (3ª prioridade)** | não | não |
| `status` | text | não | calculado | sim | **ignorado pelo motor** | não | não | não |
| `origin` | text | sim (`'daily'`) | calculado | sim | ignorado | não | não | não |
| `first_seen` | date | sim | derivado | não | ignorado | não | não | não |
| `last_seen` | date | sim | extração | não | ignorado | não | não | não |
| `observed_at` | date | sim | extração | não | **ordena o fetch** | não | não | não |
| `created_at` | timestamptz | sim (`now()`) | inserção | não | ignorado | não | não | não |
| `tl_score`,`verdict`,`cpm`,`tier`,`notes`,`used_in`,`source_url`… | vários | sim | editorial/observado | sim | ignorado pelo motor | não | não | não |

**Campos que o modelo do RFC-009 exige mas NÃO existem no schema:** `tipo_campanha`,
`mercado`, `segmento`, `mecanica`, `percentual_base`, `percentual_maximo`,
`percentual_clube`, `series_key`, `dedup_key`, `confianca_extracao`,
`sources_count`. Consequência: hoje **não há como distinguir bônus base × máximo ×
clube, nem segmentação, nem mercado** — tudo colapsa em `percentual` único.

---

## 7. Chave analítica da série

Os dois motores agrupam em **duas visões**: `route` (origem→destino) e `cluster`
(→destino). Código:

- Forecast: `lib/forecast.ts:289` `` `${origem}→${destino}` `` (rota) e `:295`
  `destGroups` por `destino` (cluster).
- Predict: `lib/predict-engine.ts:534` `` `${origem}→${destino}` `` (rota) e `:532`
  `byCluster` por `destino`. O `seriesKey` **impresso** é
  `` `${origem ?? "*"}|${destino}|transferencia|brasil|todos|percentual` ``
  (`:454`) — os 4 últimos campos são **constantes hardcoded**, não derivados.

Para ambos:
- **Ignorados na chave:** `tipo` (só filtra =transferencia), `percentual`, `status`,
  `origin`, mercado/segmento/mecânica (não existem).
- **Nulos:** `origem`/`destino` vazios após `normProgram` ⇒ linha descartada
  (`forecast.ts:284`).
- **Aliases:** `PROGRAM_ALIASES` hardcoded (`forecast.ts:120-130`): `azul
  fidelidade`/`tudoazul`→`azul`, `latam pass`→`latampass`, etc. **`bb` ≠
  `bb-empresas` de propósito.** Grafias fora da lista **não** são unificadas.
- **Clube × público:** não separados (não há campo). Campanhas `tipo=clube` (237)
  simplesmente não entram (filtro é `=transferencia`).
- **Bônus base × máximo:** só existe `percentual`; Predict usa o **maior** percentual
  da data como proxy da onda (`predict-engine.ts:190-193`).
- **Parceiros/países diferentes:** cluster junta tudo por destino
  (origens/parceiros diferentes viram uma série só).
- **Duplicatas:** colapsadas por `collapseWaves` (≤3 dias) → mesma onda.

**Exemplo real — cluster `→connectmiles`:**

```json
{
  "series_key": "*|connectmiles|transferencia|brasil|todos|percentual",
  "campaign_count": 4,
  "campaigns": [
    {"id":"livelo-connectmiles-transferencia-2023-12-12","start_date":null,"end_date":"2023-12-12","source":"livelo","bonus_base":40,"bonus_max":null,"segment":null,"included":true,"reason":"wdate=id-trailing (=vigencia_fim)"},
    {"id":"esfera-connectmiles-transferencia-2024-02-22","start_date":null,"end_date":"2024-02-22","source":"esfera","bonus_base":45,"bonus_max":null,"segment":null,"included":true,"reason":"wdate=id-trailing"},
    {"id":"esfera-connectmiles-transferencia-2024-09-20","start_date":null,"end_date":"2024-09-20","source":"esfera","bonus_base":75,"bonus_max":null,"segment":null,"included":true,"reason":"wdate=id-trailing"},
    {"id":"livelo-connectmiles-transferencia-2026-07-12","start_date":null,"end_date":"2026-07-12","source":"livelo","bonus_base":40,"bonus_max":null,"segment":null,"included":true,"reason":"wdate=id-trailing"},
    {"id":"esfera-connectmiles-transferencia-na","start_date":null,"end_date":"na","source":"esfera","bonus_base":65,"segment":null,"included":false,"reason":"wdate=null (vigencia_fim='na', id sem data) → DESCARTADA"}
  ]
}
```

A **rota** `livelo→connectmiles` tem só 2 dessas (2023-12-12 e 2026-07-12) — as
duas intermediárias são da origem `esfera`, rota diferente.

---

## 8. Cálculo dos intervalos

Pseudocódigo fiel (idêntico nos dois motores, salvo o peso de recência do Predict):

```
para cada linha:
  se normProgram(tipo) != "transferencia": pula
  d = windowDate(linha)   # vigencia_inicio | data no id | vigencia_fim | null
  se d == null: pula                       # <-- 140 linhas caem aqui
  o = normProgram(origem); dst = normProgram(destino)
  se !o ou !dst: pula
  agrupa d em routeGroups[o→dst] e destGroups[dst]  (Set de datas → dedup exato)
ondas = collapseWaves(sort(datas), epsilon=3)       # ≤3 dias = mesma onda, pega a mais antiga
intervals = [daysBetween(ondas[i-1], ondas[i]) for i in 1..n]
med = median(intervals); mean; stdev; cv = stdev/mean
# Forecast: center = ultima + (med||30); rola +med até center>=hoje (guard<240); janela = center ± half
# Predict: survival(t)=fração ponderada de intervals>t; P(H)=1-S(d+H)/S(d); centralDate=hoje+mediana(resíduos)
```

Respostas: (1-4) usa `windowDate` — **início se existir, senão FIM** (pois
`vigencia_inicio` é nulo em 90%); nunca publicação/captura; (5) ordena ascendente;
(6) dedup exato por `Set` + colapso ≤3 dias; (7-8) colapso trata sobreposição/onda;
(9) campanha multi-dia entra pela data-âncora só; (10) duas no mesmo dia → uma onda;
(11) data nula → **linha descartada**; (12) datas futuras entrariam (não há),
`center` rola pra frente; (13) ativas e encerradas tratadas igual (status
ignorado); (14) segmentadas não distinguidas; (15) **sem limite máximo de
intervalo**; (16-17) **sem detecção de outlier / winsorization / MAD / IQR**
nos motores (o `rejectOutliers` de `scripts/collect/stats.mjs` é do pipeline de
Shopping, não daqui); (18) **943 dias é aceito sem alerta**; (19) entra em
média/mediana/desvio/hazard; (20) empurra a data prevista para o futuro e derruba a
confiança via CV alto.

**Intervalos anômalos reais (nível rota, >365 dias):**

| Série (rota) | Campanha anterior | Campanha seguinte | Intervalo | Motivo provável | Forecast? | Predict? |
|---|---|---|---:|---|---:|---:|
| livelo→connectmiles | 2023-12-12 | 2026-07-12 | **943** | Intermediárias em outra rota (esfera); silêncio real de ~2 anos | Sim (prevê Fev/2028) | **Bloqueia** (n=2<3) |
| portobank→azul | 2024-10-23 | 2026-07-14 | 629 | Rota rara, 2 eventos | Sim | Bloqueia (n=2) |
| livelo→azul | 2023-02-24 | 2024-08-28 | 551 | Lacuna histórica | Sim | depende de n |
| credicard→latampass | 2024-10-30 | 2026-03-01 | 487 | Cadência esparsa real | Sim | depende |
| livelo→smiles | 2023-02-24 | 2024-06-14 | 476 | Lacuna backfill | Sim | depende |
| itau→smiles | 2024-09-16 | 2026-01-02 | 473 | Cadência esparsa | Sim | depende |
| interloop→azul | 2024-09-25 | 2025-12-05 | 436 | Rota rara | Sim | depende |
| smiles→latampass | 2024-11-01 | 2025-12-25 | 419 | Cadência esparsa | Sim | depende |

Contagem: **>365d = 8 rotas; >540d = 3; >900d = 1**. Datas anteriores ao backfill:
263 campanhas <18m; sem data válida: 140; datas futuras: 0; duplicatas exatas
(o,d,wdate): 0 (colapso resolve).

---

## 9. Forecast

- **Objetivo:** prever a próxima janela de cada rota/cluster por recorrência do
  histórico. É **projeção estatística, nunca veredito** (`lib/forecast.ts:11`).
- **Hipótese:** intervalos entre ondas são estáveis o suficiente para que
  `última + mediana` estime a próxima.
- **Entradas:** ondas (datas colapsadas) + percentuais.
- **Amostra mínima:** `minSamples=2` → `<2` = `em-formacao` (sem previsão).
- **Estatística:** `median`, `mean`, `stdev` (amostral, `n-1`), `cv=stdev/mean`
  (`forecast.ts:149-164, 233`).
- **Próxima data:** `center = addDays(última, med||30)`, rolando +med até `≥hoje`
  (guard 240). `half=min(12,max(3,round(stdev/2)||3))`; janela = `center±half`.
- **Confiança** (`classify`, `:180-198`): `alta` se `samples≥4 & cv≤0.35`; `media`
  se `samples≥3 & cv≤0.6`; senão `baixa`. Cadência: `mensal` (24–37d, cv≤0.4),
  `esparsa` (>75d) ou `irregular`.
- **Outliers / séries curtas / ativas / silêncio / bônus:** sem tratamento
  especial; status ignorado; `typicalPercent=median(percents)`.
- **Overrides:** `forecast_overrides` (pin/mute/confidence) aplicados em
  `admin-forecast.ts:101-113`.
- **Persistência/saída:** `forecast_snapshots` (admin) e `content/forecast.json`
  (pipeline). **Consumidores:** `/admin/forecast`, `/admin/observability`, Weekly.

**Exemplo reproduzível — rota `livelo→connectmiles` (headline dos 900 dias):**

```
Ondas usadas:      2023-12-12, 2026-07-12   (as de esfera são de OUTRA rota)
Intervalos:        [943]
Média:             943   Mediana: 943   Desvio: 0   CV: 0
Última considerada: 2026-07-12
Próxima calculada:  2026-07-12 + 943 = 2028-02-10  (não rola: já é futuro)
half = min(12, max(3, round(0/2)||3)) = 3
Janela:            2028-02-07 a 2028-02-13
Cadência:          esparsa (mediana 943 > 75)
Confiança:         baixa (samples 2 < samplesMedia 3)
```

→ Forecast **prevê uma data em Fevereiro/2028** (a ~1,5 ano) a partir de um único
intervalo de 943 dias. Este é o mecanismo das "datas previstas muito distantes".

---

## 10. Predict v2

- **Objetivo:** dois modelos por série — **A (quando)**: hazard empírico ponderado
  por recência → `P{7,15,30,60,90,180}` monotônico + data central + janela; **B
  (quanto)**: distribuição empírica de percentuais → top-3 candidatos somando 1.
- **Diferença do Forecast:** probabilidades condicionais a `days_since_last`
  (censura à direita), peso exponencial de recência (meia-vida 4 eventos), backtest
  walk-forward, e **gate com bloqueio**.
- **Entradas:** ondas + percentuais (mesmo `windowDate`/`normProgram`/`collapseWaves`).
- **Curva:** `survival(t)` = fração ponderada de intervalos > t; `P(H)=1-S(d+H)/S(d)`;
  overdue (`S(d)=0`) → 1 (`predict-engine.ts:242-270`).
- **"Onda":** datas ≤3 dias colapsadas (`collapseWaves`), âncora = mais antiga.
- **Data mais provável:** `hoje + mediana(resíduos condicionais)`; janela = quartis
  25/75 dos resíduos.
- **Bônus:** maior percentual por data → distribuição ponderada → top-3 + `outros`.
- **Gate** (`:313-365`): `n<3` → `insufficient_history` (bloqueia). Base por amostra
  (`≥10`=alta, `≥6`=media); rebaixa por CV (>0.6 → baixa; >0.35 → media) e por
  backtest fraco (`windowHitRate<0.5` ou `<3` obs). ⚠️ `backfill_incomplete` e
  `data_quality_blocked` são **declarados mas nunca atribuídos** (`:21-22`).
- **Backtest** (`:371-408`): walk-forward; métricas `medianDateErrorDays`,
  `windowHitRate`, `exactBonusAccuracy`, `bonusAccuracy5pp`.
- **Outliers/recentes/censura:** sem remoção de outlier; recência pondera intervalos
  recentes MAIS (o gap de 660d recente pesa 1.0); censura via `days_since_last`.
- **Overrides:** **nenhum** (não há tabela de override para o predict).
- **Snapshots:** `predict_snapshots` (`saveSnapshot`, upsert `series_key,as_of_date`).
- **Consumidores:** **só `/admin/predict`.** Não chega a nenhum digest.

**Exemplo reproduzível — cluster `→connectmiles` (n=4, previsto por ambos):**

```
Ondas: 2023-12-12, 2024-02-22, 2024-09-20, 2026-07-12
Intervalos: [72, 211, 660]   (mediana 211, média 314)
days_since_last = 2026-07-15 - 2026-07-12 = 3
Pesos de recência (meia-vida 4): 660→1.0, 211→0.841, 72→0.707  (o gap gigante pesa MAIS)
Gate: n=4 ≥ 3 → não bloqueia; base "baixa" (n<6); CV≈0.98>0.6 → mantém baixa + warning
Modelo A: como days_since_last=3 é pequeno, P30/P90 dominadas pela cauda longa (660d) → baixas
Modelo B: bônus top-3 ~ {40%, 75%, 45%} ponderados por recência
Confiança: baixa (+ "intervalos irregulares", "backtest com poucas observações")
```

→ Mesma série: a **rota** `livelo→connectmiles` é **bloqueada** pelo Predict (n=2)
enquanto o Forecast prevê Fev/2028; o **cluster** é previsto por ambos com confiança
baixa. Divergência 100% atribuível a (a) chave de série e (b) `minSamples` distinto.

---

## 11. Comparação Forecast × Predict

| Dimensão | Forecast | Predict v2 |
|---|---|---|
| Objetivo | próxima janela por recorrência | quando (hazard) + quanto (bônus) + backtest |
| Fonte de dados | `campaigns` (limit 2000) | `campaigns` (limit 2000) — **mesma query** |
| Chave da série | origem→destino / →destino | idêntica (+ seriesKey impresso com 4 constantes) |
| Janela histórica | tabela inteira (sem filtro) | idêntica |
| Amostra mínima | **2** | **3** |
| Outlier | nenhum | nenhum |
| Próxima data | última + mediana(intervalos) | hoje + mediana(resíduos condicionais) |
| Probabilidade | não tem (só janela±half) | P{7,15,30,60,90,180} monotônico |
| Bônus | `median(percentual)` sem rótulo | distribuição top-3 + outros |
| Confiança | samples+CV | samples+CV+backtest (rebaixa) |
| Backtest | não | walk-forward (mas exibido só p/ 1 série) |
| Overrides | pin/mute/confidence | **nenhum** |
| Persistência | `forecast_snapshots` + `forecast.json` | `predict_snapshots` (não lido na UI) |
| Tela | `/admin/forecast`, `/admin/observability` | `/admin/predict` |
| Digest | **Weekly (auto) + Daily (cópia manual)** | **nenhum** |
| Limitações | minSamples 2 → janelas ±3d de 1 gap; sem outlier | não chega ao leitor; gate 3; sem override |

**Séries divergentes** (mesmos dados, resultados diferentes):

| Série | Forecast | Predict | Causa | Mais defensável | Dado ou modelo? |
|---|---|---|---|---|---|
| rota `livelo→connectmiles` | prevê Fev/2028, baixa | **bloqueia** (n=2) | minSamples 2 vs 3 | Predict (2 pontos não preveem) | **modelo** |
| cluster `→connectmiles` | ~Fev/2027, baixa | previsto, baixa+warnings | recência pondera gap 660d | Predict (mostra P e backtest) | modelo |
| qualquer rota de 2 ondas | prevê | bloqueia | gate distinto | Predict | modelo |
| qualquer série com 1 gap >900d | data distante sem alerta | idem sem alerta | ausência de outlier em ambos | nenhum | **dado + modelo** |

---

## 12. Uso na Digest

| | Daily | Weekly | Pro |
|---|---|---|---|
| Motor | **nenhum em render** — radar manual no JSON da edição | **Forecast** (`forecast.json.digest.radarWeekly`) | **nenhum** (sem radar) |
| Arquivo/tabela | `content/editions/NNNN.json` (`ed.radar`) | `content/forecast.json` (snapshot) | `content/pro/*` |
| Quando gerado | quando o editor digita | `npm run forecast` (pré-gerado); lido em render | n/a |
| Automático/manual | **manual** | automático + override manual (`wk.radar`) | n/a |
| Data mostrada | texto livre em `window` | `formatWindow(start,end)` | n/a |
| Probabilidade | não | não (Forecast não tem) | n/a |
| Bônus | `~X%` | `~X%` (`typicalPercent`) | n/a |
| Confiança | pill `alta/media/baixa` | idem | n/a |
| "Não confirmado" | não se aplica (radar ≠ veredito) | idem | n/a |
| Nota metodológica | `RADAR_NOTE_DEFAULT` | idem | n/a |
| Disclaimer | no rodapé do produto | idem | idem |
| Pode estar stale | **sim** (digitado à mão) | **sim** (snapshot de 119 linhas) | n/a |
| Recalcula em render | não | não | não |
| Editor sobrescreve | totalmente (é manual) | sim (`wk.radar`) | n/a |
| Risco Forecast×Predict simultâneos | baixo p/ leitor (Predict não sai); **alto risco Daily(manual)×Weekly(auto) divergirem** | idem | n/a |

**Evidência de divergência real:** `content/editions/0028.json:102-120` (Daily,
manual) diz Latam Pass "5 janelas · ~21 dias · última 08/07", janela "17 jul a 10
ago", bônus "~23%". O snapshot `content/forecast.json:22-53` (mesmo programa) diz "6
janelas · ~8 dias · última 2026-07-13", `typicalPercent:20`. **Contradizem-se.** E
`content/forecast.json` foi gerado com `ledgerRows:119`
(`generatedAt:2026-07-14T11:56`) — o banco hoje tem 2.438.

**Exemplo de bloco `radar[]` (snapshot → Weekly):**

```
campaigns → buildForecast(rows) → cluster {route:"→latampass", ...}
  → upcomingWindows(fc, {horizonDays:21, minConfidence:"baixa"})
  → radarItems() → { label:"Latam Pass", confidence:"baixa",
                     window:"9 jul a 2 ago", basis:"6 janelas · cadência irregular ~8 dias …",
                     bonus:"~20%" }
  → forecast.json.digest.radarWeekly → render-weekly.mjs resolveRadar() → e-mail/web
```

---

## 13. Administração

**`/admin/forecast`** — produto de operação do motor de recorrência.

| Capacidade | Estado | Evidência |
|---|---|---|
| Editar parâmetros (config) | **Existe** | form 8 campos → `forecast_config` (`forecast/actions.ts:19-47`) |
| Overrides pin/mute/confidence | **Existe** | `forecast_overrides` (`actions.ts:50-82`); mute retira do radar |
| Criar/ver snapshots | **Existe** | `recalcSnapshotAction` + tabela + trend |
| Registrar justificativa | Parcial | campo "Nota" no override; nada em snapshot |
| Inspecionar campanhas da série | **Não existe** | só Sparkline de intervalos + `basis`; sem link p/ `/admin/campanhas` |
| Excluir outlier / dropar onda | **Não existe** | override é por série inteira |
| Reprocessar/recalcular | **Existe** | `force-dynamic` + botão "Recalcular + snapshot" |
| Promover resultado à Digest | **Não existe** | `radarDaily/Weekly` calculados mas **não renderizados** na página |
| Comparar Forecast × Predict | **Não existe** | telas/engines separados |
| Ver backtest | **Não existe** | Forecast não tem backtest |
| Histórico/auditoria | Parcial | snapshots agregados; override upsert sobrescreve sem trilha |

**`/admin/predict`** — inspeção do motor v2.

| Capacidade | Estado | Evidência |
|---|---|---|
| Editar parâmetros | **Não existe** | `DEFAULT_PREDICT_CONFIG` hardcoded; `buildPredict` só recebe `asOf` |
| Overrides | **Não existe** | — |
| Criar snapshots | **Existe** | `snapshotAllAction` → `predict_snapshots` |
| **Ver** snapshots | **Não existe** | `getSnapshots` existe mas **nunca é importado** pela página |
| Ver ondas/gaps da série | Parcial | `HistoryCell` mostra datas + gaps (ex. "943d"), mas não os registros |
| Inspecionar campanhas | Parcial | só datas, sem `id`/link |
| Excluir outlier | **Não existe** | — |
| Ver backtest | Parcial | só no `DetailCard` da série de maior histórico; invisível p/ o resto |
| Estados de erro | Existe | pill "bloqueado" + `blockReason` |
| Histórico/auditoria | **Não existe** | snapshots escritos mas não lidos |

**Bug de cópia:** `observability/page.tsx:156` diz "menos de 3 janelas" mas o
`minSamples` do Forecast é **2** (e configurável).

---

## 14. Avaliação da interface (comportamento atual)

Problemas observados (documentados, sem redesign):

- **Janela vira ±3 dias com 2 pontos:** `stdev=0 → half=3`; uma rota de 1 intervalo
  gera janela apertada de aparência precisa, com só "baixa" como ressalva — e isso
  propaga ao radar. **Excesso de precisão.**
- **"Confiança" sem o porquê:** nas tabelas do Predict os `warnings` (CV,
  backtest) só aparecem no `DetailCard`; para as demais linhas o rebaixamento é
  inexplicado. Forecast depende da coluna `basis`.
- **Percentual sem rótulo:** Forecast renderiza `typicalPercent` como `"{v}%"` cru
  ao lado da rota (`forecast/page.tsx:92`) — pode ser lido como probabilidade.
- **Bônus máximo como esperado:** Predict usa `max` do percentual da data como proxy
  da onda; o rótulo diz "provável", mas a origem é o máximo observado.
- **Intervalo anômalo:** visível como gap ("943d") no Predict, **invisível** no
  Forecast (escondido em Sparkline). Nenhum dos dois permite excluí-lo.
- **Falta "nº de campanhas"** como coluna no Forecast (só no `basis`).
- **Falta "última campanha"** como coluna no Forecast.
- **Falta "atualizado em":** Predict **não mostra `asOf`** em lugar nenhum; Forecast
  mostra `generatedFor` como **data, não timestamp**.
- **Linguagem de certeza/ganho:** limpa — disclaimers fortes ("nunca chuta uma
  data", "o motor bloqueia em vez de chutar"), sem urgência. **Porém** o disclaimer
  obrigatório da CLAUDE.md (regra 10) **não** acompanha o payload de `radarItems` —
  teria que ser adicionado no template do digest.

---

## 15. Qualidade dos dados

Método: SQL contra `qjqnqcsdnpvvmyzkavoq`, reproduzindo `windowDate`+`normProgram`.
(A leve variação 483/488 vem de `lower(tipo)` vs `lower(trim(tipo))` — sem impacto
material.)

| Métrica | Valor | Consulta |
|---|---:|---|
| Campanhas totais | 2.438 | `count(*) from campaigns` |
| `tipo=transferencia` | 488 | `where lower(tipo)='transferencia'` |
| Transf. com data válida (entram no motor) | ~348 | `windowDate not null` |
| **Transf. SEM data (invisíveis)** | **140** | `windowDate null` |
| — dessas, ativas `continua`+`vigencia_fim='na'`+recentes | **142** | `status='continua'` |
| Transf. com `vigencia_inicio` | 50 (10%) | `vigencia_inicio not null` |
| Transf. **sem** `vigencia_inicio` (usa data do id/fim) | 438 (90%) | `vigencia_inicio null` |
| Transf. **anteriores a 18 meses** | 263 (54%) | `wdate < hoje-18m` |
| Transf. sem `percentual` | 80 | `percentual null` |
| Rotas distintas (válidas) | 97 | `count(distinct o,d)` |
| — previsíveis Forecast (≥2 ondas) | 45 | `waves>=2` |
| — previsíveis Predict (≥3 ondas) | 29 | `waves>=3` |
| — 1 onda (em-formacao) | 52 | `waves=1` |
| Clusters (destinos) | 23 | `count(distinct d)` |
| — clusters ≥3 ondas | 8 | `waves>=3` |
| Duplicatas exatas (o,d,wdate) | 0 | colapso resolve |
| Datas futuras | 0 | `wdate>hoje` |
| Intervalos >365 / >540 / >900 (rota) | 8 / 3 / 1 | §8 |
| `origin=auto` / `daily` (transf.) | 461 / 27 | — |

Distribuição de tipo (todos): `compra` 1221, `transferencia` 483, `clube` 237,
`cartao` 217, `hotelaria` 138, `estrutural` 112, resto <10. Status: `vencida` 1330,
`continua` 1095, `vence-72h` 11, `vence-hoje` 2. **Não há campo/flag "excluída do
motor"** — a exclusão é implícita (sem data ou tipo≠transferencia).

---

## 16. Caso específico dos >900 dias

**Única ocorrência: rota `livelo→connectmiles`, 943 dias.**

1. **Série:** `livelo→connectmiles`.
2. **As duas campanhas:**
   - `livelo-connectmiles-transferencia-2023-12-12` — 40%, `status=vencida`,
     `origin=auto`, `vigencia_inicio=null`, `vigencia_fim="2023-12-12"`,
     `first_seen=2026-07-12`, `created_at=2026-07-13`. **Veio do BACKFILL.**
   - `livelo-connectmiles-transferencia-2026-07-12` — 40%, `status=vencida`,
     `origin=daily`, `vigencia_inicio=null`, `vigencia_fim="2026-07-12"`,
     `first_seen=2026-07-10`, `created_at=2026-07-11`. **Veio de NOTÍCIA RECENTE.**
3. Fontes: uma do crawl de sitemap (auto/backfill), outra do ingest diário.
4. Entraram no banco em julho/2026 (backfill recém-rodado).
5. Origens: backfill × notícia recente (confirmado por `origin` e `first_seen`).
6-7. **Há campanhas intermediárias, mas em OUTRA rota:** `esfera→connectmiles`
   (2024-02-22, 45%; 2024-09-20, 75%). A chave de rota `origem→destino` as separa
   de `livelo→connectmiles`.
8. **Aliases:** `connectmiles`/`connect miles` unificam (alias existe); `livelo` e
   `esfera` são origens legítimas distintas — não é erro de alias.
9-11. Sem erro de ano, sem troca dia/mês; a data usada é `vigencia_fim` via id
   trailing (não é data de notícia — `windowDate` evita `observed_at`).
12. Há uma terceira `esfera→connectmiles` (`-na`, 65%, `continua`) **descartada**
   por não ter data.
13. **Filtros de status:** nenhum — `vencida` entra normalmente.
14. **Afeta Forecast:** único intervalo = 943 → prevê Fev/2028 (§9).
15. **Afeta Predict:** rota bloqueia (n=2); no cluster o gap de 660d (recente,
   peso 1.0) domina o hazard e empurra a data.
16. **Causa mais provável (classificada):** **problema de chave da série**
   (granularidade origem→destino fragmenta o histórico do destino) **combinado
   com lacuna de cobertura do backfill** (silêncio real de ~2 anos entre campanhas
   `livelo→connectmiles`) **e ausência de detecção de outlier**. Não é "poucos
   dados" isolado: o cluster `→connectmiles` tem 4 eventos e ainda assim exibe um
   gap de 660 dias porque o backfill não capturou campanhas intermediárias dessa rota.

---

## 17. Testes existentes

`node --test tests/*.test.mjs`. **Nenhum toca os motores** (`grep
predict|forecast|buildForecast|buildPredict|radar|backfill|backtest|windowDate
tests/` = 0 hits).

| Arquivo | Cenário | Cobre | Lacuna p/ Forecast/Predict |
|---|---|---|---|
| `tests/entities.test.mjs` | registro de entidades, aliases, lineage Pro | memória editorial | nada de series_key/dedup |
| `tests/lib.test.mjs` | `verdictForScore`, verdicts, pesos TL, regex de gate | regras editoriais | nada de probabilidade/confiança |
| `tests/stats.test.mjs` | `vpm`, `median`, `rejectOutliers`, bands (Shopping) | stats do **Shopping** | **não** é a stats do predict (implementação separada) |
| `tests/taxonomy.test.mjs` | fonte única de verdicts | taxonomia | nada de confiança/readiness do predict |

**Não testado (risco):** `windowDate` (prioridade), `collapseWaves` (epsilon),
chave de série, `gate`/readiness, `backtestSeries`, monotonicidade P7≤…≤P180,
`radarItems`/`upcomingWindows`, outliers/intervalos longos, merge de config, e o
**espelho `forecast-engine.mjs` vs `forecast.ts`**.

---

## 18. Inconsistências e hipóteses

| # | Problema | Classe | Evidência | Impacto | Motores | Produtos | Gravidade | Hipótese de causa | Como confirmar |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 140 transf. sem data descartadas; 142 ativas recentes | dado + normalização | §5,§15 | recentes não entram | ambos | Daily/Weekly | **Crítica** | `vigencia_inicio` nulo + `vigencia_fim='na'` + id sem data | rodar `windowDate` no ledger |
| 2 | "18 meses" não existe; 54% <18m entram | janela histórica | §4 | séries poluídas por histórico antigo | ambos | todos | **Alta** | comentário virou lei sem implementação | grep + query <18m |
| 3 | Sem detecção de outlier | modelo | §8 | 943d vira previsão de 2028 | ambos | Daily/Weekly | **Alta** | motor confia em mediana crua | reproduzir §9 |
| 4 | `windowDate`=fim em 90% | dado + modelo | §6,§8 | cadência fim-a-fim | ambos | todos | Alta | `vigencia_inicio` quase sempre nulo | contar nulos |
| 5 | limit 2000 < 2438, sem order | persistência | §4 | ~438 linhas caem, talvez recentes | ambos | todos | Alta | `campaigns?...&limit=2000` | `count(*)` vs 2000 |
| 6 | Chave rota fragmenta destino | chave da série | §7,§16 | gaps artificiais (943d) | ambos | Daily/Weekly | Alta | rota origem→destino ignora o destino compartilhado | ver §16 |
| 7 | `minSamples` 2 vs 3 | modelo/config | §11 | mesma série prevista×bloqueada | ambos | admin | Média | defaults divergentes | comparar telas |
| 8 | `forecast.json` gerado com 119 linhas | integração/operacional | §12 | Weekly stale | Forecast | Weekly | **Alta** | pipeline não re-rodado após backfill | `head forecast.json` |
| 9 | Daily radar manual diverge do snapshot | editorial/integração | §12 | Daily×Weekly contradizem | Forecast | Daily/Weekly | Média | radar digitado à mão | diff 0028 × forecast.json |
| 10 | Predict não chega ao leitor | integração | §2,§12 | motor "melhor" invisível | Predict | — | Média | nenhum render importa `buildPredict` | grep imports |
| 11 | Predict snapshots gravados, não lidos | interface | §13 | operador não vê histórico | Predict | admin | Baixa | `getSnapshots` não importado | ler página |
| 12 | Sem validação na extração | dado | §5 | `tipo`/`%`/datas sem checagem | ambos | todos | Média | prompt confia no LLM | ler `index.ts` |
| 13 | Dedup por `vigencia_fim` (URL fora da chave) | deduplicação | §5 | reprocesso pode duplicar/colidir | ambos | todos | Média | `makeId` | reprocessar URL |
| 14 | Readiness `backfill_incomplete`/`data_quality_blocked` mortos | modelo | §10 | sem guarda de completude | Predict | admin | Média | `gate` nunca atribui | ler `:313-365` |
| 15 | Nomes/hints cruzados forecast×predict | interface | §2,§13 | confunde operador | ambos | admin | Baixa | `Sidebar.tsx:31-32` | ler sidebar |
| 16 | Zero teste dos motores + espelho sem guarda | operacional | §17 | regressões silenciosas | ambos | todos | **Alta** | cobertura ausente | rodar suíte |
| 17 | "menos de 3 janelas" ≠ minSamples 2 | interface | §13 | copy incorreta | Forecast | admin | Baixa | hardcode | ler `observability` |

---

## 19. Decisões conceituais pendentes

| Decisão | Alternativas | Prós / Contras / Impacto |
|---|---|---|
| Motor canônico | (a) Predict; (b) Forecast; (c) híbrido (RFC-009 §0: predict quando `ready`, senão forecast) | (c) recomendado pelo RFC — mais defensável, mas exige unificar telas e vocabulário |
| Forecast continua? | manter como fallback / aposentar | manter cobre séries curtas (n=2); aposentar reduz divergência |
| Predict substitui Forecast? | sim / só onde `ready` | substituir total deixa muitas séries sem previsão (n<3) |
| Chave da série | rota / cluster / rota+cluster / series_key RFC-009 (6 partes) | cluster reduz gaps mas mistura parceiros; series_key exige colunas novas |
| Janela histórica | 18m real / 24m / toda / decaimento | janela real corta ruído antigo; decaimento (já no predict) é mais suave |
| Backfill + recentes | manter tabela única (correto) + flag de qualidade | já unificado no armazenamento; falta gate de qualidade |
| Campanhas antigas | manter / pesar por recência / cortar | predict já pesa; forecast não |
| Segmentadas | ignorar / série própria / flag | exige colunas `segmento`/`mecanica` (não existem) |
| Clube × público | juntar / separar | hoje `tipo=clube` nem entra; decisão depende de coluna |
| Bônus base × máximo | um `percentual` / separar base/max/clube | exige schema novo (RFC-009 §5) |
| Duplicatas | dedup por URL / por conteúdo / manter `id` | mudar chave `id` afeta upsert e histórico |
| Outliers | winsorize / MAD / IQR / cap de intervalo | qualquer um resolve o 943d; MAD já existe no Shopping |
| Amostra mínima | unificar (3? 4?) | alinhar forecast e predict elimina divergência #7 |
| Exibir probabilidade | P30/P90 / faixa / P + horizonte | só o predict tem; exigiria expor predict ao leitor |
| Exibir janela | faixa / data central / ambos | faixa é mais honesta que data única |
| Exibir bônus | provável+prob / faixa | evitar máximo como esperado |
| Exibir confiança | com motivo / pill só | expor `warnings`/`basis` reduz opacidade |
| "Não confirmado" | manter só p/ veredito / estender ao radar | radar hoje some (em-formacao) em vez de "não confirmado" |
| Integração à Digest | recomputar em render / snapshot fresco + carimbo | render-time evita staleness; snapshot precisa carimbo de idade |
| Aprovação editorial | nenhuma / gate por confiança | hoje zero aprovação p/ o motor |
| Registrar overrides | manter upsert / trilha append-only | upsert perde histórico |
| Medir acurácia real | backtest (já existe) / acompanhar previsto×realizado | expor backtest nas tabelas |

---

## 20. Anexos — exemplos reproduzíveis

### A. `windowDate` (fonte)
```ts
// lib/forecast.ts:111
export function windowDate(row: CampaignRow): string | null {
  if (isValidISODate(row.vigencia_inicio)) return String(row.vigencia_inicio).slice(0, 10);
  const idMatch = typeof row.id === "string" ? row.id.match(TRAILING_DATE) : null;
  if (idMatch && isValidISODate(idMatch[1])) return idMatch[1];
  if (isValidISODate(row.vigencia_fim)) return String(row.vigencia_fim).slice(0, 10);
  return null;
}
```

### B. Fetch sem filtro de data (ambos os motores)
```ts
// lib/admin-forecast.ts:157 e lib/admin-predict.ts:33
rest<CampaignRow>("campaigns?select=id,tipo,origem,destino,percentual,vigencia_inicio,vigencia_fim&limit=2000")
// scripts/forecast.mjs:69
`${SUPABASE_URL}/rest/v1/campaigns?select=*&order=observed_at.desc&limit=2000`
```

### C. SQL de reprodução dos intervalos (essência)
```sql
with n as (
  select id,
    coalesce(vigencia_inicio,
             (substring(id from '(\d{4}-\d{2}-\d{2})$'))::date,
             case when vigencia_fim ~ '^\d{4}-\d{2}-\d{2}' then left(vigencia_fim,10)::date end) as wdate,
    lower(origem) o, lower(destino) d
  from campaigns where lower(tipo)='transferencia'),
w as (select distinct o,d,wdate from n where wdate is not null),
l as (select o,d,wdate, lag(wdate) over (partition by o,d order by wdate) prev from w)
select o||'→'||d rota, prev, wdate, (wdate-prev) gap from l where (wdate-prev)>365 order by gap desc;
```

### D. Registros do caso 943 dias
```
livelo-connectmiles-transferencia-2023-12-12 | 40% | vencida | auto  | vig_fim=2023-12-12 | first_seen=2026-07-12
esfera-connectmiles-transferencia-2024-02-22 | 45% | vencida | auto  | vig_fim=2024-02-22  (rota diferente)
esfera-connectmiles-transferencia-2024-09-20 | 75% | vencida | auto  | vig_fim=2024-09-20  (rota diferente)
livelo-connectmiles-transferencia-2026-07-12 | 40% | vencida | daily | vig_fim=2026-07-12 | first_seen=2026-07-10
esfera-connectmiles-transferencia-na         | 65% | continua| auto  | vig_fim='na' → DESCARTADA
```

### E. Config efetiva dos motores
```
Forecast (forecast_config id=1 / default): waveEpsilon 3, minSamples 2, samplesAlta 4,
  samplesMedia 3, cvAlta 0.35, cvMedia 0.6, horizonDaily 10, horizonWeekly 21
Predict (DEFAULT_PREDICT_CONFIG, hardcoded):  waveEpsilon 3, minSamples 3, samplesMedia 6,
  samplesAlta 10, cvMedia 0.6, cvAlta 0.35, recencyHalfLifeEvents 4, recentWindowEvents 5, backtestMinObs 3
```

### F. Arquivos/tabelas de referência
- Motores: `lib/forecast.ts`, `lib/predict-engine.ts`, `scripts/forecast-engine.mjs`, `scripts/forecast.mjs`
- Camadas admin: `lib/admin-forecast.ts`, `lib/admin-predict.ts`, `lib/admin-db.ts`, `lib/admin-series.ts`
- Telas: `app/admin/(panel)/{forecast,predict,observability,backfill,noticias,campanhas,digests}/*`
- Extração: `supabase/functions/campaigns/index.ts`, `supabase/functions/README.md`
- Migrations: `supabase/migrations/000{1,2,4,5,7}_*.sql`
- Snapshot/digest: `content/forecast.json`, `content/forecast.schema.json`, `scripts/render-weekly.mjs`, `content/editions/0028.json`
- Spec: `docs/architecture/rfc/RFC-009-predict-engine-v2.md`
- Tabelas: `campaigns`, `news_raw`, `backfill_queue`, `backfill_tracker`, `forecast_config`, `forecast_overrides`, `forecast_snapshots`, `predict_snapshots`
```
