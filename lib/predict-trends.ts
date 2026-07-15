// Tendência por série a partir de predict_snapshots — parte PURA (agrupamento
// e leitura de calibração), testável sem servidor. A query fica em
// lib/admin-predict.ts (getSeriesTrends).

export interface SnapshotTrendRow {
  series_key: string;
  as_of_date: string;
  prob_30: number | null;
  confidence: string | null;
  backtest: {
    observations?: number | null;
    windowHitRate?: number | null;
    medianDateErrorDays?: number | null;
  } | null;
}

export interface TrendPoint {
  asOf: string;
  p30: number | null;
  hitRate: number | null;
  medianErrorDays: number | null;
  confidence: string | null;
}

// Agrupa linhas (já ordenadas por as_of_date asc) por série; dedup por dia
// (última leitura do dia vence — o snapshot é upsert por série+dia, mas a
// query pode trazer duplicata em migrações antigas).
export function groupSnapshotRows(rows: SnapshotTrendRow[]): Map<string, TrendPoint[]> {
  const out = new Map<string, TrendPoint[]>();
  for (const r of rows) {
    const pts = out.get(r.series_key) ?? [];
    const point: TrendPoint = {
      asOf: r.as_of_date,
      p30: r.prob_30,
      hitRate: r.backtest?.windowHitRate ?? null,
      medianErrorDays: r.backtest?.medianDateErrorDays ?? null,
      confidence: r.confidence,
    };
    if (pts.length && pts[pts.length - 1].asOf === r.as_of_date) pts[pts.length - 1] = point;
    else pts.push(point);
    out.set(r.series_key, pts);
  }
  return out;
}

// Série numérica para sparkline (só pontos com p30) — null se < 2 pontos.
export function p30Series(points: TrendPoint[] | undefined): number[] | null {
  const vals = (points ?? []).filter((p) => p.p30 != null).map((p) => p.p30 as number);
  return vals.length >= 2 ? vals : null;
}

export interface Calibration {
  snapshots: number;
  firstAsOf: string;
  lastAsOf: string;
  p30First: number | null;
  p30Last: number | null;
  hitRateFirst: number | null;
  hitRateLast: number | null;
  errorFirst: number | null;
  errorLast: number | null;
}

// Primeiro vs último snapshot da série — o motor está acertando mais janelas
// (hitRate sobe) e errando por menos dias (erro cai) conforme a base cresce?
export function calibrationFromTrend(points: TrendPoint[] | undefined): Calibration | null {
  if (!points || points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  return {
    snapshots: points.length,
    firstAsOf: first.asOf,
    lastAsOf: last.asOf,
    p30First: first.p30,
    p30Last: last.p30,
    hitRateFirst: first.hitRate,
    hitRateLast: last.hitRate,
    errorFirst: first.medianErrorDays,
    errorLast: last.medianErrorDays,
  };
}
