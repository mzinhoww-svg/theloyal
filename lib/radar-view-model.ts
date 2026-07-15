// Radar View Model — composição em RUNTIME (Fase P1-A).
//
// PURA e sem I/O: recebe as linhas do ledger já lidas e devolve uma leitura
// ÚNICA que casa Forecast + Predict + Qualidade por série. NÃO cria motor novo,
// NÃO altera gates, NÃO persiste nada. É uma etiqueta de produto sobre saídas
// que já existem (buildForecast / buildPredict / assessCampaignQuality).
//
// Fonte de desenho: docs/BACKLOG-P1-RADAR-UNIFICADO.md (§6, §7, §12),
// docs/APROVACAO-MVP-RADAR.md, docs/DECISOES-PRODUTO-RADAR.md (D2/D6/D16).
//
// O loader com I/O (leitura do ledger, frescor, config) vive em lib/admin-radar.ts;
// este módulo é o alvo dos testes de paridade (tests/radar-view-model.test.mjs).

import {
  buildForecast,
  normProgram,
  formatWindow,
  type CampaignRow,
  type Forecast,
  type ForecastConfig,
} from "./forecast.ts";
import { buildPredict, type Prediction } from "./predict-engine.ts";
import type { CampaignQualityAssessment, ExcludedCampaign, CampaignQualityRow } from "./campaign-quality.ts";

// Estados consolidados da série (§7 do backlog). Precedência "o primeiro que
// dispara vence" — espelha a hierarquia de bloqueios do D16, sem lógica nova.
export type ProductStatus =
  | "dataset_incomplete"
  | "data_quality_blocked"
  | "duplicate_review"
  | "insufficient_history"
  | "no_prediction"
  | "review_required"
  | "opportunity"
  | "monitoring";

// Nível de divergência entre motores (D6). Faixas sobre a data central; a
// sobreposição de janela rebaixa uma faixa (tratado no cálculo).
export type DivergenceLevel = "none" | "compatible" | "warning" | "review" | "block";

// Política canônica do Radar (docs/POLITICA-CANONICA-RADAR.md §1.3–§1.5, §7).
// Motor selecionado como fonte da série e superfície ao leitor após a nota de corte.
// Predict é canônico quando pronto; Forecast é fallback rotulado; nenhum → sem previsão.
export type CanonicalEngine = "predict" | "forecast" | null;
// prediction: passa a nota de corte automática (ainda exige aprovação editorial a jusante).
// monitoring: série real sem previsão publicável — "em observação", nunca número.
// hidden: problema de dado / sem série — não vai ao leitor como série (fica no admin).
export type ReaderSurface = "prediction" | "monitoring" | "hidden";

export interface RadarSeriesQuality {
  campaignsValid: number;
  campaignsExcluded: number;
  temporalCritical: number; // excluídas por severidade temporal crítica
  probableDuplicate: number; // excluídas/relacionadas por duplicidade provável
  placeholder: number;
  used: CampaignQualityRow[]; // as campanhas elegíveis desta série (detalhe P1-B §15)
  excluded: ExcludedCampaign[]; // as excluídas desta série (para o detalhe P1-B)
}

export interface RadarSeries {
  seriesKey: string;
  origin: string | null;
  destination: string;
  scope: "route" | "cluster";
  productStatus: ProductStatus;

  // Saídas dos motores preservadas na íntegra (detalhe P1-B as consome).
  forecast: Forecast | null;
  predict: Prediction | null;
  quality: RadarSeriesQuality;

  editorialEligible: boolean;
  editorialBlockReasons: string[];
  warnings: string[];

  campaignsValid: number;
  campaignsExcluded: number;
  waves: number;
  lastCampaignDate: string | null;
  maxIntervalDays: number | null;

  freshnessStatus: string;
  datasetComplete: boolean;

  // Campos de apresentação (derivados; linguagem de produto).
  modelConfidence: string; // rótulo traduzido (§13)
  window: string | null; // formatWindow do motor canônico
  primaryProbability: PrimaryProbability | null; // §16 — UMA probabilidade (P30/P60) + horizonte
  bonus: number | null; // bônus provável (Predict candidato[0] ou Forecast típico)
  divergenceDays: number | null;
  divergenceLevel: DivergenceLevel;

