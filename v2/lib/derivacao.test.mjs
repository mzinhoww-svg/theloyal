// node --test — camada de derivação (M2 · re-score, D-032).
// Determinismo, fronteira redistribuição vs conta_nao_calculavel, base curta,
// e um end-to-end derivação→calcularScore GUARDADO (roda só quando score.mjs
// existe na árvore; ativa sozinho quando a slice do engine mergeia).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DERIVACAO_V1,
  derivarEficiencia,
  derivarPercentil,
  derivarRaridade,
  derivarAbrangencia,
  contaNaoCalculavel,
  montarEntradas,
} from './derivacao.mjs';

// Amostras reais lidas do banco (read-only) — ver PROPOSTA-VETOR-DERIVACAO.md.
const CPM_POP = [11.85, 13.44, 15.37, 16.84, 28, 29.93, 30.06, 30.1, 35, 60];
// itau→latampass transferência (50): 20×7, 25×11, 30×26, 35×2, 40×4.
const ITAU_LATAM = [
  ...Array(7).fill(20), ...Array(11).fill(25), ...Array(26).fill(30),
  ...Array(2).fill(35), ...Array(4).fill(40),
];
// livelo→azul transferência (40): 70×1, 90×7, 100×7, 110×15, 115×5, 120×4, 130×1.
const LIVELO_AZUL = [
  70, ...Array(7).fill(90), ...Array(7).fill(100), ...Array(15).fill(110),
  ...Array(5).fill(115), ...Array(4).fill(120), 130,
];

// ---------------------------------------------------------------------------
test('determinismo: mesma entrada → mesma saída (INV-12)', () => {
  const a = derivarPercentil({ percentual: 40, historicoRota: ITAU_LATAM });
  const b = derivarPercentil({ percentual: 40, historicoRota: [...ITAU_LATAM].reverse() });
  assert.deepEqual(a, b); // independe da ordem da amostra
  assert.deepEqual(
    derivarEficiencia(28, CPM_POP), derivarEficiencia(28, [...CPM_POP].reverse()));
});

// --- eficiência ------------------------------------------------------------
test('eficiência: menor CPM → valor maior (monotônico decrescente no CPM)', () => {
  const baixo = derivarEficiencia(11.85, CPM_POP).valor;
  const meio = derivarEficiencia(28, CPM_POP).valor;
  const alto = derivarEficiencia(60, CPM_POP).valor;
  assert.ok(baixo > meio && meio > alto, `${baixo} > ${meio} > ${alto}`);
  assert.ok(baixo >= 0.9, 'CPM mínimo ≈ topo da eficiência');
  assert.ok(alto <= 0.1, 'CPM máximo ≈ fundo da eficiência');
});

test('eficiência: CPM ausente/inválido → null (redistribui, não zero)', () => {
  assert.equal(derivarEficiencia(null, CPM_POP), null);
  assert.equal(derivarEficiencia(undefined, CPM_POP), null);
  assert.equal(derivarEficiencia(NaN, CPM_POP), null);
  assert.equal(derivarEficiencia(0, CPM_POP), null);
  assert.equal(derivarEficiencia(-5, CPM_POP), null);
});

test('eficiência: sem distribuição de referência → null (não fabrica)', () => {
  assert.equal(derivarEficiencia(28, []), null);
  assert.equal(derivarEficiencia(28, undefined), null);
});

// --- percentil -------------------------------------------------------------
test('percentil: valor no topo da rota → percentil alto', () => {
  const r = derivarPercentil({ percentual: 40, historicoRota: ITAU_LATAM });
  // 46 abaixo + 4 empates → (46 + 2)/50 = 0,96
  assert.equal(r.valor, 0.96);
  assert.equal(r.base_n, 50);
  assert.equal(r.base_curta, false);
});

test('percentil: valor no fundo da rota → percentil baixo', () => {
  const r = derivarPercentil({ percentual: 20, historicoRota: ITAU_LATAM });
  // 0 abaixo + 7 empates → (0 + 3,5)/50 = 0,07
  assert.equal(r.valor, 0.07);
});

