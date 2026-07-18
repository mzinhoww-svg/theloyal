// Vocabulário editorial do Daily (v4, D-059) — módulo PURO, sem I/O.
// Consolida no engine as regras aprendidas nas rodadas editoriais operador↔rascunho
// para que rascunho manual e pipeline nunca divirjam de novo:
//  (1) nomes de programa legíveis (código do banco → nome do leitor);
//  (2) rota de exibição (compra/clube exibe o PRÓPRIO programa, nunca "sem destino");
//  (3) lint de jargão interno banido de texto voltado ao leitor;
//  (4) strings canônicas do estado "sem confirmação" (fonte única);
//  (5) ordenação determinística do Clipping por relevância editorial;
//  (6) narrativa do Predict com probabilidade sempre visível (D-059 §3) —
//      templating puro, nunca revela valor/data de janela futura.

// Código (origem_code/destino_code de `campaigns`) → nome de exibição.
// Código desconhecido NUNCA lança: cai no próprio código (fallback legível o
// suficiente; o gate/QA aponta, não o render).
export const NOME_PROGRAMA = {
  smiles: 'Smiles',
  livelo: 'Livelo',
  esfera: 'Esfera',
  azul: 'Azul',
  azul_fidelidade: 'Azul Fidelidade',
  latam_pass: 'LATAM Pass',
  itau: 'Itaú',
  inter: 'Inter',
  c6: 'C6',
  bradesco: 'Bradesco',
  banco_do_brasil: 'Banco do Brasil',
  caixa: 'Caixa',
  brb: 'BRB',
  nubank: 'Nubank',
  santander: 'Santander',
  btg: 'BTG',
  xp: 'XP',
  picpay: 'PicPay',
  membership_rewards: 'Amex Membership Rewards',
  multiplos_cartoes: 'Múltiplos cartões',
  hilton: 'Hilton Honors',
  lifemiles: 'LifeMiles',
  accor: 'ALL Accor',
  flyingblue: 'Flying Blue',
  bnb: 'Banco do Nordeste',
  hyatt: 'World of Hyatt',
  mercado_livre: 'Mercado Livre',
  costa_cruzeiros: 'Costa Cruzeiros',
  shell: 'Shell',
  uber: 'Uber',
  aliexpress: 'AliExpress',
};

/** @param {string|null|undefined} code @returns {string} nome legível (fallback: o próprio código, nunca lança) */
export function nomePrograma(code) {
  if (code === null || code === undefined || code === '') return '';
  return NOME_PROGRAMA[code] ?? String(code);
}

// Rótulo de tipo (taxonomia D-001) → rótulo do leitor.
export const TIPO_LABEL = {
  transferencia: 'Transferência bonificada',
  compra: 'Compra de pontos',
  clube: 'Clube',
  cartao: 'Cartão',
  hotelaria: 'Hotelaria',
  pontos_mais_dinheiro: 'Pontos + dinheiro',
};

/** @param {string|null|undefined} tipo @returns {string} */
export function tipoLabel(tipo) {
  if (!tipo) return '';
  return TIPO_LABEL[tipo] ?? String(tipo).replace(/_/g, ' ');
}

const DESTINO_VAZIO = new Set(['sem_destino', 'sem destino']);
function destinoReal(destino) {
  if (destino === null || destino === undefined || destino === '') return null;
  return DESTINO_VAZIO.has(String(destino).toLowerCase()) ? null : destino;
}

/**
 * Rota de exibição de um item (regra ratificada pelo operador, D-059):
 * - `compra`/`clube` (compra de pontos / programa próprio) exibe o PRÓPRIO
 *   programa dos dois lados — "Smiles → Smiles" — NUNCA "→ sem destino". O
 *   programa é o destino quando presente (fixtures legadas com origem "brl"),
 *   senão a origem (shape do banco: origem=programa, destino=sem_destino/null).
 * - `pontos_mais_dinheiro` mantém origem → destino (a jogada é comprar em A e
 *   transferir para B).
 * - `transferencia`/demais: origem → destino com nomes legíveis; destino
 *   nulo/sem_destino exibe só a origem.
 * @param {{origem?:string, destino?:string|null, tipo?:string}} item
 * @returns {string}
 */
export function rotaDisplay(item = {}) {
  const destino = destinoReal(item.destino);
  if (item.tipo === 'compra' || item.tipo === 'clube') {
    const programa = nomePrograma(destino ?? item.origem);
    return `${programa} → ${programa}`;
  }
  return destino
    ? `${nomePrograma(item.origem)} → ${nomePrograma(destino)}`
    : nomePrograma(item.origem);
}

// Jargão interno de pipeline banido de qualquer texto voltado ao leitor
// (D-059, aprendizado das rodadas editoriais). "TIER 1" no texto do leitor
// vira "fonte oficial" — a taxonomia interna não vaza.
export const JARGAO_PROIBIDO = [
  { termo: 'conta computável', re: /conta comput[áa]ve(l|is)/iu },
  { termo: 'candidato vivo', re: /candidatos? vivos?/iu },
  { termo: 'TIER 1', re: /TIER ?1/i },
  { termo: 'TIER 2', re: /tier ?2/i },
  { termo: 'veredito da régua', re: /veredito da r[ée]gua/iu },
  { termo: 'recomputado', re: /recomputad/iu },
  { termo: 'tl_score_bruto', re: /tl_score_bruto/i },
  { termo: 'veredito_bruto', re: /veredito_bruto/i },
  { termo: 'estado vivo', re: /estado vivo/iu },
  { termo: 'três portões', re: /tr[êe]s port[õo]es|3 port[õo]es/iu },
];

