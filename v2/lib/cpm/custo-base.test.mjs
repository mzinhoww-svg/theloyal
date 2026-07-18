// node --test — CPM a partir do custo-base (M2, D-032).
// Determinismo, formula CPM = custo / ((1 + B/100) * ratio), fronteira null.
// Numeros ancorados nas campanhas reais lidas do banco (read-only, jul/2026);
// ver v2/M2/PROPOSTA-CUSTO-BASE.md e PROPOSTA-RATIOS.md.
//
// `ratioBase` e OBRIGATORIO (sem default, D-039): todo caso 1:1 passa `1`
// EXPLICITO — o 1:1 e evidencia da tabela custo_base_ratio, nunca suposicao.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpmDeCustoBase } from './custo-base.mjs';

test('livelo->azul 115% com custo-base Livelo=30, ratio 1 -> CPM 13,95', () => {
  // 30 / (1 + 1,15) = 30 / 2,15 = 13,953...
  assert.equal(cpmDeCustoBase(30, 115, 1), 13.95);
});

test('esfera->latampass 120% com custo-base Esfera=35, ratio 1 -> CPM 15,91', () => {
  // 35 / 2,20 = 15,909...
  assert.equal(cpmDeCustoBase(35, 120, 1), 15.91);
});

test('smiles piso 21, bonus 0, ratio 1 -> CPM 21,00 (base pura)', () => {
  assert.equal(cpmDeCustoBase(21, 0, 1), 21);
});

test('ratio nao-1:1 eleva o CPM (caveat ConnectMiles): ratio 0,5 dobra', () => {
  const r1 = cpmDeCustoBase(30, 40, 1);      // 30 / 1,4 = 21,43
  const rMeio = cpmDeCustoBase(30, 40, 0.5); // 30 / 0,7 = 42,86
  assert.equal(r1, 21.43);
  assert.equal(rMeio, 42.86);
  assert.ok(rMeio > r1);
});

test('livelo->connectmiles 40%, custo 30, ratio 3:1 (0,3333) -> CPM 64,29 (a ancora da trava)', () => {
  // O caso-âncora D-039: ratio certo da R$ 64,29 (coerente com cpm_value=60 real);
  // ratio 1 daria R$ 21,43 — erro de 2,8x. Ver PROPOSTA-RATIOS §0.
  assert.equal(cpmDeCustoBase(30, 40, 0.3333), 64.29);
});

test('determinismo: mesma entrada -> mesma saida', () => {
  assert.equal(cpmDeCustoBase(35, 130, 1), cpmDeCustoBase(35, 130, 1));
});

test('CONTRATO D-039: ratio OMITIDO -> null (nunca 1:1 implicito)', () => {
  // Trava do vetor de ratios (decisao 3): par ausente / ratio desconhecido =>
  // CPM nao reconstruivel. Sem o 3o argumento, o retorno DEVE ser null — jamais
  // o antigo default 1 que daria 21,43 aqui.
  assert.equal(cpmDeCustoBase(30, 40), null);
  assert.equal(cpmDeCustoBase(30, 115), null);
  assert.equal(cpmDeCustoBase(21, 0), null);
});

test('fronteira null (nao chuta, INV-03): custo/bonus/ratio invalidos', () => {
  assert.equal(cpmDeCustoBase(null, 100, 1), null);
  assert.equal(cpmDeCustoBase(0, 100, 1), null);
  assert.equal(cpmDeCustoBase(-5, 100, 1), null);
  assert.equal(cpmDeCustoBase(30, -10, 1), null);
  assert.equal(cpmDeCustoBase(30, NaN, 1), null);
  assert.equal(cpmDeCustoBase(30, 100, 0), null);
  assert.equal(cpmDeCustoBase(30, 100, null), null);
  assert.equal(cpmDeCustoBase(30, 100, NaN), null);
  assert.equal(cpmDeCustoBase(30, 100, -1), null);
});

test('bonus 0, ratio 1 devolve o proprio custo-base', () => {
  assert.equal(cpmDeCustoBase(28, 0, 1), 28);
});
