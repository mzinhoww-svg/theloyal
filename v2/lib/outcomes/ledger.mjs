// ledger.mjs — outcomes-ledger (GAMMA · D-048/D-202). PURO, sem I/O.
//
// REGRA-MÃE (determinismo, regra 8 + INV-03): este módulo CAPTURA o que foi
// mostrado numa edição e os 5 sinais de D-048 já GRAVADOS na confirmação
// (campanha_fontes) — NUNCA calcula desfecho nem prediz. Os campos de desfecho
// não são preenchidos aqui (ficam null; preenchidos depois, quando conhecidos).
//
// Como captura sem depender do shape editorial do item: re-roda os MESMOS
// seletores determinísticos (selecionar.mjs / ofertas-ativas.mjs) sobre o MESMO
// array `campaigns` que montou a edição. Mesma entrada → mesma seleção (INV-12),
// então reproduz exatamente QUAIS campanhas foram surfaceadas — com o `id` da
// linha, que o item editorial (deal) não carrega. Não é recomputar desfecho; é
// identificar o que já foi mostrado.
import { selecionarDealDesk, passaTresPortoes, selecionarFechaLogo, TRES_PORTOES } from '../digest/selecionar.mjs';
import { ehClippingOnly, BANCOS_ORIGEM } from '../digest/ofertas-ativas.mjs';
import { mapVeredito } from '../digest/mapear-contrato.mjs';

export const SECOES = Object.freeze(['deals', 'ofertas_ativas', 'fecha_logo', 'cartoes_bancos', 'clipping', 'sinal']);
export const ACOES_HUMANAS = Object.freeze(['aprovado_1clique', 'corrigido', 'rejeitado']);
export const DESFECHOS = Object.freeze(['confirmou_real', 'venceu', 'mudou']);

const SINAIS_D048 = Object.freeze([
  'fonte_oficial', 'janela_vigencia_clara', 'estado_vivo_200', 'publico_inequivoco', 'termos_legiveis',
]);

// mapVeredito lança em rótulo desconhecido; na captura NUNCA derrubar — desconhecido
// vira null (INV-03: não chuta). Veredito é o que foi MOSTRADO, capturado tal qual.
function veredictoMostrado(veredito_bruto) {
  try { return mapVeredito(veredito_bruto); } catch { return null; }
}

function routeKey(c) {
  return c?.origem_code && c?.destino_code ? `${c.origem_code}->${c.destino_code}` : null;
}

/**
 * Normaliza UMA linha de campanha_fontes (papel de confirmação) nos 5 sinais de
 * D-048 + confiança + resultado. LÊ o que já foi gravado (payload.breakdown); não
 * recomputa a confiança. Sem fonte/payload → tudo null (não havia o que capturar).
 * @param {object|null} fonte  { payload: { breakdown:[{sinal,presente}], confianca, resultado } }
 * @returns {object} campos sinal_* + confianca_confirmacao + resultado_confirmacao
 */
export function sinaisDaFonte(fonte) {
  const vazio = {
    sinal_fonte_oficial: null, sinal_janela_vigencia_clara: null, sinal_estado_vivo_200: null,
    sinal_publico_inequivoco: null, sinal_termos_legiveis: null,
    confianca_confirmacao: null, resultado_confirmacao: null,
  };
  const p = fonte?.payload;
  if (!p) return vazio;
  const porSinal = {};
  for (const b of Array.isArray(p.breakdown) ? p.breakdown : []) {
    if (b && typeof b.sinal === 'string') porSinal[b.sinal] = b.presente === true;
  }
  const out = { ...vazio };
  for (const s of SINAIS_D048) {
    if (Object.prototype.hasOwnProperty.call(porSinal, s)) out[`sinal_${s}`] = porSinal[s];
  }
  out.confianca_confirmacao = Number.isFinite(Number(p.confianca)) ? Number(p.confianca) : null;
  out.resultado_confirmacao = typeof p.resultado === 'string' ? p.resultado : null;
  return out;
}

// Linha-base de captura (campos de ação humana e desfecho ficam NULL — nunca
// chutados; preenchidos depois pelos fluxos próprios).
function linhaBase({ ed, section, item_key, campaign_id = null, route_key = null, veredito = null, tl_score = null, banda = null, sinais = {} }) {
  return {
    edition_date: ed.date,
    edition_number: ed.number ?? null,
    section,
    item_key,
    campaign_id,
    route_key,
    veredito,
    tl_score,
    banda,
    sinal_fonte_oficial: sinais.sinal_fonte_oficial ?? null,
    sinal_janela_vigencia_clara: sinais.sinal_janela_vigencia_clara ?? null,
    sinal_estado_vivo_200: sinais.sinal_estado_vivo_200 ?? null,
    sinal_publico_inequivoco: sinais.sinal_publico_inequivoco ?? null,
    sinal_termos_legiveis: sinais.sinal_termos_legiveis ?? null,
    confianca_confirmacao: sinais.confianca_confirmacao ?? null,
    resultado_confirmacao: sinais.resultado_confirmacao ?? null,
  };
}

