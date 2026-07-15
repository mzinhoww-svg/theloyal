// Fase 3.2 — motor de acurácia (read-only): agrega o log de publicação, exceções
// e vigência sem tocar no caminho de publicação.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAccuracy } from "../scripts/accuracy.mjs";

const ledger = {
  posts: {
    "daily-0028": {
      status: "published",
      dispositions: [
        { index: 0, faixa: "C", downgradeTo: null, tier: "T1" },
        { index: 1, faixa: "A", downgradeTo: null, tier: "T3" },
      ],
    },
    "daily-0027": {
      status: "draft", // não despachado — não conta
      dispositions: [{ index: 0, faixa: "D", downgradeTo: "monitoramento", tier: "T1" }],
    },
  },
};
const exceptions = { entries: [{ rule: "limite-de-deals" }, { rule: "limite-de-deals" }, { rule: "confianca-radar" }] };
const editions = [
  { number: 28, date: "2026-07-08", deals: [
    { verdict: "vale-agir", vigencia: "2026-07-10T23:59:00-03:00" }, // vencida em now
    { verdict: "nao-confirmado" },
  ] },
];

test("agrega dispositions só de posts despachados", () => {
  const r = computeAccuracy({ ledger, exceptions, editions, now: "2026-07-15" });
  assert.equal(r.dispositions.byFaixa.C, 1);
  assert.equal(r.dispositions.byFaixa.A, 1);
  assert.equal(r.dispositions.byFaixa.D, 0); // o D estava num draft, não conta
  assert.equal(r.dispositions.itemsWithDisposition, 2);
});

test("conta exceções por regra", () => {
  const r = computeAccuracy({ ledger, exceptions, editions, now: "2026-07-15" });
  assert.equal(r.exceptions.total, 3);
  assert.equal(r.exceptions.byRule["limite-de-deals"], 2);
});

test("vigência: deals de ação vencidos são contados", () => {
  const r = computeAccuracy({ ledger, exceptions, editions, now: "2026-07-15" });
  assert.equal(r.vigencia.actionDeals, 1); // só o vale-agir; nao-confirmado não é ação
  assert.equal(r.vigencia.actionExpired, 1);
});

test("faixa E despachada é sinalizada (publishedBlocked)", () => {
  const bad = { posts: { x: { status: "published", dispositions: [{ faixa: "E" }] } } };
  const r = computeAccuracy({ ledger: bad, exceptions: {}, editions: [], now: "2026-07-15" });
  assert.equal(r.dispositions.publishedBlocked, 1);
});
