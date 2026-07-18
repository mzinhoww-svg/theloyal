// Golden do plano de gravação (SPEC-SLICE-COLETA-TIER1-PRODUCAO.md §1.2).
// node --test v2/lib/coleta/gravacao-tier1.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planoDeGravacao, LIMIAR_PRODUCAO, OVERRIDE_REFUTADO_TIER1 } from './gravacao-tier1.mjs';

const HOJE = '2026-07-17';
const base = (over) => ({
  id: 'livelo-azul-transferencia-2026-07-31', url_oficial: 'https://www.livelo.com.br/promo',
  status_coleta: 'campanha', motivo: 'ok', breakdown: {}, janela: {}, escala: [], via: 'sitemap',
  ...over,
});

test('corrobora_limpo + confianca >= limiar -> grava_tier1', () => {
  const item = base({ resultado: 'corrobora_limpo', confianca: 0.90 });
  const p = planoDeGravacao(item, { hoje: HOJE });
  assert.equal(p.acao, 'grava_tier1');
  assert.deepEqual(p.campaignsUpdate, { tier: 1 });
  assert.equal(p.campanhaFontesRow.papel, 'confirmacao_oficial');
  assert.equal(p.campanhaFontesRow.tier, 1);
  assert.equal(p.campanhaVersoesRow.evento, 'confirmacao_tier1');
});

test('corrobora_limpo + confianca no limiar exato (0.75) -> grava_tier1', () => {
  const item = base({ resultado: 'corrobora_limpo', confianca: LIMIAR_PRODUCAO });
  assert.equal(planoDeGravacao(item, { hoje: HOJE }).acao, 'grava_tier1');
});

test('corrobora_limpo + confianca ABAIXO do limiar -> revisao (nao grava)', () => {
  const item = base({ resultado: 'corrobora_limpo', confianca: 0.74 });
  const p = planoDeGravacao(item, { hoje: HOJE });
  assert.equal(p.acao, 'revisao');
  assert.equal(p.campaignsUpdate, null);
  assert.equal(p.campanhaVersoesRow, null);
  assert.equal(p.campanhaFontesRow.papel, 'revisao_pendente');
});

test('refuta + confianca >= limiar -> refuta (remove/rebaixa com firmeza)', () => {
  const item = base({ resultado: 'refuta', confianca: 1.0, veredito_bruto_atual: 'Vale agir', override_aplicado_atual: null });
  const p = planoDeGravacao(item, { hoje: HOJE });
  assert.equal(p.acao, 'refuta');
  assert.deepEqual(p.campaignsUpdate, { veredito_bruto: 'Não confirmado', override_aplicado: OVERRIDE_REFUTADO_TIER1 });
  assert.equal(p.campanhaFontesRow.papel, 'refutacao_oficial');
  assert.equal(p.campanhaFontesRow.tier, null);
  assert.equal(p.campanhaVersoesRow.evento, 'refutado_confirmacao_tier1');
  assert.deepEqual(p.campanhaVersoesRow.payload_antes, { veredito_bruto: 'Vale agir', override_aplicado: null });
});

test('refuta + confianca ABAIXO do limiar -> revisao (nao rebaixa sem confianca)', () => {
  const item = base({ resultado: 'refuta', confianca: 0.5 });
  assert.equal(planoDeGravacao(item, { hoje: HOJE }).acao, 'revisao');
});

// Achado documentado: ajuste NUNCA auto-escreve, mesmo com confianca 1.0 —
// mesmo comportamento já travado em coleta-tier1.test.mjs (decisaoNoLimiar).
test('corrobora_com_ajuste -> SEMPRE revisao, mesmo confianca 1.0 (nao redesenha o golden existente)', () => {
  const item = base({ resultado: 'corrobora_com_ajuste', confianca: 1.0 });
  const p = planoDeGravacao(item, { hoje: HOJE });
  assert.equal(p.acao, 'revisao');
  assert.equal(p.campanhaFontesRow.payload.decisao_no_limiar, 'revisao (separar por publico, D-047)');
});

test('nao_verificavel (sem_url_oficial/evergreen/nao_200) -> revisao, nunca grava', () => {
  const item = base({ resultado: 'nao_verificavel', confianca: 0.2, status_coleta: 'evergreen' });
  const p = planoDeGravacao(item, { hoje: HOJE });
  assert.equal(p.acao, 'revisao');
  assert.equal(p.campanhaFontesRow.payload.status_coleta, 'evergreen');
});

test('todo item processado grava uma linha de campanha_fontes, mesmo em revisao (trilha completa)', () => {
  for (const resultado of ['corrobora_limpo', 'corrobora_com_ajuste', 'refuta', 'nao_verificavel']) {
    const p = planoDeGravacao(base({ resultado, confianca: 0.1 }), { hoje: HOJE });
    assert.ok(p.campanhaFontesRow, `sem trilha para resultado=${resultado}`);
    assert.equal(p.campanhaFontesRow.verificado_em, HOJE);
  }
});

test('origem customizavel propaga para campanha_versoes', () => {
  const item = base({ resultado: 'corrobora_limpo', confianca: 1.0 });
  const p = planoDeGravacao(item, { hoje: HOJE, origem: 'teste-manual' });
  assert.equal(p.campanhaVersoesRow.origem, 'teste-manual');
});
