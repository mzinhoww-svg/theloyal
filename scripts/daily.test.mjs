// Golden do rating de auto-publish (decisão do operador): mínimo = gate verde +
// zero pendências de revisão. Qualquer flag baixa o rating → 1 clique.
// node --test scripts/daily.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarRating } from './daily.mjs';

test('acima do mínimo: gate verde + zero pendências → auto-elegível', () => {
  const r = avaliarRating({ pass: true, revisao: [] });
  assert.equal(r.auto, true);
  assert.equal(r.pendencias, 0);
});

test('abaixo do mínimo: gate verde mas com pendência → não automatiza (1 clique)', () => {
  const r = avaliarRating({ pass: true, revisao: [{ item: {}, flags: [{ flag: 'x' }] }] });
  assert.equal(r.auto, false);
  assert.equal(r.pendencias, 1);
  assert.match(r.motivo, /abaixo do mínimo/i);
});

test('gate vermelho nunca automatiza, mesmo sem pendências', () => {
  const r = avaliarRating({ pass: false, revisao: [] });
  assert.equal(r.auto, false);
  assert.match(r.motivo, /vermelho/i);
});

test('robusto a veredito parcial', () => {
  assert.equal(avaliarRating({}).auto, false);
  assert.equal(avaliarRating({ pass: true }).auto, true); // revisao ausente = 0 pendências
});
