// A1 — regressão de marca (P1.8): nenhuma superfície renderizada pode emitir a
// marca antiga "The Loyalty". O nome próprio é "The Loyal" (CLAUDE.md, topo da
// hierarquia). O QA bloqueia no HTML cru; aqui blindamos o render na fonte.
//
// Golden test do wordmark: além da string crua, checamos o TEXTO VISÍVEL (tags
// removidas). O wordmark é montado como `<span>The </span>Loyal`, então a marca
// aparece dividida entre tags — uma checagem de string crua não enxerga
// "The Loyalty" nesse caso e deixava o leak passar. O de-tag pega.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderWebArchive } from "../scripts/render-web.mjs";
import { renderEmail } from "../renderer/email.mjs";
import { loadEdition, listEditionFiles } from "../scripts/lib.mjs";

// Concatena o texto visível ignorando tags, revelando o wordmark dividido.
const visibleText = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

test("web archive: wordmark, título e h1 fixam 'The Loyal', nunca 'The Loyalty'", () => {
  for (const f of listEditionFiles()) {
    const ed = loadEdition(`content/editions/${f}`);
    const html = renderWebArchive(ed);
    const text = visibleText(html);
    assert.equal(/The Loyalty\b/.test(text), false, `edição ${ed.number}: 'The Loyalty' no texto visível`);
    assert.ok(/The Loyal\b/.test(text), `edição ${ed.number}: wordmark 'The Loyal' ausente`);
    assert.equal(/The Loyalty\b/.test(html), false, `edição ${ed.number}: 'The Loyalty' no HTML cru`);
  }
});

test("email Daily: masthead e título fixam 'The Loyal', nunca 'The Loyalty'", () => {
  const html = renderEmail({});
  const text = visibleText(html);
  assert.equal(/The Loyalty\b/.test(text), false, "email: 'The Loyalty' no texto visível");
  assert.ok(/The Loyal\b/.test(text), "email: wordmark 'The Loyal' ausente");
});

test("Logo.tsx: wordmark do site fixa 'Loyal', nunca 'Loyalty'", () => {
  const src = readFileSync(new URL("../components/Logo.tsx", import.meta.url), "utf8");
  assert.equal(/>\s*Loyalty\s*</.test(src), false, "Logo.tsx: span do wordmark ainda diz 'Loyalty'");
  assert.ok(/>\s*Loyal\s*</.test(src), "Logo.tsx: span do wordmark 'Loyal' ausente");
});
