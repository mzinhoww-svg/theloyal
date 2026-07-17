// Fase 2.1 — consolidação Weekly ← Daily: rastreável (sourceEditions) e não sobe
// a régua (herda a disposição mais restritiva).
import { test } from "node:test";
import assert from "node:assert/strict";
import { consolidateWeekly, consolidatedHighlights } from "../scripts/lib/weekly-consolidate.mjs";

const ENTITIES = [{ name: "Livelo", aliases: ["Livelo"], sourceTier: "T1", domains: ["livelo.com.br"] }];

function uniform(v) {
  return { valor: v, regra: v, vigencia: v, friccao: v, aplicabilidade: v, liquidez: v, estoque: v, fontes: v };
}
function deal(over = {}) {
  const score = over.tlScore ?? 90;
  const d = {
    category: "Transferência",
    title: over.title ?? "Deal X",
    context: "ctx",
    conta: { rows: [["c", "R$ 20"]], result: ["CPM", "R$ 20"] },
    verdict: over.verdict ?? "vale-agir",
    source: over.source ?? "Regulamento oficial",
    sourceUrl: over.sourceUrl ?? "https://livelo.com.br/x",
    tlScore: score,
    vigencia: over.vigencia ?? "2030-01-01T00:00:00-03:00",
  };
  if (over.scoreBreakdown !== null) d.scoreBreakdown = over.scoreBreakdown ?? uniform(score);
  return d;
}
function edition(number, date, deals) {
  return { number, date, deals };
}

const weekly = { dateStart: "2026-07-13", dateEnd: "2026-07-19" };

test("só edições dentro do período entram", () => {
  const eds = [
    edition(30, "2026-07-14", [deal({ title: "A" })]),
    edition(31, "2026-07-25", [deal({ title: "B" })]), // fora do período
  ];
  const r = consolidateWeekly(weekly, eds, { entities: ENTITIES });
  assert.deepEqual(r.sourceEditions, [30]);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].title, "A");
});

test("cada item referencia as edições de origem", () => {
  const eds = [
    edition(30, "2026-07-14", [deal({ title: "Mesma oferta" })]),
    edition(31, "2026-07-16", [deal({ title: "Mesma oferta" })]),
  ];
  const r = consolidateWeekly(weekly, eds, { entities: ENTITIES });
  assert.equal(r.items.length, 1);
  assert.deepEqual(r.items[0].sourceEditions, [30, 31]);
});

test("herda a disposição MAIS restritiva (não sobe a régua)", () => {
  const eds = [
    // dia 1: vale-agir com breakdown + T1 → faixa C
    edition(30, "2026-07-14", [deal({ title: "Oferta", verdict: "vale-agir", tlScore: 90 })]),
    // dia 2: mesma oferta, agora sem breakdown → faixa D (rebaixa p/ monitoramento)
    edition(31, "2026-07-16", [deal({ title: "Oferta", verdict: "vale-agir", tlScore: 90, scoreBreakdown: null })]),
  ];
  const r = consolidateWeekly(weekly, eds, { entities: ENTITIES });
  assert.equal(r.items[0].faixa, "D"); // D é mais restritiva que C
  assert.equal(r.items[0].verdict, "nao-confirmado"); // rebaixado, não vira ação
});

test("item de fonte fraca com ação não vira verdicto de ação no weekly", () => {
  const eds = [
    edition(30, "2026-07-14", [deal({ title: "Rumor", verdict: "vale-agir", tlScore: 90, source: "post social sem página oficial" })]),
  ];
  const r = consolidateWeekly(weekly, eds, { entities: ENTITIES });
  assert.equal(r.items[0].verdict, "nao-confirmado");
  assert.notEqual(r.items[0].verdict, "vale-agir");
});

test("consolidatedHighlights produz formato do schema com sourceEditions", () => {
  const eds = [edition(30, "2026-07-14", [deal({ title: "Oferta", verdict: "vale-agir", tlScore: 90 })])];
  const hs = consolidatedHighlights(weekly, eds, { entities: ENTITIES });
  assert.equal(hs.length, 1);
  assert.equal(hs[0].title, "Oferta");
  assert.deepEqual(hs[0].sourceEditions, [30]);
  assert.ok(/edições 30/.test(hs[0].note));
});
