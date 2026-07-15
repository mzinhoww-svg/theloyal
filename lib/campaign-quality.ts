// Qualidade temporal + duplicidade provável em RUNTIME (Fase C0.2).
//
// Pura, testável e SEM I/O. Roda ANTES da formação de ondas/intervalos, tanto no
// Forecast quanto no Predict, para que ambos partam do MESMO conjunto elegível.
// NUNCA altera, corrige ou apaga dados — só marca (runtime) e decide elegibilidade.
//
// Injeção de dependências (para não duplicar regras entre os motores):
//   • normalize  — normProgram do motor (aliases canônicos)
//   • datas do evento — resolvidas aqui pela MESMA prioridade do windowDate
//     (vigencia_inicio > data no id > vigencia_fim), mas o fato de uma data ser
//     ISO válida NÃO significa que seja temporalmente plausível.
//
// Base de evidência: docs/AUDITORIA-FORENSE-PREDICT-FORECAST.md,
// docs/auditoria/edge-function-campaigns.md, ADR-RADAR-009/010.

export interface CampaignQualityRow {
  id?: string | null;
  origem?: string | null;
  destino?: string | null;
  tipo?: string | null;
  percentual?: number | string | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  observed_at?: string | null;
  created_at?: string | null;
  origin?: string | null;
  source_url?: string | null;
}

export type TemporalStatus =
  | "valid"
  | "missing_event_date"
  | "invalid_event_date"
  | "permanent_or_open_ended"
  | "event_far_before_source"
  | "event_after_source"
  | "conflicting_event_dates"
  | "suspect_year"
  | "suspect_month"
  | "suspect_day_month";

export type Severity = "ok" | "warning" | "critical";
export type DuplicateStatus = "unique" | "possible_duplicate" | "probable_duplicate";

export interface TemporalResult {
  status: TemporalStatus;
  severity: Severity;
  flags: TemporalStatus[];
  eventDate: string | null;
  provenanceDate: string | null;
  dayDifference: number | null; // proveniência(mín) − evento (positivo = evento no passado)
  includeInPrediction: boolean;
  requiresReprocessing: boolean;
  requiresHumanReview: boolean;
  reasons: string[];
}

export interface DuplicateInfo {
  status: DuplicateStatus;
  score: number;
  reasons: string[];
  relatedCampaignIds: string[];
}

export interface QualityConfig {
  eventFarBeforeSourceWarningDays: number;
  eventFarBeforeSourceCriticalDays: number;
  eventAfterSourceToleranceDays: number;
  yearMismatchToleranceDays: number;
  provenanceProximityDays: number;
  duplicatePossibleScore: number;
  duplicateProbableScore: number;
}

export const DEFAULT_QUALITY_CONFIG: QualityConfig = {
  eventFarBeforeSourceWarningDays: 180,
  eventFarBeforeSourceCriticalDays: 300,
  eventAfterSourceToleranceDays: 30,
  yearMismatchToleranceDays: 300,
  provenanceProximityDays: 15,
  duplicatePossibleScore: 3,
  duplicateProbableScore: 5,
};

export type NormalizeFn = (s: unknown) => string;
const defaultNormalize: NormalizeFn = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// --------------------------------------------------------------------------- datas
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TRAILING = /(\d{4}-\d{2}-\d{2})$/;
const DAY = 86_400_000;

function isoOrNull(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const d = s.slice(0, 10);
  if (!ISO.test(d)) return null;
  return Number.isFinite(Date.parse(d + "T00:00:00Z")) ? d : null;
}
function toMs(d: string): number {
  return Date.parse(d + "T00:00:00Z");
}
function diffDays(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / DAY);
}

// Placeholders de vigência permanente/sem prazo.
const PERMANENT = new Set(["na", "n/a", "sem prazo", "permanente", "indeterminado", ""]);
function isPermanentMarker(v: unknown): boolean {
  if (v == null) return false;
  return PERMANENT.has(String(v).trim().toLowerCase());
}
function isPlaceholderProgram(n: string): boolean {
  return !n || n === "desconhecido" || n === "unknown" || n === "na";
}

