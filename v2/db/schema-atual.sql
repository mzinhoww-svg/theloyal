-- =====================================================================
-- The Loyal — SCHEMA BASELINE (estado real do banco vivo)
-- =====================================================================
-- Projeto Supabase: the-loyalty (ref qjqnqcsdnpvvmyzkavoq), Postgres 17.
-- Extraído read-only via MCP em 2026-07-16 (M1.0 do ciclo v2).
--
-- PROPÓSITO: este arquivo é o BASELINE canônico das migrations v2. Ele
-- documenta o schema que hoje existe SÓ no banco vivo (o repo versiona
-- apenas 9 migrations parciais para 20 aplicadas). NÃO é para reaplicar
-- por cima do banco atual — é a linha de base sobre a qual as migrations
-- de canonicalização v2 serão escritas (aditivas e idempotentes, 8.1).
--
-- Antes de qualquer migration destrutiva: snapshot/backup do banco
-- (decisão §5 item 6). Este baseline não altera dados.
--
-- Cobertura: 32 tabelas, constraints, índices, RLS policies, 8 funções
-- (RPCs admin_*, backfill_from_sitemap, shopping_recompute), 3 views e
-- ~25 crons pg_cron. Edge functions (ingest, campaigns, backfill) vivem
-- em supabase/functions/ e no dashboard — não são DDL SQL.
-- =====================================================================

-- Extensões em uso (pg_cron agenda; pg_net faz http_post; pgcrypto p/ digest/uuid).
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- create extension if not exists pgcrypto;

-- =====================================================================
-- 1. TABELAS
-- =====================================================================

CREATE TABLE public.backfill_queue (
  id text NOT NULL,
  source text NOT NULL,
  url text NOT NULL,
  lastmod text,
  title text,
  descricao text,
  status text DEFAULT 'pending'::text,
  error_msg text,
  created_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone
);

CREATE TABLE public.backfill_tracker (
  id integer NOT NULL DEFAULT nextval('backfill_tracker_id_seq'::regclass),
  source text NOT NULL,
  sitemap_url text NOT NULL,
  status text DEFAULT 'pending'::text,
  urls_found integer DEFAULT 0,
  urls_inserted integer DEFAULT 0,
  error_msg text,
  created_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone
);

CREATE TABLE public.campaign_date_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id text NOT NULL,
  route text,
  old_event_date date,
  proposed_date date NOT NULL,
  action text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  decided_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ENTIDADE CENTRAL. id = 'origem-destino-tipo-vigenciafim' (instável: embute
-- vigencia_fim mutável — ver ADR-RADAR-009). vigencia_fim é TEXT (contém "na").
-- 3.593 linhas; só 10 com tl_score, 14 com verdict; 458 origens / 361 destinos
-- não canonicalizados. Alvo da slice de identidade v2.
CREATE TABLE public.campaigns (
  id text NOT NULL,
  module text,
  origem text NOT NULL,
  destino text NOT NULL,
  tipo text NOT NULL,
  percentual numeric,
  range_low numeric,
  paridade text,
  cpm text,
  cpm_value numeric,
  valor_leitura text,
  tl_score integer,
  verdict text,
  vigencia_inicio date,
  vigencia_fim text,
  status text NOT NULL,
  discard_reason text,
  tier integer,
  source_name text,
  source_url text,
  regulamento_url text,
  first_seen date,
  last_seen date,
  observed_at date,
  used_in jsonb DEFAULT '{"pro": [], "daily": [], "weekly": []}'::jsonb,
  notes text,
  origin text DEFAULT 'daily'::text,
  created_at timestamp with time zone DEFAULT now(),
  published_at timestamp with time zone,
  dedup_key text,
  date_suspect boolean NOT NULL DEFAULT false
);

