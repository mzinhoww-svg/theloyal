// Golden dos blocos alternativos do dia fraco. node --test v2/lib/digest/dia-fraco.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ordemBlocosDiaFraco, selecionarClipping, selecionarRadar, selecionarRadarVpm,
  selecionarSinaisRapidos, scoreAutomacaoLoyaltyLab, CORTE_AUTOMACAO_LOYALTY_LAB, precisaRevisaoHumana,
} from './dia-fraco.mjs';

test('ordemBlocosDiaFraco: ordem cravada pelo operador (D-053)', () => {
  assert.deepEqual(ordemBlocosDiaFraco, ['resumoDoDia', 'clipping', 'radar', 'radarVpm', 'sinaisRapidos', 'loyaltyLab']);
});

// ── Clipping: piso rígido de 5 ──
test('Clipping: 4 itens processados → omitido (piso de 5 não preenche com menos)', () => {
  const rows = Array.from({ length: 4 }, (_, i) => ({ id: `n${i}`, processed: true }));
  const r = selecionarClipping(rows);
  assert.equal(r.omitido, true);
  assert.deepEqual(r.itens, []);
});

test('Clipping: 5 itens processados → incluído, todos passam', () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, processed: true }));
  const r = selecionarClipping(rows);
  assert.equal(r.omitido, false);
  assert.equal(r.itens.length, 5);
});

test('Clipping: itens não processados não contam para o piso', () => {
  const rows = [
    ...Array.from({ length: 5 }, (_, i) => ({ id: `ok${i}`, processed: true })),
    { id: 'lixo1', processed: false },
    { id: 'lixo2' }, // sem processed
  ];
  const r = selecionarClipping(rows);
  assert.equal(r.omitido, false);
  assert.equal(r.itens.length, 5);
});

test('Clipping: minimo customizável', () => {
  const rows = Array.from({ length: 3 }, (_, i) => ({ id: `n${i}`, processed: true }));
  assert.equal(selecionarClipping(rows, { minimo: 3 }).omitido, false);
  assert.equal(selecionarClipping(rows, { minimo: 4 }).omitido, true);
});

test('Clipping: array vazio → omitido, não lança', () => {
  assert.deepEqual(selecionarClipping([]), { itens: [], omitido: true });
  assert.deepEqual(selecionarClipping(undefined), { itens: [], omitido: true });
});

// ── Radar: só confidence + basis reais ──
test('Radar: mantém só janelas com confidence e basis; vazio ⇒ omitido', () => {
  const janelas = [
    { label: 'a', confidence: 'alta', basis: 'cadência 6x' },
    { label: 'b', confidence: 'media' }, // sem basis
    { label: 'c', basis: 'cadência 3x' }, // sem confidence
  ];
  const r = selecionarRadar(janelas);
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].label, 'a');
  assert.equal(r.omitido, false);
});

test('Radar: nenhuma janela com lastro → omitido', () => {
  const r = selecionarRadar([{ label: 'b', confidence: 'media' }]);
  assert.equal(r.omitido, true);
  assert.deepEqual(r.itens, []);
});

// ── Radar VPM: dropa n/c e amostra ausente ──
test('Radar VPM: dropa vpmObservado="n/c" e sampleN ausente; mantém o resto', () => {
  const rows = [
    { player: 'Latam', category: 'tv', vpmObservado: 'R$ 18,20', sampleN: 12 },
    { player: 'Smiles', category: 'notebook', vpmObservado: 'n/c', sampleN: 0 },
    { player: 'Azul', category: 'phone', vpmObservado: 'R$ 20,00' }, // sem sampleN
  ];
  const r = selecionarRadarVpm(rows);
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].player, 'Latam');
  assert.equal(r.omitido, false);
});

test('Radar VPM: tudo n/c → omitido', () => {
  const r = selecionarRadarVpm([{ player: 'x', vpmObservado: 'n/c', sampleN: 0 }]);
  assert.equal(r.omitido, true);
});

