// Engine de seleção do Digest (M2 · Digest Engine, SPEC-SLICE-DIGEST-ENGINE.md §1).
// PURO, sem I/O — recebe linhas já lidas de `campaigns` (shape das colunas reais:
// id, tipo, origem_code, destino_code, publico, estado, tier, tl_score_bruto,
// veredito_bruto, override_aplicado, vigencia_fim, first_seen). Recomputa os
// portões no momento da montagem — nunca confia em flag "é Deal Desk" pré-gravada
// (§1.1). Determinismo-primeiro (INV-12): mesmo array de entrada → mesma seleção.

// Estados que contam como "vivo" (D-044). Nomeado para reuso/legibilidade —
// não é um enum do banco, é o filtro que o Digest Engine aplica.
export const TRES_PORTOES = {
  estadosVivo: ['ativa', 'detectada', 'ultimos_dias'],
};

// Vereditos brutos que cruzam o corte de Deal Desk (D-050 decisão 1). "Só para
// casos específicos" e abaixo NUNCA é card de estreia, mesmo vivo/TIER1/com conta.
const VEREDITOS_DEAL_DESK = new Set(['Vale agir', 'Vale olhar']);

/**
 * Os três portões do D-044: estado vivo + TIER 1 confirmado + conta computável.
 * Passar aqui torna o item elegível à listagem geral — NÃO ao Deal Desk (§1.2).
 * @param {object} campaign  linha de `campaigns`
 * @returns {boolean}
 */
export function passaTresPortoes(campaign) {
  if (!campaign) return false;
  const estadoVivo = TRES_PORTOES.estadosVivo.includes(campaign.estado);
  const tier1 = Number(campaign.tier) === 1;
  const contaComputavel = campaign.tl_score_bruto !== null && campaign.tl_score_bruto !== undefined;
  return estadoVivo && tier1 && contaComputavel;
}

/**
 * Corte de Deal Desk (§1.2): 3 portões + veredito ∈ {Vale agir, Vale olhar}.
 * @param {object} campaign
 * @returns {boolean}
 */
export function elegivelDealDesk(campaign) {
  if (!passaTresPortoes(campaign)) return false;
  return VEREDITOS_DEAL_DESK.has(campaign.veredito_bruto);
}

/**
 * Seleciona os elegíveis a Deal Desk: ordena por `tl_score_bruto DESC`, empate
 * quebrado por `vigencia_fim ASC` (o que vence primeiro sobe — §1.3). Cap de 3
 * (D-052/S1-D3) — NUNCA descarta em silêncio: reporta `cortados`.
 * @param {object[]} campaigns
 * @param {{cap?:number}} opts
 * @returns {{selecionados:object[], cortados:number}}
 */
export function selecionarDealDesk(campaigns = [], { cap = 3 } = {}) {
  const elegiveis = campaigns.filter(elegivelDealDesk);
  const ordenados = [...elegiveis].sort((a, b) => {
    const porScore = (b.tl_score_bruto ?? 0) - (a.tl_score_bruto ?? 0);
    if (porScore !== 0) return porScore;
    const va = a.vigencia_fim ? Date.parse(a.vigencia_fim) : Infinity;
    const vb = b.vigencia_fim ? Date.parse(b.vigencia_fim) : Infinity;
    return va - vb; // vence primeiro sobe
  });
  const selecionados = ordenados.slice(0, cap);
  const cortados = Math.max(0, ordenados.length - cap);
  return { selecionados, cortados };
}

/**
 * Fecha Logo (§1.4): eixo independente do Deal Desk — usa urgência
 * (`estado === 'ultimos_dias'`), com ou sem corte de veredito. Pode incluir
 * itens que NÃO qualificam para Deal Desk (ex.: bruto 55 que vence hoje).
 * @param {object[]} campaigns
 * @returns {object[]}
 */
export function selecionarFechaLogo(campaigns = []) {
  return campaigns.filter((c) => c && c.estado === 'ultimos_dias');
}