test('percentil: valor bruto, não amortecido (engine amortece depois)', () => {
  // rota curta com 1 amostra: midrank do próprio valor = 0,5, base_curta=true.
  const r = derivarPercentil({ percentual: 40, historicoRota: [40] });
  assert.equal(r.valor, 0.5);
  assert.equal(r.base_n, 1);
  assert.equal(r.base_curta, true);
});

test('percentil: base curta sinalizada quando base_n < min_samples', () => {
  const curta = derivarPercentil({ percentual: 40, historicoRota: [30, 40] });
  assert.equal(curta.base_n, 2);
  assert.equal(curta.base_curta, true); // 2 < 3
  const cheia = derivarPercentil({ percentual: 110, historicoRota: LIVELO_AZUL });
  assert.equal(cheia.base_curta, false); // 40 ≥ 3
});

test('percentil: tem % mas rota sem histórico → presente neutro (0,5), base_curta', () => {
  const r = derivarPercentil({ percentual: 90, historicoRota: [] });
  assert.equal(r.valor, 0.5);
  assert.equal(r.base_n, 0);
  assert.equal(r.base_curta, true);
});

test('percentil: sem % → null (componente ausente, não neutro)', () => {
  assert.equal(derivarPercentil({ percentual: null, historicoRota: ITAU_LATAM }), null);
  assert.equal(derivarPercentil({ percentual: undefined, historicoRota: ITAU_LATAM }), null);
  assert.equal(derivarPercentil({}), null);
});

// --- raridade --------------------------------------------------------------
test('raridade: rota única (n=1) tetada em 0,85 (D-037); recorrente (n>50) → comum', () => {
  assert.equal(derivarRaridade({ frequencia: 1 }).valor, 0.85); // D-037: n=1 tetado, não premiar ruído
  assert.equal(derivarRaridade({ frequencia: 2 }).valor, 0.85);
  assert.equal(derivarRaridade({ frequencia: 3 }).valor, 0.65);
  assert.equal(derivarRaridade({ frequencia: 20 }).valor, 0.45);
  assert.equal(derivarRaridade({ frequencia: 50 }).valor, 0.25);
  assert.equal(derivarRaridade({ frequencia: 96 }).valor, 0.10);
});

test('raridade: resolve frequência via lookup (objeto e Map) ou historicoRota', () => {
  assert.equal(derivarRaridade({ rota: 'a|b|c|geral', frequencias: { 'a|b|c|geral': 3 } }).valor, 0.65);
  assert.equal(derivarRaridade({ rota: 'k', frequencias: new Map([['k', 1]]) }).valor, 0.85); // D-037: n=1 tetado
  assert.equal(derivarRaridade({ historicoRota: [40, 40, 40] }).base_n, 3);
});

test('raridade: frequência desconhecida → null (não chuta)', () => {
  assert.equal(derivarRaridade({}), null);
  assert.equal(derivarRaridade({ frequencia: 0 }), null);
  assert.equal(derivarRaridade({ rota: 'x', frequencias: {} }), null);
});

// --- abrangência -----------------------------------------------------------
test('abrangência: geral > cartão > selecionados > clube', () => {
  assert.ok(
    derivarAbrangencia('geral').valor > derivarAbrangencia('cartao').valor &&
    derivarAbrangencia('cartao').valor > derivarAbrangencia('selecionados').valor &&
    derivarAbrangencia('selecionados').valor > derivarAbrangencia('clube').valor);
});

test('abrangência: público desconhecido → null', () => {
  assert.equal(derivarAbrangencia('inexistente'), null);
  assert.equal(derivarAbrangencia(undefined), null);
});

