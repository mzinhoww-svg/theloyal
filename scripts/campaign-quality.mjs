// Qualidade temporal + duplicidade provável em RUNTIME (Fase C0.2).
// ESPELHO ESM de lib/campaign-quality.ts — mesma lógica, sem tipos. Ao alterar
// as regras aqui, replique lá (garantido por tests/forecast-parity.test.mjs).

export const DEFAULT_QUALITY_CONFIG = {
  eventFarBeforeSourceWarningDays: 180,
  eventFarBeforeSourceCriticalDays: 300,
  eventAfterSourceToleranceDays: 30,
  yearMismatchToleranceDays: 300,
  provenanceProximityDays: 15,
  duplicatePossibleScore: 3,
  duplicateProbableScore: 5,
};

const defaultNormalize = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TRAILING = /(\d{4}-\d{2}-\d{2})$/;
const DAY = 86_400_000;

function isoOrNull(s) {
  if (typeof s !== "string") return null;
  const d = s.slice(0, 10);
  if (!ISO.test(d)) return null;
  return Number.isFinite(Date.parse(d + "T00:00:00Z")) ? d : null;
}
function toMs(d) {
  return Date.parse(d + "T00:00:00Z");
}
function diffDays(a, b) {
  return Math.round((toMs(b) - toMs(a)) / DAY);
}

const PERMANENT = new Set(["na", "n/a", "sem prazo", "permanente", "indeterminado", ""]);
function isPermanentMarker(v) {
  if (v == null) return false;
  return PERMANENT.has(String(v).trim().toLowerCase());
}
function isPlaceholderProgram(n) {
  return !n || n === "desconhecido" || n === "unknown" || n === "na";
}

export function resolveEventDateCandidate(row) {
  const inicio = isoOrNull(row.vigencia_inicio);
  if (inicio) return inicio;
  const m = typeof row.id === "string" ? row.id.match(TRAILING) : null;
  const idDate = m ? isoOrNull(m[1]) : null;
  if (idDate) return idDate;
  const fim = isoOrNull(row.vigencia_fim);
  if (fim) return fim;
  return null;
}

function provenanceDates(row) {
  return [row.first_seen, row.observed_at, row.created_at, row.last_seen].map(isoOrNull).filter((x) => x != null);
}

export function evaluateTemporalPlausibility(row, config = {}) {
  const cfg = { ...DEFAULT_QUALITY_CONFIG, ...config };
  const eventDate = resolveEventDateCandidate(row);
  const prov = provenanceDates(row);
  const minProv = prov.length ? prov.reduce((a, b) => (a < b ? a : b)) : null;
  const maxProv = prov.length ? prov.reduce((a, b) => (a > b ? a : b)) : null;

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

  const flags = [];
  const reasons = [];
  let requiresReprocessing = false;
  let requiresHumanReview = false;

  const cInicio = isoOrNull(row.vigencia_inicio);
  const mId = typeof row.id === "string" ? row.id.match(TRAILING) : null;
  const cId = mId ? isoOrNull(mId[1]) : null;
  const cFim = isoOrNull(row.vigencia_fim);
  const cands = [cInicio, cId, cFim].filter((x) => x != null);
  let conflicting = false;
  if (cInicio && cFim && diffDays(cInicio, cFim) < 0) conflicting = true;
  for (let i = 0; i < cands.length; i++)
    for (let j = i + 1; j < cands.length; j++)
      if (Math.abs(diffDays(cands[i], cands[j])) > cfg.yearMismatchToleranceDays) conflicting = true;
  if (conflicting) {
    flags.push("conflicting_event_dates");
    reasons.push("datas de evento (início/id/fim) divergem de forma incompatível");
    requiresHumanReview = true;
  }

  const dayDifference = minProv ? diffDays(eventDate, minProv) : null;
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
  const status = critical
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
    includeInPrediction: !critical,
    requiresReprocessing, requiresHumanReview,
    reasons,
  });
}

function assemble(status, flags, rest) {
  const severity = status === "suspect_year" ? "critical" : status === "valid" ? "ok" : "warning";
  return { status, severity, flags, ...rest };
}

function idOf(r, normalize) {
  if (typeof r.id === "string" && r.id) return r.id;
  return `${normalize(r.origem)}-${normalize(r.destino)}-${resolveEventDateCandidate(r) ?? "nodate"}`;
}
function domainOf(url) {
  if (typeof url !== "string" || !url) return null;
  return url.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase() || null;
}
function provProximity(a, b) {
  const A = [a.first_seen, a.observed_at, a.created_at].map(isoOrNull).filter((x) => x != null);
  const B = [b.first_seen, b.observed_at, b.created_at].map(isoOrNull).filter((x) => x != null);
  let m = null;
  for (const x of A) for (const y of B) {
    const d = Math.abs(diffDays(x, y));
    if (m == null || d < m) m = d;
  }
  return m;
}

