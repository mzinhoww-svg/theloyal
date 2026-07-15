-- Trilha D — auditoria das revisões assistidas de data (correção de ano
-- fabricado pela extração; ver docs/auditoria/predict-forecast-lineage.md).
-- Cada decisão do operador (aplicar ou rejeitar uma proposta) grava uma linha;
-- a campanha em si é corrigida via update de vigencia_inicio (prioridade
-- máxima do windowDate), nunca reescrevendo o id. Idempotente.

create table if not exists public.campaign_date_reviews (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         text not null,
  route               text,
  old_event_date      date,
  proposed_date       date not null,
  action              text not null check (action in ('applied', 'rejected')),
  evidence            jsonb not null default '[]'::jsonb,
  decided_by          text,
  created_at          timestamptz not null default now()
);

create index if not exists campaign_date_reviews_campaign_idx
  on public.campaign_date_reviews (campaign_id, created_at desc);

alter table public.campaign_date_reviews enable row level security;

-- Só a service_role opera (sem policy para anon/authenticated).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaign_date_reviews'
      and policyname = 'campaign_date_reviews_service_all'
  ) then
    create policy campaign_date_reviews_service_all
      on public.campaign_date_reviews
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;