CREATE TABLE public.edition_drafts (
  id text NOT NULL,
  product text NOT NULL DEFAULT 'daily'::text,
  date text NOT NULL,
  subject text,
  sinal text,
  destaque text,
  deal_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'draft'::text,
  version integer NOT NULL DEFAULT 1,
  created_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.edition_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  target_id text NOT NULL,
  action text NOT NULL,
  actor text,
  detail jsonb,
  at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.edition_qa_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  target_id text NOT NULL,
  target_kind text NOT NULL DEFAULT 'draft'::text,
  passed boolean NOT NULL DEFAULT false,
  blocking boolean NOT NULL DEFAULT false,
  score integer,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.edition_stats (
  edition_id text NOT NULL,
  beehiiv_post_id text,
  recipients integer,
  opens integer,
  clicks integer,
  open_rate numeric,
  click_rate numeric,
  raw jsonb,
  fetched_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.editions (
  id text NOT NULL,
  product text NOT NULL,
  number integer,
  date text,
  title text,
  status text DEFAULT 'draft'::text,
  gate_validate boolean,
  gate_audit boolean,
  quality_score integer,
  beehiiv_post_id text,
  beehiiv_url text,
  sources_count integer,
  deals_count integer,
  json jsonb,
  created_at timestamp with time zone DEFAULT now(),
  scheduled_at timestamp with time zone,
  published_at timestamp with time zone,
  approved_by text,
  approved_at timestamp with time zone,
  curated boolean NOT NULL DEFAULT false
);

CREATE TABLE public.forecast_config (
  id integer NOT NULL DEFAULT 1,
  wave_epsilon_days integer NOT NULL DEFAULT 3,
  min_samples integer NOT NULL DEFAULT 2,
  samples_alta integer NOT NULL DEFAULT 4,
  samples_media integer NOT NULL DEFAULT 3,
  cv_alta numeric NOT NULL DEFAULT 0.35,
  cv_media numeric NOT NULL DEFAULT 0.60,
  horizon_daily integer NOT NULL DEFAULT 10,
  horizon_weekly integer NOT NULL DEFAULT 21,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE public.forecast_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  route text NOT NULL,
  action text NOT NULL,
  confidence text,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by text
);

CREATE TABLE public.forecast_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  generated_for date NOT NULL,
  routes_tracked integer,
  clusters_tracked integer,
  with_prediction integer,
  config jsonb,
  payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by text
);

CREATE TABLE public.loyalty_programs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  base_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 40.191 linhas (100% processed=true). ~1:1 com raw_noticias v2.
CREATE TABLE public.news_raw (
  id text NOT NULL,
  source text NOT NULL,
  url text NOT NULL,
  title text,
  published_at date,
  fetched_at timestamp with time zone DEFAULT now(),
  content text,
  content_hash text,
  processed boolean DEFAULT false,
  process_run uuid,
  model_used text,
  tokens_in integer,
  tokens_out integer,
  campaigns_extracted integer DEFAULT 0,
  extraction_json jsonb,
  error text
);

-- 4 fontes, TODAS tier 2 (Passageiro de Primeira, Pontos pra Voar,
-- Melhores Destinos, Melhores Cartões). Zero TIER 1.
CREATE TABLE public.news_sources (
  id text NOT NULL,
  name text,
  rss_url text,
  base_url text,
  tier integer DEFAULT 2,
  active boolean DEFAULT true
);

CREATE TABLE public.passagens (
  id text NOT NULL,
  origem text,
  destino text,
  programa text,
  cabine text DEFAULT 'economica'::text,
  milhas integer,
  taxas numeric,
  observed_at date,
  source_url text,
  origin text DEFAULT 'daily'::text
);

CREATE TABLE public.predict_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  as_of_date date NOT NULL,
  scope text NOT NULL,
  series_key text NOT NULL,
  program text,
  origem text,
  destino text NOT NULL,
  records_total integer,
  records_recent integer,
  days_since_last integer,
  median_interval_days numeric,
  recent_median_interval_days numeric,
  prob_7 numeric,
  prob_15 numeric,
  prob_30 numeric,
  prob_60 numeric,
  prob_90 numeric,
  prob_180 numeric,
  central_date date,
  window_start date,
  window_end date,
  bonus_candidates jsonb,
  confidence text,
  readiness text,
  block_reason text,
  backtest jsonb,
  features jsonb,
  explanation text,
  model_version text NOT NULL DEFAULT 'campaign_predict_v2'::text,
  backtest_version text NOT NULL DEFAULT 'walk_forward_v1'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by text
);

CREATE TABLE public.retail_valuations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player text NOT NULL,
  category text NOT NULL,
  segment text NOT NULL DEFAULT 'nao-aereo'::text,
  piso numeric,
  mediana numeric,
  teto numeric,
  sample_n integer NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'em-formacao'::text,
  is_current boolean NOT NULL DEFAULT true,
  computed_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product text NOT NULL,
  kind text DEFAULT 'scheduled'::text,
  started_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone,
  status text DEFAULT 'running'::text,
  searches_count integer,
  campaigns_found integer,
  campaigns_active integer,
  campaigns_discarded integer,
  gate_validate boolean,
  gate_audit boolean,
  edition_id text,
  beehiiv_post_id text,
  errors jsonb DEFAULT '[]'::jsonb,
  warnings jsonb DEFAULT '[]'::jsonb,
  human_note text,
  skus_observed integer
);

CREATE TABLE public.shopping_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.shopping_category_benchmarks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_code text NOT NULL,
  program_code text NOT NULL,
  reference_date date NOT NULL,
  valid_products integer NOT NULL,
  total_products integer NOT NULL,
  coverage_rate numeric(10,4),
  vpm_standard_p25 numeric(14,4),
  vpm_standard_median numeric(14,4),
  vpm_standard_p75 numeric(14,4),
  vpm_elite_p25 numeric(14,4),
  vpm_elite_median numeric(14,4),
  vpm_elite_p75 numeric(14,4),
  sample_quality text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- FILA DE JOBS DE REFERÊNCIA (blueprint do job_queue v2): status, priority,
