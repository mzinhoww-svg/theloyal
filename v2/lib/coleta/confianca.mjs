// =====================================================================
// Gate de CONFIANCA TIER 1 (M2 · Parte C, D-048/D-049). PURO, sem I/O, sem LLM.
// Determinismo-primeiro (INV-12): a confianca e FUNCAO PURA de sinais objetivos
// e verificaveis da confirmacao — NUNCA nota subjetiva de LLM. O LLM pode
// NARRAR por que a confianca ficou baixa; jamais DECIDIR que ficou.
//
// DOIS EIXOS ORTOGONAIS (D-049 ref.1) — nao colapsar:
//   1. CONFIANCA (score in [0,1]): "quao bem verificamos" — qualidade da leitura
//      da fonte. Soma ponderada de fatos sim/nao (janela clara? fonte oficial?
//      200? publico inequivoco? termos legiveis?). NAO depende de o termo
//      corroborar ou refutar — o azul verificou com ALTA confianca E refutou.
//   2. RESULTADO in {corrobora_limpo, corrobora_com_ajuste, refuta,
//      nao_verificavel}: o desfecho da comparacao dos TERMOS (D-045/D-049 ref.2).
//
// Tensao documental resolvida por D-049 (a diretriz INVIOLAVEL da tarefa e o ADR
// filho de D-048): a SPEC §3.1 lista "termos corroboram sem divergencia?" como
// se derrubasse a confianca do azul; D-049 corrige — o azul teve ALTA confianca
// (escala oficial lida com nitidez) E refuta. Logo o sinal de "termos" aqui e
// `termos_legiveis` (conseguimos LER+COMPARAR os termos oficiais com proveniencia),
// nao "termos concordam". Concordancia vive no eixo RESULTADO, separado.
//
// Pesos versionados (CONFIANCA_V1), como score_pesos: recalibrar = nova versao +
// changelog. A funcao NAO conhece os pesos embutidos — recebe `config`.
// =====================================================================

// ---------------------------------------------------------------------------
// Vetor de confianca v1 — sinais objetivos + pesos (a aprovar pelo operador)
// ---------------------------------------------------------------------------
export const CONFIANCA_V1 = {
  versao: 'confianca.v1',
  // Cada sinal e um FATO sim/nao da confirmacao. Pesos somam 1,0.
  pesos: {
    fonte_oficial: 0.30,          // regulamento em dominio oficial vs blog/redirect (D-045). Dominante: blog nao confirma.
    janela_vigencia_clara: 0.25,  // regulamento tem janela datada (D-047). Ausente = evergreen/nao datavel.
    estado_vivo_200: 0.15,        // fetch 200 (nao 3xx->/promocao). Pagina existe agora naquela URL.
    publico_inequivoco: 0.15,     // escala/publico sem ambiguidade (cada publico -> seu %).
    termos_legiveis: 0.15,        // conseguimos EXTRAIR os termos oficiais (%/publico) com proveniencia p/ comparar.
  },
  // Tolerancia de arredondamento/fraseio (D-049 ref.2): "ate X%" ≡ "X%" e
  // diferenca de ate N pontos percentuais conta como o mesmo tier.
  tolerancia_pp: 2,
};

export const RESULTADOS = Object.freeze([
  'corrobora_limpo', 'corrobora_com_ajuste', 'refuta', 'nao_verificavel',
]);

const SINAIS = ['fonte_oficial', 'janela_vigencia_clara', 'estado_vivo_200', 'publico_inequivoco', 'termos_legiveis'];

function round4(x) { return Math.round(x * 1e4) / 1e4; }

/**
 * Confianca da confirmacao TIER 1 — funcao PURA dos sinais objetivos.
 *
 * @param {object} sinais  fatos sim/nao da confirmacao + o resultado (ortogonal):
 *   { fonte_oficial:boolean, janela_vigencia_clara:boolean, estado_vivo_200:boolean,
 *     publico_inequivoco:boolean, termos_legiveis:boolean,
 *     resultado?: 'corrobora_limpo'|'corrobora_com_ajuste'|'refuta'|'nao_verificavel' }
 * @param {object} [config=CONFIANCA_V1]  vetor de pesos versionado.
 * @returns {{ score:number, resultado:string, versao:string,
 *             breakdown: Array<{sinal, presente, peso, contribuicao}> }}
 *   score in [0,1]. resultado ECOA o eixo ortogonal (nao altera o score).
 */
export function confianca(sinais = {}, config = CONFIANCA_V1) {
  if (!config || !config.pesos) throw new Error('confianca: config.pesos obrigatorio (vetor versionado)');
  const pesos = config.pesos;

  let score = 0;
  const breakdown = [];
  for (const s of SINAIS) {
    const peso = Number(pesos[s]) || 0;
    const presente = sinais[s] === true; // so `true` conta — ausente/desconhecido = 0 (nao chuta, INV-03)
    const contribuicao = presente ? peso : 0;
    score += contribuicao;
    breakdown.push({ sinal: s, presente, peso: round4(peso), contribuicao: round4(contribuicao) });
  }

  const resultado = RESULTADOS.includes(sinais.resultado) ? sinais.resultado : 'nao_verificavel';

  return { score: round4(score), resultado, versao: config.versao, breakdown };
}

