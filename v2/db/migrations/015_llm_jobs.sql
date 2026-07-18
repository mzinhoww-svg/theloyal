-- =====================================================================
-- Migration 015 — ledger de chamadas de LLM (`llm_jobs`) + registro de
-- modelos por estagio (`model_registry`). M2.5 · REQ-34/REQ-35, slice
-- SPEC-SLICE-PAINEL-CUSTO-LLM.md.
--
-- ADITIVA e IDEMPOTENTE. So DDL: cria duas tabelas VAZIAS. NAO remove nem
-- reescreve nada de `campaigns`/`news_raw`/`editions`. Estilo: migrations
-- 004/011 (aditiva, sem seed que precise aprovacao).
--
-- SEM SEED DE PRECO (INV-03): `model_registry` nasce vazia. Os precos reais
-- por modelo (`preco_input_por_1k_usd`/`preco_output_por_1k_usd`) sao a tabela
-- de precos publicada do OpenRouter na data do seed — um INSERT a aprovar
-- depois, com fonte e data (mesmo padrao de `custo_base_moeda`/011). Enquanto
-- o preco for NULL, o custo em USD do painel fica NULL ("Nao confirmado"),
-- nunca 0 coagido — 0 mentiria que a chamada foi de graca.
--
-- `custo_usd` em `llm_jobs` tambem nasce NULL: o custo e derivado no PAINEL
-- (tokens x preco do `model_registry`), fonte unica de preco. O emissor grava
-- so o que observou de fato — tokens, latencia, status. Nao calcula custo
-- (INV-12: LLM/pipeline escreve o observado; a conta e determinista, no painel).
--
-- `estagio` como CHECK fechado, NAO dominio-como-tabela: cada estagio e um
-- ponto de CODIGO especifico (arquitetura), nao dado de negocio que cresce por
-- INSERT do operador. Novo estagio = nova migration pequena. Os dois CHECKs
-- (aqui e em model_registry) sao duplicados de proposito — evita acoplar DDL de
-- telemetria a config (spec §2, nota da FK).
--
-- Referencias: REQ-34/REQ-35, NFR-01, INV-03/INV-12. Baseline: schema-atual.sql.
-- =====================================================================

create table if not exists public.llm_jobs (
  id            bigint generated always as identity primary key,
  estagio       text not null check (estagio in (
                  'extracao_campanhas', 'radar_vpm_match', 'radar_vpm_promo',
                  'radar_vpm_extracao', 'gate_rejeicao_b'
                )),
  provider      text not null check (provider in ('openrouter', 'ollama', 'mock')),
  modelo        text not null,
  tokens_in     integer,
  tokens_out    integer,
  custo_usd     numeric(10,6),         -- derivado no painel (tokens x preco). NULL ate haver preco.
  latencia_ms   integer,
  status        text not null check (status in ('ok', 'erro', 'fallback')),
  fallback_de   text,                  -- modelo original, quando status='fallback'
  erro          text,
  job_ref       text,                  -- correlacao opcional (ex.: runs.id, news_raw.id)
  criado_em     timestamptz not null default now()
);

-- Dia ancorado em UTC: `timestamptz::date` depende de TimeZone (STABLE) e o
-- Postgres recusa em indice; `(criado_em at time zone 'UTC')::date` e IMMUTABLE
-- e casa com o bucket de dia UTC usado no painel (v2/lib/painel-custo-llm.mjs).
create index if not exists llm_jobs_estagio_dia_idx
  on public.llm_jobs (estagio, ((criado_em at time zone 'UTC')::date));

comment on table  public.llm_jobs is
  'Ledger de telemetria de chamadas de LLM (REQ-34). Uma linha por chamada real a um backend (openrouter/ollama). Emissor grava o OBSERVADO (tokens/latencia/status); custo_usd e derivado no painel (INV-12). Sem dado interno/CMI (INV-03).';
comment on column public.llm_jobs.custo_usd is
  'NULL no insert: o custo (tokens x preco do model_registry) e calculado no painel. Preco ausente => NULL, nunca 0.';
comment on column public.llm_jobs.job_ref is
  'Correlacao opcional com a origem: news_raw.id (extracao) ou runs.id (radar). Nao e FK — job pode existir sem a linha de origem.';

create table if not exists public.model_registry (
  estagio                 text primary key check (estagio in (
                            'extracao_campanhas', 'radar_vpm_match', 'radar_vpm_promo',
                            'radar_vpm_extracao', 'gate_rejeicao_b'
                          )),
  modelo_principal        text not null,
  modelos_fallback        text[] not null default '{}',
  preco_input_por_1k_usd  numeric(10,6),   -- NULL = "a confirmar" (INV-03): seed a aprovar com fonte+data
  preco_output_por_1k_usd numeric(10,6),   -- idem
  teto_tokens_por_chamada integer,
  ativo                   boolean not null default true,
  atualizado_em           timestamptz not null default now()
);

comment on table  public.model_registry is
  'Modelo por estagio + preco por 1k tokens (REQ-35). Troca de modelo = UPDATE aqui, sem deploy. Precos sao seed a aprovar depois (fonte+data), nunca chutados (INV-03). Mesmo CHECK de estagio que llm_jobs, duplicado de proposito.';
comment on column public.model_registry.preco_input_por_1k_usd is
  'USD por 1000 tokens de input. NULL = "a confirmar": custo do painel fica NULL enquanto nao houver preco publicado com proveniencia.';

-- SEM INSERT. Popular model_registry (modelo+preco por estagio) so apos
-- aprovacao do seed com fonte (tabela de precos do OpenRouter, datada).
