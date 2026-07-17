// Testes do motor de previsão (Fase C0). Cobrem o comportamento ATUAL de
// windowDate / collapseWaves / formação de séries e os NOVOS gates de contenção
// (amostra editorial, intervalo extremo, horizonte). Importa o espelho ESM
// scripts/forecast-engine.mjs (a paridade com lib/forecast.ts é garantida por
// tests/forecast-parity.test.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  windowDate,
  collapseWaves,
  normProgram,
  buildForecast,
  radarItems,
  upcomingWindows,
  editorialGate,
  resolveConfig,
  DEFAULT_FORECAST_CONFIG,
} from "../scripts/forecast-engine.mjs";

const NOW = "2026-07-15";
const cfg = resolveConfig();

// Helper: linha de campanha de transferência ancorada em vigencia_inicio.
const tf = (origem, destino, date, percentual = 20, extra = {}) => ({
  id: `${origem}-${destino}-transferencia-${date}`,
  tipo: "transferencia",
  origem,
  destino,
  percentual,
  vigencia_inicio: date,
  ...extra,
});

// ---------------------------------------------------------------- windowDate
test("windowDate: usa vigencia_inicio válida como primeira opção", () => {
  assert.equal(windowDate({ vigencia_inicio: "2026-01-02" }), "2026-01-02");
});
test("windowDate: prioriza vigencia_inicio sobre a data no id", () => {
  assert.equal(windowDate({ id: "x-2020-01-01", vigencia_inicio: "2026-02-02" }), "2026-02-02");
});
test("windowDate: usa a data no final do id quando não há início", () => {
  assert.equal(windowDate({ id: "livelo-smiles-transferencia-2026-03-04" }), "2026-03-04");
});
test("windowDate: usa vigencia_fim válida como fallback", () => {
  assert.equal(windowDate({ id: "sem-data", vigencia_fim: "2026-05-06" }), "2026-05-06");
});
test("windowDate: retorna null para vigencia_fim='na'", () => {
  assert.equal(windowDate({ id: "esfera-connectmiles-transferencia-na", vigencia_fim: "na" }), null);
});
test("windowDate: retorna null para data inválida", () => {
  assert.equal(windowDate({ id: "sem-data", vigencia_inicio: "31/02/2026" }), null);
});
test("windowDate: não usa observed_at", () => {
  assert.equal(windowDate({ id: "sem-data", observed_at: "2026-01-01" }), null);
});
test("windowDate: não usa first_seen", () => {
  assert.equal(windowDate({ id: "sem-data", first_seen: "2026-01-01" }), null);
});

// -------------------------------------------------------------- collapseWaves
test("collapseWaves: datas iguais formam uma onda", () => {
  assert.deepEqual(collapseWaves(["2026-01-01", "2026-01-01"], 3), ["2026-01-01"]);
});
test("collapseWaves: distância ≤ epsilon forma uma onda (âncora = mais antiga)", () => {
  assert.deepEqual(collapseWaves(["2026-01-01", "2026-01-03"], 3), ["2026-01-01"]);
});
test("collapseWaves: distância > epsilon fica separada", () => {
  assert.deepEqual(collapseWaves(["2026-01-01", "2026-01-05"], 3), ["2026-01-01", "2026-01-05"]);
});
test("collapseWaves: mantém a data mais antiga como âncora", () => {
  assert.deepEqual(collapseWaves(["2026-01-01", "2026-01-02"], 3), ["2026-01-01"]);
});
test("collapseWaves: duplicatas não geram ondas duplicadas", () => {
  assert.deepEqual(collapseWaves(["2026-01-01", "2026-01-01", "2026-01-10"], 3), ["2026-01-01", "2026-01-10"]);
});

