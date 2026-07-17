// Dash /admin/programas — parte pura: promoções ativas por programa e saúde
// composta dos motores.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activePromosByProgram,
  buildSeriesOutlook,
  engineHealth,
  isAirlineProgram,
} from "../lib/program-health.ts";
import { normProgram } from "../lib/series-builder.ts";

const row = (over = {}) => ({
  id: "livelo-smiles-transferencia-2026-07-20",
  origem: "livelo",
  destino: "smiles",
  tipo: "transferencia",
  percentual: 80,
  vigencia_fim: "2026-07-20",
  status: "continua",
  source_url: "https://exemplo.com/x",
  source_name: "Fonte",
  ...over,
});

test("recorte de cias aéreas: smiles/latampass dentro, livelo/esfera fora", () => {
  assert.equal(isAirlineProgram("smiles"), true);
  assert.equal(isAirlineProgram("latampass"), true);
  assert.equal(isAirlineProgram("connectmiles"), true);
  assert.equal(isAirlineProgram("livelo"), false);
  assert.equal(isAirlineProgram("esfera"), false);
});

test("agrupa só status ativos e ordena por percentual desc, depois vencimento", () => {
  const m = activePromosByProgram(
    [
      row({ id: "a", percentual: 30 }),
      row({ id: "b", percentual: 100, status: "vence-72h", vigencia_fim: "2026-07-17" }),
      row({ id: "c", percentual: 100, status: "nova", vigencia_fim: "2026-07-30" }),
      row({ id: "d", status: "vencida", percentual: 200 }), // fora
      row({ id: "e", status: "descartada" }), // fora
      row({ id: "f", destino: "LATAM PASS", percentual: 50 }), // normaliza destino
    ],
    normProgram,
  );
  assert.deepEqual(
    m.get("smiles").map((p) => p.id),
    ["b", "c", "a"],
  );
  assert.equal(m.get("latampass").length, 1);
  assert.equal(m.get("smiles").some((p) => p.id === "d"), false);
});

test("percentual/vigência inválidos viram null (exibe —, não chuta)", () => {
  const m = activePromosByProgram([row({ percentual: "na", vigencia_fim: "na" })], normProgram);
  const p = m.get("smiles")[0];
  assert.equal(p.percentual, null);
  assert.equal(p.vigenciaFim, null);
});

const predictSig = (over = {}) => ({
  readiness: "ready",
  confidence: "alta",
  warnings: [],
  blockReason: null,
  windowHitRate: 0.7,
  backtestObservations: 5,
  ...over,
});
const forecastSig = (over = {}) => ({
  confidence: "alta",
  windowStart: "2026-08-01",
  editorialEligible: true,
  warnings: [],
  ...over,
});

test("saúde: pronto+alta sem alertas = saudável; média = ok", () => {
  assert.equal(engineHealth(predictSig(), forecastSig()).tone, "green");
  assert.equal(engineHealth(predictSig({ confidence: "media" }), forecastSig()).tone, "blue");
});

test("saúde: warnings/baixa/backtest fraco rebaixam para atenção com motivo", () => {
  const h1 = engineHealth(predictSig({ warnings: ["intervalo atípico"] }), forecastSig());
  assert.equal(h1.tone, "yellow");
  assert.ok(h1.reasons.some((r) => r.includes("alerta")));
  const h2 = engineHealth(predictSig({ windowHitRate: 0.2 }), forecastSig());
  assert.ok(h2.reasons.some((r) => r.includes("backtest fraco")));
  const h3 = engineHealth(predictSig({ confidence: "baixa" }), forecastSig({ confidence: "baixa" }));
  assert.equal(h3.tone, "yellow");
});

test("saúde: estados de bloqueio mapeiam para red/gray com o porquê", () => {
  const red = engineHealth(
    predictSig({ readiness: "data_quality_blocked", blockReason: "data_quality_blocked (1 excluída)" }),
    null,
  );
  assert.equal(red.tone, "red");
  const parcial = engineHealth(predictSig({ readiness: "backfill_incomplete", blockReason: "backfill_incomplete" }), null);
  assert.equal(parcial.tone, "gray");
  const semBase = engineHealth(
    predictSig({ readiness: "insufficient_history", blockReason: "insufficient_valid_history (2 < 3)" }),
    forecastSig({ windowStart: null }),
  );
  assert.equal(semBase.tone, "gray");
  assert.equal(engineHealth(null, null).tone, "gray");
});

const predictRoute = (over = {}) => ({
  origem: "livelo",
  readiness: "ready",
  confidence: "alta",
  windowStart: null,
  windowEnd: null,
  p30: 0.8,
  p90: 0.97,
  hitRate: 0.7,
  observations: 7,
  ...over,
});
const forecastRoute = (over = {}) => ({
  origem: "livelo",
  confidence: "alta",
  windowStart: "2026-08-05",
  windowEnd: "2026-08-15",
  typicalPercent: 95,
  ...over,
});

test("outlook: junta motores por origem — janela do Forecast, p30 do Predict", () => {
  const rows = buildSeriesOutlook([predictRoute()], [forecastRoute()]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].windowStart, "2026-08-05");
  assert.equal(rows[0].p30, 0.8);
  assert.equal(rows[0].typicalPercent, 95);
});

test("outlook: ordena por janela mais próxima; sem janela vai depois, por p30", () => {
  const rows = buildSeriesOutlook(
    [
      predictRoute({ origem: "c6", windowStart: null, p30: 0.4, hitRate: null, observations: 0 }),
      predictRoute({ origem: "itau", windowStart: "2026-09-01", windowEnd: "2026-09-10", p30: 0.6 }),
    ],
    [forecastRoute({ origem: "livelo" })],
  );
  assert.deepEqual(
    rows.map((r) => r.origem),
    ["livelo", "itau", "c6"],
  );
});

test("outlook: 'mais assertiva' exige amostra mínima e pega o melhor acerto", () => {
  const rows = buildSeriesOutlook(
    [
      predictRoute({ origem: "livelo", hitRate: 0.9, observations: 2 }), // amostra curta — fora
      predictRoute({ origem: "itau", hitRate: 0.7, observations: 5 }),
      predictRoute({ origem: "esfera", hitRate: 0.6, observations: 8 }),
    ],
    [],
  );
  const marked = rows.filter((r) => r.mostAssertive);
  assert.equal(marked.length, 1);
  assert.equal(marked[0].origem, "itau");
});

test("outlook: predict bloqueado não vaza probabilidade; sem sinal nenhum, sai da lista", () => {
  const rows = buildSeriesOutlook(
    [
      predictRoute({
        origem: "bb",
        readiness: "insufficient_history",
        p30: 0.5,
        hitRate: null,
        observations: 0,
      }),
    ],
    [],
  );
  assert.equal(rows.length, 0);
});

test("saúde: divergência entre motores vira motivo de atenção", () => {
  const h = engineHealth(
    predictSig({ readiness: "insufficient_history", blockReason: "insufficient_valid_history" }),
    forecastSig(), // Forecast projeta, Predict bloqueado
  );
  assert.ok(h.reasons.some((r) => r.includes("divergem")));
});
