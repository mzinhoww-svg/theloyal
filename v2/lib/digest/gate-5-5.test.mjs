// Golden do gate 5.5. node --test v2/lib/digest/gate-5-5.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISCLAIMER } from '../../../scripts/lib.mjs';
import { checkComuns, checkComDealDesk, checkSemDealDesk, runGate55, DEAL_DESK_MARKER } from './gate-5-5.mjs';
import { selecionarSinaisRapidos } from './dia-fraco.mjs';

// Estado real de hoje (2026-07-17, SPEC-SLICE-DIGEST-ENGINE.md §0): 0 elegíveis
// a Deal Desk; o único item vivo/tier1/com-conta é bruto 55 (smiles, compra),
// vence hoje — vira sinal rápido, não Deal Desk.
const CAMPANHAS_HOJE = [
  {
    id: 'smiles-desconhecido-compra-2026-07-17',
    tipo: 'compra', origem_code: 'brl', destino_code: 'smiles', publico: 'geral',
    estado: 'ultimos_dias', tier: 1, tl_score_bruto: 55, veredito_bruto: 'Só para casos específicos',
    override_aplicado: null, vigencia_fim: '2026-07-17T23:59:00-03:00', first_seen: '2026-07-10',
  },
];

function edicaoDiaFracoValida() {
  const { itens: sinaisRapidos } = selecionarSinaisRapidos(CAMPANHAS_HOJE);
  return {
    number: 42, date: '2026-07-17', weekday: 'SEXTA-FEIRA', publishTime: '8H00', readingMinutes: 5,
    signal: 'Hoje 1 candidato vivo com TIER 1 confirmado teve conta fechada: smiles bruto 55, banda "Só para casos específicos" — abaixo do corte de Deal Desk (vale-olhar/vale-agir).',
    deals: [],
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
  assert.ok(r.errors.some((e) => e.includes('signal não é genérico')), `deveria reprovar signal genérico: ${JSON.stringify(r.errors)}`);
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
    id: 'c1', origem_code: 'livelo', destino_code: 'smiles', estado: 'ativa', tier: 1,
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
    id: 'c1', origem_code: 'livelo', destino_code: 'smiles', estado: 'ativa', tier: 1,
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
  assert.ok(results.some((r) => !r.ok && r.check.includes('elegível a Deal Desk')));
});
