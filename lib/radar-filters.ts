// Filtros do Radar (Fase P1-A, complemento). ÚNICO sistema de filtros da rota
// /admin/radar — consolida e expande o `applyFilters` que vivia inline em
// app/admin/(panel)/radar/page.tsx. PURO e sem I/O: opera sobre o RadarSeries[]
// JÁ composto (lib/radar-view-model.ts), lê apenas campos existentes, não recalcula
// Forecast/Predict/qualidade/duplicidade/frescor/elegibilidade/bloqueio, não lê o
// ledger e não escreve nada. Combinação por AND. Testado em tests/radar-filters.test.mjs.

import type { RadarSeries } from "./radar-view-model.ts";

// Todas as chaves são query params (GET). Vazio/ausente = "todos" (não filtra).
export interface RadarFilterValues {
  q?: string; // busca textual na chave da série (origem→destino)
  status?: string; // productStatus
  confidence?: string; // modelConfidence (rótulo traduzido)
  scope?: string; // route | cluster
  destination?: string; // programa de destino
  origin?: string; // programa de origem, ou "__cluster__" p/ agregados
  eligible?: string; // yes | no
  cause?: string; // motivo de bloqueio derivado (ver seriesCauses)
  freshness?: string; // fresh | stale | incomplete | invalid | missing
  duplicate?: string; // none | possible | probable
  quality?: string; // valida | atencao | bloqueada
  engine?: string; // predict | forecast | none (motor PRINCIPAL)
  predict?: string; // yes | no (disponibilidade do Predict)
  forecast?: string; // yes | no (disponibilidade do Forecast)
}

export const CLUSTER_ORIGIN = "__cluster__";

// --- Derivações de produto (tradução de campos existentes; nenhum cálculo novo) ---

// Motor PRINCIPAL (D2/D6): Predict quando ready/ready_with_warnings; senão
// Forecast como fallback rotulado quando elegível com janela; senão nenhum.
export function mainEngine(s: RadarSeries): "predict" | "forecast" | "none" {
  const p = s.predict;
  if (p && (p.readiness === "ready" || p.readiness === "ready_with_warnings") && p.probabilities != null) {
    return "predict";
  }
  if (s.forecast?.editorialEligible === true && !!s.forecast.windowStart) return "forecast";
  return "none";
}

// DISPONIBILIDADE dos motores — distinta do motor principal. Predict disponível =
// produziu probabilidades; Forecast disponível = produziu janela (não em-formação).
export function predictAvailable(s: RadarSeries): boolean {
  return !!s.predict && s.predict.probabilities != null;
}
export function forecastAvailable(s: RadarSeries): boolean {
  return !!s.forecast && s.forecast.confidence !== "em-formacao" && !!s.forecast.windowStart;
}

// Estado de duplicidade DA SÉRIE (não o total global). Provável tem contador
// próprio; possível é lido das excluídas da série (campo já existente).
export function duplicateState(s: RadarSeries): "none" | "possible" | "probable" {
  if (s.quality.probableDuplicate > 0) return "probable";
  if (s.quality.excluded.some((e) => e.duplicate.status === "possible_duplicate")) return "possible";
  return "none";
}

// Classe de qualidade (tradução, não score novo). Campos que determinam cada opção:
//   bloqueada: quality.temporalCritical>0 OU quality.placeholder>0 OU quality.probableDuplicate>0
//   atenção : warnings>0 OU campaignsExcluded>0 OU duplicidade possível OU divergência (warning|review|block)
//   válida  : nenhum dos acima
export function qualityClass(s: RadarSeries): "valida" | "atencao" | "bloqueada" {
  const q = s.quality;
  if (q.temporalCritical > 0 || q.placeholder > 0 || q.probableDuplicate > 0) return "bloqueada";
  const attention =
    s.warnings.length > 0 ||
    q.campaignsExcluded > 0 ||
    duplicateState(s) === "possible" ||
    s.divergenceLevel === "warning" ||
    s.divergenceLevel === "review" ||
    s.divergenceLevel === "block";
  return attention ? "atencao" : "valida";
}

