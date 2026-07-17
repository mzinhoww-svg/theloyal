// Camada de DERIVAÇÃO LADO-ÚNICO do TL Score (M2 · slice coleta-TIER1, Parte B, D-042).
// PURA, sem I/O, sem LLM. Determinismo-primeiro (INV-12). NÃO ligada ao re-score:
// é a PROPOSTA (v2/M2/PROPOSTA-VETOR-LADO-UNICO.md) a aprovar antes de re-scorar
// os 1.220 `sem_destino`. Enquanto não aprovada, nada aqui muta a base.
//
// PROBLEMA (D-042): item lado-único (compra/acúmulo/shopping/clube de UM lado só —
// destino_code='sem_destino', lado_unico=true) NÃO tem rota/destino. A derivação
// geral (`derivacao.mjs`) mede o percentil do bônus contra o histórico da MESMA
// rota `tipo|origem|destino|público`. Para lado-único o destino é sempre
// 'sem_destino' e a rota vira `tipo|origem|sem_destino|público` — tão fina que
// 24% dos itens com % caem em base curta e o percentil AMORTECE para 0,5.
// Resultado: o TAMANHO DO BÔNUS não discrimina (5% e 200% caem no mesmo ~65) e o
// CPM está cego → score semi-artificial (a banda 65 do achado 3 de D-040).
//
// A CORREÇÃO (regra-mãe, SPEC Parte B): NÃO inventar percentil-de-rota onde não há
// rota (o erro do bônus-absoluto rejeitado em D-042/c2). Ranquear o bônus contra a
// **população de ofertas do MESMO tipo+merchant** (todas as compras da Livelo,
// todos os acúmulos do Mercado Livre) — a classe de comparação NATURAL do
// lado-único, onde a escala de valor é a mesma. Sem população defensável →
// **neutro sinalizado**, nunca fabricado (INV-03).
//
// Por que isto NÃO é o bônus-absoluto de D-042/c2: c2 comparava 40% de uma ROTA de
// transferência contra 40% de OUTRA rota (destinos com moedas de valor diferente —
// p50 numa, p99 noutra). Aqui NÃO há destino: o bônus de compra-Livelo é ranqueado
// só entre bônus de compra-Livelo (mesmo contexto de aquisição, mesma escala). É
// comparação like-with-like, não cross-rota. O fallback por-tipo (cross-merchant)
// reintroduziria um resquício do risco c2 → fica marcado como sinal fraco (§vetor).

export const LADO_UNICO_V1 = {
  versao: 'lado_unico.v1',

  // percentil: ECDF-midrank do bônus contra a população do MESMO tipo+merchant.
  //   - merchant (tipo|origem): classe natural. n >= min_merchant → usa, cheio.
  //   - fallback tipo (só tipo): cross-merchant → sinal FRACO, exige barra maior
  //     (min_tipo) E marca base_curta p/ o engine amortecer parte do peso.
  //   - sem população defensável → neutro (0,5, base_n=0): engine puxa a 0,5.
  percentil: {
    janela: 'tipo-merchant',
    min_merchant: 3,   // população mínima do merchant p/ ranqueio cheio (= score_pesos.min_samples)
    min_tipo: 8,       // barra mais alta p/ o fallback cross-merchant (sinal fraco)
    fallback_tipo: true, // operador decide: true = mais discriminação; false = mais neutros honestos
  },

  // eficiência: idêntica à derivação geral — ECDF-inverso do CPM. No lado-único o
  // CPM está cego hoje (1/1.220 tem cpm_value); acende para `compra` no re-score-2
  // (D-039). Ausente → null → engine REDISTRIBUI (D-024), nunca zero que afunda.
  eficiencia: { metodo: 'ecdf-inverso', janela: 'cpm-populacao-global' },

  // raridade: no lado-único não há "frequência de rota". Usa a FREQUÊNCIA DO
  // MERCHANT no tipo (quantas vezes esse merchant roda esse tipo de oferta) —
  // merchant que roda compra todo mês é comum; oferta de merchant de uma vez só é
  // rara. Mesmos buckets de D-037, mas keyados no merchant, não na rota fina (que
  // dava 0,85 a quase tudo por ser n=1). Corrige de quebra o bruto inflado dos
  // itens sem % (conta_nao_calculavel): merchant grande → comum → bruto baixo.
  raridade: {
    janela: 'freq-merchant',
    limiares: [
      { max: 1, valor: 0.85 },
      { max: 2, valor: 0.85 },
      { max: 5, valor: 0.65 },
      { max: 20, valor: 0.45 },
      { max: 50, valor: 0.25 },
      { max: Infinity, valor: 0.10 },
    ],
  },

  // abrangência: mapa público → [0,1], igual à derivação geral (D-037).
  abrangencia: {
    janela: 'publico',
    mapa: { geral: 1.0, cartao: 0.6, selecionados: 0.45, clube: 0.3 },
  },
};

// --------------------------------------------------------------------------
// Helpers puros (espelham derivacao.mjs — mesma convenção de arredondamento/ECDF)
// --------------------------------------------------------------------------
function clamp01(x) {
  if (!Number.isFinite(x)) return null;
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return Math.round(c * 1e4) / 1e4;
}
function normalizarAmostra(entrada) {
  let arr = entrada;
  if (arr && !Array.isArray(arr)) arr = arr.amostra ?? arr.valores;
  if (!Array.isArray(arr)) return [];
  return arr.map(Number).filter(Number.isFinite);
}
function ecdfMidrank(valor, amostra) {
  let abaixo = 0, iguais = 0;
  for (const x of amostra) { if (x < valor) abaixo++; else if (x === valor) iguais++; }
  const n = amostra.length;
  if (n === 0) return { valor: null, base_n: 0 };
  return { valor: (abaixo + 0.5 * iguais) / n, base_n: n };
}

