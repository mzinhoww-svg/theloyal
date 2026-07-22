// Golden do gate 5.5. node --test v2/lib/digest/gate-5-5.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISCLAIMER } from '../../../scripts/lib.mjs';
import {
  checkComuns, checkComDealDesk, checkSemDealDesk, runGate55, DEAL_DESK_MARKER,
  checkOfertasAtivas, checkCartoesBancos, checkFechouSemana, checkPredict, checkContaProsa,
  checkJargao, checkRadarSemConfirmacao, checkPredictNarrativa, checkCartoesBancosItens, checkRotaDisplayCompra,
} from './gate-5-5.mjs';
import { selecionarSinaisRapidos, formatarTeaserPredict } from './dia-fraco.mjs';
import { formatarPredictNarrativa } from './editorial.mjs';

// Estado real de hoje (2026-07-17, SPEC-SLICE-DIGEST-ENGINE.md §0): 0 elegíveis
// a Deal Desk; o único item vivo/tier1/com-conta é bruto 55 (smiles, compra),
// vence hoje — vira sinal rápido, não Deal Desk.
const CAMPANHAS_HOJE = [
  {
    id: 'smiles-desconhecido-compra-2026-07-17',
    tipo: 'compra', origem_code: 'brl', destino_code: 'smiles', publico: 'geral',
    estado: 'ultimos_dias', tier: 1, tem_tier1: true, triagem_categoria: 'limpo', tl_score_bruto: 55, veredito_bruto: 'Só para casos específicos',
    percentual: 40, override_aplicado: null, vigencia_fim: '2026-07-17T23:59:00-03:00', first_seen: '2026-07-10',
  },
];

function edicaoDiaFracoValida() {
  const { itens: sinaisRapidos } = selecionarSinaisRapidos(CAMPANHAS_HOJE);
  return {
    number: 42, date: '2026-07-17', weekday: 'SEXTA-FEIRA', publishTime: '8H00', readingMinutes: 5,
    // Vocabulário do leitor (D-059): sem jargão interno (TIER/candidato vivo) —
    // "fonte oficial" é a tradução sancionada, e o gate exige dígito + candidato nomeado.
    signal: 'Hoje só 1 oferta passou com fonte oficial confirmada: smiles, compra de pontos, nota bruta 55 — banda "Só para casos específicos", abaixo do corte de Deals do dia (vale-agir/vale-olhar).',
    deals: [],
    // EPSILON: dia fraco VÁLIDO tem ao menos uma seção de transparência com dado real.
    ofertasAtivas: [
      { origem: 'brl', destino: 'smiles', tipo: 'compra', percentual: 40, prazo: '2026-07-17T23:59:00-03:00', leitura: 'casos-especificos' },
    ],
    sources: [{ label: 'Regulamento oficial Smiles', url: 'https://www.smiles.com.br' }],
    disclaimer: DISCLAIMER,
    sinaisRapidos,
    loyaltyLab: { titulo: 'Por que a janela está seca', texto: 'Nenhuma campanha forte viva confirmada hoje.', humanReviewed: true },
  };
}

const RENDERED_HTML_SEM_DEAL_DESK = '<html><body><h2>Sinal do dia</h2><p>...</p></body></html>';
const RENDERED_HTML_COM_DEAL_DESK_VAZIO = `<html><body><h2>${DEAL_DESK_MARKER}</h2></body></html>`;

// ── caso limpo: edição real de hoje, sem Deal Desk ──
test('caso limpo (hoje real): checkComuns passa sem erros', () => {
  const ed = edicaoDiaFracoValida();
  const results = checkComuns(ed);
  const falhas = results.filter((r) => !r.ok);
  assert.deepEqual(falhas, [], `checkComuns deveria passar limpo: ${JSON.stringify(falhas)}`);
});

test('caso limpo (hoje real): checkSemDealDesk passa limpo', () => {
  const ed = edicaoDiaFracoValida();
  const results = checkSemDealDesk(ed, CAMPANHAS_HOJE, RENDERED_HTML_SEM_DEAL_DESK);
  const falhas = results.filter((r) => !r.ok);
  assert.deepEqual(falhas, [], `checkSemDealDesk deveria passar limpo: ${JSON.stringify(falhas)}`);
});

