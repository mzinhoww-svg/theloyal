# Auditoria Forense — Forecast e Predict

> Auditoria técnica, estatística, operacional e de produto dos motores **Forecast**
> (`lib/forecast.ts`) e **Predict v2** (`lib/predict-engine.ts`), baseada na
> **implementação real** e nos **dados reais** do Supabase `qjqnqcsdnpvvmyzkavoq`
> (the-loyalty), consultado em 2026-07-15.
>
> Complementa `docs/MAPA-FUNCIONAL-OPERACIONAL.md` (contexto). **Etapa de leitura:**
> nenhum código, banco, campanha, backfill, snapshot, parâmetro ou publicação foi
> alterado. Todas as consultas SQL usadas estão na §24; arquivos de evidência em
> `docs/auditoria/`. Onde a evidência não fecha, está escrito
> **"Não foi possível confirmar com os dados disponíveis."**

---

## 1. Resumo executivo

Os dois motores estão tecnicamente implementados e ligados às telas, mas produzem
resultados **estatisticamente não confiáveis** porque a **camada de dados está
corrompida na dimensão temporal** — e ambos, por design, usam justamente o campo
corrompido e descartam o confiável.

**Os cinco fatos centrais (todos confirmados nos dados):**

1. **A data que os motores usam não é a data em que a campanha aconteceu.** Ambos
   derivam a "data da janela" (`windowDate`) de `vigencia_inicio` → **data embutida
   no `id` (que é a `vigencia_fim`)** → `vigencia_fim`. E **ignoram deliberadamente**
   `observed_at`/`first_seen` (comentário em `lib/forecast.ts:108-110`). Como
   `vigencia_inicio` é nulo em **451 das 507** transferências, a data efetiva é a
   `vigencia_fim` extraída por LLM.

2. **A `vigencia_fim` extraída tem erro de ano sistemático.** Em 369 pares
   (`window_date`, `first_seen`), a média de `first_seen − window_date` é **+310
   dias**; **156** linhas têm `first_seen` ~1 ano depois da `window_date`; **283 de
   369 (77%)** têm `first_seen` mais de 180 dias após a `window_date`. Resultado:
   **276 das 364** datas resolvidas caem em **2024**, embora `observed_at` só comece
   em 2025-12 e `created_at` seja todo de 2026-07-11..15.

3. **O intervalo de 943 dias é um erro de data, não uma lacuna.** A única série com
   intervalo > 900 dias — `livelo→connectmiles` — é formada por **dois registros da
   mesma campanha** (Livelo→ConnectMiles 40%, julho/2026): um correto e um com
   `vigencia_fim` **fabricada** como 2023-12-12 a partir de um artigo "*último dia …
   até hoje (12)*". Ver §12 e `docs/auditoria/predict-forecast-lineage.md`.

4. **Backfill e notícia recente não são distinguíveis nem deduplicados.** Não existe
   `origin='backfill'` no banco (só `auto`=480 e `daily`=27); as duas fontes escrevem
   na **mesma** tabela com o **mesmo** upsert por `id`, e como o `id` embute a
   `vigencia_fim`, duas leituras da mesma campanha com datas diferentes **não
   colapsam**.

5. **Forecast e Predict divergem por dados e por modelo, e o que a Digest publica
   está desatualizado.** O artefato `content/forecast.json` reflete **119 linhas /
   23 rotas** (2026-07-14) enquanto o banco vivo tem **~504 transferências / 97
   rotas**; ignora os **3 overrides** existentes no banco; e o **Predict não alimenta
   nenhuma Digest**.

**Consequência de produto:** qualquer janela ou probabilidade exibida hoje é
derivada de uma série cronologicamente incorreta. O redesenho precisa começar pela
**data de ocorrência da campanha** (não pela `vigencia_fim` extraída), pela
**deduplicação por identidade estável** (não por `id`-com-data) e pela **correção do
erro de ano na extração** — antes de qualquer ajuste de modelo.

---

## 2. Limitações da auditoria

- **Banco vivo e mutável.** As tabelas mudam (crons ativos). Duas contagens de
  transferência tiradas com minutos de diferença retornaram 504 e 507 — o banco
  recebeu linhas entre as consultas. Os números aqui são um retrato de 2026-07-15;
  tratam-se de ordens de grandeza estáveis, não de constantes.
- **Reprodução por porta SQL, não pelo motor TS.** Não há credencial de service key
  neste ambiente para rodar o motor TS contra o banco; a reconstrução das séries foi
  feita em SQL replicando fielmente `windowDate`, `normProgram`/`PROGRAM_ALIASES` e a
  aproximação de `collapseWaves` (o colapso ≤3 dias não afeta intervalos > 180 dias,
  então não altera a contagem de anomalias). As reproduções campanha-a-campanha (§12,
  §13) são calculadas à mão a partir das datas reais.
- **Snapshots não guardam os IDs de campanha.** `predict_snapshots`/`forecast_snapshots`
  preservam a **saída**, não o **conjunto de entrada** — não é possível reconstituir
  exatamente quais campanhas geraram um snapshot antigo (§21).
- **RPCs `admin_*` e algumas views não estão versionadas** no repo (só no banco) — o
  que não é observável em SQL foi marcado como não confirmável.

---

## 3. Fontes reais

Consultas na §24. `created_at`/`updated_at`: **`campaigns` tem `created_at` (default
`now()`) mas NÃO tem `updated_at` nem `published_at`** (§4).

| Objeto | Tipo | Writer | Readers | Registros | Data mínima | Data máxima | Papel |
|---|---|---|---|---|---|---|---|
| `campaigns` | tabela | edge fn `campaigns` (upsert por id); pipeline daily | forecast, predict, observability, digests, pro | **2543** (504–507 transf.) | `created_at` 2026-07-11 · `window_date` 2023-02-24 | `created_at` 2026-07-15 · `window_date` 2026-07-15 | **fonte de verdade** (ledger) |
| `news_raw` | tabela | ingest + backfill | edge fn `campaigns`, admin notícias | **40080** (24765 processadas, 1 erro, 16365 sem campanha) | — | — | fonte bruta |
| `backfill_queue` | tabela | backfill | admin backfill | **39922** | — | — | fila de URLs |
| `backfill_tracker` | tabela | backfill | admin backfill | **138** | — | — | sitemaps |
| `forecast_config` | tabela (singleton) | `/admin/forecast` (saveConfig) | forecast (admin + CLI) | 1 | — | `updated_at` | config (verdade dos parâmetros) |
| `forecast_overrides` | tabela | `/admin/forecast` | forecast (admin decorate) | **3** | — | — | ajustes manuais (pin/mute/confidence) |
| `forecast_snapshots` | tabela | `/admin/forecast` (recalc) | (não exibido pela página) | **2** | — | — | snapshot (saída) |
| `predict_snapshots` | tabela | `/admin/predict` (snapshotAll) | **nenhum reader na UI** (`getSnapshots` não é chamado) | **49** | — | — | snapshot **write-only** |
| `content/forecast.json` | artefato (arquivo) | `scripts/forecast.mjs` | `render-weekly.mjs` (radarWeekly) | 1 (119 linhas de ledger) | `generatedFor` 2026-07-14 | idem | **cache/artefato desatualizado** |
| `predict.json` | — | — | — | **não existe** | — | — | Predict não gera artefato |
| Colunas de origem/tempo em `campaigns` | — | — | — | — | — | — | ver §3 abaixo |

**Colunas temporais/de origem de `campaigns`:** `origin` (text, default `daily`;
valores reais: `auto`, `daily` — **`backfill` não existe**), `source_url`,
`source_name`, `first_seen` (date), `last_seen` (date), `observed_at` (date),
`vigencia_inicio` (date), `vigencia_fim` (**text**), `created_at` (timestamptz).
**Ausentes:** `updated_at`, `published_at`.

---

## 4. Esquema real de `campaigns`

Extraído de `information_schema.columns` (§24, Q0). "→motor" = se o campo entra no
cálculo; "→série" = se entra na chave de agrupamento.

