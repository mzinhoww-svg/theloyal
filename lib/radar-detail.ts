// Detalhe da série (Fase P1-B) — helpers PUROS de apresentação/tradução.
//
// NÃO faz I/O e NÃO recalcula nada dos motores/qualidade/divergência: só
// encontra a série no RadarViewModel do P1-A e traduz campos existentes para
// linguagem de produto. Alvo dos testes (tests/radar-detail.test.mjs).

import type { RadarSeries, RadarViewModel, DivergenceLevel } from "./radar-view-model.ts";
import { resolveEventDateCandidate, type CampaignQualityRow, type TemporalStatus, type DuplicateStatus } from "./campaign-quality.ts";
import type { Readiness } from "./predict-engine.ts";
import type { Cadence } from "./forecast.ts";

export type EnginePrincipal = "predict" | "forecast" | "none";

// Encontra a série pela chave canônica (idêntica ao seriesKey do view model).
export function findRadarSeries(vm: RadarViewModel, seriesKey: string): RadarSeries | null {
  return vm.series.find((s) => s.seriesKey === seriesKey) ?? null;
}

// Motor principal segundo as decisões aprovadas (D2): Predict quando pronto;
// senão Forecast (baseline/fallback) se tem janela; senão nenhum.
export function enginePrincipal(s: RadarSeries): EnginePrincipal {
  const p = s.predict;
  const ready = !!p && (p.readiness === "ready" || p.readiness === "ready_with_warnings") && p.probabilities != null;
  if (ready) return "predict";
  if (s.forecast && s.forecast.windowStart) return "forecast";
  return "none";
}

export function engineRoleLabel(p: EnginePrincipal): string {
  switch (p) {
    case "predict": return "Predict (principal)";
    case "forecast": return "Forecast (fallback)";
    case "none": return "Sem previsão utilizável";
  }
}

export function readinessLabel(r: Readiness): string {
  switch (r) {
    case "ready": return "disponível";
    case "ready_with_warnings": return "disponível com ressalvas";
    case "insufficient_history": return "histórico insuficiente";
    case "backfill_incomplete": return "backfill incompleto";
    case "data_quality_blocked": return "bloqueado por qualidade";
    default: return r;
  }
}

export function cadenceLabel(c: Cadence): string {
  switch (c) {
    case "mensal": return "mensal";
    case "irregular": return "irregular";
    case "esparsa": return "esparsa";
    default: return "sem cadência definida";
  }
}

export function temporalStatusLabel(status: TemporalStatus | string): string {
  switch (status) {
    case "valid": return "válida";
    case "suspect_year": return "possível erro de ano";
    case "suspect_month": return "possível erro de mês";
    case "suspect_day_month": return "possível troca dia/mês";
    case "missing_event_date": return "data do evento ausente";
    case "invalid_event_date": return "data inválida";
    case "permanent_or_open_ended": return "campanha sem prazo definido";
    case "event_far_before_source": return "evento muito antes da fonte";
    case "event_after_source": return "evento após a fonte";
    case "conflicting_event_dates": return "datas conflitantes";
    default: return String(status);
  }
}

export function duplicateStatusLabel(s: DuplicateStatus | string): string {
  switch (s) {
    case "probable_duplicate": return "provável duplicidade";
    case "possible_duplicate": return "possível duplicidade";
    case "unique": return "única";
    default: return String(s);
  }
}

// Motivo da exclusão (a `reason` pode ser composta, ex.: "suspect_year+probable_duplicate").
export function exclusionReasonLabel(reason: string): string {
  if (!reason) return "excluída";
  if (reason === "placeholder_program") return "programa inválido ou genérico";
  return reason
    .split("+")
    .map((part) => (part === "probable_duplicate" ? duplicateStatusLabel(part) : temporalStatusLabel(part)))
    .join(" + ");
}

