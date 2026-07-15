// Motor de previsão de janelas — ESPELHO ESM de lib/forecast.ts.
//
// Node ESM puro (o pipeline de render roda sem build de TypeScript). A lógica
// é idêntica à de lib/forecast.ts; ao alterar o algoritmo, replique nos dois.
//
// Regra editorial: PROJEÇÃO ESTATÍSTICA, nunca veredito nem promessa. Sem
// histórico suficiente → "em-formacao". Nunca chuta uma data sem base. Ondas
// quase simultâneas (mesma campanha em várias origens) são colapsadas.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TRAILING_DATE = /(\d{4}-\d{2}-\d{2})$/;
const DAY_MS = 86_400_000;
const WAVE_EPSILON_DAYS = 3;

// Parâmetros ajustáveis do motor (espelho de lib/forecast.ts). Defaults =
// constantes históricas. O admin persiste em forecast_config; o CLI passa via
// opts.config para os digests refletirem a mesma calibração.
export const DEFAULT_FORECAST_CONFIG = {
  waveEpsilonDays: WAVE_EPSILON_DAYS,
  minSamples: 2,
  samplesAlta: 4,
  samplesMedia: 3,
  cvAlta: 0.35,
  cvMedia: 0.6,
  horizonDaily: 10,
  horizonWeekly: 21,
  // Contenção Fase C0 (espelho de lib/forecast.ts; ver docs §27c).
  minEditorialWaves: 5,
  longIntervalWarningDays: 365,
  extremeIntervalDays: 540,
  maxEditorialHorizonDays: 180,
};

export function resolveConfig(partial) {
  return { ...DEFAULT_FORECAST_CONFIG, ...(partial ?? {}) };
}

function isValidISODate(s) {
  if (typeof s !== "string" || !ISO_DATE.test(s.slice(0, 10))) return false;
  return Number.isFinite(Date.parse(s.slice(0, 10) + "T00:00:00Z"));
}

export function windowDate(row) {
  if (isValidISODate(row.vigencia_inicio)) return String(row.vigencia_inicio).slice(0, 10);
  const idMatch = typeof row.id === "string" ? row.id.match(TRAILING_DATE) : null;
  if (idMatch && isValidISODate(idMatch[1])) return idMatch[1];
  if (isValidISODate(row.vigencia_fim)) return String(row.vigencia_fim).slice(0, 10);
  return null;
}

const PROGRAM_ALIASES = {
  "azul fidelidade": "azul",
  "latam pass": "latampass",
  "latam-pass": "latampass",
  tudoazul: "azul",
  "smiles gol": "smiles",
  "connect miles": "connectmiles",
  "life miles": "lifemiles",
  "amex mr": "amex-mr",
  "membership rewards": "amex-mr",
};

export function normProgram(s) {
  const base = String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return PROGRAM_ALIASES[base] ?? base;
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS);
}