  // Política canônica (docs/POLITICA-CANONICA-RADAR.md). Campos DERIVADOS, aditivos:
  // nenhum motor novo, nenhum gate recalculado — etiqueta de produto sobre saídas
  // que já existem. `readerPublishable` é a nota de corte AUTOMÁTICA; a aprovação
  // editorial não é computável em runtime (sem persistência) e é gate à parte.
  canonicalEngine: CanonicalEngine; // motor que serve de fonte (proveniência)
  fallbackUsed: boolean; // Forecast servindo de fallback rotulado "cadência aproximada"
  readerPublishable: boolean; // passa a nota de corte automática (falta só aprovação)
  readerSurface: ReaderSurface; // como a série chega (ou não) ao leitor
  readerBlockReasons: string[]; // por que NÃO é publicável (honestidade + auditoria)
}

export interface RadarHealth {
  campaignsTotal: number;
  campaignsEligible: number;
  campaignsExcluded: number;
  seriesTotal: number;
  seriesEditoriallyEligible: number;
  seriesBlocked: number;
  temporalCriticalCount: number;
  possibleDuplicateCount: number;
  probableDuplicateCount: number;
  placeholderCount: number;
  staleCount: number;
  alertCount: number;
}

export interface RadarFilters {
  origins: string[];
  destinations: string[];
  productStatuses: ProductStatus[];
  confidences: string[];
  blockReasons: string[];
}

export interface RadarViewModel {
  metadata: {
    generatedAt: string | null; // do artefato (frescor); null se ausente
    asOf: string; // data de referência do cálculo ao vivo
    datasetComplete: boolean;
    rowsRead: number;
    pagesRead: number;
    freshnessStatus: string;
  };
  health: RadarHealth;
  series: RadarSeries[];
  filters: RadarFilters;
}

export interface ComposeOpts {
  now: string; // ISO date
  config?: Partial<ForecastConfig> | null; // config persistida do Forecast (paridade com /admin/forecast)
  datasetComplete: boolean;
  pagesRead: number;
  freshness: { status: string; generatedAt: string | null; ageHours?: number | null };
  opportunityHorizonDays?: number; // janela considerada "iminente" (default 90 = Weekly, DECISOES §13)
}

const DAY = 86_400_000;
const OVERRIDABLE_BLOCKS = new Set(["intervalo_extremo", "horizonte_excedido"]);

function iso(s: string | null | undefined): string | null {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY);
}

// Chave canônica de série, idêntica ao Forecast.route ("origem→destino" / "→destino").
function seriesKeyOf(scope: "route" | "cluster", origem: string | null, destino: string): string {
  const d = normProgram(destino);
  return scope === "cluster" ? `→${d}` : `${normProgram(origem)}→${d}`;
}

// Rótulos de produto (§13). O termo técnico nunca some — migra ao detalhe.
export function confidenceLabel(c: string): string {
  switch (c) {
    case "alta": return "alta";
    case "media": return "média";
    case "baixa": return "baixa";
    case "insuficiente":
    case "em-formacao": return "histórico insuficiente";
    default: return c;
  }
}

export function productStatusLabel(s: ProductStatus): string {
  switch (s) {
    case "dataset_incomplete": return "Base incompleta";
    case "data_quality_blocked": return "Bloqueada por dado";
    case "duplicate_review": return "Possível repetição";
    case "insufficient_history": return "Histórico insuficiente";
    case "no_prediction": return "Sem previsão";
    case "review_required": return "Exige revisão";
    case "opportunity": return "Oportunidade";
    case "monitoring": return "Em monitoramento";
  }
}

// Estados que contam como "bloqueada" na saúde (não publicável sem ação).
const BLOCKING_STATUSES = new Set<ProductStatus>([
  "dataset_incomplete",
  "data_quality_blocked",
  "duplicate_review",
  "insufficient_history",
  "no_prediction",
]);

