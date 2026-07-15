// Fase 1 — overrides (pin/mute) aplicados às séries do Predict.
// Garante: (a) a chave de override gerada a partir de uma Prediction bate com o
// formato usado pelo Forecast (mesma tabela forecast_overrides, efeito nas duas
// áreas); (b) pin/mute decoram e reordenam; (c) override de confiança é
// ignorado de propósito no Predict.
import { test } from "node:test";
import assert from "node:assert/strict";
import { overrideRouteKey, overrideKey, applyPredictOverrides } from "../lib/predict-overrides.ts";
import { buildForecast } from "../lib/forecast.ts";
import { buildPredict } from "../lib/predict-engine.ts";

const NOW = "2026-07-15";

const tf = (origem, destino, date, percentual = 20) => ({
  id: `${origem}-${destino}-transferencia-${date}`,
  tipo: "transferencia",
  origem,
  destino,
  percentual,
  vigencia_inicio: date,
});

const FIXTURE = [
  tf("livelo", "smiles", "2026-02-05"),
  tf("livelo", "smiles", "2026-03-07"),
  tf("livelo", "smiles", "2026-04-06"),
  tf("livelo", "smiles", "2026-05-06"),
  tf("esfera", "smiles", "2026-04-20"),
  tf("esfera", "smiles", "2026-05-20"),
  tf("esfera", "smiles", "2026-06-19"),
];

test("overrideRouteKey segue o formato do Forecast (origem→destino / →destino)", () => {
  assert.equal(overrideRouteKey({ origem: "livelo", destino: "smiles" }), "livelo→smiles");
  assert.equal(overrideRouteKey({ origem: null, destino: "smiles" }), "→smiles");
});

test("chaves do Predict batem com as rotas/clusters do Forecast (mesma tabela)", () => {
  const forecast = buildForecast(FIXTURE, { now: NOW });
  const predict = buildPredict(FIXTURE, { asOf: NOW });

  const forecastKeys = new Set([
    ...forecast.routes.map((f) => overrideKey(f.scope, f.route)),
    ...forecast.clusters.map((f) => overrideKey(f.scope, f.route)),
  ]);
  const predictKeys = [
    ...predict.routes.map((p) => overrideKey(p.scope, overrideRouteKey(p))),
    ...predict.clusters.map((p) => overrideKey(p.scope, overrideRouteKey(p))),
  ];
  assert.ok(predictKeys.length > 0, "fixture deve formar séries no Predict");
  for (const k of predictKeys) {
    assert.ok(forecastKeys.has(k), `chave do Predict sem par no Forecast: ${k}`);
  }
});

test("pin ordena primeiro, mute por último, flags e nota decoradas", () => {
  const series = [
    { scope: "route", origem: "livelo", destino: "smiles" },
    { scope: "route", origem: "esfera", destino: "smiles" },
    { scope: "cluster", origem: null, destino: "smiles" },
  ];
  const out = applyPredictOverrides(series, [
    { scope: "route", route: "livelo→smiles", action: "mute", note: "ruído de extração" },
    { scope: "cluster", route: "→smiles", action: "pin", note: null },
  ]);
  assert.equal(out[0].destino, "smiles");
  assert.equal(out[0].scope, "cluster");
  assert.equal(out[0].pinned, true);
  assert.equal(out[out.length - 1].origem, "livelo");
  assert.equal(out[out.length - 1].muted, true);
  assert.equal(out[out.length - 1].overrideNote, "ruído de extração");
  const middle = out[1];
  assert.equal(middle.pinned, false);
  assert.equal(middle.muted, false);
});

test("override de confiança é ignorado no Predict (não vira pin nem mute)", () => {
  const out = applyPredictOverrides(
    [{ scope: "route", origem: "livelo", destino: "smiles" }],
    [{ scope: "route", route: "livelo→smiles", action: "confidence", note: "x" }],
  );
  assert.equal(out[0].pinned, false);
  assert.equal(out[0].muted, false);
  assert.equal(out[0].overrideNote, null);
});

test("chave tolera espaços acidentais na rota persistida", () => {
  const out = applyPredictOverrides(
    [{ scope: "route", origem: "livelo", destino: "smiles" }],
    [{ scope: "route", route: " livelo→smiles ", action: "pin", note: null }],
  );
  assert.equal(out[0].pinned, true);
});
