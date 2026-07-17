# Decisões humanas H1–H12 — Fase estrutural do Radar

Registro formal e versionado das 12 decisões humanas da fase estrutural do Radar,
aprovadas em sessão de coordenação. Documento de coordenação: **não** altera código,
banco, migrations, ADRs ou SQL, e **não** autoriza implementação.

## Metadados da sessão

- **Data:** 2026-07-15
- **Aprovador humano:** `mzinhoww-svg`
- **Escopo aprovado:** todas as 12 decisões (H1–H12) conforme a recomendação (opção A) de cada uma.
- **Base canônica de integração:** `claude/loyalty-landing-page-v1-7vbjq7` (`4a8f013`).
- **Fonte das decisões:** `docs/PLANO-FASE-ESTRUTURAL-RADAR.md` §7 (publicado pelo PR #65).
- **Contexto:** A1 integrado pelo PR #64; plano estrutural publicado pelo PR #65.

## Regra de escopo

Aprovar uma decisão H é **insumo** para promover o ADR correspondente de `proposed`
para `accepted` — **não** promove ADR automaticamente. A promoção de ADRs (gate 3) é
um passo humano separado. Enquanto os gates 3, 4 e 5 não fecharem, as ondas S1–S7
**não iniciam**.

## Decisões aprovadas (opção A)

| # | Decisão | Resolução aprovada | Reversibilidade | Impacto | ADR ligado |
|---|---|---|---|---|---|
| H1 | Composição da chave `campaign_identity` | `origem·destino·tipo·mecânica·segmento` + janela **validada** (ADR-010), nunca `vigencia_fim` cru | Média (recomputável; `vigencia_raw` preservado) | Alto | 009/010/002 |
| H2 | Pesos e limiares de `possible`/`probable` | conjunto ponderado inicial + limiar calibrável; `probable` bloqueia intervalo | Alta (config) | Alto | 009 |
| H3 | Precedência de campos no merge + unmerge | `data_evento` do `valid` sobre `suspect`; bônus por confiança de fonte; texto/URL acumulados; nunca média cega; unmerge sempre disponível | Alta (unmerge reverte) | Alto | 009 |
| H4 | Limiares de validação temporal | `suspect_year` 548 d · `event_far_before` 365 d · `suspect_month/day` k·MAD | Alta (config) | Alto | 010 |
| H5 | TTL de snapshot/aprovação + re-expiração | cálculo 24 h; aprovação Daily 24 h / Weekly 7 d; re-expira por nova onda/exclusão/troca de motor/stale | Alta (parâmetros) | Médio | 006 |
| H6 | Granularidade de `presentation_version` e escopo de `usages` | por (produto, edição), versionando apresentação | Alta | Médio | 006 |
| H7 | Gates de amostra definitivos | Forecast pub. ≥5 · Predict pub. ≥6 · alta confiança ≥10 | Alta (config) | Médio | 004 |
| H8 | `k`/limiar de shrinkage rota↔cluster (pooling) | `k=4` provisório; `w=n_rota/(n_rota+k)`; fallback sempre rotulado | Alta | Médio | 003 |
| H9 | `d_max` definitivo + persistir `reconciler_version` | faixas 14/30/60 sobre o centro; janela sobreposta atenua; persistir versão do reconciliador | Alta | Alto | 008 |
| H10 | Existência e pesos versionados do Editorial Score | interno, versionado, nunca ao leitor, nunca vence bloqueio | Alta | Médio | (D9) |
| H11 | Janela de resolução de outcome | esperar até `expires_at`+margem; só onda `valid`+deduplicada resolve | Média (recomputável) | Alto | 006/§27d.9 |
| H12 | Modelo RLS/permissões e auditoria das novas tabelas | service_role-only; auditoria append-only; papéis editor/operador na app, não no banco | Média | Alto | (herda C0) |

## Estado dos gates após esta sessão

| # | Gate | Situação |
|---|---|---|
| 1 | PR #65 revisado e aprovado | fechado (mergeado, `4a8f013`) |
| 2 | H1–H12 decididas | **fechado** (12/12 aprovadas nesta sessão) |
| 3 | ADRs 001–010 promovidos (010/009 primeiro) | aberto — nenhum promovido; H aprovadas são o insumo |
| 4 | Migrations conceituais aprovadas para detalhamento | aberto — seguem conceituais, sem SQL |
| 5 | F1–F5 avaliados (F4/F5 explícitos) | aberto — F4 `blocked`, F5 `not_confirmed` (rodada 2) |
| 6 | A1 integrado | fechado |
| 7 | Sem edição concorrente em arquivos de S1–S7 | fechado (reavaliar no início da implementação) |

## Situação

- **H1–H12:** aprovadas e versionadas.
- **ADRs 001–010:** ainda `proposed` — nenhum promovido.
- **Migrations:** conceituais, ainda não aprovadas, sem SQL.
- **F4:** `blocked` (dados vivos). **F5:** `not_confirmed`.
- **Structural Implementation:** permanece `blocked` até os gates 3, 4 e 5 fecharem.
