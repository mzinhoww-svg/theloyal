// montar-edicao.mjs — MONTAGEM DB→edição do dia (M2.7). PURO, sem I/O.
//
// Fecha o buraco do runner: hoje scripts/daily.mjs carrega um JSON de edição
// ESTÁTICO (content/editions/NNNN.json) e o republica todo dia. Este módulo
// MONTA uma edição fresca no contrato v4 a partir do estado do banco no dia
// (`campaigns` já lidas + `news_raw` do dia + `forecast`), REUSANDO os
// seletores puros do Digest Engine (selecionar/ofertas-ativas/dia-fraco) —
// NUNCA reescreve seleção nem recalcula veredito (INV-12: o código monta e
// seleciona; a nota vem do banco). Regra-mãe: seção sem dado real é OMITIDA,
// nunca renderizada vazia.
//
// `montarEdicaoDoDia` recebe dados JÁ LIDOS e retorna o objeto de edição —
// sem tocar disco nem rede. Quem lê o banco (o runner) e quem escreve o
// arquivo (numeração idempotente) ficam fora daqui.
import { DISCLAIMER } from '../../../scripts/lib.mjs';
import { selecionarDealDesk, selecionarFechaLogo } from './selecionar.mjs';
import { selecionarOfertasAtivas, selecionarCartoesBancos } from './ofertas-ativas.mjs';
import { selecionarFechouSemana, selecionarClipping, selecionarPredict } from './dia-fraco.mjs';
import {
  rotaDisplay, tipoLabel, nomePrograma, formatarPredictNarrativa,
  formatarDiaMes, ordenarClippingPorRelevancia, STATUS_SEM_CONFIRMACAO,
} from './editorial.mjs';
import { mapVeredito } from './mapear-contrato.mjs';

const DIA_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];

