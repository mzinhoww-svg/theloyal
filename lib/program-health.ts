// Visão por PROGRAMA (cia aérea): principais promoções ativas do ledger +
// saúde composta dos motores Forecast/Predict. Parte PURA e testável — o
// carregamento vive em lib/admin-programs.ts.
//
// "Saúde" aqui NÃO é um score inventado: é a composição legível dos sinais que
// os motores já produzem (readiness, confiança, backtest, divergência). Sem
// base → "sem base", nunca um número chutado (regra-mãe).

export interface PromoRow {
  id?: string | null;
  origem?: string | null;
  destino?: string | null;
  tipo?: string | null;
  percentual?: number | string | null;
  vigencia_fim?: string | null;
  status?: string | null;
  source_url?: string | null;
  source_name?: string | null;
}

export interface PromoView {
  id: string;
  origem: string;
  destino: string;
  tipo: string;
  percentual: number | null;
  vigenciaFim: string | null; // "na"/inválida → null (exibe "—", não chuta)
  status: string;
  sourceUrl: string | null;
  sourceName: string | null;
}

// Programas de cia aérea conhecidos no ledger (slugs pós-normProgram).
// bancos/varejo (livelo, esfera, itau…) ficam fora do recorte "aéreas".
export const AIRLINE_PROGRAMS = new Set([
  "smiles",
  "latampass",
  "azul",
  "connectmiles",
  "lifemiles",
  "aadvantage",
  "flyingblue",
  "tapmilesgo",
  "aeroplan",
  "emirates-skywards",
  "qatar-avios",
  "iberia-plus",
]);

export const isAirlineProgram = (slug: string): boolean => AIRLINE_PROGRAMS.has(slug);

// Status que contam como promoção ATIVA (vocabulário real do ledger).
const ACTIVE_STATUS = new Set(["continua", "vence-72h", "nova"]);

const ISO = /^\d{4}-\d{2}-\d{2}/;
const isoOrNull = (s: unknown): string | null =>
  typeof s === "string" && ISO.test(s) ? s.slice(0, 10) : null;

// Agrupa promoções ativas por programa de DESTINO, ordenadas por percentual
// (maior primeiro) e depois por vencimento mais próximo.
export function activePromosByProgram(
  rows: PromoRow[],
  normalize: (s: unknown) => string,
): Map<string, PromoView[]> {
  const out = new Map<string, PromoView[]>();
  for (const r of rows) {
    const status = String(r.status ?? "").toLowerCase();
    if (!ACTIVE_STATUS.has(status)) continue;
    const destino = normalize(r.destino);
    if (!destino) continue;
    const pct = r.percentual == null ? NaN : Number(r.percentual);
    const promo: PromoView = {
      id: String(r.id ?? ""),
      origem: normalize(r.origem),
      destino,
      tipo: String(r.tipo ?? "—"),
      percentual: Number.isFinite(pct) && pct > 0 ? pct : null,
      vigenciaFim: isoOrNull(r.vigencia_fim),
      status,
      sourceUrl: r.source_url ?? null,
      sourceName: r.source_name ?? null,
    };
    const list = out.get(destino) ?? [];
    list.push(promo);
    out.set(destino, list);
  }
  for (const list of Array.from(out.values())) {
    list.sort((a: PromoView, b: PromoView) => {
      const pa = a.percentual ?? -1;
      const pb = b.percentual ?? -1;
      if (pa !== pb) return pb - pa;
      return (a.vigenciaFim ?? "9999") < (b.vigenciaFim ?? "9999") ? -1 : 1;
    });
  }
  return out;
}

// ---- Próximas campanhas por série (origem→destino) ----
//
// Junta as previsões POR ROTA dos dois motores: a janela vem do Forecast
// (recorrência), a probabilidade vem do Predict (hazard) e a assertividade é
// o acerto de janela do backtest. Ordena pela janela mais próxima; séries sem
// janela entram depois, por probabilidade. Nada aqui inventa número.

export interface PredictRouteSignals {
  origem: string | null;
  readiness: string;
  confidence: string;
  windowStart: string | null;
  windowEnd: string | null;
  p30: number | null;
  p90: number | null;
  hitRate: number | null; // backtest windowHitRate
  observations: number; // backtest observations
}

export interface ForecastRouteSignals {
  origem: string | null;
  confidence: string;
  windowStart: string | null;
  windowEnd: string | null;
  typicalPercent: number | null;
}

export interface SeriesOutlook {
  origem: string;
  windowStart: string | null; // Forecast manda; Predict cobre quando ausente
  windowEnd: string | null;
  p30: number | null;
  p90: number | null;
  hitRate: number | null;
  observations: number;
  typicalPercent: number | null;
  confidence: string | null;
  mostAssertive: boolean; // melhor acerto de janela com amostra mínima
}

const MIN_ASSERTIVE_OBS = 3;

