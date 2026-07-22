// Golden de Ofertas ativas + Cartões & bancos (M2 · Digest Engine v3, D-057).
// node --test v2/lib/digest/ofertas-ativas.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selecionarOfertasAtivas, selecionarCartoesBancos, BANCOS_ORIGEM, ehClippingOnly } from './ofertas-ativas.mjs';

// O único item real que passa os 3 portões hoje (SPEC-SLICE-DIGEST-ENGINE.md
// v3 §1.1) — bruto 55, "Só para casos específicos".
const ITEM_REAL_HOJE = {
  id: 'smiles-desconhecido-compra-2026-07-17',
  tipo: 'compra', origem_code: 'brl', destino_code: 'smiles', publico: 'geral',
  estado: 'ultimos_dias', tier: 1, tem_tier1: true, tl_score_bruto: 55, veredito_bruto: 'Só para casos específicos',
  percentual: 40, vigencia_fim: '2026-07-17T23:59:00-03:00',
};

// ── Ofertas ativas ──
test('estado real de hoje: exatamente 1 item passa, leitura = casos-especificos (golden)', () => {
  const r = selecionarOfertasAtivas([ITEM_REAL_HOJE]);
  assert.equal(r.omitido, false);
  assert.equal(r.itens.length, 1);
  assert.deepEqual(r.itens[0], {
    origem: 'brl', destino: 'smiles', tipo: 'compra', percentual: 40,
    prazo: '2026-07-17T23:59:00-03:00', leitura: 'casos-especificos',
  });
});

test('array vazio/ausente → omitido, não lança (golden do dia zero)', () => {
  assert.deepEqual(selecionarOfertasAtivas([]), { itens: [], omitido: true });
  assert.deepEqual(selecionarOfertasAtivas(undefined), { itens: [], omitido: true });
});

test('vários itens cruzando bandas de veredito diferentes → todos entram, sem corte de veredito', () => {
  const campanhas = [
    { id: 'a', tipo: 'transferencia', origem_code: 'livelo', destino_code: 'smiles', estado: 'ativa', tier: 1, tem_tier1: true, tl_score_bruto: 90, veredito_bruto: 'Vale agir', percentual: 100, vigencia_fim: '2026-08-01T00:00:00-03:00' },
    { id: 'b', tipo: 'transferencia', origem_code: 'esfera', destino_code: 'azul', estado: 'ativa', tier: 1, tem_tier1: true, tl_score_bruto: 75, veredito_bruto: 'Vale olhar', percentual: 90, vigencia_fim: '2026-08-05T00:00:00-03:00' },
    { id: 'c', tipo: 'compra', origem_code: 'brl', destino_code: 'smiles', estado: 'ultimos_dias', tier: 1, tem_tier1: true, tl_score_bruto: 55, veredito_bruto: 'Só para casos específicos', percentual: 40, vigencia_fim: '2026-07-17T23:59:00-03:00' },
    { id: 'd', tipo: 'clube', origem_code: 'azul', destino_code: 'azul', estado: 'ativa', tier: 1, tem_tier1: true, tl_score_bruto: 48, veredito_bruto: 'Esperaria', percentual: 20, vigencia_fim: null },
    { id: 'e', tipo: 'transferencia', origem_code: 'livelo', destino_code: 'hilton', estado: 'ativa', tier: 1, tem_tier1: true, tl_score_bruto: 30, veredito_bruto: 'Evitaria', percentual: 50, vigencia_fim: '2026-08-01T00:00:00-03:00' },
  ];
  const r = selecionarOfertasAtivas(campanhas);
  assert.equal(r.omitido, false);
  assert.equal(r.itens.length, 5);
  assert.deepEqual(r.itens.map((i) => i.leitura), ['vale-agir', 'vale-olhar', 'casos-especificos', 'esperaria', 'evitaria']);
});

test('destino null (lado único, ex.: compra de pontos) preservado como null', () => {
  const campanhas = [{ id: 'x', tipo: 'compra', origem_code: 'smiles', destino_code: null, estado: 'ativa', tier: 1, tem_tier1: true, tl_score_bruto: 60, veredito_bruto: 'Só para casos específicos', percentual: null, vigencia_fim: null }];
  const r = selecionarOfertasAtivas(campanhas);
  assert.equal(r.itens[0].destino, null);
  assert.equal(r.itens[0].prazo, null, 'prazo null = vigência indeterminada, nunca fabricada');
});

test('exclui item que não passa os 3 portões (morto/tier2/sem conta) — mesma disciplina de passaTresPortoes', () => {
  const campanhas = [
    { id: 'morto', tipo: 'compra', estado: 'encerrada', tier: 1, tem_tier1: true, tl_score_bruto: 90, veredito_bruto: 'Vale agir' },
    { id: 'tier2', tipo: 'compra', estado: 'ativa', tier: 2, tl_score_bruto: 90, veredito_bruto: 'Vale agir' },
    { id: 'sem-conta', tipo: 'compra', estado: 'ativa', tier: 1, tem_tier1: true, tl_score_bruto: null, veredito_bruto: 'Não confirmado' },
  ];
  const r = selecionarOfertasAtivas(campanhas);
  assert.equal(r.omitido, true);
});

