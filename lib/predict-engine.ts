// Motor "predict" v2 (campaign_predict_v2) — RFC-009.
//
// Determinístico e puro (sem I/O). LLM NUNCA entra aqui; só na extração.
// Dois modelos separados por série:
//   • Modelo A (quando): sobrevivência empírica ponderada por recência →
//     hazard condicional dado days_since_last → P{7,15,30,60,90,180} MONOTÔNICO
//     + data central + janela.
//   • Modelo B (quanto): distribuição empírica dos percentuais ponderada por
//     recência → top-3 candidatos com probabilidades somando 1.
// Readiness com BLOQUEIO (< minSamples → insuficiente). Backtesting walk-forward
// (nunca usa dado futuro). Confiança rebaixada por variância/backtest.
//
// Formação de séries (datas, normalização, ondas, agrupamento) vem do
// series-builder compartilhado com o Forecast (ADR-SERIES-001).

import {
  windowDate,
  normProgram,
  toMs,
  daysBetween,
  addDays,
  collapseWaves,
  groupTransferSeries,
  type CampaignRow,
} from "./series-builder.ts";
import { assessCampaignQuality, type CampaignQualityAssessment } from "./campaign-quality.ts";

export type Confidence = "alta" | "media" | "baixa" | "insuficiente";
export type Readiness =
  | "ready"
  | "ready_with_warnings"
  | "insufficient_history"
  | "backfill_incomplete"
  | "data_quality_blocked";
export type Scope = "route" | "cluster";

export const HORIZONS = [7, 15, 30, 60, 90, 180] as const;
export type Horizon = (typeof HORIZONS)[number];
export type WindowProbs = { p7: number; p15: number; p30: number; p60: number; p90: number; p180: number };

export interface BonusCandidate {
  value: number;
  probability: number;
}

export interface BacktestResult {
  observations: number;
  medianDateErrorDays: number | null;
  windowHitRate: number | null;
  exactBonusAccuracy: number | null;
  bonusAccuracy5pp: number | null;
}

export interface Prediction {
  scope: Scope;
  seriesKey: string;
  program: string; // destino canônico
  origem: string | null; // null em cluster
  destino: string;
  asOf: string; // ISO date usado
  // histórico
  recordsTotal: number;
  recordsRecent: number;
  events: string[]; // datas (ondas) ISO, ordenadas
  intervals: number[]; // dias entre ondas consecutivas
  daysSinceLast: number | null;
  medianIntervalAll: number | null;
  medianIntervalRecent: number | null;
  // Modelo A
  probabilities: WindowProbs | null;
  centralDate: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  // Modelo B
  bonusCandidates: BonusCandidate[];
  bonusOutros: number;
  // gate
  readiness: Readiness;
  confidence: Confidence;
  blockReason: string | null;
  warnings: string[];
  // meta
  backtest: BacktestResult | null;
  explanation: string;
  modelVersion: string;
  backtestVersion: string;
}

export interface PredictConfig {
  waveEpsilonDays: number; // ondas ≤ N dias entre si = mesma campanha
  minSamples: number; // < N eventos → bloqueia (insufficient_history)
  samplesMedia: number; // eventos p/ candidatar-se a confiança média
  samplesAlta: number; // eventos p/ candidatar-se a confiança alta
  cvMedia: number; // coef. de variação máx. p/ media
  cvAlta: number; // coef. de variação máx. p/ alta
  recencyHalfLifeEvents: number; // meia-vida (em eventos) do peso de recência
  recentWindowEvents: number; // "recente" = últimos N eventos (para medianas)
  backtestMinObs: number; // mínimo de observações p/ confiar no backtest
}

export const DEFAULT_PREDICT_CONFIG: PredictConfig = {
  waveEpsilonDays: 3,
  minSamples: 3,
  samplesMedia: 6,
  samplesAlta: 10,
  cvMedia: 0.6,
  cvAlta: 0.35,
  recencyHalfLifeEvents: 4,
  recentWindowEvents: 5,
  backtestMinObs: 3,
};

export const MODEL_VERSION = "campaign_predict_v2";
export const BACKTEST_VERSION = "walk_forward_v1";

