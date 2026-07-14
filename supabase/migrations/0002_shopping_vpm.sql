-- Radar de VPM multiprograma por SKU — modelo rico (Fase 2 do PROMPT MESTRE).
-- Fiel ao §5 do spec. Aditivo e idempotente: não altera nem remove o sku_*
-- legado (que será migrado/aposentado depois da validação, §17.7). RLS ligado
-- sem policies públicas: só a service_role_key (admin/coletor server-only) acessa.

-- ------------------------------------------------------------------ domínios
create table if not exists public.loyalty_programs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  base_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.loyalty_programs (code, name, base_url) values
  ('latam_pass', 'LATAM Pass', 'https://shopping.latampass.latam.com'),
  ('azul_fidelidade', 'Azul Fidelidade', 'https://shopping.azulfidelidade.com.br'),
  ('smiles', 'Smiles', 'https://shoppingsmiles.com.br')
on conflict (code) do update set name = excluded.name, base_url = excluded.base_url, updated_at = now();

create table if not exists public.shopping_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.shopping_categories (code, name) values
  ('audio', 'Áudio'),
  ('small_appliances', 'Eletroportáteis'),
  ('coffee_machines', 'Cafeteiras'),
  ('smartphones', 'Telefonia'),
  ('tv_video', 'TV e vídeo'),
  ('kitchen', 'Cozinha'),
  ('computing', 'Informática')
on conflict (code) do update set name = excluded.name;

-- ------------------------------------------------------------------ catálogo
create table if not exists public.shopping_products (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  category_code text not null references public.shopping_categories(code),
  normalized_name text not null,
  brand text not null,
  model text,
  mpn text,
  ean text,
  variant_description text,
  color text,
  capacity text,
  voltage text,
  bundle_description text,
  match_confidence text not null default 'medium' check (match_confidence in ('high','medium','low','rejected')),
  expected_program_coverage integer,
  fallback_priority integer,
  primary_fallback_key text,
  secondary_fallback_key text,
  status text not null default 'active' check (status in ('active','paused','discontinued','review')),
  approved boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_product_sources (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shopping_products(id) on delete cascade,
  program_code text not null references public.loyalty_programs(code),
  partner_name text,
  marketplace_sku text,
  partner_sku text,
  source_ean text,
  source_mpn text,
  product_url text,
  source_url_type text not null default 'product' check (source_url_type in ('product','category','search','redirect','api','unknown')),
  extraction_method text not null default 'unknown' check (extraction_method in ('fetch_html','json_ld','internal_api','browser_headless','manual_reference','unknown')),
  requires_login boolean not null default false,
  requires_browser boolean not null default false,
  source_status text not null default 'pending_validation' check (source_status in ('pending_validation','active','paused','broken','blocked','unsupported')),
  last_validated_at timestamptz,
  consecutive_failures integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, program_code, product_url)
);

