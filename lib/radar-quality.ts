// Fase C0 — Contenção de dados temporais e resultados incoerentes do Radar.
// Funções PURAS, em memória, sem I/O e sem persistência. Fonte de verdade da
// contenção; ESPELHO de scripts/radar-quality.mjs (parity test em tests/).
//
// NÃO corrige datas, NÃO altera IDs, NÃO deduplica no banco. Só CLASSIFICA e
// BLOQUEIA em runtime. Ver docs/architecture/adr/ADR-RADAR-009 e 010.

import { windowDate, normProgram, buildForecast, radarItems, type CampaignRow, type Forecast, type ForecastConfig, type RadarItem } from "./forecast";

export const QUALITY_VERSION = "c0_v1";
export const THRESHOLDS = {
  eventFarBeforeSourceWarningDays: 180,
  eventFarBeforeSourceCriticalDays: 300,
  eventAfterSourceToleranceDays: 30,
  longIntervalWarningDays: 365,
  extremeIntervalDays: 540,
  criticalIntervalDays: 900,
  minForecastEditorialWaves: 5,
  maxEditorialHorizonDays: 180,
  criticalHorizonDays: 365,
  maxForecastAgeHours: 24,
  duplicateProbableScore: 4,
  duplicatePossibleScore: 2,
  duplicateNearPercentDelta: 5,
  duplicateProvenanceProximityDays: 21,
};

export const INVALID_PLACEHOLDERS = new Set([
  "null",
  "desconhecido",
  "cartao",
  "cartoes",
  "cartoes de credito",
  "parceiros",
  "bancos",
  "vantagens",
  "",
]);

export const AMBIGUOUS_ALIASES = new Set([
  "inter",
  "loop",
  "interloop",
  "inter-loop",
  "all",
  "allaccor",
  "accor",
  "azulfidelidade",
]);

export const PERMANENT_TOKENS = new Set(["na", "n/a", "sem prazo", "permanente", "indeterminado"]);

const DAY_MS = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function isISO(s: unknown): s is string {
  return typeof s === "string" && ISO.test(s.slice(0, 10)) && Number.isFinite(Date.parse(s.slice(0, 10) + "T00:00:00Z"));
}
function ms(iso: string): number {
  return Date.parse(iso.slice(0, 10) + "T00:00:00Z");
}
function daysBetween(a: string, b: string): number {
  return Math.round((ms(b) - ms(a)) / DAY_MS);
}
function domainOf(url: unknown): string {
  if (typeof url !== "string") return "";
  const m = url.match(/^https?:\/\/([^/]+)/i);
  return m ? m[1].replace(/^www\./, "").toLowerCase() : "";
}

export function isPlaceholderProgram(s: unknown): boolean {
  return INVALID_PLACEHOLDERS.has(normProgram(s));
}
export function isAmbiguousAlias(s: unknown): boolean {
  return AMBIGUOUS_ALIASES.has(normProgram(s));
}
export function isPermanentVigencia(v: unknown): boolean {
  return typeof v === "string" && PERMANENT_TOKENS.has(v.trim().toLowerCase());
}

export interface CampaignLike extends CampaignRow {
  first_seen?: string | null;
  last_seen?: string | null;
  observed_at?: string | null;
  created_at?: string | null;
  source_url?: string | null;
  origin?: string | null;
  notes?: string | null;
  percentual?: number | string | null;
}

export function eventDateOf(row: CampaignLike): string | null {
  return windowDate(row);
}
export function provenanceDateOf(row: CampaignLike): string | null {
  if (isISO(row.first_seen)) return String(row.first_seen).slice(0, 10);
  if (isISO(row.observed_at)) return String(row.observed_at).slice(0, 10);
  if (isISO(row.created_at)) return String(row.created_at).slice(0, 10);
  return null;
}

function swapDayMonth(iso: string): string | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (m <= 12 && d <= 12 && isISO(`${y}-${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}`)) {
    return `${y}-${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}`;
  }
  return null;
}