test('caso limpo (hoje real): runGate55 aprova (pass=true, zero erros)', () => {
  const ed = edicaoDiaFracoValida();
  const r = runGate55(ed, { campaignsFromDb: CAMPANHAS_HOJE, renderedHtml: RENDERED_HTML_SEM_DEAL_DESK });
  assert.equal(r.pass, true, `esperava passar: ${JSON.stringify(r.errors)}`);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.length > 0, 'deve documentar os TODOs (checkLink stub, travessia parcial)');
});

// ── casos quebrados: cada um falha por um motivo específico e claro ──
test('quebrado: HTML ainda mostra a seção Deal Desk mesmo com deals=[] → gate reprova', () => {
  const ed = edicaoDiaFracoValida();
  const r = runGate55(ed, { campaignsFromDb: CAMPANHAS_HOJE, renderedHtml: RENDERED_HTML_COM_DEAL_DESK_VAZIO });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('AUSENTE do HTML')), `deveria reprovar por marcador presente: ${JSON.stringify(r.errors)}`);
});

test('quebrado: signal genérico (sem número/candidato) → gate reprova', () => {
  const ed = { ...edicaoDiaFracoValida(), signal: 'Hoje não há oferta boa, confira amanhã.' };
  const r = runGate55(ed, { campaignsFromDb: CAMPANHAS_HOJE, renderedHtml: RENDERED_HTML_SEM_DEAL_DESK });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('signal cita ao menos um número')), `deveria reprovar signal sem número: ${JSON.stringify(r.errors)}`);
});

test('quebrado: sinal rápido com chip de veredito vazado → gate reprova', () => {
  const ed = edicaoDiaFracoValida();
  ed.sinaisRapidos = [{ ...ed.sinaisRapidos[0], veredito: 'casos-especificos' }];
  const r = runGate55(ed, { campaignsFromDb: CAMPANHAS_HOJE, renderedHtml: RENDERED_HTML_SEM_DEAL_DESK });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('não carrega chip de veredito')), `deveria reprovar chip vazado: ${JSON.stringify(r.errors)}`);
});

test('quebrado: disclaimer alterado → gate reprova (INV-09)', () => {
  const ed = { ...edicaoDiaFracoValida(), disclaimer: DISCLAIMER + ' Termos e condições aplicam.' };
  const r = runGate55(ed, { campaignsFromDb: CAMPANHAS_HOJE, renderedHtml: RENDERED_HTML_SEM_DEAL_DESK });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('disclaimer')), `deveria reprovar disclaimer alterado: ${JSON.stringify(r.errors)}`);
});

test('quebrado: loyaltyLab sem revisão humana e score baixo → gate reprova', () => {
  const ed = edicaoDiaFracoValida();
  ed.loyaltyLab = { titulo: 'x', texto: 'y', humanReviewed: false, automationScore: 0.2 };
  const r = runGate55(ed, { campaignsFromDb: CAMPANHAS_HOJE, renderedHtml: RENDERED_HTML_SEM_DEAL_DESK });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('humanReviewed=true OU automationScore')), `deveria reprovar loyaltyLab: ${JSON.stringify(r.errors)}`);
});

// ── caso COM Deal Desk ──
test('COM Deal Desk: deal que não bate rota conhecida no banco → gate reprova (não recomputável)', () => {
  const ed = {
    number: 1, date: '2026-07-17', weekday: 'SEXTA-FEIRA', publishTime: '8H00', readingMinutes: 5,
    signal: 'x', sources: [{ label: 'a', url: 'https://a.com' }], disclaimer: DISCLAIMER,
    deals: [{
      category: 'x', title: 'x', context: 'x',
      conta: { rows: [['a', 'b']], result: ['c', 'd'] },
      verdict: 'vale-agir', source: 'x', routeKey: 'inexistente->rota',
    }],
  };
  const results = checkComDealDesk(ed, []);
  assert.ok(results.some((r) => !r.ok && r.check.includes('campanha correspondente localizável')));
});

