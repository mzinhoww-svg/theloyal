// node --test — camada de derivação LADO-ÚNICO (M2 · slice coleta-TIER1, Parte B, D-042).
// PROPOSTA a aprovar (v2/M2/PROPOSTA-VETOR-LADO-UNICO.md). NÃO ligada ao re-score.
// Cobre: determinismo (INV-12), o núcleo (bônus discrimina contra a população do
// MESMO tipo+merchant), fallback tipo marcado como sinal fraco, neutro sem fabricar
// (INV-03), fronteira ausente→null (redistribui, D-024) vs conta_nao_calculavel,
// e um end-to-end derivação→calcularScore GUARDADO (ativa quando score.mjs existe).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  LADO_UNICO_V1,
  derivarPercentilLadoUnico,
  derivarEficienciaLadoUnico,
  derivarRaridadeLadoUnico,
  derivarAbrangenciaLadoUnico,
  derivarLadoUnico,
  montarEntradasLadoUnico,
} from './lado-unico.mjs';

// Populações reais lidas do banco (read-only) — ver PROPOSTA-VETOR-LADO-UNICO.md.
// compra|mercado_livre (44 com %): mediana ~20; compra|amazon (22 com %): mediana ~25.
const ML = [10, 15, 20, 20, 20, 20, 20, 20, 25, 25, 25, 30, 40, 40, 40, 50, 60, 80, 90, 100];
const AMAZON = [15, 17, 20, 20, 20, 20, 20, 20, 20, 20, 25, 25, 25, 30, 34, 40, 40, 47, 55, 58, 63, 70];

// ---------------------------------------------------------------------------
test('determinismo: mesma entrada → mesma saída, independe da ordem (INV-12)', () => {
  const a = derivarPercentilLadoUnico({ percentual: 40, popMerchant: ML });
  const b = derivarPercentilLadoUnico({ percentual: 40, popMerchant: [...ML].reverse() });
  assert.deepEqual(a, b);
});

// --- núcleo: o bônus discrimina contra a população do MESMO merchant ---------
test('percentil merchant: bônus alto ranqueia acima de bônus baixo (mesmo merchant)', () => {
  const baixo = derivarPercentilLadoUnico({ percentual: 10, popMerchant: ML });
  const meio = derivarPercentilLadoUnico({ percentual: 25, popMerchant: ML });
  const alto = derivarPercentilLadoUnico({ percentual: 90, popMerchant: ML });
  assert.ok(alto.valor > meio.valor && meio.valor > baixo.valor,
    `${alto.valor} > ${meio.valor} > ${baixo.valor}`);
  assert.equal(alto.pop_src, 'merchant');
  assert.equal(alto.base_curta, false); // população cheia → sem amortecimento
  assert.equal(alto.base_n, ML.length);
});

test('percentil merchant: o MESMO % ranqueia DIFERENTE em merchants diferentes', () => {
  // O núcleo da proposta: 40% não vale o mesmo em toda parte — depende da
  // distribuição de bônus do PRÓPRIO merchant (like-with-like), não de um número
  // absoluto (o erro do bônus-absoluto rejeitado em D-042/c2).
  const noML = derivarPercentilLadoUnico({ percentual: 40, popMerchant: ML });
  const naAmazon = derivarPercentilLadoUnico({ percentual: 40, popMerchant: AMAZON });
  assert.notEqual(noML.valor, naAmazon.valor,
    `40% deve ranquear diferente entre merchants (${noML.valor} vs ${naAmazon.valor})`);
});

// --- fallback tipo: sinal FRACO, marcado, exige barra maior -------------------
test('percentil: sem população de merchant, usa tipo (fallback) e MARCA base_curta', () => {
  const tipoPop = Array.from({ length: 12 }, (_, i) => (i + 1) * 10); // 10..120, n=12 >= min_tipo(8)
  const r = derivarPercentilLadoUnico({ percentual: 70, popMerchant: [10], popTipo: tipoPop });
  assert.equal(r.pop_src, 'tipo');
  assert.equal(r.base_curta, true);  // cross-merchant → engine amortece parte do peso
  assert.equal(r.base_n, 1);
});

test('percentil: sem merchant e sem tipo defensável → NEUTRO sinalizado, não fabrica (INV-03)', () => {
  const r = derivarPercentilLadoUnico({ percentual: 70, popMerchant: [10], popTipo: [10, 20] });
  assert.equal(r.pop_src, 'neutro');
  assert.equal(r.valor, 0.5);
  assert.equal(r.base_n, 0);        // engine puxa integralmente para 0,5
  assert.equal(r.base_curta, true);
});

