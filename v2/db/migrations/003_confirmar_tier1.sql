-- =====================================================================
-- Migration 003 — confirmar_tier1: confirmação de fonte oficial INCREMENTAL
-- =====================================================================
-- Registra fonte TIER 1 numa campanha, gera evento em campanha_versoes e
-- PROMOVE o estado da campanha — sem rebuild da base (diretriz do operador).
-- Cobre a regra interina D-003 (confirmação manual no admin) ponta a ponta,
-- destravando a elegibilidade a Deal Desk sem depender de adapters.
-- =====================================================================

create or replace function public.confirmar_tier1(
  p_campaign_id text,
  p_url text,
  p_verificado_em date default (now() at time zone 'America/Sao_Paulo')::date,
  p_papel text default 'confirmacao_oficial'
) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_ident uuid; v_estado_antigo text; v_estado_novo text; v_vfd date; v_vconf boolean; v_ja boolean;
begin
  select identidade_id, estado, vigencia_fim_date, vigencia_confiavel
    into v_ident, v_estado_antigo, v_vfd, v_vconf
    from public.campaigns where id = p_campaign_id;
  if not found then return jsonb_build_object('erro','campanha nao encontrada'); end if;

  -- idempotência: já existe fonte tier1 com essa url nesta campanha?
  select exists(select 1 from public.campanha_fontes
    where campaign_id=p_campaign_id and tier=1 and noticia_url=p_url) into v_ja;

  if not v_ja then
    insert into public.campanha_fontes (identidade_id, campaign_id, noticia_url, tier, papel, verificado_em)
      values (v_ident, p_campaign_id, p_url, 1, p_papel, p_verificado_em);
  end if;

  -- promoção de estado incremental: agora tem_tier1=true (detectada -> ativa, etc.)
  v_estado_novo := public.derivar_estado_vigencia(v_vfd, v_vconf, true, (now() at time zone 'America/Sao_Paulo')::date);
  if v_estado_novo is distinct from v_estado_antigo then
    update public.campaigns set estado=v_estado_novo where id=p_campaign_id;
  end if;

  -- evento (só se houve confirmação nova ou mudança de estado — não duplica)
  if (not v_ja) or (v_estado_novo is distinct from v_estado_antigo) then
    insert into public.campanha_versoes (identidade_id, campaign_id, evento, payload_antes, payload_depois, origem)
      values (v_ident, p_campaign_id, 'confirmacao_tier1',
        jsonb_build_object('estado', v_estado_antigo),
        jsonb_build_object('estado', v_estado_novo, 'tier1_url', p_url, 'verificado_em', p_verificado_em, 'papel', p_papel),
        'admin');
  end if;

  return jsonb_build_object('campaign_id', p_campaign_id,
    'estado_antes', v_estado_antigo, 'estado_depois', v_estado_novo,
    'fonte_tier1_nova', not v_ja, 'promoveu', v_estado_novo is distinct from v_estado_antigo);
end $$;