// Resolve a data candidata do evento — MESMA prioridade do windowDate dos motores.
export function resolveEventDateCandidate(row: CampaignQualityRow): string | null {
  const inicio = isoOrNull(row.vigencia_inicio);
  if (inicio) return inicio;
  const m = typeof row.id === "string" ? row.id.match(TRAILING) : null;
  const idDate = m ? isoOrNull(m[1]) : null;
  if (idDate) return idDate;
  const fim = isoOrNull(row.vigencia_fim);
  if (fim) return fim;
  return null;
}

function provenanceDates(row: CampaignQualityRow): string[] {
  return [row.first_seen, row.observed_at, row.created_at, row.last_seen]
    .map(isoOrNull)
    .filter((x): x is string => x != null);
}

// --------------------------------------------------------------- qualidade temporal
export function evaluateTemporalPlausibility(
  row: CampaignQualityRow,
  config: Partial<QualityConfig> = {},
): TemporalResult {
  const cfg = { ...DEFAULT_QUALITY_CONFIG, ...config };
  const eventDate = resolveEventDateCandidate(row);
  const prov = provenanceDates(row);
  const minProv = prov.length ? prov.reduce((a, b) => (a < b ? a : b)) : null;
  const maxProv = prov.length ? prov.reduce((a, b) => (a > b ? a : b)) : null;

  // Sem data de evento resolvível.
  if (!eventDate) {
    if (isPermanentMarker(row.vigencia_fim)) {
      return assemble("permanent_or_open_ended", ["permanent_or_open_ended"], {
        eventDate: null, provenanceDate: minProv, dayDifference: null,
        includeInPrediction: false, requiresReprocessing: false, requiresHumanReview: false,
        reasons: ["campanha permanente/estrutural (sem data de evento) — fora da recorrência"],
      });
    }
    const hadDateInput =
      (row.vigencia_inicio != null && String(row.vigencia_inicio).trim() !== "") ||
      (row.vigencia_fim != null && String(row.vigencia_fim).trim() !== "" && !isPermanentMarker(row.vigencia_fim)) ||
      (typeof row.id === "string" && TRAILING.test(row.id));
    if (hadDateInput) {
      return assemble("invalid_event_date", ["invalid_event_date"], {
        eventDate: null, provenanceDate: minProv, dayDifference: null,
        includeInPrediction: false, requiresReprocessing: false, requiresHumanReview: true,
        reasons: ["data de evento presente porém inválida"],
      });
    }
    return assemble("missing_event_date", ["missing_event_date"], {
      eventDate: null, provenanceDate: minProv, dayDifference: null,
      includeInPrediction: false, requiresReprocessing: false, requiresHumanReview: false,
      reasons: ["sem data de evento resolvível"],
    });
  }

  const flags: TemporalStatus[] = [];
  const reasons: string[] = [];
  let requiresReprocessing = false;
  let requiresHumanReview = false;

  // Candidatas individuais (para detectar conflito).
  const cInicio = isoOrNull(row.vigencia_inicio);
  const mId = typeof row.id === "string" ? row.id.match(TRAILING) : null;
  const cId = mId ? isoOrNull(mId[1]) : null;
  const cFim = isoOrNull(row.vigencia_fim);
  const cands = [cInicio, cId, cFim].filter((x): x is string => x != null);
  let conflicting = false;
  if (cInicio && cFim && diffDays(cInicio, cFim) < 0) conflicting = true; // início após fim
  for (let i = 0; i < cands.length; i++)
    for (let j = i + 1; j < cands.length; j++)
      if (Math.abs(diffDays(cands[i], cands[j])) > cfg.yearMismatchToleranceDays) conflicting = true;
  if (conflicting) {
    flags.push("conflicting_event_dates");
    reasons.push("datas de evento (início/id/fim) divergem de forma incompatível");
    requiresHumanReview = true;
  }

  const dayDifference = minProv ? diffDays(eventDate, minProv) : null; // prov − evento
  // Início explícito igual ao evento = evidência de campanha histórica intencional.
  const explicitHistorical = !!cInicio && cInicio === eventDate;

  if (dayDifference != null && dayDifference > cfg.eventFarBeforeSourceCriticalDays) {
    if (explicitHistorical) {
      flags.push("event_far_before_source");
      reasons.push(`evento ${dayDifference}d antes da proveniência, mas com início explícito — revisar`);
      requiresHumanReview = true;
    } else {
      flags.push("suspect_year");
      reasons.push(`evento ${dayDifference}d antes da proveniência sem início explícito — ano provavelmente fabricado`);
      requiresReprocessing = true;
      requiresHumanReview = true;
    }
  } else if (dayDifference != null && dayDifference > cfg.eventFarBeforeSourceWarningDays) {
    flags.push("event_far_before_source");
    reasons.push(`evento ${dayDifference}d antes da proveniência`);
  }

  if (maxProv && diffDays(maxProv, eventDate) > cfg.eventAfterSourceToleranceDays) {
    flags.push("event_after_source");
    reasons.push(`evento ${diffDays(maxProv, eventDate)}d após a última proveniência — revisar (campanha futura?)`);
    requiresHumanReview = true;
  }

  const critical = flags.includes("suspect_year");
  const status: TemporalStatus = critical
    ? "suspect_year"
    : flags.includes("conflicting_event_dates")
      ? "conflicting_event_dates"
      : flags.includes("event_after_source")
        ? "event_after_source"
        : flags.includes("event_far_before_source")
          ? "event_far_before_source"
          : "valid";

  return assemble(status, flags.length ? flags : ["valid"], {
    eventDate, provenanceDate: minProv, dayDifference,
    includeInPrediction: !critical, // só o crítico (suspect_year) exclui entre os datados
    requiresReprocessing, requiresHumanReview,
    reasons,
  });
}

