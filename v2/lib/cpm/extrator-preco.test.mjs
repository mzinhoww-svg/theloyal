// Golden/invariante do extrator de preço de milheiro (CPM de compra).
// node --test v2/lib/cpm/extrator-preco.test.mjs
// Casos golden = formatos REAIS de campaigns.tipo='compra' no banco (cpm / valor_leitura / notes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extrairPrecoMilheiro, parsePrecoBR } from './extrator-preco.mjs';

const V = (t) => { const r = extrairPrecoMilheiro(t); return r ? r.cpm_value : null; };

// ── formatos do campo cpm (os 6 registros que hoje têm preço estruturado) ──
test('campo cpm: "R$ X /milheiro" com espaço antes da barra', () => {
  assert.equal(V('R$ 29,93 /milheiro'), 29.93);
  assert.equal(V('R$ 30,10 /milheiro'), 30.1);
  assert.equal(V('R$ 30,06 /milheiro'), 30.06);
});

test('campo cpm: "R$X/milheiro" colado', () => {
  assert.equal(V('R$35/milheiro'), 35);
});

test('campo cpm: número isolado (forma já-parseada "16.84")', () => {
  assert.equal(V('16.84'), 16.84);
  assert.equal(V('35'), 35);
  assert.equal(V('R$35'), 35);
});

// ── vírgula BR vs ponto decimal vs milhar ──
test('vírgula decimal BR → ponto', () => {
  assert.equal(parsePrecoBR('30,10'), 30.1);
  assert.equal(parsePrecoBR('16,84'), 16.84);
  assert.equal(parsePrecoBR('9,50'), 9.5);
});

test('ponto decimal e ponto milhar', () => {
  assert.equal(parsePrecoBR('16.84'), 16.84);   // ponto decimal (2 casas)
  assert.equal(parsePrecoBR('1.234'), 1234);    // ponto milhar (3 casas)
  assert.equal(parsePrecoBR('1.234,56'), 1234.56); // milhar + decimal
});

// ── formatos do texto (notes) — "por R$X o milheiro", "milheiro por R$X", "milheiro a R$X" ──
test('notes: "por R$X o milheiro" (money antes de milheiro)', () => {
  assert.equal(V('Compra de pontos Livelo por R$ 30,50 o milheiro'), 30.5);
  assert.equal(V('Compre pontos Livelo por R$ 30,80 o milheiro com 56% de bonus'), 30.8);
  assert.equal(V('Compra de milhas por R$ 24,50 o milheiro'), 24.5);
});

test('notes: "milheiro por R$X" / "Milheiro Marca por R$X" (milheiro antes)', () => {
  assert.equal(V('Turbo Livelo - milheiro por R$ 29,50'), 29.5);
  assert.equal(V("Milheiro Azul por R$ 9,50 na compra do cartao Sam's Club"), 9.5);
  assert.equal(V('Milheiro Iberia Club por R$ 60 na promoção com a Esfera'), 60);
});

test('notes: "milheiro a R$X"', () => {
  assert.equal(V('Resgate com desconto e milheiro a R$ 16,12 para usar na Uber'), 16.12);
});

// ── "a partir de" = PISO (não é o preço exato de toda a faixa) ──
test('"a partir de" é marcado como piso', () => {
  const r = extrairPrecoMilheiro('milheiro a partir de R$ 16,84 - barato vs piso 21');
  assert.equal(r.cpm_value, 16.84);
  assert.equal(r.piso, true);

  const r2 = extrairPrecoMilheiro('Milheiro na Azul a partir de R$ 12,78 usando pontos Livelo + dinheiro');
  assert.equal(r2.cpm_value, 12.78);
  assert.equal(r2.piso, true);
});

test('preço fixo NÃO é piso', () => {
  const r = extrairPrecoMilheiro('R$ 29,93 /milheiro');
  assert.equal(r.cpm_value, 29.93);
  assert.notEqual(r.piso, true);
});

// ── "de R$X para R$Y": preço vigente é Y (X é tabela) ──
test('"de R$X para R$Y" → preço final Y', () => {
  const r = extrairPrecoMilheiro('exclusivo Clube Esfera. Milheiro cai de R$70 para R$35. Ate 31/07.');
  assert.equal(r.cpm_value, 35);
  assert.notEqual(r.piso, true);
});

// ── valor aproximado "~" ──
test('"~R$X" marca aproximado, extrai o número', () => {
  const r = extrairPrecoMilheiro('R$ ~28/milheiro');
  assert.equal(r.cpm_value, 28);
  assert.equal(r.aproximado, true);
  assert.equal(V('milheiro IHG a ~R$ 28 (US$ 0,005/pt)'), 28);
});

// ── INV-16 / INV-03: sem evidência de preço de milheiro → null (não chuta) ──
test('sem preço/valor_leitura textual → null', () => {
  assert.equal(V('caro'), null);
  assert.equal(V('caro vs teto 27 (casos-especificos)'), null);
  assert.equal(V('55% Mega/Top no Pix.'), null);
  assert.equal(V(''), null);
  assert.equal(V(null), null);
  assert.equal(V(undefined), null);
});

test('R$ presente mas SEM âncora de milheiro (cupom/varejo, tipo=compra) → null', () => {
  // registros reais tipo='compra' que são cupom de varejo/passagem, não compra de milhas
  assert.equal(V('Cupom de desconto de R$ 50 em compras acima de R$ 699'), null);
  assert.equal(V('Cupom de até R$ 100 de desconto em compras acima de R$19'), null);
  assert.equal(V('Passagens aereas nacionais a partir de R$ 135,23'), null);
  assert.equal(V('Ganhe 15 mil pontos Azul ao abrir conta Nomad e converter R$ 500'), null);
  assert.equal(V('R$ 150 de bônus ao abrir a conta Revolut pelo link exclusivo'), null);
});

test('"milheiro" presente mas nenhum R$ amarrado → null (não inventa)', () => {
  assert.equal(V('Compre pontos e receba milhas no milheiro mais barato do mês'), null);
});

// ── evidência sempre presente e vinda do texto (INV-16) ──
test('resultado sempre carrega evidência não-vazia extraída do texto', () => {
  const r = extrairPrecoMilheiro('Compra de pontos Livelo por R$ 30,50 o milheiro');
  assert.ok(typeof r.evidencia === 'string' && r.evidencia.length > 0);
  assert.match(r.evidencia, /30,50/);
});

// ── shape do contrato consumido por derivacao.mjs (cpm_value:number) ──
test('cpm_value é sempre number finito > 0', () => {
  for (const t of ['R$ 29,93 /milheiro', 'milheiro por R$ 9,50', '16.84']) {
    const r = extrairPrecoMilheiro(t);
    assert.equal(typeof r.cpm_value, 'number');
    assert.ok(Number.isFinite(r.cpm_value) && r.cpm_value > 0);
  }
});
