# Implementação — Fase P1-D (Validação, paridade e fechamento do P1)

> Registro do que foi **efetivamente implementado/validado** na onda **P1-D**
> (`docs/BACKLOG-P1-RADAR-UNIFICADO.md` §16 P1-019…P1-021): paridade funcional
> Radar × telas técnicas, revisão de UX, consolidação de vocabulário de badges e
> de estados vazios, acessibilidade/contrato de UI, e o **handoff** do P1.
>
> **Fase de validação e correção incremental.** Reusa integralmente
> `RadarViewModel`, `loadRadar`, `radar-filters`, `radar-detail`, `radar-operations`,
> `QualityPanel`, Forecast, Predict, Observability, Sidebar. **Nenhum motor,
> View Model, leitura do ledger, sistema de qualidade/filtros/divergência ou fonte
> de verdade novos.** Sem persistência, migration, banco ou ADRs.

## 1. Matriz de paridade (§3)

| Capacidade | Radar | Tela técnica | Paridade | Gap | Ação |
|---|---|---|---|---|---|
| Forecast (janela/confiança/amostra/cadência/bônus típico/maior intervalo/elegibilidade/warnings/bloqueio) | detalhe (§8.3) + tabela | `/admin/forecast` | **total** — `series.forecast` é o objeto do `buildForecast` | — | teste `radar-parity` (caso 1) |
| Predict (readiness/confiança/probabilidades/janela/central/bônus/backtest/explicação/bloqueio) | detalhe (§8.4) | `/admin/predict` | **total** — `series.predict` é o objeto do `buildPredict` | — | teste `radar-parity` (caso 2) |
| Qualidade (elegíveis/excluídas/flags/duplicidades/placeholders/severidade/motivos) | `QualityPanel` + resumo | `/admin/predict` (`QualityPanel`) | **total** — mesmo `assessCampaignQuality` | — | teste `radar-parity` (caso 3) |
| Contadores | saúde + KPIs | telas técnicas | **total** | — | teste `radar-parity` (caso 5) |
| Bloqueios | `productStatus` + motivos | `editorialBlockReason`/`blockReason` | **de significado** — status traduz o bloqueio | Radar não repete a densidade técnica (por design) | teste `radar-parity` (caso 4) |
| Frescor / dataset completo | cabeçalho + alertas | banners das telas | **total** (`assessForecastArtifact`/`fetchAllRows`) | — | testes P1-A/P1-C |
| Contenção 943 (`suspect_year`) | **exclui** e mostra `data_quality_blocked` | `/admin/forecast` **não** exclui (só 7 colunas) | Radar é **mais** correto (lê proveniência) | gap das telas atuais, não do Radar | documentado em IMPLEMENTACAO-P1A §4 |
| Links técnicos / navegação | detalhe + Sidebar | rotas atuais preservadas | **total** | — | Sidebar (Radar + Análise técnica) |

A paridade é de **informação e significado**, não de layout: o Radar não replica
toda a densidade técnica; leva os detalhes analíticos ao detalhe da série e às
telas técnicas (preservadas).

## 2. UX, vocabulário e estados vazios (§6–§10)

**Vocabulário único de badges (`components/admin/radar-vocab.ts`, novo):** os
mapas de tom que estavam **duplicados** em três componentes viram uma fonte única
— `PRODUCT_STATUS_TONE`, `DIVERGENCE_TONE`, `ALERT_SEVERITY_TONE`,
`TEMPORAL_SEVERITY_TONE`, `freshnessTone`. Garante que um badge **significa a mesma
coisa em toda tela** (visão geral, detalhe, operação). `radar.tsx`,
`radar-detail.tsx` e `radar-operations.tsx` passam a importar do módulo; o badge de
estado da fila (antes sempre cinza) agora usa o tom correto. Cor **nunca** é o
único indicador — todo badge carrega texto.

