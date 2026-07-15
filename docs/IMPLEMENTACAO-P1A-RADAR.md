# Implementação — Fase P1-A (Radar unificado, fundação da visão)

> Registro do que foi **efetivamente implementado** na onda **P1-A** do Radar
> Preditivo (`docs/BACKLOG-P1-RADAR-UNIFICADO.md` §16, itens P1-001…P1-005).
> Camada de **composição e experiência**: nova rota `/admin/radar`, um Radar View
> Model derivado em **runtime**, saúde, listagem unificada, filtros e navegação —
> **reusando 100%** de Forecast, Predict e qualidade C0/C0.2.
>
> **Nenhuma persistência nova, nenhuma fonte de verdade nova, nenhum motor/gate
> alterado.** Sem migration, sem banco, sem snapshot, sem Editorial Score, sem
> aprovação, sem Daily/Weekly/Pro, sem publicar. As telas `/admin/forecast`,
> `/admin/predict` e `/admin/observability` seguem **intactas**.

## 1. Matriz de reutilização (nenhum cálculo novo)

| Capacidade | Fonte atual | Como é reutilizada no P1-A | Novo cálculo necessário |
|---|---|---|---|
| Forecast (recorrência, gate editorial) | `lib/forecast.ts` (`buildForecast`, `editorialGate`) | chamado 1× em `composeRadarViewModel`; saída preservada por série | **não** |
| Predict v2 (hazard/backtest) | `lib/predict-engine.ts` (`buildPredict`) | chamado 1× em `composeRadarViewModel`; saída preservada por série | **não** |
| Qualidade temporal + duplicidade | `lib/campaign-quality.ts` (`assessCampaignQuality`) | vem de `fc.quality` (mesmo conjunto elegível dos motores); contadores/excluídas na saúde e por série | **não** |
| Frescor do artefato | `scripts/forecast-freshness.mjs` (`assessForecastFile`) | lido em `lib/admin-radar.ts`; status/idade no cabeçalho e por série | **não** |
| Paginação completa / `datasetComplete` | `lib/admin-db.ts` (`fetchAllRows`) | **uma** leitura do ledger alimenta os dois motores | **não** |
| Config do Forecast (persistida) | `lib/admin-forecast.ts` (`getConfig`) | passada a `buildForecast` (paridade com `/admin/forecast`) | **não** |
| Normalização/aliases | `normProgram` (injetado) | chave canônica de série e casamento Forecast↔Predict | **não** |
| Janela formatada | `formatWindow` | rótulo de janela na tabela | **não** |
| Layout/navegação do admin | `app/admin/(panel)/layout.tsx`, `Sidebar` | nova entrada "Radar"; auth por cookie herdada (`middleware` `/admin/:path*`) | não |
| Componentes de UI | `components/admin/ui.tsx` (`StatCard`, `Table`, `Pill`, `EmptyState`…) | cabeçalho, KPIs, tabela, filtros | não |

Estado consolidado da série (`productStatus`) e divergência entre motores são
**etiquetas derivadas** dos campos acima (precedência do D16 / faixas do D6) —
não recalculam gate, qualidade nem probabilidade.

## 2. Arquivos

**Novos:**
- `lib/radar-view-model.ts` — composição **pura** (`composeRadarViewModel`): casa
  Forecast × Predict × qualidade por série, deriva `productStatus`, saúde e
  filtros. Sem I/O. Alvo dos testes.
- `lib/admin-radar.ts` — loader **I/O** (`loadRadar`): uma leitura do ledger
  (`fetchAllRows`), frescor (`assessForecastFile`), config (`getConfig`), e chama
  o composer. Server-only.
- `components/admin/radar.tsx` — `RadarHealthSummary`, `RadarKpis`,
  `RadarFilters` (GET form, sem JS de cliente), `RadarSeriesTable`.