// ------------------------------------------------------------ formação de série
test("série: campanha sem data fica fora", () => {
  const rows = [
    { id: "a-b-transferencia-na", tipo: "transferencia", origem: "a", destino: "b", vigencia_fim: "na" },
    tf("a", "b", "2026-01-01"),
  ];
  const fc = buildForecast(rows, { now: NOW, config: cfg });
  const r = fc.routes.find((x) => x.route === "a→b");
  assert.equal(r.samples, 1); // só a campanha com data
});
test("série: tipo diferente de transferência fica fora", () => {
  const rows = [
    { id: "a-b-compra-2026-01-01", tipo: "compra", origem: "a", destino: "b", vigencia_inicio: "2026-01-01" },
  ];
  const fc = buildForecast(rows, { now: NOW, config: cfg });
  assert.equal(fc.routes.length, 0);
  assert.equal(fc.clusters.length, 0);
});
test("série: alias conhecido é normalizado (latam pass → latampass)", () => {
  assert.equal(normProgram("Latam Pass"), "latampass");
  const rows = [tf("Livelo", "Latam Pass", "2026-01-01"), tf("livelo", "latampass", "2026-02-01")];
  const fc = buildForecast(rows, { now: NOW, config: cfg });
  assert.ok(fc.routes.some((r) => r.route === "livelo→latampass"));
});
test("série: rota e cluster são formados separadamente; cluster nunca vira rota", () => {
  const rows = [tf("livelo", "connectmiles", "2024-01-01"), tf("esfera", "connectmiles", "2024-03-01")];
  const fc = buildForecast(rows, { now: NOW, config: cfg });
  assert.ok(fc.routes.every((r) => r.origem !== null && r.route.includes("→") && !r.route.startsWith("→")));
  assert.ok(fc.clusters.every((c) => c.origem === null && c.route.startsWith("→")));
});
test("série: ordem de entrada não altera as ondas", () => {
  const a = buildForecast([tf("a", "b", "2026-01-01"), tf("a", "b", "2026-02-01")], { now: NOW, config: cfg });
  const b = buildForecast([tf("a", "b", "2026-02-01"), tf("a", "b", "2026-01-01")], { now: NOW, config: cfg });
  assert.deepEqual(a.routes[0].windows, b.routes[0].windows);
});

// --------------------------------------------------------- editorialGate puro
test("gate: 1 onda não é elegível (em-formação, abaixo do mínimo interno)", () => {
  // amostra tratada em buildForecast; aqui o gate com 1 intervalo/2 ondas etc.
  const g1 = editorialGate(1, [], 30, cfg);
  assert.equal(g1.editorialEligible, false);
});
test("gate: 2 ondas (1 intervalo) não são elegíveis para publicação", () => {
  const g = editorialGate(2, [30], 30, cfg);
  assert.equal(g.editorialEligible, false);
  assert.match(g.editorialBlockReason, /historico_insuficiente/);
});
test("gate: 4 ondas ainda não são elegíveis (mínimo editorial = 5)", () => {
  const g = editorialGate(4, [30, 30, 30], 30, cfg);
  assert.equal(g.editorialEligible, false);
  assert.match(g.editorialBlockReason, /historico_insuficiente/);
});
test("gate: 5 ondas são elegíveis quando não há outro bloqueio", () => {
  const g = editorialGate(5, [30, 30, 30, 30], 30, cfg);
  assert.equal(g.editorialEligible, true);
  assert.equal(g.editorialBlockReason, null);
});
test("gate: 6 ondas elegíveis", () => {
  const g = editorialGate(6, [30, 30, 30, 30, 30], 30, cfg);
  assert.equal(g.editorialEligible, true);
});
test("gate: intervalo ≥ 540 bloqueia mesmo com amostra suficiente (preservado)", () => {
  const g = editorialGate(6, [30, 30, 943, 30, 30], 40, cfg);
  assert.equal(g.maxIntervalDays, 943); // preservado, não apagado
  assert.equal(g.editorialEligible, false);
  assert.match(g.editorialBlockReason, /intervalo_extremo/);
  assert.ok(g.warnings.some((w) => /extremo/.test(w) && /943/.test(w)));
});
test("gate: intervalo entre 365 e 540 gera warning mas não bloqueia sozinho", () => {
  const g = editorialGate(6, [30, 30, 400, 30, 30], 40, cfg);
  assert.equal(g.editorialEligible, true);
  assert.ok(g.warnings.some((w) => /longo/.test(w) && /400/.test(w)));
});
test("gate: horizonte > 180 dias bloqueia e exige revisão", () => {
  const g = editorialGate(6, [200, 200, 200, 200, 200], 210, cfg);
  assert.equal(g.editorialEligible, false);
  assert.match(g.editorialBlockReason, /horizonte_excedido/);
  assert.equal(g.requiresEditorialReview, true);
});
test("gate: horizonte > 365 dias gera warning crítico", () => {
  const g = editorialGate(6, [30, 30, 30, 30, 30], 800, cfg);
  assert.ok(g.warnings.some((w) => /365/.test(w)));
});

