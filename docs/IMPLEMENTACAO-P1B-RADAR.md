# Implementação — Fase P1-B (Detalhe da série no Radar)

> Registro do que foi **efetivamente implementado** na onda **P1-B** do Radar
> (`docs/BACKLOG-P1-RADAR-UNIFICADO.md` §16, itens P1-006…P1-011, §8). Rota
> dedicada `/admin/radar/[seriesKey]` reunindo resumo executivo, previsão
> principal, comparação Forecast × Predict, qualidade, campanhas utilizadas e
> excluídas, warnings/bloqueios, backtest, explicabilidade e timeline do estado
> atual.
>
> **Camada de apresentação/composição.** Reusa o `RadarViewModel`/`loadRadar` do
> **P1-A** — **nenhuma segunda leitura do ledger, nenhuma segunda fonte de
> verdade, nenhum cálculo novo** de Forecast, Predict, qualidade, divergência,
> backtest ou elegibilidade. Sem persistência, sem migration, sem alterar
> motores/gates/ADRs. Telas atuais intactas.

## 1. Matriz (nenhum cálculo novo)

| Informação | Fonte atual | Componente P1-B | Novo cálculo necessário |
|---|---|---|---|
| Cabeçalho (origem/destino/escopo/estado/motor/frescor/ondas/válidas/excluídas) | `RadarSeries` (P1-A) | `RadarSeriesDetailHeader` | **não** |
| Resumo executivo (situação/janela/chance/bônus/confiança/ação) | `RadarSeries` + `enginePrincipal`/`recommendedAction` | `RadarSeriesSummary` | **não** |
| Previsão principal (Predict pronto / Forecast fallback / nenhum) | `RadarSeries.predict`/`forecast` | `RadarPredictionMain` | **não** |
| Probabilidades P30/P60/P90 (P7/P15/P180 em expansível) | `Prediction.probabilities` | `RadarPredictionMain`/`RadarPredictSection` | **não** |
| Forecast (janela/cadência/ondas/maior intervalo/bônus típico/elegibilidade) | `Forecast` | `RadarForecastSection` | **não** |
| Predict (readiness/janela/central/bônus/backtest/explicação) | `Prediction` | `RadarPredictSection` | **não** |
| Comparação e divergência | `RadarSeries.divergenceDays/Level` (P1-A) | `RadarEngineComparison` | **não** |
| Qualidade (recebidas/elegíveis/excluídas/duplicidades/placeholders) | `CampaignQualityAssessment` + `QualityPanel` | `RadarQualitySummary` (reusa `QualityPanel`) | **não** |
| Campanhas utilizadas | `RadarSeries.quality.used` (novo campo compatível) | `RadarCampaignsUsed` | **não** (só agrupa elegíveis) |
| Campanhas excluídas (data candidata/proveniência/Δ/flags/severidade/dup/motivo) | `RadarSeries.quality.excluded` | `RadarCampaignsExcluded` | **não** |
| Warnings × bloqueios | `Forecast.warnings`/`editorialBlockReason` + `Prediction.warnings`/`blockReason` | `RadarWarningsBlocks` | **não** |
| Backtest (windowHitRate/erro mediano/acurácia/obs.) | `Prediction.backtest` | `RadarPredictSection` | **não** |
| Explicabilidade (produto + analítico) | `Prediction.explanation`/`Forecast.basis` + composição | `productExplanation` | **não** (sem IA externa) |
| Timeline (estado atual) | `Forecast.windows`/`RadarSeries` | `RadarTimeline` | **não** |
| Links técnicos | rotas atuais | `RadarTechLinks` | não |

`enginePrincipal`, rótulos (`readinessLabel`, `cadenceLabel`, `temporalStatusLabel`,
`duplicateStatusLabel`, `exclusionReasonLabel`, `divergenceLabel`), `recommendedAction`,
`waveIndexOf`, `divergenceExplain` e `productExplanation` são **traduções/derivações
puras** de campos existentes — não recalculam motor, qualidade, divergência,
backtest nem elegibilidade.

## 2. Arquivos

**Novos:**
- `app/admin/(panel)/radar/[seriesKey]/page.tsx` — rota dedicada; `loadRadar` +
  `findRadarSeries`; ordem do §6; estado "série não encontrada".
