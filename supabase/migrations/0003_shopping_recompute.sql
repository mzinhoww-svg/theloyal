-- Função de recomputação do Radar de VPM (backend): métricas (obs sem métrica),
-- comparações por SKU e benchmarks por categoria/programa, a partir da
-- observação mais recente por (produto,programa). Chamada pelo admin e pós-coleta.
-- (Corpo idêntico ao aplicado no Supabase via migração shopping_recompute_fn.)
create or replace function public.shopping_recompute(p_ref_date date default (now() at time zone 'America/Sao_Paulo')::date)
returns jsonb language plpgsql security definer set search_path = public as $$
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
  order by o.product_id, o.program_code, o.captured_at desc;

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
end $$;
revoke all on function public.shopping_recompute(date) from public, anon, authenticated;