| Coluna | Tipo | Nullable | Exemplo real | Escrita por | Natureza | →Forecast | →Predict | →série | Editável admin |
|---|---|---|---|---|---|---|---|---|---|
| `id` | text | NÃO | `livelo-connectmiles-transferencia-2026-07-12` | edge fn (upsert key) | inferida (chave) | **sim (data via regex)** | **sim** | não (mas fornece a data) | não |
| `origem` | text | NÃO | `livelo`, `null`(string), `desconhecido` | edge fn | observada/inferida | sim | sim | **sim (rota)** | não |
| `destino` | text | NÃO | `connectmiles`, `all`, `allaccor` | edge fn | observada/inferida | sim | sim | **sim (rota+cluster)** | não |
| `tipo` | text | NÃO | `transferencia` | edge fn | inferida | **filtro** | **filtro** | fixo na chave | não |
| `percentual` | numeric | SIM | 40, null (1007 nulos) | edge fn | observada | sim (typicalPercent) | sim (bônus) | não | não |
| `range_low` | numeric | SIM | — | edge fn | observada | não | não | não | não |
| `paridade` | text | SIM | `3:1` | edge fn | observada | não | não | não | não |
| `vigencia_inicio` | date | SIM | null (451/507 transf.) | edge fn | observada | **1ª escolha da data** | idem | não | não |
| `vigencia_fim` | **text** | SIM | `2024-02-22`, `na` | edge fn | observada | **fallback via id** | idem | não | não |
| `observed_at` | date | SIM | 2026-07-13 | coleta | inferida | **IGNORADA (design)** | IGNORADA | não | não |
| `first_seen` | date | SIM | 2026-07-12 | coleta | inferida | **IGNORADA** | IGNORADA | não | não |
| `last_seen` | date | SIM | 2026-07-15 | coleta | inferida | não | não | não | não |
| `created_at` | timestamptz | SIM | 2026-07-13 16:48 | default now() | sistema | não | não | não | não |
| `origin` | text | SIM | `auto`, `daily` | edge fn/daily | inferida | não | não | não | não |
| `source_url` | text | SIM | `passageirodeprimeira.com/...` | edge fn | observada | não | não | não | não |
| `source_name` | text | SIM | `melhorescartoes` | edge fn | observada | não | não | não | não |
| `status` | text | NÃO | `continua`, `vencida` | edge fn/calc | calculada | não | não | não | não (só via ledger) |
| `discard_reason` | text | SIM | — | edge fn | calculada | não | não | não | não |
| `notes` | text | SIM | "… [confianca:baixa]" | edge fn | editorial/inferida | não | não | não | não |
| `verdict` | text | SIM | `vale-agir` | **humano (admin)** | editorial | não | não | não | **sim** |
| `tl_score` | integer | SIM | 82 | **humano (admin)** | editorial | não | não | não | **sim** |
| `cpm`/`cpm_value` | text/numeric | SIM | — | edge fn/calc | calculada | não | não | não | não |
| `used_in` | jsonb | SIM | `{pro:[],daily:[],weekly:[]}` | pipeline | editorial | não | não | não | não |
| `tier`, `module`, `valor_leitura`, `regulamento_url` | vários | SIM | — | edge fn | observada | não | não | não | não |

**Campos que o pedido pediu para confirmar e NÃO existem:** `published_at`,
`updated_at`. (Confirmado no `information_schema`.)

---

## 5. Origem dos registros

**Não há coluna que marque backfill vs notícia recente.** `origin` só tem `auto`
(480 transf.) e `daily` (27). A classificação abaixo é **inferência explícita** por
combinação de campos: `daily` = curadoria do pipeline diário; `auto` = extração
automática (backfill/coleta via edge fn, que grava `origin='auto'`); `first_seen`
distante de `created_at` sugere reprocessamento de página histórica.

| Origem (inferida) | Quantidade (transf.) | Data mín. da campanha (`window_date`) | Data máx. | Primeiro insert (`created_at`) | Último insert |
|---|---|---|---|---|---|
| `auto` (backfill/coleta) | 480 | 2023-02-24 | 2026-07-15 | 2026-07-11 | 2026-07-15 |
| `daily` (pipeline) | 27 | 2026-07 (recentes) | 2026-07-15 | 2026-07-11 | 2026-07-15 |
| `backfill` (rótulo) | **0** | — | — | — | — |

**Respostas objetivas:**

1. **Backfill e notícias recentes escrevem na mesma tabela?** **Sim** — ambos em
   `campaigns` via a edge fn `campaigns`.
2. **Mesmo schema?** **Sim** (mesma tabela, mesmas colunas).
3. **Mesmo extrator?** **Sim** — a edge fn `campaigns` (OpenRouter/LLM).
4. **Mesma regra de ID?** **Sim** — `id = origem-destino-tipo-vigenciafim` (embute a
   `vigencia_fim`; `-na` quando ausente).
5. **Mesma normalização?** **Sim** na gravação; a normalização de série
   (`normProgram`) é aplicada só na leitura pelos motores.
6. **Mesma deduplicação?** **Sim** — upsert por `id`. Mas como o `id` embute a data,
   **duas leituras da mesma campanha com datas diferentes geram ids diferentes e NÃO
   deduplicam** (é a causa do caso dos 943 dias).
7. **Uma notícia recente pode substituir uma campanha do backfill?** **Só se o `id`
   coincidir** (mesma origem/destino/tipo/vigencia_fim). Se a `vigencia_fim` diferir
   (inclusive por erro de ano), vira **linha nova**, não substituição.
8. **Uma campanha do backfill pode bloquear uma versão mais recente?** **Não bloqueia**
   — coexistem como linhas distintas (mesma limitação do item 7).
9. **Campos editoriais sobrevivem ao upsert?** **Não foi possível confirmar com os
   dados disponíveis** — o corpo do upsert está na edge fn `campaigns` (Deno, no
   Supabase), não versionado de forma legível aqui; o SQL não revela se `verdict`/
   `tl_score` são preservados no `on conflict`. Risco a validar.
10. **O upsert pode apagar/substituir datas válidas?** Para o **mesmo `id`**, um
    reprocessamento atualiza `last_seen`/`status`; `vigencia_*` podem ser
    sobrescritas pelo novo parse. Para `id` diferente, não. **Confirmação do corpo do
    upsert: não foi possível com os dados disponíveis** (edge fn não versionada).

---

## 6. Dataset analítico reproduzível

Não foi criada tabela. O dataset por campanha elegível é reproduzível pela consulta
abaixo (também usada para gerar `docs/auditoria/predict-forecast-series.csv`). Como o
banco é mutável, o CSV é um retrato de 2026-07-15.

```sql
-- Dataset de auditoria: 1 linha por campanha de transferencia, com a chave de serie
-- e a razao de inclusao/exclusao de cada motor.
with b as (
  select id, origem, destino, tipo, percentual, vigencia_inicio, vigencia_fim,
    observed_at, created_at, origin, source_url, status,
    -- normProgram (PROGRAM_ALIASES) para origem e destino
    (case lower(regexp_replace(trim(origem),'\s+',' ','g'))
       when 'azul fidelidade' then 'azul' when 'latam pass' then 'latampass'
       when 'latam-pass' then 'latampass' when 'tudoazul' then 'azul'
       when 'smiles gol' then 'smiles' when 'connect miles' then 'connectmiles'
       when 'life miles' then 'lifemiles' when 'amex mr' then 'amex-mr'
       when 'membership rewards' then 'amex-mr'
       else lower(regexp_replace(trim(origem),'\s+',' ','g')) end) as o_norm,
    (case lower(regexp_replace(trim(destino),'\s+',' ','g'))
       when 'azul fidelidade' then 'azul' when 'latam pass' then 'latampass'
       when 'latam-pass' then 'latampass' when 'tudoazul' then 'azul'
       when 'smiles gol' then 'smiles' when 'connect miles' then 'connectmiles'
       when 'life miles' then 'lifemiles' when 'amex mr' then 'amex-mr'
       when 'membership rewards' then 'amex-mr'
       else lower(regexp_replace(trim(destino),'\s+',' ','g')) end) as d_norm,
    coalesce(vigencia_inicio::text, substring(id from '\d{4}-\d{2}-\d{2}$'),
      case when vigencia_fim ~ '^\d{4}-\d{2}-\d{2}' then left(vigencia_fim,10) end) as window_date
  from campaigns
)
select id, origem, o_norm, destino, d_norm, tipo, percentual,
  vigencia_inicio, vigencia_fim, window_date, observed_at, created_at, origin, source_url, status,
  case when d_norm<>'' then o_norm||'→'||d_norm end as forecast_series_key,
  case when d_norm<>'' then coalesce(o_norm,'*')||'|'||d_norm||'|transferencia|brasil|todos|percentual' end as predict_series_key,
  (tipo ilike 'transferencia' and window_date is not null and o_norm<>'' and d_norm<>'') as included_forecast,
  case when tipo not ilike 'transferencia' then 'tipo!=transferencia'
       when window_date is null then 'sem window_date (vig_inicio null + id sem data + vig_fim invalido)'
       when o_norm='' then 'origem vazia' when d_norm='' then 'destino vazio' end as forecast_exclusion_reason,
  (tipo ilike 'transferencia' and window_date is not null and d_norm<>'') as included_predict_cluster,
  -- Predict elegivel de fato exige >=3 datas distintas na serie (checar por agregacao a parte)
  case when tipo not ilike 'transferencia' then 'tipo!=transferencia'
       when window_date is null then 'sem window_date'
       when d_norm='' then 'destino vazio' end as predict_exclusion_reason
from b order by d_norm, o_norm, window_date;
```

