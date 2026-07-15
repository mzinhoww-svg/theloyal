// A2 / P2.13b — validação de schema em runtime (ajv). O contrato
// content/*.schema.json passa a ser aplicado; um campo fora do contrato bloqueia.
import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaErrors } from "../scripts/lib/schema.mjs";
import { loadEdition, listEditionFiles } from "../scripts/lib.mjs";

test("todas as edições atuais satisfazem o edition.schema", () => {
  for (const f of listEditionFiles()) {
    const ed = loadEdition(`content/editions/${f}`);
    assert.deepEqual(schemaErrors("edition", ed), [], `edição ${f} fora do contrato`);
  }
});

test("campo fora do contrato (additionalProperties) é reprovado", () => {
  const ed = loadEdition(`content/editions/${listEditionFiles()[0]}`);
  const bad = { ...ed, campoInventado: 123 };
  const errs = schemaErrors("edition", bad);
  assert.ok(errs.length > 0);
  assert.ok(errs.some((m) => /fora do contrato|campoInventado/.test(m)));
});

test("tipo errado num campo é reprovado", () => {
  const ed = loadEdition(`content/editions/${listEditionFiles()[0]}`);
  const bad = { ...ed, number: "não é inteiro" };
  const errs = schemaErrors("edition", bad);
  assert.ok(errs.length > 0);
});

test("schema desconhecido/ausente ⇒ [] (best-effort, não bloqueia)", () => {
  assert.deepEqual(schemaErrors("inexistente", { qualquer: true }), []);
});
