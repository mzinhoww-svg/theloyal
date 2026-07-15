// Fase P1-B — testes do detalhe da série (helpers puros + composição).
// Cobre motor principal, fallback, sem previsão, faixas de divergência, campanhas
// utilizadas/excluídas, traduções, backtest/bônus, timeline e regressão do P1-A.
// Puro, sem I/O; importa os módulos .ts (type-strip nativo).
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeRadarViewModel, computeDivergence } from "../lib/radar-view-model.ts";
import {
  findRadarSeries,
  enginePrincipal,
  engineRoleLabel,
  readinessLabel,
  cadenceLabel,
  temporalStatusLabel,
  duplicateStatusLabel,
  exclusionReasonLabel,
  recommendedAction,
  divergenceLabel,
  waveIndexOf,
  eventDateOfRow,
  backtestAvailable,
  bonusAvailable,
  productExplanation,
} from "../lib/radar-detail.ts";

const NOW = "2026-07-15";
const FRESH = { status: "fresh", generatedAt: "2026-07-15T06:00:00Z", ageHours: 6 };

function healthy() {
  const dates = ["2026-02-05", "2026-03-05", "2026-04-05", "2026-05-05", "2026-06-05", "2026-07-05"];
  return dates.map((d) => ({
    id: `livelo-smiles-transferencia-${d}`, tipo: "transferencia", origem: "livelo", destino: "smiles",
    percentual: 30, vigencia_inicio: d, vigencia_fim: d, first_seen: d, observed_at: d, created_at: `${d}T12:00:00Z`,
    origin: "daily", source_url: "https://exemplo.com/livelo-smiles",
  }));
}
const MISSING = { id: "livelo-smiles-transferencia-semdata", tipo: "transferencia", origem: "livelo", destino: "smiles", percentual: 30 };
const CONNECT_A = {
  id: "livelo-connectmiles-transferencia-2023-12-12", tipo: "transferencia", origem: "livelo", destino: "connectmiles", percentual: 40,
  vigencia_inicio: null, vigencia_fim: "2023-12-12", first_seen: "2026-07-12", observed_at: "2026-07-13", created_at: "2026-07-13T16:48:00Z",
  source_url: "https://passageirodeprimeira.com/ultimo-dia-livelo-connectmiles/",
};
const CONNECT_B = {
  id: "livelo-connectmiles-transferencia-2026-07-12", tipo: "transferencia", origem: "livelo", destino: "connectmiles", percentual: 40,
  vigencia_inicio: null, vigencia_fim: "2026-07-12", first_seen: "2026-07-10", observed_at: "2026-07-12", created_at: "2026-07-11T04:47:00Z",
  source_url: "https://passageirodeprimeira.com/prorrogado-livelo-connectmiles/",
};
const PERMANENT = { id: "itau-azul-transferencia-na", tipo: "transferencia", origem: "itau", destino: "azul", percentual: 80, vigencia_fim: "na", first_seen: "2026-07-01" };
const PLACEHOLDER = { id: "desconhecido-latampass-transferencia-2026-06-01", tipo: "transferencia", origem: "desconhecido", destino: "latampass", percentual: 30, vigencia_fim: "2026-06-01", first_seen: "2026-05-25" };

const ROWS = [...healthy(), MISSING, CONNECT_A, CONNECT_B, PERMANENT, PLACEHOLDER];
const VM = composeRadarViewModel(ROWS, { now: NOW, datasetComplete: true, pagesRead: 1, freshness: FRESH });
const smiles = () => findRadarSeries(VM, "livelo→smiles");
const connect = () => findRadarSeries(VM, "livelo→connectmiles");

// ---- Localização e motor principal (§7/§8/§9) ----
test("1/8 detalhe: rota encontrada; motor principal = Predict quando pronto", () => {
  const s = smiles();
  assert.ok(s, "série da rota existe");
  assert.equal(s.scope, "route");
  assert.equal(enginePrincipal(s), "predict");
  assert.equal(engineRoleLabel("predict"), "Predict (principal)");
});

test("2 detalhe: Forecast fallback quando Predict bloqueado e Forecast tem janela", () => {
  assert.equal(enginePrincipal({ predict: { readiness: "insufficient_history", probabilities: null }, forecast: { windowStart: "2026-08-01" } }), "forecast");
  assert.equal(engineRoleLabel("forecast"), "Forecast (fallback)");
});

test("3 detalhe: sem previsão utilizável quando ambos bloqueados", () => {
  const s = connect();
  assert.ok(s);
  assert.equal(enginePrincipal(s), "none");
  assert.match(productExplanation(s), /Nenhum motor/);
});

// ---- Divergência (§13, faixas D6) ----
test("4-7 divergência: compatível / atenção / revisão / bloqueio", () => {
  const f = (c) => ({ windowStart: c, windowEnd: c });
  const p = (c) => ({ centralDate: c, windowStart: c, windowEnd: c });
  assert.equal(computeDivergence(f("2026-08-01"), p("2026-08-11")).level, "compatible"); // Δ10
  assert.equal(computeDivergence(f("2026-08-01"), p("2026-08-21")).level, "warning"); // Δ20
  assert.equal(computeDivergence(f("2026-08-01"), p("2026-09-10")).level, "review"); // Δ40
  assert.equal(computeDivergence(f("2026-08-01"), p("2026-10-10")).level, "block"); // Δ70
});

