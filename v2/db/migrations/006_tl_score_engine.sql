-- =====================================================================
-- Migration 006 — TL Score engine (M2 slice 4). ADITIVA e IDEMPOTENTE.
-- =====================================================================
-- NÃO aplicar aqui (a aplicação em produção é serializada pelo orquestrador).
-- Só escreve/valida o DDL. Não remove nem reescreve nada de `campaigns`.
--
-- Introduz de forma aditiva o que o engine puro (v2/lib/score.mjs) precisa:
--   1. score_pesos       — vetor de pesos VERSIONADO (accuracy loop recalibra
--                          sem deploy; golden ancorados à versão) — D-022 / §1.
--   2. tl_breakdown      — o "porquê" de cada score, por componente (INV-03).
--   3. tl_overrides      — log append-only de todo rebaixamento (INV-07/INV-11).
--   4. colunas aditivas em campaigns: score bruto vs veredito final (§3).
--
-- Referências: SPEC-SLICE-4-TLSCORE-ENGINE.md §1/§2/§3, D-022, INV-02/03/07/12.
-- Baseline: v2/db/schema-atual.sql. Estilo: migrations 001–005.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. score_pesos — vetor de pesos versionado (NUNCA hardcoded no engine)
-- ---------------------------------------------------------------------
-- Vigência SAIU do score (urgência não é qualidade, D-022): não há
-- peso_vigencia. Fontes viraram OVERRIDE, não peso. Soma dos 4 pesos = 1,00.
create table if not exists public.score_pesos (
  versao           text primary key,
  peso_percentil   numeric not null,
  peso_eficiencia  numeric not null,
  peso_raridade    numeric not null,
  peso_abrangencia numeric not null,
  shrink_k         integer not null default 5,   -- base pequena puxa percentil p/ 0,5
  min_samples      integer not null default 3,   -- base_n < min_samples → base_curta
  nota             text,
  criado_em        timestamptz not null default now(),
  -- os 4 pesos somam 1,00 (tolerância de arredondamento); o engine redistribui
  -- entre os PRESENTES, mas o vetor de origem é normalizado por construção.
  constraint score_pesos_soma_um
    check (abs((peso_percentil + peso_eficiencia + peso_raridade + peso_abrangencia) - 1) < 0.0001)
);

-- Seed v1 — TRAVADO pelo operador (D-022 / SPEC §2.2). Ancorado nos golden.
insert into public.score_pesos
  (versao, peso_percentil, peso_eficiencia, peso_raridade, peso_abrangencia, shrink_k, min_samples, nota)
values
  ('v1', 0.45, 0.30, 0.15, 0.10, 5, 3,
   'TL Score v2, vetor v1. percentil dominante (nao maioria), eficiencia = a conta '
   || '(ausente -> redistribui), raridade modula, abrangencia ajusta. Vigencia fora do '
   || 'score (urgencia); fontes viram override. Reconciliacao Manual 8->5 = Opcao A.')
on conflict (versao) do nothing;

-- ---------------------------------------------------------------------
-- 2. tl_breakdown — o porquê de cada score, por componente (INV-03)
-- ---------------------------------------------------------------------
-- Append-only. Um score = várias linhas (uma por componente presente).
-- Σ contribuicao das linhas de um cálculo = tl_score_bruto/100 (reproduzível).
-- base_curta marca o amortecimento de percentil por base curta (SPEC §2).
create table if not exists public.tl_breakdown (
  id            bigint generated always as identity primary key,
  campaign_id   text not null references public.campaigns(id),
  versao_pesos  text not null references public.score_pesos(versao),
  componente    text not null check (componente in ('percentil','eficiencia','raridade','abrangencia')),
  valor         numeric not null check (valor >= 0 and valor <= 1),  -- valor USADO (percentil já amortecido)
  peso          numeric not null,                                    -- peso NOMINAL do vetor (antes de redistribuir)
  contribuicao  numeric not null,                                    -- valor · peso_efetivo (soma = score/100)
  base_n        integer,                                             -- tamanho da amostra do componente
  janela        text,                                                -- janela temporal (ex.: '18m')
  base_curta    boolean not null default false,                     -- SPEC §2: base_n < min_samples
  calculado_em  timestamptz not null default now()
);
create index if not exists tl_breakdown_campaign_idx on public.tl_breakdown(campaign_id, calculado_em desc);
create index if not exists tl_breakdown_versao_idx    on public.tl_breakdown(versao_pesos);

