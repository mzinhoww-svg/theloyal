// Testes do motor de disposição (régua de publicação). Cobre a matriz §9/§10
// (intensidade × tier), integridade que bloqueia, e a resolução de tier.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDisposition, resolveTier, gateEdition, intensityForVerdict } from "../scripts/lib/disposition.mjs";

const NOW = "2026-07-15";
const FUTURE = "2030-01-01T00:00:00-03:00";
const PAST = "2020-01-01T00:00:00-03:00";

function uniform(v) {
  return { valor: v, regra: v, vigencia: v, friccao: v, aplicabilidade: v, liquidez: v, estoque: v, fontes: v };
}
function deal(over = {}) {
  const score = over.tlScore ?? 90;
  const d = {
    category: "Transferência bonificada",
    title: over.title ?? "Teste",
    context: "ctx",
    verdict: over.verdict ?? "vale-agir",
    source: over.source ?? "Livelo (oficial)",
    sourceUrl: over.sourceUrl ?? "https://livelo.com.br/promo",
    tlScore: score,
    conta: { rows: [["custo", "R$ 20"]], result: ["CPM", "R$ 20,00"] },
  };
  if (over.vigencia !== null) d.vigencia = over.vigencia ?? FUTURE;
  if (over.scoreBreakdown !== null) d.scoreBreakdown = over.scoreBreakdown ?? uniform(score);
  if (over.source !== undefined) d.source = over.source;
  return d;
}

// ---- intensidade por verdicto ----
test("intensidade: vale-agir é ação alta; evitaria é não-ação", () => {
  assert.equal(intensityForVerdict("vale-agir"), "acao-alta");
  assert.equal(intensityForVerdict("vale-olhar"), "acao-media");
  assert.equal(intensityForVerdict("casos-especificos"), "acao-baixa");
  assert.equal(intensityForVerdict("evitaria"), "nao-acao");
  assert.equal(intensityForVerdict("nao-confirmado"), "nao-acao");
});

// ---- matriz: célula por célula (tier explícito) ----
test("não-ação (evitaria) + T1 → A auto", () => {
  const d = computeDisposition(deal({ verdict: "evitaria", tlScore: 30 }), { now: NOW, tier: "T1" });
  assert.equal(d.faixa, "A");
  assert.equal(d.action, "auto");
});

test("casos-especificos (ação baixa) + T2 → B revisão leve", () => {
  const d = computeDisposition(deal({ verdict: "casos-especificos", tlScore: 60 }), { now: NOW, tier: "T2" });
  assert.equal(d.faixa, "B");
  assert.equal(d.action, "review-light");
});

test("vale-olhar (ação média) + T1, breakdown completo → C assinatura", () => {
  const d = computeDisposition(deal({ verdict: "vale-olhar", tlScore: 75 }), { now: NOW, tier: "T1" });
  assert.equal(d.faixa, "C");
  assert.equal(d.action, "review-sign");
});

test("vale-agir (ação alta) + T1, breakdown completo → C assinatura", () => {
  const d = computeDisposition(deal({ verdict: "vale-agir", tlScore: 90 }), { now: NOW, tier: "T1" });
  assert.equal(d.faixa, "C");
});

test("vale-agir + T3 (fonte fraca) → D monitoramento", () => {
  const d = computeDisposition(deal({ verdict: "vale-agir", tlScore: 90 }), { now: NOW, tier: "T3" });
  assert.equal(d.faixa, "D");
  assert.equal(d.downgradeTo, "monitoramento");
});

test("qualquer verdicto + T0 (fonte desconhecida) → D não-confirmado", () => {
  const d = computeDisposition(deal({ verdict: "vale-agir", tlScore: 90 }), { now: NOW, tier: "T0" });
  assert.equal(d.faixa, "D");
  assert.equal(d.downgradeTo, "nao-confirmado");
});

test("não-ação + T3 → A (rebaixado, sem pedido de ação)", () => {
  const d = computeDisposition(deal({ verdict: "evitaria", tlScore: 30 }), { now: NOW, tier: "T3" });
  assert.equal(d.faixa, "A");
});

// ---- integridade → E (bloqueio) ----
test("score↔verdict incoerente → E bloqueia", () => {
  const d = computeDisposition(deal({ verdict: "esperaria", tlScore: 90, scoreBreakdown: uniform(90) }), { now: NOW, tier: "T1" });
  assert.equal(d.faixa, "E");
  assert.ok(d.integrity.some((m) => /mapeia para/.test(m)));
});

test("vigência vencida → E bloqueia", () => {
  const d = computeDisposition(deal({ verdict: "vale-agir", tlScore: 90, vigencia: PAST }), { now: NOW, tier: "T1" });
  assert.equal(d.faixa, "E");
  assert.ok(d.integrity.some((m) => /vencida/.test(m)));
});

