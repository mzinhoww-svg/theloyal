// Golden do engine de seleção. node --test v2/lib/digest/selecionar.test.mjs
// Fixture do dia real (2026-07-17, SPEC-SLICE-DIGEST-ENGINE.md §0): 54 vivo → 1
// tier1 → 1 conta computável → 0 elegível a Deal Desk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRES_PORTOES, passaTresPortoes, elegivelDealDesk, selecionarDealDesk, selecionarFechaLogo,
} from './selecionar.mjs';

// O único item real que passa os 3 portões hoje — bruto 55, "Só para casos
// específicos", vence hoje. Não é Deal Desk (D-050 decisão 1), mas é Fecha Logo
// (vence hoje, eixo independente, §1.4).
const ITEM_REAL_HOJE = {
  id: 'smiles-desconhecido-compra-2026-07-17',
  tipo: 'compra',
  origem_code: 'brl',
  destino_code: 'smiles',
  publico: 'geral',
  estado: 'ultimos_dias',
  tier: 1, tem_tier1: true,
  tl_score_bruto: 55,
  veredito_bruto: 'Só para casos específicos',
  override_aplicado: null,
  vigencia_fim: '2026-07-17T23:59:00-03:00',
  first_seen: '2026-07-10',
};

// Sintéticos para exercitar cap-3, tie-break e os portões negativos.
const morto_nao_vivo = { id: 'morto', estado: 'encerrada', tier: 1, tem_tier1: true, tl_score_bruto: 90, veredito_bruto: 'Vale agir', vigencia_fim: '2026-06-01T00:00:00-03:00' };
const tier2_alto = { id: 'tier2-alto', estado: 'ativa', tier: 2, tl_score_bruto: 92, veredito_bruto: 'Vale agir', vigencia_fim: '2026-08-01T00:00:00-03:00' };
const sem_conta = { id: 'sem-conta', estado: 'ativa', tier: 1, tem_tier1: true, tl_score_bruto: null, veredito_bruto: 'Não confirmado', vigencia_fim: '2026-08-01T00:00:00-03:00' };
const forte_a = { id: 'forte-a', estado: 'ativa', tier: 1, tem_tier1: true, tl_score_bruto: 88, veredito_bruto: 'Vale agir', vigencia_fim: '2026-08-10T00:00:00-03:00' };
const forte_b = { id: 'forte-b', estado: 'detectada', tier: 1, tem_tier1: true, tl_score_bruto: 88, veredito_bruto: 'Vale agir', vigencia_fim: '2026-08-01T00:00:00-03:00' }; // empata com forte_a, vence antes → sobe
const forte_c = { id: 'forte-c', estado: 'ativa', tier: 1, tem_tier1: true, tl_score_bruto: 80, veredito_bruto: 'Vale olhar', vigencia_fim: '2026-08-15T00:00:00-03:00' };
const forte_d = { id: 'forte-d', estado: 'ativa', tier: 1, tem_tier1: true, tl_score_bruto: 75, veredito_bruto: 'Vale olhar', vigencia_fim: '2026-09-01T00:00:00-03:00' };
const fraco_vivo = { id: 'fraco-vivo', estado: 'ativa', tier: 1, tem_tier1: true, tl_score_bruto: 60, veredito_bruto: 'Só para casos específicos', vigencia_fim: '2026-08-01T00:00:00-03:00' };

const CAMPANHAS_HOJE = [ITEM_REAL_HOJE];

test('estado real de hoje: o item bruto 55 passa os 3 portões', () => {
  assert.equal(passaTresPortoes(ITEM_REAL_HOJE), true);
});

test('estado real de hoje: o item bruto 55 NÃO é elegível a Deal Desk (D-050 decisão 1)', () => {
  assert.equal(elegivelDealDesk(ITEM_REAL_HOJE), false);
});

test('estado real de hoje: Deal Desk fica vazio (0 elegíveis), sem cortados', () => {
  const { selecionados, cortados } = selecionarDealDesk(CAMPANHAS_HOJE);
  assert.deepEqual(selecionados, []);
  assert.equal(cortados, 0);
});

test('estado real de hoje: o item bruto 55 ENTRA em Fecha Logo (vence hoje, eixo independente)', () => {
  const fecha = selecionarFechaLogo(CAMPANHAS_HOJE);
  assert.equal(fecha.length, 1);
  assert.equal(fecha[0].id, ITEM_REAL_HOJE.id);
});

