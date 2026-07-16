-- =====================================================================
-- Migration 001 — Camada canônica de identidade de campanha (M1)
-- =====================================================================
-- ADITIVA e IDEMPOTENTE. Não remove nem reescreve nada de `campaigns`.
-- Cria: domínios (extensão), aliases, identidade canônica, fontes,
-- event sourcing e colunas aditivas + FSM helper.
--
-- PRÉ-REQUISITO (D-006): snapshot/backup do banco antes de aplicar.
-- Aplicar via Supabase apply_migration com a conexão estável.
-- Referência de baseline: v2/db/schema-atual.sql. Spec: SPEC-M1-identidade.md.
-- =====================================================================

-- extensão para normalização acento-insensível (usada no matcher e nos aliases)
create extension if not exists unaccent;

-- ---------------------------------------------------------------------
-- 1. Domínios — extensão de tabelas existentes (aditivo)
-- ---------------------------------------------------------------------
alter table public.loyalty_programs
  add column if not exists kind text,               -- aereo | bancario | varejo | hotel | outro
  add column if not exists aliases text[] not null default '{}';

alter table public.news_sources
  add column if not exists tipo_coleta text,        -- rss | sitemap | html | api | manual
  add column if not exists saude jsonb not null default '{}'::jsonb;

create table if not exists public.pares_transferencia (
  origem_code   text not null,
  destino_code  text not null,
  paridade_base numeric,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  primary key (origem_code, destino_code)
);

-- ---------------------------------------------------------------------
-- 2. Resolução de aliases (458 variantes -> programa real)
-- ---------------------------------------------------------------------
create table if not exists public.programa_aliases (
  alias_normalizado text primary key,               -- lower(trim(unaccent(x))), espacos colapsados
  programa_code     text not null references public.loyalty_programs(code),
  confianca         text not null default 'alta',   -- alta | media | baixa
  origem_deteccao   text not null default 'seed',   -- seed | matcher | manual
  criado_em         timestamptz not null default now()
);
create index if not exists programa_aliases_code_idx on public.programa_aliases(programa_code);

-- ---------------------------------------------------------------------
-- 3. Identidade canônica (sem vigencia_fim na chave — ADR-RADAR-009)
-- ---------------------------------------------------------------------
create table if not exists public.campanha_identidade (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null,                       -- um dos 9 tipos (D-001)
  origem_code   text not null,
  destino_code  text not null,
  publico       text not null default 'geral',       -- geral | selecionados | clube | cartao
  identity_key  text not null unique,                -- tipo|origem_code|destino_code|publico
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists campanha_identidade_rota_idx
  on public.campanha_identidade(origem_code, destino_code, tipo);

create table if not exists public.campanha_fontes (
  id            uuid primary key default gen_random_uuid(),
  identidade_id uuid references public.campanha_identidade(id) on delete cascade,
  campaign_id   text,                                -- FK lógica p/ campaigns.id
  noticia_url   text,
  tier          integer not null default 2,
  papel         text not null default 'cobertura',   -- primeira_deteccao | confirmacao_oficial | cobertura
  verificado_em date,
  criado_em     timestamptz not null default now()
);
create index if not exists campanha_fontes_ident_idx on public.campanha_fontes(identidade_id);
create index if not exists campanha_fontes_tier_idx on public.campanha_fontes(tier);

-- event sourcing: toda reclassificacao/mudanca vira evento (nada sobrescrito sem trilha)
create table if not exists public.campanha_versoes (
  id             uuid primary key default gen_random_uuid(),
  identidade_id  uuid references public.campanha_identidade(id) on delete set null,
  campaign_id    text,
  evento         text not null,                      -- canonicalizacao | reclassificacao_tipo | mudanca_percentual | mudanca_estado | vigencia_normalizada | tie_break_llm
  payload_antes  jsonb,
  payload_depois jsonb,
  origem         text not null default 'matcher',    -- matcher | cron | admin | tie_break_llm
  em             timestamptz not null default now()
);
create index if not exists campanha_versoes_ident_idx on public.campanha_versoes(identidade_id, em desc);
create index if not exists campanha_versoes_campaign_idx on public.campanha_versoes(campaign_id, em desc);

-- ---------------------------------------------------------------------
-- 4. Colunas aditivas em campaigns (original preservado)
-- ---------------------------------------------------------------------
alter table public.campaigns
  add column if not exists identidade_id     uuid references public.campanha_identidade(id),
  add column if not exists origem_code       text,
  add column if not exists destino_code      text,
  add column if not exists publico           text,
  add column if not exists vigencia_fim_date date,
  add column if not exists vigencia_confiavel boolean,
  add column if not exists estado            text,   -- FSM (secao 5)
  add column if not exists canonicalizado_em timestamptz;
create index if not exists campaigns_identidade_idx on public.campaigns(identidade_id);
create index if not exists campaigns_estado_idx on public.campaigns(estado);

-- ---------------------------------------------------------------------
-- 5. FSM de vigência — função pura de derivação de estado
-- Determinística; NUNCA por LLM (brief 5.4). Usada pelo matcher e pelo cron.
-- ---------------------------------------------------------------------
create or replace function public.derivar_estado_vigencia(
  p_vigencia_fim_date date,
  p_vigencia_confiavel boolean,
  p_tem_tier1 boolean default false,
  p_ref date default (now() at time zone 'America/Sao_Paulo')::date
) returns text
language sql immutable as $$
  select case
    when p_vigencia_confiavel is not true or p_vigencia_fim_date is null then 'indeterminada'
    when p_vigencia_fim_date < p_ref - interval '30 days' then 'historica'
    when p_vigencia_fim_date < p_ref then 'encerrada'
    when p_vigencia_fim_date <= p_ref + interval '3 days' then 'ultimos_dias'
    when p_tem_tier1 then 'ativa'
    else 'detectada'
  end;
$$;

-- ---------------------------------------------------------------------
-- 6. RLS: novas tabelas seguem o padrão service_role-only + leitura pública
--    do que é conteúdo (identidade/fontes ficam service-role até o M3).
-- ---------------------------------------------------------------------
alter table public.pares_transferencia   enable row level security;
alter table public.programa_aliases      enable row level security;
alter table public.campanha_identidade   enable row level security;
alter table public.campanha_fontes       enable row level security;
alter table public.campanha_versoes      enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pares_transferencia' and policyname='svc_all') then
    create policy svc_all on public.pares_transferencia for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='programa_aliases' and policyname='svc_all') then
    create policy svc_all on public.programa_aliases for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='campanha_identidade' and policyname='svc_all') then
    create policy svc_all on public.campanha_identidade for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='campanha_fontes' and policyname='svc_all') then
    create policy svc_all on public.campanha_fontes for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='campanha_versoes' and policyname='svc_all') then
    create policy svc_all on public.campanha_versoes for all to service_role using (true) with check (true);
  end if;
end $$;

-- =====================================================================
-- Rollback (referência; não executar junto):
--   drop function if exists public.derivar_estado_vigencia(date,boolean,boolean,date);
--   alter table public.campaigns drop column if exists identidade_id, ... ;
--   drop table if exists public.campanha_versoes, public.campanha_fontes,
--     public.campanha_identidade, public.programa_aliases, public.pares_transferencia;
--   (loyalty_programs/news_sources: manter colunas — inofensivas)
-- =====================================================================
