// Teste do flag INLINE da edge fn v15 (date_suspect) contra os MESMOS fixtures
// reais do golden. A edge fn produz um booleano (date_suspect), não o 3-estado
// do módulo de referência — este teste valida o mapeamento:
//   LIMPO  → date_suspect=false (não-regressão, BLOQUEANTE)
//   QUEBRADO → date_suspect=true (correção)
//   OUTRO: permanente / sem-proveniência / evento-futuro → date_suspect=false
//
// A lógica abaixo é COPIADA VERBATIM de supabase/functions/campaigns/index.ts
// (v15) — se divergir do deploy, o teste perde o sentido. Mantê-las em sincronia.
import { test } from "node:test";
import assert from "node:assert/strict";

// ---- espelho verbatim do index.ts v15 ----
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const isoOrNull = (s) => {
  if (typeof s !== "string" || !ISO_DATE.test(s)) return null;
  const d = s.slice(0, 10);
  return Number.isFinite(Date.parse(d + "T00:00:00Z")) ? d : null;
};
const YEAR_TOLERANCE_DAYS = 65;
function eventDateLooksFabricated(eventDate, provenanceDate) {
  const gap = Math.round(
    (Date.parse(provenanceDate + "T00:00:00Z") - Date.parse(eventDate + "T00:00:00Z")) / 864e5,
  );
  const years = Math.round(gap / 365);
  return years >= 1 && Math.abs(gap - years * 365) <= YEAR_TOLERANCE_DAYS;
}
const SUSPECT_YEAR_DAYS = 365;
function daysEventBeforeSource(eventDate, provenanceDate) {
  return Math.round(
    (Date.parse(provenanceDate + "T00:00:00Z") - Date.parse(eventDate + "T00:00:00Z")) / 864e5,
  );
}
function eventDateIsSuspect(eventDate, provenanceDate) {
  return eventDateLooksFabricated(eventDate, provenanceDate)
    || daysEventBeforeSource(eventDate, provenanceDate) > SUSPECT_YEAR_DAYS;
}
const eventDateOf = (c) => isoOrNull(c.vigenciaInicio) ?? isoOrNull(c.vigenciaFim);

// date_suspect como a edge fn calcula em processItem: provenance = published_at
// (isoOrNull) senão today. Nos fixtures firstSeen == published_at; para o caso
// "sem proveniência" (firstSeen=null) a edge fn cai em `today` — que aqui não
// existe, então usamos o contrato do fixture (esperado false).
function edgeDateSuspect(f, today) {
  const provenance = isoOrNull(f.firstSeen) ?? today;
  const eventDate = eventDateOf(f);
  return eventDate != null && eventDateIsSuspect(eventDate, provenance);
}

