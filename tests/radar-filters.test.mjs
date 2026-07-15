// Fase P1-A (complemento) — testes dos filtros expandidos do Radar.
// Puro, sem I/O; importa o filtro .ts direto (type-strip nativo). Fixtures locais,
// sem Supabase. Cobre cada filtro novo, combinações, busca, preservação de estado,
// regressão dos filtros existentes e do View Model, e as invariantes de arquitetura.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  applyRadarFilters,
  deriveFilterFacets,
  mainEngine,
  predictAvailable,
  forecastAvailable,
  duplicateState,
  qualityClass,
  seriesCauses,
  CLUSTER_ORIGIN,
} from "../lib/radar-filters.ts";
import { composeRadarViewModel } from "../lib/radar-view-model.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Fixture de RadarSeries "saudável" (oportunidade, Predict pronto). Cada teste
// sobrescreve só o necessário.
function mk(over = {}) {
  return {
    seriesKey: over.seriesKey ?? "livelo→smiles",
    origin: "origin" in over ? over.origin : "livelo",
    destination: over.destination ?? "smiles",
    scope: over.scope ?? "route",
    productStatus: over.productStatus ?? "opportunity",
    editorialEligible: over.editorialEligible ?? true,
    editorialBlockReasons: over.editorialBlockReasons ?? [],
    warnings: over.warnings ?? [],
    freshnessStatus: over.freshnessStatus ?? "fresh",
    modelConfidence: over.modelConfidence ?? "alta",
    divergenceLevel: over.divergenceLevel ?? "none",
    quality: {
      temporalCritical: 0, probableDuplicate: 0, placeholder: 0,
      campaignsValid: 6, campaignsExcluded: 0, excluded: [],
      ...(over.quality ?? {}),
    },
    forecast: "forecast" in over ? over.forecast : { editorialEligible: true, windowStart: "2026-07-20", windowEnd: "2026-07-30", confidence: "alta" },
    predict: "predict" in over ? over.predict : { readiness: "ready", probabilities: { p7: 0.1, p30: 0.4, p90: 0.8 } },
  };
}

const excl = (status) => ({ id: "x", route: "livelo→smiles", reason: "r", temporal: { severity: "warning" }, duplicate: { status } });

// 1
test("filtro por origem (rota)", () => {
  const s = [mk({ seriesKey: "livelo→smiles", origin: "livelo" }), mk({ seriesKey: "esfera→smiles", origin: "esfera" })];
  assert.deepEqual(applyRadarFilters(s, { origin: "livelo" }).map((x) => x.seriesKey), ["livelo→smiles"]);
});

// 2
test("filtro por elegibilidade", () => {
  const s = [mk({ editorialEligible: true }), mk({ seriesKey: "a→b", editorialEligible: false })];
  assert.equal(applyRadarFilters(s, { eligible: "yes" }).length, 1);
  assert.equal(applyRadarFilters(s, { eligible: "no" })[0].seriesKey, "a→b");
});

// 3
test("filtro por motivo de bloqueio (intervalo extremo)", () => {
  const s = [mk({ editorialBlockReasons: ["intervalo_extremo (600d ≥ 540)"] }), mk({ seriesKey: "a→b" })];
  assert.deepEqual(applyRadarFilters(s, { cause: "intervalo_extremo" }).map((x) => x.seriesKey), ["livelo→smiles"]);
});

// 4
test("filtro por frescor", () => {
  const s = [mk({ freshnessStatus: "fresh" }), mk({ seriesKey: "a→b", freshnessStatus: "stale" })];
  assert.deepEqual(applyRadarFilters(s, { freshness: "stale" }).map((x) => x.seriesKey), ["a→b"]);
});

// 5
test("filtro por duplicidade possível", () => {
  const s = [mk({ quality: { excluded: [excl("possible_duplicate")] } }), mk({ seriesKey: "a→b" })];
  assert.equal(duplicateState(s[0]), "possible");
  assert.deepEqual(applyRadarFilters(s, { duplicate: "possible" }).map((x) => x.seriesKey), ["livelo→smiles"]);
});

// 6
test("filtro por duplicidade provável", () => {
  const s = [mk({ quality: { probableDuplicate: 1 } }), mk({ seriesKey: "a→b" })];
  assert.equal(duplicateState(s[0]), "probable");
  assert.deepEqual(applyRadarFilters(s, { duplicate: "probable" }).map((x) => x.seriesKey), ["livelo→smiles"]);
});

