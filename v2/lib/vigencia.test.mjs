// Golden/invariante do parser de vigência (INV-16). node --test v2/lib/vigencia.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseVigencia, inferirAno } from './vigencia.mjs';

const V = (texto, slug = '', publicado_em = null) => parseVigencia({ texto, slug, publicado_em }).vigencia_fim;

// ── INV-16: nunca afirmar data sem os 3 componentes com evidência ──
test('INV-16: texto sem dia/mês → indeterminada (não fabrica)', () => {
  assert.equal(V('Azul oferece até 15 pontos por real, até sábado (17)'), 'indeterminada'); // dia sem mês
  assert.equal(V('Clube Livelo Top, 380 mil pontos'), 'indeterminada');
  assert.equal(V('promo válida até 30/06', ''), 'indeterminada');                            // dd/mm sem ano/proxy
});

test('INV-16: "a partir de DD/MM" é início, não fim → indeterminada', () => {
  assert.equal(V('Mudança começa a valer a partir do dia 20/02', 'btg-jan25'), 'indeterminada');
});

test('INV-16: "não informado até qual data" → indeterminada', () => {
  assert.equal(V('8% de cashback na Amazon 06/02. Não é informado até qual data', 'intershop-fev22'), 'indeterminada');
});

// ── datas com evidência ──
test('data cheia no texto (DD/MM/AA)', () => {
  assert.equal(V('15 pontos por real na farmácia 17/06/25'), '2025-06-17');
  assert.equal(V('10% de cashback na compra de créditos Uber 23/03/26'), '2026-03-23');
});

test('parcial + âncora de fim + slug-proxy (mesmo ano)', () => {
  assert.equal(V('válida até 14/05', 'oferta-azul-esfera-80-mai25'), '2025-05-14');
  assert.equal(V('somente hoje (10/10)', 'clube-livelo-out25'), '2025-10-10');
});

test('slug data cheia só vale com âncora "hoje" (senão é data de publicação)', () => {
  assert.equal(V('3 promoções que terminam hoje', 'terminam-hoje-9mai25'), '2025-05-09'); // "hoje" → vigência
  assert.equal(V('Compre créditos Uber com 10% de cashback', 'cashback-uber-inter-19jun26'), 'indeterminada'); // sem hoje → pub
});

// ── inferência de ano com trava de virada ──
test('virada de ano: pub dez, "até 31/01" → ano seguinte', () => {
  assert.equal(V('promoção válida até 31/01', '', '2025-12-10'), '2026-01-31');
  assert.equal(inferirAno({ dia: 31, mes: 1, publicado_em: '2025-12-10' }).ano, 2026);
});

test('sem virada: pub jan, "até 30/06" → mesmo ano', () => {
  assert.equal(V('válida até 30/06', '', '2025-01-15'), '2025-06-30');
});

test('ambíguo (sem proxy de ano nenhum) → indeterminada, não chuta', () => {
  assert.equal(V('válida até 30/06', '', null), 'indeterminada');
  assert.equal(inferirAno({ dia: 30, mes: 6, publicado_em: null }), null);
});

// ── lock contra o gold estrito ──
test('lock: parser reproduz o gold estrito de vigência (14 datas + indeterminada)', () => {
  const DIR = dirname(fileURLToPath(import.meta.url));
  const rot = JSON.parse(readFileSync(join(DIR, '..', 'golden', 'AMOSTRA-100-ROTULADA.json'), 'utf8'));
  const gold = new Map(JSON.parse(readFileSync(join(DIR, '..', 'golden', 'vigencia-gold.json'), 'utf8')).map((g) => [g.id, g.esperado]));
  const slugDe = (u) => u.replace(/\/+$/, '').split('/').pop().replace(/\.html$/, '');
  let over = 0;
  for (const r of rot.filter((x) => x.classe === 'campanha')) {
    const got = parseVigencia({ texto: `${r.input.titulo} ${r.input.trecho}`, slug: slugDe(r.url), publicado_em: null }).vigencia_fim;
    const exp = gold.get(r.id);
    if (exp === 'indeterminada' && got !== 'indeterminada') over++;
    assert.equal(got, exp, `${r.id}: ${got} != ${exp}`);
  }
  assert.equal(over, 0, 'overprecision deve ser 0 (INV-16)');
});
