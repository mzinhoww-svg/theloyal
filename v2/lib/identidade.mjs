// =====================================================================
// Matcher de identidade canônica — funções puras, determinísticas (M1)
// Spec: v2/db/SPEC-M1-identidade.md. Decisões do operador (2026-07-16):
//  - destino desconhecido: regra por TIPO (lado único p/ tipos sem destino;
//    revisão p/ transferência, que exige destino).
//  - registro HEAD + BUCKETS de cauda (agrupa n=1-2 por kind até ganhar volume;
//    origem_bruto/destino_bruto preservados p/ promoção lossless).
//  - ruído verdadeiro nunca vira programa.
// Sem LLM no caminho feliz. Origem indefinida -> revisão, nunca chute.
// =====================================================================

// Os 9 tipos canônicos (D-001, brief §5.4).
export const TIPOS_CANONICOS = [
  'transferencia_bonificada', 'promocao_emissao', 'compra_pontos', 'clube',
  'status_match', 'bonus_acumulo', 'shopping', 'pontos_mais_dinheiro', 'outro',
];

// Só transferência EXIGE destino. Os demais podem ser de lado único.
export const REQUER_DESTINO = new Set(['transferencia_bonificada']);

// Sentinela de destino ausente numa identidade de lado único.
export const SEM_DESTINO = 'sem_destino';

export const MAPA_TIPO = {
  transferencia: 'transferencia_bonificada', transferencia_bonificada: 'transferencia_bonificada',
  compra: 'compra_pontos', compra_pontos: 'compra_pontos',
  clube: 'clube', cartao: 'bonus_acumulo', bonus_acumulo: 'bonus_acumulo',
  'status match': 'status_match', statusmatch: 'status_match', status_match: 'status_match',
  shopping: 'shopping', pontos_mais_dinheiro: 'pontos_mais_dinheiro', promocao_emissao: 'promocao_emissao',
  hotelaria: 'outro', estrutural: 'outro', assinatura: 'outro', sorteio: 'outro', resgate: 'outro',
  promocao: 'outro', cashback: 'outro', cadastro: 'outro', abertura: 'outro', desconto: 'outro',
  leilao: 'outro', upgrade: 'outro', concurso: 'outro',
};

export function normalizar(texto) {
  if (texto == null) return '';
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9&]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Índices a partir do seed: aliasMap (alias->code), kindByCode, noiseSet, buckets.
export function construirIndices(seed) {
  const aliasMap = new Map();
  const kindByCode = new Map();
  for (const p of seed.programas || []) {
    kindByCode.set(p.code, p.kind || 'outro');
    for (const a of p.aliases || []) aliasMap.set(normalizar(a), p.code);
    aliasMap.set(normalizar(p.name), p.code);
    aliasMap.set(normalizar(p.code), p.code);
  }
  const noiseSet = new Set((seed.ruido || []).map(normalizar));
  const buckets = seed.buckets || { default: 'outro' };
  return { aliasMap, kindByCode, noiseSet, buckets };
}

// compat: construção só do aliasMap (usada em testes antigos).
export function construirAliasMap(programas) {
  return construirIndices({ programas }).aliasMap;
}

export function resolverPrograma(textoBruto, aliasMap) {
  const n = normalizar(textoBruto);
  if (!n) return null;
  if (aliasMap.has(n)) return aliasMap.get(n);
  let melhor = null;
  for (const [alias, code] of aliasMap) {
    if (alias.length < 3) continue;
    const re = new RegExp(`(?:^| )(${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?: |$)`);
    const m = re.exec(n);
    if (!m) continue;
    const pos = m.index;
    if (melhor === null || pos < melhor.pos || (pos === melhor.pos && alias.length > melhor.len)) {
      melhor = { code, pos, len: alias.length };
    }
  }
  return melhor ? melhor.code : null;
}

export function resolverTipo(tipoBruto) {
  const n = normalizar(tipoBruto);
  if (MAPA_TIPO[n]) return MAPA_TIPO[n];
  if (TIPOS_CANONICOS.includes(n)) return n;
  return null;
}

export function resolverPublico(campanha = {}) {
  const hay = normalizar([campanha.notes, campanha.paridade, campanha.valor_leitura, campanha.tipo].filter(Boolean).join(' '));
  if (/\bclube\b/.test(hay)) return 'clube';
  if (/\bcartao\b|\bcartoes\b|\bcard\b/.test(hay)) return 'cartao';
  if (/\bselecionad|\bconvidad|\bsegmentad/.test(hay)) return 'selecionados';
  return 'geral';
}

