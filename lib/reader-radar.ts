// Radar do leitor a partir do RESULTADO CANÔNICO reconciliado (F3-00 da
// POLITICA-CANONICA-RADAR.md). Fecha a premissa 4: o motor que MEDE (Predict,
// com backtest) passa a ser o que PUBLICA — não mais o Forecast cru.
//
// PURA e sem I/O. Recebe as séries já reconciliadas (radar-view-model) e devolve
// os itens de radar prontos para o artefato, com a NOTA DE CORTE já aplicada
// (só readerSurface="prediction"), proveniência do motor e o fallback rotulado
// "cadência aproximada". Séries "monitoring" viram contagem honesta (nunca número).

import { programLabel } from "./forecast.ts";
import type { RadarSeries } from "./radar-view-model.ts";

export interface ReaderRadarItem {
  label: string;
  confidence: "alta" | "media" | "baixa";
  window: string;
  basis: string;
  source: "predict" | "forecast";
  seriesKey: string;
  bonus?: string;
}

export interface ReaderRadar {
  items: ReaderRadarItem[]; // séries publicáveis dentro do horizonte
  monitoringCount: number; // séries reais "em observação" (não publicáveis)
}

const DAY = 86_400_000;
function iso(s: string | null | undefined): string | null {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY);
}

function canonicalWindow(s: RadarSeries): { start: string | null; end: string | null } {
  if (s.canonicalEngine === "predict") return { start: iso(s.predict?.windowStart), end: iso(s.predict?.windowEnd) };
  if (s.canonicalEngine === "forecast") return { start: iso(s.forecast?.windowStart), end: iso(s.forecast?.windowEnd) };
  return { start: null, end: null };
}

function canonicalConfidence(s: RadarSeries): "alta" | "media" | "baixa" {
  const c = s.canonicalEngine === "predict" ? s.predict?.confidence : s.forecast?.confidence;
  return c === "alta" ? "alta" : c === "media" ? "media" : "baixa";
}

// Base textual honesta e curta. Predict: nº de campanhas + chance em 30 dias.
// Forecast (fallback): rótulo obrigatório "cadência aproximada" + base do motor.
function buildBasis(s: RadarSeries, engine: "predict" | "forecast"): string {
  if (engine === "predict" && s.predict) {
    const n = s.predict.recordsTotal;
    const p30 = s.predict.probabilities?.p30;
    const chance = p30 != null ? ` · ~${Math.round(p30 * 100)}% em 30 dias` : "";
    return `${n} campanhas${chance}`;
  }
  const fb = s.forecast?.basis ? ` · ${s.forecast.basis}` : "";
  return `cadência aproximada${fb}`;
}

export function buildReaderRadar(series: RadarSeries[], opts: { now: string; horizonDays: number }): ReaderRadar {
  const items: ReaderRadarItem[] = [];
  let monitoringCount = 0;

  for (const s of series) {
    if (s.readerSurface === "monitoring") {
      monitoringCount++;
      continue;
    }
    if (s.readerSurface !== "prediction") continue; // hidden → fora do leitor

    const { start, end } = canonicalWindow(s);
    if (!start) continue;
    const dStart = daysBetween(opts.now, start);
    const dEnd = end ? daysBetween(opts.now, end) : dStart;
    // Janela relevante: ainda não terminou (dEnd ≥ 0) e abre dentro do horizonte.
    if (dEnd < 0 || dStart > opts.horizonDays) continue;

    const engine: "predict" | "forecast" = s.canonicalEngine === "predict" ? "predict" : "forecast";
    const label = s.origin
      ? `${programLabel(s.origin)} → ${programLabel(s.destination)}`
      : programLabel(s.destination);

    const item: ReaderRadarItem = {
      label,
      confidence: canonicalConfidence(s),
      window: s.window ?? "",
      basis: buildBasis(s, engine),
      source: engine,
      seriesKey: s.seriesKey,
    };
    if (s.bonus != null) item.bonus = `~${s.bonus}%`;
    items.push(item);
  }

  const rank: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  items.sort((a, b) => rank[a.confidence] - rank[b.confidence] || a.label.localeCompare(b.label));
  return { items, monitoringCount };
}
