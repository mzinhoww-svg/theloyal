// Fase C0.2 — qualidade temporal + duplicidade provável em runtime.
// Unidade (scripts/campaign-quality.mjs) + integração nos dois motores
// (lib/forecast.ts, lib/predict-engine.ts, scripts/forecast-engine.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateTemporalPlausibility,
  detectProbableDuplicates,
  assessCampaignQuality,
  resolveEventDateCandidate,
} from "../scripts/campaign-quality.mjs";
import { normProgram, buildForecast as buildForecastMjs } from "../scripts/forecast-engine.mjs";
import { buildForecast as buildForecastTs } from "../lib/forecast.ts";
import { buildPredict } from "../lib/predict-engine.ts";

const NOW = "2026-07-15";
const opt = { normalize: normProgram };

// ---- Caso de referência (real: vigencia_inicio null, fim fabricada) ----
const A = {
  id: "livelo-connectmiles-transferencia-2023-12-12",
  origem: "livelo", destino: "connectmiles", tipo: "transferencia", percentual: 40,
  vigencia_inicio: null, vigencia_fim: "2023-12-12",
  first_seen: "2026-07-12", observed_at: "2026-07-13", origin: "auto",
};
const B = {
  id: "livelo-connectmiles-transferencia-2026-07-12",
  origem: "livelo", destino: "connectmiles", tipo: "transferencia", percentual: 40,
  vigencia_inicio: null, vigencia_fim: "2026-07-12",
  first_seen: "2026-07-10", observed_at: "2026-07-12", origin: "daily",
};

// 2. suspect_year
test("temporal: registro A (fim fabricada) → suspect_year crítico, excluído", () => {
  const t = evaluateTemporalPlausibility(A);
  assert.equal(t.status, "suspect_year");
  assert.equal(t.severity, "critical");
  assert.equal(t.includeInPrediction, false);
  assert.equal(t.requiresReprocessing, true);
  assert.equal(t.requiresHumanReview, true);
  assert.equal(t.eventDate, "2023-12-12"); // 3. nenhuma data substituída automaticamente
  assert.equal(t.dayDifference, 943);
});

test("temporal: registro B é válido e entra na previsão", () => {
  const t = evaluateTemporalPlausibility(B);
  assert.equal(t.status, "valid");
  assert.equal(t.includeInPrediction, true);
});

// 3. event_far_before_source warning (181–300 dias, sem início explícito)
test("temporal: 200 dias antes da proveniência → event_far_before_source (warning, não bloqueia)", () => {
  const t = evaluateTemporalPlausibility({
    id: "x-y-transferencia-2026-01-01", origem: "x", destino: "y", tipo: "transferencia",
    vigencia_inicio: null, vigencia_fim: "2026-01-01", first_seen: "2026-07-20",
  });
  assert.ok(t.flags.includes("event_far_before_source"));
  assert.notEqual(t.status, "suspect_year");
  assert.equal(t.includeInPrediction, true);
});

// 4. event_far_before_source crítico → suspect_year
test("temporal: 400 dias antes sem início explícito → suspect_year", () => {
  const t = evaluateTemporalPlausibility({
    id: "x-y-transferencia-2025-05-01", origem: "x", destino: "y", tipo: "transferencia",
    vigencia_inicio: null, vigencia_fim: "2025-05-01", first_seen: "2026-07-01",
  });
  assert.equal(t.status, "suspect_year");
  assert.equal(t.includeInPrediction, false);
});

// 5. event_after_source
test("temporal: evento >30d após toda a proveniência → event_after_source", () => {
  const t = evaluateTemporalPlausibility({
    id: "x-y-transferencia-2026-06-01", origem: "x", destino: "y", tipo: "transferencia",
    vigencia_inicio: "2026-06-01", first_seen: "2026-01-01", observed_at: "2026-01-02",
  });
  assert.ok(t.flags.includes("event_after_source"));
  assert.equal(t.requiresHumanReview, true);
});

