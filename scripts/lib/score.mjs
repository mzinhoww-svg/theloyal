// Motor de cálculo do TL Score (Fase 3.1 / backlog P2.9). Hoje o score é DIGITADO
// no admin; este módulo o torna DERIVADO e auditável a partir dos 8 critérios, com
// os pesos oficiais (TL_WEIGHTS). A entrada editorial passa a ser os critérios
// (que ainda exigem julgamento); a nota vira consequência, não input solto.
// PURO e determinístico.
import { TL_WEIGHTS, verdictForScore } from "../lib.mjs";

// computeScore(breakdown) -> { ok, score?, verdict?, raw?, missing? }
// Exige os 8 critérios (0–100). Retorna a soma ponderada arredondada e o veredito
// que ela mapeia (verdictForScore) — a mesma escada semântica oficial.
export function computeScore(breakdown) {
  const keys = Object.keys(TL_WEIGHTS);
  const missing = keys.filter((k) => typeof breakdown?.[k] !== "number" || breakdown[k] < 0 || breakdown[k] > 100);
  if (missing.length) return { ok: false, missing };
  const raw = keys.reduce((acc, k) => acc + (breakdown[k] / 100) * TL_WEIGHTS[k], 0);
  const score = Math.round(raw);
  return { ok: true, score, verdict: verdictForScore(score), raw };
}

// Confere um tlScore DIGITADO contra o cálculo dos critérios. Usado para migrar
// do score digitado para o derivado: enquanto ambos coexistem, o digitado tem de
// bater com o calculado (tolerância de 0, já que é aritmética exata arredondada).
export function reconcileScore(tlScore, breakdown) {
  const c = computeScore(breakdown);
  if (!c.ok) return { ok: false, reason: `breakdown incompleto: ${c.missing.join(", ")}` };
  if (Math.round(tlScore) !== c.score) {
    return { ok: false, reason: `TL Score digitado (${tlScore}) ≠ calculado (${c.score})`, computed: c.score };
  }
  return { ok: true, computed: c.score, verdict: c.verdict };
}
