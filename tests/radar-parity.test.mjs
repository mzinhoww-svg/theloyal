// Fase P1-D — paridade funcional entre o Radar e os motores/telas técnicas.
// Prova que o RadarViewModel NÃO distorce Forecast, Predict, qualidade,
// contadores nem bloqueios — a mesma informação, sem cálculo novo. Puro, sem I/O.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildForecast, normProgram } from "../lib/forecast.ts";
import { buildPredict } from "../lib/predict-engine.ts";
import { assessCampaignQuality } from "../lib/campaign-quality.ts";
import { composeRadarViewModel } from "../lib/radar-view-model.ts";
import { findRadarSeries } from "../lib/radar-detail.ts";
import { applyRadarFilters, mainEngine } from "../lib/radar-filters.ts";
import { buildRadarQueues } from "../lib/radar-operations.ts";

const NOW = "2026-07-15";
const FRESH = { status: "fresh", generatedAt: "2026-07-15T06:00:00Z", ageHours: 6 };

function healthy() {
  const dates = ["2026-02-05", "2026-03-05", "2026-04-05", "2026-05-05", "2026-06-05", "2026-07-05"];
  return dates.map((d) => ({
    id: `livelo-smiles-transferencia-${d}`, tipo: "transferencia", origem: "livelo", destino: "smiles",
    percentual: 30, vigencia_inicio: d, vigencia_fim: d, first_seen: d, observed_at: d, created_at: `${d}T12:00:00Z`,
  }));
}
const CONNECT_A = { id: "livelo-connectmiles-transferencia-2023-12-12", tipo: "transferencia", origem: "livelo", destino: "connectmiles", percentual: 40, vigencia_inicio: null, vigencia_fim: "2023-12-12", first_seen: "2026-07-12", observed_at: "2026-07-13", created_at: "2026-07-13T16:48:00Z", source_url: "https://x.com/ultimo-dia/" };
const CONNECT_B = { id: "livelo-connectmiles-transferencia-2026-07-12", tipo: "transferencia", origem: "livelo", destino: "connectmiles", percentual: 40, vigencia_inicio: null, vigencia_fim: "2026-07-12", first_seen: "2026-07-10", observed_at: "2026-07-12", created_at: "2026-07-11T04:47:00Z", source_url: "https://x.com/prorrogado/" };
const PLACEHOLDER = { id: "desconhecido-latampass-transferencia-2026-06-01", tipo: "transferencia", origem: "desconhecido", destino: "latampass", percentual: 30, vigencia_fim: "2026-06-01", first_seen: "2026-05-25" };
const ROWS = [...healthy(), CONNECT_A, CONNECT_B, PLACEHOLDER];

const fc = buildForecast(ROWS, { now: NOW });
const pr = buildPredict(ROWS, { asOf: NOW });
const quality = assessCampaignQuality(ROWS, { normalize: normProgram });
const vm = composeRadarViewModel(ROWS, { now: NOW, datasetComplete: true, pagesRead: 1, freshness: FRESH });
const key = (scope, o, d) => (scope === "cluster" ? `→${d}` : `${o}→${d}`);

test("1 paridade Forecast: objeto por série idêntico ao motor", () => {
  for (const f of [...fc.routes, ...fc.clusters]) {
    const s = findRadarSeries(vm, f.route);
    assert.ok(s, `série ${f.route} no Radar`);
    assert.deepEqual(s.forecast, f, `forecast de ${f.route} diverge`);
  }
});

test("2 paridade Predict: objeto por série idêntico ao motor", () => {
  for (const p of [...pr.routes, ...pr.clusters]) {
    const s = findRadarSeries(vm, key(p.scope, p.origem, p.destino));
    assert.ok(s, `série predict no Radar`);
    assert.deepEqual(s.predict, p, `predict diverge`);
  }
});