function addDays(iso, n) {
  return new Date(Date.parse(iso + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
}

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function collapseWaves(sortedDates, epsilon) {
  const out = [];
  for (const d of sortedDates) {
    if (!out.length || daysBetween(out[out.length - 1], d) > epsilon) out.push(d);
  }
  return out;
}

function todayISO(now) {
  if (now && isValidISODate(now)) return now.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function classify(samples, cv, medianDays, cfg) {
  if (samples < cfg.minSamples) return { confidence: "em-formacao", cadence: null };
  const cadence =
    samples >= 3 && medianDays >= 24 && medianDays <= 37 && cv <= 0.4
      ? "mensal"
      : medianDays > 75
        ? "esparsa"
        : "irregular";
  let confidence;
  if (samples >= cfg.samplesAlta && cv <= cfg.cvAlta) confidence = "alta";
  else if (samples >= cfg.samplesMedia && cv <= cfg.cvMedia) confidence = "media";
  else confidence = "baixa";
  return { confidence, cadence };
}

function analyze(scope, route, origem, destino, waves, percents, now, cfg) {
  const samples = waves.length;
  const last = samples ? waves[samples - 1] : null;
  const typicalPercent = percents.length ? median(percents) : null;

  if (samples < cfg.minSamples) {
    return {
      scope, route, origem, destino,
      confidence: "em-formacao",
      windowStart: null, windowEnd: null,
      samples, medianDays: null, meanDays: null, stdevDays: null,
      lastWindow: last, cadence: null, typicalPercent,
      basis: `${samples} janela(s) — histórico insuficiente para prever`,
      windows: waves, intervals: [],
      maxIntervalDays: null,
      warnings: [],
      editorialEligible: false,
      editorialBlockReason: `em_formacao (${samples}<${cfg.minSamples} ondas)`,
      requiresEditorialReview: false,
    };
  }

  const intervals = [];
  for (let i = 1; i < waves.length; i++) intervals.push(daysBetween(waves[i - 1], waves[i]));
  const med = median(intervals);
  const mn = Math.round(mean(intervals));
  const sd = Math.round(stdev(intervals));
  const cv = mn > 0 ? sd / mn : 1;
  const { confidence, cadence } = classify(samples, cv, med, cfg);

  let center = addDays(last, med || 30);
  let guard = 0;
  while (daysBetween(now, center) < 0 && guard < 240) {
    center = addDays(center, med || 30);
    guard++;
  }
  const half = Math.min(12, Math.max(3, Math.round(sd / 2) || 3));

  const cadenceLabel =
    cadence === "mensal" ? "cadência mensal" : cadence === "esparsa" ? "cadência esparsa" : "cadência irregular";

  const gate = editorialGate(samples, intervals, daysBetween(now, center), cfg);

  return {
    scope, route, origem, destino, confidence,
    windowStart: addDays(center, -half),
    windowEnd: addDays(center, half),
    samples, medianDays: med, meanDays: mn, stdevDays: sd,
    lastWindow: last, cadence, typicalPercent,
    basis: `${samples} janelas · ${cadenceLabel} ~${med} dias (média ${mn}, desvio ${sd}) · última ${last}`,
    windows: waves, intervals,
    maxIntervalDays: gate.maxIntervalDays,
    warnings: gate.warnings,
    editorialEligible: gate.editorialEligible,
    editorialBlockReason: gate.editorialBlockReason,
    requiresEditorialReview: gate.requiresEditorialReview,
  };
}

// Gate de contenção Fase C0 — ESPELHO de lib/forecast.ts editorialGate().
export function editorialGate(samples, intervals, daysToCenter, cfg) {
  const warnings = [];
  const maxIntervalDays = intervals.length ? Math.max(...intervals) : null;

  if (maxIntervalDays != null) {
    if (maxIntervalDays > 900)
      warnings.push(`intervalo extremo de ${maxIntervalDays} dias (>900) — possível anomalia de dado (data suspeita, duplicidade ou lacuna de cobertura); revisar antes de publicar`);
    else if (maxIntervalDays >= cfg.extremeIntervalDays)
      warnings.push(`intervalo extremo de ${maxIntervalDays} dias (≥${cfg.extremeIntervalDays})`);
    else if (maxIntervalDays >= cfg.longIntervalWarningDays)
      warnings.push(`intervalo longo de ${maxIntervalDays} dias (≥${cfg.longIntervalWarningDays})`);
  }

  const beyondHorizon = daysToCenter > cfg.maxEditorialHorizonDays;
  if (beyondHorizon)
    warnings.push(`janela prevista a ${daysToCenter} dias (>${cfg.maxEditorialHorizonDays}) — exige revisão editorial`);
  if (daysToCenter > 365) warnings.push(`previsão a mais de 365 dias — revisão crítica`);

  let editorialEligible = true;
  let editorialBlockReason = null;
  if (samples < cfg.minEditorialWaves) {
    editorialEligible = false;
    editorialBlockReason = `historico_insuficiente_para_publicacao (${samples}<${cfg.minEditorialWaves} ondas)`;
  } else if (maxIntervalDays != null && maxIntervalDays >= cfg.extremeIntervalDays) {
    editorialEligible = false;
    editorialBlockReason = `intervalo_extremo (${maxIntervalDays}d ≥ ${cfg.extremeIntervalDays})`;
  } else if (beyondHorizon) {
    editorialEligible = false;
    editorialBlockReason = `horizonte_excedido (${daysToCenter}d > ${cfg.maxEditorialHorizonDays})`;
  }

  return { maxIntervalDays, warnings, editorialEligible, editorialBlockReason, requiresEditorialReview: beyondHorizon };
}

const RANK = { alta: 0, media: 1, baixa: 2, "em-formacao": 3 };

function sortForecasts(a, b) {
  if (RANK[a.confidence] !== RANK[b.confidence]) return RANK[a.confidence] - RANK[b.confidence];
  if (a.windowStart && b.windowStart && a.windowStart !== b.windowStart) return a.windowStart < b.windowStart ? -1 : 1;
  return a.route.localeCompare(b.route);
}

export function buildForecast(rows, opts = {}) {
  const now = todayISO(opts.now);
  const cfg = resolveConfig(opts.config);
  const routeGroups = new Map();
  const destGroups = new Map();

  for (const row of rows) {
    if (normProgram(row.tipo) !== "transferencia") continue;
    const d = windowDate(row);
    if (!d) continue;
    const origem = normProgram(row.origem);
    const destino = normProgram(row.destino);
    if (!origem || !destino) continue;
    const pct = typeof row.percentual === "number" ? row.percentual : Number(row.percentual);
    const validPct = Number.isFinite(pct) && pct > 0 ? pct : null;

    const rk = `${origem}→${destino}`;
    let rg = routeGroups.get(rk);
    if (!rg) routeGroups.set(rk, (rg = { origem, destino, dates: new Set(), percents: [] }));
    rg.dates.add(d);
    if (validPct != null) rg.percents.push(validPct);

    let dg = destGroups.get(destino);
    if (!dg) destGroups.set(destino, (dg = { destino, dates: new Set(), percents: [] }));
    dg.dates.add(d);
    if (validPct != null) dg.percents.push(validPct);
  }

  const routes = [];
  for (const [route, g] of Array.from(routeGroups.entries())) {
    const waves = collapseWaves(Array.from(g.dates).sort(), cfg.waveEpsilonDays);
    routes.push(analyze("route", route, g.origem, g.destino, waves, g.percents, now, cfg));
  }
  routes.sort(sortForecasts);

  const clusters = [];
  for (const [destino, g] of Array.from(destGroups.entries())) {
    const waves = collapseWaves(Array.from(g.dates).sort(), cfg.waveEpsilonDays);
    clusters.push(analyze("cluster", `→${destino}`, null, destino, waves, g.percents, now, cfg));
  }
  clusters.sort(sortForecasts);

  const withPrediction =
    routes.filter((r) => r.confidence !== "em-formacao").length +
    clusters.filter((c) => c.confidence !== "em-formacao").length;

  return { generatedFor: now, routesTracked: routes.length, clustersTracked: clusters.length, withPrediction, routes, clusters };
}

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatWindow(startISO, endISO) {
  if (!startISO || !endISO) return "sem base";
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const [ey, em, ed] = endISO.split("-").map(Number);
  const crossYear = sy !== ey;
  const left = sm === em && !crossYear ? `${sd}` : `${sd} ${MONTHS_PT[sm - 1]}${crossYear ? " " + sy : ""}`;
  const right = `${ed} ${MONTHS_PT[em - 1]}${crossYear ? " " + ey : ""}`;
  return `${left} a ${right}`;
}

const PROGRAM_LABELS = {
  latampass: "Latam Pass",
  smiles: "Smiles",
  azul: "Azul Fidelidade",
  livelo: "Livelo",
  esfera: "Esfera",
  connectmiles: "ConnectMiles",
  lifemiles: "LifeMiles",
  inter: "Inter",
  itau: "Itaú",
  credicard: "Credicard",
  bb: "Banco do Brasil",
  "bb-empresas": "BB Empresas",
  "amex-mr": "Amex MR",
};

export function programLabel(slug) {
  return PROGRAM_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function radarItems(forecasts) {
  return forecasts
    // Gate C0: só séries editorialmente elegíveis viram item de radar (espelho TS).
    .filter((f) => f.confidence !== "em-formacao" && f.windowStart && f.editorialEligible)
    .map((f) => ({
      label: f.scope === "cluster" ? programLabel(f.destino) : `${programLabel(f.origem)} → ${programLabel(f.destino)}`,
      confidence: f.confidence,
      window: formatWindow(f.windowStart, f.windowEnd),
      basis: f.basis,
      ...(f.typicalPercent ? { bonus: `~${f.typicalPercent}%` } : {}),
    }));
}

export function upcomingWindows(forecast, opts = {}) {
  const now = todayISO(opts.now ?? forecast.generatedFor);
  const horizon = opts.horizonDays ?? 10;
  const floor = RANK[opts.minConfidence ?? "baixa"];
  const include = opts.include ?? ["route", "cluster"];
  const pool = [
    ...(include.includes("route") ? forecast.routes : []),
    ...(include.includes("cluster") ? forecast.clusters : []),
  ];
  return pool
    .filter((r) => {
      if (RANK[r.confidence] > floor) return false;
      if (!r.windowStart || !r.windowEnd) return false;
      if (!r.editorialEligible) return false; // gate C0 (espelho TS)
      return daysBetween(now, r.windowStart) <= horizon && daysBetween(now, r.windowEnd) >= 0;
    })
    .sort(sortForecasts);
}