-- ------------------------------------------------------------------ execução
create table if not exists public.shopping_collection_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null check (trigger_type in ('scheduled','manual','retry','backfill')),
  status text not null default 'queued' check (status in ('queued','running','partial','success','failed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  selected_sources integer not null default 0,
  successful_sources integer not null default 0,
  failed_sources integer not null default 0,
  retry_sources integer not null default 0,
  observations_created integer not null default 0,
  metrics_created integer not null default 0,
  comparisons_created integer not null default 0,
  error_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_collection_queue (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.shopping_collection_runs(id) on delete cascade,
  source_id uuid not null references public.shopping_product_sources(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','running','success','retry','error','dead_letter')),
  priority integer not null default 100,
  attempt_count integer not null default 0,
  claimed_at timestamptz,
  claimed_by text,
  next_retry_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  unique (run_id, source_id)
);
create index if not exists shopping_queue_claim_idx on public.shopping_collection_queue (status, priority, next_retry_at);

-- ------------------------------------------------------------------ capturas
create table if not exists public.shopping_observations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.shopping_collection_runs(id) on delete set null,
  source_id uuid not null references public.shopping_product_sources(id) on delete cascade,
  product_id uuid not null references public.shopping_products(id) on delete cascade,
  program_code text not null references public.loyalty_programs(code),
  captured_at timestamptz not null,
  observed_title text,
  observed_brand text,
  observed_model text,
  observed_mpn text,
  observed_ean text,
  observed_variant text,
  listed_price numeric(14,2),
  partner_cash_price numeric(14,2),
  external_reference_price numeric(14,2),
  reference_price numeric(14,2),
  reference_price_type text,
  reference_price_source text,
  reference_price_captured_at timestamptz,
  standard_points bigint,
  club_points bigint,
  card_points bigint,
  elite_points bigint,
  promotional_points bigint,
  hybrid_points bigint,
  hybrid_cash numeric(14,2),
  availability text not null default 'unknown' check (availability in ('in_stock','low_stock','out_of_stock','unavailable','not_listed','blocked','unknown')),
  match_confidence text not null default 'low' check (match_confidence in ('high','medium','low','rejected')),
  extraction_confidence text not null default 'low' check (extraction_confidence in ('high','medium','low')),
  offer_condition_text text,
  extraction_method text,
  adapter_version text,
  calculation_version text,
  source_url text,
  raw_payload jsonb,
  evidence jsonb not null default '[]'::jsonb,
  validation_status text not null default 'pending',
  validation_warnings jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists shopping_obs_product_idx on public.shopping_observations (product_id, program_code, captured_at desc);
create index if not exists shopping_obs_run_idx on public.shopping_observations (run_id);

-- ------------------------------------------------------------------ métricas
create table if not exists public.shopping_metrics (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null unique references public.shopping_observations(id) on delete cascade,
  vpm_standard numeric(14,4),
  vpm_club numeric(14,4),
  vpm_card numeric(14,4),
  vpm_elite numeric(14,4),
  vpm_promotional numeric(14,4),
  vpm_hybrid_marginal numeric(14,4),
  preserved_points bigint,
  is_comparable boolean not null default false,
  comparison_reason text,
  outlier_status text not null default 'not_evaluated',
  freshness_status text not null default 'current',
  calculation_version text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------- comparações
create table if not exists public.shopping_sku_comparisons (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shopping_products(id) on delete cascade,
  reference_date date not null,
  comparison_window_start timestamptz,
  comparison_window_end timestamptz,
  programs_available integer not null,
  valid_observations integer not null,
  best_standard_program text,
  best_standard_vpm numeric(14,4),
  best_elite_program text,
  best_elite_vpm numeric(14,4),
  comparison_status text not null,
  quality_status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (product_id, reference_date)
);

create table if not exists public.shopping_category_benchmarks (
  id uuid primary key default gen_random_uuid(),
  category_code text not null references public.shopping_categories(code),
  program_code text not null references public.loyalty_programs(code),
  reference_date date not null,
  valid_products integer not null,
  total_products integer not null,
  coverage_rate numeric(10,4),
  vpm_standard_p25 numeric(14,4),
  vpm_standard_median numeric(14,4),
  vpm_standard_p75 numeric(14,4),
  vpm_elite_p25 numeric(14,4),
  vpm_elite_median numeric(14,4),
  vpm_elite_p75 numeric(14,4),
  sample_quality text not null,
  created_at timestamptz not null default now(),
  unique (category_code, program_code, reference_date)
);

-- ------------------------------------------------------------------ RLS
alter table public.loyalty_programs             enable row level security;
alter table public.shopping_categories          enable row level security;
alter table public.shopping_products            enable row level security;
alter table public.shopping_product_sources     enable row level security;
alter table public.shopping_collection_runs     enable row level security;
alter table public.shopping_collection_queue    enable row level security;
alter table public.shopping_observations        enable row level security;
alter table public.shopping_metrics             enable row level security;
alter table public.shopping_sku_comparisons     enable row level security;
alter table public.shopping_category_benchmarks enable row level security;