// Motivos de bloqueio DERIVADOS (tradução do que já está no View Model). Cada
// código traduz um campo existente; a lista de opções é o conjunto realmente
// presente (deriveCauses), nunca uma lista fixa divergente.
export function seriesCauses(s: RadarSeries): string[] {
  const c: string[] = [];
  if (s.productStatus === "dataset_incomplete") c.push("base_incompleta");
  if (s.quality.temporalCritical > 0) c.push("qualidade_temporal");
  if (s.quality.probableDuplicate > 0) c.push("duplicidade");
  if (s.productStatus === "insufficient_history") c.push("historico_insuficiente");
  if (s.productStatus === "no_prediction") c.push("sem_motor");
  if (s.editorialBlockReasons.some((r) => r.includes("intervalo_extremo"))) c.push("intervalo_extremo");
  if (s.editorialBlockReasons.some((r) => r.includes("horizonte_excedido"))) c.push("horizonte_excedido");
  if (s.freshnessStatus !== "fresh") c.push("desatualizado");
  return c;
}

// Ordem e rótulos de produto dos motivos (só p/ apresentação das opções presentes).
const CAUSE_ORDER = [
  "base_incompleta",
  "qualidade_temporal",
  "duplicidade",
  "historico_insuficiente",
  "sem_motor",
  "intervalo_extremo",
  "horizonte_excedido",
  "desatualizado",
] as const;

export const CAUSE_LABEL: Record<string, string> = {
  base_incompleta: "base incompleta",
  qualidade_temporal: "qualidade temporal",
  duplicidade: "duplicidade",
  historico_insuficiente: "histórico insuficiente",
  sem_motor: "motor indisponível",
  intervalo_extremo: "intervalo extremo",
  horizonte_excedido: "horizonte excessivo",
  desatualizado: "resultado desatualizado",
};

export interface RadarFilterFacets {
  causes: string[]; // motivos realmente presentes, na ordem canônica
}

// Opções de filtro DERIVADAS das séries presentes (motivos de bloqueio). Origem,
// destino, status e confiança já vêm de vm.filters.
export function deriveFilterFacets(series: RadarSeries[]): RadarFilterFacets {
  const present = new Set<string>();
  for (const s of series) for (const c of seriesCauses(s)) present.add(c);
  return { causes: CAUSE_ORDER.filter((c) => present.has(c)) };
}

// --- Aplicação (AND de todos os filtros + busca) ---
export function applyRadarFilters(series: RadarSeries[], f: RadarFilterValues): RadarSeries[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return series.filter((s) => {
    // Existentes (preservados 1:1 do applyFilters inline anterior).
    if (q && !s.seriesKey.toLowerCase().includes(q)) return false;
    if (f.status && s.productStatus !== f.status) return false;
    if (f.confidence && s.modelConfidence !== f.confidence) return false;
    if (f.scope && s.scope !== f.scope) return false;
    if (f.destination && s.destination !== f.destination) return false;

    // Novos.
    if (f.origin) {
      if (f.origin === CLUSTER_ORIGIN) {
        if (s.scope !== "cluster") return false;
      } else if (s.origin !== f.origin) {
        return false;
      }
    }
    if (f.eligible === "yes" && !s.editorialEligible) return false;
    if (f.eligible === "no" && s.editorialEligible) return false;
    if (f.cause && !seriesCauses(s).includes(f.cause)) return false;
    if (f.freshness && s.freshnessStatus !== f.freshness) return false;
    if (f.duplicate && duplicateState(s) !== f.duplicate) return false;
    if (f.quality && qualityClass(s) !== f.quality) return false;
    if (f.engine && mainEngine(s) !== f.engine) return false;
    if (f.predict === "yes" && !predictAvailable(s)) return false;
    if (f.predict === "no" && predictAvailable(s)) return false;
    if (f.forecast === "yes" && !forecastAvailable(s)) return false;
    if (f.forecast === "no" && forecastAvailable(s)) return false;
    return true;
  });
}

// Chaves de filtro (para parse de query params e preservação na URL).
export const RADAR_FILTER_KEYS: (keyof RadarFilterValues)[] = [
  "q", "status", "confidence", "scope", "destination", "origin", "eligible",
  "cause", "freshness", "duplicate", "quality", "engine", "predict", "forecast",
];
