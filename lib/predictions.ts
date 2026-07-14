// Motor de previsão de janelas — fonte da verdade (TypeScript).
//
// Prevê a PRÓXIMA janela de cada rota de transferência por recorrência do
// histórico do ledger (campanhas), aproveitando o backfill de 18 meses.
//
// Duas visões:
//   • routes   — por rota origem→destino (granular)
//   • clusters — por destino (→programa), consolidando o histórico fragmentado
//                de campanhas program-wide que atingem várias origens.
//
// Regra editorial: isto é PROJEÇÃO ESTATÍSTICA, nunca veredito nem promessa.
// Sem histórico suficiente → "em-formacao". Nunca chuta uma data sem base.
// "Ondas" quase simultâneas (mesma campanha em várias origens) são colapsadas
// antes de medir cadência, para não superestimar a frequência.
//
// ESPELHO: scripts/predictions.mjs replica esta lógica para o pipeline de
// render (Node ESM puro, sem build). Ao alterar o algoritmo aqui, replique lá.

export type Confidence = "alta" | "media" | "baixa" | "em-formacao";
export type Cadence = "mensal" | "irregular" | "esparsa" | null;
export type Scope = "route" | "cluster";

// Linha crua da tabela `campaigns` do Supabase (campos usados aqui).
export interface CampaignRow {
  id?: string | null;
  tipo?: string | null;
  origem?: string | null;
  destino?: string | null;
  percentual?: number | string | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  observed_at?: string | null;
  first_seen?: string | null;
  status?: string | null;
}

export interface Forecast {
  scope: Scope;
  route: string; // "origem→destino" (route) ou "→destino" (cluster)
  origem: string | null; // null em cluster
  destino: string;
  confidence: Confidence;
  windowStart: string | null; // ISO date; null quando em-formacao
  windowEnd: string | null;
  samples: number; // nº de janelas (ondas) históricas distintas
  medianDays: number | null;
  meanDays: number | null;
  stdevDays: number | null;
  lastWindow: string | null;
  cadence: Cadence;
  typicalPercent: number | null;
  basis: string;
}

export interface ForecastResult {
  generatedFor: string; // "now" usado (ISO date)
  routesTracked: number;
  clustersTracked: number;
  withPrediction: number; // rotas+clusters com janela prevista
  routes: Forecast[];
  clusters: Forecast[];
}

// ---------------------------------------------------------------------------
// Normalização de datas e programas
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TRAILING_DATE = /(\d{4}-\d{2}-\d{2})$/;
const DAY_MS = 86_400_000;
const WAVE_EPSILON_DAYS = 3; // janelas ≤ 3 dias entre si = mesma onda

function isValidISODate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO_DATE.test(s.slice(0, 10))) return false;
  return Number.isFinite(Date.parse(s.slice(0, 10) + "T00:00:00Z"));
}

// Data REAL da janela — nunca observed_at/first_seen (artefatos de ingestão do
// backfill, que destroem a recorrência). Ordem de confiança:
//   vigencia_inicio > data no id (…-YYYY-MM-DD) > vigencia_fim válido.
export function windowDate(row: CampaignRow): string | null {
  if (isValidISODate(row.vigencia_inicio)) return String(row.vigencia_inicio).slice(0, 10);
  const idMatch = typeof row.id === "string" ? row.id.match(TRAILING_DATE) : null;
  if (idMatch && isValidISODate(idMatch[1])) return idMatch[1];
  if (isValidISODate(row.vigencia_fim)) return String(row.vigencia_fim).slice(0, 10);
  return null;
}

// bb ≠ bb-empresas (programas distintos) permanecem separados de propósito.
const PROGRAM_ALIASES: Record<string, string> = {
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

export function normProgram(s: unknown): string {
  const base = String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return PROGRAM_ALIASES[base] ?? base;
}

// ---------------------------------------------------------------------------
// Aritmética de datas e estatística
// ---------------------------------------------------------------------------

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS);
}

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

// Colapsa datas ≤ WAVE_EPSILON_DAYS entre si na mais antiga da onda.
function collapseWaves(sortedDates: string[]): string[] {
  const out: string[] = [];
  for (const d of sortedDates) {
    if (!out.length || daysBetween(out[out.length - 1], d) > WAVE_EPSILON_DAYS) out.push(d);
  }
  return out;
}