// --------------------------------------------------------------------------
// Componentes — cada um retorna {valor,...} ∈ [0,1] ou null (ausente → redistribui)
// --------------------------------------------------------------------------

/**
 * Percentil do bônus lado-único contra a população do MESMO tipo+merchant.
 * @param {{percentual:number, popMerchant:number[], popTipo:number[]}} args
 *   popMerchant = percentuais de todas as ofertas do mesmo tipo+origem (merchant).
 *   popTipo     = percentuais de todas as ofertas do mesmo tipo (fallback).
 * @returns {{valor,base_n,base_curta,janela,pop_src}|null}
 *   null quando não há `percentual` (sem sinal de valor → conta_nao_calculavel).
 */
export function derivarPercentilLadoUnico({ percentual, popMerchant, popTipo } = {}, config = LADO_UNICO_V1) {
  if (percentual == null || percentual === '') return null;
  const v = Number(percentual);
  if (!Number.isFinite(v)) return null;
  const cfg = config.percentil;
  const merchant = normalizarAmostra(popMerchant);
  const tipo = normalizarAmostra(popTipo);

  if (merchant.length >= cfg.min_merchant) {
    const { valor, base_n } = ecdfMidrank(v, merchant);
    return { valor: clamp01(valor), base_n, base_curta: false, janela: config.percentil.janela, pop_src: 'merchant' };
  }
  if (cfg.fallback_tipo && tipo.length >= cfg.min_tipo) {
    // cross-merchant: sinal fraco → marca base_curta p/ o engine amortecer parte
    // do peso (base_n pequeno artificial evita crédito cheio a um ranqueio misto).
    const { valor } = ecdfMidrank(v, tipo);
    return { valor: clamp01(valor), base_n: 1, base_curta: true, janela: 'tipo', pop_src: 'tipo' };
  }
  // sem população defensável → presente porém NEUTRO (não fabrica, INV-03).
  return { valor: 0.5, base_n: 0, base_curta: true, janela: config.percentil.janela, pop_src: 'neutro' };
}

/** Eficiência do CPM (idêntica à derivação geral). null quando ausente. */
export function derivarEficienciaLadoUnico(cpm_value, distribuicao, config = LADO_UNICO_V1) {
  const cpm = Number(cpm_value);
  if (!Number.isFinite(cpm) || cpm <= 0) return null;
  const amostra = normalizarAmostra(distribuicao);
  if (amostra.length === 0) return null;
  const { valor: rank, base_n } = ecdfMidrank(cpm, amostra);
  return { valor: clamp01(1 - rank), base_n, janela: config.eficiencia.janela };
}

/** Raridade por FREQUÊNCIA DO MERCHANT no tipo. null quando freq desconhecida. */
export function derivarRaridadeLadoUnico(freqMerchant, config = LADO_UNICO_V1) {
  const n = Number(freqMerchant);
  if (!Number.isFinite(n) || n < 1) return null;
  let valor = config.raridade.limiares[config.raridade.limiares.length - 1].valor;
  for (const l of config.raridade.limiares) { if (n <= l.max) { valor = l.valor; break; } }
  return { valor: clamp01(valor), base_n: n, janela: config.raridade.janela };
}

/** Abrangência por público (idêntica à derivação geral). null fora do mapa. */
export function derivarAbrangenciaLadoUnico(publico, config = LADO_UNICO_V1) {
  const v = config.abrangencia.mapa[publico];
  if (!Number.isFinite(v)) return null;
  return { valor: clamp01(v), base_n: null, janela: config.abrangencia.janela };
}

/**
 * Deriva os 4 componentes de UMA campanha lado-única. Puro. Não lê banco.
 * @returns {{componentes:object, pop_src:string|null}}
 */
export function derivarLadoUnico(campanha = {}, contexto = {}, config = LADO_UNICO_V1) {
  const componentes = {};
  const percentil = derivarPercentilLadoUnico(
    { percentual: campanha.percentual, popMerchant: contexto.popMerchant, popTipo: contexto.popTipo }, config);
  if (percentil) componentes.percentil = percentil;
  const eficiencia = derivarEficienciaLadoUnico(campanha.cpm_value, contexto.distribuicaoCpm, config);
  if (eficiencia) componentes.eficiencia = eficiencia;
  const raridade = derivarRaridadeLadoUnico(contexto.freqMerchant, config);
  if (raridade) componentes.raridade = raridade;
  const abrangencia = derivarAbrangenciaLadoUnico(contexto.publico ?? campanha.publico, config);
  if (abrangencia) componentes.abrangencia = abrangencia;
  return { componentes, pop_src: percentil ? percentil.pop_src : null };
}

/**
 * Monta o objeto `entradas` que `calcularScore(entradas, pesos)` consome, no MESMO
 * shape de `montarEntradas` (derivacao.mjs) — só troca a lógica dos componentes
 * pela derivação lado-única. Componentes null são OMITIDOS (não viram zero).
 * @returns {{campaign_id, tem_tier1, componentes, _pop_src}}
 */
export function montarEntradasLadoUnico(campanha = {}, contexto = {}, config = LADO_UNICO_V1) {
  const { componentes, pop_src } = derivarLadoUnico(campanha, contexto, config);
  const temTier1 = contexto.tem_tier1 === true || Number(campanha.tier) === 1;
  return { campaign_id: campanha.id ?? null, tem_tier1: temTier1, componentes, _pop_src: pop_src };
}
