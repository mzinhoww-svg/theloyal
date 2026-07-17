# Reconciliação da Fase C0 — PR #54 (base canônica) × implementações paralelas

> Existiram **três** trilhas de trabalho para a mesma Fase C0:
> 1. **PR #54 (base canônica)** — gate editorial, frescor, paginação completa,
>    consistência Daily×Weekly, schemas, observability e Sidebar.
> 2. **c0.2 — `campaign-quality`** (já integrada ao PR #54) — validação temporal,
>    duplicidade provável e exclusão de placeholders, aplicadas **nos motores**
>    antes da formação das séries.
> 3. **`radar-temporal`** (branch paralela `claude/radar-c0-runtime-quality`) —
>    mesma capacidade temporal/duplicidade de (2), porém em módulo separado e
>    ligado na **camada dos consumidores** (não nos motores).
>
> **Decisão:** PR #54 é a base; a camada temporal/duplicidade canônica é a
> **`campaign-quality` (c0.2)**, porque já está integrada, é ligada no motor
> (fonte única de séries), tem paridade TS↔MJS e cobre o caso 943 ponta a ponta.
> A trilha `radar-temporal` é **descartada por redundância** — manter as duas
> violaria a regra "uma só implementação por regra". Nenhuma mudança de
> banco/migration/dados/produção.

## Matriz de reconciliação

| Capacidade | PR #54 (base) | Paralela `campaign-quality` (c0.2) | Paralela `radar-temporal` | Escolha canônica | Justificativa |
|---|---|---|---|---|---|
| `windowDate` / `normProgram` | ✅ `lib/forecast.ts` + `scripts/forecast-engine.mjs` | reusa | reusa | **PR #54** | Uma só definição de data de janela e normalização. |
| `collapseWaves` / formação de séries | ✅ `buildForecast` | reusa | reusa | **PR #54** | Já validado por teste. |
| Gate editorial (amostra/intervalo/horizonte) | ✅ `editorialGate()` + defaults (minEditorialWaves 5, long 365, extreme 540, horizon 180) | reusa | duplicava (`evaluateEditorialGate`) | **PR #54** | Uma só função de gate; a variante duplicada é descartada. |
| Frescor do artefato | ✅ `scripts/forecast-freshness.mjs` (`assessForecastArtifact`) | reusa | duplicava (`evaluateForecastFreshness`) | **PR #54** | Uma só função de frescor; Weekly já usa a do #54. |
| Dataset completo / paginação | ✅ `fetchAllRows()` + paginação em `forecast.mjs` | reusa | duplicava (`loadCampaignsPaged`) | **PR #54** | Uma só paginação determinística. |
| Consistência Daily×Weekly | ✅ `radar-consistency` + QA | — | — | **PR #54** | Só o #54 tem; preservado. |
| Schema editorial / QA / validate | ✅ `edition/weekly.schema.json`, `qa.mjs`, `validate.mjs` | — | — | **PR #54** | Preservado (não revertido). |
| Observability / Sidebar / asset | ✅ | — | — | **PR #54** | Preservado. |
| **Validação temporal (evento × proveniência)** | ✗ | ✅ `evaluateTemporalPlausibility` (suspect_year, event_far_before_source, conflicting, permanent, invalid, missing) — **no motor** | ✅ (equivalente, na camada do consumidor) | **c0.2 `campaign-quality`** | Gap real do #54. c0.2 vence por ligar **no motor** (fonte única de séries) e ter paridade TS↔MJS. |
| **Exclusão de crítica antes das ondas** | ✗ | ✅ `assessCampaignQuality` alimenta `buildForecast`/`buildPredict` só com `eligibleRows` | ✅ (equivalente) | **c0.2 `campaign-quality`** | Contém o dado corrompido antes de formar intervalos, dentro do próprio motor. |
| **Detecção de duplicidade provável** | ✗ | ✅ `detectProbableDuplicates` (union-find por identidade estável `origem\|destino\|tipo`, score 3/5) | ✅ (pares, score 2/4) | **c0.2 `campaign-quality`** | Ambas cobrem o par Livelo→ConnectMiles; c0.2 é a integrada. |
| **Exclusão de placeholders** | ✗ | ✅ `isPlaceholderProgram` / `isCampaignEligibleForPrediction` | ✅ `isPlaceholderProgram` | **c0.2 `campaign-quality`** | Evita séries-lixo; a versão integrada é a canônica. |
| **Fixtures/testes Livelo→ConnectMiles** | ✗ | ✅ `tests/campaign-quality.test.mjs` (943 crítico, sem 2029, exclusão em Forecast+Predict) | ✅ (equivalente) | **c0.2 `campaign-quality`** | Prova o bloqueio do 943d ponta a ponta. |
| **Paridade TS↔MJS temporal/dup** | ✅ (gate) | ✅ `tests/forecast-parity.test.mjs` estendido (aceitos/rejeitados/943) | ✅ (transpile in-memory) | **c0.2 `campaign-quality`** | Paridade já no arquivo canônico de paridade. |
| Painel de qualidade no admin | parcial (colunas do #54) | ✅ `components/admin/QualityPanel.tsx` | parcial (StatCards) | **c0.2 `campaign-quality`** | Painel dedicado mais rico. |
| Módulo puro compartilhado de qualidade temporal | — | ✅ `lib/campaign-quality.ts` + `scripts/campaign-quality.mjs` | ✅ `lib/radar-temporal.ts` + `scripts/radar-temporal.mjs` | **c0.2 `campaign-quality`** | Uma só fonte de verdade; a segunda é redundante e foi descartada. |

## Resultado (uma única fonte de verdade)

- **Fonte única de qualidade temporal + duplicidade + placeholders:**
  `lib/campaign-quality.ts` (+ espelho `scripts/campaign-quality.mjs`) —
  `evaluateTemporalPlausibility`, `detectProbableDuplicates`,
  `isCampaignEligibleForPrediction`, `assessCampaignQuality`,
  `resolveEventDateCandidate`, `DEFAULT_QUALITY_CONFIG`.
- **Integração:** `assessCampaignQuality` roda **dentro** de `buildForecast`
  (`scripts/forecast-engine.mjs` + `lib/forecast.ts`) e `buildPredict`
  (`lib/predict-engine.ts`), que formam séries **só** com `eligibleRows`. Gate
  editorial, frescor e paginação continuam sendo os do #54.
- **Reusa do #54:** `windowDate`/`normProgram`, `editorialGate`,
  `assessForecastArtifact`, `fetchAllRows` — sem duplicação.

## Preservado / Substituído / Incorporado / Descartado

- **Preservado (PR #54):** motor, `editorialGate`, `forecast-freshness`,
  `fetchAllRows`, `radar-consistency`, schemas editoriais, `qa.mjs`,
  `validate.mjs`, observability, Sidebar, asset, admin, contratos e testes.
- **Incorporado (c0.2 `campaign-quality`):** validação temporal, exclusão de
  críticas antes das ondas, duplicidade provável, placeholders, fixtures/testes
  do 943d, paridade das novas funções, `QualityPanel`, ADR-RADAR-009/010.
- **Substituído:** os motores passam a formar séries só com `eligibleRows`
  (nenhuma regra do #54 removida; apenas dado corrompido deixa de entrar).
- **Descartado (por redundância, para não manter duas implementações da mesma
  regra):** a trilha `radar-temporal` (`lib/radar-temporal.ts`,
  `scripts/radar-temporal.mjs` e testes correlatos) e as partes da paralela que
  duplicavam o #54 (`evaluateEditorialGate`, `evaluateForecastFreshness`,
  paginação própria, `containForecast`, `radar-quality`/`radar-dataset`).

## Verificação do caso de referência (943d)

`tests/campaign-quality.test.mjs` prova, sobre as fixtures Livelo→ConnectMiles:
registro A (`vigencia_fim=2023-12-12`, `first_seen=2026-07-12`) → `suspect_year`
**crítico**, `includeInPrediction=false`, `eventDate` **não** corrigido
(`dayDifference=943`); o par → `probable_duplicate`; `buildForecast`/`buildPredict`
excluem A → série de 1 onda, **sem** intervalo de 943, **sem** janela 2029, com
motivo (`suspect_year`) exposto; paridade TS↔MJS idêntica. Nenhuma escrita em
banco/produção.
