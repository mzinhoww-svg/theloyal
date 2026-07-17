// Camada de DERIVAÇÃO do TL Score (M2 · slice re-score, D-032). PURA, sem I/O,
// sem LLM. Determinismo-primeiro (INV-12): mesmo dado bruto + mesmo vetor de
// derivação → mesmas entradas, sempre.
//
// O engine (`score.mjs`) é puro sobre entradas ∈ [0,1] por componente. Esta
// camada é o que FALTA antes dele: transforma o dado bruto de uma campanha
// (percentual, cpm_value, tipo, público) + o histórico da rota em cada
// componente ∈ [0,1] no shape que `calcularScore(entradas, pesos)` consome:
//
//   entradas.componentes = {
//     percentil?:   {valor, base_n, base_curta, janela},  // valor = percentil BRUTO (engine amortece)
//     eficiencia?:  {valor, base_n, janela},
//     raridade?:    {valor, base_n, janela},
//     abrangencia?: {valor, base_n, janela}
//   }
//
// Fronteira D-024/§2.1 (crítica): sub-métrica AUSENTE (ex.: sem CPM) retorna
// `null` → o componente some da conta e o engine REDISTRIBUI os pesos (nunca um
// zero que afunda item legítimo). Só quando NÃO há sinal de valor nenhum
// (sem percentil E sem eficiência) é que a `conta_nao_calculavel` do engine
// dispara → "Não confirmado". Esta camada nunca chuta: faltou referência
// defensável → `null`, não um limiar inventado (INV-03/INV-12).
//
// As escolhas de normalização/limiares (o "vetor de derivação") vivem em
// DERIVACAO_V1 abaixo — versionadas, análogas a `score_pesos`. Recalibrar =
// nova versão, mesma disciplina do vetor de pesos. PROPOSTA a aprovar em
// v2/M2/PROPOSTA-VETOR-DERIVACAO.md ANTES do re-score em escala (D-032).

// ---------------------------------------------------------------------------
// Vetor de derivação v1 — PROPOSTA (a aprovar pelo operador, não travado)
// ---------------------------------------------------------------------------
export const DERIVACAO_V1 = {
  versao: 'derivacao.v1',

  // percentil: percentil do bônus vs histórico da MESMA rota (identity_key).
  // min_samples alinhado a score_pesos.v1 (=3): base curta é sinalizada e o
  // engine amortece para 0,5 (neutro), nunca finge percentil cheio (§2).
  percentil: { janela: 'rota-total', min_samples: 3 },

  // eficiência: menor CPM = melhor valor. ECDF-inverso contra a distribuição
  // de referência de CPM (robusto a outliers, ao contrário de min-max, que
  // seria dominado pelo teto). Ausente → null (redistribui).
  eficiencia: { metodo: 'ecdf-inverso', janela: 'cpm-populacao-global' },

  // raridade: rota rara pontua mais que rota mensal (§2.2). Buckets por
  // frequência da rota — auditáveis, tunáveis pelo operador. Limiares
  // ancorados na distribuição real de tamanho de rota (ver PROPOSTA §C).
  raridade: {
    janela: 'snapshot-rota',
    limiares: [
      { max: 1, valor: 0.85 },  // ocorrência única — tetada em 0,85 (D-037): rara, mas não premiar ruído
      { max: 2, valor: 0.85 },
      { max: 5, valor: 0.65 },
      { max: 20, valor: 0.45 },
      { max: 50, valor: 0.25 },
      { max: Infinity, valor: 0.10 }, // rota recorrente — comum
    ],
  },

  // abrangência: geral > cartão > clube (ajuste fino, §2.2). Público vem do
  // resolverPublico do M1 (identidade.mjs): geral|cartao|selecionados|clube.
  abrangencia: {
    janela: 'publico',
    mapa: { geral: 1.0, cartao: 0.6, selecionados: 0.45, clube: 0.3 },
  },
};

// ---------------------------------------------------------------------------
// Helpers puros
// ---------------------------------------------------------------------------
function clamp01(x) {
  if (!Number.isFinite(x)) return null;
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return Math.round(c * 1e4) / 1e4; // 4 casas: estabiliza golden (igual ao engine)
}

