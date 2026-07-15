// Fase 3.1 — motor de cálculo do TL Score (derivado dos 8 critérios).
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScore, reconcileScore } from "../scripts/lib/score.mjs";
import { computeDisposition } from "../scripts/lib/disposition.mjs";

function uniform(v) {
  return { valor: v, regra: v, vigencia: v, friccao: v, aplicabilidade: v, liquidez: v, estoque: v, fontes: v };
}

test("computeScore: critérios uniformes → score igual e veredito coerente", () => {
  assert.deepEqual(computeScore(uniform(90)), { ok: true, score: 90, verdict: "vale-agir", raw: 90 });
  assert.equal(computeScore(uniform(75)).verdict, "vale-olhar");
  assert.equal(computeScore(uniform(30)).verdict, "evitaria");
});

test("computeScore: breakdown incompleto → ok:false com missing", () => {
  const bd = uniform(90);
  delete bd.fontes;
  const r = computeScore(bd);
  assert.equal(r.ok, false);
  assert.ok(r.missing.includes("fontes"));
});

test("computeScore: soma ponderada real (pesos 25/15/15/10/10/10/10/5)", () => {
  const bd = { valor: 100, regra: 0, vigencia: 0, friccao: 0, aplicabilidade: 0, liquidez: 0, estoque: 0, fontes: 0 };
  assert.equal(computeScore(bd).score, 25); // só 'valor' (peso 25)
});

test("reconcileScore: digitado que bate com calculado passa; divergente falha", () => {
  assert.equal(reconcileScore(90, uniform(90)).ok, true);
  const bad = reconcileScore(90, uniform(70));
  assert.equal(bad.ok, false);
  assert.equal(bad.computed, 70);
});

// Fase 3.3 — config adaptativa NÃO afrouxa o piso de vale-agir.
test("config: limiar de sinal é ajustável, mas o piso de ação é imutável", () => {
  const deal = {
    title: "X", verdict: "vale-agir", tlScore: 90, scoreBreakdown: uniform(90),
    source: "Regulamento oficial", sourceUrl: "https://livelo.com.br/x",
    vigencia: "2030-01-01T00:00:00-03:00",
  };
  // Mesmo com config permissiva, vale-agir NUNCA vira auto (faixa A); segue C.
  const permissive = { signals: { weakSourceFontesMax: 0, strongScoreMin: 100 }, hardFloors: { valeAgirAutoPublish: true } };
  const d = computeDisposition(deal, { now: "2026-07-15", tier: "T1", config: permissive });
  assert.equal(d.faixa, "C");
});
