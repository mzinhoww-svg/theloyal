-- =====================================================================
-- Migration 002 — job_queue unificado (M1 slice 2)
-- =====================================================================
-- ADITIVA. Fila única no Postgres com SKIP LOCKED, backoff e dead-letter.
-- Não altera nem remove news_raw/backfill_queue/shopping_collection_queue
-- (seguem rodando; migração faseada nas slices seguintes). brief 8.1 / INV-14.
-- =====================================================================

create table if not exists public.job_queue (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null,                         -- coleta_rss | extracao | resolucao | analise | digest | backfill | recheck_vigencia | confirmacao_tier1 | transicao_estado
  chave         text,                                  -- idempotência por (tipo,chave)
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'pending',       -- pending|running|success|retry|error|dead_letter
  priority      integer not null default 100,
  attempt_count integer not null default 0,
  max_attempts  integer not null default 5,
  claimed_at    timestamptz,
  claimed_by    text,
  run_after     timestamptz not null default now(),    -- backoff: só elegível quando run_after<=now()
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz,
  constraint job_queue_status_chk check (status in ('pending','running','success','retry','error','dead_letter'))
);

-- claim: jobs elegíveis por status+prioridade+janela de backoff
create index if not exists job_queue_claim_idx on public.job_queue (status, priority, run_after)
  where status in ('pending','retry');
-- idempotência: no máx. 1 job "vivo" por (tipo,chave)
create unique index if not exists job_queue_dedup_idx on public.job_queue (tipo, chave)
  where status in ('pending','running','retry') and chave is not null;
create index if not exists job_queue_deadletter_idx on public.job_queue (status) where status='dead_letter';

alter table public.job_queue enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='job_queue' and policyname='svc_all') then
    create policy svc_all on public.job_queue for all to service_role using (true) with check (true);
  end if;
end $$;

-- enfileirar (idempotente por (tipo,chave) vivo)
create or replace function public.jq_enqueue(p_tipo text, p_chave text, p_payload jsonb default '{}'::jsonb, p_priority int default 100)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if p_chave is not null then
    select id into v_id from public.job_queue
      where tipo=p_tipo and chave=p_chave and status in ('pending','running','retry') limit 1;
    if v_id is not null then return v_id; end if;
  end if;
  insert into public.job_queue (tipo, chave, payload, priority)
    values (p_tipo, p_chave, coalesce(p_payload,'{}'::jsonb), p_priority)
    returning id into v_id;
  return v_id;
end $$;

-- reivindicar em lote (SKIP LOCKED)
create or replace function public.jq_claim(p_worker text, p_batch int default 10)
returns setof public.job_queue language plpgsql security definer set search_path to 'public' as $$
begin
  return query
  update public.job_queue q set
    status='running', claimed_at=now(), claimed_by=p_worker,
    attempt_count=q.attempt_count+1, updated_at=now()
  where q.id in (
    select id from public.job_queue
    where status in ('pending','retry') and run_after<=now()
    order by priority asc, run_after asc
    for update skip locked
    limit greatest(p_batch,1)
  )
  returning q.*;
end $$;

-- concluir com sucesso
create or replace function public.jq_complete(p_id uuid)
returns void language sql security definer set search_path to 'public' as $$
  update public.job_queue set status='success', completed_at=now(), updated_at=now(), last_error=null where id=p_id;
$$;

-- falhar: retry com backoff exponencial, ou dead_letter no teto (nunca descarta)
create or replace function public.jq_fail(p_id uuid, p_err text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_att int; v_max int; v_new text;
begin
  select attempt_count, max_attempts into v_att, v_max from public.job_queue where id=p_id;
  if v_att >= v_max then v_new := 'dead_letter';
  else v_new := 'retry'; end if;
  update public.job_queue set
    status=v_new, last_error=left(coalesce(p_err,''),2000), updated_at=now(),
    run_after = case when v_new='retry' then now() + (interval '30 seconds') * power(2, least(v_att,8)) else run_after end,
    claimed_at=null, claimed_by=null
  where id=p_id;
  return v_new;
end $$;

-- =====================================================================
-- Rollback: drop function jq_enqueue,jq_claim,jq_complete,jq_fail; drop table job_queue;
-- =====================================================================