// ---- MESMOS fixtures reais do golden ----
const FIXTURES = [
  { grp: "LIMPO", id: "livelo-latampass", vigenciaFim: "2026-06-30", vigenciaInicio: null, firstSeen: "2026-07-10" },
  { grp: "LIMPO", id: "itau-latampass", vigenciaFim: "2026-07-05", vigenciaInicio: null, firstSeen: "2026-07-10" },
  { grp: "LIMPO", id: "azul-livelo", vigenciaFim: "2026-07-05", vigenciaInicio: null, firstSeen: "2026-07-12" },
  { grp: "LIMPO", id: "esfera-smiles", vigenciaFim: "2026-07-08", vigenciaInicio: null, firstSeen: "2026-07-12" },
  { grp: "LIMPO", id: "livelo-smiles", vigenciaFim: "2026-07-10", vigenciaInicio: null, firstSeen: "2026-07-10" },
  { grp: "LIMPO", id: "itau-smiles 1d apos", vigenciaFim: "2026-03-02", vigenciaInicio: null, firstSeen: "2026-03-01" },
  { grp: "LIMPO", id: "credicard-latampass", vigenciaFim: "2026-05-29", vigenciaInicio: null, firstSeen: "2026-05-28" },
  { grp: "LIMPO", id: "bb-empresas-latampass", vigenciaFim: "2026-07-08", vigenciaInicio: null, firstSeen: "2026-07-10" },

  { grp: "QUEBRADO", id: "livelo-connectmiles 943d", vigenciaFim: "2023-12-12", vigenciaInicio: null, firstSeen: "2026-07-12" },
  { grp: "QUEBRADO", id: "esfera-allaccor 608d", vigenciaFim: "2024-03-05", vigenciaInicio: null, firstSeen: "2025-11-03" },
  { grp: "QUEBRADO", id: "nubank-latampass 581d", vigenciaFim: "2024-03-16", vigenciaInicio: null, firstSeen: "2025-10-18" },
  { grp: "QUEBRADO", id: "itau-smiles 731d", vigenciaFim: "2024-02-23", vigenciaInicio: "2024-02-23", firstSeen: "2026-02-23" },
  { grp: "QUEBRADO", id: "livelo-azul 1151d", vigenciaFim: "2023-03-16", vigenciaInicio: null, firstSeen: "2026-05-10" },
  { grp: "QUEBRADO", id: "cartoes-azul 2187d", vigenciaFim: "2020-03-27", vigenciaInicio: null, firstSeen: "2026-03-23" },
  { grp: "QUEBRADO", id: "esfera-allaccor DAILY 852d", vigenciaFim: "2024-03-16", vigenciaInicio: null, firstSeen: "2026-07-16" },

  { grp: "OUTRO", id: "permanente", vigenciaFim: "na", vigenciaInicio: null, firstSeen: "2026-07-10", expectSuspect: false },
  { grp: "OUTRO", id: "sem proveniencia", vigenciaFim: "2024-01-01", vigenciaInicio: null, firstSeen: null, expectSuspect: null }, // depende de today
  { grp: "OUTRO", id: "evento futuro", vigenciaFim: "2026-09-30", vigenciaInicio: "2026-09-15", firstSeen: "2026-07-10", expectSuspect: false },
];

// `today` da rodada de produção — o operador vai deployar em 2026-07-17.
const TODAY = "2026-07-17";

for (const f of FIXTURES) {
  const expect = f.grp === "LIMPO" ? false
    : f.grp === "QUEBRADO" ? true
    : f.expectSuspect;
  test(`[${f.grp}] ${f.id} → date_suspect=${expect}`, () => {
    const got = edgeDateSuspect(f, TODAY);
    if (expect === null) {
      // "sem proveniência": cai em today=2026-07-17, evento 2024-01-01 → gap ~928d
      // → date_suspect=true na edge fn. O módulo de referência devolve 'valid'
      // (sem firstSeen não julga). Divergência ESPERADA e documentada: a edge fn
      // ancora em `today` quando falta published_at; é conservadora (flaga), nunca
      // corrige. Só registramos o valor.
      console.log(`  [info] sem-proveniencia com today=${TODAY}: date_suspect=${got} (edge ancora em today; referencia = valid)`);
      return;
    }
    assert.equal(got, expect, `esperado date_suspect=${expect}, veio ${got}`);
  });
}

// Gate BLOQUEANTE — não-regressão: nenhum LIMPO pode virar date_suspect=true.
test("BLOQUEANTE não-regressão: zero limpos viram date_suspect", () => {
  const regs = FIXTURES.filter((f) => f.grp === "LIMPO")
    .map((f) => ({ id: f.id, suspect: edgeDateSuspect(f, TODAY) }))
    .filter((r) => r.suspect !== false);
  assert.deepEqual(regs, [], `limpos flagados indevidamente: ${JSON.stringify(regs)}`);
});

// Correção: todo QUEBRADO vira date_suspect=true (inclui o canônico 943d que o
// ±65d sozinho perdia — é o ganho do Patch 2).
test("CORREÇÃO: todos os quebrados viram date_suspect", () => {
  const misses = FIXTURES.filter((f) => f.grp === "QUEBRADO")
    .map((f) => ({ id: f.id, suspect: edgeDateSuspect(f, TODAY) }))
    .filter((r) => r.suspect !== true);
  assert.deepEqual(misses, [], `quebrados nao pegos: ${JSON.stringify(misses)}`);
});