Notas: (a) o filtro de `tipo` difere entre motores — Forecast usa `normProgram(tipo)`
(trim+lower) e Predict usa `tipo.toLowerCase()` (sem trim); a consulta usa `ilike
'transferencia'` como proxy. (b) A elegibilidade final depende de **≥ minSamples
ondas** por série após colapso (Forecast 2, Predict 3), computada por agregação (§8).

---

## 7. Normalização dos programas

Código real (idêntico para os dois motores — Predict importa `normProgram` de
`lib/forecast.ts:132`):

```ts
const PROGRAM_ALIASES = {
  "azul fidelidade":"azul", "latam pass":"latampass", "latam-pass":"latampass",
  tudoazul:"azul", "smiles gol":"smiles", "connect miles":"connectmiles",
  "life miles":"lifemiles", "amex mr":"amex-mr", "membership rewards":"amex-mr",
};
normProgram(s) = PROGRAM_ALIASES[ lower(trim(s)).replace(/\s+/,' ') ] ?? lower(trim(s))...
```

Distintos reais (transferência, contagem). Amostra dos problemas — a lista completa
está na §24 (Q_norm):

| Campo | Valor encontrado | Contagem | Valor normalizado (atual) | Regra que falta |
|---|---|---|---|---|
| destino | `azul` | 139 | azul | — |
| destino | `azulfidelidade` | 3 | **azulfidelidade** (não vira azul!) | alias sem espaço |
| destino | `azul fidelidade` | 1 | azul | ok |
| destino | `allaccor` | 29 | allaccor | ≠ `all` |
| destino | `all` | 17 | all | **all==allaccor?** ambíguo |
| destino | `accor` | 1 | accor | alias de allaccor |
| destino | `miles&smiles` | 1 | miles&smiles | ≠ smiles (Turkish, correto separar) |
| destino | `passageiro de primeira` | 1 | passageiro de primeira | **fonte extraída como destino** |
| destino | `bancodobrasil` / `bb` | 1 / 1 | separados | alias |
| origem | `interloop` / `inter-loop` / `loop` / `inter` | 13/1/2/10 | 4 séries distintas | aliases de Inter Loop |
| origem | `desconhecido` | 10 | desconhecido | **placeholder → série-lixo** |
| origem | `null` (string literal) | 6 | 'null' | **string "null" vira série** |
| origem | `cartao`/`cartoes`/`cartoes de credito`/`parceiros`/`bancos`/`vantagens` | 5/3/1/4/2/3 | genéricos | **não-programas** |

**Problemas confirmados:** acentos (o `lower(trim)` não remove acento, mas os dados já
vêm sem); caixa (tratada); espaços (tratados); **abreviações e nome comercial
misturados e não normalizados** (`azulfidelidade`, `all`/`allaccor`, `bb`/`bancodobrasil`,
`interloop`/`inter-loop`/`loop`); **parceiro/destino misturados** (`passageiro de
primeira` como destino); **placeholders** (`desconhecido`, `cartao`, `parceiros`,
`bancos`, `todos` via `all`) que **formam séries falsas**; **string `"null"`** como
origem. Campos vazios/`null` de origem existem como o texto `'null'`, não SQL null.

**Ambos usam a mesma normalização?** **Sim** (mesma função). A única divergência é o
**filtro de `tipo`**: Forecast `normProgram(tipo)` (trim), Predict `tipo.toLowerCase()`
(sem trim) — se algum `tipo` tiver espaço à borda, entra num motor e não no outro.

---

## 8. Construção das séries

### 8.1 Forecast (`buildForecast`, `lib/forecast.ts:270`)
- **Chave de agrupamento:** duas — **rota** `origem→destino` e **cluster** `→destino`,
  ambas com `normProgram`.
- **Rota vs cluster:** rota granular (origem+destino); cluster consolida todas as
  origens de um destino.
- **Origem ausente:** se `normProgram(origem)===''` → a linha **não entra na rota**
  (mas entra no cluster, que só exige destino). String `'null'` **não** é vazia → vira
  série `null→destino`.
- **Destino ausente:** `normProgram(destino)===''` → linha descartada.
- **Tipo:** filtro `normProgram(tipo)==='transferencia'` (as demais tipos ignoradas).
- **Aliases:** via `PROGRAM_ALIASES` (incompleto — §7).
- **Segmentadas/Clube/públicas:** **não há distinção** — o motor não lê
  mercado/segmento/mecânica (não existem como colunas); Clube e público entram na
  mesma série.
- **Mesmo destino, origens diferentes:** viram rotas separadas **e** um cluster
  comum.

### 8.2 Predict (`buildPredict`, `lib/predict-engine.ts:516`)
- **Fórmula da `series_key`** (`predictOne:454`):
  `${origem ?? "*"}|${destino}|transferencia|brasil|todos|percentual`.
- **Campos reais usados:** `origem`, `destino` (via `normProgram`), `tipo` (filtro),
  `percentual`, e a data via `windowDate`.
- **Placeholders fixos:** `transferencia` (literal), **`brasil`** (mercado),
  **`todos`** (segmento), **`percentual`** (mecânica) — **não vêm de dado**; são
  constantes. A Fase 0 do RFC-009 (série rica) **não foi implementada**.
- **mercado/segmento/mecânica:** preenchidos como literais fixos → **toda** série tem
  a mesma cauda de chave; não homogeneíza nada.
- **`null`/aliases/tipo/segmentadas/Clube/públicas:** idêntico ao Forecast (mesma
  `normProgram`, mesmo `windowDate`, mesmo `collapseWaves`). Diferença: filtro de tipo
  sem `trim` e `minSamples=3`.

**Séries atuais (banco vivo, 2026-07-15):** ver `predict-forecast-series.csv`.
Resumo:

| Motor | Séries totais | Elegíveis (≥ minSamples) | minSamples |
|---|---|---|---|
| Forecast — rotas | 97 | 48 (≥2 datas) | 2 |
| Forecast — clusters | 23 | 11 (≥2 datas) | 2 |
| **Forecast — total** | **120** | **59** | — |
| Predict — rotas | 97 | 30 (≥3 datas) | 3 |
| Predict — clusters | 23 | 8 (≥3 datas) | 3 |
| **Predict — total** | **120** | **38** | — |

Ou seja: as 120 séries são **as mesmas** nos dois motores (mesmo agrupamento); a
diferença é **quantas passam o gate** — Forecast prevê 59, Predict só 38 (bloqueia 21
séries de 2 amostras que o Forecast "prevê").

---

## 9. Reconstrução campanha por campanha

Reproduções completas de séries representativas (datas reais do banco). Intervalos em
dias entre `window_date` consecutivos; ondas = após `collapseWaves(ε=3)`.

### 9.1 `route:livelo→connectmiles` (anômala — 943 dias)
| Ordem | Campaign ID | window_date | vigencia_fim | observed_at | first_seen | origin | % | Fonte | Incluída |
|---|---|---|---|---|---|---|---|---|---|
| 1 | livelo-connectmiles-…-2023-12-12 | 2023-12-12 | 2023-12-12 | 2026-07-13 | 2026-07-12 | auto | 40 | passageirodeprimeira ("último dia…") | sim |
| 2 | livelo-connectmiles-…-2026-07-12 | 2026-07-12 | 2026-07-12 | 2026-07-12 | 2026-07-10 | daily | 40 | passageirodeprimeira ("prorrogado…") | sim |

Intervalo: **943 dias** (2023-12-12 → 2026-07-12). São a **mesma campanha** (§12).

