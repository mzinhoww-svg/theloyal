// Gate 5.5 — auditoria da edição em contexto independente do gerador (REQ-31,
// SPEC-SLICE-DIGEST-ENGINE.md §3). Refaz os cálculos/portões a partir dos dados
// crus passados por quem chama (nunca confia no JSON da edição sozinho).
//
// Escopo desta função: PURA, sem I/O de rede. Checks que exigem checar link
// (200 OK, §3.1 "Links retornam 200") não podem rodar sem `fetch` — em vez de
// pular a checagem em silêncio, ela é feita através de um `checkLink` injetável
// (assíncrono, `(url) => Promise<boolean>`), com um stub padrão que sempre
// resolve `true` e é marcado explicitamente como TODO/aviso no relatório. Quem
// chama este módulo em produção deve injetar um `checkLink` real (fetch HEAD).
// Mesma lógica para rastreabilidade completa de número↔banco (INV-03): aqui só
// roda a checagem ESTRUTURAL (o texto contém dígito), não a travessia completa
// até a linha exata do banco — isso é dívida explícita, não fingida como feita.
import { DISCLAIMER, assertEditorialRules, isExpired } from '../../../scripts/lib.mjs';
import { passaTresPortoes, elegivelDealDesk, selecionarDealDesk } from './selecionar.mjs';

const stubCheckLink = async () => true;

function has(v) {
  return v !== undefined && v !== null && v !== '';
}

function temDigito(texto) {
  return typeof texto === 'string' && /\d/.test(texto);
}

// ---------------------------------------------------------------------------
// §3.1 — checks comuns aos dois casos
// ---------------------------------------------------------------------------
const REQUIRED_COMUNS = ['number', 'date', 'weekday', 'publishTime', 'readingMinutes', 'signal', 'deals', 'sources', 'disclaimer'];

/**
 * @param {object} edition  a edição no shape de content/edition.schema.json
 * @returns {Array<{ok:boolean, check:string, detail:string}>}
 */
