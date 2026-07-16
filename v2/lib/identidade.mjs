// =====================================================================
// Matcher de identidade canônica — funções puras, determinísticas (M1)
// Spec: v2/db/SPEC-M1-identidade.md. Decisões: D-001, D-003, D-006.
// Sem LLM no caminho feliz. Variante não resolvida -> null (revisão), nunca chute.
// =====================================================================

// Os 9 tipos canônicos (D-001, brief §5.4).
export const TIPOS_CANONICOS = [
  'transferencia_bonificada',
  'promocao_emissao',
  'compra_pontos',
  'clube',
  'status_match',
  'bonus_acumulo',
  'shopping',
  'pontos_mais_dinheiro',
  'outro',
];

// Mapa do `tipo` bruto (base atual) -> tipo canônico. Duplicatas colapsam.
// cartao -> bonus_acumulo, hotelaria/estrutural/cauda -> outro (D-001).
export const MAPA_TIPO = {
  transferencia: 'transferencia_bonificada',
  transferencia_bonificada: 'transferencia_bonificada',
  compra: 'compra_pontos',
  compra_pontos: 'compra_pontos',
  clube: 'clube',
  cartao: 'bonus_acumulo',
  bonus_acumulo: 'bonus_acumulo',
  'status match': 'status_match',
  statusmatch: 'status_match',
  status_match: 'status_match',
  shopping: 'shopping',
  pontos_mais_dinheiro: 'pontos_mais_dinheiro',
  promocao_emissao: 'promocao_emissao',
  // cauda ruidosa -> outro
  hotelaria: 'outro',
  estrutural: 'outro',
  assinatura: 'outro',
  sorteio: 'outro',
  resgate: 'outro',
  promocao: 'outro',
  cashback: 'outro',
  cadastro: 'outro',
  abertura: 'outro',
  desconto: 'outro',
  leilao: 'outro',
  upgrade: 'outro',
  concurso: 'outro',
};

const PUBLICOS = ['geral', 'selecionados', 'clube', 'cartao'];

// Normalização: minúsculas, sem acento, pontuação -> espaço, espaços colapsados.
export function normalizar(texto) {
  if (texto == null) return '';
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9&]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Constrói o índice alias->code a partir do seed (lista de programas).
export function construirAliasMap(programas) {
  const map = new Map();
  for (const p of programas) {
    for (const a of p.aliases || []) {
      map.set(normalizar(a), p.code);
    }
    map.set(normalizar(p.name), p.code);
    map.set(normalizar(p.code), p.code);
  }
  return map;
}

// Resolve um texto de programa -> code | null. Match exato do normalizado;
// fallback conservador por token único que bata um alias inteiro.
export function resolverPrograma(textoBruto, aliasMap) {
  const n = normalizar(textoBruto);
  if (!n) return null;
  if (aliasMap.has(n)) return aliasMap.get(n);
  // fallback: alias conhecido como palavra inteira no texto. Escolhe o match
  // MAIS À ESQUERDA (determinístico; em empate, o alias mais longo).
  let melhor = null; // { code, pos, len }
  for (const [alias, code] of aliasMap) {
    if (alias.length < 3) continue; // evita colisão com tokens curtos
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

// Resolve o tipo bruto -> tipo canônico | null (null = revisão).
export function resolverTipo(tipoBruto) {
  const n = normalizar(tipoBruto);
  if (MAPA_TIPO[n]) return MAPA_TIPO[n];
  if (TIPOS_CANONICOS.includes(n)) return n;
  return null;
}

// Heurística de público a partir de sinais da campanha (notes/paridade/tipo).
// Default 'geral'. Nunca inventa: sinais claros -> classe; senão 'geral'.
export function resolverPublico(campanha = {}) {
  const hay = normalizar(
    [campanha.notes, campanha.paridade, campanha.valor_leitura, campanha.tipo].filter(Boolean).join(' ')
  );
  if (/\bclube\b/.test(hay)) return 'clube';
  if (/\bcartao\b|\bcartoes\b|\bcard\b/.test(hay)) return 'cartao';
  if (/\bselecionad|\bconvidad|\bsegmentad/.test(hay)) return 'selecionados';
  return 'geral';
}

// Chave de identidade estável — SEM vigência (ADR-RADAR-009).
export function identityKey(tipo, origemCode, destinoCode, publico) {
  return [tipo, origemCode, destinoCode, publico].join('|');
}

// Parse de vigencia_fim (texto sujo) -> { date: 'YYYY-MM-DD'|null, confiavel: bool }.
// "na"/vazio/indeterminado -> indeterminada (D-006, nunca descarta).
const INDETERMINADOS = new Set(['', 'na', 'n a', 'n/a', 'indeterminado', 'indeterminada', 'sem data', '-', 'null', 'nao confirmado', 'nao informado']);
export function parseVigenciaFim(texto) {
  if (texto == null) return { date: null, confiavel: false };
  const raw = String(texto).trim();
  const n = normalizar(raw);
  if (INDETERMINADOS.has(n)) return { date: null, confiavel: false };
  // ISO YYYY-MM-DD
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return validarData(+m[1], +m[2], +m[3]);
  // DD/MM/YYYY ou DD-MM-YYYY
  m = raw.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (m) {
    const ano = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return validarData(ano, +m[2], +m[1]);
  }
  return { date: null, confiavel: false };
}

function validarData(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) {
    return { date: null, confiavel: false };
  }
  const iso = `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(dt.getTime()) || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) {
    return { date: null, confiavel: false };
  }
  return { date: iso, confiavel: true };
}

// FSM de vigência — espelho puro da função SQL derivar_estado_vigencia (paridade testada).
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
// Puro: recebe aliasMap já construído. Não escreve nada.
export function resolverCampanha(campanha, aliasMap, ref) {
  const origemCode = resolverPrograma(campanha.origem, aliasMap);
  const destinoCode = resolverPrograma(campanha.destino, aliasMap);
  const tipo = resolverTipo(campanha.tipo);
  const vig = parseVigenciaFim(campanha.vigencia_fim);
  const publico = resolverPublico(campanha);

  const faltando = [];
  if (!origemCode) faltando.push('origem');
  if (!destinoCode) faltando.push('destino');
  if (!tipo) faltando.push('tipo');

  const estado = derivarEstado({
    vigenciaFimDate: vig.date,
    vigenciaConfiavel: vig.confiavel,
    temTier1: (campanha.tier ?? 2) <= 1,
    ref,
  });

  if (faltando.length) {
    return {
      resolvido: false,
      revisao: `nao_resolvido:${faltando.join(',')}`,
      origemCode, destinoCode, tipo,
      publico, vigencia_fim_date: vig.date, vigencia_confiavel: vig.confiavel,
      estado, // provavelmente 'indeterminada'
    };
  }

  return {
    resolvido: true,
    origemCode, destinoCode, tipo, publico,
    identity_key: identityKey(tipo, origemCode, destinoCode, publico),
    vigencia_fim_date: vig.date,
    vigencia_confiavel: vig.confiavel,
    estado,
  };
}
