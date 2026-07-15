// Paridade TypeScript × MJS do motor de previsão (Fase C0).
// lib/forecast.ts é a fonte da verdade; scripts/forecast-engine.mjs é o espelho
// que o pipeline de render usa (sem build de TS). Este teste FALHA se os dois
// divergirem em qualquer fixture — bloqueando o CI antes que o daily/weekly
// publique números diferentes do admin.
//
// Requer Node ≥ 22.18 / 24 (type-stripping nativo para importar o .ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ts from "../lib/forecast.ts";
import * as mjs from "../scripts/forecast-engine.mjs";

const NOW = "2026-07-15";

const tf = (origem, destino, date, percentual = 20, extra = {}) => ({
  id: `${origem}-${destino}-transferencia-${date}`,
  tipo: "transferencia",
  origem,
  destino,
  percentual,
  vigencia_inicio: date,
  ...extra,
});

// Fixtures determinísticas cobrindo os casos exigidos pela Fase C0.
const FIXTURES = {
  "série regular (mensal, 6 ondas)": [
    tf("livelo", "smiles", "2026-02-05"),
    tf("livelo", "smiles", "2026-03-07"),
    tf("livelo", "smiles", "2026-04-06"),
    tf("livelo", "smiles", "2026-05-06"),
    tf("livelo", "smiles", "2026-06-05"),
    tf("livelo", "smiles", "2026-07-05"),
  ],
  "série com duas ondas": [tf("itau", "latampass", "2026-05-01"), tf("itau", "latampass", "2026-06-01")],
  "série com 943 dias": [
    tf("livelo", "connectmiles", "2023-12-12", 40),
    tf("livelo", "connectmiles", "2026-07-12", 40),
  ],
  "datas duplicadas": [
    tf("a", "b", "2026-01-01"),
    tf("a", "b", "2026-01-01", 30),
    tf("a", "b", "2026-02-01"),
    tf("a", "b", "2026-03-01"),
    tf("a", "b", "2026-04-01"),
    tf("a", "b", "2026-05-01"),
  ],
  "campanhas dentro de 3 dias (mesma onda)": [
    tf("x", "y", "2026-01-01"),
    tf("x", "y", "2026-01-02"),
    tf("x", "y", "2026-02-01"),
    tf("x", "y", "2026-03-01"),
    tf("x", "y", "2026-04-01"),
    tf("x", "y", "2026-05-01"),
  ],
  "sem data válida": [
    { id: "p-q-transferencia-na", tipo: "transferencia", origem: "p", destino: "q", vigencia_fim: "na" },
    { id: "no-date", tipo: "transferencia", origem: "p", destino: "q", vigencia_inicio: "invalido" },
  ],
  "aliases (Latam Pass / TudoAzul)": [
    tf("Livelo", "Latam Pass", "2026-01-01"),
    tf("livelo", "latampass", "2026-02-01"),
    tf("Esfera", "TudoAzul", "2026-01-05"),
    tf("esfera", "azul", "2026-02-05"),
  ],
};

// Campos comparados por série (todos os relevantes do §7 do prompt).
const KEYS = [
  "scope", "route", "origem", "destino", "confidence",
  "windowStart", "windowEnd", "samples", "medianDays", "meanDays", "stdevDays",
  "lastWindow", "cadence", "typicalPercent", "windows", "intervals",
  "maxIntervalDays", "warnings", "editorialEligible", "editorialBlockReason",
  "requiresEditorialReview", "basis",
];

function project(list) {
  return list.map((f) => Object.fromEntries(KEYS.map((k) => [k, f[k]])));
}

for (const [name, rows] of Object.entries(FIXTURES)) {
  test(`paridade TS×MJS — ${name}`, () => {
    const a = ts.buildForecast(rows, { now: NOW });
    const b = mjs.buildForecast(rows, { now: NOW });
    assert.equal(a.routesTracked, b.routesTracked, "routesTracked");
    assert.equal(a.clustersTracked, b.clustersTracked, "clustersTracked");
    assert.equal(a.withPrediction, b.withPrediction, "withPrediction");
    assert.deepEqual(project(a.routes), project(b.routes), "routes divergem");
    assert.deepEqual(project(a.clusters), project(b.clusters), "clusters divergem");
    // Elegibilidade editorial idêntica (o gate que decide o que chega ao leitor).
    assert.deepEqual(ts.radarItems(a.routes), mjs.radarItems(b.routes), "radarItems divergem");
    assert.deepEqual(ts.radarItems(a.clusters), mjs.radarItems(b.clusters), "radar clusters divergem");
  });
}

test("paridade TS×MJS — editorialGate", () => {
  const cases = [
    [2, [30], 30],
    [5, [30, 30, 30, 30], 30],
    [6, [30, 30, 943, 30, 30], 40],
    [6, [200, 200, 200, 200, 200], 210],
    [4, [30, 30, 30], 400],
  ];
  const cfg = ts.DEFAULT_FORECAST_CONFIG;
  for (const [n, iv, dtc] of cases) {
    assert.deepEqual(ts.editorialGate(n, iv, dtc, cfg), mjs.editorialGate(n, iv, dtc, cfg), `gate(${n},${iv},${dtc})`);
  }
});

test("paridade TS×MJS — defaults de contenção idênticos", () => {
  for (const k of ["minEditorialWaves", "longIntervalWarningDays", "extremeIntervalDays", "maxEditorialHorizonDays"]) {
    assert.equal(ts.DEFAULT_FORECAST_CONFIG[k], mjs.DEFAULT_FORECAST_CONFIG[k], k);
  }
});
