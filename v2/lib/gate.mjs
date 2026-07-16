// Gate de rejeição — camada A (determinística). Determinismo-primeiro (brief).
// Puro, sem I/O. Só rejeita com regra NOMEADA; na dúvida devolve {passa:true} p/ camada B.
// Invariante (D-017): NUNCA rejeita campanha real. Testado em gate.test.mjs.

export const norm = (s) => (s == null ? '' : String(s).toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, ''));

// Unidade de fidelidade presente? (ponto/milha/cashback/bônus de transferência)
// Se presente, quase nunca é rejeição determinística — protege campanhas reais.
const TEM_MECANICA = /(pontos?|milhas?|milheiro|cashback|bonus|transferenc)/;

// Fontes cujo PRÓPRIO produto vira notícia (curso/mentoria). Extensível.
const BLOG_PRODUTO = /(\b(cursos?|mentoria|masterclass)\b|dominando o|assine nosso)/;

// Perks sem mecânica de pontos (D-012). Benefício nomeado, não é ponto/milha.
// Sem \b nas pontas: quebra em "disney+" (o + não é caractere de palavra).
const PERK = /(salas? vip|uber one|disney\+|gemini|clube ifood|ifood gratis|streaming gratis)/;

// Cupom/desconto de varejo (sem mecânica de pontos).
const CUPOM = /(\bcupom\b|\boff\b|% de desconto|r\$ ?\d[\d.,]* de desconto|desconto no abastec)/;

// Tarifa/pacote em dinheiro.
const TARIFA = /(a partir de r\$|di[aá]rias?|all inclusive|\bvoos?\b|\bpassagens?\b|\bpacotes?\b)/;

/**
 * @param {{news_item_id:string, titulo:string, trecho?:string, tipo?:string,
 *          percentual?:number|null, origem?:string, destino?:string}} item
 * @param {{issuers?: Set<string>}} [ctx] issuers = tokens de programas emissores
 *          de ponto/milha (aéreo/bancário/hotel). Promotor emissor → cupom/tarifa
 *          NÃO disparam (sobe para B): "Smiles oferece 30% de desconto no resgate"
 *          é promo de programa, não cupom de varejo.
 * @returns {{rejeitado:true, motivo:string, camada:'deterministica', evidencia:string}
 *          | {passa:true}}
 */
export function camadaA(item, ctx = {}) {
  const issuers = ctx.issuers || new Set();
  const texto = norm(`${item.titulo || ''} ${item.trecho || ''}`);
  const tipo = norm(item.tipo);
  const temMecanica = TEM_MECANICA.test(texto);
  const promotorEmissor = issuers.has(norm(item.origem));

  // produto_blog — a fonte vendendo o próprio produto; independe de mecânica.
  if (BLOG_PRODUTO.test(texto)) return rej('produto_blog', match(texto, BLOG_PRODUTO));

  // perk_sem_pontos — benefício nomeado E sem mecânica de ponto/milha/cashback.
  if (PERK.test(texto) && !temMecanica) return rej('perk_sem_pontos', match(texto, PERK));

  // cupom_varejo — só se NÃO for promo de programa emissor.
  if (CUPOM.test(texto) && !temMecanica && !promotorEmissor) return rej('cupom_varejo', match(texto, CUPOM));

  // tarifa_pacote_dinheiro — hotelaria/tarifa em R$, sem mecânica, não-emissor.
  if ((tipo === 'hotelaria' || TARIFA.test(texto)) && !temMecanica && !promotorEmissor) {
    return rej('tarifa_pacote_dinheiro', tipo === 'hotelaria' ? 'tipo=hotelaria sem pontos' : match(texto, TARIFA));
  }
  return { passa: true };
}

function rej(motivo, evidencia) { return { rejeitado: true, motivo, camada: 'deterministica', evidencia }; }
function match(texto, re) { const m = texto.match(re); return m ? m[0] : ''; }

export const REGRAS_A = ['produto_blog', 'perk_sem_pontos', 'cupom_varejo', 'tarifa_pacote_dinheiro'];

// Constrói o Set de emissores a partir do seed (kind aéreo/bancário/hotel).
export function issuersDoSeed(seed) {
  const s = new Set();
  for (const p of seed.programas || []) {
    if (!['aereo', 'bancario', 'hotel'].includes(p.kind)) continue;
    if (p.code) s.add(norm(p.code));
    for (const a of p.aliases || []) s.add(norm(a));
  }
  return s;
}
