# ADR-SERIES-001 — Series-builder único para Forecast e Predict

**Status:** aceito · 2026-07-15
**Contexto:** PR #76, Fase 4 do plano de melhorias (docs/architecture/plano-melhorias-forecast-predict.md)

## Problema

Os dois motores (`lib/forecast.ts` e `lib/predict-engine.ts`) formavam séries a
partir do mesmo ledger com regras quase iguais mantidas em dobro: data real da
janela (`windowDate`), normalização de programa (`normProgram`), aritmética de
datas, colapso de ondas (`collapseWaves`) e o particionamento rota/cluster. As
divergências acidentais entre as cópias já haviam gerado auditoria própria
(`docs/auditoria/predict-forecast-divergences.csv`).

## Decisão

**Extrair, não fundir.** A formação de séries vive em `lib/series-builder.ts`
(puro, determinístico, sem I/O) e é consumida pelos dois motores:

- `windowDate`, `normProgram` (+aliases), `isValidISODate`
- `toMs` / `daysBetween` / `addDays`
- `collapseWaves` (dedup + sort internos)
- `groupTransferSeries` (particionamento rota/cluster) e `groupWaveInputs`
  (ondas + percentuais válidos, visão do Forecast)

`lib/forecast.ts` **re-exporta** `windowDate`/`normProgram`/`collapseWaves`/
`CampaignRow` para manter a API pública estável (espelho MJS, radar, testes).

O comportamento está travado por `tests/series-characterization.test.mjs`,
escrito ANTES da extração e mantido verde depois. A paridade TS×MJS
(`tests/forecast-parity.test.mjs`) continua sendo o gate do pipeline de render.

## Divergências intencionais (permanecem)

| Dimensão | Forecast | Predict | Racional |
|---|---|---|---|
| `minSamples` | 2 (série "em formação" com previsão interna) | 3 (bloqueia `insufficient_history`) | Forecast alimenta o admin com sinal cedo; Predict só publica probabilidade com base mínima |
| Modelo | mediana de intervalo + janela ±sd/2 rolada | hazard de sobrevivência + backtest walk-forward | Propósitos distintos: janela editorial vs probabilidade por horizonte |
| Estatística | `median`/`stdev` arredondam e devolvem 0 em vazio | devolvem `null` e não arredondam | Semânticas acopladas a cada modelo; unificar mudaria saídas — fica FORA do series-builder |
| Overrides/config | editáveis no admin (`forecast_config`/`forecast_overrides`) | consome os mesmos overrides (pin/mute, Fase 1); config em código | Confiança do Predict nasce de CV+backtest — override de confiança não se aplica |

## Divergências acidentais eliminadas

- Duplicação de `collapseWaves`/aritmética de datas (era cópia com nuances).
- Particionamento: o Forecast exigia `origem` até para o cluster; o Predict
  não. **Inalcançável** pós-C0.2 (linha sem origem é bloqueada como
  `placeholder_program` antes dos motores) — comportamento observável idêntico,
  confirmado pela caracterização. O builder unifica: cluster exige `destino`,
  rota exige `origem`+`destino`.
- Grupos sem nenhuma data de janela não formam série em nenhum motor
  (pré-condição garantida pelo gate `missing_date` do C0.2; o Forecast ainda
  guarda um `continue` explícito).

## Consequências

- Correção de dado/normalização acontece em UM lugar e vale para os dois
  motores e para o Radar (que concilia ambos).
- O espelho `scripts/forecast-engine.mjs` continua espelhando o
  **comportamento** (gate de paridade), não a estrutura — sem mudança lá.
- Próximo passo natural (fora deste ADR): scripts importarem o `.ts` via
  type-stripping e aposentarem o espelho.
