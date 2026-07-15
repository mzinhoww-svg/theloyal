# Implementação — Política Canônica do Radar

> Plano **executável** para colocar em operação a `POLITICA-CANONICA-RADAR.md`.
> Deriva do **diagnóstico** (`PRODUCT-DESIGN-REVIEW-RADAR.md`, `ANALISE-SISTEMA.md`,
> diagnóstico das digests Daily/Weekly/Predict) e do **backlog**
> (`BACKLOG-P1-RADAR-UNIFICADO.md`, `BACKLOG-FASE-ESTRUTURAL-RADAR.md`).
> **Não cria motor novo, não cria segunda fonte de verdade, não altera a matemática.**
> Cada fase reusa `campaign-quality → buildForecast/buildPredict → editorialGate →
> forecast-freshness → radar-view-model` (a fonte única do C0/C0.2).
>
> **Estado:** F0 (Fundação) **concluída** neste PR. F1–F2 sem migration; F3 estrutural.

## 1. Diagnóstico que este plano resolve

Do diagnóstico das digests e do PDR, consolidado nas 6 premissas do briefing:

| # | Sintoma diagnosticado | Como o plano ataca |
|---|---|---|
| D1 | Previsão em **três telas concorrentes** (forecast/predict/observability) | Fonte única já entregue no P1-A; a política transforma a seleção em **um resultado canônico** (F0). |
| D2 | **TL Score digitado**, não calculado | Política **não** gera TL Score; produz previsão calibrada que a inteligência editorial traduz. Nada a automatizar aqui. |
| D3 | **Sem nota de corte** de publicação madura | F0 torna a **nota de corte computável** (`readerPublishable`) na reconciliação. |
| D4 | **Motor que publica (Forecast) ≠ motor que mede (Predict)** | F0 define Predict canônico por auto-medição; F1 faz o **artefato ao leitor** sair do motor canônico, não do Forecast cru. |
| D5 | **Weekly não consolida a Daily** de forma rastreável | F3 (estrutural): snapshot canônico + diff, Weekly lê o mesmo snapshot aprovado da Daily. |
| D6 | **Comunicação promete mais** que o produto entrega | F1–F2: faixa em vez de ponto, corte por confiança, degrade honesto — corrige pelo gate, não pelo texto. |

## 2. Princípios preservados (não negociáveis na implementação)

1. **Uma leitura, uma verdade** — o `radar-view-model` é o único ponto de reconciliação.
2. **Etiqueta, não recálculo** — todo campo novo é derivado de saída existente.
3. **Aditivo** — nenhum campo/comportamento existente muda; testes de paridade seguem verdes.
4. **Bloqueio duro precede tudo** — completude/frescor/qualidade temporal antes de motor/score.
5. **Nunca número em silêncio** — degrade para monitoramento honesto; corte só sem base avaliável.
6. **Sem persistência nas fases sem migration** — estado derivado em runtime; persistir é F3.

---

## 3. Fases

### F0 — Fundação: política computável (CONCLUÍDA neste PR, sem migration)

**Problema:** a política existia como documento; a reconciliação escolhia janela mas não
expunha **motor canônico**, **fallback** nem a **nota de corte**.

**Entregue:**
- `ADR-RADAR-008` promovido a **accepted** (referencia a política; resolve `d_max` e
  "Forecast ao leitor" como fallback rotulado).
- `lib/radar-view-model.ts`: `deriveReaderDecision()` puro + campos aditivos em
  `RadarSeries` — `canonicalEngine`, `fallbackUsed`, `readerPublishable`,
  `readerSurface` (`prediction | monitoring | hidden`), `readerBlockReasons`.
- Nota de corte automática = `datasetComplete ∧ fresh ∧ motor canônico pronto ∧
  confiança≥média ∧ (backtest≥3 → windowHitRate≥0,5) ∧ divergência∉{revisão,bloqueio}`.
  A **aprovação editorial** (§7.4 da política) fica de fora — não é computável em
  runtime; entra em F3.
- `tests/radar-reader-policy.test.mjs` (12 casos: unidade em todos os ramos +
  integração happy-path/base-incompleta/stale/943).