test('COM Deal Desk: deal recomputa limpo contra o banco → todos os checks passam', () => {
  const campanha = {
    id: 'c1', origem_code: 'livelo', destino_code: 'smiles', estado: 'ativa', tier: 1, tem_tier1: true, triagem_categoria: 'limpo',
    tl_score_bruto: 90, veredito_bruto: 'Vale agir', vigencia_fim: '2026-08-01T00:00:00-03:00',
  };
  const ed = {
    number: 1, date: '2026-07-17',
    deals: [{
      category: 'x', title: 'x', context: 'x',
      conta: { rows: [['a', 'b']], result: ['c', 'd'] },
      verdict: 'vale-agir', source: 'x', routeKey: 'livelo->smiles', vigencia: '2026-08-01T00:00:00-03:00',
    }],
  };
  const results = checkComDealDesk(ed, [campanha]);
  const falhas = results.filter((r) => !r.ok);
  assert.deepEqual(falhas, [], `deveria passar limpo: ${JSON.stringify(falhas)}`);
});

test('COM Deal Desk: veredito do deal não bate com {vale-agir,vale-olhar} → reprova', () => {
  const campanha = {
    id: 'c1', origem_code: 'livelo', destino_code: 'smiles', estado: 'ativa', tier: 1, tem_tier1: true, triagem_categoria: 'limpo',
    tl_score_bruto: 60, veredito_bruto: 'Só para casos específicos', vigencia_fim: '2026-08-01T00:00:00-03:00',
  };
  const ed = {
    deals: [{
      category: 'x', title: 'x', context: 'x', conta: { rows: [['a', 'b']], result: ['c', 'd'] },
      verdict: 'casos-especificos', source: 'x', routeKey: 'livelo->smiles', vigencia: '2026-08-01T00:00:00-03:00',
    }],
  };
  const results = checkComDealDesk(ed, [campanha]);
  assert.ok(results.some((r) => !r.ok && r.check.includes('veredito ∈')));
  assert.ok(results.some((r) => !r.ok && r.check.includes('elegível a Deals do dia')));
});

// ── Blocos novos da v3 (D-057) ──────────────────────────────────────────
const CAMPANHA_CARTAO = { id: 'cartao1', tipo: 'cartao', origem_code: 'itau', destino_code: null, estado: 'ativa', tier: 2, tl_score_bruto: null, veredito_bruto: null, percentual: null, vigencia_fim: null };
const CAMPANHA_BANCO = { id: 'banco1', tipo: 'transferencia', origem_code: 'nubank', destino_code: 'livelo', estado: 'detectada', tier: 2, tl_score_bruto: null, veredito_bruto: null, percentual: 15, vigencia_fim: null };
const CAMPANHA_ENCERRADA_SEMANA = {
  id: 'encerrada1', tipo: 'transferencia', origem_code: 'livelo', destino_code: 'azul', estado: 'encerrada',
  tier: 1, tem_tier1: true, triagem_categoria: 'limpo', tl_score_bruto: 88, veredito_bruto: 'Vale agir', percentual: 120, vigencia_fim: '2026-07-12T23:59:00-03:00',
};
const CAMPANHAS_V3 = [...CAMPANHAS_HOJE, CAMPANHA_CARTAO, CAMPANHA_BANCO, CAMPANHA_ENCERRADA_SEMANA];

function edicaoV3Valida() {
  const base = edicaoDiaFracoValida();
  return {
    ...base,
    ofertasAtivas: [
      { origem: 'brl', destino: 'smiles', tipo: 'compra', percentual: 40, prazo: '2026-07-17T23:59:00-03:00', leitura: 'casos-especificos' },
    ],
    cartoesBancos: '5 cartões e 2 bancos seguem com transferência bonificada viva hoje — nenhum com fonte oficial confirmada ainda.',
    oQueFechouSemana: [
      { origem: 'livelo', destino: 'azul', tipo: 'transferencia', percentual: 120, encerrouEm: '2026-07-12T23:59:00-03:00' },
    ],
  };
}

// ── checkOfertasAtivas ──
test('checkOfertasAtivas: golden — item recomputa limpo (passa 3 portões, leitura bate)', () => {
  const ed = edicaoV3Valida();
  const results = checkOfertasAtivas(ed, CAMPANHAS_V3);
  const falhas = results.filter((r) => !r.ok);
  assert.deepEqual(falhas, [], `deveria passar limpo: ${JSON.stringify(falhas)}`);
});