test('veredito_bruto desconhecido lança (sem fallback silencioso, mesma disciplina de mapVeredito)', () => {
  const campanhas = [{ id: 'x', tipo: 'compra', estado: 'ativa', tier: 1, tem_tier1: true, tl_score_bruto: 60, veredito_bruto: 'Rótulo inventado' }];
  assert.throws(() => selecionarOfertasAtivas(campanhas), /rótulo desconhecido/);
});

// ── Cartões & bancos ──
test('BANCOS_ORIGEM: lista curada D-057 decisão 3', () => {
  assert.deepEqual(BANCOS_ORIGEM, ['itau', 'inter', 'c6', 'bradesco', 'banco_do_brasil', 'nubank', 'caixa', 'brb', 'santander', 'btg', 'xp', 'picpay']);
});

test('Cartões & bancos: tipo=cartao entra mesmo TIER 2 (D-057 decisão 2, evergreen sem corte)', () => {
  const campanhas = [{ id: 'x', tipo: 'cartao', origem_code: 'itau', destino_code: null, estado: 'ativa', tier: 2, tl_score_bruto: null, veredito_bruto: null, percentual: null }];
  const r = selecionarCartoesBancos(campanhas);
  assert.equal(r.omitido, false);
  assert.equal(r.itens.length, 1);
});

test('Cartões & bancos: transferencia com origem_code fora da lista curada é excluída', () => {
  const campanhas = [{ id: 'x', tipo: 'transferencia', origem_code: 'programa_desconhecido', estado: 'ativa', tier: 1, tem_tier1: true, tl_score_bruto: 80 }];
  const r = selecionarCartoesBancos(campanhas);
  assert.equal(r.omitido, true);
});

test('Cartões & bancos: transferencia com origem_code de banco curado entra', () => {
  const campanhas = [{ id: 'x', tipo: 'transferencia', origem_code: 'inter', destino_code: 'livelo', estado: 'detectada', tier: 2, percentual: 15 }];
  const r = selecionarCartoesBancos(campanhas);
  assert.equal(r.omitido, false);
  assert.equal(r.itens[0].origem, 'inter');
});

test('Cartões & bancos: estado morto (encerrada) excluído mesmo sendo cartao/banco', () => {
  const campanhas = [
    { id: 'a', tipo: 'cartao', origem_code: 'itau', estado: 'encerrada' },
    { id: 'b', tipo: 'transferencia', origem_code: 'nubank', estado: 'encerrada' },
  ];
  const r = selecionarCartoesBancos(campanhas);
  assert.equal(r.omitido, true);
});

test('Cartões & bancos: lista de bancos é injetável (extensível sem re-trabalho, D-057 decisão 3)', () => {
  const campanhas = [{ id: 'x', tipo: 'transferencia', origem_code: 'banco_novo', estado: 'ativa' }];
  assert.equal(selecionarCartoesBancos(campanhas).omitido, true);
  assert.equal(selecionarCartoesBancos(campanhas, { bancosOrigem: ['banco_novo'] }).omitido, false);
});

test('Cartões & bancos: 5 cartão + 2 transferência-banco vivas (estado real medido no §1.4 da spec) → 7 itens', () => {
  const cartoes = Array.from({ length: 5 }, (_, i) => ({ id: `cartao-${i}`, tipo: 'cartao', origem_code: `banco${i}`, estado: 'ativa' }));
  const bancos = [
    { id: 'b1', tipo: 'transferencia', origem_code: 'itau', estado: 'ativa' },
    { id: 'b2', tipo: 'transferencia', origem_code: 'inter', estado: 'detectada' },
  ];
  const r = selecionarCartoesBancos([...cartoes, ...bancos]);
  assert.equal(r.itens.length, 7);
});

test('array vazio/ausente → omitido, não lança', () => {
  assert.deepEqual(selecionarCartoesBancos([]), { itens: [], omitido: true });
  assert.deepEqual(selecionarCartoesBancos(undefined), { itens: [], omitido: true });
});

// ── A8 (D-061.2): item clipping-only (Caixa) é cortado dos seletores ──
test('ehClippingOnly normaliza forma (array e objeto) e default false', () => {
  assert.equal(ehClippingOnly({ used_in: ['clipping_only'] }), true);
  assert.equal(ehClippingOnly({ used_in: { clipping_only: true } }), true);
  assert.equal(ehClippingOnly({ used_in: { pro: [], daily: [], weekly: [] } }), false);
  assert.equal(ehClippingOnly({ used_in: null }), false);
  assert.equal(ehClippingOnly({}), false);
});

test('golden Caixa: cartão clipping-only NÃO entra em Cartões & bancos (D-061.2 preservada)', () => {
  const caixa = { estado: 'ativa', tipo: 'cartao', origem_code: 'caixa', used_in: ['clipping_only'] };
  const cartaoNormal = { estado: 'ativa', tipo: 'cartao', origem_code: 'itau' };
  const r = selecionarCartoesBancos([caixa, cartaoNormal]);
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].origem, 'itau');
});