test('percentil: fallback_tipo=false → não borra cross-merchant, cai em neutro', () => {
  const cfg = { ...LADO_UNICO_V1, percentil: { ...LADO_UNICO_V1.percentil, fallback_tipo: false } };
  const tipoPop = Array.from({ length: 12 }, (_, i) => (i + 1) * 10);
  const r = derivarPercentilLadoUnico({ percentual: 70, popMerchant: [10], popTipo: tipoPop }, cfg);
  assert.equal(r.pop_src, 'neutro');
});

test('percentil: sem % → null (sem sinal de valor → engine dispara conta_nao_calculavel)', () => {
  assert.equal(derivarPercentilLadoUnico({ percentual: null, popMerchant: ML }), null);
  assert.equal(derivarPercentilLadoUnico({ percentual: '', popMerchant: ML }), null);
  assert.equal(derivarPercentilLadoUnico({ percentual: 'abc', popMerchant: ML }), null);
});

// --- raridade por frequência do MERCHANT (não da rota fina) -------------------
test('raridade: merchant recorrente é COMUM; merchant de uma vez só é raro', () => {
  assert.equal(derivarRaridadeLadoUnico(1).valor, 0.85);   // uma vez só
  assert.equal(derivarRaridadeLadoUnico(4).valor, 0.65);
  assert.equal(derivarRaridadeLadoUnico(40).valor, 0.25);
  assert.equal(derivarRaridadeLadoUnico(112).valor, 0.10); // mercado_livre — comum
  assert.equal(derivarRaridadeLadoUnico(0), null);         // desconhecida → redistribui
  assert.equal(derivarRaridadeLadoUnico(undefined), null);
});

// --- eficiência: idêntica à derivação geral ----------------------------------
test('eficiência: ausente → null (redistribui, D-024, não zero)', () => {
  assert.equal(derivarEficienciaLadoUnico(null, [10, 20, 30]), null);
  assert.equal(derivarEficienciaLadoUnico(0, [10, 20, 30]), null);
  assert.ok(derivarEficienciaLadoUnico(10, [10, 20, 30]).valor >= 0.5); // CPM baixo → eficiência alta
});

// --- abrangência --------------------------------------------------------------
test('abrangência: mapa público; fora do mapa → null', () => {
  assert.equal(derivarAbrangenciaLadoUnico('geral').valor, 1.0);
  assert.equal(derivarAbrangenciaLadoUnico('clube').valor, 0.3);
  assert.equal(derivarAbrangenciaLadoUnico('inexistente'), null);
});

// --- montagem: componentes null são OMITIDOS ---------------------------------
test('montarEntradas: sem % e sem CPM → só raridade+abrangência (conta_nao_calculavel a jusante)', () => {
  const { componentes } = derivarLadoUnico(
    { percentual: null, cpm_value: null }, { freqMerchant: 41, publico: 'geral' });
  assert.ok(!('percentil' in componentes));
  assert.ok(!('eficiencia' in componentes));
  assert.ok('raridade' in componentes && 'abrangencia' in componentes);
});

// --- end-to-end GUARDADO (ativa quando score.mjs existe) ----------------------
test('e2e: derivação lado-único → calcularScore (bônus move o score no mesmo merchant)', async () => {
  const scorePath = join(dirname(fileURLToPath(import.meta.url)), 'score.mjs');
  if (!existsSync(scorePath)) return; // guard: só roda com o engine na árvore
  const { calcularScore } = await import('./score.mjs');
  const pesos = { versao: 'v1', peso_percentil: 0.45, peso_eficiencia: 0.30, peso_raridade: 0.15, peso_abrangencia: 0.10, shrink_k: 5, min_samples: 3 };
  const ctx = { popMerchant: ML, popTipo: ML, freqMerchant: ML.length, publico: 'geral' };
  const alto = calcularScore(montarEntradasLadoUnico({ percentual: 90, cpm_value: null, tier: 2 }, ctx), pesos);
  const baixo = calcularScore(montarEntradasLadoUnico({ percentual: 10, cpm_value: null, tier: 2 }, ctx), pesos);
  assert.ok(alto.tl_score_bruto > baixo.tl_score_bruto,
    `bônus alto deve pontuar acima do baixo no mesmo merchant (${alto.tl_score_bruto} vs ${baixo.tl_score_bruto})`);
  // sem % e sem CPM → conta_nao_calculavel (mesma fronteira do engine)
  const semValor = calcularScore(montarEntradasLadoUnico({ percentual: null, cpm_value: null, tier: 2 }, ctx), pesos);
  assert.equal(semValor.override_aplicado, 'conta_nao_calculavel');
});