// 7
test("filtro por qualidade válida", () => {
  const s = [mk(), mk({ seriesKey: "a→b", warnings: ["w"] })];
  assert.equal(qualityClass(s[0]), "valida");
  assert.deepEqual(applyRadarFilters(s, { quality: "valida" }).map((x) => x.seriesKey), ["livelo→smiles"]);
});

// 8
test("filtro por qualidade com atenção", () => {
  const s = [mk({ warnings: ["intervalo longo"] })];
  assert.equal(qualityClass(s[0]), "atencao");
  assert.equal(applyRadarFilters(s, { quality: "atencao" }).length, 1);
});

// 9
test("filtro por qualidade bloqueada", () => {
  const s = [mk({ quality: { temporalCritical: 1 } })];
  assert.equal(qualityClass(s[0]), "bloqueada");
  assert.equal(applyRadarFilters(s, { quality: "bloqueada" }).length, 1);
});

// 10
test("filtro por motor principal Predict", () => {
  const s = [mk(), mk({ seriesKey: "a→b", predict: { readiness: "insufficient_history", probabilities: null } })];
  assert.equal(mainEngine(s[0]), "predict");
  assert.deepEqual(applyRadarFilters(s, { engine: "predict" }).map((x) => x.seriesKey), ["livelo→smiles"]);
});

// 11
test("filtro por motor Forecast (fallback)", () => {
  const s = [mk({ seriesKey: "ff", predict: { readiness: "insufficient_history", probabilities: null }, forecast: { editorialEligible: true, windowStart: "2026-08-01", windowEnd: "2026-08-10", confidence: "media" } })];
  assert.equal(mainEngine(s[0]), "forecast");
  assert.equal(applyRadarFilters(s, { engine: "forecast" }).length, 1);
});

// 12
test("filtro por motor nenhum", () => {
  const s = [mk({ seriesKey: "none", predict: { readiness: "data_quality_blocked", probabilities: null }, forecast: { editorialEligible: false, windowStart: null, windowEnd: null, confidence: "em-formacao" } })];
  assert.equal(mainEngine(s[0]), "none");
  assert.equal(applyRadarFilters(s, { engine: "none" }).length, 1);
});

// 13
test("Predict disponível", () => {
  const s = [mk(), mk({ seriesKey: "np", predict: { readiness: "insufficient_history", probabilities: null } })];
  assert.ok(predictAvailable(s[0]));
  assert.deepEqual(applyRadarFilters(s, { predict: "yes" }).map((x) => x.seriesKey), ["livelo→smiles"]);
});

// 14
test("Predict indisponível", () => {
  const s = [mk(), mk({ seriesKey: "np", predict: { readiness: "insufficient_history", probabilities: null } })];
  assert.deepEqual(applyRadarFilters(s, { predict: "no" }).map((x) => x.seriesKey), ["np"]);
});

// 15
test("Forecast disponível", () => {
  const s = [mk(), mk({ seriesKey: "nf", forecast: { editorialEligible: false, windowStart: null, windowEnd: null, confidence: "em-formacao" } })];
  assert.ok(forecastAvailable(s[0]));
  assert.deepEqual(applyRadarFilters(s, { forecast: "yes" }).map((x) => x.seriesKey), ["livelo→smiles"]);
});

// 16
test("Forecast indisponível", () => {
  const s = [mk(), mk({ seriesKey: "nf", forecast: { editorialEligible: false, windowStart: null, windowEnd: null, confidence: "em-formacao" } })];
  assert.deepEqual(applyRadarFilters(s, { forecast: "no" }).map((x) => x.seriesKey), ["nf"]);
});

// 17
test("combinação de três filtros (AND)", () => {
  const s = [
    mk({ seriesKey: "livelo→smiles", origin: "livelo", editorialEligible: true }),
    mk({ seriesKey: "livelo→latampass", origin: "livelo", editorialEligible: false, predict: { readiness: "insufficient_history", probabilities: null } }),
    mk({ seriesKey: "esfera→smiles", origin: "esfera" }),
  ];
  const r = applyRadarFilters(s, { origin: "livelo", engine: "predict", eligible: "yes" });
  assert.deepEqual(r.map((x) => x.seriesKey), ["livelo→smiles"]);
});

// 18
test("combinação com busca", () => {
  const s = [mk({ seriesKey: "livelo→smiles" }), mk({ seriesKey: "livelo→latampass", destination: "latampass" })];
  assert.deepEqual(applyRadarFilters(s, { q: "latam", status: "opportunity" }).map((x) => x.seriesKey), ["livelo→latampass"]);
});

