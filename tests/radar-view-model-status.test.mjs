// Fase P1-A — cobertura complementar do STATUS DE PRODUTO (§10 do prompt /
// §7 do backlog) sobre o view model canônico (lib/radar-view-model.ts). Os
// testes de paridade/943/duplicidade/incompleto/stale/filtros vivem em
// tests/radar-view-model.test.mjs; aqui exercitamos as TRANSIÇÕES de estado
// (opportunity / monitoring / insufficient_history / no_prediction) e a
// linguagem de produto, sempre via linhas cruas passando pelos motores reais
// (nenhum cálculo novo; fixtures, nunca Supabase).
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeRadarViewModel, productStatusLabel, confidenceLabel } from "../lib/radar-view-model.ts";

const NOW = "2026-07-15";
const FRESH = { status: "fresh", generatedAt: `${NOW}T00:00:00Z`, ageHours: 1 };

// Gera `count` campanhas de transferência a cada `step` dias, terminando em
// `lastISO` (mais antiga primeiro). Datas limpas (sem proveniência suspeita).
function seriesEndingAt(origem, destino, count, lastISO, step = 30, pct = 100) {
  const rows = [];
  let t = Date.parse(lastISO + "T00:00:00Z") - (count - 1) * step * 86_400_000;
  for (let i = 0; i < count; i++) {
    const iso = new Date(t).toISOString().slice(0, 10);
    rows.push({ id: `${origem}-${destino}-transferencia-${iso}`, tipo: "transferencia", origem, destino, percentual: pct, vigencia_inicio: iso });
    t += step * 86_400_000;
  }
  return rows;
}
function compose(rows, over = {}) {
  return composeRadarViewModel(rows, {
    now: NOW,
    datasetComplete: over.datasetComplete ?? true,
    pagesRead: 1,
    freshness: over.freshness ?? FRESH,
    opportunityHorizonDays: over.opportunityHorizonDays ?? 90,
  });
}
const route = (vm, key) => vm.series.find((s) => s.seriesKey === key);

// Oportunidade: histórico regular e suficiente (≥5 ondas), Predict pronto,
// confiança ≥ média, próxima janela dentro do horizonte.
test("status · opportunity: série madura e regular com janela iminente", () => {
  const rows = seriesEndingAt("itau", "latampass", 9, "2026-06-25", 30);
  const vm = compose(rows);
  const s = route(vm, "itau→latampass");
  assert.ok(s, "série itau→latampass existe");
  assert.equal(s.editorialEligible, true);
  assert.equal(s.productStatus, "opportunity");
});

// Monitoramento: elegível para o gate editorial (≥5 ondas) mas Predict ainda em
// confiança baixa (amostra < média) → não é oportunidade, mas está válida.
test("status · monitoring: elegível porém confiança baixa", () => {
  const rows = seriesEndingAt("esfera", "azul", 5, "2026-06-20", 30);
  const vm = compose(rows);
  const s = route(vm, "esfera→azul");
  assert.ok(s);
  assert.equal(s.editorialEligible, true);
  assert.equal(s.productStatus, "monitoring");
});

// Histórico insuficiente: 2 campanhas — Predict bloqueia (n<3) e Forecast não
// atinge o gate editorial (<5 ondas).
test("status · insufficient_history: histórico curto", () => {
  const rows = seriesEndingAt("inter", "smiles", 2, "2026-06-20", 30);
  const vm = compose(rows);
  const s = route(vm, "inter→smiles");
  assert.ok(s);
  assert.equal(s.productStatus, "insufficient_history");
});

// Estado vazio: sem campanhas → sem séries e saúde zerada.
test("status · vazio: sem campanhas forma zero séries", () => {
  const vm = compose([]);
  assert.equal(vm.series.length, 0);
  assert.equal(vm.health.campaignsTotal, 0);
  assert.equal(vm.health.seriesTotal, 0);
});

// Ordenação determinística: oportunidades vêm antes de monitoramento; ambas
// depois de estados bloqueados (aqui há uma opp e uma monitoring).
test("status · ordenação coloca oportunidade antes de monitoramento", () => {
  const rows = [
    ...seriesEndingAt("itau", "latampass", 9, "2026-06-25", 30),
    ...seriesEndingAt("esfera", "azul", 5, "2026-06-20", 30),
  ];
  const vm = compose(rows);
  const idxOpp = vm.series.findIndex((s) => s.productStatus === "opportunity");
  const idxMon = vm.series.findIndex((s) => s.productStatus === "monitoring");
  assert.ok(idxOpp >= 0 && idxMon >= 0, "ambos estados presentes");
  assert.ok(idxOpp < idxMon, "oportunidade ordenada antes de monitoramento");
});

// Linguagem de produto: rótulos traduzidos existem para todo status e confiança.
test("linguagem · rótulos de status e confiança traduzidos", () => {
  for (const st of ["opportunity", "monitoring", "insufficient_history", "no_prediction", "review_required", "data_quality_blocked", "duplicate_review", "dataset_incomplete"]) {
    assert.equal(typeof productStatusLabel(st), "string");
    assert.ok(productStatusLabel(st).length > 0);
  }
  assert.equal(confidenceLabel("media"), "média");
  assert.equal(confidenceLabel("insuficiente"), "histórico insuficiente");
  assert.equal(confidenceLabel("em-formacao"), "histórico insuficiente");
});