- `app/admin/(panel)/radar/page.tsx` — página server-only; lê `searchParams`
  (busca/estado/confiança/escopo/destino), filtra e renderiza.
- `tests/radar-view-model.test.mjs` — paridade + comportamento (943, saúde,
  dataset incompleto, stale, filtros).

**Alterado:** `components/admin/Sidebar.tsx` — link "Radar" no grupo Inteligência
(acima de Forecast/Predict). Nenhuma rota removida.

## 3. Radar View Model (contrato de leitura P1)

`metadata` (generatedAt do artefato, asOf, datasetComplete, rowsRead, pagesRead,
freshnessStatus) · `health` (12 contadores) · `series[]` (chave, escopo,
`productStatus`, `forecast`, `predict`, `quality`, elegibilidade, warnings,
válidas/excluídas, ondas, última, maior intervalo, janela, P30/P90, bônus,
divergência) · `filters` (origens, destinos, estados, confianças, motivos).

Casamento por chave canônica `origem→destino` / `→destino` (idêntica a
`Forecast.route`), via `normProgram`.

## 4. Decisões de implementação (documentadas para o handoff)

1. **Colunas de proveniência.** O Radar lê `first_seen,observed_at,created_at,
   source_url` (como o pipeline `scripts/forecast.mjs`, `select=*`), enquanto
   `/admin/forecast` e `/admin/predict` selecionam só 7 colunas. Sem essas
   colunas, `suspect_year` **não dispara** e o par do caso 943 vira só
   `possible_duplicate`. Logo, para o Radar **refletir de fato a contenção
   C0.2**, ele lê as colunas que a camada de qualidade foi desenhada para usar.
   Isso **não altera motor/gate** — só lê mais colunas. É um gap das telas atuais
   que o Radar **surfa** (correção persistida é fase estrutural).
2. **Frescor é alerta global, não estado por série.** O `productStatus` usa a
   precedência do D16 para bloqueios de dado (dataset incompleto → temporal
   crítico → duplicidade → placeholder → histórico → …). O frescor do **artefato**
   (`content/forecast.json`) é do Weekly, não do cálculo ao vivo do Radar; então
   ele aparece como **alerta global** no cabeçalho e em `health.staleCount`, sem
   carimbar cada série como `stale` (o Radar recalcula ao vivo a cada request).
3. **Recomendação de motor não persistida.** A precedência Predict>Forecast (D2)
   é exibida como leitura em runtime; a reconciliação **canônica persistida** é
   fase futura (ADR-008). A página marca isso explicitamente.
4. **Uma leitura, dois motores.** `buildForecast` e `buildPredict` rodam sobre as
   MESMAS linhas; a saúde usa `fc.quality` (idêntico a `pr.quality`).

## 5. Comportamento anterior × novo

| Situação | Antes | Agora (P1-A) |
|---|---|---|
| Ver previsão de uma rota | 3 telas (forecast/predict/observability) | **1 entrada** `/admin/radar`, motores internos |
| Divergência entre motores | invisível | faixa D6 (`divergenceDays`/nível) por série |
| Dataset incompleto | banner por tela | alerta **acima** dos números + todas as séries `dataset_incomplete` |
| Frescor | só no render do Weekly | badge no cabeçalho + `staleCount` |
| Qualidade/exclusões | tabela em cada tela | contadores de saúde + válidas/excluídas por série |
| Caso 943 no admin | `/admin/forecast` **não** excluía (sem proveniência) | Radar **exclui** A e mostra `data_quality_blocked` (lê proveniência) |

## 6. Testes (`tests/radar-view-model.test.mjs`, 9 casos)

Paridade (séries e `quality` idênticos aos motores); saúde vs `quality.counters`;
**943** (série `data_quality_blocked`, sem intervalo 943, sem janela, sem "2029");
duplicidade provável e temporal crítico na saúde; série saudável elegível/não
bloqueada; placeholder excluído; **dataset incompleto** marca tudo suspenso;
**stale** vira alerta global sem mudar `productStatus`; filtros populados.