test('checkOfertasAtivas: item ausente ⇒ sem checks (nada a recomputar)', () => {
  assert.deepEqual(checkOfertasAtivas({}, CAMPANHAS_V3), []);
});

test('checkOfertasAtivas: quebrado — leitura divergente do veredito_bruto real → reprova', () => {
  const ed = edicaoV3Valida();
  ed.ofertasAtivas[0].leitura = 'vale-agir'; // banco diz casos-especificos
  const results = checkOfertasAtivas(ed, CAMPANHAS_V3);
  assert.ok(results.some((r) => !r.ok && r.check.includes('leitura bate')));
});

test('checkOfertasAtivas: quebrado — item não localizável no banco → reprova', () => {
  const ed = edicaoV3Valida();
  ed.ofertasAtivas[0].origem = 'programa_fantasma';
  const results = checkOfertasAtivas(ed, CAMPANHAS_V3);
  assert.ok(results.some((r) => !r.ok && r.check.includes('campanha correspondente localizável')));
});

test('checkOfertasAtivas: quebrado — item não passa mais os 3 portões (estado mudou no banco) → reprova', () => {
  const ed = edicaoV3Valida();
  const campanhasEncerrada = CAMPANHAS_V3.map((c) => (c.id === 'smiles-desconhecido-compra-2026-07-17' ? { ...c, estado: 'encerrada' } : c));
  const results = checkOfertasAtivas(ed, campanhasEncerrada);
  assert.ok(results.some((r) => !r.ok && r.check.includes('elegível a Ofertas ativas')));
});

// ── checkCartoesBancos ──
test('checkCartoesBancos: golden — prosa com número + itens reais recomputados no banco', () => {
  const ed = edicaoV3Valida();
  const results = checkCartoesBancos(ed, CAMPANHAS_V3);
  const falhas = results.filter((r) => !r.ok);
  assert.deepEqual(falhas, [], `deveria passar limpo: ${JSON.stringify(falhas)}`);
});

test('checkCartoesBancos: ausente ⇒ sem checks', () => {
  assert.deepEqual(checkCartoesBancos({}, CAMPANHAS_V3), []);
});

test('checkCartoesBancos: quebrado — prosa sem nenhum número (INV-03) → reprova', () => {
  const ed = { ...edicaoV3Valida(), cartoesBancos: 'Cartões e bancos seguem com campanha viva, sem número específico hoje.' };
  const results = checkCartoesBancos(ed, CAMPANHAS_V3);
  assert.ok(results.some((r) => !r.ok && r.check.includes('cita ao menos um número')));
});

test('checkCartoesBancos: quebrado — zero itens reais no banco para embasar a prosa → reprova', () => {
  const ed = edicaoV3Valida();
  const results = checkCartoesBancos(ed, CAMPANHAS_HOJE); // sem CAMPANHA_CARTAO/CAMPANHA_BANCO
  assert.ok(results.some((r) => !r.ok && r.check.includes('existe ao menos 1 item real')));
});

// ── checkFechouSemana ──
test('checkFechouSemana: golden — item recomputa estado=encerrada/tier=1/tl_score_bruto/janela', () => {
  const ed = edicaoV3Valida();
  const results = checkFechouSemana(ed, CAMPANHAS_V3, { hoje: '2026-07-17' });
  const falhas = results.filter((r) => !r.ok);
  assert.deepEqual(falhas, [], `deveria passar limpo: ${JSON.stringify(falhas)}`);
});

test('checkFechouSemana: ausente ⇒ sem checks', () => {
  assert.deepEqual(checkFechouSemana({}, CAMPANHAS_V3, { hoje: '2026-07-17' }), []);
});

test('checkFechouSemana: quebrado — item fora da janela de 7 dias no banco → reprova', () => {
  const campanhasForaJanela = CAMPANHAS_V3.map((c) => (c.id === 'encerrada1' ? { ...c, vigencia_fim: '2026-06-01T00:00:00-03:00' } : c));
  const ed = { ...edicaoV3Valida(), oQueFechouSemana: [{ origem: 'livelo', destino: 'azul', tipo: 'transferencia', percentual: 120, encerrouEm: '2026-06-01T00:00:00-03:00' }] };
  const results = checkFechouSemana(ed, campanhasForaJanela, { hoje: '2026-07-17' });
  assert.ok(results.some((r) => !r.ok && r.check.includes('janela de 7d')));
});