test("sem vigência + verdicto de ação → E (overrule 5.4)", () => {
  const d = computeDisposition(deal({ verdict: "vale-agir", tlScore: 90, vigencia: null }), { now: NOW, tier: "T1" });
  assert.equal(d.faixa, "E");
  assert.ok(d.integrity.some((m) => /vigência/.test(m)));
});

test("breakdown não reconcilia → E bloqueia", () => {
  const bad = uniform(90);
  bad.valor = 10; // quebra a soma ponderada
  const d = computeDisposition(deal({ verdict: "vale-agir", tlScore: 90, scoreBreakdown: bad }), { now: NOW, tier: "T1" });
  assert.equal(d.faixa, "E");
  assert.ok(d.integrity.some((m) => /soma ponderada/.test(m)));
});

test("regra inviolável (dado interno) no item → E bloqueia", () => {
  const d = computeDisposition(deal({ verdict: "vale-agir", tlScore: 90, title: "vazou o CMI do programa" }), { now: NOW, tier: "T1" });
  assert.equal(d.faixa, "E");
  assert.ok(d.ruleHits.includes("interno"));
});

// ---- scoreBreakdown obrigatório para ação (Fase 1.1) ----
test("vale-agir coerente mas SEM breakdown → D monitoramento", () => {
  const d = computeDisposition(deal({ verdict: "vale-agir", tlScore: 90, scoreBreakdown: null }), { now: NOW, tier: "T1" });
  assert.equal(d.faixa, "D");
  assert.equal(d.downgradeTo, "monitoramento");
});

test("nao-confirmado sem vigência é permitido (não-ação) → não bloqueia", () => {
  const d = computeDisposition(
    { verdict: "nao-confirmado", title: "sem dado", source: "Fonte", sourceUrl: "https://x.com/y" },
    { now: NOW, tier: "T2" },
  );
  assert.notEqual(d.faixa, "E");
  assert.equal(d.intensidade, "nao-acao");
});

// ---- sinal conteúdo forte / fonte fraca ----
test("fontes baixo + score alto emite sinal 'conteúdo forte, fonte fraca'", () => {
  const bd = uniform(93);
  bd.fontes = 40;
  // soma ponderada: 0.93*95 + 0.40*5 = 88.35 + 2 = 90.35 → 90
  const d = computeDisposition(deal({ verdict: "vale-agir", tlScore: 90, scoreBreakdown: bd }), { now: NOW, tier: "T1" });
  assert.equal(d.faixa, "C");
  assert.ok(d.reasons.some((r) => /conteúdo forte, fonte fraca/.test(r)));
});

// ---- resolveTier ----
test("resolveTier: sem registro de entidades → null (sem teto)", () => {
  assert.equal(resolveTier("Livelo", "https://livelo.com.br/x", undefined), null);
});

test("resolveTier: casa domínio → tier da entidade", () => {
  const entities = [{ name: "Livelo", aliases: ["Livelo"], sourceTier: "T1", domains: ["livelo.com.br"] }];
  assert.equal(resolveTier("Livelo (oficial)", "https://www.livelo.com.br/promo", entities), "T1");
});

test("resolveTier: host desconhecido (registro presente, sem marcador) → T0", () => {
  const entities = [{ name: "Livelo", sourceTier: "T1", domains: ["livelo.com.br"] }];
  assert.equal(resolveTier("Site desconhecido", "https://algum-site-qualquer.com/t/123", entities), "T0");
});

test("resolveTier: marcador fraco vence a URL de home oficial", () => {
  const entities = [{ name: "Livelo", sourceTier: "T1", domains: ["livelo.com.br"] }];
  // sourceUrl aponta para a home oficial, mas a fonte é um post social sem regulamento
  assert.equal(resolveTier("Post social público, sem página oficial (nível 4)", "https://www.livelo.com.br", entities), "T3");
});

test("resolveTier: marcador forte sem registro → T1", () => {
  assert.equal(resolveTier("Regulamento oficial · vigência confirmada", "https://x.com/promo", undefined), "T1");
});

test("resolveTier: casa por menção textual quando não há URL", () => {
  const entities = [{ name: "Smiles", aliases: ["Smiles"], sourceTier: "T2", domains: ["smiles.com.br"] }];
  assert.equal(resolveTier("Comunicado Smiles", undefined, entities), "T2");
});

// ---- gateEdition ----
test("gateEdition: edição com item em E não libera", () => {
  const ed = {
    date: NOW,
    deals: [
      deal({ verdict: "evitaria", tlScore: 30 }),
      deal({ verdict: "vale-agir", tlScore: 90, vigencia: PAST }), // vencida → E
    ],
  };
  const r = gateEdition(ed, { tier: "T1" });
  assert.equal(r.release, false);
  assert.equal(r.blocks.length, 1);
});

test("gateEdition: edição limpa libera", () => {
  const ed = { date: NOW, deals: [deal({ verdict: "evitaria", tlScore: 30 })] };
  const r = gateEdition(ed, { tier: "T1" });
  assert.equal(r.release, true);
});
