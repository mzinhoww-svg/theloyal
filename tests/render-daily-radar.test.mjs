// A1 — Daily lê o radar canônico (digest.radarDaily) quando não há radar manual,
// com a mesma regra honesta da Weekly: só usa se o artefato estiver fresco.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRadar } from "../scripts/render.mjs";
import { monitoringLine } from "../scripts/lib.mjs";

const RADAR_ITEM = { label: "Latam Pass", confidence: "media", window: "17 a 24 jul", basis: "6 campanhas", source: "predict" };
function artifact(generatedAt, radarDaily = [RADAR_ITEM]) {
  return { generatedAt, datasetComplete: true, digest: { radarDaily } };
}
const nowISO = new Date().toISOString();
const oldISO = new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(); // 72h atrás

test("radar manual da edição sempre vence o automático", () => {
  const manual = { note: "n", windows: [{ label: "X", confidence: "alta", window: "1 a 2 ago" }] };
  const r = resolveRadar({ radar: manual }, { artifact: artifact(nowISO) });
  assert.equal(r, manual);
});

test("sem radar manual + artefato fresco → usa digest.radarDaily (canônico)", () => {
  const r = resolveRadar({}, { artifact: artifact(nowISO) });
  assert.ok(r, "radar resolvido");
  assert.equal(r.windows.length, 1);
  assert.equal(r.windows[0].source, "predict");
});

test("sem radar manual + artefato stale → null (nunca número velho em silêncio)", () => {
  const r = resolveRadar({}, { artifact: artifact(oldISO) });
  assert.equal(r, null);
});

test("sem radar manual + radarDaily vazio E sem monitoramento → null", () => {
  const r = resolveRadar({}, { artifact: { generatedAt: nowISO, datasetComplete: true, digest: { radarDaily: [], radarMonitoringDaily: 0 } } });
  assert.equal(r, null);
});

test("A2: radarDaily vazio mas séries em observação → bloco com monitoringCount (degrade honesto)", () => {
  const r = resolveRadar({}, { artifact: { generatedAt: nowISO, datasetComplete: true, digest: { radarDaily: [], radarMonitoringDaily: 37 } } });
  assert.ok(r, "bloco presente mesmo sem janela");
  assert.deepEqual(r.windows, []);
  assert.equal(r.monitoringCount, 37);
});

test("A2: monitoringLine é honesta, sem número de promessa", () => {
  assert.equal(monitoringLine(0), "");
  assert.match(monitoringLine(1), /1 série sem janela confiável/);
  assert.match(monitoringLine(37), /37 séries sem janela confiável/);
});
