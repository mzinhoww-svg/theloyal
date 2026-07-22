-- =====================================================================
-- Migration 021 — RLS nas tabelas internas expostas à anon key (F3 · segurança).
--
-- POR QUÊ (advisor Supabase, nível ERROR `rls_disabled_in_public`): 13 tabelas
-- em `public` estavam com RLS DESLIGADO — expostas via PostgREST à ANON key.
-- Incluía `daily_sends` (a trava de envio C2 podia ser forjada de fora),
-- `llm_jobs` (telemetria/custo), `custo_base_moeda`/`custo_base_ratio`,
-- `model_registry` (preços), `derivacao_config`, backups e filas.
--
-- POSTURA: nenhuma dessas é superfície PÚBLICA (a página lê `campaigns`, que já
-- tem RLS, e `vw_ofertas_vivas`). São todas internas → **anon SEM acesso**.
--
-- COMO NÃO QUEBRA O RUNNER: o runner (`daily.mjs`) e as edge functions usam a
-- **service_role key**, que tem BYPASSRLS — logo lê/grava tudo independentemente
-- de policy. A policy explícita `TO service_role` documenta a intenção e limpa o
-- lint `rls_enabled_no_policy`; anon/authenticated caem no default-deny (sem
-- policy que os autorize). Efeito: service_role intacto, anon bloqueado.
--
-- Aditiva/idempotente (enable RLS é no-op se já ligado; policy com nome fixo é
-- recriada via drop-if-exists). Não toca dado.
-- =====================================================================

do $$
declare
  t text;
  internas text[] := array[
    'campaigns_bkp_prev2_20260716',
    'tl_ruido', 'tl_generico', 'tl_tipo_map',
    'rejeicoes', 'motivos_rejeicao',
    'derivacao_config', 'custo_base_moeda', 'custo_base_ratio',
    'llm_jobs', 'model_registry',
    'daily_sends', 'daily_outcomes'
  ];
begin
  foreach t in array internas loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', 'svc_role_full', t);
    -- service_role já bypassa RLS; a policy explícita documenta e limpa o lint.
    -- anon/authenticated ficam sem policy → default-deny (sem acesso).
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true);',
      'svc_role_full', t
    );
  end loop;
end $$;
