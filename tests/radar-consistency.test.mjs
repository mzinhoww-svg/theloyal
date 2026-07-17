// Testes da contenção de Radar contraditório no Daily (Fase C0).
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRadarConsistency } from "../scripts/validate.mjs";

const artifact = {
  digest: {
    radarDaily: [{ label: "Latam Pass", window: "17 a 24 jul", bonus: "~20%", confidence: "media" }],
  },
};

const ed = (windows) => ({ number: 99, radar: { windows } });

test("radar: janela automática que bate com o forecast → sem erro", () => {
  const r = validateRadarConsistency(ed([{ label: "Latam Pass", window: "17 a 24 jul", source: "forecast" }]), artifact);
  assert.equal(r.errors.length, 0);
});

test("radar: janela automática com janela divergente → erro", () => {
  const r = validateRadarConsistency(ed([{ label: "Latam Pass", window: "1 a 8 ago", source: "forecast" }]), artifact);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /diverge do forecast automático/);
});

test("radar: janela automática com bônus divergente → erro", () => {
  const r = validateRadarConsistency(
    ed([{ label: "Latam Pass", window: "17 a 24 jul", bonus: "~40%", source: "forecast" }]),
    artifact,
  );
  assert.ok(r.errors.some((e) => /bônus/.test(e)));
});

test("radar: janela automática ausente do forecast → erro", () => {
  const r = validateRadarConsistency(ed([{ label: "Smiles", window: "10 a 20 ago", source: "forecast" }]), artifact);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /não está no forecast atual/);
});

test("nota de corte: janela automática 'baixa' → erro (abaixo de média)", () => {
  const r = validateRadarConsistency(ed([{ label: "Latam Pass", window: "17 a 24 jul", source: "forecast", confidence: "baixa" }]), artifact);
  assert.ok(r.errors.some((e) => /abaixo da nota de corte/.test(e)));
});

test("nota de corte: janela editorial 'baixa' → apenas aviso (vira monitoramento)", () => {
  const r = validateRadarConsistency(ed([{ label: "Esfera", window: "17 a 24 jul", confidence: "baixa" }]), artifact);
  assert.ok(!r.errors.some((e) => /nota de corte/.test(e)));
  assert.ok(r.warnings.some((e) => /abaixo da nota de corte/.test(e)));
});

test("nota de corte: janela 'media' automática não dispara o corte", () => {
  const r = validateRadarConsistency(ed([{ label: "Latam Pass", window: "17 a 24 jul", source: "forecast", confidence: "media" }]), artifact);
  assert.ok(!r.errors.some((e) => /nota de corte/.test(e)));
});

test("radar: manual (sem proveniência) divergente → apenas AVISO, nunca erro", () => {
  const r = validateRadarConsistency(ed([{ label: "Latam Pass", window: "1 a 8 ago" }]), artifact);
  assert.equal(r.errors.length, 0);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /Análise editorial|análise editorial/);
});

test("radar: manual sem match → aviso de proveniência, sem erro", () => {
  const r = validateRadarConsistency(ed([{ label: "Esfera", window: "5 a 12 set" }]), artifact);
  assert.equal(r.errors.length, 0);
  assert.match(r.warnings[0], /sem proveniência/);
});

test("radar: edição sem radar → vazio", () => {
  const r = validateRadarConsistency({ number: 1 }, artifact);
  assert.deepEqual(r, { errors: [], warnings: [] });
});

test("radar: sem artefato de forecast → automática vira erro (não pode verificar)", () => {
  const r = validateRadarConsistency(ed([{ label: "Latam Pass", window: "17 a 24 jul", source: "forecast" }]), null);
  assert.equal(r.errors.length, 1);
});
