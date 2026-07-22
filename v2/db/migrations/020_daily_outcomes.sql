-- =====================================================================
-- Migration 020 — daily_outcomes: outcomes-ledger (pré-requisito INVIOLÁVEL da
-- calibração do limiar de confiança, D-048/D-067.2/D-202). GAMMA · M2.7.
--
-- POR QUÊ (ordem travada, HANDOFF §1 / D-202): o auto-ajuste do gate de confiança
-- (D-048) e o predict frequencial ficam BLOQUEADOS por ausência de ledger de
-- desfechos. O ledger tem de EXISTIR e CAPTURAR desde o dia 1 da contagem — quem o
-- constrói depois perde o histórico dos primeiros dias, justo quando o limiar 0,75
-- mais precisa aprender. Sem ledger capturando, autopublish autônomo (Nível 2)
-- NÃO liga.
--
-- REGRA-MÃE (determinismo, regra 8 + INV-03): o ledger **CAPTURA** desfecho, nunca
-- calcula nem prediz. Os 5 sinais de D-048 são LIDOS da confirmação já gravada
-- (`campanha_fontes.payload.breakdown`), não recomputados. Os campos de DESFECHO
-- são nullable — preenchidos DEPOIS, quando o desfecho for conhecido; **nunca
-- chutados** (null ≠ 0). A ação humana é registrada quando o operador aprova por
-- 1-clique; até lá, null.
--
-- MODELO: uma linha por (edição, item surfaceado). `item_key` estável garante
-- idempotência (remontar a mesma edição faz upsert, não duplica).
--
-- Aditiva: cria tabela + view; não toca nada existente. Idempotente.
-- =====================================================================

create table if not exists public.daily_outcomes (
  id                    bigint generated always as identity primary key,

  -- Identidade da edição + do item surfaceado
  edition_date          date not null,
  edition_number        int,
  section               text not null,   -- deals|ofertas_ativas|fecha_logo|cartoes_bancos|clipping|sinal
  item_key              text not null,   -- chave estável do item (campaign_id | route_key | ref)
  campaign_id           text,
  route_key             text,

  -- O que foi MOSTRADO (snapshot da montagem — o que o leitor viu)
  veredito              text,            -- veredito exibido (kebab: vale-agir|vale-olhar|...)
  tl_score              numeric,
  banda                 text,            -- banda semântica do TL Score exibida

  -- Os 5 sinais objetivos de D-048 (booleans) — LIDOS de campanha_fontes.payload,
  -- nunca recomputados. null = não havia confirmação para capturar (INV-03).
  sinal_fonte_oficial          boolean,
  sinal_janela_vigencia_clara  boolean,
  sinal_estado_vivo_200        boolean,
  sinal_publico_inequivoco     boolean,
  sinal_termos_legiveis        boolean,
  confianca_confirmacao        numeric,  -- score [0,1] capturado (não recalcula)
  resultado_confirmacao        text,     -- corrobora_limpo|corrobora_com_ajuste|refuta|nao_verificavel

  -- AÇÃO HUMANA na revisão (preenchida no 1-clique; null até acontecer)
  acao_humana           text,            -- aprovado_1clique|corrigido|rejeitado
  acao_humana_motivo    text,
  acao_humana_em        timestamptz,

  -- DESFECHO quando conhecido (nullable — preenchido depois, NUNCA chutado)
  desfecho              text,            -- confirmou_real|venceu|mudou
  desfecho_detalhe      text,
  desfecho_em           timestamptz,
  desfecho_fonte        text,

  -- Proveniência da captura
  capturado_em          timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),

  constraint daily_outcomes_uk unique (edition_date, section, item_key),
  constraint daily_outcomes_section_ck check (
    section in ('deals','ofertas_ativas','fecha_logo','cartoes_bancos','clipping','sinal')
  ),
  constraint daily_outcomes_acao_ck check (
    acao_humana is null or acao_humana in ('aprovado_1clique','corrigido','rejeitado')
  ),
  constraint daily_outcomes_desfecho_ck check (
    desfecho is null or desfecho in ('confirmou_real','venceu','mudou')
  ),
  constraint daily_outcomes_resultado_ck check (
    resultado_confirmacao is null or resultado_confirmacao in
      ('corrobora_limpo','corrobora_com_ajuste','refuta','nao_verificavel')
  )
);

comment on table public.daily_outcomes is
  'Outcomes-ledger (D-048/D-202): uma linha por item surfaceado por edição. CAPTURA o que foi mostrado + os 5 sinais de D-048 (lidos de campanha_fontes) + ação humana do 1-clique + desfecho real (nullable, preenchido depois, nunca chutado). Pré-requisito de ligar autopublish autônomo.';

create index if not exists daily_outcomes_edition_idx on public.daily_outcomes (edition_date);
create index if not exists daily_outcomes_campaign_idx on public.daily_outcomes (campaign_id);
create index if not exists daily_outcomes_calib_idx on public.daily_outcomes (confianca_confirmacao)
  where confianca_confirmacao is not null and desfecho is not null;

-- ---------------------------------------------------------------------
-- Leitura para a CALIBRAÇÃO (mede-e-propõe; NÃO grava). Projeta só o que dá para
-- medir: item com sinal de confiança capturado E desfecho conhecido. Expõe os
-- ingredientes do accuracy-loop de D-048 (confiança vs limiar 0,75, ação humana,
-- desfecho real) + um `acerto_automatico` DEFAULT deterministico que a calibração
-- pode aceitar ou recomputar. O limiar 0,75 é constante aqui (start conservador,
-- D-050) — a calibração o move medindo esta view, nunca o contrário.
-- ---------------------------------------------------------------------
create or replace view public.vw_calibracao_limiar as
select
  o.id,
  o.edition_date,
  o.campaign_id,
  o.route_key,
  o.confianca_confirmacao,
  o.resultado_confirmacao,
  0.75::numeric as limiar_vigente,
  (o.confianca_confirmacao >= 0.75) as publicaria_no_limiar,
  o.acao_humana,
  (o.acao_humana in ('corrigido','rejeitado')) as humano_reverteu,
  o.desfecho,
  -- acerto DEFAULT (documentado; a calibração pode redefinir): se publicaríamos no
  -- limiar, acertamos sse o humano NÃO reverteu e o desfecho confirmou real; se
  -- seguraríamos para revisão, segurar acertou se o humano reverteu OU o desfecho
  -- não confirmou real. Simétrico, sem chutar (só linhas com desfecho conhecido).
  case
    when o.confianca_confirmacao >= 0.75
      then (o.acao_humana is distinct from 'corrigido'
            and o.acao_humana is distinct from 'rejeitado'
            and o.desfecho = 'confirmou_real')
    else (o.acao_humana in ('corrigido','rejeitado') or o.desfecho <> 'confirmou_real')
  end as acerto_automatico
from public.daily_outcomes o
where o.confianca_confirmacao is not null
  and o.desfecho is not null;

comment on view public.vw_calibracao_limiar is
  'Leitura da calibração do limiar 0,75 (D-048) sobre desfechos reais do daily_outcomes. Só itens com confiança capturada E desfecho conhecido (mede o que dá, INV-03). Expõe publicaria_no_limiar × humano_reverteu × desfecho + acerto_automatico default. A calibração MEDE-e-propõe; não grava.';
