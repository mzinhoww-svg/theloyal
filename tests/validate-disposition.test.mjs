// Fase 0.3 — incoerência sempre bloqueia no gate canônico (validate.mjs), e a
// fonte única de regras invioláveis (assertEditorialRules) reprova dado interno.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEdition } from "../scripts/validate.mjs";
import { assertEditorialRules, DISCLAIMER } from "../scripts/lib.mjs";

function uniform(v) {
  return { valor: v, regra: v, vigencia: v, friccao: v, aplicabilidade: v, liquidez: v, estoque: v, fontes: v };
}
function edition(dealOver = {}) {
  const score = dealOver.tlScore ?? 90;
  const d = {
    category: "Transferência bonificada",
    title: dealOver.title ?? "Teste",
    context: "contexto",
    conta: { rows: [["custo", "R$ 20"]], result: ["CPM", "R$ 20,00"] },
    verdict: dealOver.verdict ?? "vale-agir",
    source: "Livelo (oficial, vigente)",
    sourceUrl: "https://livelo.com.br/promo",
    vigencia: "2030-01-01T00:00:00-03:00",
    tlScore: score,
  };
  if (dealOver.scoreBreakdown !== null) d.scoreBreakdown = dealOver.scoreBreakdown ?? uniform(score);
  return {
    number: 1, date: "2026-07-15", weekday: "TERÇA-FEIRA", publishTime: "8H00",
    readingMinutes: 5, signal: "o sinal do dia",
    deals: [d],
    sources: [{ label: "Livelo", url: "https://livelo.com.br/promo" }],
    disclaimer: DISCLAIMER,
  };
}

test("edição coerente não gera erro de score", () => {
  const r = validateEdition(edition());
  assert.equal(r.errors.filter((m) => /mapeia para|soma ponderada/.test(m)).length, 0);
});

test("score↔verdict incoerente SEMPRE bloqueia", () => {
  const r = validateEdition(edition({ verdict: "esperaria", tlScore: 90 }));
  assert.ok(r.errors.some((m) => /mapeia para/.test(m)), "esperava erro de coerência score↔verdict");
});

test("breakdown que não reconcilia SEMPRE bloqueia", () => {
  const bad = uniform(90);
  bad.valor = 10;
  const r = validateEdition(edition({ verdict: "vale-agir", tlScore: 90, scoreBreakdown: bad }));
  assert.ok(r.errors.some((m) => /soma ponderada/.test(m)), "esperava erro de reconciliação do breakdown");
});

test("dado interno reprova via fonte única (antes passava só no Pro)", () => {
  const r = validateEdition(edition({ title: "análise com margem de contribuição interna do programa" }));
  assert.ok(r.errors.some((m) => /interno|CMI/i.test(m)), "esperava bloqueio por dado interno");
});

test("assertEditorialRules pega os termos que só existiam no Pro (nossa base / nossos clientes)", () => {
  assert.ok(assertEditorialRules({ x: "vantagem para nossa base de clientes" }).some((v) => v.rule === "interno"));
  assert.ok(assertEditorialRules({ x: "oferta para nossos clientes" }).some((v) => v.rule === "interno"));
});
