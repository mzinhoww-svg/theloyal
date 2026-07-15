# Handoff do P1 — Radar Preditivo de Campanhas

> Contrato técnico e de produto do **P1 concluído** (ondas A→D), para a revisão
> humana final e para a fase **estrutural**. O P1 é uma camada de composição e
> experiência em runtime sobre C0/C0.2 + motores Forecast/Predict — **sem
> persistência nova, sem segunda fonte de verdade, sem alterar motores/gates**.

## 1. O que o P1 entrega

- **`/admin/radar`** — entrada única; abas `?view=`: **geral · oportunidades ·
  revisões · bloqueios · operação**. Saúde, KPIs, filtros, tabela unificada,
  resumo operacional, alertas, filas e "o que mudou" honesto.
- **`/admin/radar/[seriesKey]`** — detalhe: resumo executivo, previsão principal
  (Predict quando pronto / Forecast fallback / Não confirmado), comparação
  Forecast×Predict com divergência (D6), qualidade (`QualityPanel`), campanhas
  utilizadas e excluídas, warnings×bloqueios, backtest, explicabilidade, timeline
  do estado atual, links técnicos.
- **Navegação:** grupo *Radar* + grupo *Análise técnica* (Forecast/Predict/VPM/
  Observability preservados e acessíveis).

## 2. Arquitetura (uma leitura, dois motores, uma etiqueta)

```
loadRadar (I/O, lib/admin-radar.ts)
  fetchAllRows("campaigns", RADAR_SELECT)  ── uma leitura (inclui proveniência)
  getConfig()                              ── config persistida do Forecast
  assessForecastFile()                     ── frescor do artefato
  → composeRadarViewModel (PURO, lib/radar-view-model.ts)
      buildForecast(rows) · buildPredict(rows) · fc.quality (assessCampaignQuality)
      casa por chave canônica origem→destino / →destino (normProgram)
      deriva productStatus (D16), divergência (D6), saúde, filtros, primaryProbability
  → radar-filters (PURO)      filtros/derivações de produto
  → radar-detail  (PURO)      traduções/detalhe
  → radar-operations (PURO)   filas, alertas, resumo, "o que mudou"
  → radar-vocab / radar-empty vocabulário de badges e catálogo de estados
```

**Módulos puros (testáveis, sem I/O):** `radar-view-model`, `radar-filters`,
`radar-detail`, `radar-operations`, `radar-empty`, `radar-vocab`. **I/O só em**
`admin-radar` (leitura) e nas páginas.

## 3. Contrato do `RadarViewModel` (fonte por campo)

| Campo | Fonte existente | Observação |
|---|---|---|
| `metadata.asOf` | `buildForecast().generatedFor` | data de referência |
| `metadata.datasetComplete` / `pagesRead` / `rowsRead` | `fetchAllRows` | completude da leitura |
| `metadata.freshnessStatus` / `generatedAt` | `assessForecastArtifact` (artefato) | do Weekly, não por série |
| `health.*` (12 contadores) | `fc.quality.counters` + agregações | saúde do Radar |
| `series[].forecast` | `buildForecast` (Forecast) | objeto íntegro |
| `series[].predict` | `buildPredict` (Prediction) | objeto íntegro |
| `series[].quality` | `assessCampaignQuality` (used/excluded/contagens da série) | por série |
| `series[].productStatus` | derivado (precedência D16) | etiqueta, não gate novo |
| `series[].divergenceLevel/Days` | derivado (faixas D6) | centro + sobreposição |
| `series[].primaryProbability` | `Prediction.probabilities` (P30/P60) | UM horizonte na listagem |
| `series[].window/bonus/modelConfidence/waves/lastCampaignDate/maxIntervalDays` | Forecast/Predict | apresentação |
| `filters.*` | derivado das séries presentes | opções reais |

