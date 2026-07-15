// Fase P1-A — regra da probabilidade principal (§16) da listagem, isolada sobre
// selectPrimaryProbability (lib/radar-view-model.ts). UMA só probabilidade:
// P30 quando a data central prevista é de curto prazo (≤30d do asOf), senão P60;
// nunca P30 e P90 juntos; fallback Forecast (sem probabilidades) → null.
import { test } from "node:test";
import assert from "node:assert/strict";
import { selectPrimaryProbability } from "../lib/radar-view-model.ts";

const PROBS = { p7: 0.1, p15: 0.25, p30: 0.6, p60: 0.82, p90: 0.93, p180: 0.99 };
const ASOF = "2026-07-15";
const predict = (centralDate, over = {}) => ({ asOf: ASOF, centralDate, probabilities: PROBS, ...over });

test("primária · curto prazo (central ≤30d) usa P30 no horizonte 30", () => {
  const r = selectPrimaryProbability(predict("2026-07-25")); // 10 dias
  assert.deepEqual(r, { value: 0.6, horizonDays: 30 });
});

test("primária · limite exato de 30d ainda usa P30", () => {
  const r = selectPrimaryProbability(predict("2026-08-14")); // 30 dias
  assert.deepEqual(r, { value: 0.6, horizonDays: 30 });
});

test("primária · janela distante (central >30d) usa P60 no horizonte 60", () => {
  const r = selectPrimaryProbability(predict("2026-09-15")); // 62 dias
  assert.deepEqual(r, { value: 0.82, horizonDays: 60 });
});

test("primária · campanha em atraso (central no passado) usa P30", () => {
  const r = selectPrimaryProbability(predict("2026-07-01")); // -14 dias → curto
  assert.deepEqual(r, { value: 0.6, horizonDays: 30 });
});

test("primária · nunca combina horizontes (só um valor/horizonte)", () => {
  const r = selectPrimaryProbability(predict("2026-09-15"));
  assert.equal(Object.keys(r).sort().join(","), "horizonDays,value");
});

test("primária · sem probabilidades → null (não inventa)", () => {
  assert.equal(selectPrimaryProbability(predict("2026-07-25", { probabilities: null })), null);
});

test("primária · fallback Forecast (predict null) → null", () => {
  assert.equal(selectPrimaryProbability(null), null);
});
