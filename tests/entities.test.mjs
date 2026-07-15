// Integridade da camada de memória (RFC-001 §4.3 / M-4): registro canônico de
// Entities e lineage do Pro. Zero dependência. Garante que a memória acumulável
// não nasça inconsistente (chaves duplicadas, tipo inválido, lineage órfão).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const read = (rel) => JSON.parse(readFileSync(new URL(rel, ROOT)));

const ENTITY_TYPES = new Set(["programa-origem", "programa-cia", "banco", "varejo", "canal"]);
const KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

test("entities: registro carrega e tem schemaVersion 1", () => {
  const reg = read("content/entities/index.json");
  assert.equal(reg.schemaVersion, 1);
  assert.ok(Array.isArray(reg.entities) && reg.entities.length > 0);
});

test("entities: chave canônica única, no formato, e tipo válido", () => {
  const { entities } = read("content/entities/index.json");
  const keys = new Set();
  for (const e of entities) {
    assert.ok(KEY_RE.test(e.key), `chave inválida: ${e.key}`);
    assert.ok(!keys.has(e.key), `chave duplicada: ${e.key}`);
    keys.add(e.key);
    assert.ok(e.name, `entidade ${e.key} sem name`);
    assert.ok(ENTITY_TYPES.has(e.type), `tipo inválido em ${e.key}: ${e.type}`);
  }
});

test("entities: aliases não colidem entre entidades distintas", () => {
  const { entities } = read("content/entities/index.json");
  const seen = new Map();
  for (const e of entities) {
    for (const a of e.aliases ?? []) {
      const norm = a.toLowerCase();
      if (seen.has(norm) && seen.get(norm) !== e.key) {
        assert.fail(`alias "${a}" mapeia para ${seen.get(norm)} e ${e.key}`);
      }
      seen.set(norm, e.key);
    }
  }
});

test("lineage do Pro: derivedFrom tem tamanho == sampled (rastreabilidade completa)", () => {
  const pro = read("content/pro/2026-07.json");
  const tsp = pro.tlScorePeriod;
  assert.ok(Array.isArray(tsp.derivedFrom), "tlScorePeriod.derivedFrom ausente");
  assert.equal(tsp.derivedFrom.length, tsp.sampled,
    `lineage (${tsp.derivedFrom.length}) deve cobrir toda a amostra (${tsp.sampled})`);
});

test("lineage do Pro: cada origem aponta uma edição existente do Daily", () => {
  const pro = read("content/pro/2026-07.json");
  const existing = new Set(
    readdirSync(new URL("content/editions/", ROOT))
      .filter((f) => f.endsWith(".json"))
      .map((f) => Number(f.replace(".json", ""))),
  );
  for (const src of pro.tlScorePeriod.derivedFrom) {
    assert.ok(existing.has(src.edition), `edição ${src.edition} do lineage não existe em content/editions/`);
  }
});
