// Fase P1-D — contrato de UI: vocabulário de badges consistente, catálogo de
// estados vazios completo e rótulos sempre com texto (§8/§9/§10/§16.24-28).
// Puro; radar-vocab só tem imports de tipo (erasáveis), sem puxar JSX.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCT_STATUS_TONE,
  DIVERGENCE_TONE,
  ALERT_SEVERITY_TONE,
  TEMPORAL_SEVERITY_TONE,
  freshnessTone,
} from "../components/admin/radar-vocab.ts";
import { RADAR_EMPTY } from "../lib/radar-empty.ts";
import { productStatusLabel } from "../lib/radar-view-model.ts";
import { temporalStatusLabel, duplicateStatusLabel, divergenceLabel, readinessLabel, cadenceLabel } from "../lib/radar-detail.ts";

const TONES = new Set(["green", "blue", "yellow", "red", "gray"]);
const STATUSES = ["dataset_incomplete", "data_quality_blocked", "duplicate_review", "review_required", "insufficient_history", "no_prediction", "opportunity", "monitoring"];

test("vocabulário: todo estado de produto tem um tom válido (badge com cor definida)", () => {
  for (const s of STATUSES) {
    assert.ok(TONES.has(PRODUCT_STATUS_TONE[s]), `tom de ${s}`);
  }
  assert.equal(Object.keys(PRODUCT_STATUS_TONE).length, 8);
});

test("vocabulário: severidade consistente (critical=red, warning=yellow em todas as escalas)", () => {
  assert.equal(ALERT_SEVERITY_TONE.critical, "red");
  assert.equal(ALERT_SEVERITY_TONE.warning, "yellow");
  assert.equal(ALERT_SEVERITY_TONE.info, "blue");
  assert.equal(TEMPORAL_SEVERITY_TONE.critical, "red");
  assert.equal(TEMPORAL_SEVERITY_TONE.warning, "yellow");
  assert.equal(TEMPORAL_SEVERITY_TONE.ok, "green");
  // Divergência: block=red, review/warning=yellow, compatible=green.
  assert.equal(DIVERGENCE_TONE.block, "red");
  assert.equal(DIVERGENCE_TONE.compatible, "green");
  for (const l of ["none", "compatible", "warning", "review", "block"]) assert.ok(TONES.has(DIVERGENCE_TONE[l]));
});

test("frescor: só fresh é verde", () => {
  assert.equal(freshnessTone("fresh"), "green");
  assert.equal(freshnessTone("stale"), "yellow");
  assert.equal(freshnessTone("missing"), "red");
  assert.equal(freshnessTone("incomplete"), "red");
});

test("badges com texto: rótulos de estado/severidade nunca vazios", () => {
  for (const s of STATUSES) assert.ok(productStatusLabel(s).length > 0, `label de ${s}`);
  for (const t of ["valid", "suspect_year", "missing_event_date", "permanent_or_open_ended", "conflicting_event_dates", "invalid_event_date", "event_after_source", "event_far_before_source"]) {
    assert.ok(temporalStatusLabel(t).length > 0, `label temporal ${t}`);
  }
  for (const d of ["unique", "possible_duplicate", "probable_duplicate"]) assert.ok(duplicateStatusLabel(d).length > 0);
  for (const l of ["none", "compatible", "warning", "review", "block"]) assert.ok(divergenceLabel(l).length > 0);
  for (const r of ["ready", "ready_with_warnings", "insufficient_history", "backfill_incomplete", "data_quality_blocked"]) assert.ok(readinessLabel(r).length > 0);
  for (const c of ["mensal", "irregular", "esparsa", null]) assert.ok(cadenceLabel(c).length > 0);
});

test("estados vazios: catálogo completo (título/descrição/impacto/ação em todos)", () => {
  const keys = Object.keys(RADAR_EMPTY);
  assert.ok(keys.length >= 18, `18+ estados, tem ${keys.length}`);
  for (const k of keys) {
    const e = RADAR_EMPTY[k];
    assert.ok(e.title && e.title.length > 0, `${k}.title`);
    assert.ok(e.description && e.description.length > 0, `${k}.description`);
    assert.ok(e.impact && e.impact.length > 0, `${k}.impact`);
    assert.ok(e.action && e.action.length > 0, `${k}.action`);
    if (e.diagnosticHref) assert.ok(e.diagnosticHref.startsWith("/admin/"), `${k}.diagnosticHref`);
  }
  // Estados exigidos pelo §10 presentes.
  for (const k of ["no_campaigns", "no_filter_results", "series_not_found", "dataset_incomplete", "stale", "load_error", "both_unavailable", "no_backtest", "no_bonus"]) {
    assert.ok(RADAR_EMPTY[k], `estado ${k} presente`);
  }
});