test('checkFechouSemana: quebrado — banco mostra tier 2 (não TIER 1) → reprova', () => {
  const campanhasTier2 = CAMPANHAS_V3.map((c) => (c.id === 'encerrada1' ? { ...c, tier: 2 } : c));
  const ed = edicaoV3Valida();
  const results = checkFechouSemana(ed, campanhasTier2, { hoje: '2026-07-17' });
  assert.ok(results.some((r) => !r.ok && r.check.includes('janela de 7d')));
});

// ── checkPredict ──
test('checkPredict: golden — ativos>0, recomputa radarDaily e teaser renderizado bate', () => {
  const ed = { ...edicaoV3Valida(), predict: { ativos: 2 } };
  const radarDailyWindows = [
    { label: 'a', confidence: 'alta' }, { label: 'b', confidence: 'alta' }, { label: 'c', confidence: 'baixa' },
  ];
  const html = `<html>${formatarTeaserPredict(2)}</html>`;
  const results = checkPredict(ed, { renderedHtml: html, radarDailyWindows });
  const falhas = results.filter((r) => !r.ok);
  assert.deepEqual(falhas, [], `deveria passar limpo: ${JSON.stringify(falhas)}`);
});

test('checkPredict: ausente ⇒ sem checks (seção corretamente omitida)', () => {
  assert.deepEqual(checkPredict({}, {}), []);
});

test('checkPredict: quebrado — ativos=0 deveria ter sido omitido → reprova', () => {
  const ed = { predict: { ativos: 0 } };
  const results = checkPredict(ed, {});
  assert.ok(results.some((r) => !r.ok && r.check.includes('predict.ativos > 0')));
});

test('checkPredict: quebrado — ativos não bate com radarDaily recomputado → reprova', () => {
  const ed = { predict: { ativos: 5 } };
  const results = checkPredict(ed, { radarDailyWindows: [{ label: 'a', confidence: 'alta' }] });
  assert.ok(results.some((r) => !r.ok && r.check.includes('recomputado a partir de radarDaily')));
});

test('checkPredict: quebrado — teaser renderizado vaza valor/janela (texto escrito à mão, não formatarTeaserPredict) → reprova', () => {
  const ed = { predict: { ativos: 1 } };
  const html = '<html>1 previsão: Itaú → Latam Pass, ~23% na semana de 17 a 24 jul.</html>';
  const results = checkPredict(ed, { renderedHtml: html });
  assert.ok(results.some((r) => !r.ok && r.check.includes('teaser renderizado bate exatamente')));
});

// ── checkContaProsa ──
test('checkContaProsa: golden — todo número da prosa tem correspondente literal em conta', () => {
  const ed = {
    deals: [{
      category: 'x', title: 'x', context: 'x',
      conta: { rows: [['custo origem', 'R$ 1.394,00'], ['bônus', '110%']], result: ['CPM final', 'R$ 16,60 /milheiro'] },
      contaProsa: 'Com bônus de 110%, o CPM final fecha em R$ 16,60 por milheiro.',
      verdict: 'vale-agir', source: 'x',
    }],
  };
  const results = checkContaProsa(ed);
  const falhas = results.filter((r) => !r.ok);
  assert.deepEqual(falhas, [], `deveria passar limpo: ${JSON.stringify(falhas)}`);
});

test('checkContaProsa: ausente ⇒ sem checks para esse deal', () => {
  const ed = { deals: [{ category: 'x', title: 'x', context: 'x', conta: { rows: [['a', 'b']], result: ['c', 'd'] }, verdict: 'vale-agir', source: 'x' }] };
  assert.deepEqual(checkContaProsa(ed), []);
});