**Catálogo de estados vazios/erro (`lib/radar-empty.ts`, novo):** 18 estados
(sem campanhas, sem séries, sem oportunidades/revisões/bloqueios, sem previsão,
Forecast/Predict/ambos indisponíveis, sem backtest/bônus/duplicidade/exclusões,
dataset incompleto, stale, erro de carga, série inexistente, sem resultado após
filtros), cada um com **título, descrição, impacto, ação e link de diagnóstico**.
As páginas do Radar (visão geral "sem campanhas" e detalhe "série não encontrada")
passam a consumir o catálogo.

**Limpeza:** removido código morto (`age`) no `RadarHealthSummary`.

## 3. Acessibilidade e contrato de UI (§11)

O Admin já provê landmarks (`header`/`main#conteudo`/`nav`/`footer`), foco visível
e alvos ≥44px. O Radar herda isso e adiciona: abas com `aria-current`; tabelas com
`<Th>` de cabeçalho; camadas técnicas em `<details>` nativo (teclado/leitor);
badges **sempre com texto** (validado por teste); contagem de resultados dos
filtros; timestamp/idade do artefato no cabeçalho. Sem infraestrutura de teste de
DOM: a acessibilidade testável foi coberta no **nível do contrato** (vocabulário,
rótulos não vazios, catálogo de estados completo).

## 4. Arquivos

**Novos:** `components/admin/radar-vocab.ts`, `lib/radar-empty.ts`,
`tests/radar-parity.test.mjs`, `tests/radar-ui-contract.test.mjs`, este doc e
`docs/HANDOFF-P1-RADAR.md`.

**Alterados (compatível):** `components/admin/radar.tsx`,
`components/admin/radar-detail.tsx`, `components/admin/radar-operations.tsx`
(importam o vocabulário único; tom correto no badge da fila; remoção de código
morto); `app/admin/(panel)/radar/page.tsx` e
`app/admin/(panel)/radar/[seriesKey]/page.tsx` (estados vazios do catálogo).

Nenhuma alteração em Forecast, Predict, `campaign-quality`, `radar-view-model`
(contrato), `radar-filters`, `radar-operations` (lógica), gates, frescor,
`content/forecast.json`, telas técnicas ou ADRs.

## 5. Testes (§16)

- **`tests/radar-parity.test.mjs`** (10): paridade Forecast/Predict (objeto por
  série idêntico ao motor), qualidade e contadores, bloqueios → status, linha ×
  detalhe (mesma referência), status × fila, filtros × campos, seriesKey
  codificada reversível, **composição determinística** (sem 2ª leitura / sem
  cálculo duplicado), regressão P1-A/B/C.
- **`tests/radar-ui-contract.test.mjs`** (5): vocabulário de badges com tom
  válido; severidade consistente entre escalas; frescor; **badges sempre com
  texto**; catálogo de estados vazios completo.

Suíte total: **216/216**. `npm run lint`, `npm run typecheck`, `npm run build`
verdes. `/admin/radar` e `/admin/radar/[seriesKey]` compilam como rotas dinâmicas;
`/admin/forecast`, `/admin/predict`, `/admin/observability` intactas.

## 6. Estado do P1

O P1 (A→D) está **pronto para revisão humana final**: uma entrada `/admin/radar`
com visão geral, oportunidades, revisões, bloqueios e operação; detalhe completo da
série; paridade comprovada com as telas técnicas; vocabulário e estados vazios
consolidados; zero persistência nova, zero segunda fonte de verdade, motores
intactos. O que segue é **estrutural** (aprovação/snapshot/Editorial Score/
outcomes/identidade-dedup persistidas/Daily-Weekly-Pro) — ver `docs/HANDOFF-P1-RADAR.md`
e os ADRs `proposed`.

## 7. Rollback

Reverter o commit remove o vocabulário único, o catálogo de estados e os dois
testes, e restaura os mapas de tom locais e as mensagens inline; nada mais é
tocado. P1-A/B/C e as telas atuais permanecem intactos.