export function buildSeriesOutlook(
  predictRoutes: PredictRouteSignals[],
  forecastRoutes: ForecastRouteSignals[],
): SeriesOutlook[] {
  const byOrigem = new Map<string, SeriesOutlook>();
  for (const f of forecastRoutes) {
    if (!f.origem) continue;
    byOrigem.set(f.origem, {
      origem: f.origem,
      windowStart: f.windowStart,
      windowEnd: f.windowEnd,
      p30: null,
      p90: null,
      hitRate: null,
      observations: 0,
      typicalPercent: f.typicalPercent,
      confidence: f.confidence ?? null,
      mostAssertive: false,
    });
  }
  for (const p of predictRoutes) {
    if (!p.origem) continue;
    const ready = p.readiness === "ready" || p.readiness === "ready_with_warnings";
    const row: SeriesOutlook = byOrigem.get(p.origem) ?? {
      origem: p.origem,
      windowStart: null,
      windowEnd: null,
      p30: null,
      p90: null,
      hitRate: null,
      observations: 0,
      typicalPercent: null,
      confidence: null,
      mostAssertive: false,
    };
    if (ready) {
      row.p30 = p.p30;
      row.p90 = p.p90;
      row.confidence = p.confidence;
      if (!row.windowStart) {
        row.windowStart = p.windowStart;
        row.windowEnd = p.windowEnd;
      }
    }
    row.hitRate = p.hitRate;
    row.observations = p.observations;
    byOrigem.set(p.origem, row);
  }

  // Só entra quem tem algum sinal real (janela, probabilidade ou backtest).
  const rows = Array.from(byOrigem.values()).filter(
    (r) => r.windowStart != null || r.p30 != null || (r.hitRate != null && r.observations > 0),
  );

  rows.sort((a, b) => {
    if (a.windowStart && b.windowStart) {
      if (a.windowStart !== b.windowStart) return a.windowStart < b.windowStart ? -1 : 1;
      return (b.p30 ?? -1) - (a.p30 ?? -1);
    }
    if (a.windowStart) return -1;
    if (b.windowStart) return 1;
    return (b.p30 ?? -1) - (a.p30 ?? -1);
  });

  let best: SeriesOutlook | null = null;
  for (const r of rows) {
    if (r.hitRate == null || r.observations < MIN_ASSERTIVE_OBS) continue;
    if (
      !best ||
      r.hitRate > (best.hitRate ?? -1) ||
      (r.hitRate === best.hitRate && r.observations > best.observations)
    ) {
      best = r;
    }
  }
  if (best) best.mostAssertive = true;
  return rows;
}

// ---- Saúde composta dos motores ----

export type HealthTone = "green" | "blue" | "yellow" | "red" | "gray";

export interface PredictSignals {
  readiness: string;
  confidence: string;
  warnings: string[];
  blockReason: string | null;
  windowHitRate: number | null; // backtest
  backtestObservations: number;
}

export interface ForecastSignals {
  confidence: string;
  windowStart: string | null;
  editorialEligible: boolean;
  warnings: string[];
}

export interface EngineHealth {
  tone: HealthTone;
  label: string;
  reasons: string[]; // legível — o "porquê" da saúde, na ordem de gravidade
}

// Regras (documentadas, sem número inventado):
//   red    — dado bloqueado por qualidade (a série existe mas o C0.2 comeu o histórico)
//   gray   — sem base (sem série, insuficiente, em formação ou carga parcial)
//   yellow — atenção (warnings, confiança baixa, backtest fraco, motores divergem)
//   blue   — ok (pronto com confiança média)
//   green  — saudável (pronto com confiança alta e backtest sem alerta)
export function engineHealth(
  predict: PredictSignals | null,
  forecast: ForecastSignals | null,
): EngineHealth {
  if (!predict && !forecast) return { tone: "gray", label: "sem série", reasons: ["nenhum motor forma série para o programa"] };

  const reasons: string[] = [];

  if (predict?.readiness === "data_quality_blocked") {
    return {
      tone: "red",
      label: "dado bloqueado",
      reasons: [predict.blockReason ?? "histórico consumido por exclusões de qualidade"],
    };
  }
  if (predict?.readiness === "backfill_incomplete") {
    return { tone: "gray", label: "carga parcial", reasons: [predict.blockReason ?? "leitura do ledger incompleta"] };
  }

  const predictReady =
    predict != null && (predict.readiness === "ready" || predict.readiness === "ready_with_warnings");
  const forecastHasWindow = forecast != null && forecast.windowStart != null;

  if (!predictReady && !forecastHasWindow) {
    return {
      tone: "gray",
      label: "sem base",
      reasons: [predict?.blockReason ?? "histórico insuficiente nos dois motores"],
    };
  }

  // Divergência: um motor projeta, o outro bloqueia — sinal de atenção sempre.
  if (predictReady !== forecastHasWindow && predict != null && forecast != null) {
    reasons.push(
      predictReady
        ? "motores divergem: Predict pronto, Forecast sem janela"
        : "motores divergem: Forecast projeta janela, Predict bloqueado",
    );
  }

  const weakBacktest =
    predict != null &&
    predict.backtestObservations >= 3 &&
    predict.windowHitRate != null &&
    predict.windowHitRate < 0.5;
  if (weakBacktest) reasons.push(`backtest fraco (acerto de janela ${(100 * (predict!.windowHitRate ?? 0)).toFixed(0)}%)`);

  const warnCount = (predict?.warnings.length ?? 0) + (forecast?.warnings.length ?? 0);
  if (warnCount > 0) reasons.push(`${warnCount} alerta(s) de série`);

  const conf = predict?.confidence ?? forecast?.confidence ?? "baixa";
  if (conf === "alta" && reasons.length === 0) return { tone: "green", label: "saudável", reasons: [] };
  if ((conf === "alta" || conf === "media") && reasons.length === 0)
    return { tone: "blue", label: "ok", reasons: [] };
  if (conf === "baixa") reasons.unshift("confiança baixa");
  return { tone: "yellow", label: "atenção", reasons };
}