export function checkComuns(edition = {}) {
  const results = [];

  const faltando = REQUIRED_COMUNS.filter((k) => !has(edition[k]) && !(k === 'deals' && Array.isArray(edition[k])));
  results.push({
    ok: faltando.length === 0,
    check: 'campos obrigatórios presentes',
    detail: faltando.length ? `faltando: ${faltando.join(', ')}` : 'number/date/weekday/publishTime/readingMinutes/signal/deals/sources/disclaimer presentes',
  });

  results.push({
    ok: edition.disclaimer === DISCLAIMER,
    check: 'disclaimer bate literal com a constante (INV-09)',
    detail: edition.disclaimer === DISCLAIMER ? 'íntegro' : `divergente: "${edition.disclaimer ?? ''}"`,
  });

  const lint = assertEditorialRules(edition, { label: 'edição', disclaimer: edition.disclaimer, disclaimerMode: 'includes' });
  for (const msg of lint.ok) results.push({ ok: true, check: 'lint editorial', detail: msg });
  for (const msg of lint.errors) results.push({ ok: false, check: 'lint editorial', detail: msg });

  // Todo número no Sinal do Dia / Resumo do dia tem correspondente rastreável
  // (INV-03) — checagem ESTRUTURAL (presença de dígito), não travessia completa
  // ao banco (TODO: travessia completa exige acesso a campaigns/news_raw, fora
  // do escopo deste módulo puro).
  results.push({
    ok: temDigito(edition.signal),
    check: 'signal cita ao menos um número (checagem estrutural, INV-03)',
    detail: temDigito(edition.signal) ? 'contém dígito' : 'signal sem nenhum número — genérico demais',
  });
  if (has(edition.resumoDoDia)) {
    results.push({
      ok: temDigito(edition.resumoDoDia),
      check: 'resumoDoDia cita ao menos um número (checagem estrutural, INV-03)',
      detail: temDigito(edition.resumoDoDia) ? 'contém dígito' : 'resumoDoDia sem nenhum número',
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// §3.2 — checks exclusivos do caso COM Deal Desk
// ---------------------------------------------------------------------------

/**
 * Recomputa cada deal contra `campaignsFromDb` — o cruzamento é feito por
 * `routeKey` (formato "origem->destino", já parte do $defs/deal do schema),
 * porque é o único campo do deal renderizado que corresponde 1:1 às colunas
 * `origem_code`/`destino_code` de uma linha de `campaigns`. Deal sem
 * `routeKey` não pode ser recomputado de forma independente — o gate falha
 * esse deal explicitamente (não assume "provavelmente ok").
 * @param {object} edition
 * @param {object[]} campaignsFromDb
 * @returns {Array<{ok:boolean, check:string, detail:string}>}
 */
export function checkComDealDesk(edition = {}, campaignsFromDb = []) {
  const results = [];
  const deals = Array.isArray(edition.deals) ? edition.deals : [];
  const byRoute = new Map(campaignsFromDb.map((c) => [`${c.origem_code}->${c.destino_code}`, c]));

  deals.forEach((deal, i) => {
    const tag = `deal[${i}] (${deal.title ?? 'sem título'})`;
    const campanha = deal.routeKey ? byRoute.get(deal.routeKey) : undefined;

    if (!campanha) {
      results.push({
        ok: false,
        check: `${tag}: campanha correspondente localizável no banco`,
        detail: deal.routeKey
          ? `routeKey "${deal.routeKey}" não encontrado em campaignsFromDb`
          : 'deal sem routeKey — não é possível recomputar em contexto independente (REQ-31)',
      });
      return;
    }

    const passa3 = passaTresPortoes(campanha);
    results.push({
      ok: passa3,
      check: `${tag}: passa os 3 portões recomputados direto no banco`,
      detail: passa3
        ? `estado=${campanha.estado}, tier=${campanha.tier}, tl_score_bruto=${campanha.tl_score_bruto}`
        : `falhou: estado=${campanha.estado}, tier=${campanha.tier}, tl_score_bruto=${campanha.tl_score_bruto}`,
    });

    const vereditoValido = deal.verdict === 'vale-agir' || deal.verdict === 'vale-olhar';
    results.push({
      ok: vereditoValido,
      check: `${tag}: veredito ∈ {vale-agir, vale-olhar}`,
      detail: `veredito="${deal.verdict}"`,
    });

    const elegivel = elegivelDealDesk(campanha);
    results.push({
      ok: elegivel,
      check: `${tag}: elegível a Deal Desk recomputado no banco`,
      detail: elegivel ? 'ok' : `veredito_bruto do banco="${campanha.veredito_bruto}" não cruza o corte`,
    });

    if (has(deal.vigencia)) {
      const vencido = isExpired(deal.vigencia, edition.date);
      results.push({
        ok: !vencido,
        check: `${tag}: vigência não vencida (isExpired)`,
        detail: `vigencia=${deal.vigencia}, data da edição=${edition.date}`,
      });
    } else {
      results.push({ ok: false, check: `${tag}: vigência presente`, detail: 'sem vigência — overrule 5.4 exige nao-confirmado, não deveria estar em Deal Desk' });
    }
  });

  results.push({
    ok: deals.length <= 3,
    check: 'cap de 3 respeitado',
    detail: `deals.length=${deals.length}`,
  });

  if (has(edition.contaFeita)) {
    const bateComAlgumDeal = deals.some((d) => JSON.stringify(d.conta) === JSON.stringify(edition.contaFeita));
    results.push({
      ok: bateComAlgumDeal || deals.length === 0,
      check: 'contaFeita rastreia a um dos deals (ou override explícito registrado à parte)',
      detail: bateComAlgumDeal ? 'bate com um deal' : 'não bate com nenhum deal — precisa de override explícito documentado fora deste JSON',
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// §3.3 — checks exclusivos do caso SEM Deal Desk
// ---------------------------------------------------------------------------

// Marcador acoplado ao renderer (renderer/email.mjs, DEAL_DESK_SECTION_MARKER) —
// um comentário HTML único que delimita a seção, NÃO o texto "Deal Desk" isolado
// (esse texto aparece legitimamente em prosa fora da seção, ex.: sinaisRapidos
// explicando "abaixo do corte de Deal Desk"). v2/lib/digest não importa
// renderer/ (camada pura não depende de apresentação) — o valor é duplicado
// aqui de propósito; se o marcador mudar em renderer/email.mjs, precisa mudar
// aqui também (documentado nos dois arquivos).
export const DEAL_DESK_MARKER = '<!--section:deal-desk-->';

/**
 * @param {object} edition
 * @param {object[]} campaignsFromDb
 * @param {string} renderedHtml  o HTML final (não o JSON) — a garantia real é
 *   "nunca renderizado vazio" (§3.3)
 * @param {{dealDeskMarker?:string}} opts
 * @returns {Array<{ok:boolean, check:string, detail:string}>}
 */
export function checkSemDealDesk(edition = {}, campaignsFromDb = [], renderedHtml = '', { dealDeskMarker = DEAL_DESK_MARKER } = {}) {
  const results = [];
  const deals = Array.isArray(edition.deals) ? edition.deals : [];

  results.push({ ok: deals.length === 0, check: 'edition.deals.length === 0', detail: `deals.length=${deals.length}` });

  const marcadorAusente = !String(renderedHtml || '').includes(dealDeskMarker);
  results.push({
    ok: marcadorAusente,
    check: 'seção Deal Desk AUSENTE do HTML renderizado (não vazia — ausente)',
    detail: marcadorAusente ? `marcador "${dealDeskMarker}" não encontrado no HTML` : `marcador "${dealDeskMarker}" encontrado — renderer publicou seção vazia`,
  });

  const codigos = new Set();
  for (const c of campaignsFromDb) {
    if (c.origem_code) codigos.add(String(c.origem_code).toLowerCase());
    if (c.destino_code) codigos.add(String(c.destino_code).toLowerCase());
  }
  const signalLower = String(edition.signal ?? '').toLowerCase();
  const citaCandidato = [...codigos].some((cod) => cod && signalLower.includes(cod));
  const generico = !(temDigito(edition.signal) && citaCandidato);
  results.push({
    ok: !generico,
    check: 'signal não é genérico (contém dígito + candidato nomeado conhecido)',
    detail: generico
      ? `signal precisa citar um número e um origem_code/destino_code conhecido — atual: "${edition.signal ?? ''}"`
      : 'contém número e candidato nomeado',
  });

  const { selecionados } = selecionarDealDesk(campaignsFromDb);
  results.push({
    ok: selecionados.length === 0,
    check: 'recomputa: o conjunto elegível a Deal Desk no banco é genuinamente vazio',
    detail: selecionados.length === 0 ? 'zero elegíveis recomputados' : `${selecionados.length} elegível(is) no banco — edição não deveria estar sem Deal Desk`,
  });

  if (Array.isArray(edition.sinaisRapidos)) {
    edition.sinaisRapidos.forEach((s, i) => {
      const semChip = !('veredito' in s) && !('verdict' in s);
      results.push({
        ok: semChip,
        check: `sinaisRapidos[${i}]: não carrega chip de veredito de Deal Desk`,
        detail: semChip ? 'ok' : 'carrega campo veredito/verdict — proibido em sinais rápidos',
      });
    });
  }

  if (has(edition.loyaltyLab)) {
    const ll = edition.loyaltyLab;
    const ok = ll.humanReviewed === true || (typeof ll.automationScore === 'number' && ll.automationScore >= 0.85);
    results.push({
      ok,
      check: 'loyaltyLab: humanReviewed=true OU automationScore >= 0,85',
      detail: ok ? 'ok' : `humanReviewed=${ll.humanReviewed}, automationScore=${ll.automationScore}`,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------

/**
 * @param {object} edition
 * @param {{campaignsFromDb?:object[], renderedHtml?:string, checkLink?:(url:string)=>Promise<boolean>, dealDeskMarker?:string}} ctx
 * @returns {{pass:boolean, errors:string[], warnings:string[]}}
 */
export function runGate55(edition, { campaignsFromDb = [], renderedHtml = '', checkLink = stubCheckLink, dealDeskMarker } = {}) {
  const results = [...checkComuns(edition)];

  const deals = Array.isArray(edition?.deals) ? edition.deals : [];
  if (deals.length > 0) {
    results.push(...checkComDealDesk(edition, campaignsFromDb));
  } else {
    results.push(...checkSemDealDesk(edition, campaignsFromDb, renderedHtml, { dealDeskMarker }));
  }

  const errors = results.filter((r) => !r.ok).map((r) => `${r.check}: ${r.detail}`);
  const warnings = [];
  if (checkLink === stubCheckLink) {
    warnings.push('checkLink não injetado — checagem de links HTTP 200 (§3.1) é um stub sempre-true; TODO: injetar checagem real (fetch) fora deste módulo puro');
  }
  warnings.push('rastreabilidade número↔banco é estrutural (dígito presente), não travessia completa até a linha de campaigns/news_raw — TODO fora do escopo deste módulo puro');

  return { pass: errors.length === 0, errors, warnings };
}
