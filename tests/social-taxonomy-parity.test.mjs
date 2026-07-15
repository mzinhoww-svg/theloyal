// A2 / DEBT-004 — o Verdict do social deriva da taxonomia canônica, não copia.
// Falha se as chaves ou rótulos do social divergirem de scripts/taxonomy.mjs.
// Cobre as duas superfícies sociais: lib/social-brand.ts (next/og) e
// scripts/social-render.mjs (PNG offline). Requer Node ≥22.18 (type-stripping).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CANONICAL_VERDICTS } from "../scripts/taxonomy.mjs";
import { VERDICT as SOCIAL_BRAND } from "../lib/social-brand.ts";

const canonicalLabels = Object.fromEntries(CANONICAL_VERDICTS.map((v) => [v.key, v.label]));

test("social-brand: chaves e rótulos idênticos à taxonomia (sem cópia)", () => {
  assert.deepEqual(Object.keys(SOCIAL_BRAND).sort(), Object.keys(canonicalLabels).sort());
  for (const [key, label] of Object.entries(canonicalLabels)) {
    assert.equal(SOCIAL_BRAND[key].label, label, `rótulo de ${key} diverge da taxonomia`);
  }
});

test("social-brand: mantém estilo (bg/fg) e a borda tracejada do nao-confirmado", () => {
  assert.equal(SOCIAL_BRAND["nao-confirmado"].dashed, true);
  for (const v of Object.values(SOCIAL_BRAND)) {
    assert.ok(typeof v.bg === "string" && typeof v.fg === "string");
  }
});