// ---------------------------------------------------------------------------
// Estatística (semântica própria deste motor: null em vazio, sem
// arredondamento — diferente do Forecast; por isso NÃO vive no series-builder)
// ---------------------------------------------------------------------------

// Peso de recência exponencial: evento mais recente (rank 0) pesa 1; decai por
// meia-vida em nº de eventos. rankFromNewest = 0 para o mais novo.
function recencyWeight(rankFromNewest: number, halfLife: number): number {
  return Math.pow(0.5, rankFromNewest / Math.max(1, halfLife));
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
function stdev(xs: number[]): number | null {
  const m = mean(xs);
  if (m == null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}
// Quantil por interpolação linear.
function quantile(xs: number[], q: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo];
  return s[lo] + (pos - lo) * (s[hi] - s[lo]);
}

// ---------------------------------------------------------------------------
// Séries
// ---------------------------------------------------------------------------

const HORIZON_KEYS: Record<Horizon, keyof WindowProbs> = {
  7: "p7",
  15: "p15",
  30: "p30",
  60: "p60",
  90: "p90",
  180: "p180",
};

export interface RawEvent {
  date: string;
  percent: number | null;
}

// Constrói a lista ordenada de eventos (ondas) e os percentuais alinhados.
function eventsFromRows(rows: CampaignRow[], epsilon: number): RawEvent[] {
  const byDate = new Map<string, number | null>();
  for (const r of rows) {
    const d = windowDate(r);
    if (!d) continue;
    const pct = r.percentual == null ? null : Number(r.percentual);
    // Mantém o maior percentual observado na mesma data (proxy do bônus da onda).
    const prev = byDate.get(d);
    const val = Number.isFinite(pct as number) ? (pct as number) : null;
    if (!byDate.has(d)) byDate.set(d, val);
    else if (val != null && (prev == null || val > prev)) byDate.set(d, val);
  }
  const waveDates = collapseWaves(Array.from(byDate.keys()), epsilon);
  // Para cada onda, pega o percentual da data-âncora (mais antiga do grupo).
  return waveDates.map((d) => ({ date: d, percent: byDate.get(d) ?? null }));
}

// ---------------------------------------------------------------------------
// Modelo A — quando (hazard empírico ponderado por recência)
// ---------------------------------------------------------------------------

interface WeightedInterval {
  days: number;
  weight: number;
}

// Intervalos entre ondas consecutivas, com peso de recência (a recência é a do
// evento MAIS NOVO de cada par).
function weightedIntervals(events: RawEvent[], halfLife: number): WeightedInterval[] {
  const out: WeightedInterval[] = [];
  const n = events.length;
  for (let i = 1; i < n; i++) {
    const days = daysBetween(events[i - 1].date, events[i].date);
    const rankFromNewest = n - 1 - i; // i = n-1 (par mais recente) → 0
    out.push({ days, weight: recencyWeight(rankFromNewest, halfLife) });
  }
  return out;
}

// Sobrevivência ponderada S(t) = fração (ponderada) de intervalos > t.
function survival(iv: WeightedInterval[], t: number): number {
  const total = iv.reduce((a, x) => a + x.weight, 0);
  if (total === 0) return 0;
  const gt = iv.reduce((a, x) => a + (x.days > t ? x.weight : 0), 0);
  return gt / total;
}

// Resíduos dos intervalos que ainda "sobrevivem" a d (i_k - d para i_k > d).
function residuals(iv: WeightedInterval[], d: number): number[] {
  return iv.filter((x) => x.days > d).map((x) => x.days - d);
}

interface TimingOut {
  probabilities: WindowProbs;
  centralDate: string;
  windowStart: string;
  windowEnd: string;
}

function computeTiming(
  events: RawEvent[],
  asOf: string,
  cfg: PredictConfig,
): TimingOut {
  const iv = weightedIntervals(events, cfg.recencyHalfLifeEvents);
  const last = events[events.length - 1].date;
  const d = Math.max(0, daysBetween(last, asOf)); // days_since_last

  const sD = survival(iv, d);
  const probs = {} as WindowProbs;
  for (const H of HORIZONS) {
    // P(evento até d+H | sobreviveu a d) = 1 - S(d+H)/S(d). Overdue → 1.
    const p = sD > 0 ? 1 - survival(iv, d + H) / sD : 1;
    probs[HORIZON_KEYS[H]] = Math.min(1, Math.max(0, Number(p.toFixed(4))));
  }

  // Data central e janela = quantis do resíduo condicional; overdue → agora.
  const res = residuals(iv, d);
  const rMed = res.length ? (median(res) ?? 0) : 0;
  const rLo = res.length ? (quantile(res, 0.25) ?? 0) : 0;
  const rHi = res.length ? (quantile(res, 0.75) ?? rMed) : Math.max(7, rMed);
  return {
    probabilities: probs,
    centralDate: addDays(asOf, Math.round(rMed)),
    windowStart: addDays(asOf, Math.round(rLo)),
    windowEnd: addDays(asOf, Math.round(Math.max(rHi, rLo + 1))),
  };
}

// ---------------------------------------------------------------------------
// Modelo B — quanto (distribuição empírica de bônus, ponderada por recência)
// ---------------------------------------------------------------------------

function computeBonus(
  events: RawEvent[],
  cfg: PredictConfig,
): { candidates: BonusCandidate[]; outros: number } {
  const weightByValue = new Map<number, number>();
  const n = events.length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const v = events[i].percent;
    if (v == null || !Number.isFinite(v)) continue;
    const w = recencyWeight(n - 1 - i, cfg.recencyHalfLifeEvents);
    weightByValue.set(v, (weightByValue.get(v) ?? 0) + w);
    total += w;
  }
  if (total === 0) return { candidates: [], outros: 0 };
  const ranked = Array.from(weightByValue.entries())
    .map(([value, w]) => ({ value, probability: w / total }))
    .sort((a, b) => b.probability - a.probability);
  const top = ranked.slice(0, 3).map((c) => ({
    value: c.value,
    probability: Number(c.probability.toFixed(3)),
  }));
  const outros = Number((1 - top.reduce((a, c) => a + c.probability, 0)).toFixed(3));
  return { candidates: top, outros: Math.max(0, outros) };
}

