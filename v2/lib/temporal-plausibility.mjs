// Plausibilidade temporal — Fase 1a da correção da origem (edge fn `campaigns`).
//
// PURO e determinístico (sem I/O, sem LLM). Compara a data de EVENTO extraída
// (vigencia_inicio, senão vigencia_fim) com a data de PROVENIÊNCIA (first_seen =
// news_raw.published_at) e devolve um flag. NÃO autocorrige a data (ADR-RADAR-010 /
// INV-16): proveniência valida, não substitui. O suspeito sai da série
// (include_in_prediction=false) mas NÃO é deletado (D-042).
//
// O limiar `suspectYearDays` (365 por padrão) é valor DE PARTIDA — alvo de
// calibração do Agente 3 contra a distribuição real (ADR-RADAR-010, não congela).
//
// Esta é a fonte de verdade testável (golden em temporal-plausibility.test.mjs).
// A edge fn Deno (supabase/functions/campaigns/index.ts) espelha esta lógica
// inline — mantenha as duas em sincronia (mesmo contrato do matcher do M1).

export const DEFAULT_TEMPORAL_CONFIG = {
  suspectYearDays: 365, // evento > N dias antes da fonte → suspect_year (partida, calibrável)
  eventAfterSourceDays: 30, // evento > N dias DEPOIS da fonte → informativo (não bloqueia)
};

const ISO = /^\d{4}-\d{2}-\d{2}/;
const DAY_MS = 86_400_000;

function toMs(iso) {
  return Date.parse(iso.slice(0, 10) + "T00:00:00Z");
}
function isIso(s) {
  return typeof s === "string" && ISO.test(s) && !Number.isNaN(toMs(s));
}

// Retorna { temporalStatus, includeInPrediction, eventDate, daysEventBeforeSource }.
// temporalStatus ∈ 'valid' | 'suspect_year' | 'event_after_source'.
export function evaluateTemporalPlausibility(input, config = {}) {
  const cfg = { ...DEFAULT_TEMPORAL_CONFIG, ...config };
  const { vigenciaInicio = null, vigenciaFim = null, firstSeen = null } = input;

  // Data de evento: início se resolvível, senão fim. 'na'/permanente/nulo → sem data
  // concreta para julgar → não é suspeito por si (o FSM/série trata permanência).
  const eventDate = isIso(vigenciaInicio)
    ? vigenciaInicio.slice(0, 10)
    : isIso(vigenciaFim)
      ? vigenciaFim.slice(0, 10)
      : null;

  if (eventDate == null || !isIso(firstSeen)) {
    // Sem data de evento OU sem proveniência → não há base para julgar plausibilidade.
    return { temporalStatus: "valid", includeInPrediction: true, eventDate, daysEventBeforeSource: null };
  }

  const days = Math.round((toMs(firstSeen) - toMs(eventDate)) / DAY_MS);

  if (days > cfg.suspectYearDays) {
    // Evento muito antes da fonte → ano provavelmente fabricado/atrasado. NÃO autocorrige.
    return { temporalStatus: "suspect_year", includeInPrediction: false, eventDate, daysEventBeforeSource: days };
  }
  if (days < -cfg.eventAfterSourceDays) {
    // Evento no futuro em relação à fonte → informativo (campanha anunciada com data futura).
    return { temporalStatus: "event_after_source", includeInPrediction: true, eventDate, daysEventBeforeSource: days };
  }
  return { temporalStatus: "valid", includeInPrediction: true, eventDate, daysEventBeforeSource: days };
}