function pairScore(a, b, ta, tb, cfg) {
  let s = 0;
  const reasons = [];
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

export function detectProbableDuplicates(rows, temporalById, opts = {}) {
  const cfg = { ...DEFAULT_QUALITY_CONFIG, ...(opts.config ?? {}) };
  const normalize = opts.normalize ?? defaultNormalize;
  const byCampaignId = {};
  const groups = [];

  const byKey = new Map();
  for (const r of rows) {
    const k = `${normalize(r.origem)}|${normalize(r.destino)}|${normalize(r.tipo)}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)).push(r);
  }

  for (const grp of byKey.values()) {
    if (grp.length < 2) {
      for (const r of grp) byCampaignId[idOf(r, normalize)] = { status: "unique", score: 0, reasons: [], relatedCampaignIds: [] };
      continue;
    }
    const parent = grp.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (i, j) => { parent[find(i)] = find(j); };
    const edgeScore = {};
    for (let i = 0; i < grp.length; i++)
      for (let j = i + 1; j < grp.length; j++) {
        const ta = temporalById[idOf(grp[i], normalize)];
        const tb = temporalById[idOf(grp[j], normalize)];
        const sc = pairScore(grp[i], grp[j], ta, tb, cfg);
        if (sc.score >= cfg.duplicatePossibleScore) { union(i, j); edgeScore[`${i}-${j}`] = sc; }
      }
    const clusters = new Map();
    for (let i = 0; i < grp.length; i++) {
      const root = find(i);
      (clusters.get(root) ?? clusters.set(root, []).get(root)).push(i);
    }
    for (const idxs of clusters.values()) {
      if (idxs.length < 2) {
        byCampaignId[idOf(grp[idxs[0]], normalize)] = { status: "unique", score: 0, reasons: [], relatedCampaignIds: [] };
        continue;
      }
      let maxScore = 0;
      const reasons = new Set();
      for (let a = 0; a < idxs.length; a++)
        for (let b = a + 1; b < idxs.length; b++) {
          const e = edgeScore[`${Math.min(idxs[a], idxs[b])}-${Math.max(idxs[a], idxs[b])}`];
          if (e) { maxScore = Math.max(maxScore, e.score); e.reasons.forEach((x) => reasons.add(x)); }
        }
      const status = maxScore >= cfg.duplicateProbableScore ? "probable_duplicate" : "possible_duplicate";
      const ids = idxs.map((i) => idOf(grp[i], normalize));
      groups.push({ campaignIds: ids, status, score: maxScore, reasons: [...reasons] });
      for (const i of idxs) {
        const id = idOf(grp[i], normalize);
        byCampaignId[id] = { status, score: maxScore, reasons: [...reasons], relatedCampaignIds: ids.filter((x) => x !== id) };
      }
    }
  }
  return { groups, byCampaignId };
}

export function isCampaignEligibleForPrediction(row, temporal, duplicate, opts = {}) {
  const normalize = opts.normalize ?? defaultNormalize;
  if (isPlaceholderProgram(normalize(row.origem)) || isPlaceholderProgram(normalize(row.destino)))
    return { eligible: false, reason: "placeholder_program" };
  if (!temporal.includeInPrediction) {
    const base = temporal.status;
    return { eligible: false, reason: duplicate.status === "probable_duplicate" ? `${base}+probable_duplicate` : base };
  }
  return { eligible: true, reason: null };
}

export function assessCampaignQuality(rows, opts = {}) {
  const normalize = opts.normalize ?? defaultNormalize;
  const config = opts.config ?? {};
  const transf = rows.filter((r) => normalize(r.tipo) === "transferencia");

  const temporalById = {};
  for (const r of transf) temporalById[idOf(r, normalize)] = evaluateTemporalPlausibility(r, config);

  const dup = detectProbableDuplicates(transf, temporalById, { config, normalize });

  const perId = {};
  const eligibleRows = [];
  const excluded = [];
  const counters = {
    totalReceived: transf.length, totalEligible: 0,
    blockedMissingDate: 0, blockedTemporal: 0, blockedDuplicate: 0, blockedPlaceholder: 0,
    possibleDuplicateGroups: dup.groups.filter((g) => g.status === "possible_duplicate").length,
    probableDuplicateGroups: dup.groups.filter((g) => g.status === "probable_duplicate").length,
  };

  for (const r of transf) {
    const id = idOf(r, normalize);
    const temporal = temporalById[id];
    const duplicate = dup.byCampaignId[id] ?? { status: "unique", score: 0, reasons: [], relatedCampaignIds: [] };
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