export type TemporalStatus =
  | "valid"
  | "missing_event_date"
  | "suspect_year"
  | "suspect_month"
  | "suspect_day_month"
  | "event_far_before_source"
  | "event_after_source"
  | "conflicting_event_dates"
  | "invalid_date"
  | "permanent_or_open_ended";

export interface TemporalResult {
  status: TemporalStatus;
  flags: string[];
  severity: "ok" | "info" | "warning" | "medium" | "critical";
  includeInPrediction: boolean;
  requiresReprocessing: boolean;
  requiresHumanReview: boolean;
  reasons: string[];
  eventDate: string | null;
  provenanceDate: string | null;
}

export function evaluateTemporalPlausibility(campaign: CampaignLike): TemporalResult {
  const T = THRESHOLDS;
  const flags: string[] = [];
  const reasons: string[] = [];
  const vi = isISO(campaign.vigencia_inicio) ? String(campaign.vigencia_inicio).slice(0, 10) : null;
  const vfRaw = campaign.vigencia_fim;
  const permanent = isPermanentVigencia(vfRaw);
  const vf = isISO(vfRaw) ? String(vfRaw).slice(0, 10) : null;
  const event = eventDateOf(campaign);
  const prov = provenanceDateOf(campaign);

  if (vi && vf && ms(vi) > ms(vf)) {
    flags.push("conflicting_event_dates");
    reasons.push(`vigencia_inicio ${vi} > vigencia_fim ${vf}`);
  }

  if (!event) {
    if (permanent) {
      return {
        status: "permanent_or_open_ended",
        flags: ["permanent_or_open_ended"],
        severity: "info",
        includeInPrediction: false,
        requiresReprocessing: false,
        requiresHumanReview: false,
        reasons: ["vigência permanente/aberta (na) — oferta ativa sem data de recorrência"],
        eventDate: null,
        provenanceDate: prov,
      };
    }
    const invalid = vfRaw != null && !permanent && !vf && String(vfRaw).trim() !== "";
    return {
      status: invalid ? "invalid_date" : "missing_event_date",
      flags: invalid ? ["invalid_date"] : ["missing_event_date"],
      severity: invalid ? "critical" : "medium",
      includeInPrediction: false,
      requiresReprocessing: invalid,
      requiresHumanReview: false,
      reasons: [invalid ? `vigencia_fim inválida: ${String(vfRaw).slice(0, 24)}` : "sem data de evento resolvível"],
      eventDate: null,
      provenanceDate: prov,
    };
  }

  let severity: TemporalResult["severity"] = "ok";
  let includeInPrediction = true;
  let requiresReprocessing = false;
  let requiresHumanReview = false;

  if (prov) {
    const gap = daysBetween(event, prov);
    if (gap > T.eventFarBeforeSourceCriticalDays) {
      flags.push("event_far_before_source");
      reasons.push(`evento ${event} está ${gap} dias antes da publicação ${prov}`);
      const yearMismatch = event.slice(0, 4) !== prov.slice(0, 4);
      if (yearMismatch) {
        flags.push("suspect_year");
        reasons.push(`ano do evento (${event.slice(0, 4)}) ≠ ano da publicação (${prov.slice(0, 4)})`);
      }
      const swapped = swapDayMonth(event);
      if (swapped && Math.abs(daysBetween(swapped, prov)) < gap) {
        flags.push("suspect_day_month");
        reasons.push(`possível troca dia/mês (${event} ↔ ${swapped})`);
      }
      severity = "critical";
      includeInPrediction = false;
      requiresReprocessing = true;
      requiresHumanReview = true;
    } else if (gap > T.eventFarBeforeSourceWarningDays) {
      flags.push("event_far_before_source");
      reasons.push(`evento ${event} ${gap} dias antes da publicação ${prov} (warning)`);
      severity = "warning";
      requiresHumanReview = true;
    } else if (-gap > T.eventAfterSourceToleranceDays) {
      flags.push("event_after_source");
      reasons.push(`evento ${event} é ${-gap} dias posterior à publicação ${prov}`);
      severity = "warning";
    }
  }

  if (flags.includes("conflicting_event_dates")) {
    severity = "critical";
    includeInPrediction = false;
    requiresReprocessing = true;
    requiresHumanReview = true;
  }

  const order = [
    "invalid_date",
    "conflicting_event_dates",
    "suspect_year",
    "event_far_before_source",
    "suspect_month",
    "suspect_day_month",
    "event_after_source",
    "missing_event_date",
  ];
  const status = (order.find((f) => flags.includes(f)) ?? "valid") as TemporalStatus;
  return { status, flags, severity, includeInPrediction, requiresReprocessing, requiresHumanReview, reasons, eventDate: event, provenanceDate: prov };
}

