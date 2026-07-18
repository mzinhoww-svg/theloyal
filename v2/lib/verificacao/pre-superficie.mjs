// Verificação PRÉ-PUBLICAÇÃO (D-060) — roda antes de qualquer item entrar em
// QUALQUER superfície editorial (Digest Engine, radar de ativos, futuras páginas
// M3). PURA, sem I/O — recebe linhas já lidas de `campaigns`.
//
// Princípio cravado pelo operador (D-060): TODO check é FLAG PARA REVISÃO,
// nunca descarte automático — errar sumindo com promoção real é pior que
// errar mandando item bom para a fila de revisão. A única semântica que um
// flag carrega além de "revisar" é o bloqueio de DESTAQUE (headline/"melhor
// do dia"), que não remove o item da listagem.
//
// Nasceu dos 6 erros reais corrigidos em produção nesta rodada:
//   BNB→Azul   vigência 2024 numa matéria de 2026 (bug de inferência de ano)
//   FlyingBlue promo real com valor e SEM data → invisível como "indeterminada"
//   AliExpress "25 pontos/dólar" (acúmulo) tipado como compra com "25%"
//   Bradesco   sorteio tipado como transferência bonificada
//   Caixa      cashback de IOF (tarifa) tratado como bônus percentual
//   BB Ourocard número que a fonte linkada não sustenta — este NÃO é
//              automatizável por heurística local (exige conferir o conteúdo
//              da matéria); o dono desse caso é a corroboração de termos da
//              coleta TIER 1 (D-045), não este módulo. Documentado, não fingido.

export const FLAGS = {
  VIGENCIA_BUG_ANO: 'vigencia_bug_ano',
  VALOR_SEM_DATA: 'valor_sem_data',
  TIPO_ACUMULO: 'tipo_suspeito_acumulo_em_parceiro',
  TIPO_SORTEIO: 'tipo_suspeito_sorteio',
  TIPO_TARIFA: 'tipo_suspeito_beneficio_tarifa',
  CONFIANCA_BAIXA_DESTAQUE: 'confianca_baixa_para_destaque',
  PERCENTUAL_TETO: 'percentual_acima_teto_sanidade',
};

// P2 (D-061, espelha D-041 R5 — teto plausível POR TIPO, configurável): ghosts
// de extração (120.000% = pontos de boas-vindas lidos como percentual) saem do
// percentil e vão a revisão. Compra/clube têm bônus reais de 300–375% (Smiles
// 375 TIER1 confirmada), então o teto delas é o piso 300; os demais tipos
// (transferência/cartão/hotelaria...) raramente passam de 130% — teto 200.
// FLAG DE REVISÃO, nunca reclassificação automática: item real flagado (ex. a
// própria Smiles 375) continua publicável — o flag pede o olho humano e tira o
// número da ECDF até confirmar.
export const TETO_SANIDADE_PERCENTUAL = { compra: 300, clube: 300, padrao: 200 };

/**
 * @param {object} item
 * @returns {Array<{flag:string, motivo:string}>}
 */
export function checkSanidadePercentual(item) {
  const pct = Number(item?.percentual);
  if (!Number.isFinite(pct)) return [];
  const teto = TETO_SANIDADE_PERCENTUAL[item?.tipo] ?? TETO_SANIDADE_PERCENTUAL.padrao;
  if (pct > teto) {
    return [{
      flag: FLAGS.PERCENTUAL_TETO,
      motivo: `percentual ${pct}% acima do teto de sanidade do tipo "${item?.tipo}" (${teto}%) — fora do percentil até revisão humana; provável erro de extração`,
    }];
  }
  return [];
}

// Dias de folga: vigência mais de N dias antes do first_seen = "venceu antes
// de nascer" (o padrão do bug de ano). 180 evita falso-positivo de item visto
// nos últimos dias de vigência.
export const JANELA_BUG_ANO_DIAS = 180;
// Nota a partir da qual um item vira candidato a destaque/headline.
export const LIMIAR_DESTAQUE = 60;

/** Extrai a confiança gravada em notes ("[confianca:baixa]" etc.). */
export function confiancaDe(notes) {
  const m = /\[confianca:(alta|media|baixa)\]/i.exec(String(notes || ''));
  return m ? m[1].toLowerCase() : null;
}

/**
 * Sanidade de vigência. Flags:
 * - VIGENCIA_BUG_ANO: vigência terminou muito antes do item ser visto pela
 *   primeira vez (matéria recente + vigência no passado distante = ano errado,
 *   caso BNB). Sinaliza em vez de deixar o FSM enterrar como "historica".
 * - VALOR_SEM_DATA: item com conta fechada (tl_score_bruto) mas sem vigência
 *   extraída (caso Flying Blue) — promo real invisível como "indeterminada".
 * @param {object} item  linha de campaigns
 * @returns {Array<{flag:string, motivo:string}>}
 */
