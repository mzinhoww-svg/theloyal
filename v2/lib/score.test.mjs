// Golden/invariante do TL Score engine. node --test v2/lib/score.test.mjs
// Determinismo-primeiro (INV-12): mesmo input + mesmo vetor → mesmo score.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { calcularScore, vereditoDaFaixa, amortecerPercentil, NAO_CONFIRMADO } from './score.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const GOLD = JSON.parse(readFileSync(join(DIR, '..', 'golden', 'score-gold.json'), 'utf8'));
const PESOS = GOLD.pesos;
const caso = (nome) => GOLD.casos.find((c) => c.nome === nome);

// ── lock: o engine reproduz o golden ancorado em score_pesos.v1 ──
test('lock: cada caso do golden bate score, veredito, override e breakdown', () => {
  for (const c of GOLD.casos) {
    const r = calcularScore(c.entradas, PESOS);
    assert.equal(r.tl_score_bruto, c.esperado.tl_score_bruto, `${c.nome}: score bruto`);
    assert.equal(r.veredito_bruto, c.esperado.veredito_bruto, `${c.nome}: veredito bruto`);
    assert.equal(r.veredito, c.esperado.veredito, `${c.nome}: veredito final`);
    assert.equal(r.override_aplicado, c.esperado.override_aplicado, `${c.nome}: override aplicado`);
    assert.equal(r.base_curta, c.esperado.base_curta, `${c.nome}: base_curta`);
    assert.deepEqual(r.overrides.map((o) => o.override), c.esperado.overrides, `${c.nome}: overrides logados`);
    assert.deepEqual(r.breakdown, c.esperado.breakdown, `${c.nome}: breakdown`);
  }
});

// ── determinismo (INV-12): mesmo input → saída idêntica, sempre ──
test('determinismo: mesmo input + mesmo vetor → saída byte-idêntica', () => {
  for (const c of GOLD.casos) {
    const a = calcularScore(c.entradas, PESOS);
    const b = calcularScore(c.entradas, PESOS);
    assert.deepEqual(a, b, `${c.nome}: duas chamadas divergiram`);
  }
});

// ── régua: faixas → veredito ──
test('régua: fronteiras de faixa', () => {
  assert.equal(vereditoDaFaixa(100), 'Vale agir');
  assert.equal(vereditoDaFaixa(85), 'Vale agir');
  assert.equal(vereditoDaFaixa(84), 'Vale olhar');
  assert.equal(vereditoDaFaixa(70), 'Vale olhar');
  assert.equal(vereditoDaFaixa(69), 'Só para casos específicos');
  assert.equal(vereditoDaFaixa(55), 'Só para casos específicos');
  assert.equal(vereditoDaFaixa(54), 'Esperaria');
  assert.equal(vereditoDaFaixa(40), 'Esperaria');
  assert.equal(vereditoDaFaixa(39), 'Evitaria');
  assert.equal(vereditoDaFaixa(0), 'Evitaria');
});

// ── override sem_tier1 rebaixa e loga (INV-02/INV-07) ──
test('override sem_tier1: 88 bruto Vale agir → Não confirmado, logado com evidência', () => {
  const c = caso('sem_tier1_88');
  const r = calcularScore(c.entradas, PESOS);
  assert.equal(r.tl_score_bruto, 88);
  assert.equal(r.veredito_bruto, 'Vale agir');   // preserva o bruto (§3)
  assert.equal(r.veredito, NAO_CONFIRMADO);
  assert.equal(r.override_aplicado, 'sem_tier1');
  assert.equal(r.overrides.length, 1);
  assert.equal(r.overrides[0].de_veredito, 'Vale agir');
  assert.equal(r.overrides[0].para_veredito, NAO_CONFIRMADO);
  assert.ok(r.overrides[0].evidencia.length > 0, 'override sem evidência não é permitido (INV-03)');
});

// ── override conta_nao_calculavel rebaixa e loga (INV-07) ──
test('override conta_nao_calculavel: só raridade+abrangência → Não confirmado', () => {
  const r = calcularScore(caso('conta_nao_calculavel').entradas, PESOS);
  assert.equal(r.veredito, NAO_CONFIRMADO);
  assert.equal(r.override_aplicado, 'conta_nao_calculavel');
  assert.deepEqual(r.overrides.map((o) => o.override), ['conta_nao_calculavel']);
  // ainda computa o bruto (a Ferrari sempre roda), mas do resíduo raridade+abrangência
  assert.ok(r.tl_score_bruto > 0);
});

