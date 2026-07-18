// gate-unico.mjs — GATE ÚNICO BLOQUEANTE do Daily (M2.4). Uma entrada só,
// `gate(edition, ctx)`, que roda as três camadas existentes NA ORDEM e devolve
// pass/fail + a lista de violações com a camada e a regra. DELEGA — não
// reimplementa nada: os módulos puros (renderer/validate, pre-superficie,
// gate-5-5) seguem sendo a autoridade e mantêm seus próprios golden. Este
// módulo é só o encadeamento bloqueante, para o runner diário ter UM ponto.
//
// Ordem (cravada pelo operador): schema → dado → editorial.
//   1. SCHEMA   (scripts/validate.validateEdition — o validador v4 camelCase,
//      NÃO o legado renderer/validate.mjs que é v1 snake_case) → erro BLOQUEIA.
//   2. DADO     (pre-superficie.verificarPreSuperficie) → NÃO bloqueia. Flag é
//      revisão, nunca descarte nem barreira (D-060, autoridade acima do "uma
//      falha bloqueia"): a camada anexa a fila de revisão ao resultado; o
//      operador a vê antes de aprovar (A4). Para BLOQUEAR em flag, é decisão
//      nova do operador — o default honra o D-060.
//   3. EDITORIAL (gate-5-5.runGate55)                 → erro BLOQUEIA.
import { validateEdition } from '../../scripts/validate.mjs';
import { verificarPreSuperficie } from './verificacao/pre-superficie.mjs';
import { runGate55 } from './digest/gate-5-5.mjs';
import { filtrarVivos } from './digest/montar-edicao.mjs';

export const CAMADAS = Object.freeze(['schema', 'dado', 'editorial']);

/**
 * @param {object} edition           edição no contrato do schema
 * @param {object} ctx
 * @param {object[]} ctx.campaignsFromDb  linhas de campaigns (para dado + editorial)
 * @param {string}  ctx.renderedHtml      HTML renderizado (para checks que o leem)
 * @param {string}  ctx.now               ISO de referência para vigência (schema)
 * @param {string}  ctx.hoje              YYYY-MM-DD (editorial: fechou-semana)
 * @param {boolean} ctx.lenient           afrouxa limites do schema
 * @returns {{pass:boolean, camada:string|null, violacoes:string[], warnings:string[],
 *            revisao:Array<{item:object,flags:object[]}>, resumo:object}}
 */
export function gate(edition, ctx = {}) {
  const {
    campaignsFromDb = [], renderedHtml = '', now, hoje, lenient = false,
    radarDailyWindows, bancosOrigem, dealDeskMarker, checkLink,
  } = ctx;
  const warnings = [];

  // ── Camada 1: SCHEMA (bloqueia) ──────────────────────────────────────────
  const schema = validateEdition(edition, { lenient, now });
  warnings.push(...schema.warnings.map((w) => `schema: ${w}`));
  if (schema.errors.length > 0) {
    return {
      pass: false, camada: 'schema',
      violacoes: schema.errors.map((e) => `schema: ${e}`),
      warnings, revisao: [], resumo: { bloqueou_em: 'schema' },
    };
  }

  // ── Camada 2: DADO (não bloqueia — flag é revisão, D-060) ────────────────
  // A fila de revisão é sobre OFERTAS VIVAS. O fetch do runner também traz mortas
  // (encerrada∧tier1, para o recap); um flag numa morta NÃO pode contar como
  // pendência que trava o auto-publish de um dia limpo (M8). Fonte única = vivos.
  const { paraRevisao } = verificarPreSuperficie(filtrarVivos(campaignsFromDb));

  // ── Camada 3: EDITORIAL (bloqueia) ───────────────────────────────────────
  const editorial = runGate55(edition, {
    campaignsFromDb, renderedHtml, hoje, radarDailyWindows, bancosOrigem, dealDeskMarker,
    ...(checkLink ? { checkLink } : {}),
  });
  warnings.push(...editorial.warnings.map((w) => `editorial: ${w}`));
  if (!editorial.pass) {
    return {
      pass: false, camada: 'editorial',
      violacoes: editorial.errors.map((e) => `editorial: ${e}`),
      warnings, revisao: paraRevisao,
      resumo: { bloqueou_em: 'editorial', para_revisao: paraRevisao.length },
    };
  }

  // Passou schema + editorial. A fila de dado (revisao) vai junto, não barra.
  return {
    pass: true, camada: null, violacoes: [], warnings, revisao: paraRevisao,
    resumo: { bloqueou_em: null, para_revisao: paraRevisao.length },
  };
}