-- attempt_count, claimed_at/claimed_by, next_retry_at, dead_letter.
CREATE TABLE public.shopping_collection_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  source_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  priority integer NOT NULL DEFAULT 100,
  attempt_count integer NOT NULL DEFAULT 0,
  claimed_at timestamp with time zone,
  claimed_by text,
  next_retry_at timestamp with time zone,
  completed_at timestamp with time zone,
  last_error_code text,
  last_error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.shopping_collection_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trigger_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued'::text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  selected_sources integer NOT NULL DEFAULT 0,
  successful_sources integer NOT NULL DEFAULT 0,
  failed_sources integer NOT NULL DEFAULT 0,
  retry_sources integer NOT NULL DEFAULT 0,
  observations_created integer NOT NULL DEFAULT 0,
  metrics_created integer NOT NULL DEFAULT 0,
  comparisons_created integer NOT NULL DEFAULT 0,
  error_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.shopping_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL,
  vpm_standard numeric(14,4),
  vpm_club numeric(14,4),
  vpm_card numeric(14,4),
  vpm_elite numeric(14,4),
  vpm_promotional numeric(14,4),
  vpm_hybrid_marginal numeric(14,4),
  preserved_points bigint,
  is_comparable boolean NOT NULL DEFAULT false,
  comparison_reason text,
  outlier_status text NOT NULL DEFAULT 'not_evaluated'::text,
  freshness_status text NOT NULL DEFAULT 'current'::text,
  calculation_version text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.shopping_observations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid,
  source_id uuid NOT NULL,
  product_id uuid NOT NULL,
  program_code text NOT NULL,
  captured_at timestamp with time zone NOT NULL,
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
  reference_price_captured_at timestamp with time zone,
  standard_points bigint,
  club_points bigint,
  card_points bigint,
  elite_points bigint,
  promotional_points bigint,
  hybrid_points bigint,
  hybrid_cash numeric(14,2),
  availability text NOT NULL DEFAULT 'unknown'::text,
  match_confidence text NOT NULL DEFAULT 'low'::text,
  extraction_confidence text NOT NULL DEFAULT 'low'::text,
  offer_condition_text text,
  extraction_method text,
  adapter_version text,
  calculation_version text,
  source_url text,
  raw_payload jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_status text NOT NULL DEFAULT 'pending'::text,
  validation_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_code text,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.shopping_product_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  program_code text NOT NULL,
  partner_name text,
  marketplace_sku text,
  partner_sku text,
  source_ean text,
  source_mpn text,
  product_url text,
  source_url_type text NOT NULL DEFAULT 'product'::text,
  extraction_method text NOT NULL DEFAULT 'unknown'::text,
  requires_login boolean NOT NULL DEFAULT false,
  requires_browser boolean NOT NULL DEFAULT false,
  source_status text NOT NULL DEFAULT 'pending_validation'::text,
  last_validated_at timestamp with time zone,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.shopping_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  canonical_key text NOT NULL,
  category_code text NOT NULL,
  normalized_name text NOT NULL,
  brand text NOT NULL,
  model text,
  mpn text,
  ean text,
  variant_description text,
  color text,
  capacity text,
  voltage text,
  bundle_description text,
  match_confidence text NOT NULL DEFAULT 'medium'::text,
  expected_program_coverage integer,
  fallback_priority integer,
  primary_fallback_key text,
  secondary_fallback_key text,
  status text NOT NULL DEFAULT 'active'::text,
  approved boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.shopping_sku_comparisons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  reference_date date NOT NULL,
  comparison_window_start timestamp with time zone,
  comparison_window_end timestamp with time zone,
  programs_available integer NOT NULL,
  valid_observations integer NOT NULL,
  best_standard_program text,
  best_standard_vpm numeric(14,4),
  best_elite_program text,
  best_elite_vpm numeric(14,4),
  comparison_status text NOT NULL,
  quality_status text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.sku_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  brand text,
  model text,
  category text NOT NULL DEFAULT 'outros'::text,
  gtin text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.sku_observations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sku_id uuid,
  player text NOT NULL,
  run_id uuid,
  captured_at timestamp with time zone NOT NULL DEFAULT now(),
  points numeric,
  cash_brl numeric,
  is_promo boolean NOT NULL DEFAULT false,
  promo_reason text,
  vpm numeric,
  source_url text NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.sku_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL,
  player text NOT NULL,
  channel text,
  url text NOT NULL,
  external_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.valuations (
  period_id text NOT NULL,
  program text NOT NULL,
  piso numeric,
  teto numeric,
  confidence text,
  source text,
  is_current boolean DEFAULT false,
  updated_at date
);

-- =====================================================================
-- 2. CONSTRAINTS (PK, FK, UNIQUE, CHECK)
-- =====================================================================

