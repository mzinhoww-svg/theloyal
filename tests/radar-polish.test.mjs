// Fase P1-E (polish) — testes dos ajustes M1, M2, M3, B1, B2, B3.
// Puro, sem I/O; importa os módulos .ts (type-strip nativo).
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeRadarViewModel } from "../lib/radar-view-model.ts";
import { resolveRadarView, buildOperationalAlerts, operationalSummary } from "../lib/radar-operations.ts";
import { applyRadarFilters, seriesCauses, deriveFilterFacets, CAUSE_LABEL } from "../lib/radar-filters.ts";
import { RADAR_EMPTY, resolveRadarLoadError } from "../lib/radar-empty.ts";
import { RADAR_OVERVIEW_OUTLINE, RADAR_H } from "../lib/radar-headings.ts";

const NOW = "2026-07-15";
const FRESH = { status: "fresh", generatedAt: "2026-07-15T06:00:00Z", ageHours: 6 };

function monthly(origem, destino, pct, dates) {
  return dates.map((d) => ({
    id: `${origem}-${destino}-transferencia-${d}`, tipo: "transferencia", origem, destino,
    percentual: pct, vigencia_inicio: d, vigencia_fim: d, first_seen: d, observed_at: d, created_at: `${d}T12:00:00Z`,
  }));
}
const SMILES = monthly("livelo", "smiles", 30, ["2026-02-05", "2026-03-05", "2026-04-05", "2026-05-05", "2026-06-05", "2026-07-05"]);
const LATAM = monthly("livelo", "latampass", 40, ["2026-02-10", "2026-03-10", "2026-04-10", "2026-05-10", "2026-06-10", "2026-07-10"]);
// Placeholder no MESMO destino (latampass) → o cluster →latampass herda placeholder.
const PLACEHOLDER = { id: "desconhecido-latampass-transferencia-2026-06-01", tipo: "transferencia", origem: "desconhecido", destino: "latampass", percentual: 30, vigencia_fim: "2026-06-01", first_seen: "2026-05-25" };
const ROWS = [...SMILES, ...LATAM, PLACEHOLDER];
const vm = (over = {}) => composeRadarViewModel(ROWS, { now: NOW, datasetComplete: true, pagesRead: 1, freshness: FRESH, ...over });

// ---- M1 — view inválido ----
test("M1 resolveRadarView: válido / inválido / ausente / vazio", () => {
  assert.deepEqual(resolveRadarView("oportunidades"), { view: "oportunidades", invalid: false });
  assert.deepEqual(resolveRadarView("bloqueios"), { view: "bloqueios", invalid: false });
  assert.deepEqual(resolveRadarView("geral"), { view: "geral", invalid: false });
  assert.deepEqual(resolveRadarView("opportunities"), { view: "geral", invalid: true }); // en → inválido, cai em geral
  assert.deepEqual(resolveRadarView("xyz"), { view: "geral", invalid: true });
  assert.deepEqual(resolveRadarView(""), { view: "geral", invalid: false });
  assert.deepEqual(resolveRadarView(undefined), { view: "geral", invalid: false });
});

test("M1 filtros são independentes da view (não afetados pela normalização)", () => {
  // resolveRadarView só resolve a view; a página lê os filtros por separado.
  const r = resolveRadarView("opportunities");
  assert.equal(Object.keys(r).length, 2);
  assert.ok("view" in r && "invalid" in r);
});

// ---- M2 — placeholders isolados por filtro/cause ----
test("M2 cause=placeholder isola séries afetadas por placeholder", () => {
  const model = vm();
  const cluster = model.series.find((s) => s.seriesKey === "→latampass");
  assert.ok(cluster && cluster.quality.placeholder >= 1, "cluster →latampass herda placeholder");
  assert.ok(seriesCauses(cluster).includes("placeholder"));
  const filtered = applyRadarFilters(model.series, { cause: "placeholder" });
  assert.ok(filtered.length >= 1);
  assert.ok(filtered.every((s) => s.quality.placeholder > 0), "só séries com placeholder");
  // A faceta e o rótulo existem para o filtro aparecer na UI.
  assert.ok(deriveFilterFacets(model.series).causes.includes("placeholder"));
  assert.equal(CAUSE_LABEL.placeholder, "programa inválido (placeholder)");
});

