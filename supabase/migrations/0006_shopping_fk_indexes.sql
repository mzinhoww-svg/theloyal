-- P2 — Índices de cobertura para as foreign keys das tabelas do Radar VPM
-- apontadas pelos advisors de performance. FKs sem índice degradam joins e
-- validações de cascade. Criação idempotente e não bloqueante o suficiente
-- para tabelas ainda pequenas.
--
-- Nota: os índices marcados como "não usados" pelo advisor (claim da fila,
-- snapshot por programa, obs por run) NÃO são removidos de propósito — suportam
-- padrões de query intencionais que ainda não rodaram com volume.

create index if not exists shopping_category_benchmarks_program_idx
  on public.shopping_category_benchmarks (program_code);

create index if not exists shopping_collection_queue_source_idx
  on public.shopping_collection_queue (source_id);

create index if not exists shopping_observations_program_idx
  on public.shopping_observations (program_code);

create index if not exists shopping_observations_source_idx
  on public.shopping_observations (source_id);

create index if not exists shopping_product_sources_program_idx
  on public.shopping_product_sources (program_code);

create index if not exists shopping_products_category_idx
  on public.shopping_products (category_code);
