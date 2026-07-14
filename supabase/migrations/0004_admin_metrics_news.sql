-- Estende admin_metrics com contagens reais de notícias por estado.
-- Motivação: a página /admin/noticias contava a partir de uma amostra capada
-- (getNews(500)) e a lista exibe só 200 — os cards não refletiam o banco.
-- Aqui as contagens são exatas (count(*) direto), sem amostragem.
--
-- Estados mutuamente exclusivos (somam news_total):
--   processadas = processed=true e sem erro
--   erro        = error not null
--   pendentes   = processed=false e sem erro (fila real de extração)

create or replace function public.admin_metrics()
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
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
