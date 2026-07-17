# Correção A1 — Paridade de Proveniência entre Forecast legado e Radar

> Fase: A1 · Base: `claude/loyalty-landing-page-v1-7vbjq7` (contém o PR #54 / `0c0cc23`)
> Escopo: fechar a dívida A1 de paridade. **Não** altera matemática do Forecast,
> Predict, gates, limiares, regras de duplicidade, dados no banco ou o Radar UI.

## Causa

O motor de Forecast (`lib/forecast.ts → buildForecast`) **já** aplica a contenção
temporal C0.2: na linha 361 ele chama `assessCampaignQuality(rows, …)`, que usa
`evaluateTemporalPlausibility` para comparar a **data do evento** com as **datas de
proveniência** (`first_seen`/`last_seen`/`observed_at`/`created_at`) e marcar como
`suspect_year` (crítico, excluído da previsão) qualquer registro cujo evento esteja
muito antes da proveniência **sem início explícito** — o ano provavelmente foi
fabricado na ingestão.

O problema não estava no motor, e sim no **loader**. `lib/admin-forecast.ts`
(`loadPredict`, que alimenta `/admin/forecast`) lia apenas 7 colunas:

```
id,tipo,origem,destino,percentual,vigencia_inicio,vigencia_fim
```

Sem as colunas de proveniência, as linhas chegavam ao motor com
`first_seen/observed_at/created_at` = `undefined`. Assim `provenanceDates(row)`
retornava `[]`, `dayDifference` ficava `null` e o ramo `suspect_year` **nunca
disparava**. O Radar (`lib/admin-radar.ts`) já lia as colunas de proveniência
(`RADAR_SELECT`) e por isso continha o caso corretamente — daí a divergência.

## Impacto

No caso `livelo → connectmiles`, um registro com ano suspeito (evento em
`2023-12-12`, mas visto pela primeira vez em `2026-07`) escapava da contenção no
Forecast. Como consequência, em `/admin/forecast`:

- formava-se um intervalo espúrio de **943 dias** (`Maior intervalo 943d`);
- o motor projetava uma **janela em 2029** (última onda + ~943 dias);
- o Forecast divergia do Radar, que excluía o registro e não mostrava nada disso.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `lib/ledger-select.ts` | **novo** — fonte ÚNICA da seleção de colunas do ledger (`LEDGER_QUALITY_SELECT`, `PROVENANCE_COLUMNS`). Módulo puro, sem I/O nem imports. |
| `lib/admin-forecast.ts` | `FORECAST_LEDGER_SELECT = LEDGER_QUALITY_SELECT`; `loadPredict` passa a buscar `campaigns` com proveniência (antes: 7 colunas). |
| `lib/admin-radar.ts` | `RADAR_SELECT = LEDGER_QUALITY_SELECT` (reusa a fonte única; valor idêntico ao anterior). |
| `tests/forecast-provenance-parity.test.mjs` | **novo** — 11 testes de proveniência/paridade com fixtures. |

Nenhuma alteração em `lib/forecast.ts`, `lib/predict-engine.ts`,
`lib/campaign-quality.ts`, `lib/radar-view-model.ts` ou nas telas.

## Colunas adicionadas (à leitura do Forecast)

`first_seen`, `last_seen`, `observed_at`, `created_at`, `source_url`, `origin`.

São exatamente os campos que `assessCampaignQuality` / `resolveEventDateCandidate`
já esperam. Nenhuma coluna nova foi inventada; a seleção do Forecast passou a ser
**idêntica** à do Radar (mesma fonte única).

## Paridade

`buildForecast` e `composeRadarViewModel` chamam o **mesmo** `assessCampaignQuality`
sobre as **mesmas** linhas. Com os dois loaders lendo a mesma seleção canônica,
ambos partem da mesma amostra elegível por construção. Os testes A1-6 e A1-7
provam igualdade dos conjuntos **elegível** e **excluído** entre Forecast e Radar.

## Caso 943

- **Antes (7 colunas):** registro suspeito elegível → intervalo 943 → janela 2029.
- **Depois (com proveniência):** `evaluateTemporalPlausibility` marca `suspect_year`
  (crítico), `includeInPrediction = false`; o registro sai da amostra; a rota fica
  com 1 onda elegível → `em-formacao`, `maxIntervalDays = null`, `windowStart = null`.
  Sem 943, sem 2029. O teste A1-4/A1-5 valida os dois lados (com e sem proveniência)
  para fixar a raiz.

## Testes

`tests/forecast-provenance-parity.test.mjs` (11 testes, todos com fixtures — nenhuma
rede):

1. loader lê as colunas de proveniência (seleção canônica única; guarda contra
   regressão à seleção de 7 colunas);
2. `suspect_year` dispara com proveniência e não dispara sem;
3. caso `livelo → connectmiles` — A excluída, B elegível;
4. ausência do intervalo de 943 dias (com contraste sem proveniência);
5. ausência da janela/previsão em 2029 (com contraste);
6. paridade da amostra **elegível** Forecast × Radar;
7. paridade das campanhas **excluídas** Forecast × Radar;
8. regressão de séries válidas (nenhum falso positivo);
9. regressão de `/admin/forecast` (não exibe `Maior intervalo 943d`, não vira item);
10. caminho puro sem **nenhuma** chamada de rede (nada é escrito/lido no banco);
11. matemática do motor inalterada (limiares + números das válidas idênticos com/sem
    proveniência).

Suíte completa: `npm test` → 236 testes, 0 falhas. `npm run lint`, `npm run typecheck`
e `npm run build` limpos.

### Validação manual

`/admin/forecast`, `/admin/radar` e o detalhe de `livelo → connectmiles` dependem de
servidor + Supabase. A regra proíbe usar Supabase de produção, então a validação
manual dessas telas fica coberta pelos testes A1-6/A1-7 (paridade) e A1-9
(regressão da tela), que replicam o transform exato de `loadPredict`
(`buildForecast → radarItems`) e de `composeRadarViewModel` sobre fixtures.

## Riscos

- **Baixo.** A mudança é aditiva na leitura: mais colunas no `select`. Para dados já
  válidos, a saída do motor é bit-a-bit idêntica (provado em A1-11). O único efeito
  comportamental é a exclusão de registros temporalmente suspeitos — o objetivo.
- Se a tabela `campaigns` não tivesse alguma dessas colunas, o PostgREST erraria a
  leitura; porém o Radar já as lê em produção (mesma `RADAR_SELECT`), então as
  colunas existem.

## Rollback

Reverter os três commits (ou apenas `fix(forecast)`) restaura a seleção de 7
colunas. Como não há migration, backfill nem escrita no banco, o rollback é
puramente de código, sem estado a desfazer.

## Confirmação — sem alteração de motor nem banco

- **Motor:** intacto. `lib/forecast.ts`, `lib/predict-engine.ts` e
  `lib/campaign-quality.ts` não foram tocados. Limiares e `DEFAULT_FORECAST_CONFIG`
  inalterados (A1-11).
- **Banco:** intacto. Nenhuma migration, nenhum backfill, nenhuma escrita. A leitura
  apenas passou a pedir mais colunas já existentes. O teste A1-10 prova que o caminho
  puro não faz chamadas de rede. Predict, gates, limiares e regras de duplicidade
  permanecem como estavam.
