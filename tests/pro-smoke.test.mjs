// Guarda contra a regressão do `strings is not defined` (bug do #74 que o CI não
// pegava, pois o editorial-gate não roda `npm run pro`). Blinda o validatePro.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validatePro } from "../scripts/pro.mjs";

test("validatePro roda sem lançar e aprova o relatório atual", () => {
  const r = JSON.parse(readFileSync("content/pro/2026-07.json", "utf8"));
  let res;
  assert.doesNotThrow(() => { res = validatePro(r); });
  assert.equal(res.errors.length, 0, `erros: ${res.errors.join("; ")}`);
});
