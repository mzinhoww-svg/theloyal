// Overrides do operador na reconciliação (fonte única). Semântica documentada
// (docs/IMPLEMENTACAO-POLITICA-CANONICA-RADAR.md F1):
//   • mute        → suprime a série do radar do leitor (independe de motor).
//   • confidence  → sobrescreve a confiança do Forecast (baseline/fallback). Quando
//                   o Predict é canônico, a confiança MEDIDA governa; para suprimir
//                   uma série Predict-canônica o operador usa mute.
//   • pin + nota  → libera a elegibilidade editorial do Forecast (caminho de fallback).
// Hard blocks (qualidade temporal/duplicidade) seguem vencendo — override não desarma.
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeRadarViewModel } from "../lib/radar-view-model.ts";

const NOW = "2026-07-15";
const FRESH = { status: "fresh", generatedAt: "2026-07-15T06:00:00Z", ageHours: 6 };

function series(origem, destino, isoDates, percentual = 30) {
  return isoDates.map((d) => ({
    id: `${origem}-${destino}-transferencia-${d}`, tipo: "transferencia",
    origem, destino, percentual, vigencia_inicio: d, vigencia_fim: d,
    first_seen: d, observed_at: d, created_at: `${d}T12:00:00Z`,
  }));
}
function monthly(origem, destino, n) {
  const ds = [];
  for (let m = 0; m < n; m++) ds.push(new Date(Date.UTC(2025, 6 + m, 5)).toISOString().slice(0, 10));
  return series(origem, destino, ds);
}
function vmOf(rows, overrides) {
  return composeRadarViewModel(rows, { now: NOW, datasetComplete: true, pagesRead: 1, freshness: FRESH, overrides });
}

test("sem overrides: série saudável publicável (baseline)", () => {
  const s = vmOf(monthly("livelo", "smiles", 12)).series.find((x) => x.seriesKey === "livelo→smiles");
  assert.equal(s.muted, false);
  assert.equal(s.editorialOverridden, false);
  assert.equal(s.readerPublishable, true);
});

test("mute suprime a série do leitor (hidden, silenciada), independente do motor", () => {
  const over = [{ scope: "route", route: "livelo→smiles", action: "mute" }];
  const s = vmOf(monthly("livelo", "smiles", 12), over).series.find((x) => x.seriesKey === "livelo→smiles");
  assert.equal(s.muted, true);
  assert.equal(s.readerPublishable, false);
  assert.equal(s.readerSurface, "hidden");
  assert.ok(s.readerBlockReasons.includes("silenciada"));
});

test("confidence override sobrescreve a confiança do Forecast (baseline)", () => {
  const over = [{ scope: "route", route: "livelo→smiles", action: "confidence", confidence: "baixa" }];
  const s = vmOf(monthly("livelo", "smiles", 12), over).series.find((x) => x.seriesKey === "livelo→smiles");
  assert.equal(s.forecast.confidence, "baixa"); // override aplicado ao baseline
});

test("pin + nota libera elegibilidade editorial de série curta (fallback)", () => {
  // 4 ondas: abaixo do mínimo editorial (5) → editorialEligible false por amostra.
  const rows = monthly("itau", "latampass", 4);
  const base = vmOf(rows).series.find((x) => x.seriesKey === "itau→latampass");
  assert.equal(base.editorialEligible, false, "sem override, série curta é inelegível");

  const over = [{ scope: "route", route: "itau→latampass", action: "pin", note: "campanha recorrente confirmada" }];
  const pinned = vmOf(rows, over).series.find((x) => x.seriesKey === "itau→latampass");
  assert.equal(pinned.editorialEligible, true);
  assert.equal(pinned.editorialOverridden, true);
});

test("pin sem nota NÃO libera elegibilidade (exige justificativa)", () => {
  const rows = monthly("itau", "latampass", 4);
  const over = [{ scope: "route", route: "itau→latampass", action: "pin", note: "" }];
  const s = vmOf(rows, over).series.find((x) => x.seriesKey === "itau→latampass");
  assert.equal(s.editorialEligible, false);
  assert.equal(s.editorialOverridden, false);
});

test("override não desarma hard block: série silenciada com dado ruim continua hidden", () => {
  // Série com dado temporalmente crítico permanece data_quality_blocked mesmo mutada.
  const good = monthly("livelo", "smiles", 12);
  const A = { id: "livelo-connectmiles-transferencia-2023-12-12", tipo: "transferencia", origem: "livelo", destino: "connectmiles", percentual: 40, vigencia_inicio: null, vigencia_fim: "2023-12-12", first_seen: "2026-07-12", observed_at: "2026-07-13", created_at: "2026-07-13T16:48:00Z" };
  const B = { id: "livelo-connectmiles-transferencia-2026-07-12", tipo: "transferencia", origem: "livelo", destino: "connectmiles", percentual: 40, vigencia_inicio: null, vigencia_fim: "2026-07-12", first_seen: "2026-07-10", observed_at: "2026-07-12", created_at: "2026-07-11T04:47:00Z" };
  const over = [{ scope: "route", route: "livelo→connectmiles", action: "pin", note: "quero publicar" }];
  const s = vmOf([...good, A, B], over).series.find((x) => x.seriesKey === "livelo→connectmiles");
  assert.equal(s.productStatus, "data_quality_blocked");
  assert.equal(s.readerSurface, "hidden");
  assert.equal(s.readerPublishable, false);
});