// ── Sinais rápidos: nunca carrega chip de veredito ──
test('Sinais rápidos: inclui o item real de hoje (bruto 55), sem chip de veredito', () => {
  const campanhas = [
    { id: 'smiles-desconhecido-compra-2026-07-17', estado: 'ultimos_dias', tier: 1, tl_score_bruto: 55, veredito_bruto: 'Só para casos específicos', origem_code: 'brl', destino_code: 'smiles', tipo: 'compra' },
  ];
  const r = selecionarSinaisRapidos(campanhas);
  assert.equal(r.omitido, false);
  assert.equal(r.itens.length, 1);
  const item = r.itens[0];
  assert.equal(item.brutoScore, 55);
  assert.ok(!('veredito' in item), 'sinal rápido não pode carregar campo veredito');
  assert.ok(!('verdict' in item), 'sinal rápido não pode carregar campo verdict');
  assert.match(item.motivoNaoQualifica, /abaixo do corte/);
});

test('Sinais rápidos: exclui itens elegíveis a Deal Desk (esses vão para deals, não aqui)', () => {
  const campanhas = [
    { id: 'forte', estado: 'ativa', tier: 1, tl_score_bruto: 90, veredito_bruto: 'Vale agir' },
  ];
  const r = selecionarSinaisRapidos(campanhas);
  assert.equal(r.omitido, true);
  assert.deepEqual(r.itens, []);
});

test('Sinais rápidos: exclui itens que não passam os 3 portões', () => {
  const campanhas = [
    { id: 'morto', estado: 'encerrada', tier: 1, tl_score_bruto: 90, veredito_bruto: 'Só para casos específicos' },
    { id: 'tier2', estado: 'ativa', tier: 2, tl_score_bruto: 90, veredito_bruto: 'Esperaria' },
  ];
  const r = selecionarSinaisRapidos(campanhas);
  assert.equal(r.omitido, true);
});

// ── Loyalty Lab: score de automação nunca cruza o corte com trackRecord=0 ──
test('scoreAutomacaoLoyaltyLab: com trackRecord=0, NUNCA cruza o corte 0,85 — ancoragem 0..20', () => {
  for (let ancoragem = 0; ancoragem <= 20; ancoragem++) {
    const score = scoreAutomacaoLoyaltyLab({ ancoragem, trackRecord: 0 });
    assert.ok(score < CORTE_AUTOMACAO_LOYALTY_LAB, `ancoragem=${ancoragem}: score ${score} deveria ficar abaixo do corte`);
    assert.equal(precisaRevisaoHumana(score), true, `ancoragem=${ancoragem}: deveria exigir revisão humana`);
  }
});

test('scoreAutomacaoLoyaltyLab: teto algébrico do termo de ancoragem é 0,15 (satura em ancoragem=5)', () => {
  assert.equal(scoreAutomacaoLoyaltyLab({ ancoragem: 5, trackRecord: 0 }), 0.15);
  assert.equal(scoreAutomacaoLoyaltyLab({ ancoragem: 20, trackRecord: 0 }), 0.15, 'satura — mais âncoras não infla além do teto');
});

test('scoreAutomacaoLoyaltyLab: trackRecord perfeito + âncoras suficientes cruza o corte (só quando Ledger existir)', () => {
  const score = scoreAutomacaoLoyaltyLab({ ancoragem: 5, trackRecord: 1 });
  assert.equal(score, 0.85);
  assert.equal(precisaRevisaoHumana(score), false);
});

test('scoreAutomacaoLoyaltyLab: trackRecord parcial sem âncoras suficientes ainda exige revisão', () => {
  const score = scoreAutomacaoLoyaltyLab({ ancoragem: 1, trackRecord: 0.9 });
  assert.ok(score < CORTE_AUTOMACAO_LOYALTY_LAB);
});

test('scoreAutomacaoLoyaltyLab: entradas ausentes/negativas não lançam, tratadas como 0', () => {
  assert.equal(scoreAutomacaoLoyaltyLab({}), 0);
  assert.equal(scoreAutomacaoLoyaltyLab({ ancoragem: -5, trackRecord: -1 }), 0);
});

test('precisaRevisaoHumana: score inválido (NaN) exige revisão por padrão seguro', () => {
  assert.equal(precisaRevisaoHumana(NaN), true);
  assert.equal(precisaRevisaoHumana(undefined), true);
});