/** @param {string} texto @returns {string[]} termos banidos encontrados (vazio = limpo) */
export function lintJargao(texto) {
  const t = String(texto ?? '');
  return JARGAO_PROIBIDO.filter(({ re }) => re.test(t)).map(({ termo }) => termo);
}

// Strings canônicas do estado "sem confirmação" — fonte única (D-059).
export const STATUS_SEM_CONFIRMACAO = 'Ainda sem confirmação oficial';
export const EXPLICA_SEM_NOTA = 'Quando a regra ainda não foi confirmada no site oficial do programa, a oferta aparece sem nota TL — a nota só sai depois da confirmação.';

// Ordenação do Clipping por relevância editorial (v4): loyalty acionável no
// topo, aviação/loyalty geral no meio, lounge/hotel/experiência no fim.
// Determinística e estável (empate mantém a ordem original).
const RE_CLIPPING_ACIONAVEL = /compra de (pontos|milhas)|desconto.*pontos|pontos por (real|d[óo]lar)|milhas por d[óo]lar|b[ôo]nus|transfer[êe]ncia|ac[úu]mulo/iu;
const RE_CLIPPING_EXPERIENCIA = /lounge|hot[ée]is|hotel|di[áa]rias|sala vip/iu;

/** @param {{title?:string, summary?:string}} item @returns {0|1|2} */
export function scoreRelevanciaClipping(item = {}) {
  const texto = `${item.title ?? ''} ${item.summary ?? ''}`;
  if (RE_CLIPPING_ACIONAVEL.test(texto)) return 0;
  if (RE_CLIPPING_EXPERIENCIA.test(texto)) return 2;
  return 1;
}

/** @param {object[]} itens @returns {object[]} novo array ordenado (não muta a entrada) */
export function ordenarClippingPorRelevancia(itens = []) {
  return (itens || [])
    .map((item, i) => ({ item, i, score: scoreRelevanciaClipping(item) }))
    .sort((a, b) => (a.score - b.score) || (a.i - b.i))
    .map((x) => x.item);
}

// Narrativa do Predict (D-059 §3): probabilidade sempre visível, nos dois
// sentidos — quando NÃO há janela prevista, diz isso com todas as letras.
export const PALAVRA_PROBABILIDADE = {
  baixa: 'baixa',
  media: 'média',
  alta: 'alta',
  'em-formacao': 'em formação',
};

const TEASER_DIGEST_PRO = 'O recorte completo do Predict, com as janelas acompanhadas, sai no Digest Pro.';

/**
 * Templating puro da frase orgânica do Predict no corpo editorial. NUNCA cita
 * data/janela futura específica (regra-mãe do teaser mantida), nunca urgência,
 * nunca promessa de ganho. O gate 5.5 recomputa `texto === formatarPredictNarrativa(...)`.
 * @param {{rotaOrigem:string, rotaDestino:string, historicoTipicoPercent?:number|null, probabilidade:'baixa'|'media'|'alta'|'em-formacao'}} args
 * @returns {string}
 * @throws {Error} probabilidade fora do vocabulário — sem fallback silencioso
 */
export function formatarPredictNarrativa({ rotaOrigem, rotaDestino, historicoTipicoPercent = null, probabilidade } = {}) {
  const palavra = PALAVRA_PROBABILIDADE[probabilidade];
  if (palavra === undefined) {
    throw new Error(
      `formatarPredictNarrativa: probabilidade desconhecida "${probabilidade}" — válidas: ${Object.keys(PALAVRA_PROBABILIDADE).join(', ')}`,
    );
  }
  const rota = `${nomePrograma(rotaOrigem)} → ${nomePrograma(rotaDestino)}`;
  const historico = historicoTipicoPercent !== null && historicoTipicoPercent !== undefined
    ? ` (histórico típico de bônus na faixa de ${historicoTipicoPercent}%)`
    : '';
  if (probabilidade === 'baixa' || probabilidade === 'em-formacao') {
    const motivo = probabilidade === 'em-formacao'
      ? 'a base histórica da rota ainda está em formação'
      : 'a probabilidade de uma nova janela é baixa';
    return `O Predict acompanha a rota ${rota}${historico}. Por ora, ${motivo} — sem promoção de transferência à vista. ${TEASER_DIGEST_PRO}`;
  }
  return `O Predict acompanha a rota ${rota}${historico} e vê probabilidade ${palavra} de uma nova janela nesta rota. ${TEASER_DIGEST_PRO}`;
}

// Formatação de data BR — compartilhada pelos dois renderers (fonte única).
/** @param {string} iso @returns {string} dd/mm/yyyy (entrada fora do formato ISO volta como veio) */
export function formatarDataBr(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso ?? '');
}

/** @param {string} iso @returns {string} dd/mm */
export function formatarDiaMes(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : String(iso ?? '');
}