function assemble(
  status: TemporalStatus,
  flags: TemporalStatus[],
  rest: Omit<TemporalResult, "status" | "severity" | "flags">,
): TemporalResult {
  const severity: Severity = status === "suspect_year" ? "critical" : status === "valid" ? "ok" : "warning";
  return { status, severity, flags, ...rest };
}

// --------------------------------------------------------------- duplicidade provável
function idOf(r: CampaignQualityRow, normalize: NormalizeFn): string {
  if (typeof r.id === "string" && r.id) return r.id;
  return `${normalize(r.origem)}-${normalize(r.destino)}-${resolveEventDateCandidate(r) ?? "nodate"}`;
}
function domainOf(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  return url.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase() || null;
}
function provProximity(a: CampaignQualityRow, b: CampaignQualityRow): number | null {
  const A = [a.first_seen, a.observed_at, a.created_at].map(isoOrNull).filter((x): x is string => x != null);
  const B = [b.first_seen, b.observed_at, b.created_at].map(isoOrNull).filter((x): x is string => x != null);
  let m: number | null = null;
  for (const x of A) for (const y of B) {
    const d = Math.abs(diffDays(x, y));
    if (m == null || d < m) m = d;
  }
  return m;
}

function pairScore(
  a: CampaignQualityRow,
  b: CampaignQualityRow,
  ta: TemporalResult,
  tb: TemporalResult,
  cfg: QualityConfig,
): { score: number; reasons: string[] } {
  let s = 0;
  const reasons: string[] = [];
  const pa = Number(a.percentual);
  const pb = Number(b.percentual);
  if (Number.isFinite(pa) && Number.isFinite(pb)) {
    if (pa === pb) { s += 2; reasons.push("mesmo percentual"); }
    else if (Math.abs(pa - pb) <= 5) { s += 1; reasons.push("percentual próximo"); }
  }
  const prox = provProximity(a, b);
  if (prox != null && prox <= cfg.provenanceProximityDays) { s += 2; reasons.push(`proveniência próxima (${prox}d)`); }
  const da = domainOf(a.source_url);
  const db = domainOf(b.source_url);
  if (da && db && da === db) { s += 1; reasons.push("mesmo domínio de fonte"); }
  if (a.source_url && b.source_url && a.source_url === b.source_url) { s += 1; reasons.push("mesma URL"); }
  const oneCritical = (ta.severity === "critical") !== (tb.severity === "critical");
  if (oneCritical) { s += 3; reasons.push("uma data plausível + uma temporalmente crítica"); }
  if (ta.eventDate && tb.eventDate && Math.abs(diffDays(ta.eventDate, tb.eventDate)) > cfg.yearMismatchToleranceDays) {
    s += 1;
    reasons.push("intervalo de vigência incompatível");
  }
  return { score: s, reasons };
}

