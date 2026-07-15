// Fase P1-C — testes de filas, alertas, resumo operacional e "o que mudou".
// Puro, sem I/O; importa os módulos .ts (type-strip nativo).
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeRadarViewModel } from "../lib/radar-view-model.ts";
import {
  buildRadarQueues,
  seriesQueueMembership,
  buildOperationalAlerts,
  operationalSummary,
  radarChangeEvents,
  CHANGE_UNAVAILABLE,
} from "../lib/radar-operations.ts";

const NOW = "2026-07-15";
const FRESH = { status: "fresh", generatedAt: "2026-07-15T06:00:00Z", ageHours: 6 };

function healthy() {
  const dates = ["2026-02-05", "2026-03-05", "2026-04-05", "2026-05-05", "2026-06-05", "2026-07-05"];
  return dates.map((d) => ({
    id: `livelo-smiles-transferencia-${d}`, tipo: "transferencia", origem: "livelo", destino: "smiles",
    percentual: 30, vigencia_inicio: d, vigencia_fim: d, first_seen: d, observed_at: d, created_at: `${d}T12:00:00Z`,
  }));
}
const CONNECT_A = {
  id: "livelo-connectmiles-transferencia-2023-12-12", tipo: "transferencia", origem: "livelo", destino: "connectmiles", percentual: 40,
  vigencia_inicio: null, vigencia_fim: "2023-12-12", first_seen: "2026-07-12", observed_at: "2026-07-13", created_at: "2026-07-13T16:48:00Z",
  source_url: "https://passageirodeprimeira.com/ultimo-dia/",
};
const CONNECT_B = {
  id: "livelo-connectmiles-transferencia-2026-07-12", tipo: "transferencia", origem: "livelo", destino: "connectmiles", percentual: 40,
  vigencia_inicio: null, vigencia_fim: "2026-07-12", first_seen: "2026-07-10", observed_at: "2026-07-12", created_at: "2026-07-11T04:47:00Z",
  source_url: "https://passageirodeprimeira.com/prorrogado/",
};
const PLACEHOLDER = { id: "desconhecido-latampass-transferencia-2026-06-01", tipo: "transferencia", origem: "desconhecido", destino: "latampass", percentual: 30, vigencia_fim: "2026-06-01", first_seen: "2026-05-25" };
const ROWS = [...healthy(), CONNECT_A, CONNECT_B, PLACEHOLDER];

const vm = (over = {}) => composeRadarViewModel(ROWS, { now: NOW, datasetComplete: true, pagesRead: 1, freshness: FRESH, ...over });
const q = (queues, key) => queues.find((x) => x.key === key);
const hasSeries = (queue, key) => queue.items.some((s) => s.seriesKey === key);

test("filas: 8 filas nomeadas com critério/ação/vazio", () => {
  const queues = buildRadarQueues(vm());
  assert.equal(queues.length, 8);
  for (const k of ["opportunities", "review", "blocked", "suspects", "duplicates", "insufficient", "stale", "no_prediction"]) {
    const item = q(queues, k);
    assert.ok(item, `fila ${k} existe`);
    assert.ok(item.criterion && item.action && item.emptyMessage, `fila ${k} tem textos`);
  }
});

test("oportunidades: só elegíveis e productStatus=opportunity", () => {
  const opp = q(buildRadarQueues(vm()), "opportunities");
  assert.ok(opp.items.every((s) => s.productStatus === "opportunity" && s.editorialEligible));
});

test("bloqueadas/suspeitas/duplicidades/sem-previsão contêm connectmiles", () => {
  const queues = buildRadarQueues(vm());
  assert.ok(hasSeries(q(queues, "blocked"), "livelo→connectmiles"));
  assert.ok(hasSeries(q(queues, "suspects"), "livelo→connectmiles"));
  assert.ok(hasSeries(q(queues, "duplicates"), "livelo→connectmiles"));
  assert.ok(hasSeries(q(queues, "no_prediction"), "livelo→connectmiles"));
  // review não contém a série bloqueada por dado crítico.
  assert.ok(!hasSeries(q(queues, "review"), "livelo→connectmiles"));
});

