# Implementação — Fase P1-C (Operação do Radar)

> Registro do que foi **efetivamente implementado** na onda **P1-C** do Radar
> (`docs/BACKLOG-P1-RADAR-UNIFICADO.md` §16 P1-012…P1-017, §6.3, §14): filas
> operacionais, painel de alertas consolidado, camada honesta "O que mudou",
> resumo operacional, estados vazios padronizados e navegação consolidada
> (Radar como entrada; Forecast/Predict/Observability como análise técnica).
>
> **Camada de composição/experiência.** Reusa o `RadarViewModel`/`loadRadar` do
> **P1-A** e os helpers de filtro do P1-A — **nenhuma segunda leitura do ledger,
> nenhuma segunda fonte de verdade, nenhum cálculo novo** de Forecast, Predict,
> qualidade, frescor, divergência ou status. Sem persistência, sem migration, sem
> alterar motores/gates/ADRs. Telas atuais intactas.

## 1. Matriz (nenhum cálculo novo)

| Capacidade | Fonte atual | Uso no P1-C | Novo cálculo necessário |
|---|---|---|---|
| Séries + status de produto | `RadarViewModel.series[].productStatus` (P1-A) | filas por estado; resumo; alertas | **não** |
| Divergência | `RadarSeries.divergenceLevel/Days` (P1-A) | fila de revisão; alerta bloqueante | **não** |
| Qualidade (temporal/dup/placeholder) | `RadarSeries.quality` / `health` (C0.2) | filas de suspeitos/duplicidades; alertas | **não** |
| Frescor + completude | `RadarViewModel.metadata` (P1-A) | fila "desatualizadas"; bloqueios globais; alertas | **não** |
| Motor principal / disponibilidade | `mainEngine`/`predictAvailable`/`forecastAvailable` (`lib/radar-filters`, P1-A) | filas "sem previsão", "revisão"; alertas | **não** |
| Motivos de bloqueio derivados | `seriesCauses` (`lib/radar-filters`, P1-A) | links de diagnóstico dos alertas | **não** |
| Campanhas usadas/excluídas | `RadarSeries.quality.used/excluded` (P1-B) | contagens de "o que mudou" (exclusões/elegibilidade) | **não** |
| Leitura do ledger | `loadRadar` (P1-A) | **a mesma**; a operação é derivada em runtime | **não** |
| Navegação/UI | `Sidebar`, `components/admin/ui` | grupos Radar + Análise técnica; abas | não |

Filas, alertas, resumo e eventos são **derivações puras** (`lib/radar-operations.ts`)
de campos existentes — nunca recalculam motor, qualidade, frescor, divergência ou
status, e **nunca inventam histórico**.

## 2. Arquivos

**Novos:**
- `lib/radar-operations.ts` — **puro**: `buildRadarQueues` (8 filas),
  `seriesQueueMembership` (sobreposição explícita), `buildOperationalAlerts`,
  `operationalSummary`, `radarChangeEvents` (+ `NO_SNAPSHOT_MESSAGE`,
  `CHANGE_UNAVAILABLE`). Reusa os helpers do P1-A (`mainEngine`, `predictAvailable`,
  `forecastAvailable`, `duplicateState`).
- `components/admin/radar-operations.tsx` — `RadarTabs`, `RadarOperationalSummary`,
  `RadarAlertsPanel`, `RadarQueueList`, `RadarQueuesView`, `RadarBlocksView`
  (globais × por série), `RadarChanges`. Server components.
- `tests/radar-operations.test.mjs` — 11 casos (§4).

**Alterado (compatível):**
- `app/admin/(panel)/radar/page.tsx` — abas por `?view=` (geral · oportunidades ·
  revisões · bloqueios · operação); a "Visão geral" ganha o resumo operacional no
  topo. Filtros do P1-A preservados na visão geral.
- `components/admin/Sidebar.tsx` — grupo **Radar** (Visão geral, Oportunidades,
  Revisões, Bloqueios, Operação) + grupo **Análise técnica** (Forecast, Predict,
  Radar VPM, Observabilidade). **Nenhuma rota removida** — Forecast/Predict/
  Observability seguem acessíveis.

