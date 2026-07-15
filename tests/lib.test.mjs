// Testes das regras editoriais puras do pipeline canônico (scripts/lib.mjs):
// mapa TL Score→Verdict, integridade da taxonomia, pesos do TL Score, vigência,
// links e os regexes de gate (emoji, urgência, dado interno). Zero dependência.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VERDICTS, TL_WEIGHTS, verdictForScore, isExpired, isValidLink,
  EMOJI_RE, URGENCY_RE, INTERNAL_RE, collectStrings, editionSlug, pad,
} from "../scripts/lib.mjs";

test("verdictForScore: fronteiras de cada faixa (DESIGN 1.3)", () => {
  assert.equal(verdictForScore(100), "vale-agir");
  assert.equal(verdictForScore(85), "vale-agir");
  assert.equal(verdictForScore(84), "vale-olhar");
  assert.equal(verdictForScore(70), "vale-olhar");
  assert.equal(verdictForScore(69), "casos-especificos");
  assert.equal(verdictForScore(55), "casos-especificos");
  assert.equal(verdictForScore(54), "esperaria");
  assert.equal(verdictForScore(40), "esperaria");
  assert.equal(verdictForScore(39), "evitaria");
  assert.equal(verdictForScore(0), "evitaria");
});

test("verdictForScore: fora de 0–100 não mapeia (nunca chuta)", () => {
  assert.equal(verdictForScore(101), null);
  assert.equal(verdictForScore(-1), null);
});

test("taxonomia: exatamente os 6 vereditos canônicos", () => {
  assert.deepEqual(Object.keys(VERDICTS).sort(), [
    "casos-especificos", "esperaria", "evitaria",
    "nao-confirmado", "vale-agir", "vale-olhar",
  ]);
});

test("taxonomia: faixas contíguas cobrem 0–100 sem lacuna nem sobreposição", () => {
  const scored = Object.values(VERDICTS)
    .filter((v) => v.min != null)
    .sort((a, b) => a.min - b.min);
  assert.equal(scored[0].min, 0);
  assert.equal(scored[scored.length - 1].max, 100);
  for (let i = 1; i < scored.length; i++) {
    assert.equal(scored[i].min, scored[i - 1].max + 1,
      `lacuna/sobreposição entre ${scored[i - 1].label} e ${scored[i].label}`);
  }
});

test("taxonomia: nao-confirmado não tem faixa numérica", () => {
  assert.equal(VERDICTS["nao-confirmado"].min, null);
  assert.equal(VERDICTS["nao-confirmado"].max, null);
});

test("TL Score: os 8 pesos somam 100 (Operating Manual 5.2)", () => {
  const keys = Object.keys(TL_WEIGHTS);
  assert.equal(keys.length, 8);
  assert.equal(Object.values(TL_WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

test("isExpired: vencida só quando vigência < referência (estrito)", () => {
  assert.equal(isExpired("2026-01-01", "2026-06-01"), true);
  assert.equal(isExpired("2026-06-01", "2026-01-01"), false);
  assert.equal(isExpired("2026-06-01", "2026-06-01"), false); // igual não vence
  assert.equal(isExpired("data-ruim", "2026-06-01"), false); // inválida não bloqueia aqui
});

test("isValidLink: só https absoluto passa", () => {
  assert.equal(isValidLink("https://latampass.latam.com"), true);
  assert.equal(isValidLink("http://x.com"), false);
  assert.equal(isValidLink("/caminho/relativo"), false);
  assert.equal(isValidLink("ftp://x"), false);
  assert.equal(isValidLink(null), false);
});

test("EMOJI_RE: pega emoji, ignora tipografia válida (setas, travessão, reticências)", () => {
  assert.ok(EMOJI_RE.test("bônus 🚀 agora"));
  assert.ok(!EMOJI_RE.test("Livelo → Smiles"));
  assert.ok(!EMOJI_RE.test("texto — travessão … reticências"));
});

test("URGENCY_RE: pega urgência artificial, ignora prazo factual", () => {
  assert.ok(URGENCY_RE.test("oferta imperdível"));
  assert.ok(URGENCY_RE.test("corra para garantir"));
  assert.ok(URGENCY_RE.test("é a última chance"));
  assert.ok(URGENCY_RE.test("garanta já"));
  assert.ok(!URGENCY_RE.test("a promoção vence quinta-feira"));
});

test("INTERNAL_RE: pega dado interno/CMI, ignora dado público", () => {
  assert.ok(INTERNAL_RE.test("segundo o CMI do programa"));
  assert.ok(INTERNAL_RE.test("dados internos indicam"));
  assert.ok(!INTERNAL_RE.test("segundo o regulamento oficial"));
});

test("collectStrings: coleta recursiva de todas as strings", () => {
  const got = collectStrings({ a: "x", b: ["y", { c: "z" }], n: 3 });
  assert.deepEqual(got.sort(), ["x", "y", "z"]);
});

test("pad/editionSlug: número da edição em 4 dígitos", () => {
  assert.equal(pad(28), "0028");
  assert.equal(pad(1), "0001");
  assert.equal(editionSlug({ number: 28 }), "0028");
});