**Alvo persistido (estrutural, §18 da ARQUITETURA):** `dataset_hash`,
`campaign_ids`, `reconciler_version`, `expires_at`, `superseded_by` — **não** no
P1 (runtime).

## 4. Decisões que o P1 já respeita

- **Motor canônico (D2):** Predict quando `ready`/`ready_with_warnings`; Forecast
  baseline/fallback rotulado; senão Não confirmado — exibido como **recomendação
  em runtime, não persistida** (reconciliação canônica é ADR-008, futura).
- **Divergência (D6):** compatível ≤14 · atenção 15–30 · revisão >30 · bloqueio
  >60, atenuada por sobreposição de janela.
- **Bloqueios (D16):** hierarquia de 11 níveis; críticos nunca overridáveis;
  globais (base/frescor) × por série.
- **Probabilidade ao leitor/admin:** um horizonte principal (P30/P60) na listagem;
  demais no detalhe. Nunca falsa precisão.
- **Contenção C0.2:** o Radar lê as colunas de proveniência e **reflete de fato**
  a exclusão do caso 943 (`suspect_year`), diferente das telas técnicas atuais.

## 5. O que NÃO está no P1 (fase estrutural — exige migration/ADR aceito)

Aprovação editorial persistida; snapshot canônico + `prediction_snapshot_usages`;
Editorial Score definitivo; `prediction_outcomes`/calibração; identidade
(`campaign_identity`/`campaign_version`/`source_observation`) e **merge** de
duplicidades; novo modelo de vigência (`data_evento`/`vigencia_type`); catálogo
persistido de `programs`/aliases; reconciliador canônico persistido; integração
Predict→Daily/Weekly/Pro; automação de publicação; correção persistida dos dados.
Cada item depende de uma decisão registrada nos ADRs `proposed` (001–010).

## 6. Pontos de extensão (onde a fase estrutural pluga)

- **Snapshot/aprovação:** `composeRadarViewModel` já produz o resultado por série;
  a fase estrutural persiste esse resultado (com `dataset_hash`/`campaign_ids`) e
  adiciona os estados de aprovação — sem reescrever a composição.
- **"O que mudou" completo:** `radar-operations.radarChangeEvents` já separa o
  observável agora do que **exige snapshot** (mensagem fixa); com o snapshot, os
  diffs reais (probabilidade/janela/confiança de ontem) preenchem o restante.
- **Reconciliação canônica:** hoje a recomendação Predict>Forecast é rotulada
  "não persistida"; a fase estrutural grava `model.selected`/`reconciler_version`.
- **Digest (Daily/Weekly/Pro):** o mesmo resultado, uma vez aprovado e
  versionado, alimenta os produtos do leitor.

## 7. Riscos e dívidas conhecidas

- **Frescor é do artefato**, não por série (o Radar recalcula ao vivo); tratado
  como alerta global — documentado.
- **Gap das telas técnicas:** `/admin/forecast` e `/admin/predict` selecionam 7
  colunas e não disparam `suspect_year`; o Radar (12 colunas) é mais correto. A
  correção das telas ou a unificação definitiva é pós-P1 (migração incremental
  §10 do backlog), **sem remover** as telas.
- **TS↔MJS:** o pipeline de render usa espelhos MJS dos motores; o Radar é
  TS-only (admin). A paridade dos motores é garantida por `forecast-parity`.

## 8. Como validar (offline, sem produção)

```
npm test        # 216/216 (inclui radar-parity e radar-ui-contract)
npm run typecheck
npm run lint
npm run build   # /admin/radar e /admin/radar/[seriesKey] dinâmicas
```

Referências: `docs/IMPLEMENTACAO-P1A/B/C/D-RADAR.md`,
`docs/BACKLOG-P1-RADAR-UNIFICADO.md`, `docs/DECISOES-PRODUTO-RADAR.md`,
`docs/APROVACAO-MVP-RADAR.md`, ADR-RADAR-001…010 (`proposed`).