Validação: `npm test` (122/122), `npm run typecheck`, `npm run lint`,
`npm run build` — todos verdes. `/admin/radar` compila como rota dinâmica;
forecast/predict/observability seguem funcionais.

## 7. Fora do P1-A (próximas ondas)

Detalhe da série (P1-B), filas de trabalho e "o que mudou" (P1-C), paridade
formal e handoff (P1-D). Estrutural (não iniciado): aprovação persistida,
snapshot canônico, Editorial Score, `prediction_outcomes`, identidade/dedup
persistidas, Predict na Digest, reconciliação canônica — tudo conforme
`BACKLOG-P1-RADAR-UNIFICADO.md` §18 e os ADRs `proposed`.

## 8. Rollback

Reverter o commit remove a rota, os módulos e o link do Sidebar; nada mais é
tocado (sem banco, sem migration, sem dados, sem artefato). As telas atuais
permanecem exatamente como estavam.

## 9. Filtros completos (complemento P1-A)

O `applyFilters` inline da página foi consolidado no **único** módulo puro
`lib/radar-filters.ts` (não há segundo sistema de filtros) e expandido para cobrir
todo o conjunto do backlog §14. Todos leem **apenas campos já existentes** no
`RadarViewModel` — nenhum recálculo, nenhuma leitura do ledger, nenhuma escrita.

Filtros (query params, combinação por **AND**, estado preservado na URL):
`q` (busca na chave) · `status` · `confidence` · `scope` · `destination`
(existentes, preservados 1:1) · **`origin`** (programa de origem; valor especial
`__cluster__` para agregados) · **`eligible`** (`editorialEligible`) · **`cause`**
(motivo de bloqueio derivado) · **`freshness`** (`freshnessStatus`) · **`duplicate`**
(estado da série) · **`quality`** · **`engine`** (motor principal) · **`predict`** /
**`forecast`** (disponibilidade de cada motor).

**Motor principal × disponibilidade** (distintos): principal = Predict quando
`readiness ∈ {ready, ready_with_warnings}` e há `probabilities`; senão Forecast
como fallback rotulado quando `editorialEligible` com janela; senão nenhum.
Disponibilidade é independente: Predict disponível = `probabilities != null`;
Forecast disponível = janela e `confidence ≠ em-formacao`.

**Duplicidade da série** (não o total global): `probable` quando
`quality.probableDuplicate > 0`; `possible` quando alguma excluída da série tem
`duplicate.status = possible_duplicate`; senão `none`.

**Classe de qualidade — campos exatos que determinam cada opção:**
- `bloqueada`: `quality.temporalCritical > 0` **ou** `quality.placeholder > 0`
  **ou** `quality.probableDuplicate > 0`;
- `atenção`: (não bloqueada) e `warnings.length > 0` **ou** `campaignsExcluded > 0`
  **ou** duplicidade possível **ou** `divergenceLevel ∈ {warning, review, block}`;
- `válida`: nenhum dos acima.

**Motivo de bloqueio** — opções **derivadas** dos motivos realmente presentes
(`deriveFilterFacets`), nunca lista fixa: `base_incompleta` (productStatus),
`qualidade_temporal` (`quality.temporalCritical`), `duplicidade`
(`quality.probableDuplicate`), `historico_insuficiente` / `sem_motor` (productStatus),
`intervalo_extremo` / `horizonte_excedido` (de `editorialBlockReasons`),
`desatualizado` (`freshnessStatus ≠ fresh`).

Testes: `tests/radar-filters.test.mjs` (27 casos) — cada filtro, combinações de três,
combinação com busca, params vazios/limpar, nenhum resultado, cluster agregado,
regressão dos filtros existentes e do View Model, e as invariantes "sem leitura do
ledger" / "sem escrita no banco". Suíte total: **149 testes, 0 falhas**.