### 9.2 `route:esfera→azul` (12 ondas, "saudável" na aparência)
Datas (13, uma colapsada): 2024-02-14, 2024-07-28, 2024-08-19, 2024-08-23,
2024-09-18, 2024-09-25, 2024-10-25, 2024-11-16, ~~2024-11-19~~(colapsada, 3d de 11-16),
2025-01-29, 2025-04-27, 2025-08-11, 2025-10-25.
Intervalos (11): **165, 22, 4, 26, 7, 30, 22, 74, 88, 106, 75**.

### 9.3 `route:livelo→smiles` (13 ondas, divergente)
Datas: 2023-02-24, 2023-11-24, 2024-06-14, 2024-08-20, 2024-09-10, 2024-09-18,
2024-09-25, 2024-10-09, 2024-11-27, 2025-01-19, 2025-03-14, 2025-07-21, **2026-07-14**.
Intervalos (12): 273, 203, 67, 21, 8, 7, 14, 49, 53, 54, 129, **359**. O último salto
(2025-07-21 → 2026-07-14 = 359 d) é a campanha real recente contra a pilha mal-datada.

**Tabela de intervalos (consolidada das anomalias >365):** ver
`docs/auditoria/predict-forecast-anomalies.csv` (7 rotas, com as duas datas de cada
gap). As duas campanhas que geram cada distância estão explicitadas lá.

---

## 10. Anomalias temporais

Contagens reais (transferência, banco vivo). Detalhe por série em
`predict-forecast-anomalies.csv`.

| Tipo | Ocorrências | Evidência |
|---|---|---|
| Intervalo > 180 dias | vários (todas as 7 séries abaixo + intervalos internos) | §9, CSV |
| Intervalo > 365 dias | **7 rotas** (+3 clusters) | livelo→connectmiles 943, portobank→azul 629, itau→smiles 473, credicard→latampass 472, smiles→latampass 419, livelo→azul 398, interloop→azul 388 |
| Intervalo > 540 dias | **2** (livelo→connectmiles 943, portobank→azul 629) | idem |
| Intervalo > 900 dias | **1** (livelo→connectmiles 943) | §12 |
| Campanha anterior ao backfill nominal (18m) | **281 datas em 2023–2024** | §5, §6 (windowDate < 2025-01: 281) |
| Campanha com data futura (`window_date` > hoje) | **0** | (mas `vigencia_inicio` máx. 2026-09-15 existe em outros tipos) |
| `vigencia_inicio > vigencia_fim` | **Não foi possível confirmar** de forma limpa: `vigencia_fim` é text (muitos `na`) e `vigencia_inicio` quase sempre null | — |
| Ano aparentemente incorreto | **156 linhas** com `first_seen` ~1 ano após `window_date`; +16 com ~2 anos | §12, lineage |
| Campanhas sobrepostas / mesma onda | massivo em 2024 (cluster azul: 122 datas, dezenas a 1–3 dias) | §9.2, §12 |
| Consecutivas 0–3 dias (colapsáveis) | muitas (cluster azul tem ~30 pares ≤3d) | tratadas por `collapseWaves` |
| Lacuna longa com notícias intermediárias | **16365** notícias processadas sem virar campanha (§16) | risco de intermediárias perdidas |

---

## 11–12. Investigação dos intervalos > 900 dias (caso `livelo→connectmiles`)

**Único caso > 900 dias: `livelo→connectmiles`, 943 dias** (2023-12-12 → 2026-07-12).
Investigação item a item (pedido §11):

1. **Campanhas que o formaram:** as 2 da §9.1.
2–4. **Campos e fontes:** tabela §9.1 e `predict-forecast-lineage.md` (L1).
5. **Backfill vs notícia recente:** A = `origin=auto` (coleta/backfill), B =
   `origin=daily`. Ambas do mesmo blog (passageirodeprimeira), artigos "último dia" e
   "prorrogado" da **mesma** promoção.
6–8. **Intermediárias na rota/aliases/outra rota:** **nenhuma** — a série livelo→connectmiles
   tem só 2 registros; o cluster →connectmiles tem 5 (livelo×2 + esfera×2 + esfera-na),
   e os esfera estão mal-datados em 2024 (deveriam ser 2025 — L2). Não há campanha
   intermediária **real**.
9–11. **Notícias intermediárias em `news_raw`:** há 16365 notícias processadas sem
   campanha e 40080 no total; **não foi possível confirmar** que exista uma notícia
   intermediária específica de livelo→connectmiles entre 2023-12 e 2026-07 sem varrer
   o texto de `news_raw` (não feito para não inflar a análise). Irrelevante para a
   causa: as duas pontas são a **mesma** campanha.
12–13. **Erro de extração / descarte:** sim — erro de **data** (não de descarte).
14–16. **Erro de ano/dia/mês; data da notícia confundida com data da campanha:**
   **confirmado** — o artigo "*…último dia … até hoje (12)*" foi visto em 2026-07-12
   e a `vigencia_fim` saiu **2023-12-12** (ano 2023 e mês 12 fabricados a partir do
   "(12)"). É exatamente "a data foi confundida/inventada".
17. **Campanha antiga em página recente:** não — é campanha **recente** com data
   **antiga inventada**.
18–19. **Colapso de onda / filtro de status removeu intermediárias:** não —
   `collapseWaves(3)` não afeta um gap de 943 d; nenhum filtro de status é aplicado
   pelos motores (eles não filtram por `status`).
20. **Forecast e Predict formam o mesmo intervalo?** Forecast **sim** (usa a série de
   2 pontos e o intervalo 943). Predict **não chega a formar** — bloqueia a série
   (2 < 3).

**Classificação da causa:** **erro de data** (subtipo: **campanha recente extraída
com ano/mês fabricados**), agravada por **deduplicação incorreta** (upsert por `id`
que embute a `vigencia_fim`, então a mesma campanha com data errada não colapsa).

---

## 6b. Janela de 18 meses (investigação)

A afirmação "backfill de 18 meses" aparece **apenas como comentário**
(`lib/forecast.ts:5`: "aproveitando o backfill de 18 meses"). **Não há filtro de 18
meses implementado em nenhum dos motores.** Evidências:

- **Nenhum filtro de data** em `buildForecast`/`buildPredict` — processam **todas** as
  linhas recebidas. As queries do admin puxam `campaigns?...&limit=2000` **sem cláusula
  de data** (`lib/admin-forecast.ts`, `lib/admin-predict.ts`). O CLI usa `order=observed_at.desc&limit=2000`.
- **Constante/parâmetro de 18 meses:** não existe em `forecast_config`, no código dos
  motores nem nas queries. Não há `where window_date > now() - interval '18 months'`.

Diferenciação das janelas:

| Janela | Onde | Valor efetivo |
|---|---|---|
| Descoberta de URLs (backfill) | scripts de backfill / sitemap tracker (**não versionado de forma legível aqui**) | **Não foi possível confirmar** |
| Publicação das notícias | `news_raw` (40080) | sem filtro nos motores |
| Vigência das campanhas | `campaigns.window_date` | **2023-02-24 a 2026-07-15 (~41 meses)** |
| Inserção no banco | `campaigns.created_at` | 2026-07-11 a 2026-07-15 (carga em lote) |
| Usada pelo Forecast | todas as linhas (limit 2000) | ~41 meses, **sem corte** |
| Usada pelo Predict | todas as linhas (limit 2000) | ~41 meses, **sem corte** |

**Respostas objetivas:**
1. **Busca só páginas dos últimos 18 meses?** **Não foi possível confirmar** (config do
   backfill não versionada legível aqui).
2. **Página recente pode mencionar campanha antiga?** **Sim** (é o padrão observado —
   §12).
3. **Extrator grava a data antiga mencionada?** **Sim** (grava `vigencia_fim` do texto,
   inclusive errada).
4. **Há campanhas anteriores aos 18 meses no banco?** **Sim** — 281 datas em 2023–2024;
   5 em 2023.
5. **Os motores filtram essas campanhas?** **Não.**
6. **Qual campo no filtro?** Nenhum (não há filtro).
7. **Filtro antes ou depois da série?** N/A (inexistente).
8. **18 meses é rolling ou fixo?** N/A (não implementado).
9. **Limite máximo para data antiga extraída?** **Não** — `isValidISODate` só valida
   formato/parse; aceita 2023 ou qualquer ano válido.
10. **Validação contra erro de ano?** **Não existe.** Nenhuma checagem `window_date`
    vs `first_seen`/`observed_at` (que revelariam o erro de ~1 ano).

---

## 13. Reprodução do Forecast (execução real conforme o código)

Fórmula (fiel a `analyze`/`classify`, `lib/forecast.ts:180-256`). `now = 2026-07-15`,
config **default** (o artefato diz `configSource: default`).