// Fonte ÚNICA do que é "campanha viva" (surfaceável como oferta). Uma encerrada
// nunca é oferta viva — mesmo TIER 1, ela entra só no recap "O que fechou". A
// fila de pré-superfície do gate e a do runner DEVEM partir deste mesmo conjunto,
// senão um flag numa MORTA (o fetch traz encerrada∧tier1) trava um dia limpo (M8).
export const ESTADOS_VIVOS = Object.freeze(['ativa', 'detectada', 'ultimos_dias']);
export function filtrarVivos(rows = []) {
  return (rows || []).filter((c) => ESTADOS_VIVOS.includes(c?.estado));
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const parseDate = (s) => (s ? Date.parse(String(s).slice(0, 10)) : NaN);

/** ISO date → weekday em CAPS (contrato v4). Parse em UTC para determinismo. */
export function weekdayPtBr(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return WEEKDAYS[d.getUTCDay()];
}

// ---------------------------------------------------------------------------
// Reconstrução do conjunto vivo relativo a um asOf (usado no REPLAY histórico
// e quando o snapshot não traz `estado`). O banco vivo guarda o `estado` ATUAL;
// para replay de um dia passado o estado precisa ser derivado das datas
// (first_seen / vigencia_fim_date) relativas ao asOf — determinístico e puro.
// ---------------------------------------------------------------------------

/**
 * Deriva o estado de UMA campanha relativo a `asOf` a partir de first_seen e
 * vigencia_fim_date. Não inventa: só data.
 * @returns {'ativa'|'ultimos_dias'|'encerrada'|'futuro'}
 */
export function reconstruirEstado(row, asOf) {
  const ref = parseDate(asOf);
  const fs = parseDate(row.first_seen);
  const vf = parseDate(row.vigencia_fim_date ?? row.vigencia_fim);
  if (!Number.isNaN(fs) && fs > ref) return 'futuro'; // ainda não visto no dia
  if (!Number.isNaN(vf) && vf < ref) return 'encerrada';
  if (!Number.isNaN(vf) && vf <= ref + 3 * DIA_MS) return 'ultimos_dias'; // vence em até 72h
  return 'ativa';
}

/**
 * Reconstrói o conjunto de campanhas relevante ao `asOf`: deriva `estado`,
 * normaliza `vigencia_fim` para a data canônica (os seletores leem
 * `vigencia_fim`), e descarta o que ainda não havia sido visto (`futuro`).
 * Mantém as encerradas (o recap "O que fechou nesta semana" precisa delas).
 */
/**
 * Revalidação de vigência (defensiva contra `estado` STALE do FSM): uma campanha
 * cuja vigência já passou ANTES da data da edição NÃO é oferta viva — força
 * 'encerrada' para não vazar em Ofertas ativas / Vence em 72h, mesmo que o banco
 * ainda a marque 'ultimos_dias'. Vencer NA data (== asOf) segue válido ("vence
 * hoje"). Deve ser aplicada no BOUNDARY do runner, para que a montagem E o gate
 * vejam a MESMA verdade de vigência (senão o checkFechouSemana diverge). Mesma
 * verdade que o gate do Weekly (W) exige.
 * @param {object[]} campaigns
 * @param {string} asOf  YYYY-MM-DD
 * @returns {object[]}
 */
export function revalidarVigencia(campaigns = [], asOf) {
  const asOfDate = String(asOf).slice(0, 10);
  return (Array.isArray(campaigns) ? campaigns : []).map((c) => {
    const vfRaw = c?.vigencia_fim_date ?? c?.vigencia_fim;
    const vf = vfRaw && /^\d{4}-\d{2}-\d{2}/.test(String(vfRaw)) ? String(vfRaw).slice(0, 10) : null;
    return vf && vf < asOfDate ? { ...c, estado: 'encerrada' } : c;
  });
}

export function reconstruirConjuntoVivo(rows = [], asOf) {
  const out = [];
  for (const row of rows || []) {
    const estado = reconstruirEstado(row, asOf);
    if (estado === 'futuro') continue;
    out.push({ ...row, estado, vigencia_fim: row.vigencia_fim_date ?? row.vigencia_fim ?? null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Numeração idempotente por DATA (uma edição por dia; nunca reusa a 0001).
// ---------------------------------------------------------------------------

/**
 * Resolve o número do dia sobre uma listagem já lida de edições existentes
 * (cada uma { number, date, illustrative? }). Idempotente por data: rodar 2x
 * no mesmo dia devolve o MESMO número. Datas diferentes → número novo (max+1).
 * Edições reservadas (nº ∈ `reservados`, default [1] — a 0001 ilustrativa) e
 * as marcadas `illustrative` nunca são reusadas por data.
 * @returns {{number:number, reused:boolean}}
 */
export function resolverNumeroEdicao(asOf, existentes = [], { reservados = [1] } = {}) {
  const reserv = new Set(reservados);
  let max = 0;
  for (const e of existentes) {
    const n = Number(e?.number);
    if (Number.isFinite(n)) max = Math.max(max, n);
    if (e?.date === asOf && !reserv.has(n) && !e?.illustrative) {
      return { number: n, reused: true };
    }
  }
  return { number: max + 1, reused: false };
}

// ---------------------------------------------------------------------------
// Formatação determinística de campos derivados
// ---------------------------------------------------------------------------

function pctNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// CPM do banco vem sujo ("R$ 15,37 /milheiro (P+D)", "16.84", "R$ ~28/milheiro").
// Normaliza para string curta em R$; formato irreconhecível → null (não inventa).
function normalizeCpm(cpm) {
  if (!cpm) return null;
  const s = String(cpm).trim();
  if (/R\$/.test(s)) return s.replace(/\s*\/milheiro.*$/i, '').replace(/\s+/g, ' ').trim();
  const n = Number(s.replace(',', '.'));
  if (Number.isFinite(n)) return `R$ ${n.toFixed(2).replace('.', ',')}`;
  return null;
}

function publicoLabel(publico) {
  if (!publico) return null;
  const p = String(publico).toLowerCase();
  if (p === 'clube') return 'Clube';
  if (p === 'cartao') return 'Cartão';
  return null; // 'geral' e desconhecidos: sem rótulo
}

function isHttps(u) { return typeof u === 'string' && /^https:\/\//.test(u); }

function findCampanha(campaigns, o) {
  return campaigns.find(
    (c) => c && c.origem_code === o.origem && (c.destino_code ?? null) === (o.destino ?? null) && c.tipo === o.tipo,
  ) || null;
}

// ---------------------------------------------------------------------------
// Deal Desk → cards. Só entra quem `selecionarDealDesk` elegeu (3 portões +
// veredito Vale agir/olhar). A conta é montada a partir do que a campanha JÁ
// tem (percentual/paridade/score) — não recalcula veredito. `routeKey` é
// obrigatório e precisa bater cru com origem_code->destino_code (o gate 5.5
// recompõe por ela; validate.parseRouteKey só aceita kebab): rota com
// underscore/acento no código não é montável como deal e é pulada (nunca
// entra torta — melhor omitir que publicar inconsistente).
// ---------------------------------------------------------------------------
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function montarDeal(c) {
  const origem = c.origem_code;
  const destino = c.destino_code;
  if (!origem || !destino) return null;
  if (!KEBAB_RE.test(origem) || !KEBAB_RE.test(destino)) return null;
  const routeKey = `${origem}->${destino}`;
  const score = Number(c.tl_score_bruto);
  if (!Number.isFinite(score)) return null; // sem conta computável → não é deal
  const pct = pctNum(c.percentual);
  const cpm = normalizeCpm(c.cpm);
  const rows = [];
  if (pct !== null) rows.push(['Bônus na transferência', `${pct}%`]);
  if (c.paridade) rows.push(['Paridade', String(c.paridade)]);
  if (cpm) rows.push(['Custo do milheiro', cpm]);
  if (rows.length === 0) return null;
  const conta = { rows, result: ['TL Score', String(score)] };
  const verdict = mapVeredito(c.veredito_bruto); // vale-agir | vale-olhar (garantido pelo corte)
  const rota = rotaDisplay({ origem, destino, tipo: c.tipo });
  return {
    category: `${tipoLabel(c.tipo)} · ${rota}`,
    title: `${rota}: ${pct !== null ? `${pct}% de bônus` : 'oportunidade viva'}`,
    context: `${tipoLabel(c.tipo)} viva${pct !== null ? ` com ${pct}% de bônus` : ''}, com fonte oficial e conta feita abaixo.`,
    conta,
    verdict,
    verdictNote: `Nota TL ${score}. Confira sempre a regra na fonte oficial antes de transferir.`,
    source: `${c.source_name || 'fonte'} · vigente até ${formatarDiaMes(c.vigencia_fim)}`,
    ...(isHttps(c.source_url) ? { sourceUrl: c.source_url } : {}),
    vigencia: `${String(c.vigencia_fim).slice(0, 10)}T23:59:59Z`,
    tlScore: score,
    routeKey,
    ...(c.first_seen ? { firstSeen: String(c.first_seen).slice(0, 10) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Sinal do dia + Resumo do dia — DETERMINÍSTICOS a partir do estado do dia
// (melhor oferta viva, ou caminho dia-fraco). Nunca prosa livre de IA: o Sinal
// carrega SEMPRE um número (o % da oferta destaque) e cita programas por
// origem_code/destino_code conhecidos (o gate exige ambos).
// ---------------------------------------------------------------------------
function programasNoRadar(ofertas, max = 3) {
  const nomes = [];
  const vistos = new Set();
  for (const o of ofertas) {
    // Código auto-contido: mapeado cujo nome cita o código (Smiles→smiles) ou
    // não mapeado (renderizado cru). Garante que o texto cite um code conhecido.
    const code = o.destino && o.destino !== 'sem_destino' ? o.destino : o.origem;
    if (!code || vistos.has(code)) continue;
    vistos.add(code);
    nomes.push(nomePrograma(code));
    if (nomes.length >= max) break;
  }
  return nomes;
}

function construirSinal({ featured, ofertas, fechou }) {
  const radar = programasNoRadar(ofertas);
  const enumera = radar.length ? ` No radar hoje: ${radar.join(', ')}.` : '';
  if (featured) {
    const pct = pctNum(featured.percentual);
    const rota = rotaDisplay(featured);
    const pctTxt = pct !== null ? `${pct}%` : 'bônus';
    return `O destaque vivo de hoje é ${rota}, com ${pctTxt} — ${tipoLabel(featured.tipo).toLowerCase()}.${enumera}`;
  }
  if (fechou && fechou.length) {
    const f = fechou[0];
    const pct = pctNum(f.percentual);
    return `Dia fraco: nenhuma oferta nova viva com conta fechável. O último movimento foi ${rotaDisplay(f)} a ${pct !== null ? `${pct}%` : 'bônus'}, encerrado em ${formatarDiaMes(f.encerrouEm)}.`;
  }
  return null;
}

function construirResumo({ featured, ofertas, nVence }) {
  if (!featured) return null;
  const pct = pctNum(featured.percentual);
  const cpm = featured.cpm;
  const n = ofertas.length;
  const parte1 = `Hoje há ${n} ${n === 1 ? 'oferta viva' : 'ofertas vivas'} com conta fechável.`;
  const parte2 = `A de maior nota é ${rotaDisplay(featured)}, com ${pct !== null ? `${pct}%` : 'bônus'}${cpm ? ` e milheiro a ${cpm}` : ''}.`;
  const parte3 = nVence > 0
    ? `${nVence} ${nVence === 1 ? 'oferta vence' : 'ofertas vencem'} nas próximas 72 horas.`
    : 'Nenhuma vence nas próximas 72 horas.';
  return `${parte1} ${parte2} ${parte3}`;
}

// ---------------------------------------------------------------------------
// MONTAGEM PRINCIPAL
// ---------------------------------------------------------------------------

/**
 * @param {object} args
 * @param {string} args.asOf       data da edição (YYYY-MM-DD) e referência de vigência
 * @param {object[]} args.campaigns  linhas de `campaigns` com `estado` já resolvido para o dia
 * @param {object[]} [args.newsRaw]   linhas de `news_raw` do dia (só viram Clipping se tiverem `summary` próprio)
 * @param {object|null} [args.forecast]  content/forecast.json (Predict); null → degrada
 * @param {number} args.number     número da edição (resolvido pela numeração idempotente)
 * @returns {object}  edição no contrato v4 (content/edition.schema.json)
 */
export function montarEdicaoDoDia({ asOf, campaigns = [], newsRaw = [], forecast = null, number }) {
  if (!asOf) throw new Error('montarEdicaoDoDia: asOf é obrigatório');
  if (!Number.isFinite(Number(number))) throw new Error('montarEdicaoDoDia: number é obrigatório');
  const camps = revalidarVigencia(campaigns, asOf);

  // 1. Deal Desk (cap 3) — vazio quando não há elegível (dia fraco de 1ª classe).
  const { selecionados } = selecionarDealDesk(camps, { cap: 3 });
  const deals = selecionados.map((c) => montarDeal(c)).filter(Boolean);

  // 2. Ofertas ativas (passaTresPortoes, sem corte de veredito) — enriquecidas
  //    com cpm/publico/nota do banco, dedupe e ordenadas por nota; cap 8.
  const ofertasBrutas = selecionarOfertasAtivas(camps).itens.map((o) => {
    const c = findCampanha(camps, o);
    return {
      ...o,
      cpm: c ? normalizeCpm(c.cpm) : null,
      publico: c ? publicoLabel(c.publico) : null,
      nota: c && Number.isFinite(Number(c.tl_score_bruto)) ? Number(c.tl_score_bruto) : null,
    };
  });
  const ofertasAtivas = dedupe(ofertasBrutas, (o) => `${o.origem}|${o.destino}|${o.tipo}|${o.percentual}|${o.leitura}`)
    .sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1) || cmpPrazo(a.prazo, b.prazo))
    .slice(0, 8);

  // 3. Vence em até 72h (Fecha Logo) — estado ultimos_dias, renderável, cap 5.
  const fechaLogo = selecionarFechaLogo(camps)
    .filter((c) => pctNum(c.percentual) !== null && c.vigencia_fim_date && c.origem_code)
    .sort((a, b) => (Number(b.tl_score_bruto) || -1) - (Number(a.tl_score_bruto) || -1) || cmpPrazo(a.vigencia_fim, b.vigencia_fim))
    .slice(0, 5)
    .map((c) => montarFechaItem(c, asOf));

  // 4. Cartões e bancos (v4, por item com fonte) — reusa o seletor para o
  //    conjunto; enriquece com fonte real; cap 6.
  const cartoesBancosItens = dedupe(
    selecionarCartoesBancos(camps).itens
      .map((o) => ({ o, c: findCampanha(camps, o) }))
      .filter(({ c }) => c && isHttps(c.source_url) && c.source_name && (c.origem_code || c.destino_code)),
    ({ c }) => `${c.origem_code}|${c.destino_code}|${c.tipo}`,
  )
    .sort((a, b) => (Number(b.c.tl_score_bruto) || -1) - (Number(a.c.tl_score_bruto) || -1) || cmpFirstSeen(a.c, b.c))
    .slice(0, 6)
    .map(({ c }) => montarCartaoItem(c));

  // 5. O que fechou nesta semana (TIER 1, janela 7d) — dedupe, cap 8.
  const oQueFechouSemana = dedupe(
    selecionarFechouSemana(camps, { hoje: asOf }).itens,
    (f) => `${f.origem}|${f.destino}|${f.tipo}|${f.encerrouEm}`,
  ).slice(0, 8);

  // 6. Clipping — só monta com síntese PRÓPRIA já presente em news_raw
  //    (INV-04: summary é redação nova, nunca cópia; não é gerável
  //    deterministicamente aqui). Sem summary → OMITIDO (regra-mãe).
  const clipping = montarClipping(newsRaw);

  // 7. Sinal + Resumo (determinísticos) e a oferta destaque.
  const featured = pickFeatured(ofertasAtivas, deals, camps);
  const nVence = ofertasAtivas.filter((o) => estaVencendo(o.prazo, asOf)).length;
  const signal = construirSinal({ featured, ofertas: ofertasAtivas, fechou: oQueFechouSemana })
    || `Dia sem oferta viva mapeada. Mercado monitorado em ${camps.length} registros; sem destaque com conta fechável hoje.`;
  const resumoDoDia = construirResumo({ featured, ofertas: ofertasAtivas, nVence });

  // 8. Predict — narrativa (degrada para "em formação" sem base) + teaser formal.
  const predictNarrativa = montarPredictNarrativa({ featured, ofertas: ofertasAtivas, deals });
  const predictCount = selecionarPredict(forecast?.digest?.radarDaily || []).count;

  // 9. Fontes — reunidas dos itens incluídos (https), dedupe, cap 6, ≥1.
  const sources = montarSources({ deals, ofertasAtivas, fechaLogo, cartoesBancosItens, oQueFechouSemana, camps });

  const readingMinutes = clamp(
    2 + Math.ceil((deals.length + ofertasAtivas.length + fechaLogo.length + cartoesBancosItens.length + oQueFechouSemana.length + clipping.length) / 3),
    2, 15,
  );

  const ed = {
    schemaVersion: 4,
    number: Number(number),
    date: asOf,
    weekday: weekdayPtBr(asOf),
    publishTime: '8H00',
    readingMinutes,
    signal,
    deals,
    sources,
    disclaimer: DISCLAIMER,
  };
  if (resumoDoDia) ed.resumoDoDia = resumoDoDia;
  if (ofertasAtivas.length) ed.ofertasAtivas = ofertasAtivas;
  if (fechaLogo.length) ed.fechaLogo = fechaLogo;
  if (cartoesBancosItens.length) ed.cartoesBancosItens = cartoesBancosItens;
  if (oQueFechouSemana.length) ed.oQueFechouSemana = oQueFechouSemana;
  if (clipping.length >= 5) ed.clipping = clipping;
  if (predictNarrativa) ed.predictNarrativa = predictNarrativa;
  if (predictCount > 0) ed.predict = { ativos: predictCount };
  return ed;
}

// ---------------------------------------------------------------------------
// Sub-montagens
// ---------------------------------------------------------------------------

function montarFechaItem(c, asOf) {
  const dias = Math.round((parseDate(c.vigencia_fim_date) - parseDate(asOf)) / DIA_MS);
  const tag = dias <= 0 ? 'VENCE HOJE' : dias === 1 ? 'VENCE EM 24H' : `VENCE EM ${dias * 24}H`;
  const pct = pctNum(c.percentual);
  const rota = rotaDisplay({ origem: c.origem_code, destino: c.destino_code, tipo: c.tipo });
  const cpm = normalizeCpm(c.cpm);
  return {
    tag,
    text: `${rota} — ${tipoLabel(c.tipo).toLowerCase()}${pct !== null ? ` de ${pct}%` : ''}, encerra em ${formatarDiaMes(c.vigencia_fim_date)}.`,
    ...(cpm ? { cpm: `${cpm} por milheiro` } : {}),
    ...(isHttps(c.source_url) ? { url: c.source_url } : {}),
    vigencia: `${String(c.vigencia_fim_date).slice(0, 10)}T23:59:59Z`,
  };
}

function montarCartaoItem(c) {
  const rota = rotaDisplay({ origem: c.origem_code, destino: c.destino_code, tipo: c.tipo });
  const pct = pctNum(c.percentual);
  const descricao = c.tipo === 'transferencia' && pct !== null
    ? `Transferência bonificada de ${pct}%, campanha vigente.`
    : `${tipoLabel(c.tipo)} com acúmulo diferenciado, campanha vigente.`;
  return {
    nome: rota,
    descricao,
    url: c.source_url,
    fonte: c.source_name,
    status: STATUS_SEM_CONFIRMACAO, // sem nota própria → status honesto (D-059)
    nota: null,
  };
}

// Clipping só é montável com síntese própria pré-existente (INV-04). Aceita o
// campo `summary` de news_raw quando presente; aplica o piso de 5 via seletor.
// Boilerplate/masthead de portal — auto-descrição, não fato/oferta. Ex.: "O maior
// portal de milhas do Brasil...". Uma síntese que é só masthead não informa "o que
// mudou" e não pode ocupar vaga no Clipping (EPSILON: dado real, nunca casca).
const MASTHEAD_RE = /\b(o\s+)?maior\s+(portal|site|comunidade|blog)\s+de\s+(milhas|pontos|viagens)|seu\s+(portal|site|guia)\s+de\s+(milhas|pontos)|seja\s+bem[- ]vindo|seja\s+um\s+assinante|seu\s+destino\s+para\s+milhas/i;

function montarClipping(newsRaw) {
  const comSummary = (newsRaw || []).filter(
    (n) => n && n.processed === true && n.title && n.url && n.source
      && typeof n.summary === 'string' && n.summary.trim()
      && !MASTHEAD_RE.test(n.summary), // corta resumos genéricos de masthead (EPSILON)
  );
  const { itens, omitido } = selecionarClipping(comSummary, { minimo: 5 });
  if (omitido) return [];
  return ordenarClippingPorRelevancia(itens.map((n) => ({
    title: n.title, url: n.url, source: n.source, tier: n.tier ?? 2, summary: n.summary.trim(),
  })));
}

function montarPredictNarrativa({ featured, ofertas, deals }) {
  // Rota acompanhada: melhor transferência viva com origem+destino reais.
  const transfer = ofertas.find((o) => o.tipo === 'transferencia' && o.destino && o.destino !== 'sem_destino');
  const dealRoute = deals[0] ? parseRoute(deals[0].routeKey) : null;
  const base = transfer
    || dealRoute
    || (featured ? { origem: featured.origem, destino: destinoReal(featured) } : null);
  if (!base || !base.origem) return null;
  const rotaOrigem = base.origem;
  const rotaDestino = base.destino && base.destino !== 'sem_destino' ? base.destino : base.origem;
  // Sem Predict Ledger com base para esta rota → degrada para "em-formacao"
  // (INV-03/INV-25: nunca número/probabilidade inventada).
  const probabilidade = 'em-formacao';
  const texto = formatarPredictNarrativa({ rotaOrigem, rotaDestino, historicoTipicoPercent: null, probabilidade });
  return { rotaOrigem, rotaDestino, historicoTipicoPercent: null, probabilidade, texto };
}

function montarSources({ deals, ofertasAtivas, fechaLogo, cartoesBancosItens, oQueFechouSemana, camps }) {
  const out = [];
  const vistos = new Set();
  const add = (url, label) => {
    if (!isHttps(url) || vistos.has(url) || out.length >= 6) return;
    vistos.add(url);
    out.push({ label: label || hostOf(url), url });
  };
  for (const d of deals) add(d.sourceUrl, d.source);
  for (const f of fechaLogo) add(f.url, f.tag);
  for (const c of cartoesBancosItens) add(c.url, c.fonte);
  // Ofertas/fechou não carregam url própria → puxa da campanha correspondente.
  for (const o of [...ofertasAtivas, ...oQueFechouSemana]) {
    const c = findCampanha(camps, { origem: o.origem, destino: o.destino, tipo: o.tipo });
    if (c) add(c.source_url, c.source_name);
  }
  if (out.length === 0) {
    const c = camps.find((x) => isHttps(x.source_url));
    if (c) add(c.source_url, c.source_name);
  }
  if (out.length === 0) {
    throw new Error('montarEdicaoDoDia: sem nenhuma fonte https no conjunto — edição não publicável (regra-mãe)');
  }
  return out;
}

// ---------------------------------------------------------------------------
// utilitários
// ---------------------------------------------------------------------------
function dedupe(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}
function cmpPrazo(a, b) {
  const va = a ? Date.parse(a) : Infinity;
  const vb = b ? Date.parse(b) : Infinity;
  return va - vb;
}
function cmpFirstSeen(a, b) {
  const va = a.first_seen ? Date.parse(a.first_seen) : 0;
  const vb = b.first_seen ? Date.parse(b.first_seen) : 0;
  return vb - va;
}
function estaVencendo(prazo, asOf) {
  const v = parseDate(prazo);
  const ref = parseDate(asOf);
  return !Number.isNaN(v) && v >= ref && v <= ref + 3 * DIA_MS;
}
function destinoReal(o) {
  const d = o?.destino;
  return d && d !== 'sem_destino' ? d : null;
}
function parseRoute(routeKey) {
  const m = String(routeKey || '').match(/^([a-z0-9-]+)->([a-z0-9-]+)$/);
  return m ? { origem: m[1], destino: m[2] } : null;
}
function pickFeatured(ofertasAtivas, deals, camps) {
  if (deals.length) {
    const r = parseRoute(deals[0].routeKey);
    const c = camps.find((x) => x.origem_code === r?.origem && x.destino_code === r?.destino);
    if (c) return { origem: c.origem_code, destino: c.destino_code, tipo: c.tipo, percentual: pctNum(c.percentual), cpm: normalizeCpm(c.cpm) };
  }
  return ofertasAtivas[0] || null;
}
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'fonte'; }
}