test('TRES_PORTOES.estadosVivo cobre exatamente ativa/detectada/ultimos_dias', () => {
  assert.deepEqual([...TRES_PORTOES.estadosVivo].sort(), ['ativa', 'detectada', 'ultimos_dias']);
});

test('portão de estado: campanha encerrada não passa, mesmo tier1+conta+veredito forte', () => {
  assert.equal(passaTresPortoes(morto_nao_vivo), false);
  assert.equal(elegivelDealDesk(morto_nao_vivo), false);
});

test('portão de TIER: tier=2 não passa, mesmo vivo+conta+veredito forte (Deal Desk é TIER1 exclusivo)', () => {
  assert.equal(passaTresPortoes(tier2_alto), false);
  assert.equal(elegivelDealDesk(tier2_alto), false);
});

test('portão de conta: tl_score_bruto null não passa (conta_nao_calculavel)', () => {
  assert.equal(passaTresPortoes(sem_conta), false);
});

test('corte de veredito: fraco_vivo passa os 3 portões mas não o corte de Deal Desk', () => {
  assert.equal(passaTresPortoes(fraco_vivo), true);
  assert.equal(elegivelDealDesk(fraco_vivo), false);
});

test('ranking + cap: top 3 por tl_score_bruto desc, cortados reportado sem descarte silencioso', () => {
  const todas = [morto_nao_vivo, tier2_alto, sem_conta, forte_a, forte_b, forte_c, forte_d, fraco_vivo, ITEM_REAL_HOJE];
  const { selecionados, cortados } = selecionarDealDesk(todas);
  // elegíveis: forte_a/b/c/d (4). Os demais falham algum portão/corte. cap 3 → 1 cortado.
  assert.equal(selecionados.length, 3);
  assert.equal(cortados, 1);
  assert.deepEqual(selecionados.map((s) => s.id), ['forte-b', 'forte-a', 'forte-c']);
});

test('tie-break: mesmo tl_score_bruto, vigencia_fim mais próxima sobe primeiro', () => {
  const { selecionados } = selecionarDealDesk([forte_a, forte_b], { cap: 2 });
  assert.deepEqual(selecionados.map((s) => s.id), ['forte-b', 'forte-a']); // forte_b vence antes
});

test('cap customizado: respeita opts.cap', () => {
  const todas = [forte_a, forte_b, forte_c, forte_d];
  const { selecionados, cortados } = selecionarDealDesk(todas, { cap: 1 });
  assert.equal(selecionados.length, 1);
  assert.equal(cortados, 3);
});

test('cap não excedido: 0 elegíveis → 0 cortados (não confunde "vazio" com "cortado")', () => {
  const { selecionados, cortados } = selecionarDealDesk([morto_nao_vivo, sem_conta]);
  assert.deepEqual(selecionados, []);
  assert.equal(cortados, 0);
});

test('Fecha Logo: eixo independente — inclui itens fracos e fortes que vencem em ultimos_dias', () => {
  const vence_forte = { id: 'vence-forte', estado: 'ultimos_dias', tier: 1, tem_tier1: true, tl_score_bruto: 90, veredito_bruto: 'Vale agir', vigencia_fim: '2026-07-18T00:00:00-03:00' };
  const fecha = selecionarFechaLogo([ITEM_REAL_HOJE, vence_forte, forte_a]);
  assert.deepEqual(fecha.map((f) => f.id).sort(), ['smiles-desconhecido-compra-2026-07-17', 'vence-forte']);
});

test('array vazio/ausente não lança', () => {
  assert.deepEqual(selecionarDealDesk([]), { selecionados: [], cortados: 0 });
  assert.deepEqual(selecionarDealDesk(undefined), { selecionados: [], cortados: 0 });
  assert.deepEqual(selecionarFechaLogo([]), []);
});

// ── C1 (D-048/INV-02): portão 2 = tem_tier1 (confirmação), nunca o campo tier ──
test('passaTresPortoes: tier=1 do LLM SEM confirmação NÃO passa (portão oco fechado)', () => {
  const base = { estado: 'ativa', tl_score_bruto: 80, veredito_bruto: 'Vale agir' };
  assert.equal(passaTresPortoes({ ...base, tier: 1 }), false);
  assert.equal(passaTresPortoes({ ...base, tier: 2, tem_tier1: true }), true);
  assert.equal(passaTresPortoes({ estado: 'ativa', tem_tier1: true, tl_score_bruto: null }), false);
});