function todayISO(now?: string): string {
  if (now && isValidISODate(now)) return now.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function classify(samples: number, cv: number, medianDays: number): { confidence: Confidence; cadence: Cadence } {
  if (samples < 2) return { confidence: "em-formacao", cadence: null };
  const cadence: Cadence =
    samples >= 3 && medianDays >= 24 && medianDays <= 37 && cv <= 0.4
      ? "mensal"
      : medianDays > 75
        ? "esparsa"
        : "irregular";
  let confidence: Confidence;
  if (samples >= 4 && cv <= 0.35) confidence = "alta";
  else if (samples >= 3 && cv <= 0.6) confidence = "media";
  else confidence = "baixa";
  return { confidence, cadence };
}

// Núcleo de análise: recebe as datas (já com ondas colapsadas) e produz a
// previsão. `now` rola a janela prevista para o futuro (nunca prevê o passado).
function analyze(
  scope: Scope,
  route: string,
  origem: string | null,
  destino: string,
  waves: string[],
  percents: number[],
  now: string,
): Forecast {
  const samples = waves.length;
  const last = samples ? waves[samples - 1] : null;
  const typicalPercent = percents.length ? median(percents) : null;

  if (samples < 2) {
    return {
      scope, route, origem, destino,
      confidence: "em-formacao",
      windowStart: null, windowEnd: null,
      samples, medianDays: null, meanDays: null, stdevDays: null,
      lastWindow: last, cadence: null, typicalPercent,
      basis: `${samples} janela(s) — histórico insuficiente para prever`,
    };
  }

  const intervals: number[] = [];
  for (let i = 1; i < waves.length; i++) intervals.push(daysBetween(waves[i - 1], waves[i]));
  const med = median(intervals);
  const mn = Math.round(mean(intervals));
  const sd = Math.round(stdev(intervals));
  const cv = mn > 0 ? sd / mn : 1;
  const { confidence, cadence } = classify(samples, cv, med);

  let center = addDays(last as string, med || 30);
  let guard = 0;
  while (daysBetween(now, center) < 0 && guard < 240) {
    center = addDays(center, med || 30);
    guard++;
  }
  const half = Math.min(12, Math.max(3, Math.round(sd / 2) || 3));

  const cadenceLabel =
    cadence === "mensal" ? "cadência mensal" : cadence === "esparsa" ? "cadência esparsa" : "cadência irregular";

  return {
    scope, route, origem, destino, confidence,
    windowStart: addDays(center, -half),
    windowEnd: addDays(center, half),
    samples, medianDays: med, meanDays: mn, stdevDays: sd,
    lastWindow: last, cadence, typicalPercent,
    basis: `${samples} janelas · ${cadenceLabel} ~${med} dias (média ${mn}, desvio ${sd}) · última ${last}`,
  };
}

const RANK: Record<Confidence, number> = { alta: 0, media: 1, baixa: 2, "em-formacao": 3 };

function sortForecasts(a: Forecast, b: Forecast): number {
  if (RANK[a.confidence] !== RANK[b.confidence]) return RANK[a.confidence] - RANK[b.confidence];
  if (a.windowStart && b.windowStart && a.windowStart !== b.windowStart) return a.windowStart < b.windowStart ? -1 : 1;
  return a.route.localeCompare(b.route);
}

// ---------------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------------

export function buildForecast(rows: CampaignRow[], opts: { now?: string } = {}): ForecastResult {
  const now = todayISO(opts.now);
  const routeGroups = new Map<string, { origem: string; destino: string; dates: Set<string>; percents: number[] }>();
  const destGroups = new Map<string, { destino: string; dates: Set<string>; percents: number[] }>();

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

  const routes: Forecast[] = [];
  for (const [route, g] of Array.from(routeGroups.entries())) {
    const waves = collapseWaves(Array.from(g.dates).sort());
    routes.push(analyze("route", route, g.origem, g.destino, waves, g.percents, now));
  }
  routes.sort(sortForecasts);

  const clusters: Forecast[] = [];
  for (const [destino, g] of Array.from(destGroups.entries())) {
    const waves = collapseWaves(Array.from(g.dates).sort());
    clusters.push(analyze("cluster", `→${destino}`, null, destino, waves, g.percents, now));
  }
  clusters.sort(sortForecasts);

  const withPrediction =
    routes.filter((r) => r.confidence !== "em-formacao").length +
    clusters.filter((c) => c.confidence !== "em-formacao").length;

  return { generatedFor: now, routesTracked: routes.length, clustersTracked: clusters.length, withPrediction, routes, clusters };
}

// Janelas que se abrem dentro do horizonte [now, now+horizonDays]. Usado pelos
// digests (daily: horizonte curto; weekly: horizonte da semana). Combina rotas
// e clusters; para uma mesma janela sobreposta, mantém a de maior confiança.
export function upcomingWindows(
  forecast: ForecastResult,
  opts: { now?: string; horizonDays?: number; minConfidence?: Confidence; include?: Scope[] } = {},
): Forecast[] {
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
      return daysBetween(now, r.windowStart) <= horizon && daysBetween(now, r.windowEnd) >= 0;
    })
    .sort(sortForecasts);
}
