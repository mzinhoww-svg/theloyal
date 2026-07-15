// Fase C0 — testes da contenção de dados temporais e resultados incoerentes.
// Fixtures determinísticas; nenhum acesso ao Supabase.
import { test } from "node:test";
import assert from "node:assert/strict";
import { windowDate, buildForecast } from "../scripts/forecast-engine.mjs";
import {
  evaluateTemporalPlausibility,
  detectProbableDuplicates,
  isPlaceholderProgram,
  isAmbiguousAlias,
  classifyInterval,
  evaluateForecastFreshness,
  evaluateEditorialGate,
  containForecast,
  assessCampaigns,
  THRESHOLDS,
} from "../scripts/radar-quality.mjs";

// ---- Fixtures do caso de referência Livelo→ConnectMiles ----
const CONNECT_A = {
  id: "livelo-connectmiles-transferencia-2023-12-12",
  origem: "livelo", destino: "connectmiles", tipo: "transferencia", percentual: 40,
  vigencia_inicio: null, vigencia_fim: "2023-12-12",
  first_seen: "2026-07-12", observed_at: "2026-07-13", created_at: "2026-07-13T16:48:00Z",
  origin: "auto", source_url: "https://passageirodeprimeira.com/ultimo-dia-livelo-oferece-40-de-bonus-nas-transferencias-para-o-connectmiles/",
  notes: "Livelo oferece 40% de bônus para o ConnectMiles até hoje (12)",
};
const CONNECT_B = {
  id: "livelo-connectmiles-transferencia-2026-07-12",
  origem: "livelo", destino: "connectmiles", tipo: "transferencia", percentual: 40,
  vigencia_inicio: null, vigencia_fim: "2026-07-12",
  first_seen: "2026-07-10", observed_at: "2026-07-12", created_at: "2026-07-11T04:47:00Z",
  origin: "daily", source_url: "https://passageirodeprimeira.com/prorrogado-livelo-oferece-40-de-bonus-nas-transferencias-para-o-connectmiles/",
  notes: "Prorrogado; 40% bonus",
};

test("6.1 caso 943: registro A é temporalmente suspeito (crítico)", () => {
  const t = evaluateTemporalPlausibility(CONNECT_A);
  assert.equal(t.status, "suspect_year");
  assert.ok(t.flags.includes("event_far_before_source"));
  assert.equal(t.severity, "critical");
  assert.equal(t.includeInPrediction, false);
  assert.equal(t.requiresReprocessing, true);
  assert.equal(t.requiresHumanReview, true);
  // nenhuma correção automática de data
  assert.equal(t.eventDate, "2023-12-12");
});

test("6.1 caso 943: registro B é plausível", () => {
  const t = evaluateTemporalPlausibility(CONNECT_B);
  assert.equal(t.status, "valid");
  assert.equal(t.includeInPrediction, true);
});

test("6.1 comportamento ANTERIOR formava intervalo de 943 dias", () => {
  const fc = buildForecast([CONNECT_A, CONNECT_B]);
  const route = fc.routes.find((r) => r.route === "livelo→connectmiles");
  assert.ok(route, "rota deve existir sem contenção");
  assert.deepEqual(route.intervals, [943]);
});

test("6.1 comportamento NOVO: A bloqueado, 943 não alimenta a série, sem janela 2029", () => {
  const c = containForecast([CONNECT_A, CONNECT_B], { now: "2026-07-15" });
  // A está bloqueado; B é o único elegível
  assert.ok(c.assessment.blockedIds.has(CONNECT_A.id));
  assert.ok(!c.assessment.blockedIds.has(CONNECT_B.id));
  const route = c.result.routes.find((r) => r.route === "livelo→connectmiles");
  assert.ok(route, "rota ainda listada (1 onda)");
  assert.equal(route.samples, 1, "só a onda de B");
  assert.deepEqual(route.intervals, [], "nenhum intervalo de 943 dias");
  assert.equal(route.windowStart, null, "em-formacao: sem janela (nada de 2029)");
});

test("6.1 caso 943: par é duplicidade provável", () => {
  const dups = detectProbableDuplicates([CONNECT_A, CONNECT_B]);
  const g = dups.find((d) => d.campaignIds.includes(CONNECT_A.id) && d.campaignIds.includes(CONNECT_B.id));
  assert.ok(g, "par detectado");
  assert.equal(g.duplicateStatus, "probable_duplicate");
  assert.ok(g.duplicateScore >= THRESHOLDS.duplicateProbableScore);
});

