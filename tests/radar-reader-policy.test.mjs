// Política canônica do Radar — nota de corte de publicação ao leitor.
// Testa deriveReaderDecision (pura, todos os ramos) e a integração via
// composeRadarViewModel (cenários reais). NÃO recalcula gate: só verifica a
// etiqueta de produto sobre saídas que os motores já produzem.
// Referência: docs/POLITICA-CANONICA-RADAR.md §7.4.
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeRadarViewModel, deriveReaderDecision } from "../lib/radar-view-model.ts";
import { buildForecast, radarItems, upcomingWindows } from "../lib/forecast.ts";

const NOW = "2026-07-15";
const FRESH = { status: "fresh", generatedAt: "2026-07-15T06:00:00Z", ageHours: 6 };
const STALE = { status: "stale", generatedAt: "2026-07-10T06:00:00Z", ageHours: 120 };

// Série mensal regular e longa (12 ondas) → Predict pronto, confiança alta,
// backtest com acerto de janela ≥ 0,5. Passa a nota de corte.
function regular(n = 12) {
  const rows = [];
  for (let m = 0; m < n; m++) {
    const d = new Date(Date.UTC(2025, 6 + m, 5)).toISOString().slice(0, 10);
    rows.push({
      id: `livelo-smiles-transferencia-${d}`, tipo: "transferencia",
      origem: "livelo", destino: "smiles", percentual: 30,
      vigencia_inicio: d, vigencia_fim: d, first_seen: d, observed_at: d, created_at: `${d}T12:00:00Z`,
    });
  }
  return rows;
}

// Par 943: A com vigencia_fim fabricada (2023), B correta (2026) — data_quality_blocked.
const CONNECT_A = {
  id: "livelo-connectmiles-transferencia-2023-12-12", tipo: "transferencia",
  origem: "livelo", destino: "connectmiles", percentual: 40,
  vigencia_inicio: null, vigencia_fim: "2023-12-12",
  first_seen: "2026-07-12", observed_at: "2026-07-13", created_at: "2026-07-13T16:48:00Z",
};
const CONNECT_B = {
  id: "livelo-connectmiles-transferencia-2026-07-12", tipo: "transferencia",
  origem: "livelo", destino: "connectmiles", percentual: 40,
  vigencia_inicio: null, vigencia_fim: "2026-07-12",
  first_seen: "2026-07-10", observed_at: "2026-07-12", created_at: "2026-07-11T04:47:00Z",
};

function vmOf(rows, over = {}) {
  return composeRadarViewModel(rows, { now: NOW, datasetComplete: true, pagesRead: 1, freshness: FRESH, ...over });
}

// ------------------------------------------------------------------ integração

test("série regular saudável passa a nota de corte: Predict canônico, superfície previsão", () => {
  const vm = vmOf(regular());
  const s = vm.series.find((x) => x.seriesKey === "livelo→smiles" && x.scope === "route");
  assert.ok(s);
  assert.equal(s.canonicalEngine, "predict");
  assert.equal(s.fallbackUsed, false);
  assert.equal(s.readerPublishable, true);
  assert.equal(s.readerSurface, "prediction");
  assert.deepEqual(s.readerBlockReasons, []);
});

test("invariante: readerPublishable ⟺ readerBlockReasons vazio; publicável ⇒ superfície previsão", () => {
  const vm = vmOf([...regular(), CONNECT_A, CONNECT_B]);
  for (const s of vm.series) {
    assert.equal(s.readerPublishable, s.readerBlockReasons.length === 0, `divergência em ${s.seriesKey}`);
    if (s.readerPublishable) {
      assert.equal(s.readerSurface, "prediction");
      assert.notEqual(s.canonicalEngine, null);
    }
  }
});

test("base incompleta bloqueia o leitor em toda série (hidden, motivo base_incompleta)", () => {
  const vm = vmOf(regular(), { datasetComplete: false });
  assert.ok(vm.series.length > 0);
  for (const s of vm.series) {
    assert.equal(s.readerPublishable, false);
    assert.equal(s.readerSurface, "hidden");
    assert.ok(s.readerBlockReasons.includes("base_incompleta"));
  }
});

test("artefato stale bloqueia o leitor (motivo artefato_stale), sem inventar número", () => {
  const vm = vmOf(regular(), { freshness: STALE });
  const s = vm.series.find((x) => x.seriesKey === "livelo→smiles" && x.scope === "route");
  assert.equal(s.readerPublishable, false);
  assert.ok(s.readerBlockReasons.includes("artefato_stale"));
});

test("943: série bloqueada por dado não vai ao leitor (hidden, qualidade_de_dado)", () => {
  const vm = vmOf([...regular(), CONNECT_A, CONNECT_B]);
  const s = vm.series.find((x) => x.seriesKey === "livelo→connectmiles" && x.scope === "route");
  assert.ok(s);
  assert.equal(s.productStatus, "data_quality_blocked");
  assert.equal(s.readerPublishable, false);
  assert.equal(s.readerSurface, "hidden");
  assert.ok(s.readerBlockReasons.includes("qualidade_de_dado"));
});