// --- fronteira redistribuição vs conta_nao_calculavel (D-024/§2.1) ----------
test('ausência de eficiência (só falta CPM) NÃO é conta_nao_calculavel', () => {
  const e = montarEntradas(
    { id: 'x', percentual: 40, cpm_value: null, tipo: 'transferencia', tier: 1 },
    { historicoRota: ITAU_LATAM, frequencia: 50, publico: 'geral' });
  assert.ok(e.componentes.percentil, 'percentil presente');
  assert.equal(e.componentes.eficiencia, undefined, 'eficiência omitida (redistribui)');
  assert.equal(contaNaoCalculavel(e.componentes), false);
});

test('sem percentil E sem eficiência → conta_nao_calculavel', () => {
  const e = montarEntradas(
    { id: 'accor-accor-clube-na', percentual: null, cpm_value: null, tipo: 'clube', tier: 2 },
    { frequencia: 30, publico: 'clube' });
  assert.equal(e.componentes.percentil, undefined);
  assert.equal(e.componentes.eficiencia, undefined);
  assert.equal(contaNaoCalculavel(e.componentes), true);
  // ainda descreve a rota (raridade/abrangência presentes), mas sem veredito de valor
  assert.ok(e.componentes.raridade && e.componentes.abrangencia);
});

test('montarEntradas: componentes null são omitidos, nunca viram zero', () => {
  const e = montarEntradas(
    { id: 'y', percentual: 115, cpm_value: 11.85, tipo: 'transferencia', tier: 2 },
    { historicoRota: LIVELO_AZUL, distribuicaoCpm: CPM_POP, frequencia: 43, publico: 'geral' });
  for (const k of Object.keys(e.componentes)) {
    assert.ok(Number.isFinite(e.componentes[k].valor), `${k} finito`);
  }
  assert.equal(e.tem_tier1, false); // tier 2
});

test('montarEntradas: tier=1 → tem_tier1 true', () => {
  const e = montarEntradas({ id: 'z', percentual: 70, cpm_value: 15.37, tipo: 'transferencia', tier: 1 },
    { historicoRota: [70], distribuicaoCpm: CPM_POP, frequencia: 5, publico: 'geral' });
  assert.equal(e.tem_tier1, true);
});

// --- config versionada -----------------------------------------------------
test('vetor de derivação é versionado (análogo a score_pesos)', () => {
  assert.equal(DERIVACAO_V1.versao, 'derivacao.v1');
  assert.equal(DERIVACAO_V1.percentil.min_samples, 3); // alinhado a score_pesos.v1
});

// --- end-to-end GUARDADO: derivação → calcularScore -------------------------
// Roda só quando score.mjs existe na árvore (ativa quando a slice do engine
// mergeia nesta base). Sem ele, o contrato acima já cobre a derivação isolada.
const scorePath = join(dirname(fileURLToPath(import.meta.url)), 'score.mjs');
test('end-to-end derivação→calcularScore (guardado por score.mjs)', async (t) => {
  if (!existsSync(scorePath)) {
    t.skip('score.mjs ausente nesta base (slice do engine ainda não mergeada)');
    return;
  }
  const { calcularScore } = await import('./score.mjs');
  const PESOS_V1 = {
    versao: 'score_pesos.v1', peso_percentil: 0.45, peso_eficiencia: 0.30,
    peso_raridade: 0.15, peso_abrangencia: 0.10, shrink_k: 5, min_samples: 3,
  };
  // livelo→azul %115 cpm 11,85 tier 2: score bruto alto, rebaixado por sem_tier1.
  const entradas = montarEntradas(
    { id: 'livelo-azul-transferencia-2026-07-05', percentual: 115, cpm_value: 11.85, tipo: 'transferencia', tier: 2 },
    { historicoRota: LIVELO_AZUL, distribuicaoCpm: CPM_POP, frequencia: 43, publico: 'geral' });
  const out = calcularScore(entradas, PESOS_V1);
  assert.ok(out.tl_score_bruto > 0);
  assert.equal(out.veredito, 'Não confirmado'); // sem_tier1 rebaixa
  assert.equal(out.override_aplicado, 'sem_tier1');
});
