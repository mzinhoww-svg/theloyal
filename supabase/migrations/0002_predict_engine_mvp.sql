-- RFC-009 Fase C (MVP) — motor "predict" (campaign_predict_v2).
-- Aditivo: NÃO altera tabelas existentes. Cria só o armazenamento de snapshots
-- de previsão (observabilidade §22). O cálculo é determinístico em TS
-- (lib/predict/*); esta tabela guarda o histórico versionado das previsões.
--
-- RLS: só a service_role lê/escreve (mesmo padrão de forecast_*/campaigns).

create table if not exists public.predict_snapshots (
  id                          uuid primary key default gen_random_uuid(),
  as_of_date                  date not null,
  scope                       text not null,          -- 'route' | 'cluster'
  series_key                  text not null,
  program                     text,                   -- destino canônico
  origem                      text,                   -- null em cluster
  destino                     text not null,
  records_total               integer,
  records_recent              integer,
  days_since_last             integer,
  median_interval_days        numeric,
  recent_median_interval_days numeric,
  prob_7                      numeric,
  prob_15                     numeric,
  prob_30                     numeric,
  prob_60                     numeric,
  prob_90                     numeric,
  prob_180                    numeric,
  central_date                date,
  window_start                date,
  window_end                  date,
  bonus_candidates            jsonb,                  -- [{value, probability, tipo}]
  confidence                  text,                   -- alta|media|baixa|insuficiente
  readiness                   text,                   -- ready|ready_with_warnings|insufficient_history|backfill_incomplete|data_quality_blocked
  block_reason                text,
  backtest                    jsonb,                  -- {observations, median_date_error_days, window_hit_rate, exact_bonus_accuracy, bonus_accuracy_5pp}
  features                    jsonb,
  explanation                 text,
  model_version               text not null default 'campaign_predict_v2',
  backtest_version            text not null default 'walk_forward_v1',
  created_at                  timestamptz not null default now(),
  created_by                  text,
  unique (series_key, as_of_date)
);

create index if not exists predict_snapshots_program_idx
  on public.predict_snapshots (program, as_of_date desc);

alter table public.predict_snapshots enable row level security;

-- Só a service_role opera (sem policy para anon/authenticated).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'predict_snapshots'
      and policyname = 'predict_snapshots_service_all'
  ) then
    create policy predict_snapshots_service_all
      on public.predict_snapshots
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;
