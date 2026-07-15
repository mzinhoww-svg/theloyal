// Trava de convergência da taxonomia de Verdict (RFC-001, Apêndice C / D-2).
// Garante que os dois pipelines derivam da MESMA fonte única e que a divergência
// histórica (Pipeline A com 6 valores, Pipeline B com depende/nao-vale) não volte
// em silêncio. Também audita o enum do schema legado do renderer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CANONICAL_VERDICTS, CANONICAL_VERDICT_KEYS, DEPRECATED_VERDICT_ALIASES, resolveVerdictKey,
} from "../scripts/taxonomy.mjs";
import { VERDICTS } from "../scripts/lib.mjs";
import { VERDICT, verdict } from "../renderer/tokens.mjs";

test("fonte única: 6 vereditos canônicos, chaves estáveis", () => {
  assert.equal(CANONICAL_VERDICTS.length, 6);
  assert.deepEqual([...CANONICAL_VERDICT_KEYS].sort(), [
    "casos-especificos", "esperaria", "evitaria",
    "nao-confirmado", "vale-agir", "vale-olhar",
  ]);
});

test("Pipeline A (lib.mjs VERDICTS) deriva exatamente da fonte única", () => {
  assert.deepEqual(Object.keys(VERDICTS).sort(), [...CANONICAL_VERDICT_KEYS].sort());
  for (const v of CANONICAL_VERDICTS) {
    assert.equal(VERDICTS[v.key].label, v.label, `label de ${v.key}`);
    assert.equal(VERDICTS[v.key].min, v.min);
    assert.equal(VERDICTS[v.key].max, v.max);
  }
});

test("Pipeline B (renderer VERDICT) reconhece toda a taxonomia canônica", () => {
  for (const key of CANONICAL_VERDICT_KEYS) {
    assert.ok(VERDICT[key], `renderer não reconhece verdict canônico "${key}"`);
  }
});

test("aliases deprecados resolvem para o canônico correto e mantêm a família", () => {
  for (const [legacy, target] of Object.entries(DEPRECATED_VERDICT_ALIASES)) {
    assert.equal(resolveVerdictKey(legacy), target);
    // No renderer, o alias herda rótulo/família do alvo canônico.
    assert.equal(VERDICT[legacy].family, VERDICT[target].family, `família de ${legacy}`);
    assert.equal(verdict(legacy).label, verdict(target).label, `rótulo de ${legacy}`);
    assert.equal(VERDICT[legacy].deprecated, true, `${legacy} deve ser marcado deprecated`);
  }
});

test("vale-olhar é azul (família blue), não verde (correção do Apêndice C)", () => {
  assert.equal(VERDICT["vale-olhar"].family, "blue");
});

test("enum do schema legado ⊆ canônico ∪ deprecados (sem token órfão)", () => {
  const schema = JSON.parse(readFileSync(new URL("../renderer/edition.schema.json", import.meta.url)));
  // Localiza o enum de veredito (deal_desk[].veredito).
  const enumStr = JSON.stringify(schema);
  const permitido = new Set([...CANONICAL_VERDICT_KEYS, ...Object.keys(DEPRECATED_VERDICT_ALIASES)]);
  // Extrai o array de enum que contém "vale-agir".
  const m = enumStr.match(/\["vale-agir"[^\]]*\]/);
  assert.ok(m, "enum de veredito não encontrado no schema");
  const tokens = JSON.parse(m[0]);
  for (const t of tokens) {
    assert.ok(permitido.has(t), `token "${t}" no schema não é canônico nem alias deprecado`);
  }
});