- `components/admin/radar-detail.tsx` — 12 seções (cabeçalho, resumo, previsão
  principal, comparação, Forecast, Predict+backtest, qualidade, utilizadas,
  excluídas, warnings/bloqueios, timeline, links). Server components; camadas
  técnicas em `<details>` nativo (acessível, sem JS de cliente). Reusa `QualityPanel`.
- `lib/radar-detail.ts` — helpers **puros** de apresentação/tradução (alvo de teste).
- `tests/radar-detail.test.mjs` — 19 casos (ver §4).

**Alterado (compatível):**
- `lib/radar-view-model.ts` — `RadarSeriesQuality.used` (campanhas elegíveis por
  série, campo **aditivo**); `computeDivergence` exportada para teste determinístico.
- `lib/admin-radar.ts` — `RADAR_SELECT` inclui `origin` (coluna a mais para
  "origem do registro" na tabela de utilizadas; leitura, não alteração).
- `components/admin/radar.tsx` — cada rota da tabela do P1-A agora **linka** para
  o detalhe (`/admin/radar/{encodeURIComponent(seriesKey)}`).

Nenhuma alteração em Forecast, Predict, `campaign-quality`, gates, frescor,
`QualityPanel`, `content/forecast.json`, telas atuais ou ADRs.

## 3. Decisões

1. **Rota dedicada** (não drawer): permite link direto, refresh e compartilhamento
   interno (§5). Chave da URL = `encodeURIComponent(seriesKey)`, reversível
   (`decodeURIComponent`); nenhum ID de banco inventado.
2. **Reuso do loader do P1-A**: o detalhe chama o **mesmo** `loadRadar` e localiza
   a série — não há segunda leitura do ledger nem recomposição paralela.
3. **Divergência**: exibe as faixas D6 já computadas no P1-A (compatível ≤14 ·
   atenção 15–30 · revisão >30 · bloqueio >60, com atenuação por sobreposição de
   janela) e uma explicação em linguagem de produto — **sem reconciliador novo,
   nada persistido** (a reconciliação canônica é fase futura, ADR-008).
4. **Honestidade**: backtest insuficiente é mostrado como "Backtest insuficiente"
   (não escondido, sem inferir confiança); bônus/janela ausentes → "Não disponível"
   (nunca inventados); timeline é retrato do agora + nota de que o histórico
   depende do snapshot canônico.

## 4. Testes (`tests/radar-detail.test.mjs`, 19 casos)

Motor principal (Predict) / fallback (Forecast) / sem previsão; **faixas de
divergência** (compatível/atenção/revisão/bloqueio) + atenuação por sobreposição;
campanhas utilizadas (elegíveis, datáveis, índice de onda) e excluídas; **943 →
"possível erro de ano"**, provável duplicidade, data ausente, permanente,
placeholder; traduções de readiness/cadência; backtest disponível × insuficiente;
bônus disponível × ausente; ação recomendada; cluster agregado; série inexistente;
**regressão do view model do P1-A**. Puro, sem I/O, sem Supabase.

Validação: `npm test` (**141/141**), `npm run typecheck`, `npm run lint`,
`npm run build` — todos verdes. `/admin/radar` e `/admin/radar/[seriesKey]`
compilam como rotas dinâmicas; forecast/predict/observability seguem funcionais.

## 5. Fora do P1-B (próximas ondas / estrutural)

Filas de trabalho e "o que mudou" (P1-C); paridade formal e handoff (P1-D).
Estrutural (não iniciado): aprovação persistida, Editorial Score, snapshot
canônico, histórico/`prediction_outcomes`, identidade/dedup persistidas, timeline
histórica, integração Daily/Weekly/Pro, automação — conforme
`BACKLOG-P1-RADAR-UNIFICADO.md` §18 e os ADRs `proposed`.

## 6. Rollback

Reverter o commit remove a rota de detalhe, os componentes, `lib/radar-detail.ts`,
o campo `used`, a coluna `origin` no select e o link da tabela; nada mais é tocado
(sem banco, migration, dados, artefato). O `/admin/radar` do P1-A e as telas
atuais permanecem exatamente como estavam.