// Aceita array de números ou {amostra:[...]} / {historicoRota:[...]}.
// Retorna só os finitos, para o ECDF não contaminar com null/NaN.
function normalizarAmostra(entrada) {
  let arr = entrada;
  if (arr && !Array.isArray(arr)) arr = arr.amostra ?? arr.historicoRota ?? arr.valores;
  if (!Array.isArray(arr)) return [];
  return arr.map(Number).filter(Number.isFinite);
}

// ECDF por midrank (Hazen): fração da amostra estritamente abaixo + metade dos
// empates. Estável a ties (30% num histórico com muitos 30% cai no meio, não no
// topo). Determinístico: independe da ordem de entrada.
function ecdfMidrank(valor, amostra) {
  let abaixo = 0, iguais = 0;
  for (const x of amostra) {
    if (x < valor) abaixo++;
    else if (x === valor) iguais++;
  }
  const n = amostra.length;
  if (n === 0) return { valor: null, base_n: 0 };
  return { valor: (abaixo + 0.5 * iguais) / n, base_n: n };
}

// ---------------------------------------------------------------------------
// Derivações por componente — cada uma retorna {valor, ...} ∈ [0,1] ou null.
// null = sub-métrica ausente → engine redistribui (§2.1). NUNCA um zero chutado.
// ---------------------------------------------------------------------------

/**
 * Eficiência a partir do CPM (menor CPM = melhor valor).
 * @param {number} cpm_value  CPM em R$/milheiro da campanha
 * @param {number[]|{amostra:number[]}} distribuicao  população de CPM de referência
 * @returns {{valor:number, base_n:number, janela:string}|null}
 *   null quando: CPM ausente/inválido (≤0 ou não-finito) OU sem referência.
 */
export function derivarEficiencia(cpm_value, distribuicao, config = DERIVACAO_V1) {
  const cpm = Number(cpm_value);
  if (!Number.isFinite(cpm) || cpm <= 0) return null; // ausente → redistribui (§2.1)
  const amostra = normalizarAmostra(distribuicao);
  if (amostra.length === 0) return null;              // sem referência → não fabrica
  const { valor: rank, base_n } = ecdfMidrank(cpm, amostra);
  return {
    valor: clamp01(1 - rank), // inverte: CPM baixo → eficiência alta
    base_n,
    janela: config.eficiencia.janela,
  };
}

/**
 * Percentil do bônus vs histórico da MESMA rota. `valor` é o percentil BRUTO
 * (o engine amortece por base curta, §2). Convenção: historicoRota é a
 * população de `percentual` da rota (a própria campanha incluída).
 * @param {{percentual:number, historicoRota:number[]}} args
 * @returns {{valor:number, base_n:number, base_curta:boolean, janela:string}|null}
 *   null quando não há `percentual` (sem sinal de percentil possível).
 */
export function derivarPercentil({ percentual, historicoRota } = {}, config = DERIVACAO_V1) {
  if (percentual == null || percentual === '') return null; // Number(null)===0: guarda antes de coagir
  const v = Number(percentual);
  if (!Number.isFinite(v)) return null; // sem % → componente ausente (redistribui)
  const amostra = normalizarAmostra(historicoRota);
  const minSamples = config.percentil.min_samples;
  if (amostra.length === 0) {
    // Tem bônus, mas nenhuma referência de rota: presente porém NEUTRO.
    // valor=0,5 e base_n=0 → o engine amortece integralmente para 0,5.
    return { valor: 0.5, base_n: 0, base_curta: true, janela: config.percentil.janela };
  }
  const { valor, base_n } = ecdfMidrank(v, amostra);
  return {
    valor: clamp01(valor),
    base_n,
    base_curta: base_n < minSamples,
    janela: config.percentil.janela,
  };
}