test('checkContaProsa: quebrado — prosa cita número que não existe na conta → reprova', () => {
  const ed = {
    deals: [{
      category: 'x', title: 'x', context: 'x',
      conta: { rows: [['bônus', '90%']], result: ['CPM final', 'R$ 15,79 /milheiro'] },
      contaProsa: 'O bônus de 130% deixa o CPM em R$ 15,79 por milheiro.', // 130% não está na conta
      verdict: 'vale-olhar', source: 'x',
    }],
  };
  const results = checkContaProsa(ed);
  assert.ok(results.some((r) => !r.ok && r.check.includes('correspondente literal')));
});

// ── Formato v4 (D-059) ──────────────────────────────────────────────────

// checkJargao
test('checkJargao: golden — edição no vocabulário do leitor passa limpo', () => {
  const ed = edicaoV3Valida();
  const results = checkJargao(ed, RENDERED_HTML_SEM_DEAL_DESK);
  const falhas = results.filter((r) => !r.ok);
  assert.deepEqual(falhas, [], `deveria passar limpo: ${JSON.stringify(falhas)}`);
});

test('checkJargao: quebrado — "TIER 1" vazando em string da edição → reprova', () => {
  const ed = { ...edicaoV3Valida(), preheader: '1 oferta com fonte TIER 1 confirmada hoje.' };
  const results = checkJargao(ed, RENDERED_HTML_SEM_DEAL_DESK);
  assert.ok(results.some((r) => !r.ok && r.detail.includes('TIER 1')));
});

test('checkJargao: quebrado — jargão só no HTML renderizado também reprova', () => {
  const ed = edicaoV3Valida();
  const html = '<html><p>56 candidatos vivos no radar hoje</p></html>';
  const results = checkJargao(ed, html);
  assert.ok(results.some((r) => !r.ok && r.check.includes('HTML renderizado')));
});

// checkRadarSemConfirmacao
const RADAR_ITEM_OK = {
  titulo: 'Banco do Nordeste → Azul Fidelidade: até 110% de bônus',
  detalhe: '80% de base para o Clube, 50% para os demais; vence hoje',
  url: 'https://pontospravoar.com/bnb-azul', fonte: 'pontospravoar', nota: null, vence: '2026-07-17',
};

test('checkRadarSemConfirmacao: golden — item com fonte e sem claim de TL passa', () => {
  const ed = { radarSemConfirmacao: [RADAR_ITEM_OK, { ...RADAR_ITEM_OK, titulo: 'Livelo → Hilton: 50%', detalhe: 'a melhor nota do dia', nota: 65 }] };
  const falhas = checkRadarSemConfirmacao(ed).filter((r) => !r.ok);
  assert.deepEqual(falhas, [], `deveria passar limpo: ${JSON.stringify(falhas)}`);
});

test('checkRadarSemConfirmacao: ausente ⇒ sem checks', () => {
  assert.deepEqual(checkRadarSemConfirmacao({}), []);
});

test('checkRadarSemConfirmacao: quebrado — item sem url ou sem fonte → reprova', () => {
  const semUrl = checkRadarSemConfirmacao({ radarSemConfirmacao: [{ ...RADAR_ITEM_OK, url: '' }] });
  assert.ok(semUrl.some((r) => !r.ok && r.check.includes('url e fonte presentes')));
  const semFonte = checkRadarSemConfirmacao({ radarSemConfirmacao: [{ ...RADAR_ITEM_OK, fonte: null }] });
  assert.ok(semFonte.some((r) => !r.ok && r.check.includes('url e fonte presentes')));
});

test('checkRadarSemConfirmacao: quebrado — nota null mas texto reivindica número TL → reprova', () => {
  const ed = { radarSemConfirmacao: [{ ...RADAR_ITEM_OK, detalhe: 'ficou com TL 65 na nossa régua', nota: null }] };
  const results = checkRadarSemConfirmacao(ed);
  assert.ok(results.some((r) => !r.ok && r.check.includes('não pode citar número TL')));
});

// checkPredictNarrativa
function predictNarrativaValida() {
  const campos = { rotaOrigem: 'esfera', rotaDestino: 'smiles', historicoTipicoPercent: 70, probabilidade: 'em-formacao' };
  return { ...campos, texto: formatarPredictNarrativa(campos) };
}

