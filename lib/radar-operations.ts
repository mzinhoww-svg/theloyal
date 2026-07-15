// Operação do Radar (Fase P1-C) — filas, alertas, resumo e "o que mudou".
//
// PURO e sem I/O. Deriva TUDO do RadarViewModel do P1-A (loadRadar/composeRadarViewModel)
// e dos helpers do P1-A (lib/radar-filters). NÃO lê o ledger, NÃO recalcula
// Forecast/Predict/qualidade/frescor/divergência/status, NÃO persiste e NÃO
// inventa histórico. Alvo dos testes (tests/radar-operations.test.mjs).

import type { RadarSeries, RadarViewModel, ProductStatus } from "./radar-view-model.ts";
import { mainEngine, predictAvailable, forecastAvailable, duplicateState } from "./radar-filters.ts";

// --------------------------------------------------------------------------- filas
export type RadarQueueKey =
  | "opportunities"
  | "review"
  | "blocked"
  | "suspects"
  | "duplicates"
  | "insufficient"
  | "stale"
  | "no_prediction";

export interface RadarQueue {
  key: RadarQueueKey;
  title: string;
  criterion: string; // critério de entrada (texto de produto)
  action: string; // ação principal
  emptyMessage: string;
  items: RadarSeries[];
}

const hasOverridableBlock = (s: RadarSeries): boolean =>
  s.editorialBlockReasons.some((r) => r.includes("intervalo_extremo") || r.includes("horizonte_excedido"));

const isCritical = (s: RadarSeries): boolean =>
  s.productStatus === "dataset_incomplete" ||
  s.productStatus === "data_quality_blocked" ||
  s.quality.temporalCritical > 0 ||
  s.quality.placeholder > 0;

// § 6 — Oportunidades (elegível, motor pronto, sem bloqueio crítico, base sã).
function opportunities(vm: RadarViewModel): RadarSeries[] {
  if (!vm.metadata.datasetComplete || vm.metadata.freshnessStatus !== "fresh") return [];
  return vm.series
    .filter((s) => s.productStatus === "opportunity" && s.editorialEligible && !isCritical(s) && mainEngine(s) !== "none")
    .sort((a, b) => (a.forecast?.windowStart ?? a.predict?.windowStart ?? "9999").localeCompare(b.forecast?.windowStart ?? b.predict?.windowStart ?? "9999"));
}

// § 7 — Exigem revisão (review_required, divergência, fallback, dup possível).
function review(vm: RadarViewModel): RadarSeries[] {
  return vm.series.filter(
    (s) =>
      s.productStatus === "review_required" ||
      s.divergenceLevel === "review" ||
      s.divergenceLevel === "block" ||
      duplicateState(s) === "possible" ||
      mainEngine(s) === "forecast" ||
      hasOverridableBlock(s),
  );
}