Nenhuma alteração em Forecast, Predict, `campaign-quality`, gates, frescor,
`content/forecast.json`, `radar-view-model.ts` (contrato do P1-A/B), telas atuais
ou ADRs.

## 3. Filas (§5–§8)

| Fila | Critério (campos existentes) | Ordem |
|---|---|---|
| Oportunidades | `opportunity` + elegível + base completa/fresca + sem bloqueio crítico + motor pronto | janela mais próxima |
| Exigem revisão | `review_required`, divergência review/block, `possible_duplicate`, fallback do Forecast, bloqueio overridável | — |
| Bloqueadas | dataset incompleto, temporal crítico, duplicidade, histórico insuficiente, sem motor, intervalo/horizonte extremo, stale | hierarquia D16 |
| Dados suspeitos | `quality.temporalCritical > 0` | — |
| Duplicidades prováveis | `quality.probableDuplicate > 0` | — |
| Histórico insuficiente | `insufficient_history` | — |
| Desatualizadas | frescor ≠ fresh (global; números suspensos) | — |
| Sem previsão utilizável | `mainEngine = none` ou `no_prediction` | — |

Uma série pode pertencer a mais de uma fila — a sobreposição é **explícita** na UI
("+N filas"). Os bloqueios são separados em **globais** (base/frescor) × **por
série**, seguindo a hierarquia já aprovada (D16), sem criar uma nova.

## 4. "O que mudou" — honesto (§10/§11)

**Disponível agora** (derivado do estado atual, nunca de diff): exclusões nesta
leitura, duplicidades/erros temporais detectados, elegibilidade perdida após
exclusões, histórico insuficiente após qualidade, base incompleta, artefato stale,
Predict indisponível, fallback do Forecast ativo, divergências de
revisão/bloqueio. **Depende de snapshot** (nunca inferido): probabilidade/janela/
confiança/motor/aprovação/status de ontem → mensagem fixa
**"Não disponível sem snapshot histórico persistido."**

## 5. Resumo operacional (§12)

Regras explícitas (sem IA): responde "o Radar está saudável?", quantas prontas,
em revisão, bloqueadas, qual o **risco principal** (base incompleta → stale →
temporal crítico → duplicidade → divergência bloqueante) e a **ação prioritária**
correspondente, com uma frase de recomendação.

## 6. Navegação (§14)

`Radar` (Visão geral · Oportunidades · Revisões · Bloqueios · Operação, via `?view=`)
e `Análise técnica` (Forecast · Predict · Radar VPM · Observabilidade). O Radar é a
entrada; as superfícies técnicas continuam acessíveis. Abas na própria página
espelham a navegação.

## 7. Testes (`tests/radar-operations.test.mjs`, 11 casos)

Oito filas com textos; oportunidades só elegíveis; connectmiles em
bloqueadas/suspeitas/duplicidades/sem-previsão e **fora** de revisão; sobreposição
de filas explícita; fila "desatualizadas" vazia com fresco / cheia com stale;
alertas (temporal crítico + duplicidade; dataset/frescor só quando aplicável;
campos completos); dataset incompleto → alerta global crítico; resumo operacional
(risco/ação corretos; base incompleta dominante); "o que mudou" (só observável;
lista fixa do que exige snapshot; globais quando aplicável).

Validação: `npm test` (**185/185**), `npm run typecheck`, `npm run lint`,
`npm run build` — todos verdes. `/admin/radar` e `/admin/radar/[seriesKey]`
compilam como rotas dinâmicas; forecast/predict/observability funcionais.

## 8. Fora do P1-C

Paridade formal e handoff (P1-D). Estrutural (não iniciado): aprovação persistida,
snapshot canônico, Editorial Score, `prediction_outcomes`, timeline histórica real,
identidade/dedup persistidas, integração Daily/Weekly/Pro, automação — conforme
`BACKLOG-P1-RADAR-UNIFICADO.md` §18 e os ADRs `proposed`.

## 9. Rollback

Reverter o commit remove `lib/radar-operations.ts`, os componentes de operação, as
abas/views da página e a reestruturação do Sidebar; nada mais é tocado (sem banco,
migration, dados, artefato). O P1-A/B e as telas atuais permanecem intactos.
