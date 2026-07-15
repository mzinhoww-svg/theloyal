# Backlog P1 — Radar Unificado (`/admin/radar`)

> Especificação **executável** da fase **P1** do Radar Preditivo de Campanhas:
> uma visão unificada para **editor, analista e operador**, reusando 100% das
> capacidades já construídas (C0/C0.2 + motores Forecast e Predict). Nenhum motor
> novo, nenhuma fonte de verdade nova, **nenhuma persistência nova**.
>
> Fontes: `PRODUCT-DESIGN-REVIEW-RADAR.md` (§1, §2.1-B, §8), `DECISOES-PRODUTO-RADAR.md`
> (§1, §6, §7, §8.1, §8.3, §11, §15, §17, §20–§22), `ARQUITETURA-PRODUTO-RADAR-PREDITIVO.md`
> (§18), ADR-RADAR-001…010, `IMPLEMENTACAO-FASE-C0-RADAR.md`, `RECONCILIACAO-FASE-C0.md`,
> e a implementação atual (PR #54). **C0 e C0.2 consideradas concluídas.**
>
> Esta etapa é **somente documentação**. Não implementa código, não altera banco,
> migrations, dados, motores, gates, qualidade temporal, deduplicação, conteúdo
> editorial nem publica Digest.

---

## 1. Resumo executivo

Hoje a previsão de campanhas vive em **três telas desconectadas** — `/admin/forecast`,
`/admin/predict` e a metade de previsão de `/admin/observability` — que rodam **dois
motores** (`buildForecast`, `buildPredict`) sobre o **mesmo ledger `campaigns`** com a
**mesma pré-filtragem** `assessCampaignQuality`, e ainda assim apresentam **respostas
concorrentes** ao operador. Cada tela relê o ledger de forma independente e exibe
recortes diferentes (probabilidades num lado, cadência e gate editorial no outro,
janela crua num terceiro). O resultado: divergência aparente, jargão técnico na
primeira dobra e nenhuma leitura única de "esta série vale atenção agora?".

O **P1** resolve isso **só reorganizando a interface** (PDR §8: "não estrutural; só
reorganiza UI; nenhuma regra tocada"). Entrega uma **única entrada `/admin/radar`**
onde Forecast e Predict aparecem como **motores internos** (nunca como duas respostas),
com o **estado da série, a previsão, a qualidade, a elegibilidade e os bloqueios**
apresentados **acima de qualquer número técnico**. Tudo é **derivado em runtime** das
saídas que já existem; os detalhes de cada motor ficam numa camada analítica secundária.

O P1 **não** cria o snapshot canônico, a aprovação editorial persistida, o Editorial
Score definitivo, a reconciliação canônica, `prediction_outcomes` nem leva o Predict à
Digest — tudo isso é fase estrutural posterior (ADR-006/008/009, §23). O P1 deixa a
experiência unificada pronta para que essas fases sejam plugadas sem retrabalho.

---

## 2. Escopo

O P1 entrega, exclusivamente sobre capacidades existentes e em runtime:

1. **Rota única `/admin/radar`** — visão unificada de editor, analista e operador.
2. **`Radar View Model` derivado em runtime** — uma leitura única do ledger
   (`fetchAllRows("campaigns", …)`) alimentando `assessCampaignQuality`, `buildForecast`
   e `buildPredict`, casados por série (`seriesKey` / rota normalizada por `normProgram`).
3. **Semáforo de saúde** acima dos números: `datasetComplete`, frescor
   (`assessForecastArtifact`), exclusões e divergência.
4. **Estado consolidado da série** (status de produto derivado, sem persistência).
5. **Filas de trabalho** (oportunidades, mudaram, exigem revisão, bloqueadas, suspeitos,
   duplicidades, sem histórico, stale/incompletas).
6. **Tabela/lista de séries** em linguagem de produto (métricas técnicas fora da visão
   principal).
7. **Detalhe da série** reunindo Resumo, Forecast, Predict, Comparação, Qualidade,
   Campanhas utilizadas e excluídas, Timeline e "O que mudou".
8. **Reaproveitamento** integral de `QualityPanel`, `campaign-quality`, `editorialGate`,
   `assessForecastArtifact`, `fetchAllRows`, `validateRadarConsistency` e dos componentes
   `DistributionBar`/`WindowTimeline` (`forecast-charts`).
9. **Convivência** com as telas atuais (não remover nada nesta fase).

---

## 3. Fora de escopo (proibido no P1)

Nada nesta lista pode ser implementado no P1 (repete e detalha as restrições do pedido):

- **Persistência nova de qualquer natureza** (novos estados, tabelas, colunas).
- **Snapshot canônico** promovível (`dataset_hash`, `campaign_ids`, `expires_at`,
  `superseded_by`) — ADR-006, fase P4/P5.
- **Aprovação editorial persistida** e histórico de decisões — ADR-006, P5.
- **Editorial Score definitivo** (existência/pesos) — D9, [aprovação humana].
- **`prediction_outcomes`** / calibração — ADR-006, P5.
- **Nova identidade de campanha** (`campaign_identity`, `campaign_version`,
  `source_observation`) e **merge persistido** de duplicidades — ADR-009, P3.
- **Novo modelo de vigência** (`vigencia_type`, `data_evento` persistida) — ADR-002, P3.
- **Reconciliação canônica** com resultado persistido (precedência Predict>Forecast
  gravada) — ADR-008, P4.
- **Predict na Digest** / automação de publicação — ADR-001/006/008, P5.
- Alterar Forecast, Predict, gates, qualidade temporal, deduplicação, conteúdo
  editorial ou publicar Digest.
- Abrir outro PR, alterar banco/migration/dados/ADRs, gerar artefatos.

---

## 4. Personas

Três personas de admin (o **leitor não faz parte da interface P1** — a integração com
Daily/Weekly/Pro é posterior, ADR-008 §16).

### 4.1 Editor — "vale publicar?"
Precisa identificar: o que merece atenção, o que está elegível, o que está bloqueado,
o que mudou, qual série exige revisão e qual previsão pode virar pauta.
Deriva de: `editorialEligible`/`editorialBlockReason` (Forecast), `readiness`/`confidence`
(Predict), `assessCampaignQuality` (`.counters`, `.excluded`), frescor, `datasetComplete`.

### 4.2 Analista — "por que este número?"
Precisa identificar: campanhas utilizadas e excluídas, resultado Forecast, resultado
Predict, divergências, backtest, qualidade e as razões da previsão.
Reusa: `QualityPanel`, `quality.excluded`, `Prediction.backtest`, `Prediction.explanation`,
`Forecast.basis`. É a **única** persona que vê as três escalas de confiança (§8.1 do DECISOES).

### 4.3 Operador — "a base está sã?"
Precisa identificar: dataset incompleto, artefato stale, falhas, campanhas
temporalmente suspeitas, duplicidades, placeholders, queda de cobertura e séries
afetadas.
Reusa: `datasetComplete` (`fetchAllRows.complete`), `assessForecastArtifact` (frescor),
`quality.counters`, `quality.excluded` (com `temporal.requiresReprocessing` /
`requiresHumanReview`).

---

## 5. Jornada principal

Rota: `/admin/radar`. Cada etapa lista objetivo · informação necessária · ação
disponível · estado vazio · estado de erro · bloqueio · origem do dado existente.

**Etapa 1 — Acessa `/admin/radar`.**
- Objetivo: entrar na visão unificada.
- Informação: cabeçalho de saúde carrega antes de tudo.
- Ação: nenhuma (leitura).
- Vazio: "Sem campanhas no ledger" (ver §13).
- Erro: falha de leitura do ledger → banner de erro (ver §13).
- Bloqueio: `datasetComplete=false` marca o cabeçalho em alerta e propaga aos números.
- Origem: `fetchAllRows("campaigns", …)` (uma leitura), `assessForecastArtifact`.

**Etapa 2 — Vê o estado geral do Radar.**
- Objetivo: saber em 5s se pode confiar nos números.
- Informação: frescor, completude, totais, elegíveis, bloqueadas, alertas críticos.
- Ação: clicar num KPI/alerta para filtrar a lista.
- Vazio: KPIs em zero + estado vazio da tabela.
- Erro/bloqueio: alerta acima dos números (semáforo).
- Origem: `RadarHealthSummary` sobre `quality.counters`, freshness, `datasetComplete`.

**Etapa 3 — Identifica mudanças, oportunidades e bloqueios.**
- Objetivo: priorizar trabalho.
- Informação: filas (oportunidades, mudaram, exigem revisão, bloqueadas, suspeitos,
  duplicidades, sem histórico, stale/incompletas).
- Ação: abrir a fila → abrir a série.
- Vazio por fila: mensagem específica (§5.3).
- Erro: herda o erro global.
- Bloqueio: filas "bloqueadas"/"suspeitos"/"duplicidades" existem justamente para isso.
- Origem: derivação runtime do **estado consolidado** (§6).

**Etapa 4 — Filtra ou busca uma série.**
- Objetivo: chegar a uma rota específica.
- Informação: filtros (§5.5) + busca por rota/programa.
- Ação: aplicar filtro/busca.
- Vazio: "Nenhum resultado após filtros" (§13) com botão limpar.
- Origem: filtragem client-side/servidor sobre o view model já carregado.

**Etapa 5 — Abre o detalhe da série.**
- Objetivo: entender uma série a fundo.
- Informação: resumo executivo no topo do detalhe (§7.1).
- Ação: abrir drawer/página; navegar entre abas do detalhe.
- Vazio: série sem previsão → resumo mostra o motivo (`blockReason`/`editorialBlockReason`).
- Origem: o registro da série no view model (Predict + Forecast + quality por `seriesKey`).

**Etapa 6 — Entende previsão, qualidade e elegibilidade.**
- Objetivo: julgar a série.
- Informação: síntese (chance/janela/bônus/confiança) + qualidade + elegibilidade.
- Ação: expandir seções técnicas.
- Bloqueio: se bloqueada, a síntese diz o motivo antes do número.
- Origem: `probabilities`, `centralDate`, `window*`, `bonusCandidates`, `confidence`,
  `editorialEligible`, `quality`.

**Etapa 7 — Visualiza Forecast e Predict quando necessário.**
- Objetivo: comparar motores.
- Informação: bloco comparativo (§7.5) com divergência.
- Ação: expandir o comparativo.
- Vazio: motor indisponível → rótulo "indisponível" com motivo (§13).
- Origem: `Forecast` × `Prediction` da mesma série + recomendação runtime **rotulada não persistida**.

**Etapa 8 — Audita campanhas utilizadas e excluídas.**
- Objetivo: confiar na série.
- Informação: `quality.eligibleRows` (usadas) e `quality.excluded` (excluídas com motivo).
- Ação: inspecionar; nenhuma escrita.
- Vazio: "nenhuma campanha excluída por qualidade" (texto atual do `QualityPanel`).
- Origem: `assessCampaignQuality`.

**Etapa 9 — Identifica ações futuras (não persistidas).**
- Objetivo: saber o que fazer, mesmo sem poder registrar.
- Informação: `recommendedAction` derivada do estado (§6) + `requiresReprocessing`/
  `requiresHumanReview`.
- Ação: **apenas informativa** no P1 (aprovar/reprocessar são fases futuras).
- Origem: campos existentes; nenhuma persistência.

---

## 6. Página principal `/admin/radar`

Hierarquia completa (topo → base): **Cabeçalho de saúde → KPIs → Filas → Tabela de
séries + Filtros**. O princípio-mãe (PDR §1): **alertas e bloqueios aparecem acima de
qualquer número**.

### 6.1 Cabeçalho (`RadarHealthSummary`)

Apresenta, em uma faixa, antes de tudo:

- **Última atualização** — `assessForecastArtifact().generatedAt` (do `content/forecast.json`).
- **Idade do resultado** — `assessForecastArtifact().ageHours` (formatada "há Nh").
- **Status de frescor** — `assessForecastArtifact().status` ∈ `fresh|stale|missing|invalid|incomplete`
  (badge; só `fresh` é verde).
- **Dataset completo ou incompleto** — `fetchAllRows().complete` (→ `datasetComplete`).
- **Total de campanhas** — `quality.counters.totalReceived`.
- **Total elegível** — `quality.counters.totalEligible`.
- **Séries analisadas** — `result.routes.length + result.clusters.length` (Predict/Forecast).
- **Séries editorialmente elegíveis** — nº de séries com `editorialEligible === true`.
- **Séries bloqueadas** — nº de séries em estado bloqueante (§6.2, §7).
- **Alertas críticos** — contagem derivada: dataset incompleto, stale, exclusões novas,
  divergências (ver §8).

Regra de layout: se `datasetComplete=false` **ou** frescor ≠ `fresh`, o cabeçalho fica
em tom de alerta e um aviso explícito precede os KPIs (nunca esconder).

### 6.2 KPIs (máx. 8)

| # | Nome | Finalidade | Fórmula conceitual | Fonte existente | Drill-down | Alerta |
|---|---|---|---|---|---|---|
| 1 | Base | Confiar ou não nos números | `datasetComplete ? "completa" : "parcial"` | `fetchAllRows.complete` | fila stale/incompletas | vermelho se parcial (nunca override) |
| 2 | Frescor | Resultado é atual? | `assessForecastArtifact().status` + idade | `forecast-freshness` | fila stale | amarelo/vermelho se ≠ fresh |
| 3 | Elegíveis | Quantas podem virar pauta | `count(editorialEligible)` | `editorialGate` | fila oportunidades | — |
| 4 | Bloqueadas | Quanto trabalho está travado | `count(estado bloqueante)` | derivado §6 | fila bloqueadas | amarelo se > 0 |
| 5 | Sem data | Invisíveis aos motores | `quality.counters.blockedMissingDate` | `campaign-quality` | fila suspeitos | vermelho se alto |
| 6 | Suspeitas (temporais) | Cronologia corrompida | `quality.counters.blockedTemporal` | `campaign-quality` | fila suspeitos | vermelho (`suspect_year`) |
| 7 | Duplicidades prováveis | Intervalos falsos evitados | `quality.counters.probableDuplicateGroups` | `campaign-quality` | fila duplicidades | amarelo se > 0 |
| 8 | Divergências | Motores discordam | `count(divergence runtime)` | Predict×Forecast (§8) | fila exigem revisão | amarelo se > 0 |

Nenhum KPI expõe CV, hazard, desvio ou `waves` — isso é camada analítica.

### 6.3 Filas principais (`RadarOpportunityQueue` e variantes)

| Fila | Critério de entrada | Ordenação | Campos exibidos | Ação | Vazio |
|---|---|---|---|---|---|
| **Oportunidades** | estado `opportunity` (§7) | janela mais próxima; confiança desc | rota, janela, bônus provável, confiança | abrir série | "Nenhuma oportunidade elegível agora." |
| **Mudaram recentemente** | `changed` (§8) ≠ vazio | mais recente | rota, o que mudou, estado | abrir série | "Nenhuma mudança desde o último snapshot." |
| **Exigem revisão** | `review_required` (§7) | severidade | rota, motivo, ação sugerida | abrir série | "Nada aguardando revisão." |
| **Bloqueadas** | estados `*_blocked`/`no_prediction` | nível de bloqueio (D16) | rota, motivo do bloqueio | abrir série | "Nenhuma série bloqueada." |
| **Dados suspeitos** | série com `temporal.severity=critical` | severidade | rota, flag, Δdias | abrir série | "Nenhuma campanha temporalmente suspeita." |
| **Duplicidades prováveis** | `duplicate.status=probable_duplicate` na série | score desc | rota, grupo, relacionadas | abrir série | "Nenhuma duplicidade provável." |
| **Sem histórico suficiente** | `insufficient_history` | ondas asc | rota, ondas, faltam p/ elegível | abrir série | "Todas as séries têm histórico mínimo." |
| **Stale ou incompletas** | frescor ≠ fresh **ou** `datasetComplete=false` | idade desc | escopo, motivo | (informativo) | "Base completa e fresca." |

### 6.4 Tabela / lista de séries (`RadarSeriesTable`)

Campos mínimos (linguagem de produto; **nenhuma métrica técnica bruta**):

| Campo | Origem existente |
|---|---|
| rota | `Prediction.seriesKey` / `Forecast.route` |
| destino | `destino` |
| origem | `origem` (`null` = cluster) |
| estado | estado consolidado (§7) |
| previsão | síntese "chance 30/60/90d" (`probabilities`) ou "cadência ~N dias" (Forecast) |
| janela | `window {start,center,end}` (Predict) ou `windowStart/End` (Forecast) via `formatWindow` |
| probabilidades principais | `p30`, `p90` (as demais só no detalhe) |
| bônus provável | `bonusCandidates[0]` (Predict) ou `typicalPercent` (Forecast) |
| confiança do modelo | `confidence` (`alta/media/baixa/insuficiente`; Forecast `em-formacao` → traduzido) |
| elegibilidade editorial | `editorialEligible` + `editorialBlockReason` |
| quantidade de ondas | `recordsTotal` (Predict) / `samples` (Forecast) |
| campanhas válidas | `quality.counters.totalEligible` (global) e por série (`eligibleRows`) |
| campanhas excluídas | contagem de `quality.excluded` da série |
| última campanha | `lastWindow` (Forecast) / último de `events` (Predict) |
| maior intervalo | `maxIntervalDays` (Forecast) |
| frescor | badge global do artefato |
| warnings | `warnings[]` (contagem; detalhe expande) |
| mudança recente | `changed` (§8) |

CV, desvio, hazard, `medianDays`, `stdevDays`, `intervals` crus → **somente detalhe**.

### 6.5 Filtros

- **programa** (destino), **origem**, **destino**, **rota**, **cluster** (`scope=cluster`),
  **elegibilidade** (`editorialEligible`), **confiança** (modelo), **qualidade**
  (temporal ok/warning/critical), **bloqueio** (nível/estado), **frescor**
  (fresh/stale/…), **duplicidade** (`unique/possible/probable`), **data da última
  campanha** (faixa), **mudança recente** (`changed`), **motor disponível**
  (Predict/Forecast/ambos/nenhum).
- **Defaults:** ordenar por prioridade de trabalho (bloqueios e revisões no topo);
  incluir todos os escopos; ocultar séries `no_prediction` só quando o filtro
  "motor disponível = nenhum" **não** estiver ativo.
- **Combinações úteis:** "elegível + oportunidade + confiança≥media" (fila de pauta);
  "duplicidade=provável + suspeitos" (higiene do operador); "cluster + sem histórico"
  (candidatas a fallback futuro).

---

## 7. Estado consolidado da série (status de produto derivado, sem persistência)

Um **status derivado em runtime** — tradução dos resultados e bloqueios existentes,
**não** uma lógica paralela aos gates. Precedência determinística "o primeiro que
dispara vence" (espelha a hierarquia de 11 níveis do D16 §8.3).

| Prioridade | Estado | Regra (campos existentes) | Mensagem ao usuário | Ação recomendada |
|---|---|---|---|---|
| 1 | `dataset_incomplete` | `datasetComplete === false` | "Base incompleta — números suspensos." | Reprocessar leitura do ledger (operador) |
| 2 | `stale` | `assessForecastArtifact().status ∈ {stale,missing,invalid,incomplete}` | "Resultado desatualizado (há Nh)." | Recalcular/gerar artefato |
| 3 | `data_quality_blocked` | série com `temporal.severity=critical` (`suspect_year`) ou `blockedPlaceholder` que impede formar ondas | "Bloqueada por qualidade de dado." | Revisar campanhas suspeitas |
| 4 | `duplicate_review` | `duplicate.status=probable_duplicate` afetando as ondas da série | "Possível campanha repetida — intervalo em revisão." | Auditar duplicidade |
| 5 | `insufficient_history` | `readiness=insufficient_history` **ou** `samples < minSamples` **ou** `editorialBlockReason=historico_insuficiente_para_publicacao` | "Histórico insuficiente para prever." | Aguardar/backfill |
| 6 | `no_prediction` | ambos os motores sem saída utilizável (`probabilities=null` e `!editorialEligible` sem motivo overridável) | "Sem previsão disponível." | Monitorar |
| 7 | `review_required` | `editorialEligible=false` por motivo overridável (`intervalo_extremo`/`horizonte_excedido`), **ou** `requiresEditorialReview`, **ou** `requiresHumanReview`, **ou** `divergence` runtime | "Exige revisão editorial." | Revisar e decidir |
| 8 | `opportunity` | `editorialEligible` **e** `readiness ∈ {ready, ready_with_warnings}` **e** janela dentro do horizonte **e** `confidence ∈ {alta, media}` | "Oportunidade elegível." | Considerar como pauta |
| 9 | `monitoring` | default: tem previsão e é elegível, mas não é oportunidade iminente | "Em monitoramento." | Acompanhar |

Cada estado carrega `recommendedAction` (informativa no P1) e os **campos existentes
utilizados** (coluna "Regra"). Nenhum novo cálculo de gate é criado — o estado é uma
**etiqueta** sobre `editorialGate`, `readiness`, `campaign-quality`, freshness e
`datasetComplete`.

---

## 8. Detalhe da série

Página ou drawer aberto a partir da tabela/fila. Ordem: **Resumo executivo →
Qualidade → Forecast → Predict → Comparação → Campanhas utilizadas → Campanhas
excluídas → Timeline → O que mudou**. Cada bloco reusa saídas existentes.

### 8.1 Resumo executivo (`RadarSeriesHeader` + `RadarPredictionSummary`)
Responde imediatamente:
- qual é a situação → estado consolidado (§7) + `RadarBlockReason` quando bloqueada;
- qual a previsão → síntese Predict/Forecast;
- qual a janela → `window {start,center,end}` (Predict) / `windowStart–windowEnd` (Forecast);
- chance em 30/60/90 dias → `probabilities.p30/p60/p90`;
- bônus provável → `bonusCandidates[0].value` (+ `bonusOutros`) ou `typicalPercent`;
- confiança → `confidence` (rótulo de negócio);
- elegível? → `editorialEligible`;
- há bloqueio? → `editorialBlockReason` / `blockReason` / bloqueio de qualidade;
- o que mudou? → `changed` (§9).

### 8.2 Qualidade (`RadarQualitySummary` = `QualityPanel`)
Reutiliza **integralmente** `QualityPanel` (props `{ quality: CampaignQualityAssessment }`).
Mostra: dataset completo (cabeçalho), `totalReceived`, `totalEligible`, excluídas por
classe (`blockedMissingDate`, `blockedTemporal`, `blockedDuplicate`, `blockedPlaceholder`),
`possibleDuplicateGroups`/`probableDuplicateGroups`, flags temporais, placeholders,
warnings e o motivo de bloqueio por campanha (`excluded[].reason`). **Não criar outro
motor de qualidade.**

### 8.3 Forecast (`RadarEngineComparison`, aba Forecast)
Mostra, traduzido: **janela** (`windowStart/End` → `formatWindow`), **cadência**
(`cadence`), **ondas** (`samples`), **intervalos** (`intervals`, resumidos), **amostra**
(`samples`), **confiança** (`confidence`), **warnings** (`warnings[]`), **elegibilidade**
(`editorialEligible`/`editorialBlockReason`) e **papel como baseline** (rótulo fixo:
"motor de recorrência / fallback"). Detalhes técnicos (`medianDays`, `meanDays`,
`stdevDays`, `basis`) em seção expandível.

### 8.4 Predict (`RadarEngineComparison`, aba Predict)
Mostra: **P7, P15, P30, P60, P90, P180** (`probabilities`), **janela**
(`windowStart/windowEnd`), **central date** (`centralDate`), **bônus provável**
(`bonusCandidates` + `bonusOutros`), **readiness** (`readiness`), **confiança**
(`confidence`), **warnings** (`warnings[]`), **backtest** (`backtest`:
`observations`, `windowHitRate`, `medianDateErrorDays`, `bonusAccuracy5pp`) e
**explicação** (`explanation`).

### 8.5 Comparação Forecast × Predict (`RadarEngineComparison`)
Bloco comparativo mostrando por motor: **disponibilidade** (`readiness` / `editorialEligible`),
**janela**, **confiança**, **amostra** (`recordsTotal`/`samples`), **warnings** e
**divergência**. Divergência calculada em runtime: |`centralDate` (Predict) −
`center` (Forecast)| e salto de confiança (alta↔baixa) — **rotulada exatamente como o
DECISOES §7 prevê** (`divergence` + revisão obrigatória), mas **sem selecionar resultado
canônico persistido**. O P1 **pode** exibir uma **recomendação derivada em runtime**
(precedência `Predict > Forecast > Não confirmado`, ADR-008), **claramente marcada
"recomendação não persistida — sujeita à reconciliação canônica (fase futura)"**.

### 8.6 Campanhas utilizadas (`RadarCampaignsUsed`)
De `quality.eligibleRows` da série. Exibe: **ID**, **data considerada** (`resolveEventDateCandidate`
/ `windowDate`), **bônus** (`percentual`), **origem**, **destino**, **fonte**, **onda**
(índice na série) e **motivo de inclusão** ("elegível: temporal ok, sem duplicidade").

### 8.7 Campanhas excluídas (`RadarCampaignsExcluded`)
Reutiliza a tabela de `quality.excluded`. Exibe: **ID**, **data candidata**
(`temporal.eventDate`), **data de proveniência** (`temporal.provenanceDate`), **diferença
em dias** (`temporal.dayDifference`), **status temporal** (`temporal.status`), **flags**
(`temporal.flags`), **severidade** (`temporal.severity`), **duplicidade**
(`duplicate.status`), **registros relacionados** (`duplicate.relatedCampaignIds`) e
**motivo da exclusão** (`excluded[].reason`).

### 8.8 Timeline (`RadarTimeline`)
No P1 usa **somente** informação já disponível no estado atual (sem snapshots novos):
- **campanhas** (`events` / `eligibleRows`), **ondas** (colapsadas), **exclusões**
  (`quality.excluded`), **warnings**, **datas suspeitas** (`temporal.flags`),
  **duplicidades** (`duplicateGroups`), **janelas atuais** (`window*`) e **data de
  geração** (`asOf` / artefato).
- **Depende de fase futura (marcar explicitamente na UI):** evolução histórica real
  (linha do tempo de snapshots promovíveis) — exige o snapshot canônico persistido
  (ADR-006). No P1 a timeline é um **retrato do agora**, não uma série temporal.

---

## 9. "O que mudou"

Versão P1 calculada a partir dos **snapshots já existentes** (não cria persistência
nova): compara o `as_of` corrente com o **último `predict_snapshots`** disponível para a
mesma `series_key` (colunas já gravadas: `confidence`, `readiness`, `central_date`,
`window_start/end`; e `forecast_snapshots` para agregados). Classifica:

- nova campanha válida — Δ em `quality.eligibleRows`/`recordsTotal`;
- nova exclusão — Δ em `quality.excluded`;
- nova duplicidade — Δ em `duplicateGroups`;
- mudança da amostra — Δ `recordsTotal`/`samples`;
- mudança do último evento — Δ `lastWindow` / último `events`;
- alteração da janela — Δ `central_date`/`window_*`;
- alteração da confiança — Δ `confidence`;
- mudança da elegibilidade — Δ `editorialEligible`;
- mudança de frescor — Δ status do artefato.

Quando não houver snapshot anterior para comparar, registrar textualmente:
**"Não disponível sem snapshot histórico persistido."** — **não inventar histórico**.

Separação obrigatória na UI:
- **Possível no P1:** diffs sobre `predict_snapshots`/`forecast_snapshots` existentes.
- **Dependente de snapshot estrutural (fase futura):** diff canônico reprodutível por
  `dataset_hash`, "o que mudou" completo dos 13 eventos do D18, e comparação histórica
  real (ADR-006).

---

## 10. Relação com as telas existentes (migração incremental)

| Tela | Capacidade preservada | Destino dentro do Radar | Risco de migração | Critério p/ desativação futura |
|---|---|---|---|---|
| `/admin/forecast` | config do motor, overrides (pin/mute/confidence), radares Daily/Weekly, `DistributionBar`, `WindowTimeline`, `QualityPanel`, `PredictTable` | aba **Configuração** (params/overrides) + **Análise** (Forecast) + tabela na visão principal | overrides são o único ponto de escrita; preservar `forecast_config`/`forecast_overrides` intactos | paridade 1:1 dos overrides e radares comprovada |
| `/admin/predict` | probabilidades P7–P180, `DetailCard`, backtest, `QualityPanel`, snapshotting (`predict_snapshots`) | aba **Análise** (Predict) + detalhe da série | manter `snapshotAllAction`/`predict_snapshots` funcionando | paridade das probabilidades/backtest no detalhe |
| `/admin/observability` (metade de previsão) | tabela "Previsão de janelas", calendário de promoções | **Análise/Operação** (previsão) — calendário e valuations/edições **permanecem** na Observability | é a única leitura direta de `buildForecast` (3ª leitura do ledger) | previsão coberta pelo Radar; calendário/VPM ficam fora |

**Estratégia:**
1. **Etapa inicial:** criar `/admin/radar` **sem remover** nada.
2. **Etapa seguinte:** transformar Forecast/Predict/(previsão da)Observability em **abas
   técnicas ou redirects** do Radar; rotas atuais redirecionam (PDR §2.1-B: "snapshots e
   overrides existentes seguem válidos").
3. **Etapa final:** descontinuar duplicações **somente após comprovar paridade
   funcional** (critério acima). `campanhas`, `digests`, `backfill`, `jobs`, `logs`,
   `noticias`, `shopping-vpm` e o calendário/VPM da Observability **não** entram no Radar
   (DECISOES §15).

---

## 11. Componentes conceituais

Sem escrever código; cada um reusa capacidade existente.

| Componente | Objetivo | Persona | Dados consumidos (reais) | Estados | Ações | Capacidade reutilizada |
|---|---|---|---|---|---|---|
| `RadarHealthSummary` | semáforo de saúde no topo | operador/editor | `datasetComplete`, freshness (`status`,`ageHours`,`generatedAt`), `quality.counters` | ok / alerta / erro | clicar KPI→filtro | `assessForecastArtifact`, `fetchAllRows` |
| `RadarOpportunityQueue` | fila de pauta | editor | séries `opportunity` (`editorialEligible`,`confidence`,`window`) | cheia / vazia | abrir série | `editorialGate`, Predict/Forecast |
| `RadarSeriesTable` | lista unificada | todos | view model por série (§6.4) | linhas / vazio / erro | abrir, filtrar | Predict+Forecast+quality |
| `RadarSeriesHeader` | identidade + estado | todos | rota, estado (§7), `changed` | por estado | abrir detalhe | derivação §7 |
| `RadarPredictionSummary` | síntese em pt-BR | editor/leitor(futuro) | `probabilities`,`window*`,`bonusCandidates`,`confidence` | com/sem número | expandir | `buildPredict`/`buildForecast` |
| `RadarQualitySummary` | qualidade da série | analista/operador | `CampaignQualityAssessment` | com/sem exclusões | inspecionar | **`QualityPanel` (integral)** |
| `RadarEngineComparison` | Forecast × Predict | analista | `Forecast` × `Prediction` + divergência | ambos / um / nenhum | expandir motor | `buildForecast`, `buildPredict` |
| `RadarCampaignsUsed` | auditar usadas | analista | `quality.eligibleRows` | com/sem | inspecionar | `campaign-quality` |
| `RadarCampaignsExcluded` | auditar excluídas | analista/operador | `quality.excluded` | com/sem | inspecionar | `campaign-quality` (tabela do QualityPanel) |
| `RadarWarnings` | reunir avisos | todos | `warnings[]` (Predict+Forecast) + `editorialBlockReason` | com/sem | — | ambos os motores |
| `RadarTimeline` | retrato temporal | analista | `events`,`intervals`,`excluded`,`duplicateGroups`,`window*` | com/sem histórico | — | dados já existentes |
| `RadarFreshnessBadge` | idade/frescor | operador | `assessForecastArtifact()` | fresh/stale/… | — | `forecast-freshness` |
| `RadarBlockReason` | motivo do bloqueio | editor/operador | `blockReason`/`editorialBlockReason`/`temporal` | — | — | motores + quality |

---

## 12. Radar View Model (contrato de leitura P1)

Contrato **conceitual, não técnico**, **derivado em runtime** (nenhum schema
persistido). O alvo persistido é o `§18` da ARQUITETURA (snapshot canônico com
`dataset_hash`/`campaign_ids`/`reconciler_version`) — isso é **fase futura**. No P1 o
view model é montado a cada request a partir de **uma** leitura do ledger.

| Campo conceitual | Fonte atual | Transformação | Consumidor | Disponibilidade | Limitação |
|---|---|---|---|---|---|
| **metadata** (`asOf`, escopo) | `buildPredict().asOf`, `Prediction.scope`, `seriesKey` | direto | todos | ✅ | sem `dataset_hash` (fase futura) |
| **health** (base, frescor, totais) | `fetchAllRows.complete`, `assessForecastArtifact`, `quality.counters` | agregação | operador/editor | ✅ | frescor vem do artefato, não por série |
| **series** (lista) | `result.routes`+`result.clusters` casadas por `seriesKey` | join Predict×Forecast | todos | ✅ | dois enums de confiança a reconciliar em rótulo |
| **forecast** | `Forecast` | rótulos pt-BR | analista | ✅ | — |
| **predict** | `Prediction` | rótulos pt-BR | analista | ✅ | — |
| **quality** | `CampaignQualityAssessment` | direto (QualityPanel) | analista/operador | ✅ | — |
| **editorial eligibility** | `editorialEligible`/`editorialBlockReason` | direto | editor | ✅ | só Forecast tem gate; Predict usa `readiness` |
| **warnings** | `Prediction.warnings` + `Forecast.warnings` | união | todos | ✅ | — |
| **excluded campaigns** | `quality.excluded` | direto | analista/operador | ✅ | — |
| **freshness** | `assessForecastArtifact` | badge | operador | ✅ | por artefato, não por série |
| **dataset completeness** | `fetchAllRows.complete` | booleano | todos | ✅ | 1 leitura, não seis camadas (ADR-007 futuro) |
| **derived product status** | §7 | precedência D16 | todos | ✅ | runtime; não persistido |
| **model selected / reconciliação** | Predict×Forecast | recomendação runtime rotulada | analista | ⚠️ parcial | **não persistida**; canônica é ADR-008 (futuro) |
| **dataset_hash / campaign_ids / expires_at** | — | — | — | ❌ | **exige snapshot canônico persistido (fase futura)** |

Regra de implementação (P1-B): **uma leitura** do ledger alimenta `assessCampaignQuality`,
`buildForecast` e `buildPredict`, eliminando as 2–3 leituras atuais. Séries casadas por
`seriesKey`/rota normalizada (`normProgram`).

---

## 13. Linguagem (tradução técnico → produto)

| Termo técnico | Linguagem de produto | Onde aparece | Onde o termo técnico continua disponível |
|---|---|---|---|
| waves | ondas / ocorrências | tabela, detalhe | detalhe analítico (`samples`, `intervals`) |
| samples | histórico observado | tabela | detalhe |
| CV | regularidade | (oculto na visão principal) | detalhe analítico |
| cadence | ritmo / recorrência | detalhe Forecast | `cadence` no detalhe |
| readiness | prontidão da previsão | detalhe Predict | `readiness` no detalhe/tooltip |
| insufficient history | histórico insuficiente | estado da série | `insufficient_history`/`em-formacao` no detalhe |
| suspect year | data suspeita | exclusões, badge | `suspect_year` no detalhe |
| probable duplicate | possível campanha repetida | exclusões, fila | `probable_duplicate` no detalhe |
| editorial eligible | pronta para publicar | tabela, estado | `editorialEligible` no detalhe |
| stale | desatualizado | cabeçalho, badge | `stale` no tooltip/detalhe |
| dataset incomplete | base incompleta | cabeçalho, KPI | `datasetComplete=false` no detalhe |
| horizon | horizonte | detalhe | `horizonte`/dias no detalhe |
| confidence | confiança | tabela, síntese | as três escalas no detalhe (analista) |
| backtest | validação histórica | detalhe Predict | `backtest` (`windowHitRate`…) no detalhe |

Princípio: o termo técnico **nunca desaparece** — migra para a camada analítica.

---

## 14. Estados vazios e erros

| Estado | Mensagem | Contexto | Ação | Gravidade |
|---|---|---|---|---|
| sem campanhas | "Sem campanhas no ledger." | ledger vazio | — | info |
| sem séries | "Nenhuma série formada ainda." | há campanhas, mas nenhuma elegível | ver excluídas | info |
| dataset incompleto | "Base incompleta — números suspensos." | `datasetComplete=false` | reprocessar leitura | **bloqueante** |
| Forecast indisponível | "Sem recorrência suficiente." | `em-formacao`/`editorialBlockReason` | ver Predict | aviso |
| Predict indisponível | "Sem prontidão do modelo." | `readiness=insufficient_history`/`blockReason` | ver Forecast | aviso |
| ambos indisponíveis | "Não confirmado." | dois motores bloqueados | monitorar | aviso |
| artefato stale | "Resultado desatualizado (há Nh)." | frescor ≠ fresh | recalcular | **bloqueante** |
| erro de carregamento | "Falha ao ler o ledger." | exceção em `fetchAllRows` | recarregar | erro |
| sem histórico suficiente | "Histórico insuficiente para prever." | `samples < minSamples` | aguardar/backfill | aviso |
| série totalmente bloqueada | "Bloqueada: {motivo}." | bloqueio crítico (D16 1–4/9/11) | revisar causa | **bloqueante** |
| nenhum resultado após filtros | "Nenhum resultado após filtros." | filtros restritivos | limpar filtros | info |

---

## 15. Acessibilidade e clareza (princípios)

- Cor **nunca** é o único indicador — todo estado/severidade tem texto (herda o padrão
  do `QualityPanel`: `SEV_TONE`/`DUP_TONE` **sempre** acompanhados de rótulo).
- Todo warning possui texto explicativo.
- Todo número tem contexto (amostra, horizonte, confiança).
- Datas mostram **referência e idade** (`generatedAt` + `ageHours`).
- Percentuais informam o **horizonte** (p30/p60/p90 sempre rotulados com o prazo).
- Bloqueios mostram o **motivo** (`RadarBlockReason`).
- Métricas técnicas (CV, hazard, `stdevDays`) ficam no nível analítico.
- Linguagem **não promete certeza** (regra inviolável: sem promessa; sem número →
  "Não confirmado").
- Alvos ≥44px, foco visível, `prefers-reduced-motion` (padrão do projeto).

---

## 16. Backlog executável (ondas P1-A … P1-D)

Cada item: título · problema · persona · comportamento esperado · capacidades
reutilizadas · dependências · arquivos/áreas prováveis · risco · critério de aceite ·
testes · fora de escopo.

### Onda P1-A — Fundação da visão

> ✅ **Concluída** (P1-001…P1-005). Implementação: `lib/radar-view-model.ts`
> (composição pura), `lib/admin-radar.ts` (leitura única do ledger),
> `components/admin/radar.tsx` (saúde, KPIs, filtros, tabela),
> `app/admin/(panel)/radar/page.tsx` (rota), `components/admin/Sidebar.tsx` (nav).
> Testes: `tests/radar-view-model.test.mjs` + `tests/radar-view-model-status.test.mjs`.
> Documentação: `docs/IMPLEMENTACAO-P1A-RADAR.md`. Telas atuais preservadas; sem
> persistência; test/lint/typecheck/build verdes.

**P1-001 — Rota `/admin/radar` e navegação.** ✅ concluído
Problema: previsão dispersa em 3 telas. Persona: todas. Comportamento: nova rota
renderiza o shell (cabeçalho + KPIs + filas + tabela) sem remover telas atuais.
Reutiliza: layout admin (`app/admin/(panel)/layout.tsx`, `Sidebar`). Dependências:
nenhuma. Áreas: `app/admin/(panel)/radar/page.tsx` (nova), `Sidebar`. Risco: baixo.
Aceite: `/admin/radar` acessível, no menu, protegida pelo cookie admin. Testes: rota
responde 200 autenticada / redireciona sem cookie. Fora de escopo: remover telas.

**P1-002 — Radar View Model em runtime (uma leitura do ledger).** ✅ concluído
Problema: 2–3 leituras independentes e resultados concorrentes. Persona: todas.
Comportamento: um loader único lê o ledger uma vez (`fetchAllRows`), roda
`assessCampaignQuality`, `buildForecast`, `buildPredict`, casa por `seriesKey` e devolve
o view model (§12). Reutiliza: `campaign-quality`, `forecast.ts`, `predict-engine.ts`,
`admin-db.fetchAllRows`. Dependências: P1-001. Áreas: `lib/admin-radar.ts` (novo loader,
**leitura**). Risco: médio (casar enums de confiança e `seriesKey`). Aceite: números
por série batem com `/admin/forecast` e `/admin/predict`. Testes: paridade de séries e
campos vs loaders atuais. Fora de escopo: reconciliação canônica, persistência.

**P1-003 — `RadarHealthSummary` (semáforo de saúde).** ✅ concluído
Problema: números aparecem sem contexto de confiabilidade. Persona: operador/editor.
Comportamento: cabeçalho com frescor, base completa/parcial, totais, alertas — **acima**
dos KPIs. Reutiliza: `assessForecastArtifact`, `fetchAllRows.complete`, `quality.counters`.
Dependências: P1-002. Áreas: componente + `radar/page.tsx`. Risco: baixo. Aceite: com
`datasetComplete=false` ou frescor≠fresh, o alerta precede qualquer número. Testes:
render dos três cenários (fresh/stale/incompleto). Fora de escopo: seis camadas de
completude (ADR-007).

**P1-004 — `RadarSeriesTable` + KPIs.** ✅ concluído
Problema: sem lista única em linguagem de produto. Persona: todas. Comportamento:
tabela com os campos §6.4 e ≤8 KPIs §6.2; métricas técnicas ausentes da visão
principal. Reutiliza: view model P1-002. Dependências: P1-002/003. Áreas: componentes +
página. Risco: baixo. Aceite: toda série listada com estado, previsão, janela,
elegibilidade; CV/desvio ausentes. Testes: colunas presentes/ausentes. Fora de escopo:
detalhe da série.

**P1-005 — Filtros e busca.** ✅ concluído
Problema: não dá para chegar a uma série. Persona: todas. Comportamento: filtros §6.5 +
busca por rota/programa, com defaults. Reutiliza: view model. Dependências: P1-004.
Áreas: página. Risco: baixo. Aceite: combinações §6.5 funcionam; "nenhum resultado
após filtros" com limpar. Testes: filtro por estado/confiança/duplicidade. Fora de
escopo: filtros que exijam dado persistido novo.

### Onda P1-B — Detalhe da série

**P1-006 — `RadarSeriesHeader` + `RadarPredictionSummary` (resumo executivo).**
Problema: sem síntese "o que é/qual a chance/qual bloqueio". Persona: editor.
Comportamento: topo do detalhe responde §8.1. Reutiliza: `probabilities`, `window*`,
`bonusCandidates`, `confidence`, estado §7. Dependências: P1-002. Áreas: componentes +
detalhe. Risco: baixo. Aceite: síntese e motivo de bloqueio antes de qualquer número.
Testes: série ready / bloqueada. Fora de escopo: Predict ao leitor.

**P1-007 — Aba Forecast do detalhe (`RadarEngineComparison`).**
Problema: cadência e gate escondidos. Persona: analista. Comportamento: §8.3.
Reutiliza: `Forecast` + `formatWindow`/`basis`. Dependências: P1-006. Áreas: componente.
Risco: baixo. Aceite: janela/cadência/ondas/elegibilidade visíveis; técnicos em
expandir. Testes: render Forecast elegível/bloqueado. Fora de escopo: alterar Forecast.

**P1-008 — Aba Predict do detalhe.**
Problema: P7–P180/backtest só numa DetailCard. Persona: analista. Comportamento: §8.4.
Reutiliza: `Prediction` (probabilities, backtest, explanation). Dependências: P1-006.
Áreas: componente. Risco: baixo. Aceite: P7–P180, janela, central, bônus, backtest,
explicação. Testes: série ready/insufficient. Fora de escopo: alterar Predict.

**P1-009 — `RadarQualitySummary` (reuso do `QualityPanel`).**
Problema: qualidade não aparece no fluxo da série. Persona: analista/operador.
Comportamento: §8.2 embutindo `QualityPanel`. Reutiliza: **`QualityPanel` integral**.
Dependências: P1-006. Áreas: detalhe. Risco: baixo. Aceite: contadores e excluídas
idênticos às telas atuais. Testes: paridade com `/admin/predict`. Fora de escopo: novo
motor de qualidade.

**P1-010 — `RadarCampaignsUsed` e `RadarCampaignsExcluded`.**
Problema: usadas × excluídas não auditáveis juntas. Persona: analista/operador.
Comportamento: §8.6/§8.7. Reutiliza: `quality.eligibleRows`, `quality.excluded`.
Dependências: P1-009. Áreas: componentes. Risco: baixo. Aceite: todos os campos §8.6/§8.7
presentes. Testes: série com exclusões temporais e duplicidade. Fora de escopo: merge
persistido.

**P1-011 — `RadarEngineComparison` (comparação + divergência runtime).**
Problema: motores parecem concorrentes. Persona: analista. Comportamento: §8.5,
divergência rotulada + recomendação runtime **marcada "não persistida"**. Reutiliza:
Predict×Forecast. Dependências: P1-007/008. Áreas: componente. Risco: médio (não induzir
canônico). Aceite: mostra ambos, divergência e recomendação claramente não persistida.
Testes: divergência > limiar exibe flag. Fora de escopo: reconciliação canônica (ADR-008).

### Onda P1-C — Consolidação operacional

**P1-012 — Filas de trabalho (`RadarOpportunityQueue` e variantes).**
Problema: sem priorização. Persona: editor/operador. Comportamento: §6.3.
Reutiliza: estado §7. Dependências: P1-004. Áreas: componentes. Risco: baixo. Aceite:
oito filas com critério/ordenação/vazio §6.3. Testes: entrada correta por fila. Fora de
escopo: ações persistidas.

**P1-013 — `RadarWarnings` e `RadarBlockReason`.**
Problema: warnings/bloqueios dispersos. Persona: todas. Comportamento: reunir
`warnings[]` (Predict+Forecast) e motivos de bloqueio. Reutiliza: motores + quality.
Dependências: P1-006. Áreas: componentes. Risco: baixo. Aceite: todo warning com texto;
todo bloqueio com motivo. Testes: série com múltiplos warnings. Fora de escopo: —.

**P1-014 — Estados vazios e de erro.**
Problema: telas quebram/enganam sem dado. Persona: todas. Comportamento: §14.
Reutiliza: view model. Dependências: P1-002. Áreas: página/componentes. Risco: baixo.
Aceite: 11 estados §14 cobertos. Testes: simular ledger vazio, stale, incompleto, erro.
Fora de escopo: —.

**P1-015 — `RadarFreshnessBadge` e observabilidade de saúde.**
Problema: frescor não é visível. Persona: operador. Comportamento: badge de idade/frescor
no cabeçalho e por série quando aplicável. Reutiliza: `assessForecastArtifact`.
Dependências: P1-003. Áreas: componente. Risco: baixo. Aceite: idade e status sempre
visíveis. Testes: fresh/stale/missing. Fora de escopo: TTLs persistidos (D17).

**P1-016 — Compatibilidade e navegação com as telas atuais.**
Problema: risco de perder capacidade na migração. Persona: todas. Comportamento: `/admin/radar`
convive com `/admin/forecast|predict|observability`; links cruzados; nenhuma rota
removida. Reutiliza: telas atuais. Dependências: P1-001. Áreas: `Sidebar`, páginas.
Risco: médio (não quebrar overrides/snapshots). Aceite: telas antigas 100% funcionais;
overrides e snapshots intactos. Testes: overrides e `snapshotAllAction` seguem operando.
Fora de escopo: transformar em abas/redirects (fase seguinte da migração §10).

**P1-017 — "O que mudou" (diff de snapshots existentes).**
Problema: editor não vê o que mudou. Persona: editor. Comportamento: §9, diff sobre
`predict_snapshots`/`forecast_snapshots` existentes; sem histórico → texto honesto.
Reutiliza: snapshots atuais. Dependências: P1-006. Áreas: `lib/admin-radar.ts`
(**leitura** de snapshots). Risco: médio (não inventar histórico). Aceite: diffs quando
há snapshot; "Não disponível sem snapshot histórico persistido" quando não há. Testes:
série com e sem snapshot anterior. Fora de escopo: os 13 eventos do D18, snapshot canônico.

**P1-018 — `RadarTimeline` (retrato do agora).**
Problema: sem visão temporal da série. Persona: analista. Comportamento: §8.8, só dados
atuais; marca o que depende de snapshot futuro. Reutiliza: `events`, `intervals`,
`quality.excluded`, `duplicateGroups`. Dependências: P1-010. Áreas: componente. Risco:
baixo. Aceite: timeline do estado atual; nota sobre evolução histórica futura. Testes:
série com ondas e exclusões. Fora de escopo: série temporal de snapshots.

### Onda P1-D — Validação

**P1-019 — Testes de paridade de informação.**
Problema: risco de o Radar divergir das telas atuais. Persona: analista. Comportamento:
testar que o view model reproduz os números de `/admin/forecast` e `/admin/predict`.
Reutiliza: loaders atuais como referência. Dependências: P1-002..011. Áreas:
`__tests__`/scripts de teste. Risco: baixo. Aceite: paridade comprovada por série.
Testes: este item **é** o teste. Fora de escopo: —.

**P1-020 — Revisão UX (hierarquia e linguagem).**
Problema: jargão e ordem errada afundam a decisão. Persona: todas. Comportamento:
conferir §13 (linguagem) e §15 (clareza): alertas acima dos números, técnicos fora da
visão principal. Dependências: P1-004..013. Áreas: revisão. Risco: baixo. Aceite:
checklist §13/§15 cumprido. Testes: revisão manual documentada. Fora de escopo: —.

**P1-021 — Documentação de handoff técnico.**
Problema: implementação futura precisa de contrato sem ambiguidade. Persona: dev.
Comportamento: consolidar o `Radar View Model` (§12) e o mapeamento fonte→campo como
referência do prompt técnico posterior. Dependências: todas. Áreas: `docs/`. Risco:
baixo. Aceite: cada campo do view model tem fonte existente citada. Testes: revisão.
Fora de escopo: implementar.

---

## 17. Critérios de aceite globais

O P1 só está concluído quando:

1. Existe uma **única entrada `/admin/radar`**.
2. Forecast e Predict aparecem como **motores internos**, nunca respostas concorrentes.
3. **Nenhum cálculo existente é duplicado** (uma leitura do ledger; motores reusados).
4. **Qualidade temporal** aparece na experiência (`QualityPanel`/`campaign-quality`).
5. **Duplicidades** aparecem na experiência (`duplicateGroups`/`duplicate.status`).
6. **Motivos de exclusão** estão visíveis (`quality.excluded[].reason`).
7. **Dataset incompleto** é visível **e bloqueante** (`datasetComplete=false`).
8. **Frescor** é visível (`assessForecastArtifact`).
9. **Warnings** são preservados (Predict+Forecast).
10. **Campanhas utilizadas e excluídas** são auditáveis.
11. O **detalhe da série** reúne Forecast, Predict e qualidade.
12. As **telas antigas continuam funcionais**.
13. **Não existe nova persistência.**
14. **Não existe nova fonte de verdade.**
15. **Nenhum motor é alterado.**
16. **Testes existentes permanecem verdes.**
17. **Nenhum conteúdo é publicado.**

---

## 18. Dependências futuras (não resolvíveis no P1)

| Dependência | Motivo | Estrutura necessária | Fase | Alternativa temporária do P1 |
|---|---|---|---|---|
| Resultado canônico persistido | precisa de uma verdade única gravável | tabela + `dataset_hash`/`campaign_ids` | P4 (ADR-006/008) | recomendação runtime rotulada não persistida (§8.5) |
| Histórico de decisões | auditar aprovações | entidade de decisão | P5 (ADR-006) | — |
| Aprovação editorial persistida | "publicado é do uso" | `editorial_approval` + `prediction_snapshot_usages` | P5 (ADR-006) | estado de série exibido, não gravado |
| Snapshot promovível | reprodutibilidade + expiração | `prediction_snapshots` + estados | P4 (ADR-006) | freshness gate runtime (§6.1) |
| Comparação histórica real | "o que mudou" completo | snapshots canônicos versionados | P4 (ADR-006) | diff dos snapshots existentes (§9) |
| `prediction_outcomes` / calibração | medir acerto real | entidade de outcome | P5 (ADR-006) | backtest existente (`Prediction.backtest`) |
| Editorial Score definitivo | priorização persistida | pesos aprovados | P2+ (D9) | ordenação por estado/janela/confiança (§6.3) |
| Predict → Digest | leitor via reconciliador | snapshot aprovado | P5 (ADR-001/008) | Radar é admin-only no P1 |
| Unificação definitiva das telas | remover duplicações | paridade comprovada | pós-P1 (§10) | convivência + links cruzados (P1-016) |
| Correção persistida dos dados | dado corrompido a montante | novo modelo de vigência/identidade | P3 (ADR-002/009) | exibir suspeitos/excluídos sem corrigir |
| Reconciliação canônica (Predict>Forecast gravada) | precedência auditável | `reconciler_version` no snapshot | P4 (ADR-008) | divergência + recomendação runtime (§8.5) |

---

## 19. Recomendação de implementação

1. **Comece pela leitura única** (P1-002): um `lib/admin-radar.ts` que lê o ledger uma
   vez e devolve o view model. É a peça que elimina a divergência e destrava todo o resto.
2. **Reuse, não recrie:** `QualityPanel`, `campaign-quality`, `editorialGate`,
   `assessForecastArtifact`, `fetchAllRows`, `DistributionBar`/`WindowTimeline`. Qualquer
   "novo motor" é sinal de erro de escopo.
3. **Alertas acima dos números** em toda tela (semáforo antes de KPI, motivo antes de
   previsão).
4. **Não persista nada.** Onde o produto pedir estado gravado (aprovação, snapshot,
   outcome), exiba a informação derivada e marque explicitamente "fase futura".
5. **Reconcilie enums em rótulo**, não em dado: `insuficiente`(Predict) e
   `em-formacao`(Forecast) viram um único rótulo de produto ("histórico insuficiente")
   sem tocar os motores.
6. **Preserve as telas atuais** até a paridade (P1-019) — só então migrar para abas.
7. **Feche o P1 com o handoff** (P1-021): o `Radar View Model` com fonte por campo é o
   contrato do prompt técnico seguinte.