/**
 * Raridade da rota: rota rara > rota recorrente (§2.2). Bucket por frequência.
 * @param {{tipo?:string, rota?:string, frequencias?:object|Map, frequencia?:number, historicoRota?:number[]}} args
 *   frequencia: contagem direta da rota; OU frequencias[rota]; OU length de historicoRota.
 * @returns {{valor:number, base_n:number, janela:string}|null}
 *   null quando a frequência da rota é desconhecida (não chuta).
 */
export function derivarRaridade({ rota, frequencias, frequencia, historicoRota } = {}, config = DERIVACAO_V1) {
  let n = Number(frequencia);
  if (!Number.isFinite(n) && frequencias != null && rota != null) {
    const bruto = frequencias instanceof Map ? frequencias.get(rota) : frequencias[rota];
    n = Number(bruto);
  }
  if (!Number.isFinite(n) && Array.isArray(historicoRota)) n = historicoRota.length;
  if (!Number.isFinite(n) || n < 1) return null; // frequência desconhecida → redistribui
  let valor = config.raridade.limiares[config.raridade.limiares.length - 1].valor;
  for (const l of config.raridade.limiares) {
    if (n <= l.max) { valor = l.valor; break; }
  }
  return { valor: clamp01(valor), base_n: n, janela: config.raridade.janela };
}

/**
 * Abrangência de público: geral > cartão > clube (ajuste fino, §2.2).
 * @param {string} publico  geral|cartao|selecionados|clube (resolverPublico, M1)
 * @returns {{valor:number, base_n:null, janela:string}|null}
 *   null quando o público é desconhecido/fora do mapa (não chuta).
 */
export function derivarAbrangencia(publico, config = DERIVACAO_V1) {
  const v = config.abrangencia.mapa[publico];
  if (!Number.isFinite(v)) return null;
  return { valor: clamp01(v), base_n: null, janela: config.abrangencia.janela };
}

/**
 * Fronteira D-024/§2.1: a conta é NÃO calculável só quando não há sinal de
 * valor NENHUM — sem percentil E sem eficiência. Sub-métrica ausente sozinha
 * (ex.: só falta CPM) NÃO é conta_nao_calculavel (redistribui). Espelha a
 * lógica do próprio engine; exposta aqui para testes e para a fila de curadoria.
 * @param {object} componentes  o objeto entradas.componentes já montado
 * @returns {boolean}
 */
export function contaNaoCalculavel(componentes = {}) {
  const presente = (c) => c != null && Number.isFinite(c.valor);
  return !presente(componentes.percentil) && !presente(componentes.eficiencia);
}

/**
 * Monta o objeto `entradas` completo que `calcularScore(entradas, pesos)`
 * consome, a partir do dado bruto da campanha + o contexto da rota.
 * Componentes que derivam para null são OMITIDOS (não viram zero) → o engine
 * redistribui. Puro; não lê banco.
 * @param {object} campanha  linha bruta: {id, percentual, cpm_value, tipo, tier, publico?}
 * @param {object} contexto  {historicoRota, distribuicaoCpm, rota, frequencias, frequencia, publico, tem_tier1}
 * @returns {{campaign_id, tem_tier1, componentes}}
 */
export function montarEntradas(campanha = {}, contexto = {}, config = DERIVACAO_V1) {
  const componentes = {};

  const percentil = derivarPercentil(
    { percentual: campanha.percentual, historicoRota: contexto.historicoRota }, config);
  if (percentil) componentes.percentil = percentil;

  const eficiencia = derivarEficiencia(campanha.cpm_value, contexto.distribuicaoCpm, config);
  if (eficiencia) componentes.eficiencia = eficiencia;

  const raridade = derivarRaridade({
    tipo: campanha.tipo,
    rota: contexto.rota,
    frequencias: contexto.frequencias,
    frequencia: contexto.frequencia,
    historicoRota: contexto.historicoRota,
  }, config);
  if (raridade) componentes.raridade = raridade;

  const abrangencia = derivarAbrangencia(contexto.publico ?? campanha.publico, config);
  if (abrangencia) componentes.abrangencia = abrangencia;

  const temTier1 = contexto.tem_tier1 === true || Number(campanha.tier) === 1;

  return { campaign_id: campanha.id ?? null, tem_tier1: temTier1, componentes };
}