// ── dois overrides: ambos logados; conta_nao_calculavel tem prioridade no aplicado ──
test('dois overrides: ambos logados, override_aplicado = conta_nao_calculavel', () => {
  const r = calcularScore(caso('dois_overrides').entradas, PESOS);
  assert.equal(r.veredito, NAO_CONFIRMADO);
  const names = r.overrides.map((o) => o.override).sort();
  assert.deepEqual(names, ['conta_nao_calculavel', 'sem_tier1'], 'ambos overrides logados');
  assert.equal(r.override_aplicado, 'conta_nao_calculavel', 'conta vazia desqualifica mais que falta de fonte');
});

// ── base curta NÃO vira percentil cheio (SPEC §2) ──
test('base curta: amortece para 0,5, nunca percentil cheio', () => {
  // fórmula pura: base pequena puxa para o neutro
  assert.ok(amortecerPercentil(0.95, 2, 5) < 0.95, 'base_n=2 deve amortecer');
  assert.ok(amortecerPercentil(0.95, 2, 5) > 0.5, 'mas não abaixo do neutro para valor alto');
  // base grande ≈ percentil bruto (amortecimento desprezível)
  assert.ok(Math.abs(amortecerPercentil(0.95, 500, 5) - 0.95) < 0.01);

  // no engine: mesmo percentil bruto, base curta pontua MENOS que base cheia
  const curta = caso('base_curta_amortece');
  const rCurta = calcularScore(curta.entradas, PESOS);
  const entCheia = structuredClone(curta.entradas);
  entCheia.componentes.percentil.base_n = 500; // mesma % de bônus, muita história
  const rCheia = calcularScore(entCheia, PESOS);
  assert.ok(rCurta.tl_score_bruto < rCheia.tl_score_bruto,
    `base curta (${rCurta.tl_score_bruto}) deve pontuar menos que base cheia (${rCheia.tl_score_bruto})`);
  assert.equal(rCurta.base_curta, true);
  assert.equal(rCheia.base_curta, false);
});

// ── redistribuição (§2.1): eficiência ausente NÃO afunda o item ──
test('redistribuição: eficiência ausente redistribui, não vira zero que afunda', () => {
  const c = caso('eficiencia_ausente_redistribui');
  const rRedist = calcularScore(c.entradas, PESOS);
  // simula o "zero que afunda": eficiência presente valendo 0
  const entZero = structuredClone(c.entradas);
  entZero.componentes.eficiencia = { valor: 0 };
  const rZero = calcularScore(entZero, PESOS);
  assert.ok(rRedist.tl_score_bruto > rZero.tl_score_bruto,
    `redistribuição (${rRedist.tl_score_bruto}) deve ficar acima do zero-afunda (${rZero.tl_score_bruto})`);
  // eficiência não aparece no breakdown quando ausente
  assert.ok(!rRedist.breakdown.some((b) => b.componente === 'eficiencia'));
  // pesos efetivos dos presentes somam 1
  const somaEfetiva = rRedist.breakdown.reduce((s, b) => s + b.peso_efetivo, 0);
  assert.ok(Math.abs(somaEfetiva - 1) < 1e-3, 'pesos efetivos redistribuídos somam 1 (round4)');
});

// ── INV-03: o breakdown reproduz o número (Σ contribuição = score/100) ──
test('INV-03: Σ contribuição das linhas = tl_score_bruto/100', () => {
  for (const c of GOLD.casos) {
    const r = calcularScore(c.entradas, PESOS);
    if (r.breakdown.length === 0) continue;
    const soma = r.breakdown.reduce((s, b) => s + b.contribuicao, 0);
    assert.ok(Math.abs(soma * 100 - r.tl_score_bruto) < 0.5,
      `${c.nome}: Σ contribuição (${(soma * 100).toFixed(2)}) ≠ score (${r.tl_score_bruto})`);
  }
});

// ── pesos vêm do argumento, nunca hardcoded: mudar o vetor muda o score ──
test('pesos são do argumento: outro vetor → outro score (não hardcoded)', () => {
  const c = caso('vale_agir_limpo');
  const base = calcularScore(c.entradas, PESOS);
  const outro = calcularScore(c.entradas, { ...PESOS, versao: 'exp', peso_percentil: 0.10, peso_eficiencia: 0.10, peso_raridade: 0.10, peso_abrangencia: 0.70 });
  assert.notEqual(base.tl_score_bruto, outro.tl_score_bruto);
  assert.equal(outro.versao_pesos, 'exp'); // breakdown grava qual versão produziu o score
});

test('pesos ausentes → erro (engine não inventa vetor)', () => {
  assert.throws(() => calcularScore({ campaign_id: 'x', componentes: {} }, null));
});
