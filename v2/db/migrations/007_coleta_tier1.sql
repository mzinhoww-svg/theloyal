-- =====================================================================
-- Migration 007 — coleta_execucoes: saúde por fonte da coleta TIER 1 (M2b)
-- =====================================================================
-- ADITIVA e IDEMPOTENTE. NÃO aplicada ainda (só validada) — decisão do brief.
--
-- Por que existe (e por que campanha_fontes/job_queue NÃO bastam):
--   * campanha_fontes  = TRILHA DE CONFIRMAÇÃO (1 linha por fonte confirmada).
--     Não registra a varredura que NÃO confirmou nada, nem o erro de sitemap.
--   * job_queue        = fila EFÊMERA (jobs viram success/dead_letter e somem
--     do backlog). Não é histórico durável de saúde por fonte.
--   * REQ-09 exige "saúde por fonte monitorada" e NFR-03 "saúde de fonte
--     monitorada": uma linha por EXECUÇÃO de adapter (sitemap buscado, N URLs
--     descobertas, N confirmadas, status, erro, duração). Telemetria, não a
--     verdade da campanha — por isso tabela própria, não coluna em campaigns.
-- Nada aqui altera scoring, gate, vigência ou as migrations 001–006.
-- =====================================================================

create table if not exists public.coleta_execucoes (
  id                 uuid primary key default gen_random_uuid(),
  programa           text not null,                         -- smiles | livelo | esfera | tap_milesgo
  sitemap_url        text,
  status             text not null default 'ok',            -- ok | parcial | erro
  urls_descobertas   integer not null default 0,
  urls_confirmadas   integer not null default 0,
  urls_recusadas     integer not null default 0,            -- 3xx/robots/sem match
  erro               text,
  duracao_ms         integer,
  iniciado_em        timestamptz not null default now(),
  concluido_em       timestamptz not null default now(),
  constraint coleta_execucoes_status_chk check (status in ('ok','parcial','erro'))
);

-- última execução por programa (dashboard de saúde) e caça a falhas.
create index if not exists coleta_execucoes_prog_idx on public.coleta_execucoes (programa, concluido_em desc);
create index if not exists coleta_execucoes_erro_idx on public.coleta_execucoes (status) where status = 'erro';

alter table public.coleta_execucoes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='coleta_execucoes' and policyname='svc_all') then
    create policy svc_all on public.coleta_execucoes for all to service_role using (true) with check (true);
  end if;
end $$;

-- registra uma execução de adapter (chamada pelo runner ao fim de cada varredura).
create or replace function public.registrar_coleta_execucao(
  p_programa text,
  p_sitemap_url text default null,
  p_status text default 'ok',
  p_urls_descobertas int default 0,
  p_urls_confirmadas int default 0,
  p_urls_recusadas int default 0,
  p_erro text default null,
  p_duracao_ms int default null
) returns uuid language sql security definer set search_path to 'public' as $$
  insert into public.coleta_execucoes
    (programa, sitemap_url, status, urls_descobertas, urls_confirmadas, urls_recusadas, erro, duracao_ms)
  values
    (p_programa, p_sitemap_url, coalesce(p_status,'ok'),
     coalesce(p_urls_descobertas,0), coalesce(p_urls_confirmadas,0), coalesce(p_urls_recusadas,0),
     left(p_erro, 2000), p_duracao_ms)
  returning id;
$$;

-- =====================================================================
-- Rollback: drop function registrar_coleta_execucao; drop table coleta_execucoes;
-- =====================================================================