ALTER TABLE public.backfill_queue ADD CONSTRAINT backfill_queue_pkey PRIMARY KEY (id);
ALTER TABLE public.backfill_tracker ADD CONSTRAINT backfill_tracker_pkey PRIMARY KEY (id);
ALTER TABLE public.backfill_tracker ADD CONSTRAINT backfill_tracker_source_sitemap_url_key UNIQUE (source, sitemap_url);
ALTER TABLE public.campaign_date_reviews ADD CONSTRAINT campaign_date_reviews_action_check CHECK ((action = ANY (ARRAY['applied'::text, 'rejected'::text])));
ALTER TABLE public.campaign_date_reviews ADD CONSTRAINT campaign_date_reviews_pkey PRIMARY KEY (id);
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);
ALTER TABLE public.edition_drafts ADD CONSTRAINT edition_drafts_pkey PRIMARY KEY (id);
ALTER TABLE public.edition_events ADD CONSTRAINT edition_events_pkey PRIMARY KEY (id);
ALTER TABLE public.edition_qa_reports ADD CONSTRAINT edition_qa_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.edition_stats ADD CONSTRAINT edition_stats_pkey PRIMARY KEY (edition_id);
ALTER TABLE public.editions ADD CONSTRAINT editions_pkey PRIMARY KEY (id);
ALTER TABLE public.forecast_config ADD CONSTRAINT forecast_config_id_check CHECK ((id = 1));
ALTER TABLE public.forecast_config ADD CONSTRAINT forecast_config_pkey PRIMARY KEY (id);
ALTER TABLE public.forecast_overrides ADD CONSTRAINT forecast_overrides_action_check CHECK ((action = ANY (ARRAY['pin'::text, 'mute'::text, 'confidence'::text])));
ALTER TABLE public.forecast_overrides ADD CONSTRAINT forecast_overrides_confidence_check CHECK ((confidence = ANY (ARRAY['alta'::text, 'media'::text, 'baixa'::text])));
ALTER TABLE public.forecast_overrides ADD CONSTRAINT forecast_overrides_pkey PRIMARY KEY (id);
ALTER TABLE public.forecast_overrides ADD CONSTRAINT forecast_overrides_scope_check CHECK ((scope = ANY (ARRAY['route'::text, 'cluster'::text])));
ALTER TABLE public.forecast_overrides ADD CONSTRAINT forecast_overrides_scope_route_key UNIQUE (scope, route);
ALTER TABLE public.forecast_snapshots ADD CONSTRAINT forecast_snapshots_pkey PRIMARY KEY (id);
ALTER TABLE public.loyalty_programs ADD CONSTRAINT loyalty_programs_code_key UNIQUE (code);
ALTER TABLE public.loyalty_programs ADD CONSTRAINT loyalty_programs_pkey PRIMARY KEY (id);
ALTER TABLE public.news_raw ADD CONSTRAINT news_raw_pkey PRIMARY KEY (id);
ALTER TABLE public.news_sources ADD CONSTRAINT news_sources_pkey PRIMARY KEY (id);
ALTER TABLE public.passagens ADD CONSTRAINT passagens_pkey PRIMARY KEY (id);
ALTER TABLE public.predict_snapshots ADD CONSTRAINT predict_snapshots_pkey PRIMARY KEY (id);
ALTER TABLE public.predict_snapshots ADD CONSTRAINT predict_snapshots_series_key_as_of_date_key UNIQUE (series_key, as_of_date);
ALTER TABLE public.retail_valuations ADD CONSTRAINT retail_valuations_confidence_check CHECK ((confidence = ANY (ARRAY['alta'::text, 'media'::text, 'baixa'::text, 'em-formacao'::text])));
ALTER TABLE public.retail_valuations ADD CONSTRAINT retail_valuations_pkey PRIMARY KEY (id);
ALTER TABLE public.runs ADD CONSTRAINT runs_pkey PRIMARY KEY (id);
ALTER TABLE public.shopping_categories ADD CONSTRAINT shopping_categories_code_key UNIQUE (code);
ALTER TABLE public.shopping_categories ADD CONSTRAINT shopping_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.shopping_category_benchmarks ADD CONSTRAINT shopping_category_benchmarks_category_code_fkey FOREIGN KEY (category_code) REFERENCES shopping_categories(code);
ALTER TABLE public.shopping_category_benchmarks ADD CONSTRAINT shopping_category_benchmarks_category_code_program_code_ref_key UNIQUE (category_code, program_code, reference_date);
ALTER TABLE public.shopping_category_benchmarks ADD CONSTRAINT shopping_category_benchmarks_pkey PRIMARY KEY (id);
ALTER TABLE public.shopping_category_benchmarks ADD CONSTRAINT shopping_category_benchmarks_program_code_fkey FOREIGN KEY (program_code) REFERENCES loyalty_programs(code);
ALTER TABLE public.shopping_collection_queue ADD CONSTRAINT shopping_collection_queue_pkey PRIMARY KEY (id);
ALTER TABLE public.shopping_collection_queue ADD CONSTRAINT shopping_collection_queue_run_id_fkey FOREIGN KEY (run_id) REFERENCES shopping_collection_runs(id) ON DELETE CASCADE;
ALTER TABLE public.shopping_collection_queue ADD CONSTRAINT shopping_collection_queue_run_id_source_id_key UNIQUE (run_id, source_id);
ALTER TABLE public.shopping_collection_queue ADD CONSTRAINT shopping_collection_queue_source_id_fkey FOREIGN KEY (source_id) REFERENCES shopping_product_sources(id) ON DELETE CASCADE;
ALTER TABLE public.shopping_collection_queue ADD CONSTRAINT shopping_collection_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'success'::text, 'retry'::text, 'error'::text, 'dead_letter'::text])));
ALTER TABLE public.shopping_collection_runs ADD CONSTRAINT shopping_collection_runs_pkey PRIMARY KEY (id);
ALTER TABLE public.shopping_collection_runs ADD CONSTRAINT shopping_collection_runs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'partial'::text, 'success'::text, 'failed'::text, 'cancelled'::text])));
ALTER TABLE public.shopping_collection_runs ADD CONSTRAINT shopping_collection_runs_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['scheduled'::text, 'manual'::text, 'retry'::text, 'backfill'::text])));
ALTER TABLE public.shopping_metrics ADD CONSTRAINT shopping_metrics_observation_id_fkey FOREIGN KEY (observation_id) REFERENCES shopping_observations(id) ON DELETE CASCADE;
ALTER TABLE public.shopping_metrics ADD CONSTRAINT shopping_metrics_observation_id_key UNIQUE (observation_id);
ALTER TABLE public.shopping_metrics ADD CONSTRAINT shopping_metrics_pkey PRIMARY KEY (id);
ALTER TABLE public.shopping_observations ADD CONSTRAINT shopping_observations_availability_check CHECK ((availability = ANY (ARRAY['in_stock'::text, 'low_stock'::text, 'out_of_stock'::text, 'unavailable'::text, 'not_listed'::text, 'blocked'::text, 'unknown'::text])));
ALTER TABLE public.shopping_observations ADD CONSTRAINT shopping_observations_extraction_confidence_check CHECK ((extraction_confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])));
ALTER TABLE public.shopping_observations ADD CONSTRAINT shopping_observations_match_confidence_check CHECK ((match_confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text, 'rejected'::text])));
ALTER TABLE public.shopping_observations ADD CONSTRAINT shopping_observations_pkey PRIMARY KEY (id);
ALTER TABLE public.shopping_observations ADD CONSTRAINT shopping_observations_product_id_fkey FOREIGN KEY (product_id) REFERENCES shopping_products(id) ON DELETE CASCADE;
ALTER TABLE public.shopping_observations ADD CONSTRAINT shopping_observations_program_code_fkey FOREIGN KEY (program_code) REFERENCES loyalty_programs(code);
ALTER TABLE public.shopping_observations ADD CONSTRAINT shopping_observations_run_id_fkey FOREIGN KEY (run_id) REFERENCES shopping_collection_runs(id) ON DELETE SET NULL;
ALTER TABLE public.shopping_observations ADD CONSTRAINT shopping_observations_source_id_fkey FOREIGN KEY (source_id) REFERENCES shopping_product_sources(id) ON DELETE CASCADE;
ALTER TABLE public.shopping_product_sources ADD CONSTRAINT shopping_product_sources_extraction_method_check CHECK ((extraction_method = ANY (ARRAY['fetch_html'::text, 'json_ld'::text, 'internal_api'::text, 'browser_headless'::text, 'manual_reference'::text, 'unknown'::text])));
ALTER TABLE public.shopping_product_sources ADD CONSTRAINT shopping_product_sources_pkey PRIMARY KEY (id);
ALTER TABLE public.shopping_product_sources ADD CONSTRAINT shopping_product_sources_product_id_fkey FOREIGN KEY (product_id) REFERENCES shopping_products(id) ON DELETE CASCADE;
ALTER TABLE public.shopping_product_sources ADD CONSTRAINT shopping_product_sources_product_id_program_code_product_ur_key UNIQUE (product_id, program_code, product_url);
ALTER TABLE public.shopping_product_sources ADD CONSTRAINT shopping_product_sources_program_code_fkey FOREIGN KEY (program_code) REFERENCES loyalty_programs(code);
ALTER TABLE public.shopping_product_sources ADD CONSTRAINT shopping_product_sources_source_status_check CHECK ((source_status = ANY (ARRAY['pending_validation'::text, 'active'::text, 'paused'::text, 'broken'::text, 'blocked'::text, 'unsupported'::text])));
ALTER TABLE public.shopping_product_sources ADD CONSTRAINT shopping_product_sources_source_url_type_check CHECK ((source_url_type = ANY (ARRAY['product'::text, 'category'::text, 'search'::text, 'redirect'::text, 'api'::text, 'unknown'::text])));
ALTER TABLE public.shopping_products ADD CONSTRAINT shopping_products_canonical_key_key UNIQUE (canonical_key);
ALTER TABLE public.shopping_products ADD CONSTRAINT shopping_products_category_code_fkey FOREIGN KEY (category_code) REFERENCES shopping_categories(code);
ALTER TABLE public.shopping_products ADD CONSTRAINT shopping_products_match_confidence_check CHECK ((match_confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text, 'rejected'::text])));
ALTER TABLE public.shopping_products ADD CONSTRAINT shopping_products_pkey PRIMARY KEY (id);
ALTER TABLE public.shopping_products ADD CONSTRAINT shopping_products_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'discontinued'::text, 'review'::text])));
ALTER TABLE public.shopping_sku_comparisons ADD CONSTRAINT shopping_sku_comparisons_pkey PRIMARY KEY (id);
ALTER TABLE public.shopping_sku_comparisons ADD CONSTRAINT shopping_sku_comparisons_product_id_fkey FOREIGN KEY (product_id) REFERENCES shopping_products(id) ON DELETE CASCADE;
ALTER TABLE public.shopping_sku_comparisons ADD CONSTRAINT shopping_sku_comparisons_product_id_reference_date_key UNIQUE (product_id, reference_date);
ALTER TABLE public.sku_catalog ADD CONSTRAINT sku_catalog_category_check CHECK ((category = ANY (ARRAY['smartphone'::text, 'tablet'::text, 'tv'::text, 'notebook'::text, 'audio'::text, 'wearable'::text, 'games'::text, 'eletroportatil'::text, 'cafeteira'::text, 'cozinha'::text, 'informatica'::text, 'outros'::text])));
ALTER TABLE public.sku_catalog ADD CONSTRAINT sku_catalog_pkey PRIMARY KEY (id);
ALTER TABLE public.sku_catalog ADD CONSTRAINT sku_catalog_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public.sku_observations ADD CONSTRAINT sku_observations_pkey PRIMARY KEY (id);
ALTER TABLE public.sku_observations ADD CONSTRAINT sku_observations_player_check CHECK ((player = ANY (ARRAY['azul'::text, 'smiles'::text, 'latam'::text, 'livelo'::text, 'esfera'::text])));
ALTER TABLE public.sku_observations ADD CONSTRAINT sku_observations_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES sku_catalog(id) ON DELETE SET NULL;
ALTER TABLE public.sku_sources ADD CONSTRAINT sku_sources_pkey PRIMARY KEY (id);
ALTER TABLE public.sku_sources ADD CONSTRAINT sku_sources_player_check CHECK ((player = ANY (ARRAY['azul'::text, 'smiles'::text, 'latam'::text, 'livelo'::text, 'esfera'::text])));
ALTER TABLE public.sku_sources ADD CONSTRAINT sku_sources_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES sku_catalog(id) ON DELETE CASCADE;
ALTER TABLE public.sku_sources ADD CONSTRAINT sku_sources_sku_id_player_key UNIQUE (sku_id, player);
ALTER TABLE public.valuations ADD CONSTRAINT valuations_pkey PRIMARY KEY (period_id, program);

