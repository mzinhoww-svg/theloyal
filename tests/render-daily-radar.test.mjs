// A3 — radar do Daily auto-injetado do forecast (mesmo gate C0 do Weekly).
// Cobre o override manual e a segurança contra número stale.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDailyRadar } from "../scripts/render.mjs";

test("resolveDailyRadar: override manual do JSON tem prioridade", () => {
  const ed = { radar: { note: "n", windows: [{ label: "Latam", confidence: "baixa", window: "17 jul a 10 ago" }] } };
  const r = resolveDailyRadar(ed);
  assert.equal(r.windows.length, 1);
  assert.equal(r.windows[0].label, "Latam");
});

test("resolveDailyRadar: sem radar + forecast stale/vazio ⇒ null (nunca stale em silêncio)", () => {
  // content/forecast.json real está stale (>24h) e/ou com radarDaily vazio.
  const r = resolveDailyRadar({ number: 27 });
  assert.equal(r, null);
});
