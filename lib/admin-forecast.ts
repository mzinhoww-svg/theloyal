// Camada da área de predict do admin: lê config e overrides do Supabase, roda
// o motor (lib/forecast) e aplica os overrides do operador. Server-only
// (usa admin-db, que carrega a SERVICE_ROLE_KEY). Funções puras onde possível.

import { restResult, fetchAllRows } from "./admin-db";
import { LEDGER_QUALITY_SELECT } from "./ledger-select";
import { proposeDateCorrections, type DateCorrectionProposal } from "./date-review";
import { getDateReviewsResult } from "./admin-date-reviews";
import {
  buildForecast,
  radarItems,
  resolveConfig,
  upcomingWindows,
  type CampaignRow,
  type Confidence,
  type Forecast,
  type ForecastConfig,
  type ForecastResult,
  type RadarItem,
} from "./forecast";

// ---- Config persistida (forecast_config, linha singleton id=1) ----

export type ConfigRow = {
  wave_epsilon_days: number;
  min_samples: number;
  samples_alta: number;
  samples_media: number;
  cv_alta: number;
  cv_media: number;
  horizon_daily: number;
  horizon_weekly: number;
  updated_at: string | null;
  updated_by: string | null;
};

export function rowToConfig(row: ConfigRow | null | undefined): ForecastConfig {
  if (!row) return resolveConfig();
  return resolveConfig({
    waveEpsilonDays: Number(row.wave_epsilon_days),
    minSamples: Number(row.min_samples),
    samplesAlta: Number(row.samples_alta),
    samplesMedia: Number(row.samples_media),
    cvAlta: Number(row.cv_alta),
    cvMedia: Number(row.cv_media),
    horizonDaily: Number(row.horizon_daily),
    horizonWeekly: Number(row.horizon_weekly),
  });
}

export async function getConfig(): Promise<{
  config: ForecastConfig;
  row: ConfigRow | null;
  error: string | null;
}> {
  const res = await restResult<ConfigRow>("forecast_config?id=eq.1&limit=1");
  const row = res.rows[0] ?? null;
  return { config: rowToConfig(row), row, error: res.error };
}

// ---- Overrides (forecast_overrides) ----

export type OverrideAction = "pin" | "mute" | "confidence";

export type OverrideRow = {
  id: string;
  scope: "route" | "cluster";
  route: string;
  action: OverrideAction;
  confidence: Confidence | null;
  note: string | null;
  created_at: string | null;
  created_by: string | null;
};

export const getOverridesResult = () =>
  restResult<OverrideRow>("forecast_overrides?select=*&order=created_at.desc");
export const getOverrides = async () => (await getOverridesResult()).rows;

// Colunas lidas do ledger para o Forecast legado. Inclui as datas de
// PROVENIÊNCIA (first_seen/last_seen/observed_at/created_at) e o source_url —
// os mesmos campos que `assessCampaignQuality`/`resolveEventDateCandidate` já
// esperam para aplicar a contenção temporal C0.2 (ex.: `suspect_year` do caso
// livelo → connectmiles). Sem essas colunas, o motor recebia proveniência
// undefined e nunca disparava a exclusão — então o Forecast divergia do Radar.
// Reusa a fonte ÚNICA de seleção (lib/ledger-select), IDÊNTICA à do Radar, para
// garantir a MESMA amostra elegível. Explícito (não `*`). Fase A1.
export const FORECAST_LEDGER_SELECT = LEDGER_QUALITY_SELECT;

// ---- Snapshots (forecast_snapshots) ----

export type SnapshotRow = {
  id: string;
  generated_for: string;
  routes_tracked: number | null;
  clusters_tracked: number | null;
  with_prediction: number | null;
  created_at: string | null;
  created_by: string | null;
};

export const getSnapshotsResult = (limit = 20) =>
  restResult<SnapshotRow>(
    `forecast_snapshots?select=id,generated_for,routes_tracked,clusters_tracked,with_prediction,created_at,created_by&order=created_at.desc&limit=${limit}`,
  );
export const getSnapshots = async (limit = 20) => (await getSnapshotsResult(limit)).rows;

// ---- View model com overrides aplicados ----

export type ForecastView = Forecast & {
  key: string; // `${scope}:${route}`
  pinned: boolean;
  muted: boolean;
  overriddenConfidence: Confidence | null;
  note: string | null;
  editorialOverridden: boolean; // um override com nota liberou a elegibilidade
};

const keyOf = (scope: string, route: string) => `${scope}:${route}`;

function decorate(f: Forecast, ov: Map<string, OverrideRow>): ForecastView {
  const o = ov.get(keyOf(f.scope, f.route));
  const overriddenConfidence = o?.action === "confidence" ? o.confidence : null;
  return {
    ...f,
    confidence: overriddenConfidence ?? f.confidence,
    key: keyOf(f.scope, f.route),
    pinned: o?.action === "pin",
    muted: o?.action === "mute",
    overriddenConfidence,
    note: o?.note ?? null,
    editorialOverridden: (f as Forecast & { editorialOverridden?: boolean }).editorialOverridden === true,
  };
}