-- =====================================================================
-- 3. ÍNDICES (não-constraint)
-- =====================================================================

CREATE INDEX backfill_pending ON public.backfill_queue USING btree (source, status) WHERE (status = 'pending'::text);
CREATE INDEX campaign_date_reviews_campaign_idx ON public.campaign_date_reviews USING btree (campaign_id, created_at DESC);
CREATE INDEX campaigns_dedup_key_idx ON public.campaigns USING btree (dedup_key);
CREATE INDEX idx_campaigns_obs ON public.campaigns USING btree (observed_at);
CREATE INDEX idx_campaigns_rota ON public.campaigns USING btree (origem, destino, tipo);
CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status);
CREATE INDEX idx_events_target ON public.edition_events USING btree (target_id, at DESC);
CREATE INDEX idx_qa_target ON public.edition_qa_reports USING btree (target_id, created_at DESC);
CREATE INDEX forecast_snapshots_created_idx ON public.forecast_snapshots USING btree (created_at DESC);
CREATE INDEX news_raw_published ON public.news_raw USING btree (published_at DESC);
CREATE INDEX news_raw_unprocessed ON public.news_raw USING btree (processed) WHERE (processed = false);
CREATE INDEX predict_snapshots_program_idx ON public.predict_snapshots USING btree (program, as_of_date DESC);
CREATE INDEX retail_valuations_current_idx ON public.retail_valuations USING btree (is_current, player, category);
CREATE INDEX idx_runs_started ON public.runs USING btree (started_at DESC);
CREATE INDEX shopping_category_benchmarks_program_idx ON public.shopping_category_benchmarks USING btree (program_code);
CREATE INDEX shopping_collection_queue_source_idx ON public.shopping_collection_queue USING btree (source_id);
CREATE INDEX shopping_queue_claim_idx ON public.shopping_collection_queue USING btree (status, priority, next_retry_at);
CREATE INDEX shopping_obs_product_idx ON public.shopping_observations USING btree (product_id, program_code, captured_at DESC);
CREATE INDEX shopping_obs_run_idx ON public.shopping_observations USING btree (run_id);
CREATE INDEX shopping_observations_program_idx ON public.shopping_observations USING btree (program_code);
CREATE INDEX shopping_observations_source_idx ON public.shopping_observations USING btree (source_id);
CREATE INDEX shopping_product_sources_program_idx ON public.shopping_product_sources USING btree (program_code);
CREATE INDEX shopping_products_category_idx ON public.shopping_products USING btree (category_code);
CREATE UNIQUE INDEX sku_catalog_gtin_uidx ON public.sku_catalog USING btree (gtin) WHERE (gtin IS NOT NULL);
CREATE INDEX sku_observations_captured_idx ON public.sku_observations USING btree (captured_at DESC);
CREATE INDEX sku_observations_player_idx ON public.sku_observations USING btree (player);
CREATE INDEX sku_observations_sku_idx ON public.sku_observations USING btree (sku_id);

