// Golden da fidelidade numérica da síntese (INV-25 · DELTA). node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extrairNumeros, normalizarNumero, numerosSemLastro, validarSintese,
} from './sintese-clipping.mjs';

test('normalizarNumero: tolerância de formatação (BR vs US, milhar)', () => {
  assert.equal(normalizarNumero('R$ 16,84'), 16.84);
  assert.equal(normalizarNumero('16.84'), 16.84);
  assert.equal(normalizarNumero('1.234,56'), 1234.56);
  assert.equal(normalizarNumero('110.000'), 110000);
});

test('extrairNumeros: kind por unidade, sem recontar o mesmo dígito', () => {
  assert.deepEqual(extrairNumeros('bônus de 30%'), [{ kind: 'pct', value: 30 }]);
  assert.deepEqual(extrairNumeros('110k pontos'), [{ kind: 'qtd', value: 110000 }]);
  assert.deepEqual(extrairNumeros('25 pontos por dólar'), [{ kind: 'ratio', value: 25 }]);
  assert.deepEqual(extrairNumeros('custo R$ 16,84 por milheiro'), [{ kind: 'brl', value: 16.84 }]);
  assert.deepEqual(extrairNumeros('vence 17/07'), [{ kind: 'date', value: '17-07' }]);
});

test('tolerância 16,84 vs 16.84 não gera falso-positivo', () => {
  const orfaos = numerosSemLastro('custo de R$ 16,84 por milheiro', 'a fonte diz R$ 16.84 o milheiro');
  assert.deepEqual(orfaos, []);
});

test('síntese com número ausente da fonte REPROVA (caso Hyatt: 110k inventado)', () => {
  const fonte = { title: 'World of Hyatt', content: 'A promoção dá 20% de bônus na compra de pontos.' };
  const sintese = 'A World of Hyatt oferece 20% de bônus e um teto de 110k pontos por conta.';
  const r = validarSintese(sintese, fonte);
  assert.equal(r.ok, false);
  const m = r.motivos.find((x) => x.startsWith('numero_sem_lastro'));
  assert.ok(m, 'deve flagar numero_sem_lastro');
  assert.match(m, /110000|110k/i);
  // o 20% (que existe na fonte) NÃO é flagado
  assert.doesNotMatch(m, /20%/);
});

test('classe AliExpress: "25%" quando a fonte diz "25 pontos por dólar" → FLAG (kind ≠)', () => {
  const fonte = { title: 'Livelo no AliExpress', content: 'Acúmulo de 25 pontos por dólar no AliExpress.' };
  const sintese = 'A Livelo turbinou o AliExpress para 25% de bônus.';
  const r = validarSintese(sintese, fonte);
  assert.equal(r.ok, false, 'unidade errada é número sem lastro (INV-25)');
  assert.ok(r.motivos.some((x) => x.startsWith('numero_sem_lastro') && /25%/.test(x)));
});

test('síntese com todos os números presentes na fonte PASSA', () => {
  const fonte = { title: 'Livelo → LATAM', content: 'Transferência com 80% de bônus, vigente até 30/07.' };
  const sintese = 'A Livelo abriu transferências para a LATAM com 80% de bônus até 30/07.';
  const r = validarSintese(sintese, fonte);
  assert.deepEqual(r.motivos.filter((m) => m.startsWith('numero_sem_lastro')), []);
});

test('número órfão não descarta — só entra na lista de motivos (D-060)', () => {
  const orfaos = numerosSemLastro('agora são 50% de bônus', 'a fonte fala em 30% de bônus');
  assert.equal(orfaos.length, 1);
  assert.equal(orfaos[0].kind, 'pct');
  assert.equal(orfaos[0].value, 50);
});
