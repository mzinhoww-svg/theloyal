// gravacao-tier1.mjs — plano de GRAVAÇÃO da coleta TIER 1 em produção
// (SPEC-SLICE-COLETA-TIER1-PRODUCAO.md §1.2). PURO, sem I/O.
//
// Reusa `decisaoNoLimiar` de coleta-tier1.mjs (INV-12: importa, nunca forka) —
// este módulo só TRADUZ a decisão textual do gate em um PLANO DE ESCRITA
// concreto (linhas a upsert/insert), que o runner de produção (rodar-producao.mjs)
// executa. Não decide nada que decisaoNoLimiar não decida; só monta o payload.
//
// Achado ao construir esta camada: o golden existente de coleta-tier1.test.mjs
// ("ajuste sempre a revisao") já testa que `corrobora_com_ajuste` vai SEMPRE
// para revisão humana, mesmo com confiança 1.0 — não é um caso de auto-escrita,
// mesmo que a spec desta slice tenha citado "separar por público automático"
// como possibilidade. Este módulo respeita o comportamento JÁ TESTADO
// (decisaoNoLimiar), não o reescreve — dado/código vence resumo de spec (D-043).
import { decisaoNoLimiar } from './coleta-tier1.mjs';

// Limiar cravado pelo operador nesta rodada (SPEC-SLICE-COLETA-TIER1-PRODUCAO.md §2.1).
export const LIMIAR_PRODUCAO = 0.75;

// Domínio fechado de ações possíveis (espelha o espaço de saída de decisaoNoLimiar).
export const ACOES = Object.freeze(['grava_tier1', 'refuta', 'revisao']);

// Novo valor de override (aditivo — sem CHECK constraint no banco, confirmado).
export const OVERRIDE_REFUTADO_TIER1 = 'refutado_tier1';

const PAPEL = Object.freeze({
  confirmacao: 'confirmacao_oficial',
  refutacao: 'refutacao_oficial',
  revisao: 'revisao_pendente',
});

const EVENTO = Object.freeze({
  confirmacao: 'confirmacao_tier1',
  refutacao: 'refutado_confirmacao_tier1',
});

/**
 * Traduz a avaliação de UMA viva (saída de avaliarViva, de coleta-tier1.mjs) em
 * um plano de gravação. Não executa nada — devolve o que gravar.
 * @param {object} item  saída de avaliarViva({viva, oficial, resp}).
 * @param {object} opts  { limiar = LIMIAR_PRODUCAO, hoje = 'YYYY-MM-DD', origem = 'coleta-tier1-producao' }
 * @returns {{acao:string, campaignsUpdate:object|null, campanhaFontesRow:object, campanhaVersoesRow:object|null}}
 */
export function planoDeGravacao(item, opts = {}) {
  const limiar = opts.limiar ?? LIMIAR_PRODUCAO;
  const hoje = opts.hoje ?? new Date().toISOString().slice(0, 10);
  const origem = opts.origem ?? 'coleta-tier1-producao';

  const decisao = decisaoNoLimiar(item.confianca, item.resultado, limiar);

  const payloadBase = {
    status_coleta: item.status_coleta, motivo: item.motivo, resultado: item.resultado,
    confianca: item.confianca, breakdown: item.breakdown, janela: item.janela,
    escala: item.escala, via: item.via, decisao_no_limiar: decisao, limiar_usado: limiar,
  };

  // ── auto: publica (3 portoes) — corrobora_limpo + confianca >= limiar ──
  if (decisao === 'auto: publica (3 portoes)') {
    return {
      acao: 'grava_tier1',
      campaignsUpdate: { tier: 1 },
      campanhaFontesRow: {
        campaign_id: item.id, noticia_url: item.url_oficial ?? null, tier: 1,
        papel: PAPEL.confirmacao, verificado_em: hoje, payload: payloadBase,
      },
      campanhaVersoesRow: {
        campaign_id: item.id, evento: EVENTO.confirmacao,
        payload_antes: { tier: null }, payload_depois: { tier: 1 }, origem,
      },
    };
  }

  // ── auto: remove/rebaixa (firmeza) — refuta + confianca >= limiar ──
  if (decisao === 'auto: remove/rebaixa (firmeza)') {
    return {
      acao: 'refuta',
      // Mantém tl_score_bruto como está (só a v14-conta_nao_calculavel/D-050.1
      // zera bruto — este é um override novo e distinto; recomputar o score
      // sobre o termo oficial corrigido é trabalho manual, como no caso
      // livelo->azul, não automatizado nesta slice).
      campaignsUpdate: { veredito_bruto: 'Não confirmado', override_aplicado: OVERRIDE_REFUTADO_TIER1 },
      campanhaFontesRow: {
        campaign_id: item.id, noticia_url: item.url_oficial ?? null, tier: null,
        papel: PAPEL.refutacao, verificado_em: hoje, payload: payloadBase,
      },
      campanhaVersoesRow: {
        campaign_id: item.id, evento: EVENTO.refutacao,
        payload_antes: { veredito_bruto: item.veredito_bruto_atual ?? null, override_aplicado: item.override_aplicado_atual ?? null },
        payload_depois: { veredito_bruto: 'Não confirmado', override_aplicado: OVERRIDE_REFUTADO_TIER1 },
        origem,
      },
    };
  }

  // ── revisão (ajuste, nao_verificavel, ou abaixo do limiar) — nunca escreve em campaigns ──
  return {
    acao: 'revisao',
    campaignsUpdate: null,
    campanhaFontesRow: {
      campaign_id: item.id, noticia_url: item.url_oficial ?? null, tier: null,
      papel: PAPEL.revisao, verificado_em: hoje, payload: payloadBase,
    },
    campanhaVersoesRow: null,
  };
}
