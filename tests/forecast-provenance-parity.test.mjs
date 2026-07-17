// Dívida A1 — paridade Forecast legado × Radar por PROVENIÊNCIA.
//
// O motor (lib/forecast → assessCampaignQuality) já aplica a contenção temporal
// C0.2, MAS só dispara quando as linhas trazem as colunas de proveniência
// (first_seen/observed_at/created_at/...). O loader do Forecast lia só 7 colunas
// e por isso o caso livelo → connectmiles vazava: aparecia "Maior intervalo 943d"
// e uma janela em 2029 em /admin/forecast, enquanto o Radar (que lê proveniência)
// excluía corretamente. Este teste prova o loader corrigido, o gap fechado e a
// paridade — SEM tocar no banco (fixtures puras, nenhuma chamada de rede).
//
// Requer Node ≥ 22.18 (type-stripping nativo para importar os .ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  LEDGER_QUALITY_SELECT,
  LEDGER_QUALITY_COLUMNS,
  PROVENANCE_COLUMNS,
} from "../lib/ledger-select.ts";
import {
  buildForecast,
  radarItems,
  normProgram,
  DEFAULT_FORECAST_CONFIG,
} from "../lib/forecast.ts";
import {
  assessCampaignQuality,
  evaluateTemporalPlausibility,
  resolveEventDateCandidate,
} from "../lib/campaign-quality.ts";
import { composeRadarViewModel } from "../lib/radar-view-model.ts";

const NOW = "2026-07-15";

// --------------------------------------------------------------------- fixtures
// Colunas de proveniência que o loader legado descartava.
const PROV = ["first_seen", "last_seen", "observed_at", "created_at", "source_url", "origin"];
function stripProvenance(row) {
  const out = { ...row };
  for (const k of PROV) delete out[k];
  return out;
}

// Campanha de transferência com proveniência coerente (data de evento ≈ fonte) —
// permanece VÁLIDA. Usada nas séries de regressão.
const valid = (origem, destino, date, percentual = 20) => ({
  id: `${origem}-${destino}-transferencia-${date}`,
  tipo: "transferencia",
  origem,
  destino,
  percentual,
  vigencia_inicio: date,
  first_seen: date,
  last_seen: date,
  observed_at: date,
  created_at: date,
  source_url: `https://exemplo.com/${origem}-${destino}-${date}`,
  origin: "auto",
});

// Série regular mensal (6 ondas) — deve continuar elegível e prever janela.
const SERIE_VALIDA = [
  valid("livelo", "smiles", "2026-02-05"),
  valid("livelo", "smiles", "2026-03-07"),
  valid("livelo", "smiles", "2026-04-06"),
  valid("livelo", "smiles", "2026-05-06"),
  valid("livelo", "smiles", "2026-06-05"),
  valid("livelo", "smiles", "2026-07-05"),
];

// Caso livelo → connectmiles. Registro A tem ANO SUSPEITO: a data de evento
// (2023-12-12, vinda do id/vigencia_fim, SEM início explícito) fica 943 dias
// antes da proveniência real (2026-07). Registro B é a campanha real recente.
const CONN_A_SUSPECT = {
  id: "livelo-connectmiles-transferencia-2023-12-12",
  origem: "livelo",
  destino: "connectmiles",
  tipo: "transferencia",
  percentual: 40,
  vigencia_inicio: null,
  vigencia_fim: "2023-12-12",
  first_seen: "2026-07-12",
  last_seen: "2026-07-13",
  observed_at: "2026-07-13",
  created_at: "2026-07-12",
  source_url: "https://fonte-a.com/livelo-connectmiles",
  origin: "auto",
};
const CONN_B_REAL = {
  id: "livelo-connectmiles-transferencia-2026-07-12",
  origem: "livelo",
  destino: "connectmiles",
  tipo: "transferencia",
  percentual: 40,
  vigencia_inicio: null,
  vigencia_fim: "2026-07-12",
  first_seen: "2026-07-10",
  last_seen: "2026-07-12",
  observed_at: "2026-07-12",
  created_at: "2026-07-10",
  source_url: "https://fonte-b.com/livelo-connectmiles",
  origin: "daily",
};