// 6. datas conflitantes (início após fim)
test("temporal: início após fim → conflicting_event_dates", () => {
  const t = evaluateTemporalPlausibility({
    id: "x-y-transferencia-2026-01-01", origem: "x", destino: "y", tipo: "transferencia",
    vigencia_inicio: "2026-06-01", vigencia_fim: "2026-01-01",
  });
  assert.ok(t.flags.includes("conflicting_event_dates"));
});

// 7. data ausente
test("temporal: sem nenhuma data → missing_event_date", () => {
  const t = evaluateTemporalPlausibility({ id: "x-y-transferencia-nodate", origem: "x", destino: "y", tipo: "transferencia" });
  assert.equal(t.status, "missing_event_date");
  assert.equal(t.includeInPrediction, false);
});

// 8. data inválida
test("temporal: data presente porém inválida → invalid_event_date", () => {
  const t = evaluateTemporalPlausibility({ id: "x-y-transferencia-bad", origem: "x", destino: "y", tipo: "transferencia", vigencia_fim: "2026-13-45" });
  assert.equal(t.status, "invalid_event_date");
  assert.equal(t.includeInPrediction, false);
});

// 9. campanha permanente
test("temporal: vigencia_fim='na' → permanent_or_open_ended (fora da recorrência)", () => {
  const t = evaluateTemporalPlausibility({ id: "x-y-transferencia-na", origem: "x", destino: "y", tipo: "transferencia", vigencia_fim: "na" });
  assert.equal(t.status, "permanent_or_open_ended");
  assert.equal(t.includeInPrediction, false);
});

// 10. campanha antiga legítima (início explícito) → revisão, sem autocorreção nem exclusão
test("temporal: campanha antiga com início explícito → revisão, sem autocorrigir para first_seen", () => {
  const t = evaluateTemporalPlausibility({
    id: "x-y-transferencia-2024-01-10", origem: "x", destino: "y", tipo: "transferencia",
    vigencia_inicio: "2024-01-10", vigencia_fim: "2024-01-10", first_seen: "2026-07-01",
  });
  assert.equal(t.eventDate, "2024-01-10"); // NÃO virou first_seen
  assert.ok(t.flags.includes("event_far_before_source"));
  assert.equal(t.requiresHumanReview, true);
  assert.equal(t.includeInPrediction, true); // não exclui definitivamente
});

// 11. duplicidade possível
test("dup: mesma rota/tipo/bônus + proveniência próxima, ambos válidos → possible_duplicate", () => {
  const r1 = { id: "a-b-transferencia-2026-03-01", origem: "a", destino: "b", tipo: "transferencia", percentual: 30, vigencia_inicio: "2026-03-01", first_seen: "2026-03-01" };
  const r2 = { id: "a-b-transferencia-2026-03-02", origem: "a", destino: "b", tipo: "transferencia", percentual: 30, vigencia_inicio: "2026-03-02", first_seen: "2026-03-03" };
  const temporalById = { [r1.id]: evaluateTemporalPlausibility(r1), [r2.id]: evaluateTemporalPlausibility(r2) };
  const d = detectProbableDuplicates([r1, r2], temporalById, opt);
  assert.equal(d.byCampaignId[r1.id].status, "possible_duplicate");
});

// 12. duplicidade provável (referência)
test("dup: A/B do caso de referência → probable_duplicate", () => {
  const temporalById = { [A.id]: evaluateTemporalPlausibility(A), [B.id]: evaluateTemporalPlausibility(B) };
  const d = detectProbableDuplicates([A, B], temporalById, opt);
  assert.equal(d.byCampaignId[A.id].status, "probable_duplicate");
  assert.deepEqual(d.byCampaignId[A.id].relatedCampaignIds, [B.id]);
});