// ---------------------------------------------------------------------------
// Readiness + confiança + bloqueios
// ---------------------------------------------------------------------------

function coefVar(intervals: number[]): number | null {
  const m = mean(intervals);
  const sd = stdev(intervals);
  if (m == null || sd == null || m === 0) return null;
  return sd / m;
}

function gate(
  events: RawEvent[],
  intervals: number[],
  backtest: BacktestResult | null,
  cfg: PredictConfig,
): { readiness: Readiness; confidence: Confidence; blockReason: string | null; warnings: string[] } {
  const n = events.length;
  const warnings: string[] = [];

  if (n < cfg.minSamples) {
    return {
      readiness: "insufficient_history",
      confidence: "insuficiente",
      blockReason: `insufficient_valid_history (${n} < ${cfg.minSamples} campanhas)`,
      warnings,
    };
  }

  const cv = coefVar(intervals);
  // Confiança base por tamanho de amostra.
  let conf: Confidence = "baixa";
  if (n >= cfg.samplesAlta) conf = "alta";
  else if (n >= cfg.samplesMedia) conf = "media";

  // Rebaixa por variabilidade dos intervalos.
  if (cv != null) {
    if (cv > cfg.cvMedia && (conf === "alta" || conf === "media")) {
      conf = "baixa";
      warnings.push(`intervalos irregulares (CV=${cv.toFixed(2)})`);
    } else if (cv > cfg.cvAlta && conf === "alta") {
      conf = "media";
      warnings.push(`intervalos moderadamente irregulares (CV=${cv.toFixed(2)})`);
    }
  }

  // Backtest: sem observações suficientes → não pode ser "alta"; ruim → rebaixa.
  if (!backtest || backtest.observations < cfg.backtestMinObs) {
    if (conf === "alta") conf = "media";
    warnings.push("backtest com poucas observações");
  } else if (backtest.windowHitRate != null && backtest.windowHitRate < 0.5) {
    if (conf === "alta") conf = "media";
    else if (conf === "media") conf = "baixa";
    warnings.push(`backtest fraco (acertos de janela ${(backtest.windowHitRate * 100).toFixed(0)}%)`);
  }

  // Histórico curto vs cadência → aviso (não bloqueia).
  const span = daysBetween(events[0].date, events[n - 1].date);
  const med = median(intervals);
  if (med != null && span < 2 * med) warnings.push("histórico curto para a cadência observada");

  const readiness: Readiness = warnings.length > 0 || conf === "baixa" ? "ready_with_warnings" : "ready";
  return { readiness, confidence: conf, blockReason: null, warnings };
}

