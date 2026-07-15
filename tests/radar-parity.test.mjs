// Fase C0 — paridade comportamental TS ↔ MJS.
// Transpila lib/forecast.ts e lib/radar-quality.ts (sem type-check, só strip de
// tipos) e roda a MESMA bateria de fixtures nos dois lados, comparando saídas.
// O CI falha se divergirem. Cobre: aceitos/rejeitados, flags temporais,
// duplicidades, ondas, intervalos, warnings, elegibilidade, janela, confiança.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

import * as mjsForecast from "../scripts/forecast-engine.mjs";
import * as mjsQuality from "../scripts/radar-quality.mjs";

// Transpila um .ts para .mjs num diretório temporário, reescrevendo imports
// relativos para .mjs. Retorna o caminho do módulo emitido.
function transpile(dir, name, srcPath) {
  const src = readFileSync(srcPath, "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText.replace(/from\s+["']\.\/forecast["']/g, 'from "./forecast.mjs"');
  const p = join(dir, `${name}.mjs`);
  writeFileSync(p, out);
  return p;
}

async function loadTs() {
  const dir = mkdtempSync(join(tmpdir(), "radar-parity-"));
  transpile(dir, "forecast", "lib/forecast.ts");
  const qPath = transpile(dir, "radar-quality", "lib/radar-quality.ts");
  return import(pathToFileURL(qPath).href);
}

const FIX = [
  { id: "livelo-connectmiles-transferencia-2023-12-12", origem: "livelo", destino: "connectmiles", tipo: "transferencia", percentual: 40, vigencia_inicio: null, vigencia_fim: "2023-12-12", first_seen: "2026-07-12", observed_at: "2026-07-13", origin: "auto", source_url: "https://passageirodeprimeira.com/ultimo-dia-...connectmiles/", notes: "até hoje (12)" },
  { id: "livelo-connectmiles-transferencia-2026-07-12", origem: "livelo", destino: "connectmiles", tipo: "transferencia", percentual: 40, vigencia_inicio: null, vigencia_fim: "2026-07-12", first_seen: "2026-07-10", observed_at: "2026-07-12", origin: "daily", source_url: "https://passageirodeprimeira.com/prorrogado-...connectmiles/", notes: "Prorrogado" },
  { id: "x-y-transferencia-na", origem: "null", destino: "latampass", tipo: "transferencia", percentual: 30, vigencia_fim: "na", first_seen: "2026-07-01" },
  { id: "c6-azul-transferencia-2026-01-01", origem: "c6", destino: "azul", tipo: "transferencia", percentual: 80, vigencia_inicio: "2026-01-01", vigencia_fim: "2026-02-01", first_seen: "2026-01-01" },
];

test("paridade: evaluateTemporalPlausibility idêntico", async () => {
  const tsq = await loadTs();
  for (const c of FIX) {
    const a = mjsQuality.evaluateTemporalPlausibility(c);
    const b = tsq.evaluateTemporalPlausibility(c);
    assert.deepEqual(
      { status: a.status, flags: a.flags, severity: a.severity, includeInPrediction: a.includeInPrediction, requiresReprocessing: a.requiresReprocessing, requiresHumanReview: a.requiresHumanReview, eventDate: a.eventDate, provenanceDate: a.provenanceDate },
      { status: b.status, flags: b.flags, severity: b.severity, includeInPrediction: b.includeInPrediction, requiresReprocessing: b.requiresReprocessing, requiresHumanReview: b.requiresHumanReview, eventDate: b.eventDate, provenanceDate: b.provenanceDate },
      `temporal divergiu para ${c.id}`,
    );
  }
});

test("paridade: detectProbableDuplicates idêntico", async () => {
  const tsq = await loadTs();
  const a = mjsQuality.detectProbableDuplicates(FIX).map((g) => ({ ids: g.campaignIds, s: g.duplicateStatus, sc: g.duplicateScore }));
  const b = tsq.detectProbableDuplicates(FIX).map((g) => ({ ids: g.campaignIds, s: g.duplicateStatus, sc: g.duplicateScore }));
  assert.deepEqual(a, b);
});

test("paridade: containForecast (elegibilidade, ondas, intervalos, janela, confiança)", async () => {
  const tsq = await loadTs();
  const norm = (c) => ({
    counts: c.counts,
    routes: c.routes.map((r) => ({ route: r.forecast.route, samples: r.forecast.samples, intervals: r.forecast.intervals, windowStart: r.forecast.windowStart, confidence: r.forecast.confidence, editorialEligible: r.meta.editorialEligible, blocks: r.meta.editorialBlockReasons, warnings: r.meta.warnings })),
    clusters: c.clusters.map((r) => ({ route: r.forecast.route, samples: r.forecast.samples, editorialEligible: r.meta.editorialEligible })),
  });
  const a = norm(mjsQuality.containForecast(FIX, { now: "2026-07-15" }));
  const b = norm(tsq.containForecast(FIX, { now: "2026-07-15" }));
  assert.deepEqual(a, b);
});

test("paridade: windowDate/normProgram do motor idênticos", async () => {
  const dir = mkdtempSync(join(tmpdir(), "radar-parity-eng-"));
  const p = transpile(dir, "forecast", "lib/forecast.ts");
  const tsEng = await import(pathToFileURL(p).href);
  for (const c of FIX) {
    assert.equal(mjsForecast.windowDate(c), tsEng.windowDate(c), `windowDate ${c.id}`);
    assert.equal(mjsForecast.normProgram(c.origem), tsEng.normProgram(c.origem));
  }
});
