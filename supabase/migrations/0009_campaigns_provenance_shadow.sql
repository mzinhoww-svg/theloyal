-- Fase 3 (plano consolidado) — colunas ADITIVAS de proveniência/dedup para o
-- shadow mode da edge function `campaigns` v14. Nenhuma coluna existente muda;
-- os motores continuam funcionando sem ler nada daqui até a v15.
--   published_at : proveniência real da notícia (news_raw.published_at, que a
--                  v13 lia e descartava)
--   dedup_key    : chave semântica (rota|tipo|percentual|bucket semanal do
--                  evento) — em shadow só GRAVA e loga colisões; o upsert
--                  continua por id até a medição aprovar a troca
--   date_suspect : validação de ano fabricado no INGEST (espelho de
--                  lib/date-review.ts eventDateLooksFabricated)

alter table public.campaigns add column if not exists published_at timestamptz;
alter table public.campaigns add column if not exists dedup_key text;
alter table public.campaigns add column if not exists date_suspect boolean not null default false;

create index if not exists campaigns_dedup_key_idx on public.campaigns (dedup_key);