// § 8 — Bloqueadas (globais + por série; hierarquia D16 já aprovada).
const BLOCK_ORDER: ProductStatus[] = ["dataset_incomplete", "data_quality_blocked", "duplicate_review", "insufficient_history", "no_prediction"];
function blocked(vm: RadarViewModel): RadarSeries[] {
  return vm.series
    .filter((s) => BLOCK_ORDER.includes(s.productStatus) || hasOverridableBlock(s) || s.freshnessStatus !== "fresh")
    .sort((a, b) => {
      const ia = BLOCK_ORDER.indexOf(a.productStatus), ib = BLOCK_ORDER.indexOf(b.productStatus);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
}

export function buildRadarQueues(vm: RadarViewModel): RadarQueue[] {
  return [
    { key: "opportunities", title: "Oportunidades", criterion: "elegível, motor pronto, base completa e fresca, sem bloqueio crítico", action: "Abrir análise", emptyMessage: "Nenhuma oportunidade elegível agora.", items: opportunities(vm) },
    { key: "review", title: "Exigem revisão", criterion: "revisão editorial, divergência, fallback do Forecast ou duplicidade possível", action: "Abrir análise", emptyMessage: "Nada aguardando revisão.", items: review(vm) },
    { key: "blocked", title: "Bloqueadas", criterion: "base incompleta, qualidade crítica, duplicidade, histórico insuficiente, sem motor, intervalo/horizonte extremo ou stale", action: "Diagnosticar", emptyMessage: "Nenhuma série bloqueada.", items: blocked(vm) },
    { key: "suspects", title: "Dados suspeitos", criterion: "série com campanha temporalmente crítica (ex.: possível erro de ano)", action: "Auditar dados", emptyMessage: "Nenhuma campanha temporalmente suspeita.", items: vm.series.filter((s) => s.quality.temporalCritical > 0) },
    { key: "duplicates", title: "Duplicidades prováveis", criterion: "série com par de campanhas provavelmente repetido", action: "Auditar duplicidade", emptyMessage: "Nenhuma duplicidade provável.", items: vm.series.filter((s) => s.quality.probableDuplicate > 0) },
    { key: "insufficient", title: "Histórico insuficiente", criterion: "menos ondas que o mínimo para prever/publicar", action: "Acompanhar", emptyMessage: "Todas as séries têm histórico mínimo.", items: vm.series.filter((s) => s.productStatus === "insufficient_history") },
    { key: "stale", title: "Desatualizadas", criterion: "artefato de previsão não está fresco (números suspensos)", action: "Recalcular artefato", emptyMessage: "Base fresca — nada desatualizado.", items: vm.metadata.freshnessStatus === "fresh" ? [] : vm.series },
    { key: "no_prediction", title: "Sem previsão utilizável", criterion: "nenhum motor produziu resultado utilizável", action: "Monitorar", emptyMessage: "Todas as séries têm ao menos um motor utilizável.", items: vm.series.filter((s) => mainEngine(s) === "none" || s.productStatus === "no_prediction") },
  ];
}

// A quais filas uma série pertence (para mostrar sobreposição explicitamente).
export function seriesQueueMembership(vm: RadarViewModel, series: RadarSeries): RadarQueueKey[] {
  return buildRadarQueues(vm).filter((q) => q.items.some((s) => s.seriesKey === series.seriesKey && s.scope === series.scope)).map((q) => q.key);
}

// --------------------------------------------------------------------------- alertas (§9)
export type AlertSeverity = "critical" | "warning" | "info";
export type AlertScope = "global" | "series";

export interface RadarAlert {
  id: string;
  title: string;
  severity: AlertSeverity;
  scope: AlertScope;
  impact: string;
  affected: number; // quantidade afetada
  action: string;
  diagnosticHref: string;
}

export function buildOperationalAlerts(vm: RadarViewModel): RadarAlert[] {
  const h = vm.health;
  const m = vm.metadata;
  const noPredict = vm.series.filter((s) => !predictAvailable(s)).length;
  const noForecast = vm.series.filter((s) => !forecastAvailable(s)).length;
  const noEngine = vm.series.filter((s) => mainEngine(s) === "none").length;
  const divBlock = vm.series.filter((s) => s.divergenceLevel === "block").length;

  const raw: (RadarAlert | null)[] = [
    !m.datasetComplete
      ? { id: "dataset_incomplete", title: "Base incompleta", severity: "critical", scope: "global", impact: "Números suspensos em todo o Radar; nada publica.", affected: h.seriesTotal, action: "Reprocessar leitura do ledger", diagnosticHref: "/admin/radar?view=bloqueios" }
      : null,
    m.freshnessStatus !== "fresh"
      ? { id: "stale", title: `Artefato ${m.freshnessStatus}`, severity: "warning", scope: "global", impact: "O Weekly não publica números até atualizar.", affected: h.staleCount, action: "Recalcular o artefato", diagnosticHref: "/admin/radar?freshness=stale" }
      : null,
    h.temporalCriticalCount > 0
      ? { id: "temporal", title: "Campanhas temporalmente suspeitas", severity: "critical", scope: "series", impact: "Cronologia corrompida excluída antes das ondas (ex.: erro de ano).", affected: h.temporalCriticalCount, action: "Auditar dados suspeitos", diagnosticHref: "/admin/radar?quality=bloqueada" }
      : null,
    h.probableDuplicateCount > 0
      ? { id: "duplicates", title: "Duplicidades prováveis", severity: "warning", scope: "series", impact: "Intervalos falsos evitados; par em revisão.", affected: h.probableDuplicateCount, action: "Auditar duplicidade", diagnosticHref: "/admin/radar?duplicate=probable" }
      : null,
    h.placeholderCount > 0
      ? { id: "placeholders", title: "Programas inválidos (placeholders)", severity: "warning", scope: "series", impact: "Não-programas excluídos das séries.", affected: h.placeholderCount, action: "Revisar extração", diagnosticHref: "/admin/radar?cause=qualidade_temporal" }
      : null,
    noEngine > 0
      ? { id: "no_prediction", title: "Séries sem previsão utilizável", severity: "info", scope: "series", impact: "Nenhum motor produziu resultado utilizável.", affected: noEngine, action: "Monitorar", diagnosticHref: "/admin/radar?engine=none" }
      : null,
    noForecast > 0
      ? { id: "forecast_unavailable", title: "Forecast indisponível", severity: "info", scope: "series", impact: "Sem recorrência suficiente para baseline.", affected: noForecast, action: "Acompanhar", diagnosticHref: "/admin/radar?forecast=no" }
      : null,
    noPredict > 0
      ? { id: "predict_unavailable", title: "Predict indisponível", severity: "info", scope: "series", impact: "Sem prontidão do modelo; usa fallback quando possível.", affected: noPredict, action: "Acompanhar", diagnosticHref: "/admin/radar?predict=no" }
      : null,
    divBlock > 0
      ? { id: "divergence_block", title: "Divergências bloqueantes", severity: "critical", scope: "series", impact: "Motores discordam além do limite; publicação bloqueada até revisão.", affected: divBlock, action: "Revisar divergência", diagnosticHref: "/admin/radar?view=revisoes" }
      : null,
  ];
  const order: AlertSeverity[] = ["critical", "warning", "info"];
  return raw.filter((a): a is RadarAlert => a != null).sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
}

// --------------------------------------------------------------------------- resumo operacional (§12)
export interface OperationalSummary {
  healthy: boolean;
  ready: number;
  needAttention: number;
  blocked: number;
  mainRisk: string;
  priorityAction: string;
  text: string;
}

export function operationalSummary(vm: RadarViewModel): OperationalSummary {
  const queues = buildRadarQueues(vm);
  const q = (k: RadarQueueKey) => queues.find((x) => x.key === k)?.items.length ?? 0;
  const ready = q("opportunities");
  const needAttention = q("review");
  const blocked = new Set(queues.find((x) => x.key === "blocked")?.items.map((s) => s.seriesKey) ?? []).size;
  const h = vm.health, m = vm.metadata;
  const healthy = m.datasetComplete && m.freshnessStatus === "fresh" && blocked === 0 && h.temporalCriticalCount === 0;

  let mainRisk = "Nenhum risco crítico";
  let priorityAction = "Acompanhar as oportunidades";
  if (!m.datasetComplete) { mainRisk = "Base incompleta"; priorityAction = "Reprocessar a leitura do ledger"; }
  else if (m.freshnessStatus !== "fresh") { mainRisk = "Resultado desatualizado"; priorityAction = "Recalcular o artefato de previsão"; }
  else if (h.temporalCriticalCount > 0) { mainRisk = "Campanhas temporalmente suspeitas"; priorityAction = "Auditar os dados suspeitos"; }
  else if (h.probableDuplicateCount > 0) { mainRisk = "Duplicidades prováveis"; priorityAction = "Auditar as duplicidades"; }
  else if (vm.series.some((s) => s.divergenceLevel === "block")) { mainRisk = "Divergência bloqueante entre motores"; priorityAction = "Revisar as divergências"; }

  const text = healthy
    ? `Radar saudável: ${ready} série(s) pronta(s) para análise, nenhuma bloqueada.`
    : `${mainRisk}. ${blocked} bloqueada(s), ${needAttention} em revisão, ${ready} pronta(s). Prioridade: ${priorityAction.toLowerCase()}.`;

  return { healthy, ready, needAttention, blocked, mainRisk, priorityAction, text };
}

// --------------------------------------------------------------------------- "o que mudou" (§10/§11)
export type RadarChangeType =
  | "campaign_excluded_now"
  | "probable_duplicate_detected"
  | "temporal_issue_detected"
  | "eligibility_lost"
  | "insufficient_history_after_quality"
  | "dataset_incomplete"
  | "forecast_stale"
  | "predict_unavailable"
  | "forecast_fallback_active"
  | "divergence_review_required"
  | "divergence_blocking";

export interface RadarChangeEvent {
  type: RadarChangeType;
  count: number;
  scope: AlertScope;
  label: string;
}

const CHANGE_LABEL: Record<RadarChangeType, string> = {
  campaign_excluded_now: "campanhas excluídas nesta leitura",
  probable_duplicate_detected: "duplicidades prováveis detectadas",
  temporal_issue_detected: "problemas temporais detectados",
  eligibility_lost: "séries não elegíveis após exclusões",
  insufficient_history_after_quality: "séries sem histórico mínimo após exclusões",
  dataset_incomplete: "base incompleta nesta leitura",
  forecast_stale: "artefato de previsão desatualizado",
  predict_unavailable: "séries sem Predict disponível",
  forecast_fallback_active: "séries usando Forecast como fallback",
  divergence_review_required: "divergências exigindo revisão",
  divergence_blocking: "divergências bloqueantes",
};

// Mensagem fixa exigida quando um sinal depende de comparação histórica.
export const NO_SNAPSHOT_MESSAGE = "Não disponível sem snapshot histórico persistido.";

// Sinais que EXIGEM snapshot (nunca inferidos a partir do estado atual).
export const CHANGE_UNAVAILABLE: string[] = [
  "probabilidade de ontem versus hoje",
  "janela anterior versus atual",
  "confiança anterior versus atual",
  "motor canônico anterior",
  "aprovação anterior",
  "histórico real de status",
];

export function radarChangeEvents(vm: RadarViewModel): { available: RadarChangeEvent[]; unavailable: string[] } {
  const h = vm.health, m = vm.metadata;
  const counts: Record<RadarChangeType, number> = {
    campaign_excluded_now: h.campaignsExcluded,
    probable_duplicate_detected: h.probableDuplicateCount,
    temporal_issue_detected: h.temporalCriticalCount,
    eligibility_lost: vm.series.filter((s) => !s.editorialEligible && s.campaignsExcluded > 0).length,
    insufficient_history_after_quality: vm.series.filter((s) => s.productStatus === "insufficient_history" && s.campaignsExcluded > 0).length,
    dataset_incomplete: m.datasetComplete ? 0 : 1,
    forecast_stale: m.freshnessStatus === "fresh" ? 0 : 1,
    predict_unavailable: vm.series.filter((s) => !predictAvailable(s)).length,
    forecast_fallback_active: vm.series.filter((s) => mainEngine(s) === "forecast").length,
    divergence_review_required: vm.series.filter((s) => s.divergenceLevel === "review").length,
    divergence_blocking: vm.series.filter((s) => s.divergenceLevel === "block").length,
  };
  const available: RadarChangeEvent[] = (Object.keys(counts) as RadarChangeType[])
    .filter((t) => counts[t] > 0)
    .map((t) => ({ type: t, count: counts[t], scope: (t === "dataset_incomplete" || t === "forecast_stale") ? "global" : "series", label: CHANGE_LABEL[t] }));
  return { available, unavailable: CHANGE_UNAVAILABLE };
}