// Heurística de kind para a cauda (n=1-2 sem alias). Grosseira e conservadora.
const KIND_KEYWORDS = [
  ['aereo', /\b(air|airways|airline|airlines|aerol|aviacao|jet|wings|lineas|voo|flug|aereo)\b|airlines?$/],
  ['hotel', /\b(hotel|hoteis|resort|thermas|termas|pousada|inn|palace|spa|lodge|beach|bonvoy|iberostar|melia|bourbon|nannai|palladium|wyndham|hyatt|marriott|hilton)\b/],
  ['combustivel', /\b(gas|combust|posto|petro|gnv)\b/],
  ['streaming', /\b(play|stream|music|deezer|spotify|hbo|globoplay|crunchyroll|netflix|paramount|max)\b/],
  ['varejo', /\b(shop|store|loja|magaz|market|outlet|store)\b/],
];
export function inferirBucket(nomeNormalizado, buckets) {
  for (const [kind, re] of KIND_KEYWORDS) {
    if (re.test(nomeNormalizado)) return { code: buckets[kind] || buckets.default, kind };
  }
  return { code: buckets.default || 'outro', kind: 'outro' };
}

// Classifica um lado (origem/destino): programa | bucket | ruido | vazio.
export function classificarLado(textoBruto, { aliasMap, kindByCode, noiseSet, buckets }) {
  const n = normalizar(textoBruto);
  if (!n) return { tipo: 'vazio', code: null, kind: null, bruto: n };
  if (noiseSet.has(n)) return { tipo: 'ruido', code: null, kind: null, bruto: n };
  const code = resolverPrograma(textoBruto, aliasMap);
  if (code) return { tipo: 'programa', code, kind: kindByCode.get(code) || 'outro', bruto: n };
  const b = inferirBucket(n, buckets);
  return { tipo: 'bucket', code: b.code, kind: b.kind, bruto: n };
}

export function identityKey(tipo, origemCode, destinoCode, publico) {
  return [tipo, origemCode, destinoCode, publico].join('|');
}

const INDETERMINADOS = new Set(['', 'na', 'n a', 'n/a', 'indeterminado', 'indeterminada', 'sem data', '-', 'null', 'nao confirmado', 'nao informado']);
export function parseVigenciaFim(texto) {
  if (texto == null) return { date: null, confiavel: false };
  const raw = String(texto).trim();
  const n = normalizar(raw);
  if (INDETERMINADOS.has(n)) return { date: null, confiavel: false };
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return validarData(+m[1], +m[2], +m[3]);
  m = raw.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (m) { const ano = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return validarData(ano, +m[2], +m[1]); }
  return { date: null, confiavel: false };
}
function validarData(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return { date: null, confiavel: false };
  const iso = `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(dt.getTime()) || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return { date: null, confiavel: false };
  return { date: iso, confiavel: true };
}

export function derivarEstado({ vigenciaFimDate, vigenciaConfiavel, temTier1 = false, ref }) {
  if (!vigenciaConfiavel || !vigenciaFimDate) return 'indeterminada';
  const fim = new Date(vigenciaFimDate + 'T00:00:00Z');
  const r = ref ? new Date(ref + 'T00:00:00Z') : new Date();
  const dias = Math.floor((fim - r) / 86400000);
  if (dias < -30) return 'historica';
  if (dias < 0) return 'encerrada';
  if (dias <= 3) return 'ultimos_dias';
  return temTier1 ? 'ativa' : 'detectada';
}

// Resolve uma campanha bruta -> objeto canônico ou motivo de revisão.
// `indices` = saída de construirIndices(seed). Puro; não escreve nada.
export function resolverCampanha(campanha, indices, ref) {
  const tipo = resolverTipo(campanha.tipo);
  const vig = parseVigenciaFim(campanha.vigencia_fim);
  const publico = resolverPublico(campanha);
  const estado = derivarEstado({
    vigenciaFimDate: vig.date, vigenciaConfiavel: vig.confiavel,
    temTier1: (campanha.tier ?? 2) <= 1, ref,
  });
  const base = {
    publico, vigencia_fim_date: vig.date, vigencia_confiavel: vig.confiavel, estado,
    origem_bruto: normalizar(campanha.origem), destino_bruto: normalizar(campanha.destino),
  };

  if (!tipo) return { resolvido: false, revisao: 'tipo_indefinido', tipo: null, ...base };

  const lo = classificarLado(campanha.origem, indices);
  // origem é sempre obrigatória; ruído/vazio -> revisão
  if (lo.tipo === 'ruido' || lo.tipo === 'vazio') {
    return { resolvido: false, revisao: `origem_${lo.tipo}`, tipo, origemCode: null, ...base };
  }

  const ld = classificarLado(campanha.destino, indices);
  let destinoCode, ladoUnico = false, destinoBucket = false;
  if (ld.tipo === 'programa' || ld.tipo === 'bucket') {
    destinoCode = ld.code;
    destinoBucket = ld.tipo === 'bucket';
  } else {
    // destino ruído/vazio -> regra por tipo
    if (REQUER_DESTINO.has(tipo)) {
      return { resolvido: false, revisao: 'transferencia_sem_destino', tipo, origemCode: lo.code, ...base };
    }
    destinoCode = SEM_DESTINO;
    ladoUnico = true;
  }

  return {
    resolvido: true, tipo, origemCode: lo.code, destinoCode, publico,
    identity_key: identityKey(tipo, lo.code, destinoCode, publico),
    lado_unico: ladoUnico,
    bucketed: lo.tipo === 'bucket' || destinoBucket,
    origem_kind: lo.kind, destino_kind: ladoUnico ? null : ld.kind,
    ...base,
  };
}
