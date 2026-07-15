// Testes do controle de frescor do artefato de previsão (Fase C0).
import { test } from "node:test";
import assert from "node:assert/strict";
import { assessForecastArtifact, DEFAULT_MAX_FORECAST_AGE_HOURS } from "../scripts/forecast-freshness.mjs";

const NOW = "2026-07-15T12:00:00Z";

test("freshness: artefato recente e completo → fresh", () => {
  const a = assessForecastArtifact(
    { generatedAt: "2026-07-15T10:00:00Z", ledgerRows: 2438, datasetComplete: true },
    { now: NOW },
  );
  assert.equal(a.status, "fresh");
  assert.ok(a.ageHours < 24);
});

test("freshness: artefato antigo → stale", () => {
  const a = assessForecastArtifact(
    { generatedAt: "2026-07-10T00:00:00Z", ledgerRows: 119, datasetComplete: true },
    { now: NOW },
  );
  assert.equal(a.status, "stale");
});

test("freshness: exatamente no limite ainda é fresh; além dele é stale", () => {
  const atLimit = assessForecastArtifact({ generatedAt: "2026-07-14T12:00:00Z" }, { now: NOW }); // 24h
  assert.equal(atLimit.status, "fresh");
  const beyond = assessForecastArtifact({ generatedAt: "2026-07-14T11:00:00Z" }, { now: NOW }); // 25h
  assert.equal(beyond.status, "stale");
});

test("freshness: artefato ausente → missing", () => {
  assert.equal(assessForecastArtifact(null, { now: NOW }).status, "missing");
  assert.equal(assessForecastArtifact(undefined, { now: NOW }).status, "missing");
});

test("freshness: generatedAt ausente/ inválido → invalid", () => {
  assert.equal(assessForecastArtifact({}, { now: NOW }).status, "invalid");
  assert.equal(assessForecastArtifact({ generatedAt: "não-é-data" }, { now: NOW }).status, "invalid");
  assert.equal(assessForecastArtifact("string", { now: NOW }).status, "invalid");
});

test("freshness: datasetComplete=false → incomplete (mesmo que recente)", () => {
  const a = assessForecastArtifact(
    { generatedAt: "2026-07-15T11:59:00Z", datasetComplete: false },
    { now: NOW },
  );
  assert.equal(a.status, "incomplete");
});

test("freshness: default de idade máxima é 24h", () => {
  assert.equal(DEFAULT_MAX_FORECAST_AGE_HOURS, 24);
});