test("3/5 paridade qualidade e contadores: saúde == quality do motor", () => {
  assert.equal(vm.health.campaignsTotal, quality.counters.totalReceived);
  assert.equal(vm.health.campaignsEligible, quality.counters.totalEligible);
  assert.equal(vm.health.campaignsExcluded, quality.excluded.length);
  assert.equal(vm.health.probableDuplicateCount, quality.counters.probableDuplicateGroups);
  assert.equal(vm.health.placeholderCount, quality.counters.blockedPlaceholder);
  assert.equal(vm.health.temporalCriticalCount, quality.excluded.filter((e) => e.temporal.severity === "critical").length);
});

test("4 paridade bloqueios: bloqueio do Forecast reflete no status do Radar", () => {
  const s = findRadarSeries(vm, "livelo→connectmiles");
  assert.ok(s.forecast.editorialBlockReason, "forecast bloqueado");
  assert.ok(!s.editorialEligible, "não elegível no Radar");
  assert.equal(s.productStatus, "data_quality_blocked");
});

test("6 linha × detalhe: mesma fonte (o objeto da tabela é o do detalhe)", () => {
  const fromList = vm.series.find((x) => x.seriesKey === "livelo→smiles" && x.scope === "route");
  const fromDetail = findRadarSeries(vm, "livelo→smiles");
  assert.equal(fromList, fromDetail, "mesma referência de série");
  // Campos exibidos na tabela existem e batem com o motor.
  assert.equal(fromList.editorialEligible, fromList.forecast.editorialEligible);
});

test("7 status × fila: filas coerentes com o status da série", () => {
  const queues = buildRadarQueues(vm);
  const opp = queues.find((q) => q.key === "opportunities").items;
  assert.ok(opp.every((s) => s.productStatus === "opportunity" && s.editorialEligible));
  const blk = queues.find((q) => q.key === "blocked").items;
  assert.ok(blk.every((s) => ["dataset_incomplete", "data_quality_blocked", "duplicate_review", "insufficient_history", "no_prediction"].includes(s.productStatus) || s.freshnessStatus !== "fresh" || s.editorialBlockReasons.length > 0));
  const susp = queues.find((q) => q.key === "suspects").items;
  assert.ok(susp.every((s) => s.quality.temporalCritical > 0));
});

test("8 filtros × campos: cada filtro recorta pelo campo existente", () => {
  assert.ok(applyRadarFilters(vm.series, { status: "opportunity" }).every((s) => s.productStatus === "opportunity"));
  assert.ok(applyRadarFilters(vm.series, { scope: "cluster" }).every((s) => s.scope === "cluster"));
  assert.ok(applyRadarFilters(vm.series, { engine: "none" }).every((s) => mainEngine(s) === "none"));
  assert.ok(applyRadarFilters(vm.series, { q: "connectmiles" }).every((s) => s.seriesKey.includes("connectmiles")));
});

test("11 seriesKey codificada é reversível (link compartilhável)", () => {
  for (const s of vm.series) {
    const enc = encodeURIComponent(s.seriesKey);
    assert.equal(decodeURIComponent(enc), s.seriesKey);
    assert.equal(findRadarSeries(vm, decodeURIComponent(enc)), s);
  }
});

test("37/38 nenhuma nova leitura / nenhum cálculo duplicado: composição determinística", () => {
  const vm2 = composeRadarViewModel(ROWS, { now: NOW, datasetComplete: true, pagesRead: 1, freshness: FRESH });
  assert.deepEqual(vm.health, vm2.health);
  assert.deepEqual(vm.series.map((s) => s.seriesKey), vm2.series.map((s) => s.seriesKey));
  assert.deepEqual(vm.filters, vm2.filters);
});

test("30/31/32 regressão P1-A/B/C: contrato do view model preservado", () => {
  assert.ok(vm.metadata && vm.health && vm.series.length > 0 && vm.filters); // P1-A
  const s = findRadarSeries(vm, "livelo→smiles");
  assert.ok(Array.isArray(s.quality.used) && Array.isArray(s.quality.excluded)); // P1-B
  assert.equal(buildRadarQueues(vm).length, 8); // P1-C
});
