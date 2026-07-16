// =====================================================================
// Matcher URL→campanha (M2, slice matcher). Função PURA, determinística.
// D-033: NÃO é um matcher paralelo. A página oficial (payload de
// `adapters/base.mjs::extrairCampanha`) é normalizada para a MESMA
// identidade canônica do M1 e resolvida por `identidade.mjs`
// (`resolverCampanha`/`identityKey`). Casa com a campanha existente pela
// identity_key; se não existe, a campanha NASCE já com fonte TIER 1.
//
// Anti-invenção (INV-16): a normalização só afirma tipo/destino quando há
// evidência na página (título/slug/url) ou campo explícito no payload.
// Sinal fraco ou ambíguo -> REVISÃO (abstém), nunca força match errado —
// mesma filosofia do resto do projeto.
//
// Puro: não toca rede nem banco. A execução real (varredura -> matcher ->
// confirmar_tier1 / criar_campanha_tier1) é a slice B3, com aprovação.
// =====================================================================

import {
  resolverCampanha, resolverTipo, resolverPrograma, identityKey, normalizar,
} from './identidade.mjs';

// Sinais de TIPO a partir de texto curado (título/slug/url). Conservador:
// mapeiam para a palavra-crua que `resolverTipo` (identidade.mjs) canoniza —
// não reimplementamos o mapa de tipos, só detectamos o sinal.
const TIPO_SINAIS = [
  ['transferencia', /transfir|transferenc|\btransfer\b|para[-\s]parceiro|bonus (?:na |de )?transfer/],
  ['status_match', /status[-\s]*match/],
  ['clube', /\bclube\b/],
  ['compra', /\bcompr(?:e|a|ar) (?:de )?(?:pontos|milhas)|comprar pontos/],
  ['shopping', /\bshopping\b/],
  ['pontos_mais_dinheiro', /pontos ?\+ ?dinheiro|dinheiro ?\+ ?pontos|cash ?\+ ?points/],
];

// Detecta a palavra-crua de tipo a partir do texto normalizado da página.
// Retorna null quando nenhum sinal claro existe (-> resolverCampanha abstém).
function derivarTipo(textoNorm) {
  for (const [raw, re] of TIPO_SINAIS) if (re.test(textoNorm)) return raw;
  return null;
}

// Candidatos de destino a partir de slug e do trecho após marcador direcional
// ("... para <destino>"). Resolve cada candidato via resolverPrograma
// (função canônica do M1) e descarta a própria origem. Um único código
// distinto -> destino; mais de um -> ambíguo (revisão); nenhum -> null.
function derivarDestino(payload, origemCode, indices) {
  const cands = new Set();
  const push = (s) => { if (s) cands.add(s); };

  // slug: segmentos individuais (ex.: "smiles/SMLTransfer" -> "smiles").
  for (const seg of String(payload.slug || '').split(/[/_-]+/)) push(seg);

  // título após marcador direcional "para" (evita casar a origem à esquerda).
  const tituloNorm = normalizar(payload.titulo);
  const i = tituloNorm.indexOf(' para ');
  if (i >= 0) push(tituloNorm.slice(i + 6));

  const codigos = new Set();
  for (const c of cands) {
    const code = resolverPrograma(c, indices.aliasMap);
    if (code && code !== origemCode) codigos.add(code);
  }
  if (codigos.size === 1) return { code: [...codigos][0], ambiguo: false, candidatos: [...codigos] };
  if (codigos.size > 1) return { code: null, ambiguo: true, candidatos: [...codigos] };
  return { code: null, ambiguo: false, candidatos: [] };
}

// Normaliza o payload da página oficial -> objeto `campanha` que o M1 consome.
// Campos explícitos no payload (tipo/origem/destino/publico/vigencia_fim) são
// autoritativos; senão derivamos de título/slug/url com evidência.
function normalizarPayload(payload, indices) {
  const origemStr = payload.origem ?? payload.programa ?? '';
  const origemCode = resolverPrograma(origemStr, indices.aliasMap);
  const textoNorm = normalizar([payload.titulo, payload.descricao, payload.slug, payload.url_canonica].filter(Boolean).join(' '));

  const tipoStr = payload.tipo != null ? payload.tipo : derivarTipo(textoNorm);

  let destino = { code: null, ambiguo: false, candidatos: [] };
  if (payload.destino != null) destino = { code: payload.destino, ambiguo: false, candidatos: [payload.destino] };
  else destino = derivarDestino(payload, origemCode, indices);

  const campanha = {
    tipo: tipoStr,
    origem: origemStr,
    destino: destino.code, // string (programa/código) ou null -> regra por tipo no M1
    vigencia_fim: payload.vigencia_fim ?? null,
    tier: 1,
    notes: [payload.titulo, payload.descricao].filter(Boolean).join(' '),
  };
  return { campanha, origemCode, destinoAmbiguo: destino.ambiguo, destinoCandidatos: destino.candidatos };
}