test('checkPredictNarrativa: golden — texto gerado pelo template sancionado passa', () => {
  const ed = { predictNarrativa: predictNarrativaValida() };
  const falhas = checkPredictNarrativa(ed).filter((r) => !r.ok);
  assert.deepEqual(falhas, [], `deveria passar limpo: ${JSON.stringify(falhas)}`);
});

test('checkPredictNarrativa: ausente ⇒ sem checks', () => {
  assert.deepEqual(checkPredictNarrativa({}), []);
});

test('checkPredictNarrativa: quebrado — texto escrito à mão (não recomputa) → reprova', () => {
  const pn = predictNarrativaValida();
  pn.texto = 'O Predict acompanha Esfera → Smiles, base em formação. Recorte no Digest Pro.';
  const results = checkPredictNarrativa({ predictNarrativa: pn });
  assert.ok(results.some((r) => !r.ok && r.check.includes('recomputa exatamente')));
});

test('checkPredictNarrativa: quebrado — texto vaza ano/data futura → reprova', () => {
  const pn = predictNarrativaValida();
  pn.texto = `${pn.texto} Próxima janela esperada em 2026.`;
  const results = checkPredictNarrativa({ predictNarrativa: pn });
  assert.ok(results.some((r) => !r.ok && r.check.includes('ano/data')));
});

test('checkPredictNarrativa: quebrado — janela explícita "de X a Y" → reprova', () => {
  const pn = predictNarrativaValida();
  pn.texto = `${pn.texto} Janela de 17 a 24 do mês que vem.`;
  const results = checkPredictNarrativa({ predictNarrativa: pn });
  assert.ok(results.some((r) => !r.ok && r.check.includes('janela explícita')));
});

test('checkPredictNarrativa: quebrado — probabilidade declarada não aparece no texto → reprova', () => {
  const campos = { rotaOrigem: 'esfera', rotaDestino: 'smiles', historicoTipicoPercent: 70, probabilidade: 'alta' };
  const pn = { ...campos, texto: formatarPredictNarrativa({ ...campos, probabilidade: 'baixa' }) };
  const results = checkPredictNarrativa({ predictNarrativa: pn });
  assert.ok(results.some((r) => !r.ok && r.check.includes('probabilidade visível')));
});

// checkCartoesBancosItens
const CARTAO_ITEM_OK = {
  nome: 'Itaú · cartão LATAM Pass', descricao: 'até 5,25 milhas por dólar até 31/07',
  url: 'https://www.melhorescartoes.com.br/latam-pass', fonte: 'Melhores Cartões',
  status: 'Ainda sem confirmação oficial', nota: null,
};

test('checkCartoesBancosItens: golden — fonte presente + status honesto passa', () => {
  const ed = {
    cartoesBancosItens: [
      CARTAO_ITEM_OK,
      { nome: 'C6 → LATAM Pass', descricao: '25% de bônus só hoje', url: 'https://passageirodeprimeira.com/c6', fonte: 'Passageiro de Primeira', status: 'Confirmada, mas fraca: TL 36, Evitaria', nota: 36 },
      { nome: 'Caixa', descricao: '100% de cashback no IOF', url: 'https://passageirodeprimeira.com/caixa', fonte: 'Passageiro de Primeira', status: 'Benefício de tarifa — fora da régua TL', nota: null },
    ],
  };
  const falhas = checkCartoesBancosItens(ed).filter((r) => !r.ok);
  assert.deepEqual(falhas, [], `deveria passar limpo: ${JSON.stringify(falhas)}`);
});

test('checkCartoesBancosItens: ausente ⇒ sem checks', () => {
  assert.deepEqual(checkCartoesBancosItens({}), []);
});

test('checkCartoesBancosItens: quebrado — item sem url/fonte → reprova', () => {
  const results = checkCartoesBancosItens({ cartoesBancosItens: [{ ...CARTAO_ITEM_OK, url: null }] });
  assert.ok(results.some((r) => !r.ok && r.check.includes('url e fonte presentes')));
});

test('checkCartoesBancosItens: quebrado — sem nota E sem status honesto → reprova (regra do BB Ourocard)', () => {
  const results = checkCartoesBancosItens({
    cartoesBancosItens: [{ nome: 'BB Ourocard', descricao: '5,5 milhas por dólar', url: 'https://exemplo.com/bb', fonte: 'blog', status: null, nota: null }],
  });
  assert.ok(results.some((r) => !r.ok && r.check.includes("declara 'sem confirmação'")));
});