-- =====================================================================
-- 4. RLS POLICIES
-- Padrão: service_role p/ tudo (admin/coletores). anon SELECT em conteúdo
-- público (campaigns, editions, runs, valuations, passagens, retail_valuations).
-- Escrita anônima foi removida em 0005 (security_hardening). Sem auth.uid().
-- =====================================================================
-- (habilitar RLS em cada tabela antes das policies — omitido aqui; já ativo no banco.)

CREATE POLICY campaign_date_reviews_service_all ON public.campaign_date_reviews AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY anon_read_campaigns ON public.campaigns AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY svc_all ON public.edition_drafts AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY svc_all ON public.edition_events AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY svc_all ON public.edition_qa_reports AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY svc_all ON public.edition_stats AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY anon_read_editions ON public.editions AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY anon_read_passagens ON public.passagens AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY predict_snapshots_service_all ON public.predict_snapshots AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY retail_valuations_read_anon ON public.retail_valuations AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY anon_read_runs ON public.runs AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY anon_read_valuations ON public.valuations AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

-- =====================================================================
-- 5. FUNÇÕES (RPCs) — admin_*, backfill_from_sitemap, shopping_recompute
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_backfill_progress()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'tracker', (select coalesce(jsonb_object_agg(status, n),'{}'::jsonb) from (select status, count(*) n from backfill_tracker group by status) t),
    'queue',   (select coalesce(jsonb_object_agg(status, n),'{}'::jsonb) from (select status, count(*) n from backfill_queue group by status) q)
  );
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_jobs()
 RETURNS TABLE(jobid bigint, jobname text, grupo text, fn_target text, schedule text, active boolean, last_status text, last_start timestamp with time zone, last_msg text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
  select
    j.jobid, j.jobname,
    case
      when j.jobname like 'ingest%'   then 'coleta'
      when j.jobname like 'extract%'  then 'analise'
      when j.jobname like 'backfill%' then 'backfill'
      else 'outro'
    end as grupo,
    coalesce(substring(j.command from 'functions/v1/([a-zA-Z0-9_-]+)'),
             substring(j.command from '\.supabase\.co/([a-zA-Z0-9_-]+)')) as fn_target,
    j.schedule, j.active,
    lr.status, lr.start_time, lr.return_message
  from cron.job j
  left join lateral (
    select status, start_time, return_message
    from cron.job_run_details d
    where d.jobid = j.jobid
    order by start_time desc limit 1
  ) lr on true
  order by j.jobname;
$function$;

CREATE OR REPLACE FUNCTION public.admin_metrics()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'news_total',               (select count(*) from news_raw),
    'news_hoje',                (select count(*) from news_raw where fetched_at::date = current_date),
    'news_processadas',         (select count(*) from news_raw where processed = true and error is null),
    'news_erro',                (select count(*) from news_raw where error is not null),
    'news_pendentes',           (select count(*) from news_raw where processed = false and error is null),
    'campanhas_total',          (select count(*) from campaigns),
    'campanhas_ativas',         (select count(*) from campaigns where status in ('continua','vence-72h','vence-hoje')),
    'campanhas_hoje',           (select count(*) from campaigns where last_seen = current_date),
    'backfill_queue_pendente',  (select count(*) from backfill_queue where status='pending'),
    'backfill_tracker_pendente',(select count(*) from backfill_tracker where status='pending'),
    'jobs_ativos',              (select count(*) from cron.job where active),
    'jobs_total',               (select count(*) from cron.job)
  );
$function$;