export type DuplicateStatus = "unique" | "possible_duplicate" | "probable_duplicate";
export interface DuplicateGroup {
  campaignIds: (string | null | undefined)[];
  duplicateStatus: DuplicateStatus;
  duplicateScore: number;
  reasons: string[];
}

export function detectProbableDuplicates(rows: CampaignLike[]): DuplicateGroup[] {
  const T = THRESHOLDS;
  const groups = new Map<string, CampaignLike[]>();
  for (const r of rows) {
    const key = `${normProgram(r.origem)}|${normProgram(r.destino)}|${normProgram(r.tipo)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }
  const RELATION = /(ultimo[- ]?dia|prorrog|lancamento|lançamento|reabert|extens|volta|de volta)/i;
  const out: DuplicateGroup[] = [];
  for (const group of Array.from(groups.values())) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const reasons: string[] = [];
        let score = 0;
        const pa = Number(a.percentual);
        const pb = Number(b.percentual);
        if (Number.isFinite(pa) && Number.isFinite(pb)) {
          if (pa === pb) { score += 2; reasons.push(`mesmo percentual (${pa})`); }
          else if (Math.abs(pa - pb) <= T.duplicateNearPercentDelta) { score += 1; reasons.push(`percentual próximo (${pa}/${pb})`); }
        }
        const da = domainOf(a.source_url);
        const db = domainOf(b.source_url);
        if (da && da === db) { score += 2; reasons.push(`mesma fonte (${da})`); }
        const txtA = `${a.source_url ?? ""} ${a.notes ?? ""}`;
        const txtB = `${b.source_url ?? ""} ${b.notes ?? ""}`;
        if (RELATION.test(txtA) || RELATION.test(txtB)) { score += 2; reasons.push("relação textual (lançamento/último dia/prorrogado/extensão)"); }
        const provA = provenanceDateOf(a);
        const provB = provenanceDateOf(b);
        if (provA && provB && Math.abs(daysBetween(provA, provB)) <= T.duplicateProvenanceProximityDays) {
          score += 1; reasons.push("datas de publicação próximas");
        }
        const ta = evaluateTemporalPlausibility(a);
        const tb = evaluateTemporalPlausibility(b);
        const oneSuspect = ta.severity === "critical" || tb.severity === "critical";
        const otherValid = ta.status === "valid" || tb.status === "valid";
        if (oneSuspect && otherValid) { score += 2; reasons.push("uma data suspeita + outra plausível"); }
        const vfa = String(a.vigencia_fim ?? "");
        const vfb = String(b.vigencia_fim ?? "");
        if (vfa && vfb && vfa !== vfb) { score += 1; reasons.push(`vigências diferentes (${vfa}/${vfb})`); }

        let duplicateStatus: DuplicateStatus = "unique";
        if (score >= T.duplicateProbableScore) duplicateStatus = "probable_duplicate";
        else if (score >= T.duplicatePossibleScore) duplicateStatus = "possible_duplicate";
        if (duplicateStatus !== "unique") {
          out.push({ campaignIds: [a.id, b.id], duplicateStatus, duplicateScore: score, reasons });
        }
      }
    }
  }
  return out;
}

export function classifyInterval(days: number): "normal" | "long" | "extreme" | "critical" {
  const T = THRESHOLDS;
  if (days >= T.criticalIntervalDays) return "critical";
  if (days >= T.extremeIntervalDays) return "extreme";
  if (days >= T.longIntervalWarningDays) return "long";
  return "normal";
}

export type FreshnessStatus = "fresh" | "stale" | "missing" | "invalid" | "incomplete";
export interface FreshnessResult {
  status: FreshnessStatus;
  ageHours: number | null;
  reasons: string[];
}

export function evaluateForecastFreshness(json: Record<string, unknown> | null | undefined, nowMs: number): FreshnessResult {
  const T = THRESHOLDS;
  if (json == null) return { status: "missing", ageHours: null, reasons: ["forecast.json ausente"] };
  const required = ["generatedAt", "generatedFor", "ledgerRows"];
  const missing = required.filter((k) => json[k] == null);
  if (json.source === "offline" || json.generatedAt == null) {
    return { status: "invalid", ageHours: null, reasons: ["gerado em modo offline / sem generatedAt"] };
  }
  if (missing.length) return { status: "invalid", ageHours: null, reasons: [`campos ausentes: ${missing.join(", ")}`] };
  if (json.datasetComplete === false) return { status: "incomplete", ageHours: null, reasons: ["dataset incompleto (paginação truncada)"] };
  const gen = Date.parse(String(json.generatedAt));
  if (!Number.isFinite(gen)) return { status: "invalid", ageHours: null, reasons: ["generatedAt inválido"] };
  const ageHours = (nowMs - gen) / 3_600_000;
  if (ageHours > T.maxForecastAgeHours) return { status: "stale", ageHours, reasons: [`idade ${ageHours.toFixed(1)}h > ${T.maxForecastAgeHours}h`] };
  return { status: "fresh", ageHours, reasons: [] };
}

export interface Assessment {
  eligible: CampaignLike[];
  blocked: CampaignLike[];
  duplicates: DuplicateGroup[];
  temporalById: Map<string | null | undefined, TemporalResult>;
  blockedIds: Set<string | null | undefined>;
  placeholderIds: Set<string | null | undefined>;
  probableDupIds: Set<string | null | undefined>;
  counts: Record<string, number>;
}

export function assessCampaigns(rows: CampaignLike[], opts: { now?: string } = {}): Assessment {
  void opts;
  const transfers = rows.filter((r) => String(r.tipo ?? "").trim().toLowerCase() === "transferencia");
  const temporalById = new Map<string | null | undefined, TemporalResult>();
  const blockedIds = new Set<string | null | undefined>();
  const placeholderIds = new Set<string | null | undefined>();
  const counts: Record<string, number> = {
    transfers: transfers.length,
    missingDate: 0,
    temporalBlocked: 0,
    temporalWarning: 0,
    placeholders: 0,
    possibleDuplicates: 0,
    probableDuplicates: 0,
  };

  for (const r of transfers) {
    const t = evaluateTemporalPlausibility(r);
    temporalById.set(r.id, t);
    if (!t.eventDate) counts.missingDate++;
    if (t.severity === "warning") counts.temporalWarning++;
    if (isPlaceholderProgram(r.origem) || isPlaceholderProgram(r.destino)) {
      placeholderIds.add(r.id);
      blockedIds.add(r.id);
      counts.placeholders++;
    }
    if (!t.includeInPrediction) {
      blockedIds.add(r.id);
      if (t.severity === "critical") counts.temporalBlocked++;
    }
  }

  const dups = detectProbableDuplicates(transfers);
  const probableDupIds = new Set<string | null | undefined>();
  for (const d of dups) {
    if (d.duplicateStatus === "probable_duplicate") {
      counts.probableDuplicates++;
      for (const id of d.campaignIds) {
        const t = temporalById.get(id);
        if (t && t.severity === "critical") { probableDupIds.add(id); blockedIds.add(id); }
      }
      if (!d.campaignIds.some((id) => temporalById.get(id)?.severity === "critical")) {
        for (const id of d.campaignIds) probableDupIds.add(id);
      }
    } else counts.possibleDuplicates++;
  }

  const eligible = transfers.filter((r) => !blockedIds.has(r.id));
  const blocked = transfers.filter((r) => blockedIds.has(r.id));
  return { eligible, blocked, duplicates: dups, temporalById, blockedIds, placeholderIds, probableDupIds, counts };
}

export interface EditorialGate {
  editorialEligible: boolean;
  editorialBlockReasons: string[];
  warnings: string[];
  requiresEditorialReview: boolean;
  longestInterval: number;
  intervalClass: "normal" | "long" | "extreme" | "critical";
  horizonDays: number | null;
}

export function evaluateEditorialGate(forecast: Forecast, now: string): EditorialGate {
  const T = THRESHOLDS;
  const longest = forecast.intervals && forecast.intervals.length ? Math.max(...forecast.intervals) : 0;
  const intervalClass = classifyInterval(longest);
  const horizonDays = forecast.windowStart && isISO(forecast.windowStart) && isISO(now)
    ? daysBetween(now, forecast.windowStart) : null;
  const editorialBlockReasons: string[] = [];
  const warnings: string[] = [];
  if (forecast.samples < T.minForecastEditorialWaves) {
    editorialBlockReasons.push(`amostra insuficiente (${forecast.samples} < ${T.minForecastEditorialWaves} ondas)`);
  }
  if (intervalClass === "extreme" || intervalClass === "critical") {
    editorialBlockReasons.push(`intervalo ${intervalClass} (${longest} dias)`);
  } else if (intervalClass === "long") {
    warnings.push(`intervalo longo (${longest} dias)`);
  }
  if (horizonDays != null && horizonDays > T.criticalHorizonDays) {
    editorialBlockReasons.push(`horizonte crítico (${horizonDays} > ${T.criticalHorizonDays} dias)`);
  } else if (horizonDays != null && horizonDays > T.maxEditorialHorizonDays) {
    warnings.push(`horizonte além do editorial (${horizonDays} > ${T.maxEditorialHorizonDays} dias)`);
  }
  const requiresEditorialReview =
    warnings.length > 0 || (horizonDays != null && horizonDays > T.maxEditorialHorizonDays) || intervalClass !== "normal";
  const editorialEligible =
    editorialBlockReasons.length === 0 && forecast.confidence !== "em-formacao" && forecast.windowStart != null;
  return { editorialEligible, editorialBlockReasons, warnings, requiresEditorialReview, longestInterval: longest, intervalClass, horizonDays };
}

export interface AnnotatedForecast {
  forecast: Forecast;
  meta: EditorialGate & { temporalStatus: string; datasetComplete: boolean };
}

export function containForecast(
  rows: CampaignLike[],
  opts: { now?: string; datasetComplete?: boolean; config?: Partial<ForecastConfig> | null } = {},
) {
  const now = opts.now || new Date().toISOString().slice(0, 10);
  const datasetComplete = opts.datasetComplete !== false;
  const assessment = assessCampaigns(rows, { now });
  const result = buildForecast(assessment.eligible as CampaignRow[], { now, config: opts.config });

  const byKey = new Map<string, AnnotatedForecast["meta"]>();
  const annotate = (list: Forecast[]): AnnotatedForecast[] =>
    list.map((f) => {
      const gate = evaluateEditorialGate(f, now);
      const meta = {
        ...gate,
        temporalStatus: "ok",
        editorialEligible: gate.editorialEligible && datasetComplete,
        editorialBlockReasons: datasetComplete ? gate.editorialBlockReasons : ["dataset incompleto", ...gate.editorialBlockReasons],
        datasetComplete,
      };
      byKey.set(`${f.scope}:${f.route}`, meta);
      return { forecast: f, meta };
    });
  const routes = annotate(result.routes);
  const clusters = annotate(result.clusters);

  return { now, datasetComplete, result, routes, clusters, byKey, assessment, counts: assessment.counts };
}

export function radarItemsEligible(annotated: AnnotatedForecast[]): RadarItem[] {
  const ok = annotated.filter((a) => a.meta.editorialEligible).map((a) => a.forecast);
  return radarItems(ok);
}
