// Vocabulário único de badges/severidade do Radar (Fase P1-D, §8/§9).
// Fonte ÚNICA das cores (tons) por estado/severidade — para que um badge
// signifique a MESMA coisa em toda tela (visão geral, detalhe, operação).
// Sem novo design system: só centraliza mapas que estavam duplicados.
// Regra do projeto: cor nunca é o único indicador — todo badge carrega texto.

import type { Tone } from "./ui";
import type { ProductStatus, DivergenceLevel } from "@/lib/radar-view-model";
import type { AlertSeverity } from "@/lib/radar-operations";
import type { Severity } from "@/lib/campaign-quality";

// Estado de produto da série (§7 do backlog / D16).
export const PRODUCT_STATUS_TONE: Record<ProductStatus, Tone> = {
  dataset_incomplete: "red",
  data_quality_blocked: "red",
  duplicate_review: "yellow",
  review_required: "yellow",
  insufficient_history: "gray",
  no_prediction: "gray",
  opportunity: "green",
  monitoring: "blue",
};

// Divergência entre motores (D6).
export const DIVERGENCE_TONE: Record<DivergenceLevel, Tone> = {
  none: "gray",
  compatible: "green",
  warning: "yellow",
  review: "yellow",
  block: "red",
};

// Severidade dos alertas operacionais (§9).
export const ALERT_SEVERITY_TONE: Record<AlertSeverity, Tone> = {
  critical: "red",
  warning: "yellow",
  info: "blue",
};

// Severidade temporal de uma campanha excluída (C0.2).
export const TEMPORAL_SEVERITY_TONE: Record<Severity, Tone> = {
  ok: "green",
  warning: "yellow",
  critical: "red",
};

// Frescor do artefato (só `fresh` é verde).
export function freshnessTone(status: string): Tone {
  return status === "fresh" ? "green" : status === "stale" ? "yellow" : "red";
}
