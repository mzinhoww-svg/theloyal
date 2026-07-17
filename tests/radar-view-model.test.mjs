// Fase P1-A — testes do Radar View Model (composição runtime).
// Verifica PARIDADE com os motores (nenhum cálculo novo) e o comportamento do
// estado consolidado, incluindo a contenção do caso 943 (livelo→connectmiles).
// Puro, sem I/O; importa o composer .ts diretamente (type-strip nativo).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildForecast } from "../lib/forecast.ts";
import { buildPredict } from "../lib/predict-engine.ts";
import { composeRadarViewModel } from "../lib/radar-view-model.ts";

const NOW = "2026-07-15";
const FRESH = { status: "fresh", generatedAt: "2026-07-15T06:00:00Z", ageHours: 6 };

// Série mensal saudável (6 ondas), temporalmente plausível.
function healthy() {
  const dates = ["2026-02-05", "2026-03-05", "2026-04-05", "2026-05-05", "2026-06-05", "2026-07-05"];
  return dates.map((d) => ({
    id: `livelo-smiles-transferencia-${d}`,
    tipo: "transferencia", origem: "livelo", destino: "smiles", percentual: 30,
    vigencia_inicio: d, vigencia_fim: d, first_seen: d, observed_at: d, created_at: `${d}T12:00:00Z`,
  }));
}

// Caso de referência 943: A com vigencia_fim fabricada (2023), B correta (2026).
const CONNECT_A = {
  id: "livelo-connectmiles-transferencia-2023-12-12",
  tipo: "transferencia", origem: "livelo", destino: "connectmiles", percentual: 40,
  vigencia_inicio: null, vigencia_fim: "2023-12-12",
  first_seen: "2026-07-12", observed_at: "2026-07-13", created_at: "2026-07-13T16:48:00Z",
  source_url: "https://passageirodeprimeira.com/ultimo-dia-livelo-oferece-40-de-bonus-nas-transferencias-para-o-connectmiles/",
};
const CONNECT_B = {
  id: "livelo-connectmiles-transferencia-2026-07-12",
  tipo: "transferencia", origem: "livelo", destino: "connectmiles", percentual: 40,
  vigencia_inicio: null, vigencia_fim: "2026-07-12",
  first_seen: "2026-07-10", observed_at: "2026-07-12", created_at: "2026-07-11T04:47:00Z",
  source_url: "https://passageirodeprimeira.com/prorrogado-livelo-oferece-40-de-bonus-nas-transferencias-para-o-connectmiles/",
};

// Placeholder inválido (não forma programa). "desconhecido" é placeholder no
// campaign-quality (empty/desconhecido/unknown/na) — a string "null" NÃO é.
const JUNK = { id: "desconhecido-latampass-transferencia-2026-06-01", tipo: "transferencia", origem: "desconhecido", destino: "latampass", percentual: 30, vigencia_fim: "2026-06-01", first_seen: "2026-05-25" };

const ROWS = [...healthy(), CONNECT_A, CONNECT_B, JUNK];

function vmOf(rows, over = {}) {
  return composeRadarViewModel(rows, { now: NOW, datasetComplete: true, pagesRead: 1, freshness: FRESH, ...over });
}

test("paridade: séries do view model == séries dos motores (nenhum cálculo novo)", () => {
  const fc = buildForecast(ROWS, { now: NOW });
  const vm = vmOf(ROWS);
  const fcKeys = [...fc.routes, ...fc.clusters].map((f) => f.route).sort();
  const vmKeys = vm.series.map((s) => s.seriesKey).sort();
  assert.deepEqual(vmKeys, fcKeys, "conjunto de séries diverge dos motores");
  // O objeto forecast por série é o MESMO produzido por buildForecast.
  const smiles = vm.series.find((s) => s.seriesKey === "livelo→smiles" && s.scope === "route");
  const fcSmiles = fc.routes.find((f) => f.route === "livelo→smiles");
  assert.deepEqual(smiles.forecast, fcSmiles, "forecast da série não é o do motor");
});

test("paridade: contadores de saúde == quality dos motores", () => {
  const fc = buildForecast(ROWS, { now: NOW });
  const vm = vmOf(ROWS);
  assert.equal(vm.health.campaignsTotal, fc.quality.counters.totalReceived);
  assert.equal(vm.health.campaignsEligible, fc.quality.counters.totalEligible);
  assert.equal(vm.health.campaignsExcluded, fc.quality.excluded.length);
  assert.equal(vm.health.probableDuplicateCount, fc.quality.counters.probableDuplicateGroups);
});

test("943: série connectmiles é bloqueada por dado, sem intervalo 943, sem janela 2029", () => {
  const vm = vmOf(ROWS);
  const s = vm.series.find((x) => x.seriesKey === "livelo→connectmiles" && x.scope === "route");
  assert.ok(s, "série da rota existe");
  assert.equal(s.productStatus, "data_quality_blocked");
  assert.ok(s.quality.temporalCritical >= 1, "registro A excluído por temporal crítico");
  assert.ok(s.campaignsExcluded >= 1);
  assert.equal(s.window, null, "sem janela (nada de 2029)");
  assert.notEqual(s.maxIntervalDays, 943, "o intervalo de 943 não se forma");
});

test("943: par é duplicidade provável na saúde", () => {
  const vm = vmOf(ROWS);
  assert.ok(vm.health.probableDuplicateCount >= 1);
  assert.ok(vm.health.temporalCriticalCount >= 1);
});

test("série saudável é elegível e não bloqueada", () => {
  const vm = vmOf(ROWS);
  const s = vm.series.find((x) => x.seriesKey === "livelo→smiles" && x.scope === "route");
  assert.ok(s);
  assert.equal(s.editorialEligible, true);
  assert.ok(["opportunity", "monitoring"].includes(s.productStatus), `estado inesperado: ${s.productStatus}`);
  assert.ok(s.waves >= 5);
});

test("placeholder não forma série de programa válida", () => {
  const vm = vmOf(ROWS);
  // "desconhecido" é placeholder → excluído; não há série elegível dele.
  const s = vm.series.find((x) => x.seriesKey === "desconhecido→latampass");
  if (s) assert.equal(s.editorialEligible, false);
  assert.ok(vm.health.placeholderCount >= 1);
});

test("dataset incompleto marca todas as séries como base incompleta", () => {
  const vm = vmOf(ROWS, { datasetComplete: false });
  assert.ok(vm.series.length > 0);
  assert.ok(vm.series.every((s) => s.productStatus === "dataset_incomplete"));
  assert.equal(vm.metadata.datasetComplete, false);
  assert.ok(vm.health.alertCount >= 1);
});

test("artefato stale gera alerta global sem mudar o estado por série", () => {
  const vm = vmOf(ROWS, { freshness: { status: "stale", generatedAt: "2026-07-10T06:00:00Z", ageHours: 120 } });
  assert.ok(vm.health.staleCount === vm.series.length);
  assert.ok(vm.health.alertCount >= 1);
  // Frescor não vira productStatus 'stale' por série (é alerta global).
  assert.ok(!vm.series.some((s) => s.productStatus === "dataset_incomplete"));
});

test("filtros são populados a partir das séries", () => {
  const vm = vmOf(ROWS);
  assert.ok(vm.filters.destinations.includes("smiles"));
  assert.ok(vm.filters.destinations.includes("connectmiles"));
  assert.ok(vm.filters.origins.includes("livelo"));
  assert.ok(vm.filters.productStatuses.length >= 1);
});
