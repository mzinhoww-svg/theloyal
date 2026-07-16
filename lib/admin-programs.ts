// Carregador da página /admin/programas: uma leitura do ledger alimenta as
// promoções ativas por programa E os dois motores (mesma amostra elegível do
// C0.2), mais a tendência de p30 dos snapshots. Server-only.

import { fetchAllRows } from "./admin-db";
import { LEDGER_QUALITY_SELECT } from "./ledger-select";
import { buildForecast, programLabel, formatWindow, type CampaignRow, type Forecast } from "./forecast";
import { buildPredict, type Prediction } from "./predict-engine";
import { normProgram, windowDate } from "./series-builder";
import { getSeriesTrends } from "./admin-predict";
import { p30Series } from "./predict-trends";
import {
  activePromosByProgram,
  engineHealth,
  isAirlineProgram,
  type EngineHealth,
  type PromoView,
} from "./program-health";

// Ledger com colunas de exibição além do set de qualidade (status/source_name
// não participam dos motores; só da lista de promoções).
const PROGRAM_LEDGER_SELECT = `${LEDGER_QUALITY_SELECT},status,source_name`;

type LedgerRow = CampaignRow & { status?: string | null; source_name?: string | null };

export interface ProgramView {
  program: string; // slug normalizado (destino)
  label: string;
  airline: boolean;
  promos: PromoView[]; // ativas, já ordenadas (maior % primeiro)
  bestPercent: number | null;
  lastEventDate: string | null;
  daysSinceLast: number | null;
  forecast: Forecast | null; // cluster →programa
  predict: Prediction | null; // cluster
  forecastWindow: string | null; // formatada pt-BR
  health: EngineHealth;
  trend: number[] | null; // p30 ao longo dos snapshots
}

export interface ProgramsData {
  asOf: string;
  datasetComplete: boolean;
  ledgerRows: number;
  programs: ProgramView[]; // ordenado: mais promoções ativas primeiro
  totals: {
    programs: number;
    withActivePromo: number;
    activePromos: number;
    healthy: number; // green/blue
    attention: number; // yellow
    blocked: number; // red/gray com série
  };
}

const daysBetweenISO = (a: string, b: string) =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);

export async function loadPrograms(now?: string): Promise<ProgramsData> {
  const asOf = (now ?? new Date().toISOString()).slice(0, 10);
  const loaded = await fetchAllRows<LedgerRow>("campaigns", PROGRAM_LEDGER_SELECT);
  const rows = loaded.rows;

  const forecast = buildForecast(rows, { now: asOf });
  const predict = buildPredict(rows, { asOf, datasetComplete: loaded.complete });
  const promosByProgram = activePromosByProgram(rows, normProgram);

  const forecastByDest = new Map(forecast.clusters.map((c) => [c.destino, c]));
  const predictByDest = new Map(predict.clusters.map((p) => [p.destino, p]));

  // Última campanha observada por destino (qualquer status — leitura direta).
  const lastByDest = new Map<string, string>();
  for (const r of rows) {
    const destino = normProgram(r.destino);
    const d = windowDate(r);
    if (!destino || !d) continue;
    if ((lastByDest.get(destino) ?? "") < d) lastByDest.set(destino, d);
  }

  // Universo: todo destino que tem promoção ativa OU série em algum motor.
  const slugs = new Set<string>([
    ...Array.from(promosByProgram.keys()),
    ...Array.from(forecastByDest.keys()),
    ...Array.from(predictByDest.keys()),
  ]);

  // Tendência p30 só para clusters prontos (uma query in.()).
  const readyKeys = Array.from(slugs)
    .map((s) => predictByDest.get(s))
    .filter((p): p is Prediction => !!p && (p.readiness === "ready" || p.readiness === "ready_with_warnings"))
    .map((p) => p.seriesKey);
  const trends = await getSeriesTrends(readyKeys);

  const programs: ProgramView[] = Array.from(slugs).map((slug) => {
    const f = forecastByDest.get(slug) ?? null;
    const p = predictByDest.get(slug) ?? null;
    const promos = promosByProgram.get(slug) ?? [];
    const last = lastByDest.get(slug) ?? null;
    const health = engineHealth(
      p
        ? {
            readiness: p.readiness,
            confidence: p.confidence,
            warnings: p.warnings,
            blockReason: p.blockReason,
            windowHitRate: p.backtest?.windowHitRate ?? null,
            backtestObservations: p.backtest?.observations ?? 0,
          }
        : null,
      f
        ? {
            confidence: f.confidence,
            windowStart: f.windowStart,
            editorialEligible: f.editorialEligible,
            warnings: f.warnings,
          }
        : null,
    );
    return {
      program: slug,
      label: programLabel(slug),
      airline: isAirlineProgram(slug),
      promos,
      bestPercent: promos.find((x) => x.percentual != null)?.percentual ?? null,
      lastEventDate: last,
      daysSinceLast: last ? Math.max(0, daysBetweenISO(last, asOf)) : null,
      forecast: f,
      predict: p,
      forecastWindow: f?.windowStart ? formatWindow(f.windowStart, f.windowEnd) : null,
      health,
      trend: p ? p30Series(trends.get(p.seriesKey)) : null,
    };
  });

  programs.sort((a, b) => {
    if (a.promos.length !== b.promos.length) return b.promos.length - a.promos.length;
    return a.label.localeCompare(b.label);
  });

  const healthy = programs.filter((x) => x.health.tone === "green" || x.health.tone === "blue").length;
  const attention = programs.filter((x) => x.health.tone === "yellow").length;
  const blocked = programs.filter((x) => x.health.tone === "red").length;

  return {
    asOf,
    datasetComplete: loaded.complete,
    ledgerRows: rows.length,
    programs,
    totals: {
      programs: programs.length,
      withActivePromo: programs.filter((x) => x.promos.length > 0).length,
      activePromos: programs.reduce((a, x) => a + x.promos.length, 0),
      healthy,
      attention,
      blocked,
    },
  };
}
