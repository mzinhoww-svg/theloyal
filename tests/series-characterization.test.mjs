// Fase 4 — caracterização da FORMAÇÃO DE SÉRIES dos dois motores, escrita
// ANTES da extração do series-builder e mantida depois. Se qualquer asserção
// daqui quebrar num refactor, o refactor mudou comportamento — não faça merge.
//
// Divergências INTENCIONAIS travadas aqui (ver ADR-SERIES-001):
//   • minSamples: Forecast forma série com 2 ondas; Predict bloqueia com <3.
// Convergência garantida pelo gate C0.2: linha sem origem é bloqueada como
// placeholder_program ANTES dos dois motores — nenhum cluster a recebe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildForecast, collapseWaves } from "../lib/forecast.ts";
import { buildPredict } from "../lib/predict-engine.ts";

const NOW = "2026-07-15";

const tf = (origem, destino, date, percentual = 20, extra = {}) => ({
  id: `${origem || "x"}-${destino}-transferencia-${date}`,
  tipo: "transferencia",
  origem,
  destino,
  percentual,
  vigencia_inicio: date,
  ...extra,
});

const REGULAR = [
  tf("livelo", "smiles", "2026-02-05"),
  tf("livelo", "smiles", "2026-03-07"),
  tf("livelo", "smiles", "2026-04-06"),
  tf("livelo", "smiles", "2026-05-06"),
  tf("livelo", "smiles", "2026-06-05"),
];

test("ondas idênticas entre Forecast e Predict para a mesma rota", () => {
  const f = buildForecast(REGULAR, { now: NOW });
  const p = buildPredict(REGULAR, { asOf: NOW });
  const fr = f.routes.find((r) => r.route === "livelo→smiles");
  const pr = p.routes.find((r) => r.origem === "livelo" && r.destino === "smiles");
  assert.ok(fr && pr);
  assert.deepEqual(fr.windows, pr.events);
  assert.deepEqual(fr.intervals, pr.intervals);
});

test("colapso de ondas: datas ≤3d viram uma onda nos dois motores", () => {
  const rows = [
    tf("livelo", "smiles", "2026-05-01"),
    tf("livelo", "smiles", "2026-05-03"), // mesma onda (≤3d)
    tf("livelo", "smiles", "2026-06-10"),
    tf("livelo", "smiles", "2026-07-01"),
  ];
  const f = buildForecast(rows, { now: NOW });
  const p = buildPredict(rows, { asOf: NOW });
  const fr = f.routes.find((r) => r.route === "livelo→smiles");
  const pr = p.routes.find((r) => r.origem === "livelo");
  assert.deepEqual(fr.windows, ["2026-05-01", "2026-06-10", "2026-07-01"]);
  assert.deepEqual(pr.events, ["2026-05-01", "2026-06-10", "2026-07-01"]);
});

test("L1 (2 ondas, gap 943d): Forecast forma com baixa; Predict bloqueia", () => {
  const rows = [
    tf("livelo", "connectmiles", "2023-12-12", 40),
    tf("livelo", "connectmiles", "2026-07-12", 40),
  ];
  const f = buildForecast(rows, { now: NOW });
  const p = buildPredict(rows, { asOf: NOW });
  const fr = f.routes.find((r) => r.route === "livelo→connectmiles");
  const pr = p.routes.find((r) => r.destino === "connectmiles");
  assert.ok(fr, "forecast forma a série com 2 ondas (minSamples 2)");
  assert.equal(fr.samples, 2);
  assert.deepEqual(fr.intervals, [943]);
  assert.equal(fr.editorialEligible, false, "gate editorial segura a anomalia");
  assert.ok(pr.blockReason?.includes("insufficient_valid_history"), "predict bloqueia 2<3");
});

test("linha sem origem é bloqueada pelo gate C0.2 nos DOIS motores (placeholder)", () => {
  const rows = [
    ...REGULAR,
    tf("", "smiles", "2025-11-10", 50), // origem vazia
  ];
  const f = buildForecast(rows, { now: NOW });
  const p = buildPredict(rows, { asOf: NOW });
  const fc = f.clusters.find((c) => c.destino === "smiles");
  const pc = p.clusters.find((c) => c.destino === "smiles");
  assert.ok(fc && pc);
  assert.equal(fc.windows.includes("2025-11-10"), false);
  assert.equal(pc.events.includes("2025-11-10"), false);
  assert.equal(f.quality.counters.blockedPlaceholder, 1);
  assert.equal(p.quality.counters.blockedPlaceholder, 1);
});

test("normalização de programa: alias e caixa alta consolidam a mesma série", () => {
  const rows = [
    tf("livelo", "LATAM PASS", "2026-02-05"),
    tf("livelo", "latampass", "2026-03-10"),
    tf("livelo", "Latam-Pass", "2026-04-12"),
  ];
  const f = buildForecast(rows, { now: NOW });
  const p = buildPredict(rows, { asOf: NOW });
  assert.equal(f.routes.filter((r) => r.destino === "latampass").length, 1);
  assert.equal(p.routes.filter((r) => r.destino === "latampass").length, 1);
  assert.equal(f.routes.find((r) => r.destino === "latampass").samples, 3);
  assert.equal(p.routes.find((r) => r.destino === "latampass").recordsTotal, 3);
});

test("collapseWaves exportado: dedup e epsilon", () => {
  assert.deepEqual(
    collapseWaves(["2026-01-01", "2026-01-02", "2026-01-10"], 3),
    ["2026-01-01", "2026-01-10"],
  );
});
