// Fase P1-A — testes unitários ISOLADOS das faixas de divergência (§12 / D6),
// direto sobre computeDivergence (lib/radar-view-model.ts). Não recalcula nada:
// exercita a função canônica já usada pela composição. Fixtures mínimas com só
// os campos que a função lê (windowStart/windowEnd/centralDate).
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDivergence } from "../lib/radar-view-model.ts";

// Forecast fixo: janela 20–30/jul → centro 25/jul.
const FC = { windowStart: "2026-07-20", windowEnd: "2026-07-30" };
// Predict com janela DISJUNTA (não sobrepõe a do forecast) para medir a faixa pura.
const prDisjoint = (centralDate, windowStart, windowEnd) => ({ centralDate, windowStart, windowEnd });
// Predict com janela SOBREPOSTA à do forecast (dispara o atenuante).
const prOverlap = (centralDate) => ({ centralDate, windowStart: "2026-07-28", windowEnd: "2026-10-31" });

// --- Faixas puras (janelas disjuntas, sem atenuante) ---
test("divergência · ≤14d → compatible", () => {
  const d = computeDivergence(FC, prDisjoint("2026-07-25", "2026-08-05", "2026-08-10"));
  assert.equal(d.level, "compatible");
  assert.equal(d.days, 0);
});
test("divergência · 15–30d → warning", () => {
  const d = computeDivergence(FC, prDisjoint("2026-08-14", "2026-08-10", "2026-08-18"));
  assert.equal(d.level, "warning");
  assert.equal(d.days, 20);
});
test("divergência · 31–60d → review", () => {
  const d = computeDivergence(FC, prDisjoint("2026-09-08", "2026-09-04", "2026-09-12"));
  assert.equal(d.level, "review");
  assert.equal(d.days, 45);
});
test("divergência · >60d → block", () => {
  const d = computeDivergence(FC, prDisjoint("2026-10-05", "2026-10-01", "2026-10-10"));
  assert.equal(d.level, "block");
  assert.equal(d.days, 72);
});

// --- Atenuante: janelas sobrepostas rebaixam UMA faixa ---
test("divergência · sobreposição rebaixa warning → compatible", () => {
  const d = computeDivergence(FC, prOverlap("2026-08-14")); // gap 20
  assert.equal(d.days, 20);
  assert.equal(d.level, "compatible");
});
test("divergência · sobreposição rebaixa review → warning", () => {
  const d = computeDivergence(FC, prOverlap("2026-09-08")); // gap 45
  assert.equal(d.days, 45);
  assert.equal(d.level, "warning");
});
test("divergência · sobreposição rebaixa block → review", () => {
  const d = computeDivergence(FC, prOverlap("2026-10-05")); // gap 72
  assert.equal(d.days, 72);
  assert.equal(d.level, "review");
});

// --- Sem base de comparação ---
test("divergência · sem forecast → none", () => {
  const d = computeDivergence(null, prDisjoint("2026-08-14", "2026-08-10", "2026-08-18"));
  assert.equal(d.level, "none");
  assert.equal(d.days, null);
});
test("divergência · sem central do predict → none", () => {
  const d = computeDivergence(FC, prDisjoint(null, "2026-08-10", "2026-08-18"));
  assert.equal(d.level, "none");
  assert.equal(d.days, null);
});