// ------------------------------------------------- caso real 943 dias (2028)
test("caso livelo→connectmiles (2 ondas, 943 dias): preservado, sinalizado e bloqueado", () => {
  const rows = [
    tf("livelo", "connectmiles", "2023-12-12", 40),
    tf("livelo", "connectmiles", "2026-07-12", 40),
  ];
  const fc = buildForecast(rows, { now: NOW, config: cfg });
  const r = fc.routes.find((x) => x.route === "livelo→connectmiles");
  assert.equal(r.samples, 2);
  assert.deepEqual(r.intervals, [943]); // intervalo preservado no histórico
  assert.equal(r.maxIntervalDays, 943);
  assert.equal(r.editorialEligible, false); // não vira manchete
  assert.ok(r.warnings.some((w) => /943/.test(w)));
  // A janela central cai anos à frente (não é truncada), mas não pode ser publicada.
  assert.ok(Number(String(r.windowStart).slice(0, 4)) >= 2028);
  assert.ok(r.requiresEditorialReview);
  // radarItems e upcomingWindows NUNCA devolvem a série bloqueada.
  assert.equal(radarItems(fc.routes).some((i) => /ConnectMiles/.test(i.label)), false);
  assert.equal(
    upcomingWindows(fc, { now: NOW, horizonDays: 3650, minConfidence: "baixa" }).some(
      (x) => x.route === "livelo→connectmiles",
    ),
    false,
  );
});

// -------------------------------------------------- série saudável é elegível
test("série mensal com 6 ondas é elegível e entra no radar/weekly", () => {
  const dates = ["2026-02-05", "2026-03-07", "2026-04-06", "2026-05-06", "2026-06-05", "2026-07-05"];
  const rows = dates.map((d) => tf("livelo", "smiles", d, 25));
  const fc = buildForecast(rows, { now: NOW, config: cfg });
  const r = fc.routes.find((x) => x.route === "livelo→smiles");
  assert.equal(r.samples, 6);
  assert.equal(r.editorialEligible, true);
  assert.ok(radarItems(fc.routes).some((i) => /Livelo → Smiles/.test(i.label)));
  const weekly = upcomingWindows(fc, { now: NOW, horizonDays: 21, minConfidence: "baixa", include: ["route"] });
  assert.ok(weekly.some((x) => x.route === "livelo→smiles"));
});

// ------------------------------------------------------------- config default
test("config: parâmetros de contenção têm defaults versionados", () => {
  assert.equal(DEFAULT_FORECAST_CONFIG.minEditorialWaves, 5);
  assert.equal(DEFAULT_FORECAST_CONFIG.longIntervalWarningDays, 365);
  assert.equal(DEFAULT_FORECAST_CONFIG.extremeIntervalDays, 540);
  assert.equal(DEFAULT_FORECAST_CONFIG.maxEditorialHorizonDays, 180);
});