// Ledger completo COM proveniência (o que o loader corrigido entrega) e a
// variante SEM proveniência (o que o loader antigo, de 7 colunas, entregava).
const LEDGER_COM_PROV = [...SERIE_VALIDA, CONN_A_SUSPECT, CONN_B_REAL];
const LEDGER_SEM_PROV = LEDGER_COM_PROV.map(stripProvenance);

const composeOpts = {
  now: NOW,
  config: null,
  datasetComplete: true,
  pagesRead: 1,
  freshness: { status: "fresh", generatedAt: `${NOW}T12:00:00Z`, ageHours: 1 },
};

const routeOf = (fc, key) => fc.routes.find((r) => r.route === key);
const idsSorted = (rows) => rows.map((r) => r.id).sort();

// ============================================================ 1. loader proveniência
test("A1-1 · loader lê as colunas de proveniência (seleção canônica única)", () => {
  const cols = LEDGER_QUALITY_SELECT.split(",");
  // Todas as colunas de proveniência exigidas por campaign-quality presentes.
  for (const c of PROVENANCE_COLUMNS) {
    assert.ok(cols.includes(c), `seleção deve conter a coluna de proveniência ${c}`);
  }
  // Colunas de evento/identidade continuam presentes (sem regressão).
  for (const c of ["id", "tipo", "origem", "destino", "percentual", "vigencia_inicio", "vigencia_fim"]) {
    assert.ok(cols.includes(c), `seleção deve conter ${c}`);
  }
  assert.equal(cols.length, LEDGER_QUALITY_COLUMNS.length, "sem colunas duplicadas");

  // Guarda de regressão: os DOIS loaders reusam a fonte única e nenhum voltou
  // à seleção reduzida de 7 colunas.
  const fcSrc = readFileSync(new URL("../lib/admin-forecast.ts", import.meta.url), "utf8");
  const rdSrc = readFileSync(new URL("../lib/admin-radar.ts", import.meta.url), "utf8");
  assert.ok(/LEDGER_QUALITY_SELECT/.test(fcSrc), "admin-forecast deve reusar LEDGER_QUALITY_SELECT");
  assert.ok(/LEDGER_QUALITY_SELECT/.test(rdSrc), "admin-radar deve reusar LEDGER_QUALITY_SELECT");
  assert.ok(
    /fetchAllRows<CampaignRow>\("campaigns", FORECAST_LEDGER_SELECT\)/.test(fcSrc),
    "admin-forecast deve buscar campaigns com FORECAST_LEDGER_SELECT",
  );
  const REDUZIDA = '"id,tipo,origem,destino,percentual,vigencia_inicio,vigencia_fim"';
  assert.ok(!fcSrc.includes(REDUZIDA), "admin-forecast NÃO pode conter a seleção reduzida de 7 colunas");
});

// ================================================================= 2. suspect_year
test("A1-2 · suspect_year dispara com proveniência e exclui o registro", () => {
  const t = evaluateTemporalPlausibility(CONN_A_SUSPECT);
  assert.equal(t.status, "suspect_year", "registro com ano fabricado deve ser suspect_year");
  assert.equal(t.severity, "critical");
  assert.equal(t.includeInPrediction, false, "suspect_year não entra na previsão");
  assert.ok(t.flags.includes("suspect_year"));

  // Sem proveniência (loader antigo), o mesmo registro passava como válido.
  const semProv = evaluateTemporalPlausibility(stripProvenance(CONN_A_SUSPECT));
  assert.equal(semProv.status, "valid", "sem proveniência o registro suspeito escapava");
  assert.equal(semProv.includeInPrediction, true);
});

// ==================================================== 3. caso livelo → connectmiles
test("A1-3 · livelo → connectmiles: A (ano suspeito) excluída, B (real) elegível", () => {
  const q = assessCampaignQuality(LEDGER_COM_PROV, { normalize: normProgram });
  const elig = new Set(q.eligibleRows.map((r) => r.id));
  assert.ok(!elig.has(CONN_A_SUSPECT.id), "registro de ano suspeito deve ser excluído");
  assert.ok(elig.has(CONN_B_REAL.id), "campanha real recente deve permanecer elegível");
  const exA = q.excluded.find((e) => e.id === CONN_A_SUSPECT.id);
  assert.ok(exA, "A deve aparecer entre as excluídas");
  assert.ok(/suspect_year/.test(exA.reason), `motivo deve conter suspect_year (${exA.reason})`);
  // A data candidata resolve para 2023-12-12 (via id/vigencia_fim), sem início.
  assert.equal(resolveEventDateCandidate(CONN_A_SUSPECT), "2023-12-12");
});

