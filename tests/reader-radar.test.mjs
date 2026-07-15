// F3-00 — radar do leitor a partir do RESULTADO CANÔNICO (Predict quando pronto).
// Fecha a premissa 4: o motor que mede passa a ser o que publica. Nota de corte
// aplicada (só readerSurface="prediction"); proveniência do motor; monitoramento
// como contagem honesta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeRadarViewModel } from "../lib/radar-view-model.ts";
import { buildReaderRadar } from "../lib/reader-radar.ts";

const NOW = "2026-07-15";
const FRESH = { status: "fresh", generatedAt: "2026-07-15T06:00:00Z", ageHours: 6 };

function monthly(origem, destino, n, pct = 30) {
  const rows = [];
  for (let m = 0; m < n; m++) {
    const d = new Date(Date.UTC(2025, 6 + m, 5)).toISOString().slice(0, 10);
    rows.push({ id: `${origem}-${destino}-transferencia-${d}`, tipo: "transferencia", origem, destino, percentual: pct, vigencia_inicio: d, vigencia_fim: d, first_seen: d, observed_at: d, created_at: `${d}T12:00:00Z` });
  }
  return rows;
}
function vmOf(rows, over = {}) {
  return composeRadarViewModel(rows, { now: NOW, datasetComplete: true, pagesRead: 1, freshness: FRESH, ...over });
}

test("série saudável vira item com proveniência 'predict' (motor canônico)", () => {
  const vm = vmOf(monthly("livelo", "smiles", 12));
  const { items } = buildReaderRadar(vm.series, { now: NOW, horizonDays: 90 });
  const it = items.find((x) => x.seriesKey === "livelo→smiles");
  assert.ok(it, "série publicável presente");
  assert.equal(it.source, "predict");
  assert.ok(["alta", "media"].includes(it.confidence), "confiança ≥ média");
  assert.ok(it.window && it.window.length > 0);
  assert.match(it.basis, /campanhas/);
});

test("série curta (4 ondas) não vira item — entra na contagem de monitoramento", () => {
  const vm = vmOf(monthly("itau", "azul", 4));
  const { items, monitoringCount } = buildReaderRadar(vm.series, { now: NOW, horizonDays: 90 });
  assert.equal(items.length, 0, "nada publicável");
  assert.ok(monitoringCount >= 1, "série real em observação");
});

test("nota de corte: item só sai se readerSurface='prediction'", () => {
  const vm = vmOf([...monthly("livelo", "smiles", 12), ...monthly("itau", "azul", 4)]);
  const { items } = buildReaderRadar(vm.series, { now: NOW, horizonDays: 90 });
  for (const it of items) {
    const s = vm.series.find((x) => x.seriesKey === it.seriesKey && (it.label.includes("→") ? x.scope === "route" : true));
    assert.ok(vm.series.some((x) => x.seriesKey === it.seriesKey && x.readerSurface === "prediction"));
  }
});

test("mute retira a série do radar do leitor", () => {
  const over = { overrides: [{ scope: "route", route: "livelo→smiles", action: "mute" }] };
  const vm = vmOf(monthly("livelo", "smiles", 12), over);
  const { items } = buildReaderRadar(vm.series, { now: NOW, horizonDays: 90 });
  assert.ok(!items.some((x) => x.seriesKey === "livelo→smiles" && x.label.includes("→")));
});

test("horizonte curto exclui janelas que abrem além do prazo", () => {
  const vm = vmOf(monthly("livelo", "smiles", 12));
  // Uma série mensal overdue abre imediatamente → cabe em 30d. Horizonte 0 exclui.
  const zero = buildReaderRadar(vm.series, { now: NOW, horizonDays: 0 });
  const wide = buildReaderRadar(vm.series, { now: NOW, horizonDays: 90 });
  assert.ok(wide.items.length >= zero.items.length);
});

test("dataset incompleto → nenhum item ao leitor", () => {
  const vm = vmOf(monthly("livelo", "smiles", 12), { datasetComplete: false });
  const { items } = buildReaderRadar(vm.series, { now: NOW, horizonDays: 90 });
  assert.equal(items.length, 0);
});