export function checkSanidadeVigencia(item) {
  const flags = [];
  const vig = item?.vigencia_fim_date ? Date.parse(item.vigencia_fim_date) : NaN;
  const visto = item?.first_seen ? Date.parse(item.first_seen) : NaN;
  if (!Number.isNaN(vig) && !Number.isNaN(visto) && vig < visto - JANELA_BUG_ANO_DIAS * 86400000) {
    flags.push({
      flag: FLAGS.VIGENCIA_BUG_ANO,
      motivo: `vigencia_fim (${item.vigencia_fim_date}) termina >${JANELA_BUG_ANO_DIAS}d antes do first_seen (${item.first_seen}) — provável ano errado na extração`,
    });
  }
  if (item?.estado === 'indeterminada' && item?.tl_score_bruto !== null && item?.tl_score_bruto !== undefined) {
    flags.push({
      flag: FLAGS.VALOR_SEM_DATA,
      motivo: 'item com conta fechada mas sem vigência extraída — promo possivelmente real ficando invisível como "indeterminada"',
    });
  }
  return flags;
}

/**
 * Classificação de tipo de oferta. Distingue compra/desconto vs. acúmulo
 * (pontos por dólar/real) vs. sorteio vs. cashback de tarifa — os erros
 * AliExpress/Bradesco/Caixa foram tratar tipo errado como bônus percentual.
 * @param {object} item
 * @returns {Array<{flag:string, motivo:string}>}
 */
export function checkTipoOferta(item) {
  const flags = [];
  const paridade = String(item?.paridade || '');
  const notes = String(item?.notes || '');
  const tipo = item?.tipo;

  if (/por\s+(dolar|d[óo]lar|real)/i.test(paridade) && (tipo === 'compra' || tipo === 'transferencia')) {
    flags.push({
      flag: FLAGS.TIPO_ACUMULO,
      motivo: `paridade "${item.paridade}" indica acúmulo em parceiro, mas tipo="${tipo}" — o percentual pode não ser bônus de compra/transferência`,
    });
  }
  if (/sorte/i.test(notes) && tipo !== 'sorteio' && tipo !== 'concurso') {
    flags.push({ flag: FLAGS.TIPO_SORTEIO, motivo: `notes mencionam sorteio mas tipo="${tipo}" — sorteio não tem conta a fazer` });
  }
  if (/\bIOF\b|anuidade/i.test(notes) && item?.percentual !== null && item?.percentual !== undefined) {
    flags.push({
      flag: FLAGS.TIPO_TARIFA,
      motivo: 'notes indicam benefício de tarifa (IOF/anuidade) com percentual preenchido — "100%" de cashback de tarifa não é bônus de pontos (D-018)',
    });
  }
  return flags;
}

/**
 * Confiança da fonte antes de virar destaque: item de confiança baixa nunca
 * vira "melhor do dia"/headline, mesmo com número atraente (caso AliExpress).
 * O flag NÃO remove o item da listagem — só bloqueia o destaque.
 * @param {object} item
 * @param {{limiarDestaque?:number}} opts
 * @returns {Array<{flag:string, motivo:string}>}
 */
export function checkConfiancaDestaque(item, { limiarDestaque = LIMIAR_DESTAQUE } = {}) {
  const conf = confiancaDe(item?.notes);
  const score = item?.tl_score_bruto;
  if (conf === 'baixa' && typeof score === 'number' && score >= limiarDestaque) {
    return [{
      flag: FLAGS.CONFIANCA_BAIXA_DESTAQUE,
      motivo: `nota ${score} qualificaria destaque, mas confiança da fonte é baixa — citável só com link+status, nunca como headline/"melhor do dia"`,
    }];
  }
  return [];
}

/**
 * Passada completa. NUNCA descarta: item com flag vai para `paraRevisao` COM
 * o item junto (nada some); itens sem flag em `aprovados`.
 * @param {object[]} itens  linhas de campaigns
 * @param {{limiarDestaque?:number}} opts
 * @returns {{aprovados:object[], paraRevisao:Array<{item:object, flags:Array<{flag:string,motivo:string}>}>}}
 */
export function verificarPreSuperficie(itens = [], opts = {}) {
  const aprovados = [];
  const paraRevisao = [];
  for (const item of itens) {
    const flags = [
      ...checkSanidadeVigencia(item),
      ...checkTipoOferta(item),
      ...checkConfiancaDestaque(item, opts),
      ...checkSanidadePercentual(item),
    ];
    if (flags.length === 0) aprovados.push(item);
    else paraRevisao.push({ item, flags });
  }
  return { aprovados, paraRevisao };
}