// ---------------------------------------------------------------------------
// RESULTADO (eixo ortogonal) — comparacao dos TERMOS ingeridos vs escala oficial.
// PURO. Nao decide confianca; so classifica a divergencia (D-049 ref.2):
//   refuta                = numero AUSENTE de todas as faixas da escala oficial
//   corrobora_com_ajuste  = numero EXISTE numa faixa mas publico/faixa precisa
//                           correcao, OU a oferta e escala-por-publico (D-047:
//                           separar em N identidades, nunca colapsar num numero)
//   corrobora_limpo       = numero bate na faixa do publico certo dentro da
//                           tolerancia de arredondamento/fraseio, escala de 1 faixa
//   nao_verificavel       = sem % ingerido OU escala oficial vazia (nada a comparar)
// ---------------------------------------------------------------------------

const PUBLICO_EQ = { geral: 'geral', todos: 'geral', cartao: 'cartao', cartoes: 'cartao', selecionados: 'selecionados', clube: 'clube', assinante: 'clube', assinantes: 'clube', diamante: 'clube' };
function normPublico(p) {
  const k = String(p == null ? '' : p).toLowerCase().trim();
  return PUBLICO_EQ[k] || k || null;
}

/**
 * Classifica o RESULTADO da corroboracao de termos (eixo ortogonal a confianca).
 *
 * @param {object} args
 *   pct_ingerido    {number|null}  % do dado ingerido (viva.percentual).
 *   publico_ingerido{string}       publico do dado ingerido (viva.publico).
 *   escala_oficial  {Array<{pct:number, publico?:string}>}  faixas lidas do regulamento.
 * @param {object} [config=CONFIANCA_V1]  usa config.tolerancia_pp.
 * @returns {{ resultado:string, tier_casado:object|null, n_faixas:number,
 *             publico_inequivoco:boolean, motivo:string }}
 */
export function classificarResultado({ pct_ingerido, publico_ingerido, escala_oficial } = {}, config = CONFIANCA_V1) {
  const tol = Number(config?.tolerancia_pp ?? CONFIANCA_V1.tolerancia_pp);
  const escala = (escala_oficial || [])
    .map((f) => ({ pct: Number(f.pct), publico: normPublico(f.publico) }))
    .filter((f) => Number.isFinite(f.pct));

  const pct = pct_ingerido == null || pct_ingerido === '' ? null : Number(pct_ingerido);
  const pubIng = normPublico(publico_ingerido);

  // Escala-por-publico REAL = >1 valor de pct DISTINTO (azul: 50/100/105/110/120).
  // O mesmo % citado 2x (ruido de scraping) nao e escala. publico inequivoco =
  // ha publico nomeado e nenhum publico mapeia 2 pcts diferentes (sem ambiguidade).
  const distinctPcts = new Set(escala.map((f) => f.pct));
  const ehEscala = distinctPcts.size > 1;
  const publicoInequivoco = escala.length > 0 && escala.some((f) => f.publico != null)
    && !temPublicoAmbiguo(escala);

  if (pct == null || !Number.isFinite(pct) || escala.length === 0) {
    return { resultado: 'nao_verificavel', tier_casado: null, n_faixas: escala.length, publico_inequivoco: publicoInequivoco, motivo: 'sem_pct_ingerido_ou_escala_vazia' };
  }

  const faixasCasadas = escala.filter((f) => Math.abs(f.pct - pct) <= tol);
  if (faixasCasadas.length === 0) {
    return { resultado: 'refuta', tier_casado: null, n_faixas: distinctPcts.size, publico_inequivoco: publicoInequivoco, motivo: `pct ${pct}% ausente de todas as ${distinctPcts.size} faixas oficiais` };
  }

  const casaPublico = faixasCasadas.some((f) => f.publico === pubIng || f.publico == null);

  // escala-por-publico: numero existe, mas ha varios pcts por publico -> separar (D-047)
  if (ehEscala) {
    return { resultado: 'corrobora_com_ajuste', tier_casado: faixasCasadas[0], n_faixas: distinctPcts.size, publico_inequivoco: publicoInequivoco, motivo: `pct ${pct}% presente em escala-por-publico (${distinctPcts.size} faixas) — separar por publico (D-047)` };
  }
  // pct unico. Publico atribuido errado -> ajuste; certo -> limpo.
  if (!casaPublico) {
    return { resultado: 'corrobora_com_ajuste', tier_casado: faixasCasadas[0], n_faixas: 1, publico_inequivoco: publicoInequivoco, motivo: `pct ${pct}% existe mas atribuido a publico diferente do ingerido (${pubIng})` };
  }
  return { resultado: 'corrobora_limpo', tier_casado: faixasCasadas[0], n_faixas: 1, publico_inequivoco: publicoInequivoco, motivo: `pct ${pct}% bate na faixa do publico ${pubIng} (faixa unica)` };
}

// publico repetido com pct divergente = escala ambigua (mesmo publico, 2 numeros)
function temPublicoAmbiguo(escala) {
  const porPublico = new Map();
  for (const f of escala) {
    if (f.publico == null) continue;
    if (!porPublico.has(f.publico)) porPublico.set(f.publico, new Set());
    porPublico.get(f.publico).add(f.pct);
  }
  for (const pcts of porPublico.values()) if (pcts.size > 1) return true;
  return false;
}

export default confianca;
