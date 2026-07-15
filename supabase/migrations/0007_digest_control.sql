-- Centro de controle de digests (fases 3–7): curadoria, QA, agenda, métricas, auditoria.
-- Já aplicada no Supabase (qjqnqcsdnpvvmyzkavoq). Todas as tabelas RLS service-role
-- only (espelha predict_snapshots). Idempotente (IF NOT EXISTS / drop policy).

-- Fase 5: agenda + aprovação no ledger de edições.
alter table editions add column if not exists scheduled_at timestamptz;
alter table editions add column if not exists published_at timestamptz;
alter table editions add column if not exists approved_by text;
alter table editions add column if not exists approved_at timestamptz;
alter table editions add column if not exists curated boolean not null default false;

-- Fase 3: rascunho curado pelo operador (o "o que entra no digest").
create table if not exists edition_drafts (
  id          text primary key,               -- ex.: daily-2026-07-16
  product     text not null default 'daily',
  date        text not null,
  subject     text,
  sinal       text,
  destaque    text,
  deal_ids    jsonb not null default '[]'::jsonb,   -- ids de campaigns no Deal Desk
  notes       text,
  status      text not null default 'draft',        -- draft | ready | approved | published
  version     integer not null default 1,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Fase 4: relatório de QA por alvo (rascunho ou edição), com achados e bloqueio.
create table if not exists edition_qa_reports (
  id          uuid primary key default gen_random_uuid(),
  target_id   text not null,                        -- edition.id ou draft.id
  target_kind text not null default 'draft',        -- draft | edition
  passed      boolean not null default false,
  blocking    boolean not null default false,       -- alguma regra inviolável quebrada
  score       integer,
  findings    jsonb not null default '[]'::jsonb,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_qa_target on edition_qa_reports (target_id, created_at desc);

-- Fase 6: métricas do Beehiiv por edição (fecha o loop).
create table if not exists edition_stats (
  edition_id       text primary key,
  beehiiv_post_id  text,
  recipients       integer,
  opens            integer,
  clicks           integer,
  open_rate        numeric,
  click_rate       numeric,
  raw              jsonb,
  fetched_at       timestamptz not null default now()
);

-- Fase 7: trilha de auditoria — toda ação por edição/rascunho.
create table if not exists edition_events (
  id         uuid primary key default gen_random_uuid(),
  target_id  text not null,
  action     text not null,                         -- generated | curated | qa | approved | scheduled | published | stats
  actor      text,
  detail     jsonb,
  at         timestamptz not null default now()
);
create index if not exists idx_events_target on edition_events (target_id, at desc);

-- RLS: só service-role opera (o admin usa a service key; bypassa RLS).
alter table edition_drafts     enable row level security;
alter table edition_qa_reports enable row level security;
alter table edition_stats      enable row level security;
alter table edition_events     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['edition_drafts','edition_qa_reports','edition_stats','edition_events'] loop
    execute format('drop policy if exists svc_all on %I', t);
    execute format('create policy svc_all on %I for all to service_role using (true) with check (true)', t);
  end loop;
end $$;
