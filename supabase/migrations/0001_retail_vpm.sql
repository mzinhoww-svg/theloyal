-- The Loyal — Radar de VPM não-aéreo (Shopping) por SKU.
-- Fonte de verdade das novas tabelas. Aplicar via Supabase MCP (apply_migration)
-- ou `supabase db push`. Reconciliar `public.runs` contra o schema ao vivo antes
-- (só adicionamos colunas com default, mas confirme que não há NOT NULL sem default).
--
-- Fronteira inviolável: NADA aqui armazena CMI interno, teto interno ou dado de
-- auditoria. Só VPM OBSERVADO, derivado de preço público de catálogo:
--   vpm (R$/milheiro) = cash_brl / (points / 1000)

-- ---------------------------------------------------------------------------
-- Catálogo canônico de produtos (curado/aprovado no admin).
create table if not exists public.sku_catalog (
  id            uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  brand         text,
  model         text,
  category      text not null default 'outros'
                  check (category in ('smartphone','tv','notebook','audio','eletroportatil','outros')),
  gtin          text,                       -- EAN/GTIN: chave de match exato quando houver
  attributes    jsonb not null default '{}'::jsonb,
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now()
);
create unique index if not exists sku_catalog_gtin_uidx
  on public.sku_catalog (gtin) where gtin is not null;

-- Mapeamento de cada produto para a listagem pública de cada player.
create table if not exists public.sku_sources (
  id          uuid primary key default gen_random_uuid(),
  sku_id      uuid not null references public.sku_catalog(id) on delete cascade,
  player      text not null
                check (player in ('azul','smiles','latam','livelo','esfera')),
  channel     text,                          -- ex: "Shopping", "Portal das Malas"
  url         text not null,
  external_id text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (sku_id, player)
);

-- Série temporal — o núcleo do feed. Uma linha por (produto, player, rodada).
create table if not exists public.sku_observations (
  id          uuid primary key default gen_random_uuid(),
  sku_id      uuid references public.sku_catalog(id) on delete set null,
  player      text not null
                check (player in ('azul','smiles','latam','livelo','esfera')),
  run_id      uuid,
  captured_at timestamptz not null default now(),
  points      numeric,                       -- pontos/milhas pedidos no resgate
  cash_brl    numeric,                       -- preço público em dinheiro (comparável)
  is_promo    boolean not null default false,
  promo_reason text,
  vpm         numeric,                        -- R$/milheiro = cash_brl / (points/1000)
  source_url  text not null,
  raw         jsonb not null default '{}'::jsonb
);
create index if not exists sku_observations_sku_idx      on public.sku_observations (sku_id);
create index if not exists sku_observations_player_idx   on public.sku_observations (player);
create index if not exists sku_observations_captured_idx on public.sku_observations (captured_at desc);

-- Banda agregada por player+categoria (recomputada a cada rodada). Espelha a
-- forma de public.valuations (piso/teto/confidence) para o admin renderizar igual.
create table if not exists public.retail_valuations (
  id          uuid primary key default gen_random_uuid(),
  player      text not null,
  category    text not null,
  segment     text not null default 'nao-aereo',
  piso        numeric,
  mediana     numeric,
  teto        numeric,
  sample_n    integer not null default 0,
  confidence  text not null default 'em-formacao'
                check (confidence in ('alta','media','baixa','em-formacao')),
  is_current  boolean not null default true,
  computed_at timestamptz not null default now()
);
create index if not exists retail_valuations_current_idx
  on public.retail_valuations (is_current, player, category);

-- Reuso do ledger de rodadas existente: distinguir coleta de campanhas vs SKUs.
alter table public.runs add column if not exists kind          text not null default 'campaigns';
alter table public.runs add column if not exists skus_observed integer;

-- ---------------------------------------------------------------------------
-- RLS: a anon/publishable key só enxerga o AGREGADO público (retail_valuations).
-- Catálogo, mapeamento e observações brutas ficam fora do alcance da anon key;
-- o admin (server-only, Basic-Auth) e o coletor leem/escrevem com a SERVICE key,
-- que ignora RLS. Escrita nunca passa pela anon key.
alter table public.sku_catalog      enable row level security;
alter table public.sku_sources      enable row level security;
alter table public.sku_observations enable row level security;
alter table public.retail_valuations enable row level security;

drop policy if exists retail_valuations_read_anon on public.retail_valuations;
create policy retail_valuations_read_anon
  on public.retail_valuations for select to anon using (true);