// ---------------------------------------------------------------------------
// Backtesting walk-forward
// ---------------------------------------------------------------------------

function backtestSeries(events: RawEvent[], cfg: PredictConfig): BacktestResult {
  const dateErrors: number[] = [];
  let windowHits = 0;
  let windowN = 0;
  let bonusExact = 0;
  let bonus5pp = 0;
  let bonusN = 0;

  for (let i = cfg.minSamples; i < events.length; i++) {
    const train = events.slice(0, i);
    const asOf = train[train.length - 1].date; // prevê "logo após" o último conhecido
    const actual = events[i];

    const t = computeTiming(train, asOf, cfg);
    const err = Math.abs(daysBetween(t.centralDate, actual.date));
    dateErrors.push(err);
    windowN++;
    if (toMs(actual.date) >= toMs(t.windowStart) && toMs(actual.date) <= toMs(t.windowEnd)) windowHits++;

    if (actual.percent != null) {
      const b = computeBonus(train, cfg);
      const top = b.candidates[0];
      if (top != null) {
        bonusN++;
        if (top.value === actual.percent) bonusExact++;
        if (Math.abs(top.value - actual.percent) <= 5) bonus5pp++;
      }
    }
  }

  return {
    observations: windowN,
    medianDateErrorDays: median(dateErrors),
    windowHitRate: windowN ? Number((windowHits / windowN).toFixed(2)) : null,
    exactBonusAccuracy: bonusN ? Number((bonusExact / bonusN).toFixed(2)) : null,
    bonusAccuracy5pp: bonusN ? Number((bonus5pp / bonusN).toFixed(2)) : null,
  };
}

// ---------------------------------------------------------------------------
// Explicação em linguagem de negócio (§19)
// ---------------------------------------------------------------------------