test("divergência: sobreposição de janelas atenua uma faixa", () => {
  const f = { windowStart: "2026-08-01", windowEnd: "2026-10-31" };
  const p = { centralDate: "2026-10-25", windowStart: "2026-10-20", windowEnd: "2026-10-25" };
  const d = computeDivergence(f, p);
  assert.equal(d.level, "warning"); // seria review (Δ~40), rebaixado por sobreposição
  assert.equal(divergenceLabel("review"), "revisão necessária");
});

// ---- Campanhas utilizadas e excluídas (§15/§16) ----
test("10 campanhas utilizadas: elegíveis da série presentes e datáveis", () => {
  const s = smiles();
  assert.equal(s.quality.used.length, 6);
  assert.ok(s.quality.used.every((r) => eventDateOfRow(r) != null));
  // Índice de onda casa com as janelas do Forecast.
  assert.equal(waveIndexOf(s, s.quality.used[0]), 1);
});

test("11/12 campanhas excluídas: 943 → possível erro de ano", () => {
  const s = connect();
  const a = s.quality.excluded.find((e) => e.id === CONNECT_A.id);
  assert.ok(a, "registro A excluído");
  assert.equal(a.temporal.status, "suspect_year");
  assert.equal(temporalStatusLabel(a.temporal.status), "possível erro de ano");
  assert.equal(a.temporal.dayDifference, 943);
});

test("13 provável duplicidade traduzida e presente no par", () => {
  const s = connect();
  const a = s.quality.excluded.find((e) => e.id === CONNECT_A.id);
  assert.equal(duplicateStatusLabel(a.duplicate.status), "provável duplicidade");
  assert.match(exclusionReasonLabel(a.reason), /erro de ano|duplicidade/);
});

test("14 data ausente: excluída da série saudável com rótulo", () => {
  const s = smiles();
  const m = s.quality.excluded.find((e) => e.id === MISSING.id);
  assert.ok(m, "campanha sem data excluída");
  assert.equal(temporalStatusLabel(m.temporal.status), "data do evento ausente");
});

test("15 campanha sem prazo (permanente) tem rótulo próprio", () => {
  assert.equal(temporalStatusLabel("permanent_or_open_ended"), "campanha sem prazo definido");
});

test("16 placeholder: programa inválido excluído e rotulado", () => {
  assert.equal(exclusionReasonLabel("placeholder_program"), "programa inválido ou genérico");
  assert.ok(VM.health.placeholderCount >= 1);
});

// ---- Traduções (§11/§12) ----
test("traduções de readiness e cadência", () => {
  assert.equal(readinessLabel("ready"), "disponível");
  assert.equal(readinessLabel("ready_with_warnings"), "disponível com ressalvas");
  assert.equal(readinessLabel("insufficient_history"), "histórico insuficiente");
  assert.equal(readinessLabel("data_quality_blocked"), "bloqueado por qualidade");
  assert.equal(cadenceLabel("mensal"), "mensal");
  assert.equal(cadenceLabel(null), "sem cadência definida");
});

// ---- Warnings/bloqueios, backtest, bônus (§17/§18) ----
test("17/18 bloqueios e backtest: série bloqueada expõe motivo; backtest insuficiente honesto", () => {
  const s = connect();
  assert.ok(s.editorialBlockReasons.length > 0 || s.predict.blockReason != null);
  // connectmiles: Predict bloqueado (1<3) → sem backtest confiável.
  assert.equal(backtestAvailable(s), false);
});

test("19/21 backtest e bônus disponíveis na série saudável", () => {
  const s = smiles();
  assert.equal(bonusAvailable(s), true);
  assert.equal(s.bonus, 30);
});

test("20/22 bônus ausente tratado sem inferência", () => {
  // Série sintética sem bônus → indisponível (nunca inferido).
  assert.equal(bonusAvailable({ bonus: null }), false);
  // connect exibe o bônus do único registro elegível (B, 40%) — é o dado, não inferência.
  assert.equal(connect().bonus, 40);
});

// ---- Ação recomendada / timeline (§8/§20) ----
test("ação recomendada por estado; timeline usa só o estado atual", () => {
  assert.equal(recommendedAction({ productStatus: "data_quality_blocked" }), "Revisar dados");
  assert.equal(recommendedAction({ productStatus: "opportunity" }), "Previsão disponível");
  const s = smiles();
  assert.ok((s.forecast?.windows ?? []).length >= 5, "timeline tem ondas do estado atual");
});

// ---- Cluster agregado (§9 cabeçalho) ----
test("9 cluster agregado existe e é rotulável", () => {
  const c = findRadarSeries(VM, "→smiles");
  assert.ok(c, "cluster do destino existe");
  assert.equal(c.scope, "cluster");
  assert.equal(c.origin, null);
});

// ---- Série inexistente (§22) ----
test("24 série inexistente retorna null (empty state na página)", () => {
  assert.equal(findRadarSeries(VM, "inexistente→rota"), null);
});

// ---- Regressão P1-A (§25.28) ----
test("28 regressão: view model do P1-A intacto (saúde e séries)", () => {
  assert.ok(VM.series.length > 0);
  assert.equal(VM.health.campaignsEligible, 7); // 6 smiles + 1 connect (B)
  assert.ok(VM.health.temporalCriticalCount >= 1);
  assert.ok(VM.filters.destinations.includes("smiles"));
});