function linhaDeCampanha({ ed, section, c, fontesById }) {
  const veredito = veredictoMostrado(c.veredito_bruto);
  const tl = c.tl_score_bruto == null ? null : Number(c.tl_score_bruto);
  return linhaBase({
    ed, section,
    item_key: c.id,
    campaign_id: c.id,
    route_key: routeKey(c),
    veredito,
    tl_score: Number.isFinite(tl) ? tl : null,
    banda: veredito, // banda semântica exibida = o veredito mostrado (não recalcula)
    sinais: sinaisDaFonte(fontesById?.[c.id] ?? null),
  });
}

/**
 * Constrói as linhas do outcomes-ledger de UMA edição. PURO.
 * @param {object} args
 *   ed          {object}   a edição montada (para date/number/clipping).
 *   campaigns   {object[]} o MESMO array que montou a edição (linhas de campaigns).
 *   fontesById  {object}   map campaign_id -> linha campanha_fontes (confirmação).
 * @returns {object[]} linhas prontas para upsert em daily_outcomes.
 */
export function montarLinhasOutcome({ ed, campaigns = [], fontesById = {} } = {}) {
  if (!ed || !ed.date) throw new Error('montarLinhasOutcome: ed.date obrigatório');
  const rows = [];
  const bancos = new Set(BANCOS_ORIGEM);

  // deals — reproduz o corte de Deal Desk (com cap/ordem).
  for (const c of selecionarDealDesk(campaigns).selecionados) {
    rows.push(linhaDeCampanha({ ed, section: 'deals', c, fontesById }));
  }
  // ofertas_ativas — mesmo predicado do seletor (3 portões, sem clipping-only).
  for (const c of (campaigns || []).filter((c) => passaTresPortoes(c) && !ehClippingOnly(c))) {
    rows.push(linhaDeCampanha({ ed, section: 'ofertas_ativas', c, fontesById }));
  }
  // fecha_logo — urgência (ultimos_dias).
  for (const c of selecionarFechaLogo(campaigns)) {
    rows.push(linhaDeCampanha({ ed, section: 'fecha_logo', c, fontesById }));
  }
  // cartoes_bancos — panorama (vivo + cartao|transferencia de banco), sem clipping-only.
  for (const c of (campaigns || []).filter((c) => {
    if (!c || ehClippingOnly(c)) return false;
    if (!TRES_PORTOES.estadosVivo.includes(c.estado)) return false;
    if (c.tipo === 'cartao') return true;
    return c.tipo === 'transferencia' && bancos.has(c.origem_code);
  })) {
    rows.push(linhaDeCampanha({ ed, section: 'cartoes_bancos', c, fontesById }));
  }
  // clipping — item de news_raw (sem campanha, sem sinais de confiança). Chave = url.
  for (const clip of Array.isArray(ed.clipping) ? ed.clipping : []) {
    if (!clip || !clip.url) continue;
    rows.push(linhaBase({ ed, section: 'clipping', item_key: clip.url }));
  }
  return rows;
}

/**
 * Partial de AÇÃO HUMANA (1-clique). Valida o domínio fechado; nunca inventa.
 * @param {{acao:string, motivo?:string, em?:string}} args
 * @returns {{acao_humana:string, acao_humana_motivo:string|null, acao_humana_em:string}}
 */
export function linhaAcaoHumana({ acao, motivo = null, em } = {}) {
  if (!ACOES_HUMANAS.includes(acao)) {
    throw new Error(`linhaAcaoHumana: acao inválida "${acao}" (esperado ${ACOES_HUMANAS.join('|')})`);
  }
  return { acao_humana: acao, acao_humana_motivo: motivo ?? null, acao_humana_em: em ?? new Date().toISOString() };
}

/**
 * Partial de DESFECHO. Valida o domínio fechado. Só se preenche quando o desfecho
 * REALMENTE aconteceu — este helper não é chamado por nenhum fluxo automático de
 * montagem (regra 8: captura, não prediz).
 * @param {{desfecho:string, detalhe?:string, em?:string, fonte?:string}} args
 */
export function linhaDesfecho({ desfecho, detalhe = null, em, fonte = null } = {}) {
  if (!DESFECHOS.includes(desfecho)) {
    throw new Error(`linhaDesfecho: desfecho inválido "${desfecho}" (esperado ${DESFECHOS.join('|')})`);
  }
  return { desfecho, desfecho_detalhe: detalhe ?? null, desfecho_em: em ?? new Date().toISOString(), desfecho_fonte: fonte ?? null };
}
