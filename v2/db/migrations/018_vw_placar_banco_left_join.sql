-- =====================================================================
-- Migration 018 — vw_placar_rota / vw_banco_programa: INNER→LEFT JOIN na
-- triagem, para campanha NÃO TRIADA contar no placar histórico. A3 · M2.7.
--
-- POR QUÊ. As duas views do placar faziam INNER JOIN LATERAL em
-- `campanha_versoes.evento='triagem_backlog_m3'` (a triagem única do #109).
-- `triagem_backlog_m3` foi um evento de PONTO NO TEMPO — item ingerido DEPOIS
-- dele nunca recebe essa linha, então o INNER JOIN o descartava do placar PARA
-- SEMPRE. O placar histórico (não é superfície pública; é panorama por rota/
-- programa) ficava congelado no universo triado uma vez, cego a tudo que chegou
-- depois. Diferente da vw_ofertas_vivas (C3/017), que é PÚBLICA e por design
-- esconde o não confirmado (INV-03): ali o INNER é correto; aqui, não.
--
-- REGRA (explícita, não implícita pela ausência de linha). LEFT JOIN LATERAL +
-- `coalesce(t.categoria,'sem_triagem') <> 'revisao'`: quem não tem triagem
-- ('sem_triagem') CONTA; só `revisao` (bônus alto ainda não confirmado, D-060)
-- fica de fora. A decisão de excluir é o valor da coluna, não o azar de existir
-- ou não uma linha de um evento antigo. Nada é reclassificado nem escrito.
--
-- Aditiva (só redefine duas views; não toca tabela nem dado). Idempotente
-- (create or replace).
-- =====================================================================

create or replace view public.vw_placar_rota as
select
  c.origem_code,
  c.destino_code,
  count(*) as n_janelas,
  min(c.percentual) filter (where c.percentual is not null) as pct_min,
  max(c.percentual) filter (where c.percentual is not null) as pct_max,
  round(percentile_cont(0.5) within group (order by c.percentual::double precision)
    filter (where c.percentual is not null)::numeric, 0) as pct_mediana,
  max(c.vigencia_fim_date) filter (where c.vigencia_confiavel) as teto_datado_ate,
  max(c.percentual) filter (where c.percentual is not null and c.vigencia_confiavel) as teto_historico
from public.campaigns c
left join lateral (
  select v.payload_depois->>'categoria' as categoria
  from public.campanha_versoes v
  where v.campaign_id = c.id
    and v.evento = 'triagem_backlog_m3'
  order by v.em desc
  limit 1
) t on true
where coalesce(t.categoria, 'sem_triagem') <> 'revisao'
  and c.origem_code is not null
  and c.destino_code is not null
  and c.destino_code <> 'sem_destino'
group by c.origem_code, c.destino_code;

create or replace view public.vw_banco_programa as
select
  c.origem_code as programa,
  count(*) as n_campanhas,
  count(*) filter (where c.estado = any (array['ativa','detectada','ultimos_dias'])) as n_vivas,
  max(c.percentual) filter (where c.percentual is not null) as pct_max,
  round(percentile_cont(0.5) within group (order by c.percentual::double precision)
    filter (where c.percentual is not null)::numeric, 0) as pct_mediana,
  max(c.vigencia_fim_date) filter (where c.estado = any (array['ativa','detectada','ultimos_dias'])) as proxima_vigencia
from public.campaigns c
left join lateral (
  select v.payload_depois->>'categoria' as categoria
  from public.campanha_versoes v
  where v.campaign_id = c.id
    and v.evento = 'triagem_backlog_m3'
  order by v.em desc
  limit 1
) t on true
where coalesce(t.categoria, 'sem_triagem') <> 'revisao'
  and c.origem_code is not null
group by c.origem_code;

comment on view public.vw_placar_rota is
  'Placar histórico por rota (origem→destino). LEFT JOIN na triagem_backlog_m3: não-triado conta, só revisao fica de fora (A3/018). Diferente de vw_ofertas_vivas (pública, INNER).';
comment on view public.vw_banco_programa is
  'Placar histórico por programa de origem. LEFT JOIN na triagem_backlog_m3: não-triado conta, só revisao fica de fora (A3/018).';
