# Migrations — linhagem e re-versionamento (v2)

> Fecha o item "re-versionar as migrations" do portão M1. Fonte de verdade da ordem de aplicação é o registro do Supabase (`supabase_migrations.schema_migrations`); este manifesto mapeia os arquivos locais para as versões aplicadas e congela a fronteira baseline → v2.

Projeto: `the-loyalty` (`qjqnqcsdnpvvmyzkavoq`, sa-east-1, pg 17).

## Fronteira baseline → v2

O banco foi construído por **21 migrations v1** antes do M1. Elas **não são re-executadas nem editadas** — estão congeladas e capturadas integralmente em [`schema-atual.sql`](./schema-atual.sql) (32 tabelas, RPCs, views, crons, RLS). É o baseline replayável do v2. A partir daí, o v2 avança **só de forma aditiva** com as migrations `001+`.

### Baseline v1 (congelado — 21 migrations, capturado em `schema-atual.sql`)

| # | versão aplicada | nome |
|--:|---|---|
| 01 | 20260711043932 | the_loyalty_cockpit_schema |
| 02 | 20260711044845 | cockpit_grants_policies |
| 03 | 20260714105540 | retail_vpm_radar |
| 04 | 20260714110616 | admin_forecast_predict_area |
| 05 | 20260714115201 | retail_vpm_more_categories |
| 06 | 20260714181359 | predict_engine_mvp |
| 07 | 20260714182318 | shopping_vpm_rich_model |
| 08 | 20260714184848 | shopping_recompute_fn |
| 09 | 20260714185447 | speed_up_backfill_and_extract_crons |
| 10 | 20260714190235 | speed_up_backfill_daily_coverage |
| 11 | 20260714192106 | shopping_recompute_prefer_valid |
| 12 | 20260714192108 | crank_backfill_process_and_extract |
| 13 | 20260714192714 | retail_vpm_categories_full |
| 14 | 20260714194223 | shopping_vpm_schema_deploy |
| 15 | 20260714201847 | bump_extract_cron_to_5min |
| 16 | 20260714211342 | admin_metrics_news |
| 17 | 20260715012855 | security_hardening |
| 18 | 20260715014555 | shopping_fk_indexes |
| 19 | 20260715015258 | 0005_digest_control |
| 20 | 20260715230208 | campaign_date_reviews |
| 21 | 20260716000041 | campaigns_provenance_shadow |

> São as **~20 migrations** referidas no portão. Congeladas — o v2 não as toca; herda o schema por `schema-atual.sql`.

### Forward v2 (aditivas — sequência canônica)

| arquivo local | versão aplicada | idempotente | papel |
|---|---|:--:|---|
| [`migrations/001_canonical_identity.sql`](./migrations/001_canonical_identity.sql) | 20260716175346 · `v2_001_canonical_identity` | sim (`if not exists` / colunas aditivas) | identidade canônica: `pares_transferencia`, `programa_aliases`, `campanha_identidade`, `campanha_fontes`, `campanha_versoes`, colunas aditivas em `campaigns`, `derivar_estado_vigencia()` |
| [`migrations/002_job_queue.sql`](./migrations/002_job_queue.sql) | 20260716184203 · `v2_002_job_queue` | sim | `job_queue` + `jq_enqueue/jq_claim/jq_complete/jq_fail` (SKIP LOCKED, backoff exponencial, dead-letter em 5 tentativas) |
| [`migrations/003_confirmar_tier1.sql`](./migrations/003_confirmar_tier1.sql) | 20260716184948 · `v2_003_confirmar_tier1` | sim (evento incremental, sem rebuild) | `confirmar_tier1()`: promove estado por evidência TIER 1, grava evento em `campanha_versoes` |

## Esquema de versionamento a partir daqui

1. Arquivo local: `migrations/NNN_nome.sql`, `NNN` sequencial (`004`, `005`, …).
2. Ao aplicar via MCP `apply_migration`, o nome vai prefixado `v2_NNN_nome` e recebe o timestamp do Supabase — o par (arquivo ↔ versão aplicada) é registrado neste manifesto.
3. **Só aditivo** sobre o baseline. Nada de reescrever v1. Migração destrutiva exige snapshot explícito antes (ver `campaigns_bkp_prev2_20260716`, retido até o fim do M1).
4. Toda migration precisa ser **idempotente** (re-aplicável sem efeito colateral) — condição do operador para reuso in-place do banco de produção.

## Estado de aplicação

As 3 migrations v2 estão **aplicadas e verificadas** em produção (`list_migrations` confirma `v2_001/002/003`). Backup pré-v2 `campaigns_bkp_prev2_20260716` (3610 linhas) retido como rede de segurança até o fecho do M1.