// ---- 6.2 windowDate ----
test("6.2 windowDate: prioridade vigencia_inicio > id > vigencia_fim; proveniência ignorada", () => {
  assert.equal(windowDate({ vigencia_inicio: "2026-01-05", id: "a-b-transferencia-2025-01-01", vigencia_fim: "2025-01-01" }), "2026-01-05");
  assert.equal(windowDate({ vigencia_inicio: null, id: "a-b-transferencia-2024-05-10", vigencia_fim: "2099-01-01" }), "2024-05-10");
  assert.equal(windowDate({ vigencia_inicio: null, id: "a-b-transferencia-na", vigencia_fim: "2024-05-10" }), "2024-05-10");
  assert.equal(windowDate({ vigencia_inicio: null, id: "a-b-transferencia-na", vigencia_fim: "na" }), null);
  assert.equal(windowDate({ vigencia_inicio: "2026-13-40", id: "a-b-transferencia-na", vigencia_fim: "lixo" }), null);
  assert.equal(windowDate({ id: "a-b-transferencia-na" }), null);
  // first_seen / observed_at NÃO são usados como data do evento
  assert.equal(windowDate({ id: "a-b-transferencia-na", first_seen: "2026-07-12", observed_at: "2026-07-13" }), null);
});

// ---- Erro de ano / evento antes-depois da fonte / conflito / permanente ----
test("erro de ano (evento >300d antes da fonte) → crítico", () => {
  const t = evaluateTemporalPlausibility({ id: "x-y-transferencia-2024-02-21", vigencia_fim: "2024-02-21", first_seen: "2025-02-19" });
  assert.equal(t.severity, "critical");
  assert.ok(t.flags.includes("suspect_year"));
});

test("evento posterior à fonte além da tolerância → warning (não bloqueia)", () => {
  const t = evaluateTemporalPlausibility({ id: "x-y-transferencia-2026-09-01", vigencia_fim: "2026-09-01", first_seen: "2026-07-01" });
  assert.ok(t.flags.includes("event_after_source"));
  assert.equal(t.includeInPrediction, true);
});

test("vigências conflitantes (inicio > fim) → crítico", () => {
  const t = evaluateTemporalPlausibility({ id: "x-y-transferencia-2026-01-01", vigencia_inicio: "2026-06-01", vigencia_fim: "2026-01-01", first_seen: "2026-01-02" });
  assert.equal(t.status, "conflicting_event_dates");
  assert.equal(t.includeInPrediction, false);
});

test("campanha permanente (na) → permanent_or_open_ended, fora da recorrência, não apaga", () => {
  const t = evaluateTemporalPlausibility({ id: "x-y-transferencia-na", vigencia_fim: "na", first_seen: "2026-07-01" });
  assert.equal(t.status, "permanent_or_open_ended");
  assert.equal(t.includeInPrediction, false);
  assert.equal(t.requiresHumanReview, false);
});

test("vigencia_fim texto-lixo → invalid_date", () => {
  const t = evaluateTemporalPlausibility({ id: "x-y-transferencia-na", vigencia_fim: "sem data definida ainda" });
  assert.equal(t.status, "invalid_date");
  assert.equal(t.includeInPrediction, false);
});

// ---- Duplicidade possível vs provável ----
test("duplicidade possível (sinais fracos) não bloqueia sozinha", () => {
  const a = { id: "livelo-azul-transferencia-2026-06-01", origem: "livelo", destino: "azul", tipo: "transferencia", percentual: 100, vigencia_fim: "2026-06-01", first_seen: "2026-05-20", source_url: "https://x.com/a" };
  const b = { id: "livelo-azul-transferencia-2026-06-30", origem: "livelo", destino: "azul", tipo: "transferencia", percentual: 100, vigencia_fim: "2026-06-30", first_seen: "2026-06-25", source_url: "https://y.com/b" };
  const dups = detectProbableDuplicates([a, b]);
  const g = dups[0];
  assert.ok(g);
  assert.ok(["possible_duplicate", "probable_duplicate"].includes(g.duplicateStatus));
});

// ---- Placeholders e aliases ----
test("placeholders inválidos não formam programa", () => {
  for (const v of ["null", "desconhecido", "cartao", "cartoes", "parceiros", "bancos", "vantagens"]) {
    assert.equal(isPlaceholderProgram(v), true, v);
  }
  assert.equal(isPlaceholderProgram("livelo"), false);
});

test("aliases ambíguos sinalizados, não unidos", () => {
  for (const v of ["inter", "loop", "interloop", "inter-loop", "all", "allaccor", "accor", "azulfidelidade"]) {
    assert.equal(isAmbiguousAlias(v), true, v);
  }
});