CREATE OR REPLACE FUNCTION public.admin_recent_runs(p_limit integer DEFAULT 30)
 RETURNS TABLE(jobname text, status text, start_time timestamp with time zone, end_time timestamp with time zone, return_message text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
  select j.jobname, d.status, d.start_time, d.end_time, d.return_message
  from cron.job_run_details d
  join cron.job j on j.jobid = d.jobid
  order by d.start_time desc limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.admin_run_now(p_fn text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
declare v_req bigint;
begin
  if p_fn not in ('ingest','campaigns','backfill','backfill-daily','backfill-simple') then
    return 'function nao permitida: '||p_fn;
  end if;
  select net.http_post(url := 'https://qjqnqcsdnpvvmyzkavoq.supabase.co/functions/v1/'||p_fn) into v_req;
  return format('disparado %s (request_id=%s)', p_fn, v_req);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_toggle_job(p_jobname text, p_active boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
declare v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = p_jobname;
  if v_id is null then return 'job nao encontrado: '||p_jobname; end if;
  update cron.job set active = p_active where jobid = v_id;
  return format('job %s -> active=%s', p_jobname, p_active);
end;
$function$;

CREATE OR REPLACE FUNCTION public.backfill_from_sitemap(source_name text, sitemap_url text)
 RETURNS TABLE(urls_found integer, urls_inserted integer, message text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_response net.http_response_result;
  v_xml text;
  v_url text;
  v_lastmod text;
  v_count int := 0;
  v_inserted int := 0;
  v_cutoff date := current_date - interval '18 months';
begin
  v_response := net.http_get(sitemap_url);
  if v_response.status <> 200 then
    return query select 0, 0, 'HTTP ' || v_response.status::text;
    return;
  end if;
  v_xml := v_response.content;
  for v_url, v_lastmod in
    select
      (regexp_match(u, '<loc>(.*?)</loc>'))[1],
      (regexp_match(u, '<lastmod>(.*?)</lastmod>'))[1]
    from regexp_split_to_table(v_xml, '<url>') u
    where u like '%<loc>%'
  loop
    v_url := trim(v_url);
    if v_url is null or v_url = '' or v_url like '%/wp-content/%' or v_url like '%.jpg' then
      continue;
    end if;
    if v_lastmod is not null then
      begin
        if v_lastmod::date < v_cutoff then
          continue;
        end if;
      exception when others then
      end;
    end if;
    v_count := v_count + 1;
    insert into backfill_queue (id, source, url, lastmod, status)
    values (
      encode(digest(lower(v_url), 'sha256'), 'hex'),
      source_name, v_url, v_lastmod, 'pending'
    )
    on conflict (id) do nothing;
    if found then
      v_inserted := v_inserted + 1;
    end if;
  end loop;
  return query select v_count, v_inserted, 'OK';
end;
$function$;

CREATE OR REPLACE FUNCTION public.shopping_recompute(p_ref_date date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_metrics int := 0; v_comp int := 0; v_bench int := 0;
begin
  insert into public.shopping_metrics (observation_id, vpm_standard, vpm_elite, vpm_hybrid_marginal, preserved_points, is_comparable, comparison_reason, outlier_status, freshness_status, calculation_version)
  select o.id,
    case when o.reference_price>0 and o.standard_points>0 then round(o.reference_price/o.standard_points*1000,4) end,
    case when o.reference_price>0 and o.elite_points>0 then round(o.reference_price/o.elite_points*1000,4) end,
    case when o.hybrid_cash>0 and o.standard_points>o.hybrid_points then round(o.hybrid_cash/(o.standard_points-o.hybrid_points)*1000,4) end,
    case when o.standard_points>o.hybrid_points then o.standard_points-o.hybrid_points end,
    (coalesce(o.reference_price,0)>0 and coalesce(o.standard_points,0)>0 and o.match_confidence in ('high','medium') and o.availability <> 'not_listed'),
    case when o.reference_price is null or o.reference_price<=0 then 'missing_reference_price'
         when o.standard_points is null then 'missing_standard_points'
         when o.match_confidence in ('low','rejected') then 'low_match_confidence' else null end,
    'not_evaluated','current','shopping_vpm_v1'
  from public.shopping_observations o
  where not exists (select 1 from public.shopping_metrics m where m.observation_id=o.id);
  get diagnostics v_metrics = row_count;

  create temporary table _latest on commit drop as
  select distinct on (o.product_id, o.program_code)
    o.product_id, o.program_code, o.captured_at, m.vpm_standard, m.vpm_elite, m.is_comparable
  from public.shopping_observations o join public.shopping_metrics m on m.observation_id=o.id
  order by o.product_id, o.program_code, m.is_comparable desc, o.captured_at desc;

  delete from public.shopping_sku_comparisons where reference_date = p_ref_date;
  insert into public.shopping_sku_comparisons (product_id, reference_date, comparison_window_start, comparison_window_end, programs_available, valid_observations, best_standard_program, best_standard_vpm, best_elite_program, best_elite_vpm, comparison_status, quality_status, details)
  select c.product_id, p_ref_date, c.win_start, c.win_end, c.programs_available, c.valid_obs,
    bs.program_code, bs.vpm_standard, be.program_code, be.vpm_elite,
    case when c.programs_available >= coalesce(p.expected_program_coverage,3) and c.valid_obs = c.programs_available then 'complete' else 'partial' end,
    case when c.valid_obs=0 then 'no_data' when c.valid_obs=1 then 'insufficient' when c.valid_obs=2 then 'indicative' else 'minimum' end, '{}'::jsonb
  from (select l.product_id, min(l.captured_at) win_start, max(l.captured_at) win_end, count(distinct l.program_code) programs_available, count(*) filter (where l.is_comparable) valid_obs from _latest l group by l.product_id) c
  join public.shopping_products p on p.id=c.product_id
  left join lateral (select l2.program_code, l2.vpm_standard from _latest l2 where l2.product_id=c.product_id and l2.is_comparable and l2.vpm_standard is not null order by l2.vpm_standard desc limit 1) bs on true
  left join lateral (select l3.program_code, l3.vpm_elite from _latest l3 where l3.product_id=c.product_id and l3.is_comparable and l3.vpm_elite is not null order by l3.vpm_elite desc limit 1) be on true;
  get diagnostics v_comp = row_count;

  delete from public.shopping_category_benchmarks where reference_date = p_ref_date;
  insert into public.shopping_category_benchmarks (category_code, program_code, reference_date, valid_products, total_products, coverage_rate, vpm_standard_p25, vpm_standard_median, vpm_standard_p75, vpm_elite_p25, vpm_elite_median, vpm_elite_p75, sample_quality)
  select p.category_code, l.program_code, p_ref_date,
    count(*) filter (where l.is_comparable and l.vpm_standard is not null),
    (select count(*) from public.shopping_products pp where pp.category_code=p.category_code),
    round(count(*) filter (where l.is_comparable and l.vpm_standard is not null)::numeric / nullif((select count(*) from public.shopping_products pp where pp.category_code=p.category_code),0),4),
    round(percentile_cont(0.25) within group (order by l.vpm_standard) filter (where l.is_comparable and l.vpm_standard is not null)::numeric,4),
    round(percentile_cont(0.5) within group (order by l.vpm_standard) filter (where l.is_comparable and l.vpm_standard is not null)::numeric,4),
    round(percentile_cont(0.75) within group (order by l.vpm_standard) filter (where l.is_comparable and l.vpm_standard is not null)::numeric,4),
    round(percentile_cont(0.25) within group (order by l.vpm_elite) filter (where l.is_comparable and l.vpm_elite is not null)::numeric,4),
    round(percentile_cont(0.5) within group (order by l.vpm_elite) filter (where l.is_comparable and l.vpm_elite is not null)::numeric,4),
    round(percentile_cont(0.75) within group (order by l.vpm_elite) filter (where l.is_comparable and l.vpm_elite is not null)::numeric,4),
    case when count(*) filter (where l.is_comparable and l.vpm_standard is not null)=0 then 'no_data' when count(*) filter (where l.is_comparable and l.vpm_standard is not null)=1 then 'insufficient' when count(*) filter (where l.is_comparable and l.vpm_standard is not null)=2 then 'indicative' when count(*) filter (where l.is_comparable and l.vpm_standard is not null)<=4 then 'minimum' when count(*) filter (where l.is_comparable and l.vpm_standard is not null)<=9 then 'usable' else 'robust' end
  from _latest l join public.shopping_products p on p.id=l.product_id group by p.category_code, l.program_code;
  get diagnostics v_bench = row_count;
  return jsonb_build_object('metrics_created', v_metrics, 'comparisons', v_comp, 'benchmarks', v_bench, 'reference_date', p_ref_date);
end $function$;

-- =====================================================================
-- 6. VIEWS
-- =====================================================================

CREATE OR REPLACE VIEW public.backfill_dashboard AS
 SELECT 'sitemaps'::text AS metrica,
    ((((count(*) FILTER (WHERE (backfill_tracker.status = 'pending'::text)))::text || ' pendentes / '::text) || (count(*))::text) || ' total'::text) AS valor
   FROM backfill_tracker
UNION ALL
 SELECT 'fila_urls'::text AS metrica,
    ((((count(*) FILTER (WHERE (backfill_queue.status = 'pending'::text)))::text || ' pendentes / '::text) || (count(*))::text) || ' total'::text) AS valor
   FROM backfill_queue
UNION ALL
 SELECT 'news_raw'::text AS metrica,
    ((((count(*))::text || ' noticias ('::text) || (count(*) FILTER (WHERE (news_raw.processed = false)))::text) || ' nao processadas)'::text) AS valor
   FROM news_raw
UNION ALL
 SELECT 'campanhas_auto'::text AS metrica,
    (count(*))::text AS valor
   FROM campaigns
  WHERE (campaigns.origin = 'auto'::text);

CREATE OR REPLACE VIEW public.campaigns_para_revisar AS
 SELECT id, module, origem, destino, tipo, percentual, range_low, paridade, cpm, cpm_value,
    valor_leitura, tl_score, verdict, vigencia_inicio, vigencia_fim, status, discard_reason,
    tier, source_name, source_url, regulamento_url, first_seen, last_seen, observed_at,
    used_in, notes, origin, created_at
   FROM campaigns
  WHERE ((origin = ANY (ARRAY['auto'::text, 'backfill'::text])) AND (status = ANY (ARRAY['continua'::text, 'vence-72h'::text, 'vence-hoje'::text])) AND (notes ~~* '%confianca:baixa%'::text))
  ORDER BY last_seen DESC;

CREATE OR REPLACE VIEW public.shopping_sku_latest_v AS
 SELECT DISTINCT ON (o.product_id, o.program_code) o.product_id, p.canonical_key,
    p.normalized_name, p.category_code, p.brand, o.program_code, o.captured_at,
    o.reference_price, o.standard_points, o.elite_points, o.availability, o.match_confidence,
    o.source_url, m.vpm_standard, m.vpm_elite, m.vpm_hybrid_marginal, m.is_comparable, m.comparison_reason
   FROM ((shopping_observations o
     JOIN shopping_products p ON ((p.id = o.product_id)))
     LEFT JOIN shopping_metrics m ON ((m.observation_id = o.id)))
  ORDER BY o.product_id, o.program_code, o.captured_at DESC;

-- =====================================================================
-- 7. CRONS (pg_cron) — inventário; comando real usa net.http_post p/ edge functions
-- =====================================================================
-- ingest-0710      [0 9 * * *]    -> functions/v1/ingest  (adiantado p/ preceder o Daily 09:30 UTC — D-068)
-- ingest-1310      [0 16 * * *]   -> functions/v1/ingest
-- ingest-2010      [0 23 * * *]   -> functions/v1/ingest
-- extract-2h       [*/5 * * * *]  -> functions/v1/campaigns (extração)
-- backfill-process [* * * * *]    -> functions/v1/backfill (processa fila)
-- backfill-00      [*/5 * * * *]  -> functions/v1/backfill
-- backfill-01..19  [distribuídos] -> functions/v1/backfill (cobertura diária)
--
-- Edge functions referenciadas mas fora deste SQL (vivem em supabase/functions/
-- e no dashboard): ingest, campaigns, backfill, backfill-daily.