// Probabilidade principal da listagem (§16): UM só horizonte, nunca P30 e P90
// juntos como headline. P30 quando a data central prevista é de curto prazo
// (≤30 dias do asOf); senão P60, porque a janela está longe demais para o P30
// representá-la. Fallback Forecast (sem probabilidades) → null (nunca inventa).
// As demais probabilidades seguem disponíveis no detalhe P1-B (predict.probabilities).
export interface PrimaryProbability {
  value: number; // 0..1
  horizonDays: 30 | 60;
}
export function selectPrimaryProbability(predict: Prediction | null): PrimaryProbability | null {
  const probs = predict?.probabilities;
  if (!probs) return null;
  const central = iso(predict!.centralDate);
  const asOf = iso(predict!.asOf);
  const daysToCentral = central && asOf ? daysBetween(asOf, central) : 0;
  return daysToCentral <= 30 ? { value: probs.p30, horizonDays: 30 } : { value: probs.p60, horizonDays: 60 };
}

// Divergência entre motores (D6): faixas sobre |central Predict − centro Forecast|,
// atenuada uma faixa quando as janelas se sobrepõem.
export function computeDivergence(forecast: Forecast | null, predict: Prediction | null): { days: number | null; level: DivergenceLevel } {
  const pc = iso(predict?.centralDate);
  const fStart = iso(forecast?.windowStart);
  const fEnd = iso(forecast?.windowEnd);
  const fCenter = fStart && fEnd ? new Date((Date.parse(fStart) + Date.parse(fEnd)) / 2).toISOString().slice(0, 10) : fStart;
  if (!pc || !fCenter) return { days: null, level: "none" };
  const days = Math.abs(daysBetween(fCenter, pc));
  let level: DivergenceLevel = days <= 14 ? "compatible" : days <= 30 ? "warning" : days <= 60 ? "review" : "block";
  // Atenuante: janelas sobrepostas rebaixam uma faixa.
  const pStart = iso(predict?.windowStart);
  const pEnd = iso(predict?.windowEnd);
  if (fStart && fEnd && pStart && pEnd) {
    const overlap = Date.parse(fStart) <= Date.parse(pEnd) && Date.parse(pStart) <= Date.parse(fEnd);
    if (overlap) {
      if (level === "block") level = "review";
      else if (level === "review") level = "warning";
      else if (level === "warning") level = "compatible";
    }
  }
  return { days, level };
}

// Estado consolidado — precedência determinística. NÃO recalcula gate: lê
// editorialEligible/editorialBlockReason (Forecast), readiness (Predict) e a
// qualidade da série. Frescor do artefato é alerta GLOBAL (§6.1 / D16 nível 9),
// não estado por série — a saúde carrega staleCount separadamente.
function deriveStatus(
  forecast: Forecast | null,
  predict: Prediction | null,
  q: RadarSeriesQuality,
  div: DivergenceLevel,
  opts: { now: string; datasetComplete: boolean; opportunityHorizonDays: number },
): ProductStatus {
  if (!opts.datasetComplete) return "dataset_incomplete";
  if (q.temporalCritical > 0 || q.placeholder > 0) return "data_quality_blocked";
  if (q.probableDuplicate > 0) return "duplicate_review";

  const eligible = forecast?.editorialEligible === true;
  const block = forecast?.editorialBlockReason ?? null;
  const readiness = predict?.readiness ?? null;
  const insufficient =
    readiness === "insufficient_history" ||
    (block != null && /historico_insuficiente/.test(block)) ||
    forecast?.confidence === "em-formacao";

  const hasWindow = iso(predict?.windowStart) != null || iso(forecast?.windowStart) != null;
  const hasProb = predict?.probabilities != null;

  if (insufficient) return "insufficient_history";
  if (!hasWindow && !hasProb && !eligible) return "no_prediction";

  const reviewByBlock = block != null && OVERRIDABLE_BLOCKS.has(block);
  const reviewByFlag = forecast?.requiresEditorialReview === true;
  const reviewByDivergence = div === "review" || div === "block";
  if (!eligible && reviewByBlock) return "review_required";
  if (reviewByFlag || reviewByDivergence) return "review_required";
  if (!eligible) return "no_prediction";

  // Oportunidade: elegível + motor pronto + confiança ≥ média + janela iminente.
  const ready = readiness === "ready" || readiness === "ready_with_warnings";
  const conf = predict?.probabilities != null ? predict.confidence : forecast?.confidence;
  const goodConf = conf === "alta" || conf === "media";
  const startISO = iso(predict?.windowStart) ?? iso(forecast?.windowStart);
  let imminent = false;
  if (startISO) {
    const d = daysBetween(opts.now, startISO);
    imminent = d >= 0 && d <= opts.opportunityHorizonDays;
  }
  if (eligible && goodConf && imminent && (ready || predict == null)) return "opportunity";
  return "monitoring";
}