function explain(p: Omit<Prediction, "explanation">): string {
  const rota = p.origem ? `${p.origem} → ${p.destino}` : `→ ${p.destino}`;
  if (p.blockReason) {
    return `${rota}: histórico insuficiente para prever (${p.recordsTotal} campanha(s) válida(s)). Sem previsão até acumular ao menos ${DEFAULT_PREDICT_CONFIG.minSamples} — o motor bloqueia em vez de chutar.`;
  }
  const parts: string[] = [];
  parts.push(
    `${rota} tem ${p.recordsTotal} campanhas válidas; intervalo mediano ${p.medianIntervalAll ?? "—"} dias (recente ${p.medianIntervalRecent ?? "—"}).`,
  );
  if (p.daysSinceLast != null) parts.push(`Passaram ${p.daysSinceLast} dias desde a última.`);
  if (p.probabilities) {
    parts.push(
      `Probabilidade de nova campanha: ${(p.probabilities.p30 * 100).toFixed(0)}% em 30 dias, ${(p.probabilities.p90 * 100).toFixed(0)}% em 90.`,
    );
  }
  if (p.bonusCandidates[0]) {
    const b = p.bonusCandidates[0];
    parts.push(`Bônus mais provável ${b.value}% (${(b.probability * 100).toFixed(0)}%).`);
  }
  if (p.backtest && p.backtest.observations >= DEFAULT_PREDICT_CONFIG.backtestMinObs) {
    parts.push(
      `Backtest: ${p.backtest.observations} janelas, acerto de janela ${((p.backtest.windowHitRate ?? 0) * 100).toFixed(0)}%, erro mediano de data ${p.backtest.medianDateErrorDays} dias.`,
    );
  }
  parts.push(`Confiança ${p.confidence}${p.warnings.length ? ` — ${p.warnings.join("; ")}` : ""}.`);
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Orquestrador
// ---------------------------------------------------------------------------

function predictOne(
  scope: Scope,
  origem: string | null,
  destino: string,
  rows: CampaignRow[],
  asOf: string,
  cfg: PredictConfig,
): Prediction {
  const seriesKey = `${origem ?? "*"}|${destino}|transferencia|brasil|todos|percentual`;
  const evs = eventsFromRows(rows, cfg.waveEpsilonDays);
  const n = evs.length;
  const dates = evs.map((e) => e.date);
  const intervals: number[] = [];
  for (let i = 1; i < n; i++) intervals.push(daysBetween(dates[i - 1], dates[i]));

  const recentEvs = evs.slice(-cfg.recentWindowEvents);
  const recentIntervals: number[] = [];
  for (let i = 1; i < recentEvs.length; i++)
    recentIntervals.push(daysBetween(recentEvs[i - 1].date, recentEvs[i].date));

  const daysSinceLast = n ? Math.max(0, daysBetween(dates[n - 1], asOf)) : null;

  const backtest = n >= cfg.minSamples + 1 ? backtestSeries(evs, cfg) : null;
  const g = gate(evs, intervals, backtest, cfg);

  const blocked = g.blockReason != null;
  const timing = blocked ? null : computeTiming(evs, asOf, cfg);
  const bonus = blocked ? { candidates: [], outros: 0 } : computeBonus(evs, cfg);

  const base: Omit<Prediction, "explanation"> = {
    scope,
    seriesKey,
    program: destino,
    origem,
    destino,
    asOf,
    recordsTotal: n,
    recordsRecent: recentEvs.length,
    events: dates,
    intervals,
    daysSinceLast,
    medianIntervalAll: median(intervals),
    medianIntervalRecent: median(recentIntervals),
    probabilities: timing?.probabilities ?? null,
    centralDate: timing?.centralDate ?? null,
    windowStart: timing?.windowStart ?? null,
    windowEnd: timing?.windowEnd ?? null,
    bonusCandidates: bonus.candidates,
    bonusOutros: bonus.outros,
    readiness: g.readiness,
    confidence: g.confidence,
    blockReason: g.blockReason,
    warnings: g.warnings,
    backtest,
    modelVersion: MODEL_VERSION,
    backtestVersion: BACKTEST_VERSION,
  };
  return { ...base, explanation: explain(base) };
}

export interface PredictResult {
  asOf: string;
  modelVersion: string;
  backtestVersion: string;
  clusters: Prediction[]; // por destino (→programa)
  routes: Prediction[]; // por origem→destino
  quality: CampaignQualityAssessment; // Fase C0.2 — MESMO conjunto elegível do Forecast
}

// Constrói previsões para TODAS as séries de transferência do ledger. Genérico:
// nenhuma regra especial por programa. O chamador filtra por programa se quiser.
export function buildPredict(
  campaigns: CampaignRow[],
  opts: { asOf: string; config?: Partial<PredictConfig> } = { asOf: new Date().toISOString().slice(0, 10) },
): PredictResult {
  const cfg = { ...DEFAULT_PREDICT_CONFIG, ...(opts.config ?? {}) };
  const asOf = opts.asOf;

  // Fase C0.2 — MESMA avaliação de qualidade do Forecast (normProgram compartilhado).
  // O Predict recebe exatamente o conjunto elegível: nenhuma campanha temporalmente
  // crítica, duplicata provável (membro crítico), placeholder ou permanente entra.
  const quality = assessCampaignQuality(campaigns, { normalize: normProgram });
  const transf = quality.eligibleRows;

  // Particionamento rota/cluster compartilhado com o Forecast (series-builder).
  const groups = groupTransferSeries(transf, normProgram);

  const clusters = Array.from(groups.clusters.values())
    .map((g) => predictOne("cluster", null, g.destino, g.rows, asOf, cfg))
    .sort((a, b) => b.recordsTotal - a.recordsTotal);
  const routes = Array.from(groups.routes.values())
    .map((g) => predictOne("route", g.origem as string, g.destino, g.rows, asOf, cfg))
    .sort((a, b) => b.recordsTotal - a.recordsTotal);

  return { asOf, modelVersion: MODEL_VERSION, backtestVersion: BACKTEST_VERSION, clusters, routes, quality };
}