### 13.1 `esfera→azul` (série "saudável", 12 ondas)
- **Campanhas brutas (13 datas)** e **ondas após colapso (12)**: §9.2 (2024-11-19
  colapsa em 2024-11-16, gap 3 ≤ ε).
- **Intervalos (11):** `165, 22, 4, 26, 7, 30, 22, 74, 88, 106, 75`.
- **Mediana** = 30 · **Média** = 619/11 = 56,27 → `mn=56` · **Desvio (n-1)** = 50,08 →
  `sd=50` · **CV** = 50/56 = **0,89**.
- **Amostra** = 12 · **Classificação:** 12 ≥ `samplesAlta`(4) mas CV 0,89 > `cvAlta`(0,35)
  → não alta; 12 ≥ `samplesMedia`(3) mas CV 0,89 > `cvMedia`(0,6) → não media →
  **confiança `baixa`**. **Cadência:** mediana 30 ∈ [24,37] mas CV > 0,4 → não mensal;
  30 ≤ 75 → **`irregular`**.
- **Centro:** `last`(2025-10-25) + 30 = 2025-11-24; como está no passado, rola +30 até
  passar `now` (8 passos, +240 d) → **2026-07-22**. **half** = min(12, max(3, round(50/2)=25))
  = **12** → **janela 2026-07-10 a 2026-08-03**.
- **Bônus (typicalPercent):** mediana dos % > 0 = **85%**.
- **Overrides aplicados:** depende de `forecast_overrides` (3 no banco) — **não** no
  artefato (`overridesApplied: 0`).
- **Saída ao usuário (basis):** *"12 janelas · cadência irregular ~30 dias (média 56,
  desvio 50) · última 2025-10-25"*, janela "10 jul a 3 ago", bônus "~85%".

**Leitura crítica:** a mediana (30) e a janela mensal **não representam o processo** —
média 56 e desvio 50 (CV 0,89) mostram uma série altamente irregular, cuja
"regularidade mensal" é um artefato da **pilha de datas coladas em 2024** (erro de ano).

### 13.2 `livelo→connectmiles` (anômala, 2 ondas)
- Ondas: `2023-12-12, 2026-07-12`. Intervalos: `[943]`. Mediana=943, média=943,
  desvio=0 (n<2 intervalos → 0), CV=0. Amostra 2 ≥ `minSamples`(2) → **não** em-formação.
- Classificação: 2 < `samplesMedia`(3) → **`baixa`**; mediana 943 > 75 → **`esparsa`**.
- Centro: 2026-07-12 + 943 = **2029-02-11** (já futuro, sem rolagem); half=3 → **janela
  2029-02-08 a 2029-02-14**.
- **Saída:** o Forecast entrega uma previsão de **fevereiro de 2029** com confiança
  "baixa" — a partir de um intervalo **falso** (a mesma campanha duplicada com data
  errada). É o exemplo canônico de por que a série precisa ser corrigida antes do
  modelo.

### 13.3 Série com poucos dados
Qualquer série com **1 onda** → `em-formacao` (sem janela). Ex.: dezenas de rotas de 1
data (`hiltonhonors`, `indigo`, etc.). São exibidas como "em formação".

---

## 14. Reprodução do Predict (execução real conforme o código)

Fiel a `predictOne`/`computeTiming`/`gate`/`backtestSeries` (`lib/predict-engine.ts`).
`asOf = 2026-07-15`, config `DEFAULT_PREDICT_CONFIG` (hardcoded).

### 14.1 `esfera→azul` (12 eventos)
- **Eventos/intervalos:** iguais ao Forecast (mesmo `collapseWaves`): 12 ondas, 11
  intervalos `[165,22,4,26,7,30,22,74,88,106,75]`.
- **`days_since_last`** = 2026-07-15 − 2025-10-25 = **263**.
- **Pesos de recência** (meia-vida 4 eventos): par mais recente peso 1; o mais antigo
  `0,5^(10/4)=0,177`.
- **Sobrevivência S(263):** nenhum intervalo > 263 → **S(263)=0** → **overdue**.
- **Hazard / P{H}:** com `sD=0`, todos os horizontes retornam **P=1,0** →
  **P7=P15=P30=P60=P90=P180=100%**.
- **Resíduos condicionais a 263:** vazios → `rMed=0, rLo=0, rHi=max(7,0)=7` →
  **data central = 2026-07-15**, **janela 2026-07-15 a 2026-07-22**.
- **Distribuição de bônus (Modelo B):** ponderada por recência sobre os % das ondas;
  top-3 dominado pelos valores recentes (ex.: 90/80/100), somando 1 com `bonusOutros`.
- **Backtest walk-forward:** roda de `i=minSamples(3)` a 11 → **9 observações**; erro
  mediano de data, `windowHitRate`, acurácia de bônus calculados pelo motor (valores
  exatos **não reproduzidos à mão**; a UI os computa — mecanismo em §13/§14).
- **Gate/confiança:** 12 ≥ `samplesAlta`(10) → base **alta**; CV 0,89 > `cvMedia`(0,6)
  → **rebaixa para baixa** + warning "intervalos irregulares (CV=0.89)"; backtest com
  ≥3 obs (não rebaixa por poucas obs, mas se `windowHitRate<0,5` rebaixa). **Readiness:**
  `ready_with_warnings`. **Confiança final: baixa.**
- **Explicação (gerada):** "*esfera → azul tem 12 campanhas válidas; intervalo mediano
  … Passaram 263 dias desde a última. Probabilidade de nova campanha: 100% em 30 dias,
  100% em 90. … Confiança baixa — intervalos irregulares (CV=0.89).*"

**Contraste com o Forecast (mesma série):** Forecast **rola** a janela para
2026-07-22 (via mediana 30); Predict declara **atrasado** (263 d ≫ mediana) e prevê
**agora** (100%). Coincidem por acaso em ~jul/2026, mas por lógicas opostas.

### 14.2 `livelo→connectmiles`
- 2 eventos < `minSamples`(3) → **BLOQUEADO**: `readiness=insufficient_history`,
  `confidence=insuficiente`, `blockReason="insufficient_valid_history (2 < 3 campanhas)"`,
  modelos A/B **não** computados. **Nenhuma previsão** (correto — mas por acaso, já que
  a série é lixo).

### 14.3 Série divergente `livelo→smiles` (13 eventos)
- `days_since_last` = 2026-07-15 − 2026-07-14 = **1** (campanha recentíssima). S(1)≈1 →
  P{H} baixas nos horizontes curtos; central/janela a partir dos resíduos (mediana dos
  intervalos ~50 d). Backtest 10 obs. Confiança conforme CV (alta variância → baixa).
  Aqui Predict e Forecast **divergem** de verdade: Forecast usa a mediana dos intervalos
  (que inclui o salto de 359 d), Predict pondera por recência e vê `days_since_last=1`.

---

## 15. Divergências entre os motores

Detalhe em `docs/auditoria/predict-forecast-divergences.csv`.

| Série | Forecast | Predict | Mesmas campanhas? | Mesma última data? | Mesma janela? | Divergência |
|---|---|---|---|---|---|---|
| livelo→connectmiles | prev jan~fev/2029 (baixa) | **bloqueado** | sim | sim | não | amostra mínima (2 vs 3) |
| esfera→azul | janela ~2026-07-22 (baixa) | overdue, 100%, ~agora (baixa) | sim | sim | ~coincidem | **modelo** (mediana×hazard) |
| livelo→smiles | mediana c/ salto 359 | `days_since_last=1` → curto | sim | sim | não | **modelo** (recência) |
| 21 séries de 2 amostras | prevê (baixa) | **bloqueado** | sim | sim | não | amostra mínima |
| todas | artefato 2026-07-14 (119 linhas) | runtime vivo (504) | **não** | **não** | **não** | artefato desatualizado |

**Classificação e proporção (factual):**
- As 120 séries são **as mesmas** (mesmo agrupamento/normalização/`windowDate`/colapso).
- **Divergência de cobertura por amostra (dados/gate):** das 59 séries que o Forecast
  prevê, **21 (36%)** o Predict **bloqueia** (2 amostras < 3). Essa fatia é
  **100% dados/gate**, não modelo.
- **Divergência de resultado nas 38 séries compartilhadas:** vem do **modelo**
  (mediana+janela ±sd/2 vs hazard de sobrevivência ponderado + backtest) e dos **mesmos
  dados corrompidos**. Não há como separar exatamente sem rodar os dois motores em
  paralelo por série (não feito), mas o **gate** (36% da divergência de cobertura) é
  puramente de dados/amostra e o **restante** mistura modelo + dados.