**Aceite (verificado):** typecheck + 248 testes verdes; happy-path real (12 ondas
mensais) → `readerPublishable=true`, `readerSurface="prediction"`, Predict canônico;
943 → `hidden` + `qualidade_de_dado`; incompleto/stale → não publicável com motivo.

**Achado relevante para F1:** o **fallback do Forecast é hoje inalcançável** — os dois
motores leem as mesmas `eligibleRows` e o gate de amostra do Predict (3) é menor que o
do Forecast editorial (5); logo, quando o Forecast é elegível, o Predict já está
`ready`. O fallback só passa a disparar quando o Predict ganhar os readiness
`backfill_incomplete`/`data_quality_blocked` (ADR-004). A política já está codificada
para esse futuro; a função é testada pela unidade, não pela integração.

---

### F1 — Nota de corte no artefato + proveniência (sem migration) — **CONCLUÍDA**

**Objetivo:** parar de overprometer ao leitor (D6) e tornar a política operante na
reconciliação. **Descoberta que reescopa F1:** o pipeline roda sobre **espelhos ESM
hand-made** (`forecast-engine.mjs`, `campaign-quality.mjs`) — "roda sem build de TS" —
e **não há espelho** de `predict-engine`/`radar-view-model`. Logo, levar o **resultado
canônico (Predict)** ao artefato exige espelhar o hazard+reconciliação em `.mjs` **ou**
migrar o pipeline para consumir `.ts`. Ambas são decisões estruturais — o próprio
roadmap do repo coloca "Predict na Digest" em P5. Portanto **F1 entrega o corte e a
proveniência sobre o caminho Forecast atual; o Predict→leitor vai para F3.**

| Item | Problema | Entregue | Arquivos | Risco |
|---|---|---|---|---|
| **F1-01** | Config canônica dispersa | Módulo versionado (d_max 14/30/60, gates, TTLs, horizontes, `minReaderConfidence`) lido pela reconciliação | `lib/radar-policy-config.ts` | baixo |
| **F1-02** | Reconciliação ignora overrides (divergência admin×pipeline) | `composeRadarViewModel` **override-aware** (mute/pin/confidence) — uma fonte única; corrige o gap do `loadRadar` | `lib/radar-view-model.ts` | médio |
| **F1-03** | `confidence:"baixa"` chega ao leitor | Corte por confiança≥média no **weekly** do pipeline (era "baixa" → overpromessa) | `scripts/forecast.mjs` | baixo |
| **F1-04** | Proveniência invisível | `radarItem` carrega `source:"forecast"` (espelhado ts/mjs); schema atualizado | `lib/forecast.ts`, `scripts/forecast-engine.mjs`, `content/forecast.schema.json` | baixo |

**Verificação F1:** typecheck + build verdes; suíte verde (parity ts↔mjs preservada);
testes novos: `radar-overrides.test.mjs`, cortes/proveniência em `radar-reader-policy.test.mjs`.

**Deferido conscientemente (não em F1):** montar o artefato ao leitor a partir do
**resultado canônico (Predict)** e o rótulo de fallback "cadência aproximada" — exige a
decisão espelho/TS (F3). A faixa de datas/bônus (F1-05 original) já é intrínseca ao
render atual (janela é faixa; bônus é `~%`); a troca de fonte para Predict é o que falta.

---

### F2 — Nota de corte no gate de QA (sem migration) — **CONCLUÍDA**

**Objetivo:** garantir, no **gate de QA**, que nenhuma superfície publique como
**janela** algo abaixo da nota de corte — o degrade honesto que a política exige (§4).
A honestidade de render já existia (a Weekly omite radar stale/incompleto via
`resolveRadar`; ambos os renders omitem o bloco quando não há janelas).

| Item | Entregue | Arquivos | Risco |
|---|---|---|---|
| **F2-01** | **Nota de corte no QA**: janela de leitor com confiança "baixa" bloqueia se **automática** (source:forecast), vira **aviso** se **editorial** (deveria ser monitoramento). Vale para Daily (`validateRadarConsistency`) e Weekly (`validateWeekly`). | `scripts/validate.mjs`, `scripts/render-weekly.mjs` | baixo |
| **F2-02** | Conteúdo existente preservado: a edição 0028 (radar editorial "baixa", ilustrativa) passa a **avisar**, não falhar. | testes | baixo |

