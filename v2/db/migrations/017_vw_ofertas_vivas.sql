-- =====================================================================
-- Migration 017 — vw_ofertas_vivas: ofertas vivas TRIADAS para a página PÚBLICA
-- /promocoes (seção "Ofertas ativas"). C3 · M2.7.
--
-- POR QUÊ. A página lia `campaigns` direto (estado vivo + percentual não-nulo),
-- SEM o filtro de triagem da Trilha B (#109). Isso surfacializava, no topo de uma
-- página pública e por percentual, itens `categoria=revisao` (bônus alto ainda
-- não confirmado) e itens NÃO TRIADOS — ambos = "não confirmado" (INV-03). Um
-- bônus de teto sem confirmação no topo do site é exatamente o que a regra-mãe
-- proíbe: a imagem é dado, e dado não confirmado não vira manchete pública.
--
-- REGRA (idêntica à triagem da Trilha B). Só entram estados vivos
-- (ativa/detectada/ultimos_dias), com percentual, cuja ÚLTIMA triagem
-- (`campanha_versoes.evento='triagem_backlog_m3'`) seja `limpo` ou
-- `historico_confirmado`. O JOIN LATERAL é INNER: item sem triagem (não triado)
-- não tem linha → fica DE FORA (INV-03, não confirmado). `revisao` é excluído
-- pelo filtro de categoria. Nada é reclassificado nem descartado do banco — a
-- view só ESCONDE do público o não confirmado (D-060: flag é revisão, não some).
--
-- Aditiva (só cria uma view; não toca tabela nem dado). Idempotente
-- (create or replace).
-- =====================================================================

create or replace view public.vw_ofertas_vivas as
select
  c.id,
  c.origem_code,
  c.destino_code,
  c.tipo,
  c.percentual,
  c.vigencia_fim_date,
  c.estado,
  t.categoria as triagem_categoria
from public.campaigns c
join lateral (
  select cv.payload_depois->>'categoria' as categoria
  from public.campanha_versoes cv
  where cv.campaign_id = c.id
    and cv.evento = 'triagem_backlog_m3'
  order by cv.em desc
  limit 1
) t on true
where c.estado in ('ativa', 'detectada', 'ultimos_dias')
  and c.percentual is not null
  and t.categoria in ('limpo', 'historico_confirmado');

comment on view public.vw_ofertas_vivas is
  'Ofertas vivas TRIADAS (limpo/historico_confirmado) para a página pública /promocoes. Exclui revisao e não-triado (INV-03: não confirmado não vai ao público). Fonte de triagem: campanha_versoes evento=triagem_backlog_m3 (Trilha B, #109).';