// 13. semelhantes mas distintas (bônus e datas diferentes)
test("dup: mesma rota, bônus e datas bem diferentes → unique", () => {
  const r1 = { id: "a-b-transferencia-2026-01-01", origem: "a", destino: "b", tipo: "transferencia", percentual: 30, vigencia_inicio: "2026-01-01", first_seen: "2026-01-01" };
  const r2 = { id: "a-b-transferencia-2026-02-01", origem: "a", destino: "b", tipo: "transferencia", percentual: 80, vigencia_inicio: "2026-02-01", first_seen: "2026-02-01" };
  const temporalById = { [r1.id]: evaluateTemporalPlausibility(r1), [r2.id]: evaluateTemporalPlausibility(r2) };
  const d = detectProbableDuplicates([r1, r2], temporalById, opt);
  assert.equal(d.byCampaignId[r1.id].status, "unique");
});

// 14. mesmo programa e bônus, fontes/datas distantes, sem duplicidade
test("dup: mesmo bônus mas proveniência distante e intervalo compatível → unique (bônus só não basta)", () => {
  const r1 = { id: "a-b-transferencia-2026-01-01", origem: "a", destino: "b", tipo: "transferencia", percentual: 30, vigencia_inicio: "2026-01-01", first_seen: "2026-01-01" };
  const r2 = { id: "a-b-transferencia-2026-03-01", origem: "a", destino: "b", tipo: "transferencia", percentual: 30, vigencia_inicio: "2026-03-01", first_seen: "2026-03-01" };
  const temporalById = { [r1.id]: evaluateTemporalPlausibility(r1), [r2.id]: evaluateTemporalPlausibility(r2) };
  const d = detectProbableDuplicates([r1, r2], temporalById, opt);
  assert.equal(d.byCampaignId[r1.id].status, "unique");
});

// 15. placeholder inválido
test("elegibilidade: programa placeholder (desconhecido) → excluído", () => {
  const q = assessCampaignQuality([
    { id: "desconhecido-b-transferencia-2026-01-01", origem: "desconhecido", destino: "b", tipo: "transferencia", vigencia_inicio: "2026-01-01" },
  ], opt);
  assert.equal(q.eligibleRows.length, 0);
  assert.equal(q.counters.blockedPlaceholder, 1);
});

// 16. alias confirmado normaliza e agrupa
test("dup: aliases (Livelo/livelo, Latam Pass/latampass) agrupam para dedup", () => {
  const r1 = { id: "Livelo-Latam Pass-transferencia-2026-03-01", origem: "Livelo", destino: "Latam Pass", tipo: "transferencia", percentual: 30, vigencia_inicio: "2026-03-01", first_seen: "2026-03-01" };
  const r2 = { id: "livelo-latampass-transferencia-2026-03-02", origem: "livelo", destino: "latampass", tipo: "transferencia", percentual: 30, vigencia_inicio: "2026-03-02", first_seen: "2026-03-02" };
  const temporalById = { [r1.id]: evaluateTemporalPlausibility(r1), [r2.id]: evaluateTemporalPlausibility(r2) };
  const d = detectProbableDuplicates([r1, r2], temporalById, opt);
  assert.notEqual(d.byCampaignId[r1.id].status, "unique"); // agruparam (mesmo programa após alias)
});

// 17. alias ambíguo (bb ≠ bb-empresas) permanece separado
test("dup: bb e bb-empresas NÃO agrupam (separação deliberada)", () => {
  const r1 = { id: "bb-latampass-transferencia-2026-03-01", origem: "bb", destino: "latampass", tipo: "transferencia", percentual: 30, vigencia_inicio: "2026-03-01", first_seen: "2026-03-01" };
  const r2 = { id: "bb-empresas-latampass-transferencia-2026-03-02", origem: "bb-empresas", destino: "latampass", tipo: "transferencia", percentual: 30, vigencia_inicio: "2026-03-02", first_seen: "2026-03-02" };
  const temporalById = { [r1.id]: evaluateTemporalPlausibility(r1), [r2.id]: evaluateTemporalPlausibility(r2) };
  const d = detectProbableDuplicates([r1, r2], temporalById, opt);
  assert.equal(d.byCampaignId[r1.id].status, "unique");
  assert.equal(d.byCampaignId[r2.id].status, "unique");
});