**Verificação F2:** 259 testes verdes; `radar-consistency.test.mjs` cobre automático→erro,
editorial→aviso, média→ok; QA da 0028 = 0 erros.

**Deferido para F3 (entrelaçado com a reconciliação chegando ao render):** texto
"monitorando N séries" (exige o resultado canônico no render → F3-00) e a garantia
**Weekly ≥ conservadora que Daily** (exige a consolidação Weekly←Daily → F3-02, premissa 5).

---

### F3 — Fase estrutural (com migration; depende de ADRs `accepted`)

Fecha D5 e a auditoria de acurácia real. Cada item exige ADR promovido e migration —
**não** neste PR.

| Item | Fecha | Estrutura | ADR |
|---|---|---|---|
| **F3-00** Predict→leitor no artefato | **D4** — o motor que mede passa a ser o que publica; exige espelho ESM de predict/reconciliação **ou** migração do pipeline para `.ts` | decisão de build do pipeline | ADR-001/008 |
| **F3-01** Snapshot canônico + aprovação persistida com TTL | nota de corte com "aprovação vigente"; Daily/Weekly do mesmo snapshot | `prediction_snapshots`, `editorial_approval`, `usages` | ADR-006 |
| **F3-02** Consolidação rastreável Weekly←Daily | **D5** — Weekly consolida a semana de Dailies por diff de snapshot | snapshots versionados + "o que mudou" (13 eventos) | ADR-006 |
| **F3-03** `prediction_outcome` (previsto × realizado, Brier) | **D4 definitivo** — motor canônico auditado contra a realidade, não só backtest | entidade de outcome | ADR-006 |
| **F3-04** Componente sazonal no Predict | séries sazonais sem fingir precisão (hoje confiança ≤ média + warning) | modelo v3 | RFC-009 |
| **F3-05** Identidade/dedup persistidas | "ondas reais" no banco (cura a raiz do 943), não só runtime | `campaign_identity`/`version`/`source_observation` | ADR-009/010 |

---

## 4. Mapa da nota de corte → fonte existente (contrato F0)

| Condição da política (§7.4) | Sinal no código | Onde |
|---|---|---|
| `datasetComplete` | `opts.datasetComplete` | loader/artefato |
| `fresh` | `freshness.status === "fresh"` | `assessForecastArtifact` |
| motor canônico pronto | `predict.probabilities != null` (Predict) ou `forecast.editorialEligible` (fallback) | motores |
| confiança ≥ média | `predict.confidence`/`forecast.confidence ∈ {alta,media}` | motores |
| backtest ok | `backtest.observations ≥ 3 → windowHitRate ≥ 0,5` | `predict.backtest` |
| divergência não crítica | `divergenceLevel ∉ {review, block}` | `computeDivergence` |
| aprovação vigente | **não computável em runtime** | F3 (persistência) |

## 5. Riscos do plano

- **F1-02 muda a saída ao leitor** — mitigado: atrás do QA gate, testado por paridade
  série-publicável ↔ artefato, e revisável por config (F1-01).
- **Menos janelas no curto prazo** (corte por confiança≥média) — esperado e aceito
  (menos e verdadeiro > mais e frágil).
- **Fallback inalcançável hoje** — não é bug; a política está pronta para quando o
  readiness do Predict amadurecer (ADR-004). Documentado.
- **Sazonalidade** — F1/F2 saem com confiança ≤ média + warning; cura só em F3-04.

## 6. Critérios de aceite globais

1. F0: nota de corte computável, testada, sem regressão (**feito**).
2. F1: artefato ao leitor vem do resultado canônico; nenhuma janela "baixa"; fallback rotulado.
3. F2: nenhuma superfície publica stale/baixa em silêncio; ausência é texto; Weekly ≥ conservadora que Daily (QA verde).
4. F3: Daily/Weekly do mesmo snapshot aprovado; acurácia medida contra outcome real.
5. Em toda fase: uma fonte, zero motor alterado, testes verdes, disclaimer presente.

## 7. Sequência recomendada

`F0 (feito) → F1-01 config → F1-02/03 artefato canônico + corte → F1-04/05 proveniência
+ faixa → F2 degrade honesto + consistência → F3 (estrutural, por ADR)`. F1–F2 sem
migration; F3 só após promover ADR-006/009/010 de `proposed`.