- **Nenhuma reconciliação** "predict `ready` = fonte de verdade" (RFC-009 §0) é
  aplicada em código: os digests usam **só** o Forecast; o Predict fica isolado.
- Filtro de `tipo`: Forecast `normProgram` (trim), Predict `toLowerCase` (sem trim) —
  divergência potencial se `tipo` tiver espaço à borda (**não confirmado** que ocorra
  hoje).

---

## 16. Backfill versus notícias recentes

Amostra rastreada (transferência):

| Campanha | origin | first_seen | window_date | Fluxo observado |
|---|---|---|---|---|
| livelo-connectmiles-…-2026-07-12 | daily | 2026-07-10 | 2026-07-12 | recente (pipeline) |
| livelo-connectmiles-…-2023-12-12 | auto | 2026-07-12 | **2023-12-12** | recente, **data errada** (backfill/coleta) |
| esfera-connectmiles-…-2024-02-22 | auto | 2025-02-20 | **2024-02-22** | erro de ano (URL "fev25") |
| esfera-connectmiles-…-2024-09-20 | auto | 2025-09-18 | **2024-09-20** | erro de ano (URL "set25") |
| itau-azul-…-2025-01-21 | auto | 2025-01-20 | 2025-01-21 | consistente |

Rastreio `URL → news_raw → processamento → extração → campaigns → série`: as duas
fontes passam pelo **mesmo** caminho (edge fn `campaigns`), gravam na **mesma** tabela,
com o **mesmo** `id`-com-data; a série é formada por `windowDate`, que privilegia a
`vigencia_fim` (errada) e ignora `first_seen` (mais confiável). O ponto de divergência
do fluxo é **a data**: a mesma campanha entra duas vezes com datas diferentes e não
deduplica.

**Backfill e notícias recentes estão plenamente integrados?**
```
parcialmente
```
Justificativa: **integrados no destino** (mesma tabela, extrator e upsert), mas **não
integrados na identidade temporal** — sem marcador de origem (`backfill` não existe),
sem dedup por identidade estável (o `id` embute a data errada), e com o campo confiável
(`first_seen`) descartado pelos motores. O resultado é duplicação e datas incoerentes.

---

## 17. Atualização e frescor

| Processo | Frequência | Evidência |
|---|---|---|
| Ingest recente | cron (RPC `admin_run_now('ingest')`) | agendamento em `cron.job` (**não versionado**; frequência exata não confirmável em SQL) |
| Extrator (`campaigns`) | cron `admin_run_now('campaigns')` + botão | idem |
| Backfill | cron `backfill-daily` | idem |
| **Forecast** | **manual** (`npm run forecast`; sem cron) | nenhum workflow referencia forecast |
| **Predict** | **manual** (botão "Gerar snapshot"; sem cron/CLI/.mjs) | idem |
| `forecast_snapshots` | manual (recalc no admin) | 2 registros |
| `predict_snapshots` | manual (snapshotAll) | 49 registros |
| `content/forecast.json` | manual (`npm run forecast`) | `generatedFor: 2026-07-14` (defasado) |
| Weekly lê o arquivo | **em tempo de render** (`render-weekly.mjs` → `radarWeekly`) | só se o JSON do weekly não trouxer `radar` |
| Daily lê o radar | **não lê** `forecast.json` | grep sem match em `render-daily.mjs` |
| Admin recalcula | **a cada request** (runtime, sem persistir) | `/admin/forecast` e `/admin/predict` chamam `buildForecast`/`buildPredict` |

**Linha do tempo operacional de um dia (real):** crons de ingest/extração/backfill
alimentam `campaigns` ao longo do dia; **nada recalcula forecast/predict
automaticamente**; o admin recalcula **ao abrir a página** (dado vivo, com carimbo do
`LiveRefresh` "atualizado HH:MM"); `content/forecast.json` só muda quando alguém roda
`npm run forecast` (por isso está em 2026-07-14, com 119 linhas, enquanto o banco tem
504).

**Um resultado pode ficar desatualizado?** **Sim, e está:** o artefato do digest é de
2026-07-14/119 linhas; os 49 `predict_snapshots` são fotos manuais sem exibição. **Como
o usuário vê a data?** No admin, pelo carimbo do `LiveRefresh` (runtime, fresco); no
artefato, por `generatedFor`; **na Digest publicada, não há indicação de frescor da
previsão**.

---

## 18. Administração do Forecast (`/admin/forecast`)

- **Arquivos:** `app/admin/(panel)/forecast/page.tsx`, `actions.ts`,
  `lib/admin-forecast.ts` (+ `lib/forecast.ts`). **Queries:** `campaigns?select=id,tipo,
  origem,destino,percentual,vigencia_inicio,vigencia_fim&limit=2000`;
  `forecast_config` (id=1); `forecast_overrides`.
- **Config editável** (`forecast_config`): `wave_epsilon_days, min_samples, samples_alta,
  samples_media, cv_alta, cv_media, horizon_daily, horizon_weekly`; **defaults**
  = `DEFAULT_FORECAST_CONFIG` (3/2/4/3/0,35/0,6/10/21). `updated_by` (text livre).
- **Validação:** valores numéricos; **não confirmado** que haja limites de sanidade
  (ex.: min_samples ≥ 1).
- **Overrides** (`forecast_overrides`, 3 no banco): **pin** (fixa), **mute** (retira do
  radar dos digests), **confidence** (força confiança). Aplicados em `decorate`
  (runtime admin) — **mas não no `content/forecast.json`** (`overridesApplied: 0`).
- **Snapshots:** botão "Recalcular + snapshot" grava `forecast_snapshots`
  (`generated_for, routes/clusters_tracked, with_prediction, config, payload`). **A
  página exibe o histórico?** Parcialmente — o snapshot serve de tendência; o `payload`
  guarda o resultado.
- **Ações e efeito no banco:** salvar config → `upsert forecast_config`; override →
  `upsert/delete forecast_overrides`; recalc → `insert forecast_snapshots`.
- **Permissões:** cookie `tl_admin` (admin único). **Sem RBAC, sem auditoria de quem
  mudou config/override** (`updated_by`/`created_by` são text livre, não identidade).
- **Estado vazio / dados insuficientes:** séries `em-formacao` viram nota; sem Supabase
  → listas vazias + aviso "modo mock".
- **Info técnica visível:** samples, mediana/média/desvio, cadência, confiança, janela,
  basis. **Oculta:** os **`window_date` por campanha**, o **erro de ano**, quais
  campanhas entraram, `days_since_last`, o fato de `observed_at`/`first_seen` serem
  ignorados.

---

## 19. Administração do Predict (`/admin/predict`)

- **Arquivos:** `app/admin/(panel)/predict/page.tsx`, `actions.ts`,
  `lib/admin-predict.ts` (+ `lib/predict-engine.ts`). **Query:** mesma de campanhas
  (limit 2000). **Config hardcoded** (`DEFAULT_PREDICT_CONFIG`): 3/6/10/0,6/0,35/hl4/rw5/bt3
  — **sem tabela `predict_config`, sem UI de calibração**.
- **Snapshots:** `snapshotAllAction` → `saveSnapshot` (upsert `predict_snapshots` por
  `series_key, as_of_date`; idempotente por dia). Guarda probs, janela, backtest,
  `features`, `explanation`, `readiness`, `confidence`, `block_reason`, `created_by`.
- **Readiness/warnings/backtest/probabilidades/bônus/datas:** exibidos por série na
  página (P7..180, top-3 de bônus, `windowStart/End`, `centralDate`, métricas de
  backtest, `explanation`, e bloqueios).
- **Histórico de snapshots:** **NÃO exibido** — `getSnapshots` existe em
  `lib/admin-predict.ts:40` mas **não é chamado pela página** (confirmado). Os 49
  snapshots são **write-only**.
- **Info técnica visível:** P{H}, bônus, backtest, readiness, confiança, explicação.
  **Oculta:** `series_key` real (placeholders `brasil|todos|percentual`), os
  `window_date` por campanha, o erro de ano, o histórico de snapshots.
- **Deveria ser administrável, mas não é:** a **config** (pesos de recência,
  minSamples, thresholds) — só via deploy do TS. Não há override/pin/mute como no
  Forecast.
- **Funções no código que a UI não usa:** `getSnapshots` (confirmado).

