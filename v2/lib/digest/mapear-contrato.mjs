// Mapeamento DB → contrato (M2 · Digest Engine, SPEC-SLICE-DIGEST-ENGINE.md §1.5).
// PURO, sem I/O. Determinismo-primeiro (INV-12): dois achados de tradução —
// nenhum é cálculo, são mapas fixos 1:1. NUNCA fallback silencioso (rótulo/
// componente fora do mapa = erro, nunca vira "Não confirmado" ou desaparece).

// (a) Veredito: rótulo do banco (português, `veredito_bruto`) → enum kebab-case
// do schema ($defs/verdict em content/edition.schema.json).
export const MAPA_VEREDITO = {
  'Vale agir': 'vale-agir',
  'Vale olhar': 'vale-olhar',
  'Só para casos específicos': 'casos-especificos',
  Esperaria: 'esperaria',
  Evitaria: 'evitaria',
  'Não confirmado': 'nao-confirmado',
};

/**
 * @param {string} veredito_bruto  rótulo em português gravado em `campaigns.veredito_bruto`
 *   (ou `campaigns.veredito`)
 * @returns {string}  chave kebab-case do $defs/verdict
 * @throws {Error}  quando o rótulo não está no mapa — nunca defaulta para
 *   "nao-confirmado" (isso esconderia um rótulo novo/typo no banco, D-053 §1.5)
 */
export function mapVeredito(veredito_bruto) {
  const mapeado = MAPA_VEREDITO[veredito_bruto];
  if (mapeado === undefined) {
    throw new Error(
      `mapVeredito: rótulo desconhecido "${veredito_bruto}" — sem fallback silencioso. ` +
        `Rótulos válidos: ${Object.keys(MAPA_VEREDITO).join(', ')}`,
    );
  }
  return mapeado;
}

// (b) scoreBreakdown: shape real do `calcularScore(...).breakdown` (v2/lib/score.mjs)
// → shape do $defs/scoreBreakdown do schema (patch D-052/D-053, 4 componentes reais).
const COMPONENTES_VALIDOS = new Set(['percentil', 'eficiencia', 'raridade', 'abrangencia']);

/**
 * @param {Array<{componente:string, valor:number, valor_bruto:number, peso:number,
 *   peso_efetivo:number, contribuicao?:number, base_n?:number|null, janela?:string|null,
 *   base_curta?:boolean}>} breakdownFromScoreMjs  o array `.breakdown` retornado por
 *   `calcularScore` (v2/lib/score.mjs) — NUNCA recalcula, só traduz o shape já pronto.
 * @returns {{percentil?:object, eficiencia?:object, raridade?:object, abrangencia?:object}}
 *   objeto no shape do $defs/scoreBreakdown (camelCase), chaveado por componente.
 *   Componente ausente no breakdown (redistribuído, §2.1 de derivacao.mjs) simplesmente
 *   não aparece na chave de saída — não é inventado como zero.
 * @throws {Error}  se o breakdown citar um componente fora dos 4 conhecidos (o engine
 *   mudou de shape sem este mapa ser atualizado — nunca traduz às cegas)
 */
export function mapScoreBreakdown(breakdownFromScoreMjs) {
  const breakdown = Array.isArray(breakdownFromScoreMjs) ? breakdownFromScoreMjs : [];
  const out = {};
  for (const item of breakdown) {
    if (!COMPONENTES_VALIDOS.has(item?.componente)) {
      throw new Error(
        `mapScoreBreakdown: componente desconhecido "${item?.componente}" — ` +
          `score.mjs mudou de shape sem atualizar mapear-contrato.mjs`,
      );
    }
    out[item.componente] = {
      valor: item.valor,
      valorBruto: item.valor_bruto,
      baseN: item.base_n ?? null,
      peso: item.peso,
      pesoEfetivo: item.peso_efetivo,
      janela: item.janela ?? null,
    };
  }
  return out;
}
