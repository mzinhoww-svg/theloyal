// Golden do mapeamento DB → contrato. node --test v2/lib/digest/mapear-contrato.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularScore } from '../score.mjs';
import { mapVeredito, mapScoreBreakdown, MAPA_VEREDITO } from './mapear-contrato.mjs';

// ── mapVeredito: os 6 rótulos, sem fallback silencioso ──
test('mapVeredito: os 6 rótulos do banco mapeiam para o enum kebab-case do schema', () => {
  assert.equal(mapVeredito('Vale agir'), 'vale-agir');
  assert.equal(mapVeredito('Vale olhar'), 'vale-olhar');
  assert.equal(mapVeredito('Só para casos específicos'), 'casos-especificos');
  assert.equal(mapVeredito('Esperaria'), 'esperaria');
  assert.equal(mapVeredito('Evitaria'), 'evitaria');
  assert.equal(mapVeredito('Não confirmado'), 'nao-confirmado');
});

test('mapVeredito: cobre exatamente os 6 rótulos declarados (nenhum a mais/menos)', () => {
  assert.deepEqual(Object.keys(MAPA_VEREDITO).sort(), [
    'Esperaria', 'Evitaria', 'Não confirmado', 'Só para casos específicos', 'Vale agir', 'Vale olhar',
  ].sort());
});

test('mapVeredito: rótulo desconhecido lança erro — NUNCA vira "nao-confirmado" por default', () => {
  assert.throws(() => mapVeredito('Vale muito'), /rótulo desconhecido/);
  assert.throws(() => mapVeredito(''), /rótulo desconhecido/);
  assert.throws(() => mapVeredito(undefined), /rótulo desconhecido/);
  assert.throws(() => mapVeredito('vale-agir'), /rótulo desconhecido/, 'já kebab-case não é um rótulo do banco — deve lançar, não passar direto');
});

// ── mapScoreBreakdown: shape real do score.mjs → shape do schema ──
const PESOS = {
  versao: 'score_pesos.v1', peso_percentil: 0.45, peso_eficiencia: 0.30,
  peso_raridade: 0.15, peso_abrangencia: 0.10, shrink_k: 5, min_samples: 3,
};

test('mapScoreBreakdown: traduz o breakdown real do calcularScore para o shape camelCase do schema', () => {
  const entradas = {
    campaign_id: 'smiles-desconhecido-compra-2026-07-17',
    tem_tier1: true,
    componentes: {
      percentil: { valor: 0.42, base_n: 6, janela: 'rota-total' },
      eficiencia: { valor: 0.6, base_n: 40, janela: 'cpm-populacao-global' },
      raridade: { valor: 0.65, base_n: 3, janela: 'snapshot-rota' },
      abrangencia: { valor: 1.0, base_n: null, janela: 'publico' },
    },
  };
  const r = calcularScore(entradas, PESOS);
  const mapped = mapScoreBreakdown(r.breakdown);

  assert.deepEqual(Object.keys(mapped).sort(), ['abrangencia', 'eficiencia', 'percentil', 'raridade']);
  for (const nome of ['percentil', 'eficiencia', 'raridade', 'abrangencia']) {
    const original = r.breakdown.find((b) => b.componente === nome);
    assert.equal(mapped[nome].valor, original.valor);
    assert.equal(mapped[nome].valorBruto, original.valor_bruto);
    assert.equal(mapped[nome].baseN, original.base_n ?? null);
    assert.equal(mapped[nome].peso, original.peso);
    assert.equal(mapped[nome].pesoEfetivo, original.peso_efetivo);
    assert.equal(mapped[nome].janela, original.janela ?? null);
  }
});

test('mapScoreBreakdown: componente ausente (redistribuído) não aparece na saída — não vira zero inventado', () => {
  const entradas = {
    campaign_id: 'x',
    tem_tier1: true,
    componentes: {
      percentil: { valor: 0.7, base_n: 10, janela: 'rota-total' },
      // eficiencia ausente — redistribui
      raridade: { valor: 0.45, base_n: 12, janela: 'snapshot-rota' },
      abrangencia: { valor: 0.6, base_n: null, janela: 'publico' },
    },
  };
  const r = calcularScore(entradas, PESOS);
  const mapped = mapScoreBreakdown(r.breakdown);
  assert.ok(!('eficiencia' in mapped), 'eficiência ausente não deve aparecer no mapa');
  assert.deepEqual(Object.keys(mapped).sort(), ['abrangencia', 'percentil', 'raridade']);
});

test('mapScoreBreakdown: array vazio/ausente → objeto vazio (nunca lança nem inventa)', () => {
  assert.deepEqual(mapScoreBreakdown([]), {});
  assert.deepEqual(mapScoreBreakdown(undefined), {});
});

test('mapScoreBreakdown: componente fora dos 4 conhecidos lança — nunca traduz às cegas', () => {
  assert.throws(
    () => mapScoreBreakdown([{ componente: 'liquidez', valor: 0.5, valor_bruto: 0.5, peso: 0.1, peso_efetivo: 0.1 }]),
    /componente desconhecido/,
  );
});