// Evidência de proveniência (-> campanha_fontes.payload jsonb, D-034).
function montarEvidencia(payload) {
  return {
    url: payload.url_canonica || payload.url || null,
    titulo: payload.titulo || null,
    slug: payload.slug || null,
    percentual: payload.percentual ?? null,
    evidencia_percentual: payload.evidencia_percentual || null,
    vigencia_fim: payload.vigencia_fim ?? null,
    tier: 1,
    papel: payload.papel || 'confirmacao_oficial',
    verificado_em: payload.verificado_em ?? null,
  };
}

// Índice identity_key -> [campaign_id] a partir das campanhas existentes.
// Aceita entradas com identity_key pronta ou com {tipo,origem_code,destino_code,publico}.
function indexarExistentes(campanhasExistentes = []) {
  const idx = new Map();
  for (const c of campanhasExistentes) {
    const key = c.identity_key
      || (c.tipo && c.origem_code && c.destino_code
        ? identityKey(c.tipo, c.origem_code, c.destino_code, c.publico || 'geral')
        : null);
    if (!key) continue;
    const id = c.campaign_id ?? c.id;
    if (id == null) continue;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(id);
  }
  return idx;
}

/**
 * Casa uma página oficial (payload TIER 1) com uma campanha canônica.
 * PURA: resolve identidade via M1 e decide confirmar | criar | revisão.
 *
 * @param {object} payloadOficial  saída de extrairCampanha (+ campos semânticos
 *   explícitos opcionais: tipo, origem, destino, publico, vigencia_fim, verificado_em).
 * @param {object} indices  saída de `construirIndices(seed)` (identidade.mjs).
 * @param {Array}  campanhasExistentes  [{identity_key|tipo/origem_code/destino_code/publico, campaign_id|id}]
 * @param {string} [ref]  data de referência (YYYY-MM-DD) para a FSM de vigência.
 * @returns {object}
 *   - {acao:'confirmar', campaign_id, identity_key, evidencia}
 *   - {acao:'criar', identidade, payload_campanha, evidencia}
 *   - {acao:'revisao', motivo, detalhe, evidencia}
 */
export function casarUrlCampanha(payloadOficial, indices, campanhasExistentes = [], ref) {
  const payload = payloadOficial || {};
  const evidencia = montarEvidencia(payload);

  if (!indices || !indices.aliasMap) {
    return { acao: 'revisao', motivo: 'indices_ausentes', detalhe: null, evidencia };
  }
  if (!evidencia.url) {
    return { acao: 'revisao', motivo: 'sem_url_canonica', detalhe: null, evidencia };
  }

  const { campanha, destinoAmbiguo, destinoCandidatos } = normalizarPayload(payload, indices);

  // destino ambíguo (2+ programas plausíveis): abstém, não força (INV-16 / abstenção).
  if (destinoAmbiguo) {
    return { acao: 'revisao', motivo: 'destino_ambiguo', detalhe: { candidatos: destinoCandidatos }, evidencia };
  }

  const r = resolverCampanha(campanha, indices, ref);
  if (!r.resolvido) {
    return { acao: 'revisao', motivo: r.revisao || 'identidade_nao_resolvida', detalhe: r, evidencia };
  }

  const identity_key = r.identity_key;
  const idx = indexarExistentes(campanhasExistentes);
  const encontrados = idx.get(identity_key) || [];

  if (encontrados.length === 1) {
    return {
      acao: 'confirmar',
      campaign_id: encontrados[0],
      identity_key,
      verificado_em: payload.verificado_em ?? null,
      evidencia,
    };
  }
  if (encontrados.length > 1) {
    // várias campanhas sob a mesma identidade: não adivinhamos qual recebe a fonte.
    return {
      acao: 'revisao',
      motivo: 'multiplas_campanhas_mesma_identidade',
      detalhe: { identity_key, candidatos: encontrados },
      evidencia,
    };
  }

  // não existe -> nasce já confirmada TIER 1 (D-033).
  return {
    acao: 'criar',
    identidade: {
      tipo: r.tipo,
      origem_code: r.origemCode,
      destino_code: r.destinoCode,
      publico: r.publico,
      identity_key,
    },
    payload_campanha: {
      tipo: r.tipo,
      origem_code: r.origemCode,
      destino_code: r.destinoCode,
      publico: r.publico,
      identity_key,
      origem_bruto: r.origem_bruto,
      destino_bruto: r.destino_bruto,
      lado_unico: r.lado_unico,
      bucketed: r.bucketed,
      vigencia_fim: payload.vigencia_fim ?? null,
      vigencia_fim_date: r.vigencia_fim_date,
      vigencia_confiavel: r.vigencia_confiavel,
      estado: r.estado,
      percentual: payload.percentual ?? null,
      url: evidencia.url,
      titulo: payload.titulo ?? null,
      slug: payload.slug ?? null,
    },
    evidencia,
  };
}

export default casarUrlCampanha;
