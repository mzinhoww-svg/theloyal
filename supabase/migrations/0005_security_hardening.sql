-- P0 — Correções de segurança apontadas pelos advisors do Supabase.
-- Contexto: toda escrita (campaigns, runs, pipeline) e toda leitura do admin
-- acontecem via SERVICE key (server-only). As policies anônimas de escrita e o
-- EXECUTE público das funções admin eram, portanto, exposição indevida.

-- 1) Escrita anônima removida. SELECT anônimo (site público + CLI de forecast)
--    permanece intacto; só UPDATE/INSERT anônimos são fechados.
drop policy if exists anon_upd_campaigns on public.campaigns;
drop policy if exists anon_ins_runs on public.runs;

-- 2) Funções admin: os grants a anon/authenticated eram EXPLÍCITOS (não via
--    PUBLIC), então é preciso revogar deles diretamente. service_role mantém o
--    EXECUTE (é como o admin as chama, server-side).
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.admin_metrics()',
    'public.admin_list_jobs()',
    'public.admin_backfill_progress()',
    'public.admin_recent_runs(integer)',
    'public.admin_run_now(text)',
    'public.admin_toggle_job(text, boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- 3) Views admin: passam a respeitar RLS do chamador (security_invoker). O admin
--    lê via service_role (bypassa RLS) — sem impacto; anon deixa de ver dados.
alter view public.campaigns_para_revisar set (security_invoker = on);
alter view public.backfill_dashboard    set (security_invoker = on);
alter view public.shopping_sku_latest_v set (security_invoker = on);

-- 4) search_path fixo na função de backfill (evita resolução mutável de schema).
alter function public.backfill_from_sitemap(text, text) set search_path = public;
