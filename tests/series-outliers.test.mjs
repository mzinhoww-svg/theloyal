// Fase 1 (plano consolidado) — outlier de intervalo (MAD) + readiness do
// Predict que existia no tipo e nunca era atribuído.
import { test } from "node:test";
import assert from "node:assert/strict";
import { intervalOutlierFlags, intervalOutlierWarning } from "../lib/series-builder.ts";
import * as mjs from "../scripts/forecast-engine.mjs";
import { buildForecast } from "../lib/forecast.ts";
import { buildPredict } from "../lib/predict-engine.ts";

const tf = (origem, destino, date, percentual = 20, extra = {}) => ({
  id: `${origem}-${destino}-transferencia-${date}`,
  tipo: "transferencia",
  origem,
  destino,
  percentual,
  vigencia_inicio: date,
  ...extra,
});

test("MAD: gap gigante numa cadência ~30d é flagado; os regulares não", () => {
  const flags = intervalOutlierFlags([30, 31, 29, 30, 629]);
  assert.deepEqual(flags, [false, false, false, false, true]);
});

test("MAD: menos de 4 intervalos → nenhum flag (sem base robusta, não chutar)", () => {
  assert.deepEqual(intervalOutlierFlags([30, 629]), [false, false]);
  assert.equal(intervalOutlierWarning([30, 629]), null);
});

test("MAD: série perfeitamente regular (mad=0) flagra só desvio grande", () => {
  assert.deepEqual(intervalOutlierFlags([30, 30, 30, 30]), [false, false, false, false]);
  assert.deepEqual(intervalOutlierFlags([30, 30, 30, 30, 400]), [false, false, false, false, true]);
});

test("espelho MJS produz exatamente o mesmo warning (paridade)", () => {
  for (const xs of [[30, 31, 29, 30, 629], [30, 629], [45, 44, 46, 45, 45, 500]]) {
    assert.equal(mjs.intervalOutlierWarning(xs), intervalOutlierWarning(xs));
  }
});

test("Forecast: série mensal com gap de 629d ganha warning de intervalo atípico", () => {
  const rows = [
    tf("portobank", "azul", "2024-01-10"),
    tf("portobank", "azul", "2024-02-09"),
    tf("portobank", "azul", "2024-03-10"),
    tf("portobank", "azul", "2024-04-09"),
    tf("portobank", "azul", "2024-05-09"),
    tf("portobank", "azul", "2026-01-28"), // 629d depois
  ];
  const f = buildForecast(rows, { now: "2026-07-15" });
  const r = f.routes.find((x) => x.route === "portobank→azul");
  assert.ok(r.warnings.some((w) => w.includes("atípico")), r.warnings.join(" | "));
});

test("Predict: mesmo caso ganha warning e vira ready_with_warnings", () => {
  const rows = [
    tf("portobank", "azul", "2024-01-10"),
    tf("portobank", "azul", "2024-02-09"),
    tf("portobank", "azul", "2024-03-10"),
    tf("portobank", "azul", "2024-04-09"),
    tf("portobank", "azul", "2024-05-09"),
    tf("portobank", "azul", "2026-01-28"),
  ];
  const p = buildPredict(rows, { asOf: "2026-07-15" });
  const r = p.routes.find((x) => x.destino === "azul");
  assert.ok(r.warnings.some((w) => w.includes("atípico")));
  assert.equal(r.readiness, "ready_with_warnings");
});

test("Predict: datasetComplete=false → TODAS as séries backfill_incomplete", () => {
  const rows = [
    tf("livelo", "smiles", "2026-02-05"),
    tf("livelo", "smiles", "2026-03-07"),
    tf("livelo", "smiles", "2026-04-06"),
  ];
  const p = buildPredict(rows, { asOf: "2026-07-15", datasetComplete: false });
  for (const s of [...p.routes, ...p.clusters]) {
    assert.equal(s.readiness, "backfill_incomplete");
    assert.equal(s.probabilities, null);
    assert.ok(s.blockReason?.includes("backfill_incomplete"));
  }
});

test("Predict: histórico consumido pela qualidade → data_quality_blocked", () => {
  const rows = [
    tf("esfera", "connectmiles", "2026-01-10", 30),
    tf("esfera", "connectmiles", "2026-03-15", 40),
    // Terceira campanha da série, excluída por suspect_year (ano fabricado):
    {
      id: "esfera-connectmiles-transferencia-2024-02-22",
      tipo: "transferencia",
      origem: "esfera",
      destino: "connectmiles",
      percentual: 45,
      vigencia_inicio: null,
      vigencia_fim: "2024-02-22",
      first_seen: "2025-02-20",
      source_url: "https://exemplo.com/esfera-connectmiles-fev25.html",
    },
  ];
  const p = buildPredict(rows, { asOf: "2026-07-15" });
  const r = p.routes.find((x) => x.destino === "connectmiles");
  assert.equal(r.recordsTotal, 2, "só as 2 válidas entram");
  assert.equal(r.readiness, "data_quality_blocked");
  assert.ok(r.blockReason?.includes("1 excluída(s) por qualidade"));
});

test("Predict: histórico curto SEM exclusões continua insufficient_history", () => {
  const rows = [tf("itau", "smiles", "2026-02-05"), tf("itau", "smiles", "2026-04-06")];
  const p = buildPredict(rows, { asOf: "2026-07-15" });
  const r = p.routes.find((x) => x.destino === "smiles");
  assert.equal(r.readiness, "insufficient_history");
});