// ================================================================ 4. intervalo 943
test("A1-4 · não existe intervalo de 943 dias na série corrigida", () => {
  const fc = buildForecast(LEDGER_COM_PROV, { now: NOW });
  const route = routeOf(fc, "livelo→connectmiles");
  assert.ok(route, "rota deve existir");
  assert.ok(!route.intervals.includes(943), "943 não pode aparecer nos intervalos");
  assert.notEqual(route.maxIntervalDays, 943, "maxIntervalDays não pode ser 943");
  assert.equal(route.maxIntervalDays, null, "com 1 onda elegível não há intervalo");

  // Contraste (prova da raiz): SEM proveniência, o 943 reaparece.
  const semProv = buildForecast(LEDGER_SEM_PROV, { now: NOW });
  const routeBug = routeOf(semProv, "livelo→connectmiles");
  assert.equal(routeBug.maxIntervalDays, 943, "sem proveniência o bug de 943 deve reaparecer");
});

// ================================================================= 5. janela 2029
test("A1-5 · não existe previsão/janela em 2029", () => {
  const fc = buildForecast(LEDGER_COM_PROV, { now: NOW });
  const route = routeOf(fc, "livelo→connectmiles");
  assert.equal(route.windowStart, null, "sem base para prever (1 onda) — nunca 2029");
  const anyWindow = [...fc.routes, ...fc.clusters].flatMap((r) => [r.windowStart, r.windowEnd]);
  assert.ok(!anyWindow.some((d) => typeof d === "string" && d.startsWith("2029")), "nenhuma janela em 2029");
  const items = [...radarItems(fc.routes), ...radarItems(fc.clusters)];
  assert.ok(!items.some((i) => /2029/.test(i.window)), "nenhum item de radar em 2029");

  // Contraste: sem proveniência, o motor projetava uma janela em 2029.
  const semProv = buildForecast(LEDGER_SEM_PROV, { now: NOW });
  const routeBug = routeOf(semProv, "livelo→connectmiles");
  assert.ok(routeBug.windowStart?.startsWith("2029"), "sem proveniência a janela caía em 2029");
});

// ================================================ 6. paridade elegíveis Forecast×Radar
test("A1-6 · Forecast e Radar concordam na amostra ELEGÍVEL", () => {
  const fc = buildForecast(LEDGER_COM_PROV, { now: NOW });
  const vm = composeRadarViewModel(LEDGER_COM_PROV, composeOpts);

  const fcEligible = idsSorted(fc.quality.eligibleRows);
  // Reagrega as elegíveis a partir do view-model do Radar (série.quality.used).
  const vmUsed = new Set();
  for (const s of vm.series) for (const r of s.quality.used) vmUsed.add(r.id);
  assert.deepEqual([...vmUsed].sort(), fcEligible, "conjunto elegível deve ser idêntico");
  assert.equal(vm.health.campaignsEligible, fc.quality.counters.totalEligible, "contagem elegível idêntica");
  // Sanidade: as 6 válidas + B real = 7 elegíveis; A suspeita fora.
  assert.equal(fc.quality.counters.totalEligible, 7);
});

// ================================================ 7. paridade excluídas Forecast×Radar
test("A1-7 · Forecast e Radar concordam nas campanhas EXCLUÍDAS", () => {
  const fc = buildForecast(LEDGER_COM_PROV, { now: NOW });
  const vm = composeRadarViewModel(LEDGER_COM_PROV, composeOpts);

  const fcExcluded = idsSorted(fc.quality.excluded);
  const vmExcluded = new Set();
  for (const s of vm.series) for (const e of s.quality.excluded) vmExcluded.add(e.id);
  assert.deepEqual([...vmExcluded].sort(), fcExcluded, "conjunto excluído deve ser idêntico");
  assert.deepEqual(fcExcluded, [CONN_A_SUSPECT.id], "somente o registro de ano suspeito é excluído");
  assert.equal(vm.health.campaignsExcluded, fc.quality.excluded.length, "contagem excluída idêntica");
});