test("sobreposição de filas é explícita (membership > 1 para connectmiles)", () => {
  const model = vm();
  const s = model.series.find((x) => x.seriesKey === "livelo→connectmiles" && x.scope === "route");
  const member = seriesQueueMembership(model, s);
  assert.ok(member.length >= 3, `connectmiles em ${member.length} filas`);
  assert.ok(member.includes("blocked") && member.includes("suspects") && member.includes("duplicates"));
});

test("stale: fila vazia quando fresco; contém todas quando não fresco", () => {
  assert.equal(q(buildRadarQueues(vm()), "stale").items.length, 0);
  const staleVm = vm({ freshness: { status: "stale", generatedAt: "2026-07-10T06:00:00Z", ageHours: 120 } });
  const staleQ = q(buildRadarQueues(staleVm), "stale");
  assert.equal(staleQ.items.length, staleVm.series.length);
});

test("alertas: temporal crítico e duplicidade; dataset/frescor só quando aplicável", () => {
  const alerts = buildOperationalAlerts(vm());
  assert.ok(alerts.find((a) => a.id === "temporal" && a.severity === "critical"));
  assert.ok(alerts.find((a) => a.id === "duplicates" && a.severity === "warning"));
  assert.ok(!alerts.find((a) => a.id === "dataset_incomplete"));
  assert.ok(!alerts.find((a) => a.id === "stale"));
  // Cada alerta tem escopo, impacto, quantidade, ação e link.
  for (const a of alerts) {
    assert.ok(a.impact && a.action && a.diagnosticHref && (a.scope === "global" || a.scope === "series"));
    assert.ok(Number.isFinite(a.affected));
  }
});

test("alertas: dataset incompleto vira alerta global crítico", () => {
  const alerts = buildOperationalAlerts(vm({ datasetComplete: false }));
  const d = alerts.find((a) => a.id === "dataset_incomplete");
  assert.ok(d && d.severity === "critical" && d.scope === "global");
});

test("resumo operacional: não saudável com dado crítico; risco e ação corretos", () => {
  const s = operationalSummary(vm());
  assert.equal(s.healthy, false);
  assert.equal(s.mainRisk, "Campanhas temporalmente suspeitas");
  assert.match(s.priorityAction, /Auditar/);
  assert.ok(s.blocked >= 1);
  assert.match(s.text, /temporalmente suspeitas/i);
});

test("resumo operacional: base incompleta é o risco dominante", () => {
  const s = operationalSummary(vm({ datasetComplete: false }));
  assert.equal(s.mainRisk, "Base incompleta");
  assert.match(s.priorityAction, /ledger/);
});

test("o que mudou: só observável agora; resto exige snapshot", () => {
  const { available, unavailable } = radarChangeEvents(vm());
  const types = available.map((e) => e.type);
  assert.ok(types.includes("temporal_issue_detected"));
  assert.ok(types.includes("probable_duplicate_detected"));
  assert.ok(types.includes("campaign_excluded_now"));
  // Eventos globais só quando aplicável.
  assert.ok(!types.includes("dataset_incomplete"));
  assert.ok(!types.includes("forecast_stale"));
  // Lista do que depende de snapshot é a fixa (não inventa histórico).
  assert.deepEqual(unavailable, CHANGE_UNAVAILABLE);
  assert.ok(unavailable.length === 6);
});

test("o que mudou: dataset incompleto e stale viram eventos globais", () => {
  const { available } = radarChangeEvents(vm({ datasetComplete: false, freshness: { status: "stale", generatedAt: "2026-07-10T06:00:00Z" } }));
  const globals = available.filter((e) => e.scope === "global").map((e) => e.type);
  assert.ok(globals.includes("dataset_incomplete"));
  assert.ok(globals.includes("forecast_stale"));
});
