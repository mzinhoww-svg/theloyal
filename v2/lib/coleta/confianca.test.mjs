// Golden/tests do gate de confianca (Parte C). node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confianca, classificarResultado, CONFIANCA_V1, RESULTADOS } from './confianca.mjs';

// ── confianca(): funcao PURA dos sinais objetivos ──────────────────────────

test('confianca: pesos v1 somam 1,0 (score maximo = 1)', () => {
  const soma = Object.values(CONFIANCA_V1.pesos).reduce((s, p) => s + p, 0);
  assert.equal(Math.round(soma * 1e6) / 1e6, 1);
  const r = confianca({
    fonte_oficial: true, janela_vigencia_clara: true, estado_vivo_200: true,
    publico_inequivoco: true, termos_legiveis: true, resultado: 'corrobora_limpo',
  });
  assert.equal(r.score, 1);
});

test('confianca: todos os sinais falsos -> score 0', () => {
  const r = confianca({ resultado: 'nao_verificavel' });
  assert.equal(r.score, 0);
});

test('confianca: determinismo — mesmo input, mesmo score', () => {
  const s = { fonte_oficial: true, janela_vigencia_clara: true, estado_vivo_200: true };
  assert.equal(confianca(s).score, confianca(s).score);
  assert.equal(confianca(s).score, 0.7); // 0,30+0,25+0,15
});

test('confianca: ORTOGONALIDADE — refuta NAO derruba o score (caso azul)', () => {
  // O azul verificou com ALTA confianca E refutou (D-049). Todos os sinais de
  // QUALIDADE altos; resultado=refuta nao muda o score.
  const alta = {
    fonte_oficial: true, janela_vigencia_clara: true, estado_vivo_200: true,
    publico_inequivoco: true, termos_legiveis: true,
  };
  const corrob = confianca({ ...alta, resultado: 'corrobora_limpo' });
  const refuta = confianca({ ...alta, resultado: 'refuta' });
  assert.equal(corrob.score, refuta.score); // confianca identica
  assert.equal(refuta.score, 1);
  assert.equal(refuta.resultado, 'refuta'); // eixo separado preservado
});

test('confianca: sinal ausente/undefined conta como 0 (nao chuta)', () => {
  const r = confianca({ fonte_oficial: true, janela_vigencia_clara: undefined, estado_vivo_200: 'sim' });
  assert.equal(r.score, 0.3); // so fonte_oficial; 'sim' !== true -> 0
});

test('confianca: resultado invalido -> nao_verificavel', () => {
  assert.equal(confianca({ resultado: 'talvez' }).resultado, 'nao_verificavel');
  assert.equal(confianca({}).resultado, 'nao_verificavel');
});

test('confianca: breakdown soma ao score', () => {
  const r = confianca({ fonte_oficial: true, janela_vigencia_clara: true, publico_inequivoco: true });
  const soma = r.breakdown.reduce((s, b) => s + b.contribuicao, 0);
  assert.equal(Math.round(soma * 1e4) / 1e4, r.score);
});

// ── classificarResultado(): eixo RESULTADO (termos) ────────────────────────

test('resultado: corrobora_limpo — 50% geral, escala de 1 faixa (Livelo->Hilton)', () => {
  const r = classificarResultado({
    pct_ingerido: 50, publico_ingerido: 'geral',
    escala_oficial: [{ pct: 50, publico: 'geral' }],
  });
  assert.equal(r.resultado, 'corrobora_limpo');
  assert.equal(r.publico_inequivoco, true);
});

test('resultado: "ate X%" ≡ "X%" e tolerancia de arredondamento (±2pp)', () => {
  // fraseio: blog "100%" vs oficial "ate 100%" = mesmo teto
  assert.equal(classificarResultado({ pct_ingerido: 100, publico_ingerido: 'geral', escala_oficial: [{ pct: 100, publico: 'geral' }] }).resultado, 'corrobora_limpo');
  // arredondamento: 104 vs 105 dentro de 2pp
  assert.equal(classificarResultado({ pct_ingerido: 104, publico_ingerido: 'clube', escala_oficial: [{ pct: 105, publico: 'clube' }] }).resultado, 'corrobora_limpo');
});

test('resultado: refuta — 115% ausente da escala azul 50/100/105/110/120 (caso fundador)', () => {
  const r = classificarResultado({
    pct_ingerido: 115, publico_ingerido: 'geral',
    escala_oficial: [
      { pct: 50, publico: 'geral' }, { pct: 100, publico: 'clube' },
      { pct: 105, publico: 'clube' }, { pct: 110, publico: 'clube' }, { pct: 120, publico: 'clube' },
    ],
  });
  assert.equal(r.resultado, 'refuta');
  assert.match(r.motivo, /ausente/);
});

test('resultado: corrobora_com_ajuste — escala-por-publico (Smiles 375% em escala 315/325/375)', () => {
  const r = classificarResultado({
    pct_ingerido: 375, publico_ingerido: 'clube',
    escala_oficial: [
      { pct: 315, publico: 'geral' }, { pct: 325, publico: 'clube' }, { pct: 375, publico: 'clube' },
    ],
  });
  assert.equal(r.resultado, 'corrobora_com_ajuste');
  assert.match(r.motivo, /escala-por-publico|D-047/);
});

test('resultado: corrobora_com_ajuste — numero certo, publico errado', () => {
  const r = classificarResultado({
    pct_ingerido: 110, publico_ingerido: 'geral',
    escala_oficial: [{ pct: 110, publico: 'clube' }],
  });
  assert.equal(r.resultado, 'corrobora_com_ajuste');
});

test('resultado: nao_verificavel — sem % ingerido ou escala vazia', () => {
  assert.equal(classificarResultado({ pct_ingerido: null, publico_ingerido: 'clube', escala_oficial: [{ pct: 50 }] }).resultado, 'nao_verificavel');
  assert.equal(classificarResultado({ pct_ingerido: 50, publico_ingerido: 'geral', escala_oficial: [] }).resultado, 'nao_verificavel');
});

test('resultado: publico_inequivoco falso quando mesmo publico tem 2 pct', () => {
  const r = classificarResultado({
    pct_ingerido: 50, publico_ingerido: 'geral',
    escala_oficial: [{ pct: 50, publico: 'geral' }, { pct: 80, publico: 'geral' }],
  });
  assert.equal(r.publico_inequivoco, false);
});

test('RESULTADOS enum estavel', () => {
  assert.deepEqual(RESULTADOS, ['corrobora_limpo', 'corrobora_com_ajuste', 'refuta', 'nao_verificavel']);
});
