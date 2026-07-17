// Golden do guard de plausibilidade temporal (Fase 1a). Fixtures = linhas REAIS do
// banco vivo (qjqnqcsdnpvvmyzkavoq, 2026-07-17), não sintéticas.
//   node --test v2/lib/temporal-plausibility.test.mjs
//
// Dois lados medidos:
//   • NÃO-REGRESSÃO (bloqueante): casos limpos (evento ≈ proveniência) → 'valid'.
//   • CORREÇÃO: casos com erro de ano (evento << proveniência) → 'suspect_year'.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateTemporalPlausibility } from "./temporal-plausibility.mjs";

// grp = LIMPO (não pode virar suspect) | QUEBRADO (deve virar suspect) | OUTRO
const FIXTURES = [
  // ---- LIMPOS (não-regressão) — daily yr_off=0, evento ~ proveniência ----
  { grp: "LIMPO", id: "livelo-latampass-2026-06-30", vigenciaFim: "2026-06-30", vigenciaInicio: null, firstSeen: "2026-07-10", expect: "valid" },
  { grp: "LIMPO", id: "itau-latampass-2026-07-05", vigenciaFim: "2026-07-05", vigenciaInicio: null, firstSeen: "2026-07-10", expect: "valid" },
  { grp: "LIMPO", id: "azul-livelo-2026-07-05", vigenciaFim: "2026-07-05", vigenciaInicio: null, firstSeen: "2026-07-12", expect: "valid" },
  { grp: "LIMPO", id: "esfera-smiles-2026-07-08", vigenciaFim: "2026-07-08", vigenciaInicio: null, firstSeen: "2026-07-12", expect: "valid" },
  { grp: "LIMPO", id: "livelo-smiles-2026-07-10", vigenciaFim: "2026-07-10", vigenciaInicio: null, firstSeen: "2026-07-10", expect: "valid" },
  { grp: "LIMPO", id: "itau-smiles-2026-03-02", vigenciaFim: "2026-03-02", vigenciaInicio: null, firstSeen: "2026-03-01", expect: "valid" }, // fim 1d após fonte
  { grp: "LIMPO", id: "credicard-latampass-2026-05-29", vigenciaFim: "2026-05-29", vigenciaInicio: null, firstSeen: "2026-05-28", expect: "valid" },
  { grp: "LIMPO", id: "bb-empresas-latampass-2026-07-08", vigenciaFim: "2026-07-08", vigenciaInicio: null, firstSeen: "2026-07-10", expect: "valid" },

  // ---- QUEBRADOS (correção) — evento muito antes da proveniência ----
  { grp: "QUEBRADO", id: "livelo-connectmiles-2023-12-12 (canônico 943d)", vigenciaFim: "2023-12-12", vigenciaInicio: null, firstSeen: "2026-07-12", expect: "suspect_year" },
  { grp: "QUEBRADO", id: "esfera-allaccor-2024-03-05 (+1yr, 608d)", vigenciaFim: "2024-03-05", vigenciaInicio: null, firstSeen: "2025-11-03", expect: "suspect_year" },
  { grp: "QUEBRADO", id: "nubank-latampass-2024-03-16 (+1yr, 581d)", vigenciaFim: "2024-03-16", vigenciaInicio: null, firstSeen: "2025-10-18", expect: "suspect_year" },
  { grp: "QUEBRADO", id: "itau-smiles-2024-02-23 (+2yr via inicio, 731d)", vigenciaFim: "2024-02-23", vigenciaInicio: "2024-02-23", firstSeen: "2026-02-23", expect: "suspect_year" },
  { grp: "QUEBRADO", id: "livelo-azul-2023-03-16 (+3yr, 1151d)", vigenciaFim: "2023-03-16", vigenciaInicio: null, firstSeen: "2026-05-10", expect: "suspect_year" },
  { grp: "QUEBRADO", id: "cartoes-azul-2020-03-27 (+6yr, 2187d)", vigenciaFim: "2020-03-27", vigenciaInicio: null, firstSeen: "2026-03-23", expect: "suspect_year" },
  { grp: "QUEBRADO", id: "esfera-allaccor-2024-03-16 (DAILY sujo, 852d)", vigenciaFim: "2024-03-16", vigenciaInicio: null, firstSeen: "2026-07-16", expect: "suspect_year" },

  // ---- OUTROS (contratos de borda) ----
  { grp: "OUTRO", id: "permanente (vigencia_fim=na)", vigenciaFim: "na", vigenciaInicio: null, firstSeen: "2026-07-10", expect: "valid" },
  { grp: "OUTRO", id: "sem proveniência (first_seen null)", vigenciaFim: "2024-01-01", vigenciaInicio: null, firstSeen: null, expect: "valid" },
  { grp: "OUTRO", id: "evento futuro (anunciado, inicio > fonte)", vigenciaFim: "2026-09-30", vigenciaInicio: "2026-09-15", firstSeen: "2026-07-10", expect: "event_after_source" },
];

for (const f of FIXTURES) {
  test(`[${f.grp}] ${f.id} → ${f.expect}`, () => {
    const r = evaluateTemporalPlausibility(f);
    assert.equal(r.temporalStatus, f.expect, `esperado ${f.expect}, veio ${r.temporalStatus} (days=${r.daysEventBeforeSource})`);
    // Contrato-chave: suspect_year NUNCA autocorrige (eventDate preservado, não vira firstSeen).
    if (f.expect === "suspect_year") {
      assert.equal(r.includeInPrediction, false, "suspect_year deve sair da série (include=false)");
      assert.equal(r.eventDate, (f.vigenciaInicio ?? f.vigenciaFim).slice(0, 10), "eventDate NÃO pode ser reescrito para first_seen (INV-16)");
    }
  });
}

// Gate de não-regressão explícito: nenhum LIMPO pode virar suspect.
test("NÃO-REGRESSÃO: zero limpos viram suspect", () => {
  const regressions = FIXTURES.filter((f) => f.grp === "LIMPO")
    .map((f) => ({ id: f.id, status: evaluateTemporalPlausibility(f).temporalStatus }))
    .filter((r) => r.status !== "valid");
  assert.deepEqual(regressions, [], `limpos regredidos: ${JSON.stringify(regressions)}`);
});

// Cobertura de correção: todo QUEBRADO vira suspect_year.
test("CORREÇÃO: todos os quebrados viram suspect_year", () => {
  const misses = FIXTURES.filter((f) => f.grp === "QUEBRADO")
    .map((f) => ({ id: f.id, status: evaluateTemporalPlausibility(f).temporalStatus }))
    .filter((r) => r.status !== "suspect_year");
  assert.deepEqual(misses, [], `quebrados não pegos: ${JSON.stringify(misses)}`);
});
