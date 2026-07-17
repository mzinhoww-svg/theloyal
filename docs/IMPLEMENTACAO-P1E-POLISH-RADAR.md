# Implementação — P1-E (polish do P1 do Radar)

> Onda final de polish do P1, fechando os achados **M1, M2, M3, B1, B2, B3** da
> revisão humana (`docs/REVISAO-HUMANA-P1-RADAR.md`). **A1 permanece dívida pós-P1
> documentada** — nenhuma alteração em loaders/motores/qualidade/proveniência do
> Forecast legado. Sem nova funcionalidade de produto, sem banco/migration/ADRs,
> sem segunda leitura do ledger, sem cálculo novo.

## 1. Achados corrigidos

| Achado | Correção | Onde |
|---|---|---|
| **M1** view inválido caía em geral **em silêncio** | `resolveRadarView(raw)` (puro) normaliza para `geral` e sinaliza `invalid`; a página exibe aviso discreto ("Aba não encontrada — exibindo a Visão geral"); links válidos intactos | `lib/radar-operations.ts` (`resolveRadarView`, `RADAR_VIEWS`), `app/admin/(panel)/radar/page.tsx` |
| **M2** link do alerta de placeholders não isolava o dado | novo `cause=placeholder` no sistema de filtros (reusa `applyRadarFilters`); o alerta aponta `/admin/radar?cause=placeholder` | `lib/radar-filters.ts` (`seriesCauses`/`CAUSE_ORDER`/`CAUSE_LABEL`), `lib/radar-operations.ts` (link do alerta) |
| **M3** seções sem heading | headings semânticos reais (um `h1` da página + `h2` por seção): Resumo operacional (visível), Saúde/Indicadores/Filtros (`sr-only`), Séries (visível); Alertas já era `h2` | `lib/radar-headings.ts` (outline), `components/admin/radar.tsx`, `radar-operations.tsx` |
| **B1** `load_error` não acionável | `error.tsx` (boundary) do segmento `/admin/radar` (cobre a lista e o detalhe): qualquer falha real de `loadRadar` mostra estado padronizado — título/impacto/ação/diagnóstico, **sem stack**, com "Tentar novamente"; não mascara como "sem dados" | `app/admin/(panel)/radar/error.tsx`, `lib/radar-empty.ts` (`resolveRadarLoadError`, `load_error` com `diagnosticHref`) |
| **B2** "nenhum resultado" inline | tabela consome `RADAR_EMPTY.no_filter_results`; contexto (contagem `X de N` + "0") já vinha da página | `components/admin/radar.tsx` |
| **B3** resumo operacional duplicado | `RadarOperationalSummary` ganha `compact`: **visão geral** = risco + contagens + link "Ver operação"; **operação** = versão completa (ação prioritária + frase) | `components/admin/radar-operations.tsx`, `page.tsx` |

## 2. Consistência mantida

Sem tocar em: Forecast, Predict, qualidade, divergência, `RadarViewModel` (contrato),
leitura única do ledger, filtros existentes (só **acrescido** o `placeholder`),
detalhe da série, filas, conteúdo editorial, banco, migrations, ADRs. **A1 não foi
corrigido.** Vocabulário de badges e catálogo de estados (P1-D) reutilizados.

## 3. Testes (`tests/radar-polish.test.mjs`, 9 casos)

M1 (`resolveRadarView` válido/inválido/ausente/vazio; filtros independentes); M2
(`cause=placeholder` isola séries; faceta/rótulo; link do alerta); M3 (outline: um
h1, resto h2, textos únicos, todas as seções); B1 (`resolveRadarLoadError`
padronizado, com diagnóstico, sem stack, não mascara vazio); B2 (catálogo
`no_filter_results`); B3 (resumo com núcleo compacto + extras completos);
regressão de filtros e filas.

Validação: `npm test` **225/225**, `typecheck`, `lint`, `build` — verdes.
`/admin/radar`, `/admin/radar/[seriesKey]` e o boundary de erro compilam;
forecast/predict/observability intactas.

## 4. Rollback

Reverter o commit remove `resolveRadarView`, o `cause=placeholder`, os headings,
o `error.tsx`, o `compact` e o teste; restaura o comportamento anterior do P1-D.
Nada mais é tocado.