test("M2 link do alerta de placeholders aponta para o filtro correto", () => {
  // Fixture com placeholder mas cujo destino tem série → gera o alerta.
  const alerts = buildOperationalAlerts(vm());
  const a = alerts.find((x) => x.id === "placeholders");
  assert.ok(a, "alerta de placeholders presente");
  assert.equal(a.diagnosticHref, "/admin/radar?cause=placeholder");
});

// ---- M3 — headings ----
test("M3 outline da visão geral: um h1, resto h2, textos únicos", () => {
  const h1 = RADAR_OVERVIEW_OUTLINE.filter((h) => h.level === 1);
  assert.equal(h1.length, 1, "exatamente um h1");
  assert.equal(h1[0].text, RADAR_H.page);
  assert.ok(RADAR_OVERVIEW_OUTLINE.slice(1).every((h) => h.level === 2), "demais são h2");
  const texts = RADAR_OVERVIEW_OUTLINE.map((h) => h.text);
  assert.equal(new Set(texts).size, texts.length, "textos únicos");
  assert.ok(texts.every((t) => t && t.length > 0), "sem heading vazio");
  for (const k of ["resumo", "saude", "indicadores", "filtros", "series"]) {
    assert.ok(texts.includes(RADAR_H[k]), `seção ${k} no outline`);
  }
});

// ---- B1 — load_error acionável ----
test("B1 resolveRadarLoadError: estado padronizado, sem stack, com diagnóstico", () => {
  const e = resolveRadarLoadError();
  assert.equal(e, RADAR_EMPTY.load_error);
  assert.ok(e.title && e.description && e.impact && e.action);
  assert.equal(e.diagnosticHref, "/admin/logs");
  // Não é mascarado como "sem dados": título fala em falha, não em vazio.
  assert.match(e.title, /Falha/i);
  // Nunca carrega mensagem crua/stack.
  for (const v of [e.title, e.description, e.impact, e.action]) assert.ok(!/\bat \w+ \(/.test(v));
});

// ---- B2 — nenhum resultado via catálogo ----
test("B2 no_filter_results vem do catálogo com título/descrição/ação", () => {
  const e = RADAR_EMPTY.no_filter_results;
  assert.match(e.title, /Nenhum resultado/i);
  assert.ok(e.description.length > 0);
  assert.match(e.action, /filtro/i);
});

// ---- B3 — resumo compacto × completo ----
test("B3 resumo tem núcleo compacto e extras completos (superfícies distintas)", () => {
  const s = operationalSummary(vm());
  // Núcleo (visão geral compacta): risco + contagens.
  for (const k of ["mainRisk", "ready", "needAttention", "blocked"]) assert.ok(k in s);
  // Extras (só na operação completa): ação prioritária + frase.
  assert.ok(s.priorityAction && s.priorityAction.length > 0);
  assert.ok(s.text && s.text.length > 0);
});

// ---- Regressão ----
test("regressão: filtros e filas seguem coerentes após o polish", () => {
  const model = vm();
  assert.ok(applyRadarFilters(model.series, { scope: "cluster" }).every((s) => s.scope === "cluster"));
  assert.ok(applyRadarFilters(model.series, { status: "opportunity" }).every((s) => s.productStatus === "opportunity"));
  // séries continuam sendo formadas (smiles + latampass, rota + cluster).
  assert.ok(model.series.some((s) => s.seriesKey === "livelo→smiles"));
  assert.ok(model.series.some((s) => s.seriesKey === "livelo→latampass"));
});
