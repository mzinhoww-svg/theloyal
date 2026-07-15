// Fase 2 — tendência por série a partir de predict_snapshots (parte pura).
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupSnapshotRows, p30Series, calibrationFromTrend } from "../lib/predict-trends.ts";

const row = (key, asOf, p30, extra = {}) => ({
  series_key: key,
  as_of_date: asOf,
  prob_30: p30,
  confidence: "media",
  backtest: null,
  ...extra,
});

test("agrupa por série preservando a ordem cronológica", () => {
  const m = groupSnapshotRows([
    row("a", "2026-07-01", 0.2),
    row("b", "2026-07-01", 0.5),
    row("a", "2026-07-02", 0.3),
  ]);
  assert.deepEqual(
    m.get("a").map((p) => p.p30),
    [0.2, 0.3],
  );
  assert.equal(m.get("b").length, 1);
});

test("dedup por dia: a última leitura do mesmo as_of_date vence", () => {
  const m = groupSnapshotRows([row("a", "2026-07-01", 0.2), row("a", "2026-07-01", 0.4)]);
  assert.deepEqual(
    m.get("a").map((p) => p.p30),
    [0.4],
  );
});

test("p30Series: null com <2 pontos válidos; ignora p30 nulos", () => {
  assert.equal(p30Series(undefined), null);
  assert.equal(p30Series(groupSnapshotRows([row("a", "2026-07-01", 0.2)]).get("a")), null);
  const m = groupSnapshotRows([
    row("a", "2026-07-01", 0.2),
    row("a", "2026-07-02", null),
    row("a", "2026-07-03", 0.6),
  ]);
  assert.deepEqual(p30Series(m.get("a")), [0.2, 0.6]);
});

test("calibração lê primeiro vs último snapshot (backtest incluso)", () => {
  const m = groupSnapshotRows([
    row("a", "2026-07-01", 0.2, {
      backtest: { observations: 3, windowHitRate: 0.33, medianDateErrorDays: 20 },
    }),
    row("a", "2026-07-10", 0.5, {
      backtest: { observations: 5, windowHitRate: 0.6, medianDateErrorDays: 9 },
    }),
  ]);
  const cal = calibrationFromTrend(m.get("a"));
  assert.equal(cal.snapshots, 2);
  assert.equal(cal.firstAsOf, "2026-07-01");
  assert.equal(cal.lastAsOf, "2026-07-10");
  assert.equal(cal.hitRateFirst, 0.33);
  assert.equal(cal.hitRateLast, 0.6);
  assert.equal(cal.errorFirst, 20);
  assert.equal(cal.errorLast, 9);
});

test("calibração é null com menos de 2 snapshots (degrada sem erro)", () => {
  assert.equal(calibrationFromTrend(undefined), null);
  assert.equal(calibrationFromTrend(groupSnapshotRows([row("a", "2026-07-01", 0.2)]).get("a")), null);
});