// ============================================================= 8. regressão válidas
test("A1-8 · séries válidas seguem elegíveis e com previsão (sem falso positivo)", () => {
  const fc = buildForecast(LEDGER_COM_PROV, { now: NOW });
  const route = routeOf(fc, "livelo→smiles");
  assert.ok(route, "série válida deve existir");
  assert.equal(route.samples, 6, "todas as 6 ondas válidas preservadas");
  assert.notEqual(route.confidence, "em-formacao");
  assert.ok(route.windowStart, "série válida deve prever uma janela");
  assert.ok(route.editorialEligible, "série válida elegível editorialmente");
  // Nenhuma das 6 válidas foi excluída.
  const excluidos = new Set(fc.quality.excluded.map((e) => e.id));
  for (const r of SERIE_VALIDA) assert.ok(!excluidos.has(r.id), `${r.id} não pode ser excluída`);
});

// ==================================================== 9. regressão /admin/forecast
test("A1-9 · /admin/forecast: caso 943 não exibe 'Maior intervalo' nem vira item", () => {
  // Replica o transform da tela (loadForecast): buildForecast → radarItems.
  const fc = buildForecast(LEDGER_COM_PROV, { now: NOW });
  const route = routeOf(fc, "livelo→connectmiles");
  // A tela imprime `${v.maxIntervalDays}d` só quando != null; corrigido = null.
  assert.equal(route.maxIntervalDays, null, "não deve exibir 'Maior intervalo 943d'");
  const items = radarItems(fc.routes);
  assert.ok(
    !items.some((i) => /connectmiles/i.test(i.label) && /2029/.test(i.window)),
    "connectmiles não pode virar item editorial com janela 2029",
  );
});

// ============================================================ 10. nenhuma escrita
test("A1-10 · caminho puro não faz NENHUMA chamada de rede (sem tocar no banco)", () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (...args) => {
    calls++;
    throw new Error(`chamada de rede inesperada: ${String(args[0])}`);
  };
  try {
    assessCampaignQuality(LEDGER_COM_PROV, { normalize: normProgram });
    buildForecast(LEDGER_COM_PROV, { now: NOW });
    composeRadarViewModel(LEDGER_COM_PROV, composeOpts);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(calls, 0, "os motores são puros — nenhuma leitura/escrita no Supabase");
});

// ====================================================== 11. matemática do motor intacta
test("A1-11 · matemática do motor inalterada (limiares + números das válidas)", () => {
  // Defaults de contenção do motor não mudaram.
  assert.deepEqual(
    {
      minSamples: DEFAULT_FORECAST_CONFIG.minSamples,
      samplesAlta: DEFAULT_FORECAST_CONFIG.samplesAlta,
      samplesMedia: DEFAULT_FORECAST_CONFIG.samplesMedia,
      cvAlta: DEFAULT_FORECAST_CONFIG.cvAlta,
      cvMedia: DEFAULT_FORECAST_CONFIG.cvMedia,
      minEditorialWaves: DEFAULT_FORECAST_CONFIG.minEditorialWaves,
      longIntervalWarningDays: DEFAULT_FORECAST_CONFIG.longIntervalWarningDays,
      extremeIntervalDays: DEFAULT_FORECAST_CONFIG.extremeIntervalDays,
      maxEditorialHorizonDays: DEFAULT_FORECAST_CONFIG.maxEditorialHorizonDays,
    },
    {
      minSamples: 2, samplesAlta: 4, samplesMedia: 3, cvAlta: 0.35, cvMedia: 0.6,
      minEditorialWaves: 5, longIntervalWarningDays: 365, extremeIntervalDays: 540,
      maxEditorialHorizonDays: 180,
    },
  );

  // Para uma série VÁLIDA, adicionar proveniência NÃO altera nenhum número do
  // motor — só a elegibilidade de registros temporalmente suspeitos muda.
  const KEYS = [
    "confidence", "windowStart", "windowEnd", "samples", "medianDays", "meanDays",
    "stdevDays", "cadence", "typicalPercent", "intervals", "maxIntervalDays",
    "editorialEligible", "editorialBlockReason", "basis",
  ];
  const proj = (r) => Object.fromEntries(KEYS.map((k) => [k, r[k]]));
  const com = routeOf(buildForecast(LEDGER_COM_PROV, { now: NOW }), "livelo→smiles");
  const sem = routeOf(buildForecast(LEDGER_SEM_PROV, { now: NOW }), "livelo→smiles");
  assert.deepEqual(proj(com), proj(sem), "números da série válida idênticos com/sem proveniência");
});
