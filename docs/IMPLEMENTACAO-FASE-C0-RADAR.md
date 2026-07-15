# Implementação — Fase C0 do Radar Preditivo (Contenção)

> Contenção **em runtime, sobre o schema atual**, de campanhas temporalmente
> suspeitas, duplicidades prováveis, datasets incompletos, previsões frágeis e
> artefatos desatualizados. **Não** implementa o novo modelo estrutural.
>
> Fontes de verdade: `docs/AUDITORIA-FORENSE-PREDICT-FORECAST.md`,
> `docs/RECONCILIACAO-AUDITORIAS-RADAR.md`, `docs/ARQUITETURA-PRODUTO-RADAR-PREDITIVO.md`
> (§27f), ADR-RADAR-002…010, `docs/auditoria/edge-function-campaigns.md`.

## 1. Escopo

Impedir que campanhas suspeitas, duplicatas prováveis, datasets incompletos,
séries frágeis e artefatos stale alimentem Forecast, Predict ou os blocos
editoriais **sem indicação explícita e revisão**. Tudo **sem migration, sem
alterar schema, sem corrigir/mesclar dados no banco, sem alterar IDs**.

## 2. Comportamento anterior (confirmado)

```
extração produz vigencia_fim incorreta → ausência de validação temporal aceita a
data → vigencia_fim participa do ID → mesma campanha recebe outro ID → upsert não
deduplica → registros duplicados formam intervalo falso → Forecast aceita o
intervalo → previsão incoerente chega ao produto
```
- `windowDate` ancora em `vigencia_fim` (via ID) em ~90% dos casos; ignora
  `first_seen`/`observed_at` (proveniência).
- Forecast previa com 2 ondas; o par `livelo→connectmiles` (2023-12-12 → 2026-07-12,
  **943 dias**) gerava janela ao futuro sem alerta.
- Motores liam `campaigns` com **`limit=2000` silencioso**.
- `content/forecast.json` stale era usado pelo Weekly sem aviso.

## 3. Comportamento novo (implementado)

- **Validação temporal em runtime** classifica cada campanha; datas suspeitas/críticas
  **não entram** na série elegível (sem corrigir a data).
- **Duplicidade provável em runtime** marca pares; o par `livelo→connectmiles` é
  `probable_duplicate` e o registro crítico (2023-12-12) é bloqueado → **o intervalo de
  943 dias deixa de existir**; a rota fica com 1 onda (em-formação), **sem janela 2029**.
- **Dataset completo** por paginação; `datasetComplete=false` **bloqueia a distribuição**.
- **Gate editorial** por finalidade: séries com **< 5 ondas** não chegam ao Daily/Weekly.
- **Intervalos longos/extremos/críticos** e **horizonte** > 180/365 dias bloqueiam ou
  exigem revisão, preservando a matemática (nunca apaga/corrige).
- **Frescor**: `content/forecast.json` stale/inválido/incompleto é **recusado** pelo
  Weekly (nunca usado silenciosamente).
- **Admin** (Forecast e Predict) exibe dataset, bloqueios temporais, placeholders e
  duplicidades prováveis.

## 4. Funções adicionadas (puras, sem I/O)

`scripts/radar-quality.mjs` (canônico) + `lib/radar-quality.ts` (espelho TS):
- `evaluateTemporalPlausibility(campaign)` → `{status, flags, severity, includeInPrediction,
  requiresReprocessing, requiresHumanReview, reasons, eventDate, provenanceDate}`.
- `detectProbableDuplicates(rows)` → grupos `{campaignIds, duplicateStatus, duplicateScore, reasons}`.
- `assessCampaigns(rows)` → `{eligible, blocked, duplicates, counts, …}`.
- `evaluateEditorialGate(forecast, now)` → `{editorialEligible, editorialBlockReasons,
  warnings, requiresEditorialReview, longestInterval, intervalClass, horizonDays}`.
- `containForecast(rows, {now, config, datasetComplete})` → resultado + metadados por série.
- `radarItemsEligible(annotated)`, `classifyInterval(days)`, `evaluateForecastFreshness(json, nowMs)`,
  `isPlaceholderProgram`, `isAmbiguousAlias`, `isPermanentVigencia`, `eventDateOf`, `provenanceDateOf`.

`scripts/radar-dataset.mjs`: `loadCampaignsPaged({fetchPage})`, `makeSupabasePageFetcher(...)`.
`lib/admin-db.ts`: `restPaged(table, opts)` (paginação no app).

## 5. Limiares (versionados, centralizados em `THRESHOLDS`, `QUALITY_VERSION="c0_v1"`)