---

## 20. Experiência atual (Forecast e Predict)

**Nota:** não foi possível capturar screenshots sem alterar o produto/rodar build
autenticado; a descrição é fiel ao código das páginas.

| Elemento | Forecast | Predict |
|---|---|---|
| Título/subtítulo | "Forecast" / radar de janelas | "Predict" / motor robusto |
| KPIs | cobertura (with_prediction), distribuição de confiança | readiness, backtest |
| Tabelas/cards | rota/cluster com janela, confiança, basis, bônus | por série: P{H}, bônus, backtest, explicação |
| Datas | `formatWindow` ("10 jul a 3 ago") | ISO (`central_date`, `window_start/end`) |
| Probabilidade | **ausente** (só janela + confiança) | P7..180 em % |
| Bônus | `typicalPercent` (mediana) rotulado "~85%" | top-3 candidatos + `bonusOutros` |
| Confiança | alta/media/baixa/em-formacao | alta/media/baixa/insuficiente + warnings |
| Amostra | `samples` no basis | `records_total`/`recent` |
| Última campanha | `lastWindow` no basis | `daysSinceLast` |
| Outliers | **não sinalizados** | **não sinalizados** |
| Origem dos dados | não exibida por campanha | não exibida |
| Atualização | `LiveRefresh` (admin) / `generatedFor` (artefato) | `LiveRefresh` |

**Ambiguidades confirmadas (que tornam o resultado difícil de interpretar):**
- **Bônus máximo tratado como esperado:** `eventsFromRows` guarda o **maior** % da
  onda (`predict-engine.ts:189`) → o "bônus provável" tende ao teto, não ao típico.
- **Confiança sem explicação (Forecast):** mostra "baixa" sem dizer que é por CV alta
  da pilha de 2024.
- **Data sem janela / janela sem probabilidade (Forecast):** entrega janela sem
  probabilidade associada.
- **Amostra insuficiente / intervalo anômalo invisível:** o Forecast entrega
  `livelo→connectmiles` (2029) e séries de 2 amostras **sem destacar** que o intervalo
  é anômalo; o `window_date` por campanha (onde mora o erro de ano) **nunca** aparece.
- **Resultado antigo sem alerta / snapshot antigo como atual:** a Digest lê um
  `forecast.json` de 2026-07-14 (119 linhas) **sem alerta de defasagem**.
- **Mistura rota/cluster:** ambos aparecem juntos; um destino aparece como cluster e
  como várias rotas.
- **Mistura Forecast/Predict:** telas separadas, mas **sem reconciliação** — o mesmo
  destino pode ter janela diferente em cada uma, sem indicação de qual vale.

---

## 21. Integração com Digest

| Produto | Motor | Fonte lida | Momento do cálculo | Campo | Override | Atualização |
|---|---|---|---|---|---|---|
| Daily | **nenhum** | — (não lê `forecast.json`) | — | `radar` manual na edição | n/a | manual |
| Weekly | **Forecast** | `content/forecast.json` | tempo de render | `digest.radarWeekly` | via forecast_overrides (mute) | `npm run forecast` (manual, defasado) |
| Pro | **nenhum** | — | — | — | — | — |
| Admin Digests | **nenhum** | `campaigns` por TL Score (`getCandidateCampaigns`) | curadoria | — | — | runtime |
| Beehiiv | — (recebe o render do weekly) | — | — | — | — | — |
| Arquivo web | — | JSON da edição | build SSG | — | — | — |

1. **`content/forecast.json`** é gerado por `scripts/forecast.mjs` (espelho ESM de
   `lib/forecast.ts`), lendo `campaigns` via service key; em falha → modo offline
   (preserva o JSON).
2. **`radarDaily`** é montado (`digest.radarDaily`) **mas não tem consumidor** (o daily
   não lê o arquivo) → **bloco órfão**.
3. **`radarWeekly`** é montado e consumido por `render-weekly.mjs::resolveRadar`.
4. **Consumo:** só o Weekly consome (radarWeekly). Daily/Pro/Admin-Digests **não**.
5. **Bloco órfão:** `radarDaily`/`horizonDaily`.
6. **Forecast recalculado antes de publicar?** **Não automaticamente** — depende de
   alguém rodar `npm run forecast`; o CI não o roda.
7. **Predict usado em algum lugar?** **Não** — nenhuma Digest lê Predict.
8. **Editor copia manualmente?** O `radar` da edição pode ser preenchido à mão; **não
   confirmado** que hoje copie do forecast (o weekly usa fallback automático).
9. **Admin de Digests usa os motores?** **Não** — usa TL Score das campanhas.
10. **Previsão antiga pode ser publicada?** **Sim** — o weekly lê o `forecast.json`
    defasado sem alerta.

**Exemplo real (do artefato `content/forecast.json`, 2026-07-14):** cluster
`→latampass`, "*6 janelas · cadência irregular ~8 dias (média 27, desvio 32) · última
2026-07-13*", janela 2026-07-09 a 2026-08-02, `typicalPercent 20`. Rastreio: a mediana
de **8 dias** vem de várias ondas coladas (mar/mai/… 2026) enquanto média 27/desvio 32
revela irregularidade — a "janela de ~8 dias" é enganosa. Cada `window` desse bloco
(2026-03-01, 2026-05-20, …) mapeia para campanhas cujo `window_date` = `vigencia_fim`
extraída (sujeita ao erro de ano). **Não foi possível confirmar** cada valor até o id
sem cruzar o payload completo do artefato com o banco (o artefato está defasado vs o
banco vivo).

---

## 22. Snapshots e versionamento

| Aspecto | `forecast_snapshots` (2) | `predict_snapshots` (49) |
|---|---|---|
| Colunas-chave | `generated_for, routes/clusters_tracked, with_prediction, config(jsonb), payload(jsonb), created_by` | `as_of_date, series_key, program, origem, destino, records_*, prob_7..180, central_date, window_*, bonus_candidates, confidence, readiness, block_reason, backtest, features, explanation, model_version, backtest_version, created_by` |
| Chave única | (sem unique documentada; insert) | **`(series_key, as_of_date)`** (upsert idempotente/dia) |
| Histórico preservado | sim (insert) | sim (1 por série/dia) |
| Config registrada | **sim** (`config` jsonb) | **não** (config hardcoded, não gravada) |
| Campanhas/IDs registrados | **não** (só contadores no payload) | **não** (só `records_total`) |
| Hash do dataset | **não** | **não** |
| Versão do modelo | não | **sim** (`model_version`, `backtest_version`) |
| `as_of`/created/by | `generated_for`/`created_at`/`created_by`(text) | `as_of_date`/`created_at`/`created_by`(text) |
| Exibido na UI | parcial (tendência) | **não** (`getSnapshots` não chamado) |
| Promovível para Digest | **não** | **não** |
| Marcável expired/superseded | **não** (colunas inexistentes) | **não** (comentário da migração cita, sem código) |

**Reprodutibilidade:**
- `forecast_snapshots`: **parcialmente reproduzível** — guarda o `payload` (saída) e a
  `config`, mas **não** os IDs de campanha; contra um ledger mutável não dá para
  regenerar o mesmo input, mas a **saída** está preservada.
- `predict_snapshots`: **não reproduzível** — guarda a saída por série mas nem os IDs
  nem hash do dataset; o input não é recuperável.

---

## 23. Testes e verificabilidade

`tests/` contém `entities.test.mjs`, `lib.test.mjs`, `stats.test.mjs`,
`taxonomy.test.mjs`. **`grep -riE "forecast|predict|windowDate|collapseWave|series"
tests/` → nenhum match.**

| Área | Arquivo de teste | Cenário | Cobre dados reais? |
|---|---|---|---|
| Formação de série | **nenhum** | — | não |
| Aliases (`normProgram`) | **nenhum** | — | não |
| Datas (`windowDate`) | **nenhum** | — | não |
| Colapso de ondas | **nenhum** | — | não |
| Intervalos | **nenhum** | — | não |
| Forecast (classify/analyze) | **nenhum** | — | não |
| Predict (hazard/gate) | **nenhum** | — | não |
| Probabilidades P{H} | **nenhum** | — | não |
| Bônus | **nenhum** | — | não |
| Backtest walk-forward | **nenhum** | — | não |
| Overrides | **nenhum** | — | não |
| Snapshots | **nenhum** | — | não |
| Backfill / notícias | **nenhum** | — | não |
| Deduplicação | **nenhum** | — | não |
| Integração com Digest | **nenhum** | — | não |
| **Paridade TS ↔ `forecast-engine.mjs`** | **nenhum** | — | não |