-- ---------------------------------------------------------------------
-- 3. tl_overrides — log de todo rebaixamento a "Não confirmado" (INV-07/11)
-- ---------------------------------------------------------------------
-- Append-only. Um cálculo pode gerar MAIS DE UM override (todos logados);
-- campaigns.override_aplicado guarda o que decidiu o veredito exibido.
create table if not exists public.tl_overrides (
  id            bigint generated always as identity primary key,
  campaign_id   text not null references public.campaigns(id),
  versao_pesos  text not null references public.score_pesos(versao),
  override      text not null check (override in ('sem_tier1','conta_nao_calculavel')),
  de_veredito   text not null,   -- veredito bruto (ex.: 'Vale agir')
  para_veredito text not null default 'Não confirmado',
  evidencia     text not null,   -- por que rebaixou (sem isto não rebaixa — INV-03)
  aplicado_em   timestamptz not null default now()
);
create index if not exists tl_overrides_campaign_idx on public.tl_overrides(campaign_id, aplicado_em desc);
create index if not exists tl_overrides_override_idx  on public.tl_overrides(override);

-- ---------------------------------------------------------------------
-- 4. Colunas aditivas em campaigns — score bruto vs veredito final (§3)
-- ---------------------------------------------------------------------
-- Um item pode ter score alto E ser rebaixado. O dado carrega os dois:
-- a fila de "candidatos a confirmar" (§4) ranqueia por tl_score_bruto desc.
-- Todas nullable (score só existe depois que o engine roda sobre o item).
alter table public.campaigns
  add column if not exists tl_score_bruto    integer,  -- o que a régua deu (0–100), antes de override
  add column if not exists veredito_bruto    text,     -- faixa correspondente (ex.: 'Vale agir')
  add column if not exists veredito          text,     -- veredito FINAL exibido (pode ser 'Não confirmado')
  add column if not exists override_aplicado text,     -- qual override rebaixou (ou null)
  add column if not exists versao_pesos      text references public.score_pesos(versao);
create index if not exists campaigns_tl_score_bruto_idx on public.campaigns(tl_score_bruto desc);
create index if not exists campaigns_veredito_idx        on public.campaigns(veredito);

-- ---------------------------------------------------------------------
-- 5. RLS — mesmo padrão das novas tabelas (service_role até o M3)
-- ---------------------------------------------------------------------
alter table public.score_pesos   enable row level security;
alter table public.tl_breakdown  enable row level security;
alter table public.tl_overrides  enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='score_pesos' and policyname='svc_all') then
    create policy svc_all on public.score_pesos for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tl_breakdown' and policyname='svc_all') then
    create policy svc_all on public.tl_breakdown for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tl_overrides' and policyname='svc_all') then
    create policy svc_all on public.tl_overrides for all to service_role using (true) with check (true);
  end if;
end $$;

comment on table  public.score_pesos  is 'Vetor de pesos do TL Score, versionado. Recalibracao = nova versao (accuracy loop), nao edicao ad hoc (D-022/REQ-22).';
comment on table  public.tl_breakdown is 'Porque de cada score, por componente (INV-03). Append-only. Soma de contribuicao = tl_score_bruto/100.';
comment on table  public.tl_overrides is 'Log append-only de rebaixamentos a Nao confirmado (INV-07/INV-11). Preserva o score bruto (secao 3).';
comment on column public.campaigns.tl_score_bruto is 'Score da regua (0-100) ANTES de override; orienta a fila de candidatos a confirmar (secao 4).';

-- =====================================================================
-- Rollback (referência; não executar junto):
--   alter table public.campaigns
--     drop column if exists tl_score_bruto, drop column if exists veredito_bruto,
--     drop column if exists veredito, drop column if exists override_aplicado,
--     drop column if exists versao_pesos;
--   drop table if exists public.tl_overrides, public.tl_breakdown, public.score_pesos;
-- =====================================================================
