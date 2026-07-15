// Camada server-only da área /admin/predict: lê o ledger, roda o motor puro
// (lib/predict-engine) e persiste snapshots observáveis (predict_snapshots).
// Usa admin-db (SERVICE_ROLE_KEY) — nunca importado por Client Component.

import { rest, insert, fetchAllRows } from "./admin-db";
import { buildPredict, type Prediction, type PredictResult } from "./predict-engine";
import { getOverrides, type OverrideRow } from "./admin-forecast";
import { applyPredictOverrides, type WithOverrides } from "./predict-overrides";
import type { CampaignRow } from "./forecast";

export type { Prediction, PredictResult } from "./predict-engine";

// Série do Predict decorada com os overrides do operador (pin/mute).
export type PredictSeriesView = WithOverrides<Prediction>;

export type SnapshotRow = {
  id: string;
  as_of_date: string;
  scope: string;
  series_key: string;
  program: string | null;
  origem: string | null;
  destino: string;
  confidence: string | null;
  readiness: string | null;
  central_date: string | null;
  window_start: string | null;
  window_end: string | null;
  created_at: string | null;
};

export async function loadPredict(now?: string): Promise<{
  configured: boolean;
  ledgerRows: number;
  result: PredictResult;
  clusters: PredictSeriesView[];
  routes: PredictSeriesView[];
  overrides: OverrideRow[];
  datasetComplete: boolean;
  asOf: string;
}> {
  const asOf = (now ?? new Date().toISOString()).slice(0, 10);
  // Leitura COMPLETA e paginada — sem o limite silencioso de 2000. Fase C0.
  const [loaded, overrides] = await Promise.all([
    fetchAllRows<CampaignRow>(
      "campaigns",
      "id,tipo,origem,destino,percentual,vigencia_inicio,vigencia_fim",
    ),
    getOverrides(),
  ]);
  const campaigns = loaded.rows;
  const result = buildPredict(campaigns, { asOf });
  return {
    configured: campaigns.length > 0,
    ledgerRows: campaigns.length,
    result,
    clusters: applyPredictOverrides(result.clusters, overrides),
    routes: applyPredictOverrides(result.routes, overrides),
    overrides,
    datasetComplete: loaded.complete,
    asOf,
  };
}

export const getSnapshots = (limit = 20) =>
  rest<SnapshotRow>(
    `predict_snapshots?select=id,as_of_date,scope,series_key,program,origem,destino,confidence,readiness,central_date,window_start,window_end,created_at&order=created_at.desc&limit=${limit}`,
  );

// Persiste (upsert por series_key+as_of_date) o snapshot observável de uma
// previsão. Idempotente por dia.
export async function saveSnapshot(p: Prediction, by?: string): Promise<void> {
  const row = {
    as_of_date: p.asOf,
    scope: p.scope,
    series_key: p.seriesKey,
    program: p.program,
    origem: p.origem,
    destino: p.destino,
    records_total: p.recordsTotal,
    records_recent: p.recordsRecent,
    days_since_last: p.daysSinceLast,
    median_interval_days: p.medianIntervalAll,
    recent_median_interval_days: p.medianIntervalRecent,
    prob_7: p.probabilities?.p7 ?? null,
    prob_15: p.probabilities?.p15 ?? null,
    prob_30: p.probabilities?.p30 ?? null,
    prob_60: p.probabilities?.p60 ?? null,
    prob_90: p.probabilities?.p90 ?? null,
    prob_180: p.probabilities?.p180 ?? null,
    central_date: p.centralDate,
    window_start: p.windowStart,
    window_end: p.windowEnd,
    bonus_candidates: p.bonusCandidates,
    confidence: p.confidence,
    readiness: p.readiness,
    block_reason: p.blockReason,
    backtest: p.backtest,
    features: { events: p.events, intervals: p.intervals, warnings: p.warnings },
    explanation: p.explanation,
    model_version: p.modelVersion,
    backtest_version: p.backtestVersion,
    created_by: by ?? "admin",
  };
  await insert("predict_snapshots", row, { onConflict: "series_key,as_of_date" });
}