// checkRotaDisplayCompra
test('checkRotaDisplayCompra: golden — compra com destino próprio/sem_destino/null nunca vira "sem destino"', () => {
  const ed = {
    ofertasAtivas: [
      { origem: 'smiles', destino: 'smiles', tipo: 'compra', leitura: 'casos-especificos' },
      { origem: 'smiles', destino: 'sem_destino', tipo: 'compra', leitura: 'casos-especificos' },
      { origem: 'azul_fidelidade', destino: null, tipo: 'clube', leitura: 'esperaria' },
      { origem: 'livelo', destino: 'smiles', tipo: 'transferencia', leitura: 'vale-agir' }, // ignorado (não é compra/clube)
    ],
  };
  const results = checkRotaDisplayCompra(ed);
  assert.equal(results.length, 3, 'só os itens compra/clube são checados');
  const falhas = results.filter((r) => !r.ok);
  assert.deepEqual(falhas, [], `deveria passar limpo: ${JSON.stringify(falhas)}`);
  assert.ok(results[0].detail.includes('Smiles → Smiles'));
});

test('checkRotaDisplayCompra: ausente ⇒ sem checks', () => {
  assert.deepEqual(checkRotaDisplayCompra({}), []);
});

// runGate55: blocos v4 entram na orquestração
test('runGate55: edição v4 completa (radar + predictNarrativa + cartões por item) aprova', () => {
  const ed = {
    ...edicaoV3Valida(),
    radarSemConfirmacao: [RADAR_ITEM_OK],
    predictNarrativa: predictNarrativaValida(),
    cartoesBancosItens: [CARTAO_ITEM_OK],
  };
  const r = runGate55(ed, { campaignsFromDb: CAMPANHAS_V3, renderedHtml: RENDERED_HTML_SEM_DEAL_DESK, hoje: '2026-07-17' });
  assert.equal(r.pass, true, `esperava passar: ${JSON.stringify(r.errors)}`);
});

test('runGate55: jargão em qualquer string derruba o gate', () => {
  const ed = { ...edicaoV3Valida(), resumoDoDia: 'Só 1 item com conta computável passou o dia com 55 pontos de nota.' };
  const r = runGate55(ed, { campaignsFromDb: CAMPANHAS_V3, renderedHtml: RENDERED_HTML_SEM_DEAL_DESK, hoje: '2026-07-17' });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('jargão')));
});

test('runGate55: predictNarrativa divergente do template derruba o gate', () => {
  const pn = predictNarrativaValida();
  pn.texto = 'Predict: janela prevista para a semana que vem, aproveite.';
  const ed = { ...edicaoV3Valida(), predictNarrativa: pn };
  const r = runGate55(ed, { campaignsFromDb: CAMPANHAS_V3, renderedHtml: RENDERED_HTML_SEM_DEAL_DESK, hoje: '2026-07-17' });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('recomputa exatamente')));
});

// ── runGate55: os blocos v3 entram na orquestração ──
test('runGate55: edição com blocos v3 limpos ainda aprova (pass=true)', () => {
  const ed = edicaoV3Valida();
  const radarDailyWindows = [];
  const r = runGate55(ed, {
    campaignsFromDb: CAMPANHAS_V3, renderedHtml: RENDERED_HTML_SEM_DEAL_DESK,
    radarDailyWindows, hoje: '2026-07-17',
  });
  assert.equal(r.pass, true, `esperava passar: ${JSON.stringify(r.errors)}`);
});

test('runGate55: leitura de ofertasAtivas divergente derruba o gate mesmo com o resto limpo', () => {
  const ed = edicaoV3Valida();
  ed.ofertasAtivas[0].leitura = 'vale-agir';
  const r = runGate55(ed, { campaignsFromDb: CAMPANHAS_V3, renderedHtml: RENDERED_HTML_SEM_DEAL_DESK, hoje: '2026-07-17' });
  assert.equal(r.pass, false);
  assert.ok(r.errors.some((e) => e.includes('leitura bate')));
});