// Estados de produto que representam PROBLEMA DE DADO — não vão ao leitor como
// série (ficam no admin/fila do operador). Precedem a nota de corte.
const READER_HARD_HIDDEN = new Set<ProductStatus>([
  "dataset_incomplete",
  "data_quality_blocked",
  "duplicate_review",
]);

export interface ReaderDecision {
  canonicalEngine: CanonicalEngine;
  fallbackUsed: boolean;
  readerPublishable: boolean;
  readerSurface: ReaderSurface;
  readerBlockReasons: string[];
}

// Nota de corte de publicação (POLITICA-CANONICA-RADAR.md §7.4). PURA e determinística:
// não recalcula gate, só compõe os sinais que os motores/qualidade já produziram.
// A aprovação editorial (§7.4) NÃO é verificada aqui — não é computável em runtime;
// `readerPublishable=true` significa "passou a nota de corte automática; falta só a
// aprovação humana vigente". O Forecast só chega ao leitor como FALLBACK rotulado.
export function deriveReaderDecision(
  forecast: Forecast | null,
  predict: Prediction | null,
  productStatus: ProductStatus,
  divergence: DivergenceLevel,
  ctx: { datasetComplete: boolean; fresh: boolean },
): ReaderDecision {
  // Motor canônico: Predict quando pronto (probabilities != null ⟺ readiness
  // ready/ready_with_warnings, ver predict-engine); senão Forecast como fallback
  // quando editorialmente elegível; senão nenhum.
  const predictReady = predict?.probabilities != null;
  const forecastEligible = forecast?.editorialEligible === true;
  const canonicalEngine: CanonicalEngine = predictReady ? "predict" : forecastEligible ? "forecast" : null;
  const fallbackUsed = canonicalEngine === "forecast";

  const reasons: string[] = [];
  if (!ctx.datasetComplete) reasons.push("base_incompleta");
  if (!ctx.fresh) reasons.push("artefato_stale");
  if (READER_HARD_HIDDEN.has(productStatus)) reasons.push("qualidade_de_dado");
  if (canonicalEngine === null) reasons.push("sem_motor_pronto");

  // Confiança do motor canônico ≥ média (alta ou media). Forecast "em-formacao" e
  // Predict "insuficiente"/"baixa" reprovam.
  const conf = canonicalEngine === "predict" ? predict!.confidence : canonicalEngine === "forecast" ? forecast!.confidence : null;
  if (!(conf === "alta" || conf === "media")) reasons.push("confianca_abaixo_de_media");

  // Divergência entre motores não pode estar em revisão/bloqueio.
  if (divergence === "review" || divergence === "block") reasons.push(`divergencia_${divergence}`);

  // Backtest do Predict: com ≥3 observações, exige acerto de janela ≥ 0,5.
  if (canonicalEngine === "predict") {
    const bt = predict!.backtest;
    if (bt && bt.observations >= 3 && (bt.windowHitRate == null || bt.windowHitRate < 0.5)) reasons.push("backtest_fraco");
  }

  const readerPublishable = reasons.length === 0;

  // Superfície ao leitor (degradação honesta §4): problema de dado → hidden;
  // publicável → prediction; série real sem previsão publicável → monitoring.
  const readerSurface: ReaderSurface = readerPublishable
    ? "prediction"
    : READER_HARD_HIDDEN.has(productStatus)
      ? "hidden"
      : "monitoring";

  return { canonicalEngine, fallbackUsed, readerPublishable, readerSurface, readerBlockReasons: reasons };
}