// Ação recomendada (informativa; sem aprovação persistida) — §8 do briefing.
export function recommendedAction(s: RadarSeries): string {
  switch (s.productStatus) {
    case "dataset_incomplete": return "Revisar leitura do ledger";
    case "data_quality_blocked": return "Revisar dados";
    case "duplicate_review": return "Auditar duplicidade";
    case "insufficient_history": return "Histórico insuficiente";
    case "no_prediction": return "Sem previsão utilizável";
    case "review_required": return "Revisar e decidir";
    case "opportunity": return "Previsão disponível";
    case "monitoring": return "Monitorar";
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}/;
function iso(s: string | null | undefined): string | null {
  return typeof s === "string" && ISO.test(s) ? s.slice(0, 10) : null;
}

// Janelas dos dois motores se sobrepõem?
export function windowsOverlap(s: RadarSeries): boolean {
  const fs = iso(s.forecast?.windowStart), fe = iso(s.forecast?.windowEnd);
  const ps = iso(s.predict?.windowStart), pe = iso(s.predict?.windowEnd);
  if (!fs || !fe || !ps || !pe) return false;
  return Date.parse(fs) <= Date.parse(pe) && Date.parse(ps) <= Date.parse(fe);
}

export function divergenceLabel(level: DivergenceLevel): string {
  switch (level) {
    case "none": return "sem comparação";
    case "compatible": return "compatível";
    case "warning": return "atenção";
    case "review": return "revisão necessária";
    case "block": return "bloqueio editorial";
  }
}

// Explicação da divergência em linguagem de produto (reusa divergenceDays/Level
// já calculados no P1-A — nenhum reconciliador novo).
export function divergenceExplain(s: RadarSeries): string {
  if (s.divergenceLevel === "none" || s.divergenceDays == null) {
    return "Não há duas janelas para comparar (um dos motores não tem previsão utilizável).";
  }
  const overlap = windowsOverlap(s);
  const base = `Os centros de janela diferem em ${s.divergenceDays} dia${s.divergenceDays === 1 ? "" : "s"}`;
  const over = overlap ? ", mas as janelas se sobrepõem (severidade atenuada)" : ", sem sobreposição de janelas";
  const verdict =
    s.divergenceLevel === "compatible" ? "os motores concordam." :
    s.divergenceLevel === "warning" ? "requer atenção." :
    s.divergenceLevel === "review" ? "requer revisão editorial." :
    "bloqueia publicação até revisão.";
  return `${base}${over} — ${verdict}`;
}

// Índice da onda (1-based) da campanha na série, casando com forecast.windows
// (±3 dias). Reusa as ondas já colapsadas pelo motor; null se não casar.
export function waveIndexOf(s: RadarSeries, row: CampaignQualityRow): number | null {
  const ev = resolveEventDateCandidate(row);
  const windows = s.forecast?.windows ?? [];
  if (!ev || windows.length === 0) return null;
  const evMs = Date.parse(iso(ev) + "T00:00:00Z");
  for (let i = 0; i < windows.length; i++) {
    const wMs = Date.parse(iso(windows[i]) + "T00:00:00Z");
    if (Math.abs(wMs - evMs) <= 3 * 86_400_000) return i + 1;
  }
  return null;
}

export function eventDateOfRow(row: CampaignQualityRow): string | null {
  return resolveEventDateCandidate(row);
}

// Backtest confiável disponível?
export function backtestAvailable(s: RadarSeries): boolean {
  const b = s.predict?.backtest ?? null;
  return !!b && b.observations > 0;
}

export function bonusAvailable(s: RadarSeries): boolean {
  return s.bonus != null;
}

// Explicação de produto (nível 1) — deriva do motor principal (sem IA externa).
export function productExplanation(s: RadarSeries): string {
  const principal = enginePrincipal(s);
  if (principal === "predict") {
    const compat = s.divergenceLevel === "compatible" || s.divergenceLevel === "none";
    return `A previsão principal vem do Predict porque o modelo tem histórico suficiente e está disponível.${
      s.forecast ? (compat ? " O Forecast aponta uma janela compatível." : " O Forecast diverge — ver comparação.") : ""
    }`;
  }
  if (principal === "forecast") {
    return "O Predict está indisponível (histórico/prontidão insuficiente); a janela vem do Forecast como fallback (cadência aproximada).";
  }
  return "Nenhum motor tem previsão utilizável para esta série — ver bloqueios e qualidade.";
}
