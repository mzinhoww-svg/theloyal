-- =====================================================================
-- Migration 010 — criar_campanha_tier1: nascimento de campanha já TIER 1 (D-033)
-- =====================================================================
-- ADITIVA e IDEMPOTENTE. NÃO aplicada ainda (só escrita/validada) — decisão
-- da slice do matcher URL→campanha. Numeração 009: na base 006 é lacuna
-- (tl_score_engine vive em outra trilha) e 007/008 já existem.
--
-- Por que existe: `confirmar_tier1` (003) só REGISTRA fonte numa campanha que
-- JÁ existe — não cria a campanha nem a identidade. O matcher (D-033) tem dois
-- caminhos: confirmar campanha existente (003 basta) OU, quando a rota oficial
-- não tem campanha, NASCER a campanha já confirmada TIER 1, sem ficar órfã.
-- Este segundo caminho precisa inserir identidade + campanha + fonte + evento
-- atomicamente e de forma idempotente — daí esta função.
--
-- Reuso: a promoção de estado e o evento de confirmação vêm de
-- `confirmar_tier1` (003); a FSM vem de `derivar_estado_vigencia` (001);
-- a evidência de proveniência vai para `campanha_fontes.payload` (008/D-034).
-- Nada aqui altera scoring, gate, vigência ou as migrations 001–008.
-- =====================================================================

create or replace function public.criar_campanha_tier1(
  p_identidade jsonb,   -- {tipo, origem_code, destino_code, publico, identity_key}
  p_payload jsonb,      -- {origem_bruto,destino_bruto,lado_unico,bucketed,vigencia_fim,
                        --  vigencia_fim_date,vigencia_confiavel,percentual,url,titulo,slug,papel}
  p_url text,
  p_verificado_em date default (now() at time zone 'America/Sao_Paulo')::date
) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_key      text := p_identidade->>'identity_key';
  v_ident    uuid;
  v_campaign text;
  v_vfd      date;
  v_vconf    boolean;
  v_estado   text;
  v_existing text;
  v_confirm  jsonb;
begin
  if v_key is null or p_url is null then
    return jsonb_build_object('erro','identity_key ou url ausente');
  end if;

  -- 1. identidade canônica — idempotente por identity_key (unique em 001).
  insert into public.campanha_identidade (tipo, origem_code, destino_code, publico, identity_key)
    values (
      p_identidade->>'tipo', p_identidade->>'origem_code', p_identidade->>'destino_code',
      coalesce(p_identidade->>'publico','geral'), v_key)
    on conflict (identity_key) do nothing;
  select id into v_ident from public.campanha_identidade where identity_key = v_key;

  -- 2. idempotência do nascimento: já existe campanha nascida desta rota oficial?
  --    (mesma identidade + mesma url TIER 1). Se sim, no-op — não duplica.
  select campaign_id into v_existing
    from public.campanha_fontes
    where identidade_id = v_ident and tier = 1 and noticia_url = p_url
    order by criado_em limit 1;
  if v_existing is not null then
    return jsonb_build_object('campaign_id', v_existing, 'identidade_id', v_ident,
      'criada', false, 'idempotente', true);
  end if;

  -- 3. nova campanha. Estado inicial SEM tier1 (pré-confirmação); confirmar_tier1
  --    promove logo abaixo (detectada -> ativa etc.), gerando a trilha de evento.
  v_vfd    := nullif(p_payload->>'vigencia_fim_date','')::date;
  v_vconf  := coalesce((p_payload->>'vigencia_confiavel')::boolean, false);
  v_estado := public.derivar_estado_vigencia(v_vfd, v_vconf, false);
  v_campaign := 'tl_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.campaigns (
    id, origem, destino, tipo, status,
    percentual, vigencia_fim, source_url, tier, origin,
    identidade_id, origem_code, destino_code, publico,
    origem_bruto, destino_bruto, lado_unico, bucketed,
    vigencia_fim_date, vigencia_confiavel, estado, canonicalizado_em,
    first_seen, observed_at, created_at
  ) values (
    v_campaign,
    p_identidade->>'origem_code', p_identidade->>'destino_code', p_identidade->>'tipo', v_estado,
    nullif(p_payload->>'percentual','')::numeric, p_payload->>'vigencia_fim', p_url, 1, 'tier1',
    v_ident, p_identidade->>'origem_code', p_identidade->>'destino_code', coalesce(p_identidade->>'publico','geral'),
    p_payload->>'origem_bruto', p_payload->>'destino_bruto',
    coalesce((p_payload->>'lado_unico')::boolean, false), coalesce((p_payload->>'bucketed')::boolean, false),
    v_vfd, v_vconf, v_estado, now(),
    p_verificado_em, p_verificado_em, now()
  );

  -- 4. confirma a fonte TIER 1 — REUSO de 003 (insere fonte, promove estado,
  --    grava evento confirmacao_tier1). Idempotente por (campaign,url,tier1).
  v_confirm := public.confirmar_tier1(
    v_campaign, p_url, p_verificado_em, coalesce(p_payload->>'papel','confirmacao_oficial'));

  -- 5. evidência de proveniência na fonte recém-criada (D-034 / 008).
  update public.campanha_fontes
     set payload = p_payload
   where campaign_id = v_campaign and tier = 1 and noticia_url = p_url;

  -- 6. evento de NASCIMENTO — distinto da confirmação incremental (event sourcing).
  insert into public.campanha_versoes
      (identidade_id, campaign_id, evento, payload_antes, payload_depois, origem)
    values (v_ident, v_campaign, 'nascimento_tier1', null,
      jsonb_build_object('identity_key', v_key, 'url', p_url, 'estado', v_estado,
        'nasceu_confirmada', true, 'verificado_em', p_verificado_em),
      'matcher');

  return jsonb_build_object('campaign_id', v_campaign, 'identidade_id', v_ident,
    'criada', true, 'estado', v_estado, 'confirmacao', v_confirm);
end $$;

-- =====================================================================
-- Rollback (referência; não executar junto):
--   drop function if exists public.criar_campanha_tier1(jsonb,jsonb,text,date);
-- =====================================================================