// --------------------------------------------------------------------------- compose
export function composeRadarViewModel(rows: CampaignRow[], opts: ComposeOpts): RadarViewModel {
  const now = opts.now;
  const opportunityHorizonDays = opts.opportunityHorizonDays ?? 90;

  // Motores sobre AS MESMAS linhas — cada um roda sua própria qualidade (mesmo
  // conjunto elegível por construção C0.2). Nenhum cálculo é duplicado aqui.
  const fc = buildForecast(rows, { now, config: opts.config });
  const pr = buildPredict(rows, { asOf: now });
  const quality = fc.quality; // idêntico ao de pr.quality (mesmo assessCampaignQuality)

  // Índices por série.
  const fByKey = new Map<string, Forecast>();
  for (const f of [...fc.routes, ...fc.clusters]) fByKey.set(seriesKeyOf(f.scope, f.origem, f.destino), f);
  const pByKey = new Map<string, Prediction>();
  for (const p of [...pr.routes, ...pr.clusters]) pByKey.set(seriesKeyOf(p.scope, p.origem, p.destino), p);

  // Excluídas agrupadas por rota e por destino (para casar com clusters).
  const exclByRoute = new Map<string, ExcludedCampaign[]>();
  const exclByDest = new Map<string, ExcludedCampaign[]>();
  for (const e of quality.excluded) {
    (exclByRoute.get(e.route) ?? exclByRoute.set(e.route, []).get(e.route)!).push(e);
    const dest = e.route.split("→")[1] ?? "";
    (exclByDest.get(dest) ?? exclByDest.set(dest, []).get(dest)!).push(e);
  }
  // Válidas (elegíveis) agrupadas por rota e por destino (para o detalhe P1-B).
  const usedByRoute = new Map<string, CampaignQualityRow[]>();
  const usedByDest = new Map<string, CampaignQualityRow[]>();
  for (const r of quality.eligibleRows) {
    const rk = `${normProgram(r.origem)}→${normProgram(r.destino)}`;
    (usedByRoute.get(rk) ?? usedByRoute.set(rk, []).get(rk)!).push(r);
    const d = normProgram(r.destino);
    (usedByDest.get(d) ?? usedByDest.set(d, []).get(d)!).push(r);
  }

  const keys = new Set<string>(Array.from(fByKey.keys()).concat(Array.from(pByKey.keys())));
  const series: RadarSeries[] = [];

  for (const key of Array.from(keys)) {
    const forecast = fByKey.get(key) ?? null;
    const predict = pByKey.get(key) ?? null;
    const base = forecast ?? predict;
    if (!base) continue;
    const scope = base.scope;
    const origin = scope === "cluster" ? null : normProgram(base.origem);
    const destination = normProgram(base.destino);

    const excluded = scope === "cluster" ? (exclByDest.get(destination) ?? []) : (exclByRoute.get(key) ?? []);
    const used = scope === "cluster" ? (usedByDest.get(destination) ?? []) : (usedByRoute.get(key) ?? []);
    const seriesQuality: RadarSeriesQuality = {
      campaignsValid: used.length,
      campaignsExcluded: excluded.length,
      temporalCritical: excluded.filter((e) => e.temporal.severity === "critical").length,
      probableDuplicate: excluded.filter((e) => e.duplicate.status === "probable_duplicate").length,
      placeholder: excluded.filter((e) => e.reason === "placeholder_program").length,
      used,
      excluded,
    };

    const div = computeDivergence(forecast, predict);
    const productStatus = deriveStatus(forecast, predict, seriesQuality, div.level, {
      now,
      datasetComplete: opts.datasetComplete,
      opportunityHorizonDays,
    });
    const reader = deriveReaderDecision(forecast, predict, productStatus, div.level, {
      datasetComplete: opts.datasetComplete,
      fresh: opts.freshness.status === "fresh",
    });

    const warnings = Array.from(new Set([...(forecast?.warnings ?? []), ...(predict?.warnings ?? [])]));
    const editorialBlockReasons = [forecast?.editorialBlockReason, predict?.blockReason].filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );

    const hasPredictWindow = predict?.probabilities != null;
    const modelConfidence = confidenceLabel(hasPredictWindow ? predict!.confidence : forecast?.confidence ?? "insuficiente");
    // Janela do motor canônico; null quando não há início real (evita "sem base").
    const winStart = hasPredictWindow ? predict!.windowStart : forecast?.windowStart ?? null;
    const winEnd = hasPredictWindow ? predict!.windowEnd : forecast?.windowEnd ?? null;
    const window = winStart ? formatWindow(winStart, winEnd) : null;

    series.push({
      seriesKey: key,
      origin,
      destination,
      scope,
      productStatus,
      forecast,
      predict,
      quality: seriesQuality,
      editorialEligible: forecast?.editorialEligible === true,
      editorialBlockReasons,
      warnings,
      campaignsValid: seriesQuality.campaignsValid,
      campaignsExcluded: seriesQuality.campaignsExcluded,
      waves: forecast?.samples ?? predict?.recordsTotal ?? 0,
      lastCampaignDate: forecast?.lastWindow ?? (predict && predict.events.length ? predict.events[predict.events.length - 1] : null),
      maxIntervalDays: forecast?.maxIntervalDays ?? null,
      freshnessStatus: opts.freshness.status,
      datasetComplete: opts.datasetComplete,
      modelConfidence,
      window,
      primaryProbability: selectPrimaryProbability(predict),
      bonus: predict?.bonusCandidates?.[0]?.value ?? forecast?.typicalPercent ?? null,
      divergenceDays: div.days,
      divergenceLevel: div.level,
      canonicalEngine: reader.canonicalEngine,
      fallbackUsed: reader.fallbackUsed,
      readerPublishable: reader.readerPublishable,
      readerSurface: reader.readerSurface,
      readerBlockReasons: reader.readerBlockReasons,
    });
  }

  // Ordenação: trabalho primeiro (bloqueadas/revisão), depois oportunidades, resto.
  const ORDER: ProductStatus[] = [
    "dataset_incomplete", "data_quality_blocked", "duplicate_review", "review_required",
    "insufficient_history", "no_prediction", "opportunity", "monitoring",
  ];
  series.sort((a, b) => ORDER.indexOf(a.productStatus) - ORDER.indexOf(b.productStatus) || a.seriesKey.localeCompare(b.seriesKey));

  const stale = opts.freshness.status !== "fresh";
  const seriesBlocked = series.filter((s) => BLOCKING_STATUSES.has(s.productStatus)).length;
  const divergences = series.filter((s) => s.divergenceLevel === "review" || s.divergenceLevel === "block").length;

  const health: RadarHealth = {
    campaignsTotal: quality.counters.totalReceived,
    campaignsEligible: quality.counters.totalEligible,
    campaignsExcluded: quality.excluded.length,
    seriesTotal: series.length,
    seriesEditoriallyEligible: series.filter((s) => s.editorialEligible).length,
    seriesBlocked,
    // Conta TODA excluída com severidade temporal crítica (o contador do motor
    // classifica uma suspeita que também é duplicata sob blockedDuplicate; aqui
    // queremos "quantas campanhas temporalmente suspeitas", sem depender do bucket).
    temporalCriticalCount: quality.excluded.filter((e) => e.temporal.severity === "critical").length,
    possibleDuplicateCount: quality.counters.possibleDuplicateGroups,
    probableDuplicateCount: quality.counters.probableDuplicateGroups,
    placeholderCount: quality.counters.blockedPlaceholder,
    // Frescor é global (artefato); staleCount conta as séries com números
    // suspensos por artefato desatualizado — não muda o productStatus por série.
    staleCount: stale ? series.length : 0,
    alertCount:
      (opts.datasetComplete ? 0 : 1) +
      (stale ? 1 : 0) +
      (quality.counters.blockedTemporal > 0 ? 1 : 0) +
      (quality.counters.probableDuplicateGroups > 0 ? 1 : 0) +
      (divergences > 0 ? 1 : 0),
  };

  const filters: RadarFilters = {
    origins: Array.from(new Set(series.map((s) => s.origin).filter((x): x is string => x != null))).sort(),
    destinations: Array.from(new Set(series.map((s) => s.destination))).sort(),
    productStatuses: ORDER.filter((st) => series.some((s) => s.productStatus === st)),
    confidences: Array.from(new Set(series.map((s) => s.modelConfidence))).sort(),
    blockReasons: Array.from(new Set(series.flatMap((s) => s.editorialBlockReasons))).sort(),
  };

  return {
    metadata: {
      generatedAt: opts.freshness.generatedAt,
      asOf: fc.generatedFor,
      datasetComplete: opts.datasetComplete,
      rowsRead: rows.length,
      pagesRead: opts.pagesRead,
      freshnessStatus: opts.freshness.status,
    },
    health,
    series,
    filters,
  };
}
