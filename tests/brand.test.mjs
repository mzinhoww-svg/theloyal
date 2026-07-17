// A1 — regressão de marca (P1.8): nenhuma superfície renderizada pode emitir a
// marca antiga "The Loyalty". O QA bloqueia; aqui blindamos o render na fonte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderWebArchive } from "../scripts/render-web.mjs";
import { loadEdition, listEditionFiles } from "../scripts/lib.mjs";

test("o web archive não contém 'The Loyalty' (marca antiga)", () => {
  for (const f of listEditionFiles()) {
    const ed = loadEdition(`content/editions/${f}`);
    const html = renderWebArchive(ed);
    assert.equal(/The Loyalty\b/.test(html), false, `edição ${ed.number}: 'The Loyalty' no web archive`);
    assert.ok(/The Loyal\b/.test(html), `edição ${ed.number}: 'The Loyal' ausente`);
  }
});