// Um override de pin/confidence COM nota não-vazia pode liberar a elegibilidade
// editorial de uma série bloqueada por amostra/intervalo/horizonte (nunca por
// dataset incompleto ou artefato stale — esses são tratados fora do motor).
// Registra editorialOverridden no objeto para exibição/auditoria. Fase C0.
function applyEditorialOverrides(list: Forecast[], overrides: OverrideRow[]): void {
  const grants = new Map(
    overrides
      .filter((o) => (o.action === "pin" || o.action === "confidence") && !!o.note && o.note.trim().length > 0)
      .map((o) => [keyOf(o.scope, o.route), o]),
  );
  for (const f of list) {
    if (!f.editorialEligible && grants.has(keyOf(f.scope, f.route))) {
      f.editorialEligible = true;
      (f as Forecast & { editorialOverridden?: boolean }).editorialOverridden = true;
    }
  }
}

export type Distribution = Record<Confidence, number>;

function distribution(views: ForecastView[]): Distribution {
  const d: Distribution = { alta: 0, media: 0, baixa: 0, "em-formacao": 0 };
  for (const v of views) d[v.confidence]++;
  return d;
}

export type ForecastData = {
  configured: boolean;
  config: ForecastConfig;
  configRow: ConfigRow | null;
  overrides: OverrideRow[];
  result: ForecastResult;
  routes: ForecastView[];
  clusters: ForecastView[];
  distributionRoutes: Distribution;
  distributionClusters: Distribution;
  radarDaily: RadarItem[];
  radarWeekly: RadarItem[];
  snapshots: SnapshotRow[];
  ledgerRows: number;
  generatedFor: string;
  datasetComplete: boolean; // leitura paginada completa? se false, radar é bloqueado
  radarBlockedReason: string | null; // por que os radares saíram vazios (se saíram)
  dateProposals: DateCorrectionProposal[]; // Trilha D — correções pendentes de decisão
  loadWarnings: string[]; // BKL-07 — leituras que FALHARAM (≠ vazio legítimo)
};

// Aplica pin/mute/confidence e ordena: fixados primeiro, depois silenciados por
// último, mantendo a ordem do motor dentro de cada grupo.
function applyOverrides(list: Forecast[], ov: Map<string, OverrideRow>): ForecastView[] {
  const views = list.map((f) => decorate(f, ov));
  return views.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.muted !== b.muted) return a.muted ? 1 : -1;
    return 0;
  });
}

// Carrega tudo para a página. `now` injetável para testes determinísticos.
export async function loadForecast(now?: string): Promise<ForecastData> {
  const [cfgRes, overridesRes, snapshotsRes, loaded, dateReviewsRes] = await Promise.all([
    getConfig(),
    getOverridesResult(),
    getSnapshotsResult(),
    // Leitura COMPLETA e paginada — sem o limite silencioso de 2000. Fase C0.
    // Colunas COM proveniência (Fase A1) — mesma amostra elegível do Radar.
    fetchAllRows<CampaignRow>("campaigns", FORECAST_LEDGER_SELECT),
    getDateReviewsResult(),
  ]);
  const { config, row } = cfgRes;
  const overrides = overridesRes.rows;
  const snapshots = snapshotsRes.rows;
  const dateReviews = dateReviewsRes.rows;

  // BKL-07: falha de leitura NÃO é vazio — a página avisa o operador.
  const loadWarnings = [
    cfgRes.error && `config do motor (${cfgRes.error})`,
    overridesRes.error && `overrides (${overridesRes.error})`,
    snapshotsRes.error && `snapshots (${snapshotsRes.error})`,
    dateReviewsRes.error && `revisões de data (${dateReviewsRes.error})`,
  ].filter((w): w is string => !!w);
  const campaigns = loaded.rows;
  const datasetComplete = loaded.complete;

  const result = buildForecast(campaigns, { now, config });
  // Overrides com nota podem liberar elegibilidade (antes de fatiar os radares).
  applyEditorialOverrides([...result.routes, ...result.clusters], overrides);

  const ov = new Map(overrides.map((o) => [keyOf(o.scope, o.route), o]));
  const routes = applyOverrides(result.routes, ov);
  const clusters = applyOverrides(result.clusters, ov);

  // Radares: excluem rotas silenciadas (mute retira dos digests).
  const mutedKeys = new Set(overrides.filter((o) => o.action === "mute").map((o) => keyOf(o.scope, o.route)));
  const notMuted = (f: Forecast) => !mutedKeys.has(keyOf(f.scope, f.route));
  const daily = upcomingWindows(result, {
    now,
    horizonDays: config.horizonDaily,
    minConfidence: "media",
  }).filter(notMuted);
  const weekly = upcomingWindows(result, {
    now,
    horizonDays: config.horizonWeekly,
    minConfidence: "baixa",
  }).filter(notMuted);

  // Gate de contenção: dataset incompleto NÃO gera números editoriais (nem pin
  // ignora isso). Os radares saem vazios com motivo explícito.
  const radarBlockedReason = datasetComplete
    ? null
    : "leitura do ledger incompleta — radar bloqueado até a carga completar";

  return {
    configured: campaigns.length > 0 || row != null,
    config,
    configRow: row,
    overrides,
    result,
    routes,
    clusters,
    distributionRoutes: distribution(routes),
    distributionClusters: distribution(clusters),
    radarDaily: datasetComplete ? radarItems(daily) : [],
    radarWeekly: datasetComplete ? radarItems(weekly) : [],
    snapshots,
    ledgerRows: campaigns.length,
    generatedFor: result.generatedFor,
    datasetComplete,
    radarBlockedReason,
    // Trilha D: propostas de correção de data ainda sem decisão do operador.
    dateProposals: proposeDateCorrections(campaigns, result.quality).filter(
      (p) => !dateReviews.some((r) => r.campaign_id === p.campaignId),
    ),
    loadWarnings,
  };
}
