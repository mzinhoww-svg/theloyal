-- Área de predict do admin (/admin/predict): config ajustável do motor,
-- overrides por rota/programa e snapshots históricos da previsão.
-- Aplicada no projeto the-loyalty (qjqnqcsdnpvvmyzkavoq). RLS ligado sem
-- policies: apenas a service_role_key (admin server-only) acessa.

create table if not exists public.forecast_config (
  id                int primary key default 1 check (id = 1),
  wave_epsilon_days int  not null default 3,
  min_samples       int  not null default 2,
  samples_alta      int  not null default 4,
  samples_media     int  not null default 3,
  cv_alta           numeric not null default 0.35,
  cv_media          numeric not null default 0.60,
  horizon_daily     int  not null default 10,
  horizon_weekly    int  not null default 21,
  updated_at        timestamptz not null default now(),
  updated_by        text
);
insert into public.forecast_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.forecast_overrides (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null check (scope in ('route','cluster')),
  route       text not null,
  action      text not null check (action in ('pin','mute','confidence')),
  confidence  text check (confidence in ('alta','media','baixa')),
  note        text,
  created_at  timestamptz not null default now(),
  created_by  text,
  unique (scope, route)
);

create table if not exists public.forecast_snapshots (
  id               uuid primary key default gen_random_uuid(),
  generated_for    date not null,
  routes_tracked   int,
  clusters_tracked int,
  with_prediction  int,
  config           jsonb,
  payload          jsonb,
  created_at       timestamptz not null default now(),
  created_by       text
);
create index if not exists forecast_snapshots_created_idx on public.forecast_snapshots (created_at desc);

alter table public.forecast_config    enable row level security;
alter table public.forecast_overrides enable row level security;
alter table public.forecast_snapshots enable row level security;
