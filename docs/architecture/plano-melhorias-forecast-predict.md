# Plano de implementação — melhorias Forecast & Predict

> **✅ STATUS (2026-07-15): ENTREGUE INTEGRALMENTE no PR #76** — Fases 0–4 e
> Trilha D, incluindo o rename, overrides no Predict, tendência de snapshots
> com cron, filtros server-side, `lib/series-builder.ts` (ADR-SERIES-001) e a
> fila assistida de correção de datas (migração 0008 aplicada). Documento
> mantido como registro; a sequência viva está em
> `plano-implementacao-consolidado.md`.

> Sequência proposta após a camada de dashboards (PR #76). Fases ordenadas por
> valor ÷ risco; cada uma é um PR independente e mergeável sozinho. Gates de
> saída em todas: `npm run typecheck` + `npm run build` + `npm test` verdes e
> checklist de marca do CLAUDE.md.

## Mapa de dependências atual (levantado em 2026-07-15)

```
lib/forecast.ts  ←  lib/admin-forecast.ts  ←  app/admin/(panel)/forecast/{page,actions}
      ↑                                    ←  app/admin/(panel)/observability/page.tsx
      ↑          ←  lib/radar-view-model.ts / lib/radar-detail.ts  (radar concilia OS DOIS motores)
      ↑          ←  scripts/forecast-engine.mjs (espelho MJS; paridade garantida por
      ↑                                          tests/forecast-parity.test.mjs)
lib/predict-engine.ts  ←  lib/admin-predict.ts  ←  app/admin/(panel)/predict/{page,actions}
                       ←  lib/radar-view-model.ts
```

Divergências estruturais documentadas (`docs/auditoria/predict-forecast-divergences.csv`):
filtro de tipo (trim vs não-trim), `minSamples` (2 vs 3), modelo (mediana+janela vs
hazard+backtest), e overrides/config só no Forecast.

---

## Fase 0 — Rename e higiene (S, risco zero)

**Problema.** `lib/admin-forecast.ts` e `lib/admin-predict.ts` exportam ambos
`loadPredict`; o componente da página Forecast se chama `PredictPage`. Import
errado compila sem aviso.

**Passos.**
1. `lib/admin-forecast.ts`: `loadPredict` → `loadForecast`, `PredictData` →
   `ForecastData`, `PredictView` → `ForecastView` (manter alias `export type
   PredictView = ForecastView` por uma release se algum script externo importar).
2. `app/admin/(panel)/forecast/page.tsx`: componente → `ForecastPage`,
   `PredictTable` → `ForecastTable`.
3. Atualizar consumidores: `forecast/actions.ts`, `observability/page.tsx`
   (usa só `getConfig` — sem mudança de comportamento).

**Aceite.** `grep -rn "loadPredict" lib app` só encontra `admin-predict.ts` e a
página Predict; suite verde.

---

## Fase 1 — Overrides (fixar/silenciar) na área Predict (M)

**Problema.** O operador que identifica ruído olhando o Predict precisa trocar
de página para agir. A tabela `forecast_overrides` (scope `route|cluster` +
chave `origem→destino` / `→destino`) já cobre o caso — falta a ponte.

**Passos.**
1. Mapear `Prediction` → chave de override: `origem ? \`${origem}→${destino}\` :
   \`→${destino}\`` (mesmo formato do Forecast; adicionar teste de round-trip
   com as chaves reais de `docs/auditoria/predict-forecast-series.csv`).
2. Extrair a lógica de `setOverrideAction`/`removeOverrideAction` de
   `app/admin/(panel)/forecast/actions.ts` para `lib/admin-overrides.ts`
   (server-only) e reusar nas duas áreas.
3. `lib/admin-predict.ts`: `loadPredict` passa a ler `getOverrides()` e a
   decorar cada série com `pinned/muted` (função pura + teste).
4. UI Predict: ação rápida fixar/silenciar na linha da tabela e no
   `OpportunityCard`; silenciadas saem do ranking de oportunidades e do heatmap
   (ficam só nas tabelas, com pill "silenciado", padrão do Forecast).

**Decisão a registrar.** Override de *confiança* NÃO se aplica ao Predict
(a confiança dele nasce de CV + backtest; sobrescrever quebraria a leitura do
hazard). Documentar no código e no rodapé da página.

**Aceite.** Teste novo `tests/predict-overrides.test.mjs`; mute no Forecast
reflete no Predict e vice-versa (mesma tabela).

---

## Fase 2 — Tendência por série a partir de `predict_snapshots` (M)

**Problema.** O snapshot grava `prob_7…prob_180`, janela, confiança e backtest
por série/dia (upsert idempotente por `series_key,as_of_date`), mas a UI não usa
nada disso — não dá para ver se uma probabilidade está subindo nem se o motor
está calibrado.

**Passos.**
1. `lib/admin-predict.ts`: `getSeriesTrends(seriesKeys: string[], days = 60)` —
   uma query com `series_key=in.(…)` + `as_of_date=gte.…`, agrupada em memória
   (evita N+1; as top-10 do dashboard cabem em uma chamada).
2. `OpportunityCard`: sparkline (componente existente) da evolução de `prob_30`;
   `DetailCard`: mesma série + evolução do `windowHitRate` do backtest
   ("calibração" — o motor acerta mais conforme o backfill cresce?).
3. Painel "Calibração do motor" (disclosure, fechado): tabela por série com
   hit-rate e erro mediano do backtest no primeiro vs último snapshot.
4. **Automação da coleta**: hoje o snapshot é manual (botão). Criar job diário
   (mesma infra do painel `jobs`/pg_cron já usada no projeto) chamando a rotina
   de snapshot — sem dado diário não existe tendência. Idempotência já garantida
   pelo upsert.

**Aceite.** Fixture com 3 snapshots sintéticos → tendência correta; página
degrada sem erro quando há <2 snapshots (empty state didático).

---

## Fase 3 — Filtros server-side nas tabelas (S/M)

**Problema.** Com o backfill crescendo, as tabelas recolhidas continuam longas
por dentro (rotas já corta em 60 arbitrariamente).

**Passos.**
1. `searchParams` nas duas páginas: `?conf=alta|media|baixa`, `?q=<substring da
   série>`, `?bloqueadas=0|1`. Filtragem no server, zero JS.
2. Chips de filtro (links) acima das tabelas, estado ativo com `bg-paper-dark`;
   chip "limpar" quando algo está ativo.
3. Substituir o `slice(0, 60)` das rotas por paginação por link
   (`?pagina=2`) com contagem total no título do disclosure.

**Aceite.** URLs de filtro compartilháveis; sem filtro, render idêntico ao atual.

---

## Fase 4 — Series-builder único (L, estrutural — fazer por último)

**Problema.** Dois motores formam séries a partir do mesmo ledger com regras
*quase* iguais (windowDate, normProgram, collapseWaves(3), gate C0.2) mantidas
em dobro — e em triplo com `scripts/forecast-engine.mjs`. As divergências reais
já geraram auditoria própria.

**Estratégia: extrair, não fundir.** Forecast e Predict continuam existindo
(modelos diferentes de propósito: janela editorial vs hazard) — o que unifica é
a *formação da série*.

**Passos.**
1. **Testes de caracterização primeiro**: congelar o comportamento atual dos
   dois motores com fixtures derivadas de `docs/auditoria/predict-forecast-series.csv`
   (inclusive os casos L1/L2 do lineage). Nada muda até esses testes existirem.
2. Extrair `lib/series-builder.ts`: `buildSeries(campaigns, {waveEpsilonDays})`
   → `{ seriesKey, scope, events[], intervals[], quality }` com **uma** regra de
   normalização (resolver a divergência trim/não-trim aqui, deliberadamente).
3. `buildForecast` e `buildPredict` passam a consumir o builder; `minSamples`
   continua parâmetro de cada motor (2 vs 3 é decisão de produto — registrar em
   `docs/architecture/adr/ADR-PREDICT-00X-series-builder.md`).
4. Espelho MJS: o teste de paridade já importa `lib/forecast.ts` via
   type-stripping (Node ≥ 22.18). Avaliar aposentar `scripts/forecast-engine.mjs`
   fazendo os scripts importarem o `.ts` diretamente; se o runtime do pipeline
   não permitir, espelhar apenas o builder (superfície bem menor que o motor
   inteiro).
5. Rodar a auditoria de divergência antes/depois: divergências restantes devem
   ser **somente** as intencionais (minSamples, modelo).

**Riscos e mitigação.** Números editoriais podem se mover → os testes de
caracterização + `radar-parity`/`forecast-parity` são o gate; qualquer delta não
explicado bloqueia o merge.

---

## Trilha paralela D — Qualidade do dado na origem (não bloqueia as fases acima)

O lineage (`docs/auditoria/predict-forecast-lineage.md`) prova dois defeitos
sistemáticos **de extração**, não de motor: ano fabricado em `vigencia_fim`
(pilha de campanhas 2025 datadas 2024; 77% das linhas com `first_seen` >180d
após a `window_date`) e dedup impossível porque o `id` embute a própria data
errada. O C0.2 contém o estrago, mas a base segue contaminada.

1. **Detecção**: flag `suspect_year` quando `first_seen − window_date ∈
   [300, 430]d` e a `source_url` contém marcador de data conflitante — já há
   precedente no `campaign-quality`; ampliar cobertura + teste.
2. **Correção assistida, nunca automática**: fila de revisão no admin
   (campanha suspeita → data proposta com a evidência da URL/notes → operador
   confirma). Regra-mãe do projeto: faltou dado confirmado → "Não confirmado",
   nunca chutar — correção só com proveniência explícita.
3. **Prevenção**: extrator passa a validar ano contra `first_seen` no ingest;
   dedup por chave semântica (rota+percentual+janela±ε) além do `id`.

---

## Ordem recomendada e esforço

| Fase | Esforço | Risco | Valor imediato |
|---|---|---|---|
| 0 — Rename | S | zero | manutenção |
| 1 — Overrides no Predict | M | baixo | operação |
| 2 — Tendência de snapshots | M | baixo | calibração do motor |
| 3 — Filtros server-side | S/M | baixo | usabilidade |
| 4 — Series-builder único | L | médio (gated) | arquitetura |
| D — Qualidade na origem | M/L | baixo (assistido) | confiança editorial |

Fases 0→3 são incrementais e podem sair uma por semana; a 4 só começa com as
caracterizações prontas; a trilha D corre em paralelo por ser outra superfície
(extração/ingest).