// 19
test("query params vazios = sem filtro (estado limpo/preservável)", () => {
  const s = [mk(), mk({ seriesKey: "a→b" })];
  assert.equal(applyRadarFilters(s, {}).length, 2);
  // determinístico: mesmo input → mesma saída (base p/ preservação na URL)
  assert.deepEqual(applyRadarFilters(s, { origin: "livelo" }), applyRadarFilters(s, { origin: "livelo" }));
});

// 20
test("limpar filtros retorna todas", () => {
  const s = [mk(), mk({ seriesKey: "a→b", productStatus: "monitoring" })];
  assert.equal(applyRadarFilters(s, {}).length, 2);
});

// 21
test("nenhum resultado após filtros impossíveis", () => {
  const s = [mk({ origin: "livelo", scope: "route" })];
  assert.equal(applyRadarFilters(s, { origin: "livelo", scope: "cluster" }).length, 0);
});

// 22
test("cluster agregado: origem=__cluster__ e origem real excludem-se", () => {
  const s = [mk({ seriesKey: "→smiles", scope: "cluster", origin: null }), mk({ seriesKey: "livelo→smiles", scope: "route", origin: "livelo" })];
  assert.deepEqual(applyRadarFilters(s, { origin: CLUSTER_ORIGIN }).map((x) => x.seriesKey), ["→smiles"]);
  assert.deepEqual(applyRadarFilters(s, { origin: "livelo" }).map((x) => x.seriesKey), ["livelo→smiles"]);
});

// 23
test("regressão: filtros existentes seguem funcionando", () => {
  const s = [
    mk({ seriesKey: "livelo→smiles", scope: "route", destination: "smiles", modelConfidence: "alta", productStatus: "opportunity" }),
    mk({ seriesKey: "→latampass", scope: "cluster", destination: "latampass", modelConfidence: "baixa", productStatus: "monitoring" }),
  ];
  assert.equal(applyRadarFilters(s, { status: "monitoring" })[0].seriesKey, "→latampass");
  assert.equal(applyRadarFilters(s, { confidence: "alta" })[0].seriesKey, "livelo→smiles");
  assert.equal(applyRadarFilters(s, { scope: "cluster" })[0].seriesKey, "→latampass");
  assert.equal(applyRadarFilters(s, { destination: "smiles" })[0].seriesKey, "livelo→smiles");
});

// 24
test("regressão do View Model: filtro é subconjunto sem mutação", () => {
  const dates = ["2026-02-05", "2026-03-05", "2026-04-05", "2026-05-05", "2026-06-05", "2026-07-05"];
  const rows = dates.map((d) => ({ id: `livelo-smiles-transferencia-${d}`, tipo: "transferencia", origem: "livelo", destino: "smiles", percentual: 30, vigencia_inicio: d, vigencia_fim: d, first_seen: d }));
  const vm = composeRadarViewModel(rows, { now: "2026-07-15", datasetComplete: true, pagesRead: 1, freshness: { status: "fresh", generatedAt: "2026-07-15T06:00:00Z", ageHours: 6 } });
  const before = JSON.stringify(vm.series);
  const all = applyRadarFilters(vm.series, {});
  assert.equal(all.length, vm.series.length);
  assert.ok(applyRadarFilters(vm.series, { scope: "route" }).every((s) => s.scope === "route"));
  assert.equal(JSON.stringify(vm.series), before, "as séries não podem ser mutadas pelo filtro");
});

// 25
test("filtros NÃO leem o ledger nem importam I/O (invariante)", () => {
  const src = readFileSync(path.join(ROOT, "lib/radar-filters.ts"), "utf8");
  assert.doesNotMatch(src, /fetchAllRows|admin-db|fetch\s*\(/);
});

// 26
test("filtros NÃO escrevem no banco (invariante)", () => {
  const src = readFileSync(path.join(ROOT, "lib/radar-filters.ts"), "utf8");
  assert.doesNotMatch(src, /\b(patch|insert|del)\s*\(/);
});

// facets derivados dos motivos presentes
test("deriveFilterFacets lista só os motivos presentes", () => {
  const s = [mk({ editorialBlockReasons: ["horizonte_excedido (200d > 180)"] }), mk({ freshnessStatus: "stale" })];
  const f = deriveFilterFacets(s);
  assert.ok(f.causes.includes("horizonte_excedido"));
  assert.ok(f.causes.includes("desatualizado"));
  assert.ok(!f.causes.includes("duplicidade"));
  assert.deepEqual(seriesCauses(mk({ productStatus: "insufficient_history" })), ["historico_insuficiente"]);
});