**Cenários críticos sem cobertura:** todos os acima. Em especial: (a) `windowDate`
com `vigencia_inicio` nulo caindo no id; (b) erro de ano; (c) colapso de ondas; (d)
paridade `lib/forecast.ts` ↔ `scripts/forecast-engine.mjs` (risco de divergência
silenciosa entre admin e digest); (e) gate do Predict (2 vs 3).

---

## 24. Consultas utilizadas

Executadas em `qjqnqcsdnpvvmyzkavoq` via MCP `execute_sql` (read-only). Sem secrets.

- **Q0 — esquema:** `select column_name,data_type,is_nullable,column_default from
  information_schema.columns where table_name='campaigns'`.
- **Q1 — totais/datas:** `count(*)`, `count filter (tipo ilike 'transferencia')`,
  `min/max(created_at|vigencia_inicio|observed_at|first_seen|last_seen)`, nulos.
- **Q2 — resolução de `windowDate`/origin (transf.):** contagens de `has_vig_inicio`,
  `fallback_id_date` (`id ~ '\d{4}-\d{2}-\d{2}$'`), `fallback_vig_fim`, `no_date`, e
  `origin`.
- **Q3 — distribuição de `windowDate` por ano** e min/max/futuros/anteriores a 2025.
- **Q4 — erro de ano:** `avg(first_seen - window_date)`, faixas 300–430 / 665–795 /
  >180.
- **Q5 — séries (rota/cluster):** normalização + `windowDate` + gap por `lag()`;
  contagem de séries, elegíveis ≥2/≥3, max_gap, gaps >365/>900.
- **Q6 — gaps >365 com as duas datas** (`lag()` sobre `distinct o,d,wd`).
- **Q7 — lineage `→connectmiles`:** todas as campanhas do cluster com campos de data e
  fonte.
- **Q8 — normalização:** distintos de `origem`/`destino` com contagem.
- **Q9 — elegibilidade + metadados:** contagem de séries ≥2/≥3; `news_raw`
  (total/processed/error/sem-campanha); `forecast_snapshots`/`predict_snapshots`/
  `forecast_overrides`/`backfill_*`.
- **Q10 — esquema de snapshots/config.**
- **Q11 — ondas por série** (datas + % por série representativa).
- **Q_dataset (§6)** e **Q_series (§8)** — geram os CSVs em `docs/auditoria/`.

(Os corpos completos das consultas parametrizadas estão em §6 e nas CTEs reproduzidas
ao longo do documento.)

---

## 25. Conclusões factuais

1. **2543 campanhas** no ledger; **~504–507 de transferência** (banco vivo).
2. **`created_at` de todas** entre 2026-07-11 e 2026-07-15 — carga em lote; **não é** a
   data da campanha.
3. **`window_date`** (a data que os motores usam) vai de **2023-02-24 a 2026-07-15**;
   **276 das 364** resolvidas caem em **2024**.
4. **`vigencia_inicio` é nulo em 451/507** transferências → a data efetiva é a
   `vigencia_fim` embutida no `id` (307 casos); **144 transferências não têm data** e
   são **excluídas** dos dois motores.
5. **Erro de ano sistemático:** média `first_seen − window_date` = **+310 dias**; **77%**
   têm `first_seen` >180 d após a `window_date`.
6. **Forecast forma 120 séries** (97 rotas + 23 clusters); **59 elegíveis** (≥2).
7. **Predict forma as mesmas 120 séries**; **38 elegíveis** (≥3). As séries são as
   mesmas; muda o gate.
8. **7 rotas com intervalo > 365 d**; **1 rota > 900 d** (`livelo→connectmiles`, 943).
9. **Causa confirmada do 943:** **erro de data na extração** (ano/mês fabricados) +
   **dedup incorreta** (upsert por `id`-com-data) → mesma campanha duplicada.
10. **Backfill e notícias recentes:** **parcialmente** integrados (mesma tabela/extrator/
    upsert; sem marcador de origem, sem dedup temporal, campo confiável `first_seen`
    ignorado).
11. **Forecast e Predict usam as mesmas campanhas** (mesma query/normalização/
    `windowDate`/colapso); divergem por **gate (36% da divergência de cobertura)** e por
    **modelo** nas séries compartilhadas.
12. **A Digest apresenta dado potencialmente desatualizado:** o Weekly lê
    `content/forecast.json` de **2026-07-14 (119 linhas)** enquanto o banco tem 504
    transferências; o **Predict não alimenta nenhuma Digest**; **sem alerta de frescor**.
13. **Sem cobertura de teste** para série/aliases/datas/ondas/forecast/predict/backtest/
    paridade TS↔mjs.
14. **`vigencia_fim` é `text`** (não date) e **não há `updated_at`/`published_at`**.
15. **18 meses** é **comentário, não filtro** — os motores não cortam por data; há
    campanhas de 2023 sendo usadas.

**Os cinco problemas mais críticos:**
1. **Erro de ano na `vigencia_fim` extraída** + motores usarem essa data e **ignorarem
   `first_seen`/`observed_at`** → séries cronologicamente falsas (raiz de tudo).
2. **Dedup por `id`-com-data**: a mesma campanha vira múltiplas linhas com datas
   diferentes; intervalos e pilhas falsos (caso 943).
3. **`vigencia_inicio` nulo em ~89%** e **144 transferências sem data** descartadas.
4. **Normalização incompleta** (`azulfidelidade`, `all`/`allaccor`, `interloop`/`loop`,
   `desconhecido`, `null`, `cartao`) → séries fragmentadas e séries-lixo.
5. **Desalinhamento de saída**: `content/forecast.json` defasado alimentando o Weekly,
   Predict isolado sem reconciliação, sem alerta de frescor, sem teste — o usuário não
   consegue saber se o número é atual nem por que a confiança é baixa.

---

## 26. Informações necessárias para a próxima fase (redesenho)

Para desenhar a correção, tenha em mãos:

1. **Este documento** (`docs/AUDITORIA-FORENSE-PREDICT-FORECAST.md`) + os CSVs em
   `docs/auditoria/` (`predict-forecast-series.csv`, `-anomalies.csv`, `-divergences.csv`,
   `-lineage.md`).
2. **O código da edge fn `campaigns`** (Deno, no Supabase — **não versionado no repo**):
   é onde a `vigencia_fim`/`id` são gerados e onde o erro de ano nasce. Traga o corpo
   do `on conflict` (para responder §4.9/§4.10 sobre preservação de campos editoriais).
3. **A config do backfill** (janela de descoberta, sitemaps) — para confirmar/derrubar
   a "janela de 18 meses" e medir cobertura por programa/mês (RFC-009 Fase 2).
4. **As RPCs `admin_*` e a definição da view `shopping_sku_latest_v`** (só no banco) —
   para versionar e reproduzir ambientes.
5. **`lib/forecast.ts`, `scripts/forecast-engine.mjs`, `lib/predict-engine.ts`,
   `lib/admin-forecast.ts`, `lib/admin-predict.ts`** — os motores e o plumbing.
6. **`content/forecast.json`, `forecast.schema.json`** e as migrações
   `0001_admin_forecast_predict_area.sql`, `0002_predict_engine_mvp.sql` — contratos e
   snapshots.
7. **RFC-009** — o alvo já desenhado (série rica, catálogo de programas, estados,
   readiness, backtest) que esta auditoria confirma ser necessário.
8. **Decisões de negócio pendentes** (do mapa funcional): motor canônico (Forecast ×
   Predict), e a decisão-chave que esta auditoria acrescenta: **passar a datar a
   campanha por `first_seen`/data de publicação da notícia, não por `vigencia_fim`
   extraída** — e **corrigir/validar o ano na extração**.

**A próxima fase deve começar por dados, não por modelo:** (a) corrigir a data de
ocorrência (usar `first_seen`/data da notícia; validar ano contra `observed_at`); (b)
deduplicar por identidade estável (origem+destino+tipo+janela-real, não `id`-com-`vigencia_fim`);
(c) completar a normalização e remover séries-lixo; (d) só então recalibrar Forecast/
Predict e reconciliá-los. Sem (a)–(c), qualquer modelo — por mais sofisticado —
continuará prevendo sobre uma cronologia falsa.

---

*Fim da auditoria. Etapa de leitura — nenhum código, banco, campanha, backfill,
snapshot, parâmetro ou publicação foi alterado.*