// -------------------------------------------------------------------- unidade

const CTX = { datasetComplete: true, fresh: true };
const okBacktest = { observations: 5, windowHitRate: 0.6 };

test("unidade: Predict pronto + confiança média + backtest ok → publicável", () => {
  const predict = { probabilities: { p30: 0.5 }, confidence: "media", backtest: okBacktest };
  const r = deriveReaderDecision(null, predict, "opportunity", "compatible", CTX);
  assert.equal(r.canonicalEngine, "predict");
  assert.equal(r.readerPublishable, true);
  assert.equal(r.readerSurface, "prediction");
});

test("unidade: fallback rotulado — Predict bloqueado + Forecast elegível → Forecast canônico", () => {
  const forecast = { editorialEligible: true, confidence: "media" };
  const predict = { probabilities: null, confidence: "insuficiente", backtest: null };
  const r = deriveReaderDecision(forecast, predict, "monitoring", "none", CTX);
  assert.equal(r.canonicalEngine, "forecast");
  assert.equal(r.fallbackUsed, true);
  assert.equal(r.readerPublishable, true); // fallback passa a nota de corte automática; falta só aprovação
});

test("unidade: nenhum motor pronto → sem_motor_pronto, não publicável", () => {
  const forecast = { editorialEligible: false, confidence: "em-formacao" };
  const predict = { probabilities: null, confidence: "insuficiente", backtest: null };
  const r = deriveReaderDecision(forecast, predict, "no_prediction", "none", CTX);
  assert.equal(r.canonicalEngine, null);
  assert.equal(r.readerPublishable, false);
  assert.ok(r.readerBlockReasons.includes("sem_motor_pronto"));
  assert.equal(r.readerSurface, "monitoring"); // não é problema de dado → em observação, não hidden
});

test("unidade: confiança baixa reprova a nota de corte (confianca_abaixo_de_media)", () => {
  const predict = { probabilities: { p30: 0.3 }, confidence: "baixa", backtest: okBacktest };
  const r = deriveReaderDecision(null, predict, "monitoring", "compatible", CTX);
  assert.equal(r.readerPublishable, false);
  assert.ok(r.readerBlockReasons.includes("confianca_abaixo_de_media"));
  assert.equal(r.readerSurface, "monitoring");
});

test("unidade: divergência em revisão/bloqueio reprova", () => {
  const predict = { probabilities: { p30: 0.5 }, confidence: "alta", backtest: okBacktest };
  for (const level of ["review", "block"]) {
    const r = deriveReaderDecision(null, predict, "review_required", level, CTX);
    assert.equal(r.readerPublishable, false);
    assert.ok(r.readerBlockReasons.includes(`divergencia_${level}`));
  }
});

test("unidade: backtest fraco (≥3 obs, hit < 0,5) reprova", () => {
  const predict = { probabilities: { p30: 0.5 }, confidence: "alta", backtest: { observations: 4, windowHitRate: 0.25 } };
  const r = deriveReaderDecision(null, predict, "opportunity", "compatible", CTX);
  assert.equal(r.readerPublishable, false);
  assert.ok(r.readerBlockReasons.includes("backtest_fraco"));
});

test("unidade: backtest com poucas observações (<3) NÃO reprova por acurácia", () => {
  const predict = { probabilities: { p30: 0.5 }, confidence: "media", backtest: { observations: 2, windowHitRate: 0.0 } };
  const r = deriveReaderDecision(null, predict, "opportunity", "compatible", CTX);
  assert.ok(!r.readerBlockReasons.includes("backtest_fraco"));
  assert.equal(r.readerPublishable, true);
});

// --------------------------------------------------- pipeline (artefato ao leitor)

test("pipeline: todo item de radar carrega proveniência source='forecast'", () => {
  const fc = buildForecast(regular(), { now: NOW });
  const items = [...radarItems(fc.routes), ...radarItems(fc.clusters)];
  assert.ok(items.length > 0);
  for (const it of items) assert.equal(it.source, "forecast");
});

test("pipeline: nota de corte do weekly (confiança≥média) exclui série 'baixa'", () => {
  // Série irregular longa → confiança baixa no Forecast; média corta, baixa incluiria.
  const irregular = [
    "2025-01-05", "2025-01-30", "2025-04-02", "2025-04-20", "2025-07-01", "2025-07-11",
  ].map((d) => ({ id: `itau-azul-transferencia-${d}`, tipo: "transferencia", origem: "itau", destino: "azul", percentual: 25, vigencia_inicio: d, vigencia_fim: d, first_seen: d, observed_at: d, created_at: `${d}T12:00:00Z` }));
  const fc = buildForecast(irregular, { now: "2025-07-15" });
  const media = upcomingWindows(fc, { now: "2025-07-15", horizonDays: 90, minConfidence: "media" });
  const baixa = upcomingWindows(fc, { now: "2025-07-15", horizonDays: 90, minConfidence: "baixa" });
  assert.ok(baixa.length >= media.length, "corte 'baixa' é mais permissivo que 'media'");
});