```
eventFarBeforeSourceWarningDays  = 180   eventFarBeforeSourceCriticalDays = 300
eventAfterSourceToleranceDays    = 30    longIntervalWarningDays          = 365
extremeIntervalDays              = 540   criticalIntervalDays             = 900
minForecastEditorialWaves        = 5     maxEditorialHorizonDays          = 180
criticalHorizonDays              = 365   maxForecastAgeHours              = 24
duplicateProbableScore = 4  duplicatePossibleScore = 2  duplicateNearPercentDelta = 5
duplicateProvenanceProximityDays = 21
```

## 6. Bloqueios (ordem de precedência na saída dos motores)

1. Dataset incompleto → distribuição inteira bloqueada.
2. Data temporalmente suspeita (crítica) → fora da série.
3. Duplicidade provável (registro crítico) → fora da série.
4. Placeholder/programa inválido (`null`, `desconhecido`, `cartao`, `parceiros`, …) → fora.
5. Amostra insuficiente (< 5 ondas) → não editorial.
6. Intervalo extremo/crítico (≥540/≥900) → não editorial.
7. Horizonte excessivo (> 365d) → não editorial; > 180d → warning + revisão.
8. Artefato stale/inválido/incompleto → Radar automático recusado.

**Datas de proveniência (`first_seen`=`published_at`, `observed_at`, `created_at`)
validam, geram warning, bloqueiam, pedem reprocessamento/revisão — nunca substituem a
data do evento nem corrigem ano/mês automaticamente.**

## 7. Arquivos alterados/criados

Código: `scripts/radar-quality.mjs` (novo), `scripts/radar-dataset.mjs` (novo),
`lib/radar-quality.ts` (novo), `scripts/forecast.mjs`, `scripts/render-weekly.mjs`,
`lib/admin-db.ts`, `lib/admin-forecast.ts`, `lib/admin-predict.ts`,
`app/admin/(panel)/forecast/page.tsx`, `app/admin/(panel)/predict/page.tsx`.
Testes: `tests/radar-quality.test.mjs`, `tests/radar-dataset.test.mjs`,
`tests/radar-parity.test.mjs` (novos).

## 8. Testes

`npm test` — 63 testes, 0 falhas. Cobrem: caso Livelo→ConnectMiles (bloqueio + sem 943 +
sem 2029), `windowDate`, erro de ano, evento antes/depois da fonte, conflito de datas,
permanente, invalid_date, duplicidade possível/provável, série-lixo, placeholders,
aliases ambíguos, `classifyInterval`, gate de 1/2/4/5 ondas, horizonte 180/365,
frescor (fresh/stale/missing/invalid/incomplete), paginação > 2.000 e dataset
incompleto, e **paridade comportamental TS↔MJS** (transpila `lib/*.ts` e compara saídas:
temporal, duplicidades, ondas, intervalos, elegibilidade, janela, confiança).

Validação: `npm run typecheck`, `npm run lint`, `npm run build` verdes;
`npm run forecast`/`weekly`/`edition` rodam em modo offline sem tocar produção.

## 9. Limitações

- **Detecção de incompletude no app é best-effort:** `rest()` (admin-db) engole erros,
  então uma página que falha parece "fim do dataset". O CLI `forecast.mjs` tem detecção
  estrita (teto de páginas → `datasetComplete=false`).
- `suspect_month` está no enum mas, sem contexto de série por campanha, hoje só é
  inferido via a heurística de troca dia/mês (`suspect_day_month`). Refinamento
  depende do modelo de séries persistido.
- A contenção **não** persiste nenhuma decisão; é recalculada a cada leitura.
- `data_anuncio` não existe no schema atual; a política a prevê como data de evento
  futura (ADR-002) — hoje só `vigencia_inicio`/`vigencia_fim` são datas de evento.

## 10. Itens que exigem migration (fora da Fase C0)

`campaign_identity`, `campaign_version`, `source_observation`, `data_evento` persistida,
novo modelo de vigência, catálogo persistido de programas/aliases, merge auditável de
duplicatas, correção **persistida** dos dados, snapshot canônico, `prediction_outcome`,
reconciliador completo Forecast×Predict, admin Radar unificado. (Ver ARQUITETURA §27f.6.)

## 11. Rollback

Reversível por completo: (a) `git revert` do commit desliga a contenção; (b) as funções
de contenção são aditivas — remover as chamadas em `forecast.mjs`/`admin-forecast.ts`/
`admin-predict.ts`/`render-weekly.mjs` restaura o comportamento anterior; (c) nenhum dado
de produção foi tocado, então não há rollback de banco a fazer. Os limiares são
centralizados em `THRESHOLDS` (ajuste sem tocar a lógica).

## 12. Dívidas mantidas (conscientes)

- ID ainda embute `vigencia_fim` (não alterado nesta fase — resolvido estruturalmente
  por ADR-009); a contenção **neutraliza** o efeito em runtime, mas a duplicata
  permanece no banco.
- `content/forecast.json` versionado permanece o de 2026-07-14 (não regenerado com dado
  vivo nesta fase).
- Espelho TS↔MJS mantido manualmente (agora **coberto por teste de paridade**).