export function detectProbableDuplicates(
  rows: CampaignQualityRow[],
  temporalById: Record<string, TemporalResult>,
  opts: { config?: Partial<QualityConfig>; normalize?: NormalizeFn } = {},
): { groups: { campaignIds: string[]; status: DuplicateStatus; score: number; reasons: string[] }[]; byCampaignId: Record<string, DuplicateInfo> } {
  const cfg = { ...DEFAULT_QUALITY_CONFIG, ...(opts.config ?? {}) };
  const normalize = opts.normalize ?? defaultNormalize;
  const byCampaignId: Record<string, DuplicateInfo> = {};
  const groups: { campaignIds: string[]; status: DuplicateStatus; score: number; reasons: string[] }[] = [];

  const byKey = new Map<string, CampaignQualityRow[]>();
  for (const r of rows) {
    const k = `${normalize(r.origem)}|${normalize(r.destino)}|${normalize(r.tipo)}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(r);
  }

  for (const grp of Array.from(byKey.values())) {
    if (grp.length < 2) {
      for (const r of grp) byCampaignId[idOf(r, normalize)] = { status: "unique", score: 0, reasons: [], relatedCampaignIds: [] };
      continue;
    }
    // União de pares com score ≥ possível (union-find simples por índice).
    const parent = grp.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (i: number, j: number) => { parent[find(i)] = find(j); };
    const edgeScore: Record<string, { score: number; reasons: string[] }> = {};
    for (let i = 0; i < grp.length; i++)
      for (let j = i + 1; j < grp.length; j++) {
        const ta = temporalById[idOf(grp[i], normalize)];
        const tb = temporalById[idOf(grp[j], normalize)];
        const sc = pairScore(grp[i], grp[j], ta, tb, cfg);
        if (sc.score >= cfg.duplicatePossibleScore) { union(i, j); edgeScore[`${i}-${j}`] = sc; }
      }
    const clusters = new Map<number, number[]>();
    for (let i = 0; i < grp.length; i++) {
      const root = find(i);
      (clusters.get(root) ?? clusters.set(root, []).get(root)!).push(i);
    }
    for (const idxs of Array.from(clusters.values())) {
      if (idxs.length < 2) {
        byCampaignId[idOf(grp[idxs[0]], normalize)] = { status: "unique", score: 0, reasons: [], relatedCampaignIds: [] };
        continue;
      }
      let maxScore = 0;
      const reasons = new Set<string>();
      for (let a = 0; a < idxs.length; a++)
        for (let b = a + 1; b < idxs.length; b++) {
          const e = edgeScore[`${Math.min(idxs[a], idxs[b])}-${Math.max(idxs[a], idxs[b])}`];
          if (e) { maxScore = Math.max(maxScore, e.score); e.reasons.forEach((x) => reasons.add(x)); }
        }
      const status: DuplicateStatus = maxScore >= cfg.duplicateProbableScore ? "probable_duplicate" : "possible_duplicate";
      const ids = idxs.map((i) => idOf(grp[i], normalize));
      groups.push({ campaignIds: ids, status, score: maxScore, reasons: Array.from(reasons) });
      for (const i of idxs) {
        const id = idOf(grp[i], normalize);
        byCampaignId[id] = { status, score: maxScore, reasons: Array.from(reasons), relatedCampaignIds: ids.filter((x) => x !== id) };
      }
    }
  }
  return { groups, byCampaignId };
}

// --------------------------------------------------------------- elegibilidade
export function isCampaignEligibleForPrediction(
  row: CampaignQualityRow,
  temporal: TemporalResult,
  duplicate: DuplicateInfo,
  opts: { normalize?: NormalizeFn } = {},
): { eligible: boolean; reason: string | null } {
  const normalize = opts.normalize ?? defaultNormalize;
  if (isPlaceholderProgram(normalize(row.origem)) || isPlaceholderProgram(normalize(row.destino)))
    return { eligible: false, reason: "placeholder_program" };
  if (!temporal.includeInPrediction) {
    const base = temporal.status;
    return { eligible: false, reason: duplicate.status === "probable_duplicate" ? `${base}+probable_duplicate` : base };
  }
  return { eligible: true, reason: null };
}

// --------------------------------------------------------------- orquestrador
export interface QualityCounters {
  totalReceived: number;
  totalEligible: number;
  blockedMissingDate: number;
  blockedTemporal: number;
  blockedDuplicate: number;
  blockedPlaceholder: number;
  possibleDuplicateGroups: number;
  probableDuplicateGroups: number;
}

export interface ExcludedCampaign {
  id: string;
  route: string;
  reason: string;
  temporal: TemporalResult;
  duplicate: DuplicateInfo;
}

export interface CampaignQualityAssessment {
  perId: Record<string, { temporal: TemporalResult; duplicate: DuplicateInfo; eligible: boolean; exclusionReason: string | null }>;
  eligibleRows: CampaignQualityRow[];
  excluded: ExcludedCampaign[];
  counters: QualityCounters;
  duplicateGroups: { campaignIds: string[]; status: DuplicateStatus; score: number; reasons: string[] }[];
}

// Ponto ÚNICO de qualidade. Recebe o ledger cru; filtra transferências (com o
// normalize do motor), avalia temporal + duplicidade e devolve o conjunto
// elegível + diagnósticos. Aplicado igual no Forecast e no Predict.
export function assessCampaignQuality(
  rows: CampaignQualityRow[],
  opts: { config?: Partial<QualityConfig>; normalize?: NormalizeFn } = {},
): CampaignQualityAssessment {
  const normalize = opts.normalize ?? defaultNormalize;
  const config = opts.config ?? {};
  const transf = rows.filter((r) => normalize(r.tipo) === "transferencia");

  const temporalById: Record<string, TemporalResult> = {};
  for (const r of transf) temporalById[idOf(r, normalize)] = evaluateTemporalPlausibility(r, config);

  const dup = detectProbableDuplicates(transf, temporalById, { config, normalize });

  const perId: CampaignQualityAssessment["perId"] = {};
  const eligibleRows: CampaignQualityRow[] = [];
  const excluded: ExcludedCampaign[] = [];
  const counters: QualityCounters = {
    totalReceived: transf.length, totalEligible: 0,
    blockedMissingDate: 0, blockedTemporal: 0, blockedDuplicate: 0, blockedPlaceholder: 0,
    possibleDuplicateGroups: dup.groups.filter((g) => g.status === "possible_duplicate").length,
    probableDuplicateGroups: dup.groups.filter((g) => g.status === "probable_duplicate").length,
  };

  for (const r of transf) {
    const id = idOf(r, normalize);
    const temporal = temporalById[id];
    const duplicate = dup.byCampaignId[id] ?? { status: "unique" as DuplicateStatus, score: 0, reasons: [], relatedCampaignIds: [] };
    const elig = isCampaignEligibleForPrediction(r, temporal, duplicate, { normalize });
    perId[id] = { temporal, duplicate, eligible: elig.eligible, exclusionReason: elig.reason };
    if (elig.eligible) {
      eligibleRows.push(r);
      counters.totalEligible++;
    } else {
      excluded.push({ id, route: `${normalize(r.origem)}→${normalize(r.destino)}`, reason: elig.reason ?? "", temporal, duplicate });
      if (elig.reason === "placeholder_program") counters.blockedPlaceholder++;
      else if (duplicate.status === "probable_duplicate") counters.blockedDuplicate++;
      else if (temporal.status === "missing_event_date") counters.blockedMissingDate++;
      else counters.blockedTemporal++;
    }
  }

  return { perId, eligibleRows, excluded, counters, duplicateGroups: dup.groups };
}