test("série-lixo (origem null/desconhecido) é excluída da elegível", () => {
  const junk = { id: "null-latampass-transferencia-2026-06-01", origem: "null", destino: "latampass", tipo: "transferencia", percentual: 30, vigencia_fim: "2026-06-01", first_seen: "2026-05-25" };
  const a = assessCampaigns([junk], { now: "2026-07-15" });
  assert.ok(a.blockedIds.has(junk.id));
  assert.equal(a.eligible.length, 0);
});

// ---- Intervalos e gate editorial ----
test("classifyInterval: 365 long, 540 extreme, 943 critical", () => {
  assert.equal(classifyInterval(200), "normal");
  assert.equal(classifyInterval(365), "long");
  assert.equal(classifyInterval(540), "extreme");
  assert.equal(classifyInterval(943), "critical");
});

test("gate editorial: 1,2,4 ondas bloqueadas; 5+ elegível", () => {
  const mk = (samples, windowStart) => ({ scope: "route", route: "a→b", samples, intervals: samples > 1 ? Array(samples - 1).fill(30) : [], windowStart, windowEnd: windowStart, confidence: samples >= 4 ? "media" : "baixa" });
  assert.equal(evaluateEditorialGate(mk(1, null), "2026-07-15").editorialEligible, false);
  assert.equal(evaluateEditorialGate(mk(2, "2026-08-01"), "2026-07-15").editorialEligible, false);
  assert.equal(evaluateEditorialGate(mk(4, "2026-08-01"), "2026-07-15").editorialEligible, false);
  assert.equal(evaluateEditorialGate(mk(5, "2026-08-01"), "2026-07-15").editorialEligible, true);
});

test("horizonte > 180d exige revisão (warning); > 365d bloqueia editorialmente", () => {
  const base = { scope: "route", route: "a→b", samples: 6, intervals: [30, 30, 30, 30, 30], confidence: "media" };
  // ~189 dias: warning + revisão, mas ainda elegível
  const gWarn = evaluateEditorialGate({ ...base, windowStart: "2027-01-20", windowEnd: "2027-01-25" }, "2026-07-15");
  assert.equal(gWarn.requiresEditorialReview, true);
  assert.equal(gWarn.editorialEligible, true);
  // > 365 dias: bloqueia
  const gBlock = evaluateEditorialGate({ ...base, windowStart: "2027-10-01", windowEnd: "2027-10-05" }, "2026-07-15");
  assert.equal(gBlock.editorialEligible, false);
  const gOk = evaluateEditorialGate({ ...base, windowStart: "2026-08-01", windowEnd: "2026-08-05" }, "2026-07-15");
  assert.equal(gOk.editorialEligible, true);
});

// ---- Frescor ----
test("freshness: fresh, stale, missing, invalid, incomplete", () => {
  const now = Date.parse("2026-07-15T12:00:00Z");
  assert.equal(evaluateForecastFreshness({ generatedAt: "2026-07-15T06:00:00Z", generatedFor: "2026-07-15", ledgerRows: 500, source: "supabase" }, now).status, "fresh");
  assert.equal(evaluateForecastFreshness({ generatedAt: "2026-07-10T06:00:00Z", generatedFor: "2026-07-10", ledgerRows: 500, source: "supabase" }, now).status, "stale");
  assert.equal(evaluateForecastFreshness(null, now).status, "missing");
  assert.equal(evaluateForecastFreshness({ source: "offline", generatedAt: null }, now).status, "invalid");
  assert.equal(evaluateForecastFreshness({ generatedAt: "2026-07-15T06:00:00Z", generatedFor: "2026-07-15", ledgerRows: 500, source: "supabase", datasetComplete: false }, now).status, "incomplete");
});

// ---- Dataset incompleto bloqueia distribuição ----
test("dataset incompleto bloqueia elegibilidade editorial", () => {
  const rows = [];
  for (let i = 0; i < 6; i++) rows.push({ id: `c6-azul-transferencia-2026-0${i + 1}-01`, origem: "c6", destino: "azul", tipo: "transferencia", percentual: 80, vigencia_inicio: `2026-0${i + 1}-01`, first_seen: `2026-0${i + 1}-01` });
  const complete = containForecast(rows, { now: "2026-07-15", datasetComplete: true });
  const incomplete = containForecast(rows, { now: "2026-07-15", datasetComplete: false });
  const anyEligible = (c) => [...c.routes, ...c.clusters].some((a) => a.meta.editorialEligible);
  assert.equal(anyEligible(incomplete), false, "incompleto nunca elegível");
  void complete;
});