// 1 + 18 + 21 + 22 + 23 + 25: integração Forecast
test("forecast: exclui A, não forma 943, não prevê 2029, expõe motivo", () => {
  const fc = buildForecastTs([A, B], { now: NOW });
  const route = fc.routes.find((r) => r.route === "livelo→connectmiles");
  assert.equal(route.samples, 1); // 23. sem amostra após exclusão
  assert.deepEqual(route.intervals, []); // 21. sem intervalo de 943
  assert.equal(route.windowStart, null); // 22. sem janela de 2029
  assert.equal(route.confidence, "em-formacao");
  // 18 + 25: A excluída com motivo
  const exA = fc.quality.excluded.find((e) => e.id === A.id);
  assert.ok(exA);
  assert.match(exA.reason, /suspect_year/);
  assert.match(exA.reason, /probable_duplicate/);
  assert.equal(fc.quality.counters.probableDuplicateGroups, 1);
});

// 19 + 22: integração Predict
test("predict: exclui A, rota fica bloqueada (sem 2029)", () => {
  const pr = buildPredict([A, B], { asOf: NOW });
  const route = pr.routes.find((r) => r.origem === "livelo" && r.destino === "connectmiles");
  assert.equal(route.recordsTotal, 1);
  assert.ok(route.blockReason != null);
  const exA = pr.quality.excluded.find((e) => e.id === A.id);
  assert.ok(exA);
});

// 20. Forecast e Predict recebem exatamente o mesmo conjunto elegível
test("forecast e predict compartilham o mesmo conjunto elegível", () => {
  const rows = [A, B, { id: "esfera-azul-transferencia-2026-05-01", origem: "esfera", destino: "azul", tipo: "transferencia", percentual: 100, vigencia_inicio: "2026-05-01", first_seen: "2026-05-01" }];
  const fc = buildForecastTs(rows, { now: NOW });
  const pr = buildPredict(rows, { asOf: NOW });
  const fcIds = fc.quality.eligibleRows.map((r) => r.id).sort();
  const prIds = pr.quality.eligibleRows.map((r) => r.id).sort();
  assert.deepEqual(fcIds, prIds);
  assert.ok(!fcIds.includes(A.id)); // A fora
  assert.ok(fcIds.includes(B.id));
});

// 24. paridade TS/MJS no caso de referência
test("paridade TS/MJS: mesma exclusão e ausência de 943 no caso de referência", () => {
  const ts = buildForecastTs([A, B], { now: NOW });
  const mjs = buildForecastMjs([A, B], { now: NOW });
  assert.deepEqual(
    ts.quality.eligibleRows.map((r) => r.id),
    mjs.quality.eligibleRows.map((r) => r.id),
  );
  const rTs = ts.routes.find((r) => r.route === "livelo→connectmiles");
  const rMjs = mjs.routes.find((r) => r.route === "livelo→connectmiles");
  assert.deepEqual(rTs.intervals, rMjs.intervals);
  assert.deepEqual(rTs.intervals, []);
});

// resolveEventDateCandidate mantém a prioridade do windowDate
test("resolveEventDateCandidate: início > id > fim", () => {
  assert.equal(resolveEventDateCandidate({ vigencia_inicio: "2026-02-02", id: "x-2020-01-01", vigencia_fim: "2026-03-03" }), "2026-02-02");
  assert.equal(resolveEventDateCandidate({ id: "x-y-transferencia-2026-03-04" }), "2026-03-04");
  assert.equal(resolveEventDateCandidate({ id: "no-date", vigencia_fim: "2026-05-06" }), "2026-05-06");
  assert.equal(resolveEventDateCandidate({ id: "no-date", vigencia_fim: "na" }), null);
});
