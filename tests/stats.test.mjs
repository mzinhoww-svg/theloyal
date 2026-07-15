// Testes das funções deterministas do VPM observado (scripts/collect/stats.mjs).
// Estas contas NUNCA passam pelo LLM — precisam ser públicas, auditáveis e
// blindadas por teste. Zero dependência: usa node:test + node:assert.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  vpm, median, rejectOutliers, confidenceForSample, band, fmtBRL,
} from "../scripts/collect/stats.mjs";

test("vpm: R$/milheiro = cash / (points/1000)", () => {
  assert.equal(vpm(120, 10000), 12); // 120 / (10000/1000) = 120/10
  assert.equal(vpm(38, 1000), 38);
  assert.equal(vpm(24.9, 1000), 24.9);
});

test("vpm: entradas inválidas ou pontos <= 0 retornam null (nunca chuta)", () => {
  assert.equal(vpm(100, 0), null);
  assert.equal(vpm(100, -5), null);
  assert.equal(vpm(NaN, 1000), null);
  assert.equal(vpm(100, "abc"), null);
  assert.equal(vpm(undefined, 1000), null);
});

test("median: ímpar retorna o do meio, par retorna a média dos centrais", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([5]), 5);
});

test("median: vazio ou só não-finitos retorna null; ignora não-finitos", () => {
  assert.equal(median([]), null);
  assert.equal(median([NaN, Infinity]), null);
  assert.equal(median([2, NaN, 4]), 3);
});

test("rejectOutliers: amostra < 3 mantém tudo", () => {
  const r = rejectOutliers([12, 40]);
  assert.deepEqual(r.kept, [12, 40]);
  assert.deepEqual(r.dropped, []);
});

test("rejectOutliers: descarta outlier real por MAD/z-score", () => {
  const r = rejectOutliers([12, 12, 13, 12, 28]);
  assert.ok(r.dropped.includes(28), "28 é outlier e deve cair");
  assert.ok(!r.kept.includes(28));
});

test("rejectOutliers: valores idênticos não viram outlier (piso de escala)", () => {
  const r = rejectOutliers([5, 5, 5, 5]);
  assert.deepEqual(r.kept, [5, 5, 5, 5]);
  assert.deepEqual(r.dropped, []);
});

test("confidenceForSample: faixas de robustez", () => {
  assert.equal(confidenceForSample(8), "alta");
  assert.equal(confidenceForSample(5), "media");
  assert.equal(confidenceForSample(3), "baixa");
  assert.equal(confidenceForSample(2), "em-formacao");
  assert.equal(confidenceForSample(0), "em-formacao");
});

test("band: piso/mediana/teto sobre amostra limpa + confirmação por minSample", () => {
  const b = band([12, 12, 13, 28]); // 28 cai como outlier → kept [12,12,13]
  assert.equal(b.mediana, 12);
  assert.equal(b.piso, 12);
  assert.equal(b.teto, 13);
  assert.equal(b.sample_n, 3);
  assert.equal(b.outliers_dropped, 1);
  assert.equal(b.confirmed, true); // n >= 3
});

test("band: abaixo do minSample não confirma (downstream trata como n/c)", () => {
  const b = band([12, 13]); // < 3 → não confirmado
  assert.equal(b.confirmed, false);
  assert.equal(b.confidence, "em-formacao");
});

test("fmtBRL: pt-BR com vírgula e sufixo /milheiro; não-finito vira n/c", () => {
  assert.equal(fmtBRL(12), "R$ 12,00 /milheiro");
  assert.equal(fmtBRL(24.9), "R$ 24,90 /milheiro");
  assert.equal(fmtBRL(NaN), "n/c");
  assert.equal(fmtBRL(null), "n/c");
});
