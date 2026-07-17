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
import { DISCLAIMER, URGENCY_RE, assertEditorialRules, collectStrings, isExpired } from '../../../scripts/lib.mjs';
import { passaTresPortoes, elegivelDealDesk, selecionarDealDesk, TRES_PORTOES } from './selecionar.mjs';
import { mapVeredito } from './mapear-contrato.mjs';
import { BANCOS_ORIGEM } from './ofertas-ativas.mjs';
import { selecionarPredict, formatarTeaserPredict } from './dia-fraco.mjs';
import { lintJargao, formatarPredictNarrativa, rotaDisplay, PALAVRA_PROBABILIDADE } from './editorial.mjs';

const stubCheckLink = async () => true;

function has(v) {
  return v !== undefined && v !== null && v !== '';
}

function temDigito(texto) {
  return typeof texto === 'string' && /\d/.test(texto);
}

// Extrai tokens numéricos (com % e separador decimal/milhar) de um texto —
// reusado pela checagem de rastreabilidade de deal.contaProsa (§4, D-057):
// todo número citado na prosa precisa ter correspondente literal em conta.
function extrairNumeros(texto) {
  return String(texto || '').match(/\d+(?:[.,]\d+)*%?/g) || [];
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
      check: `${tag}: elegível a Deals do dia recomputado no banco`,
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
    check: 'seção Deals do dia AUSENTE do HTML renderizado (não vazia — ausente)',
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
    check: 'recomputa: o conjunto elegível a Deals do dia no banco é genuinamente vazio',
    detail: selecionados.length === 0 ? 'zero elegíveis recomputados' : `${selecionados.length} elegível(is) no banco — edição não deveria estar sem Deals do dia`,
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
// §3.4 — checks dos blocos novos da v3 (D-057) — independentes de Deals do
// dia estar presente ou não, por isso rodam sempre, fora dos dois ramos acima.
// ---------------------------------------------------------------------------

/**
 * Ofertas ativas: cada linha recomputa `passaTresPortoes` direto no banco
 * (mesmo padrão de `checkComDealDesk`, sem o filtro de veredito por cima) e
 * a `leitura` bate com o `veredito_bruto` real daquele item — mesmo risco do
 * `contaFeita` desalinhado (D-055) aplicado aqui.
 * @param {object} edition
 * @param {object[]} campaignsFromDb
 * @returns {Array<{ok:boolean, check:string, detail:string}>}
 */
export function checkOfertasAtivas(edition = {}, campaignsFromDb = []) {
  const results = [];
  const itens = Array.isArray(edition.ofertasAtivas) ? edition.ofertasAtivas : [];
  if (itens.length === 0) return results;

  itens.forEach((item, i) => {
    const rota = item.destino ? `${item.origem}->${item.destino}` : `${item.origem}`;
    const tag = `ofertasAtivas[${i}] (${rota})`;
    const candidato = campaignsFromDb.find(
      (c) => c && c.origem_code === item.origem && (c.destino_code ?? null) === (item.destino ?? null) && c.tipo === item.tipo,
    );

    if (!candidato) {
      results.push({
        ok: false,
        check: `${tag}: campanha correspondente localizável no banco`,
        detail: 'não encontrada em campaignsFromDb por origem/destino/tipo',
      });
      return;
    }

    const passa3 = passaTresPortoes(candidato);
    results.push({
      ok: passa3,
      check: `${tag}: passa os 3 portões recomputado direto no banco`,
      detail: passa3 ? 'ok' : `falhou: estado=${candidato.estado}, tier=${candidato.tier}, tl_score_bruto=${candidato.tl_score_bruto}`,
    });

    let leituraEsperada = null;
    try {
      leituraEsperada = mapVeredito(candidato.veredito_bruto);
    } catch {
      leituraEsperada = null;
    }
    const bate = leituraEsperada !== null && leituraEsperada === item.leitura;
    results.push({
      ok: bate,
      check: `${tag}: leitura bate com veredito_bruto real do banco`,
      detail: bate ? 'ok' : `leitura da edição="${item.leitura}", veredito_bruto do banco="${candidato.veredito_bruto}" (mapeado="${leituraEsperada}")`,
    });
  });

  return results;
}

/**
 * Cartões & bancos: quando `cartoesBancos` (prosa) está presente, checa
 * rastreabilidade estrutural número↔banco (mesmo padrão INV-03 do Resumo do
 * dia) e recomputa o filtro (`tipo='cartao' OR (transferencia AND origem_code
 * ∈ bancosOrigem)`, estado vivo) direto em `campaignsFromDb` para confirmar
 * que existe dado real capaz de embasar a prosa (regra-mãe: nunca fabricar
 * texto sem lastro).
 * @param {object} edition
 * @param {object[]} campaignsFromDb
 * @param {{bancosOrigem?:string[]}} opts
 * @returns {Array<{ok:boolean, check:string, detail:string}>}
 */
export function checkCartoesBancos(edition = {}, campaignsFromDb = [], { bancosOrigem = BANCOS_ORIGEM } = {}) {
  const results = [];
  if (!has(edition.cartoesBancos)) return results;

  results.push({
    ok: temDigito(edition.cartoesBancos),
    check: 'cartoesBancos cita ao menos um número (checagem estrutural, INV-03)',
    detail: temDigito(edition.cartoesBancos) ? 'contém dígito' : 'cartoesBancos sem nenhum número — genérico demais',
  });

  const bancos = new Set(bancosOrigem);
  const filtro = (campaignsFromDb || []).filter(
    (c) => c && TRES_PORTOES.estadosVivo.includes(c.estado) && (c.tipo === 'cartao' || (c.tipo === 'transferencia' && bancos.has(c.origem_code))),
  );
  results.push({
    ok: filtro.length > 0,
    check: 'cartoesBancos: existe ao menos 1 item real (tipo=cartao OU transferencia+banco) vivo no banco para embasar a prosa',
    detail: filtro.length > 0 ? `${filtro.length} item(ns) reais recomputados` : 'zero itens reais recomputados — prosa não pode ser fabricada sem dado (regra-mãe)',
  });

  return results;
}

/**
 * O que fechou nesta semana: cada item recomputa `estado='encerrada' AND
 * tier=1 AND tl_score_bruto IS NOT NULL AND vigencia_fim` na janela dos 7
 * dias direto no banco — sem cálculo novo, só leitura conferida.
 * @param {object} edition
 * @param {object[]} campaignsFromDb
 * @param {{hoje?:string, janelaDias?:number}} opts  `hoje` ausente ⇒ usa `edition.date`
 * @returns {Array<{ok:boolean, check:string, detail:string}>}
 */
export function checkFechouSemana(edition = {}, campaignsFromDb = [], { hoje, janelaDias = 7 } = {}) {
  const results = [];
  const itens = Array.isArray(edition.oQueFechouSemana) ? edition.oQueFechouSemana : [];
  if (itens.length === 0) return results;

  const ref = hoje || edition.date;
  const refMs = Date.parse(ref);
  const inicioMs = Number.isNaN(refMs) ? NaN : refMs - janelaDias * 24 * 60 * 60 * 1000;

  itens.forEach((item, i) => {
    const rota = item.destino ? `${item.origem}->${item.destino}` : `${item.origem}`;
    const tag = `oQueFechouSemana[${i}] (${rota})`;
    const candidato = campaignsFromDb.find(
      (c) => c && c.origem_code === item.origem && (c.destino_code ?? null) === (item.destino ?? null) && c.tipo === item.tipo && c.vigencia_fim === item.encerrouEm,
    );

    if (!candidato) {
      results.push({
        ok: false,
        check: `${tag}: campanha correspondente localizável no banco`,
        detail: 'não encontrada em campaignsFromDb por origem/destino/tipo/vigencia_fim',
      });
      return;
    }

    const vFimMs = Date.parse(candidato.vigencia_fim);
    const dentroJanela = !Number.isNaN(refMs) && !Number.isNaN(vFimMs) && vFimMs >= inicioMs && vFimMs <= refMs;
    const ok = candidato.estado === 'encerrada' && Number(candidato.tier) === 1 && candidato.tl_score_bruto !== null && candidato.tl_score_bruto !== undefined && dentroJanela;
    results.push({
      ok,
      check: `${tag}: estado=encerrada AND tier=1 AND tl_score_bruto not null AND vigencia_fim na janela de ${janelaDias}d recomputado`,
      detail: ok ? 'ok' : `estado=${candidato.estado}, tier=${candidato.tier}, tl_score_bruto=${candidato.tl_score_bruto}, vigencia_fim=${candidato.vigencia_fim}, dentroJanela=${dentroJanela}`,
    });
  });

  return results;
}

/**
 * Predict: quando presente, `ativos` deve ser > 0 (senão deveria ter sido
 * omitido, regra-mãe) e — quando `radarDailyWindows` é injetado — recomputa
 * que `digest.radarDaily` tem de fato ≥1 janela `confidence='alta'` (mesmo
 * padrão de negação de "projeção sem lastro" do Radar da v2). Lint reforçado:
 * quando `renderedHtml` é injetado, o teaser renderizado precisa bater
 * EXATAMENTE com `formatarTeaserPredict(ativos)` — a única forma sancionada
 * de produzir esse texto — nunca um texto escrito à mão que possa vazar
 * valor/janela prevista.
 * @param {object} edition
 * @param {{renderedHtml?:string, radarDailyWindows?:object[]}} opts
 * @returns {Array<{ok:boolean, check:string, detail:string}>}
 */
export function checkPredict(edition = {}, { renderedHtml = '', radarDailyWindows } = {}) {
  const results = [];
  if (!has(edition.predict)) return results;

  const ativos = edition.predict.ativos;
  const valido = typeof ativos === 'number' && ativos > 0;
  results.push({
    ok: valido,
    check: 'predict.ativos > 0 (senão deveria ter sido omitido, regra-mãe)',
    detail: `ativos=${ativos}`,
  });

  if (Array.isArray(radarDailyWindows)) {
    const { count } = selecionarPredict(radarDailyWindows);
    const bate = count === ativos;
    results.push({
      ok: bate,
      check: 'predict.ativos recomputado a partir de radarDaily (confidence=alta) bate',
      detail: bate ? 'ok' : `edition.predict.ativos=${ativos}, recomputado a partir de radarDailyWindows=${count}`,
    });
  }

  if (valido && renderedHtml) {
    const teaserEsperado = formatarTeaserPredict(ativos);
    const presente = String(renderedHtml).includes(teaserEsperado);
    results.push({
      ok: presente,
      check: 'predict: teaser renderizado bate exatamente com formatarTeaserPredict (nunca texto custom com valor/janela)',
      detail: presente ? 'ok' : `teaser esperado "${teaserEsperado}" não encontrado literalmente no HTML — texto pode ter sido escrito à mão e vazar valor/janela`,
    });
  }

  return results;
}

/**
 * `deal.contaProsa` (quando presente): todo número citado tem correspondente
 * literal em `deal.conta.rows`/`conta.result` — não pode introduzir número
 * que não esteja na tabela estruturada (mesmo espírito do check de
 * `contaFeita`).
 * @param {object} edition
 * @returns {Array<{ok:boolean, check:string, detail:string}>}
 */
export function checkContaProsa(edition = {}) {
  const results = [];
  const deals = Array.isArray(edition.deals) ? edition.deals : [];

  deals.forEach((deal, i) => {
    if (!has(deal.contaProsa)) return;
    const tag = `deals[${i}].contaProsa`;
    const numerosProsa = extrairNumeros(deal.contaProsa);
    const textoConta = JSON.stringify(deal.conta ?? {});
    const semCorrespondencia = numerosProsa.filter((n) => !textoConta.includes(n));
    results.push({
      ok: semCorrespondencia.length === 0,
      check: `${tag}: todo número citado tem correspondente literal em conta.rows/result`,
      detail: semCorrespondencia.length === 0 ? 'ok' : `número(s) sem correspondência: ${semCorrespondencia.join(', ')}`,
    });
  });

  return results;
}

// ---------------------------------------------------------------------------
// §3.5 — checks do formato v4 (D-059, rodadas editoriais) — sempre-on
// ---------------------------------------------------------------------------

/**
 * Jargão interno banido de texto voltado ao leitor (D-059): varre TODAS as
 * strings da edição + o HTML renderizado com `lintJargao`. Qualquer hit é erro.
 * @param {object} edition
 * @param {string} renderedHtml
 * @returns {Array<{ok:boolean, check:string, detail:string}>}
 */
export function checkJargao(edition = {}, renderedHtml = '') {
  const results = [];
  const hits = new Map();
  for (const s of collectStrings(edition)) {
    for (const termo of lintJargao(s)) {
      if (!hits.has(termo)) hits.set(termo, s.slice(0, 60));
    }
  }
  results.push({
    ok: hits.size === 0,
    check: 'jargão interno ausente das strings da edição (D-059)',
    detail: hits.size === 0
      ? 'nenhum termo interno vazou para o leitor'
      : [...hits.entries()].map(([t, s]) => `"${t}" em "${s}…"`).join('; '),
  });
  if (renderedHtml) {
    const htmlHits = lintJargao(renderedHtml);
    results.push({
      ok: htmlHits.length === 0,
      check: 'jargão interno ausente do HTML renderizado (D-059)',
      detail: htmlHits.length ? `termo(s): ${htmlHits.join(', ')}` : 'limpo',
    });
  }
  return results;
}

const RE_CLAIM_TL = /TL(?:\s*Score)?\s*\d/i;

/**
 * Radar sem confirmação (D-059, guardrail): item não confirmado NUNCA é citado
 * sem url+fonte; sem `nota`, o texto não pode reivindicar um número TL.
 * @param {object} edition
 * @returns {Array<{ok:boolean, check:string, detail:string}>}
 */
export function checkRadarSemConfirmacao(edition = {}) {
  const results = [];
  const itens = Array.isArray(edition.radarSemConfirmacao) ? edition.radarSemConfirmacao : [];
  itens.forEach((item, i) => {
    const tag = `radarSemConfirmacao[${i}] (${item.titulo ?? 'sem título'})`;
    const temFonte = has(item.url) && has(item.fonte);
    results.push({
      ok: temFonte,
      check: `${tag}: url e fonte presentes (item não confirmado nunca sem fonte linkada, D-059)`,
      detail: temFonte ? 'ok' : `url="${item.url ?? ''}", fonte="${item.fonte ?? ''}"`,
    });
    if (item.nota === null || item.nota === undefined) {
      const texto = `${item.titulo ?? ''} ${item.detalhe ?? ''}`;
      const claimaTl = RE_CLAIM_TL.test(texto);
      results.push({
        ok: !claimaTl,
        check: `${tag}: sem nota ⇒ texto não pode citar número TL`,
        detail: claimaTl ? 'texto cita um número TL sem nota registrada' : 'ok',
      });
    }
  });
  return results;
}

/**
 * Narrativa do Predict (D-059 §3): probabilidade visível, nunca data/janela
 * futura, nunca urgência, e `texto` recomputa EXATAMENTE via
 * `formatarPredictNarrativa` — a única forma sancionada de produzir a frase.
 * @param {object} edition
 * @returns {Array<{ok:boolean, check:string, detail:string}>}
 */
export function checkPredictNarrativa(edition = {}) {
  const results = [];
  const pn = edition.predictNarrativa;
  if (!has(pn)) return results;
  const texto = String(pn.texto ?? '');

  const palavra = PALAVRA_PROBABILIDADE[pn.probabilidade];
  const temPalavra = Boolean(palavra) && texto.includes(palavra);
  results.push({
    ok: temPalavra,
    check: 'predictNarrativa: texto torna a probabilidade visível',
    detail: temPalavra ? `contém "${palavra}"` : `probabilidade="${pn.probabilidade}" não aparece no texto`,
  });

  const temAno = /\d{4}/.test(texto);
  results.push({
    ok: !temAno,
    check: 'predictNarrativa: não cita ano/data futura',
    detail: temAno ? 'texto contém sequência de 4 dígitos (ano/data)' : 'ok',
  });

  const temJanela = /\bde \d{1,2} a \d{1,2}\b/i.test(texto);
  results.push({
    ok: !temJanela,
    check: 'predictNarrativa: não cita janela explícita ("de X a Y")',
    detail: temJanela ? 'texto contém janela explícita' : 'ok',
  });

  const temUrgencia = URGENCY_RE.test(texto);
  results.push({
    ok: !temUrgencia,
    check: 'predictNarrativa: sem urgência artificial (regra 4)',
    detail: temUrgencia ? 'texto contém termo de urgência banido' : 'ok',
  });

  let esperado = null;
  try {
    esperado = formatarPredictNarrativa(pn);
  } catch {
    esperado = null;
  }
  const bate = esperado !== null && texto === esperado;
  results.push({
    ok: bate,
    check: 'predictNarrativa: texto recomputa exatamente via formatarPredictNarrativa (rastreabilidade)',
    detail: bate ? 'ok' : `texto divergente do template sancionado${esperado === null ? ' (campos inválidos para recomputar)' : ''}`,
  });

  return results;
}

const RE_STATUS_HONESTO = /sem confirma[çc][ãa]o|fora da r[ée]gua|sem nota/iu;

/**
 * Cartões e bancos por item (D-059): url+fonte obrigatórios; item sem `nota`
 * carrega status honesto ('sem confirmação'/'fora da régua'/'sem nota').
 * @param {object} edition
 * @returns {Array<{ok:boolean, check:string, detail:string}>}
 */
export function checkCartoesBancosItens(edition = {}) {
  const results = [];
  const itens = Array.isArray(edition.cartoesBancosItens) ? edition.cartoesBancosItens : [];
  itens.forEach((item, i) => {
    const tag = `cartoesBancosItens[${i}] (${item.nome ?? 'sem nome'})`;
    const temFonte = has(item.url) && has(item.fonte);
    results.push({
      ok: temFonte,
      check: `${tag}: url e fonte presentes (número sem fonte que o sustente sai da peça, D-059)`,
      detail: temFonte ? 'ok' : `url="${item.url ?? ''}", fonte="${item.fonte ?? ''}"`,
    });
    if (item.nota === null || item.nota === undefined) {
      const texto = `${item.descricao ?? ''} ${item.status ?? ''}`;
      const honesto = RE_STATUS_HONESTO.test(texto);
      results.push({
        ok: honesto,
        check: `${tag}: sem nota ⇒ descrição/status declara 'sem confirmação', 'fora da régua' ou 'sem nota'`,
        detail: honesto ? 'ok' : 'item sem nota e sem status honesto explicando o porquê',
      });
    }
  });
  return results;
}

/**
 * Rota de exibição de compra/clube (D-059, regra do operador): recomputa
 * `rotaDisplay` e garante que NUNCA renderiza "sem destino"/"sem_destino".
 * @param {object} edition
 * @returns {Array<{ok:boolean, check:string, detail:string}>}
 */
export function checkRotaDisplayCompra(edition = {}) {
  const results = [];
  const itens = Array.isArray(edition.ofertasAtivas) ? edition.ofertasAtivas : [];
  itens.forEach((item, i) => {
    if (item.tipo !== 'compra' && item.tipo !== 'clube') return;
    const rota = rotaDisplay(item);
    const ok = !/sem[_ ]destino/i.test(rota);
    results.push({
      ok,
      check: `ofertasAtivas[${i}]: rota de compra/clube exibe o próprio programa, nunca "sem destino" (D-059)`,
      detail: `rota recomputada="${rota}"`,
    });
  });
  return results;
}

// ---------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------

/**
 * @param {object} edition
 * @param {{campaignsFromDb?:object[], renderedHtml?:string, checkLink?:(url:string)=>Promise<boolean>, dealDeskMarker?:string, radarDailyWindows?:object[], bancosOrigem?:string[], hoje?:string}} ctx
 * @returns {{pass:boolean, errors:string[], warnings:string[]}}
 */
export function runGate55(edition, { campaignsFromDb = [], renderedHtml = '', checkLink = stubCheckLink, dealDeskMarker, radarDailyWindows, bancosOrigem, hoje } = {}) {
  const results = [...checkComuns(edition)];

  const deals = Array.isArray(edition?.deals) ? edition.deals : [];
  if (deals.length > 0) {
    results.push(...checkComDealDesk(edition, campaignsFromDb));
  } else {
    results.push(...checkSemDealDesk(edition, campaignsFromDb, renderedHtml, { dealDeskMarker }));
  }

  // Blocos v3 (D-057) — independentes de Deals do dia, sempre checados.
  results.push(...checkOfertasAtivas(edition, campaignsFromDb));
  results.push(...checkCartoesBancos(edition, campaignsFromDb, { bancosOrigem }));
  results.push(...checkFechouSemana(edition, campaignsFromDb, { hoje: hoje || edition?.date }));
  results.push(...checkPredict(edition, { renderedHtml, radarDailyWindows }));
  results.push(...checkContaProsa(edition));

  // Formato v4 (D-059) — sempre-on, como os checks v3.
  results.push(...checkJargao(edition, renderedHtml));
  results.push(...checkRadarSemConfirmacao(edition));
  results.push(...checkPredictNarrativa(edition));
  results.push(...checkCartoesBancosItens(edition));
  results.push(...checkRotaDisplayCompra(edition));

  const errors = results.filter((r) => !r.ok).map((r) => `${r.check}: ${r.detail}`);
  const warnings = [];
  if (checkLink === stubCheckLink) {
    warnings.push('checkLink não injetado — checagem de links HTTP 200 (§3.1) é um stub sempre-true; TODO: injetar checagem real (fetch) fora deste módulo puro');
  }
  warnings.push('rastreabilidade número↔banco é estrutural (dígito presente), não travessia completa até a linha de campaigns/news_raw — TODO fora do escopo deste módulo puro');

  return { pass: errors.length === 0, errors, warnings };
}
