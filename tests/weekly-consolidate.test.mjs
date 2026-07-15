// Fase 1 — motor de consolidação Weekly ← Daily. Testa reconciliação de Fios,
// estado semanal, derivação de movements/highlights/ranking/watch, dedup de
// entrada e determinismo. Puro: alimenta editions sintéticas.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fioKey, parseBRL, buildFios, weeklyState, consolidate, isoWeekLabel,
} from "../scripts/weekly-consolidate.mjs";

const REG = { entities: [
  { key: "livelo", name: "Livelo" }, { key: "smiles", name: "Smiles" },
  { key: "esfera", name: "Esfera" }, { key: "latam-pass", name: "LATAM Pass" },
] };

function deal(over = {}) {
  return {
    category: "Transferência bonificada · Livelo → Smiles",
    title: "t", context: "c",
    conta: { rows: [["a", "b"]], result: ["CPM final", "R$ 12,00 /milheiro"] },
    verdict: "vale-olhar", tlScore: 76,
    vigencia: "2026-07-31T23:59:00-03:00",
    source: "Regulamento oficial", sourceUrl: "https://www.smiles.com.br",
    entityKey: "smiles", routeKey: "livelo->smiles", firstSeen: "2026-07-06",
    ...over,
  };
}
function edition(number, date, deals, over = {}) {
  return { number, date, weekday: "X", publishTime: "8H00", readingMinutes: 5,
    signal: "s", deals, sources: [{ label: "Smiles", url: "https://www.smiles.com.br" }],
    disclaimer: "d", ...over };
}

test("fioKey: precedência rota > entidade > categoria", () => {
  assert.equal(fioKey({ routeKey: "livelo->smiles", entityKey: "smiles" }), "livelo->smiles");
  assert.equal(fioKey({ entityKey: "livelo" }), "livelo");
  assert.equal(fioKey({ category: "Compra de pontos · Livelo" }), "cat:compra-de-pontos-livelo");
});

test("parseBRL: extrai número de resultado de conta", () => {
  assert.equal(parseBRL("R$ 12,00 /milheiro"), 12);
  assert.equal(parseBRL("CPM R$ 1.394,50"), 1394.5);
  assert.equal(parseBRL("aguardando confirmação"), null);
});

test("buildFios: dois deals da mesma rota em dias diferentes → 1 Fio", () => {
  const eds = [
    edition(1, "2026-07-06", [deal({ tlScore: 70, verdict: "vale-olhar" })]),
    edition(2, "2026-07-08", [deal({ tlScore: 80, verdict: "vale-olhar" })]),
  ];
  const fios = buildFios(eds);
  assert.equal(fios.length, 1);
  assert.equal(fios[0].appearances, 2);
  assert.equal(fios[0].tlScore, 80); // latest
  assert.equal(fios[0].tlScoreJump, 10);
  assert.equal(fios[0].lineage.length, 2);
});

test("weeklyState: NOVO quando não existia antes da semana", () => {
  const fio = { key: "k", firstSeen: "2026-07-08", latestDeal: { vigencia: "2026-07-31T00:00:00-03:00" }, verdictStart: "vale-olhar", verdictEnd: "vale-olhar" };
  assert.equal(weeklyState(fio, { windowStart: "2026-07-06", windowEnd: "2026-07-12" }), "NOVO");
});

test("weeklyState: SEGUE quando firstSeen antes da semana", () => {
  const fio = { key: "k", firstSeen: "2026-06-30", latestDeal: { vigencia: "2026-07-31T00:00:00-03:00" }, verdictStart: "vale-olhar", verdictEnd: "vale-olhar" };
  assert.equal(weeklyState(fio, { windowStart: "2026-07-06", windowEnd: "2026-07-12" }), "SEGUE");
});

test("weeklyState: ENCERROU quando vigência vence dentro da semana", () => {
  const fio = { key: "k", firstSeen: "2026-07-07", latestDeal: { vigencia: "2026-07-09T23:59:00-03:00" }, verdictStart: "vale-olhar", verdictEnd: "vale-olhar" };
  assert.equal(weeklyState(fio, { windowStart: "2026-07-06", windowEnd: "2026-07-12" }), "ENCERROU");
});

test("weeklyState: VIROU quando veredito cai para evitaria sem vencer", () => {
  const fio = { key: "k", firstSeen: "2026-06-30", latestDeal: { vigencia: "2026-08-31T00:00:00-03:00" }, verdictStart: "vale-agir", verdictEnd: "evitaria" };
  assert.equal(weeklyState(fio, { windowStart: "2026-07-06", windowEnd: "2026-07-12" }), "VIROU");
});

test("weeklyState: REABRIU quando existia antes mas não na semana passada", () => {
  const fio = { key: "k", firstSeen: "2026-06-01", latestDeal: { vigencia: "2026-07-31T00:00:00-03:00" }, verdictStart: "vale-olhar", verdictEnd: "vale-olhar" };
  const priorKeys = new Set(["outra"]);
  assert.equal(weeklyState(fio, { windowStart: "2026-07-06", windowEnd: "2026-07-12", priorKeys }), "REABRIU");
});

test("consolidate: nao-confirmado fica fora de movements e entra no watch", () => {
  const eds = [edition(1, "2026-07-08", [
    deal({ entityKey: "livelo", routeKey: undefined, verdict: "nao-confirmado", tlScore: undefined, vigencia: undefined,
      category: "Compra de pontos · Livelo", conta: { rows: [["x", "y"]], result: ["CPM", "aguardando"] } }),
  ])];
  const d = consolidate({ editions: eds, windowStart: "2026-07-06", windowEnd: "2026-07-12", number: 1, entityReg: REG });
  assert.equal(d.movements.novas.length + d.movements.seguem.length + d.movements.venceram.length, 0);
  assert.ok(d.watch.some((w) => /não confirmado/.test(w)));
  assert.equal(d.ranking.length, 0);
});

test("consolidate: ranking só com Fios vivos, confirmados e com âncora numérica", () => {
  const eds = [edition(1, "2026-07-08", [
    deal({ routeKey: "livelo->smiles", entityKey: "smiles", tlScore: 88, verdict: "vale-agir",
      vigencia: "2026-07-31T23:59:00-03:00", conta: { rows: [["x", "y"]], result: ["CPM", "R$ 12,00"] } }),
    deal({ routeKey: "esfera->latam-pass", entityKey: "latam-pass", tlScore: 72, verdict: "vale-olhar",
      vigencia: "2026-07-31T23:59:00-03:00", category: "Transferência · Esfera → Latam Pass",
      conta: { rows: [["x", "y"]], result: ["CPM", "R$ 18,00"] } }),
  ])];
  const d = consolidate({ editions: eds, windowStart: "2026-07-06", windowEnd: "2026-07-12", number: 1, entityReg: REG });
  assert.equal(d.ranking.length, 2);
  assert.equal(d.ranking[0].fio, "livelo->smiles"); // tlScore 88 > 72
  assert.equal(d.ranking[0].rank, 1);
  assert.equal(d.ranking[1].rank, 2);
  assert.ok(d.ranking.every((r) => r.lineage && typeof r.lineage.edition === "number"));
});

test("consolidate: deal vencido não ranqueia (entra em venceram)", () => {
  const eds = [edition(1, "2026-07-07", [
    deal({ vigencia: "2026-07-09T23:59:00-03:00", firstSeen: "2026-07-07" }),
  ])];
  const d = consolidate({ editions: eds, windowStart: "2026-07-06", windowEnd: "2026-07-12", number: 1, entityReg: REG });
  assert.equal(d.ranking.length, 0);
  assert.equal(d.movements.venceram.length, 1);
});

test("consolidate: highlights carregam verdict+score+lineage e marcam transição", () => {
  const eds = [
    edition(1, "2026-07-07", [deal({ verdict: "vale-agir", tlScore: 88, firstSeen: "2026-07-07", vigencia: "2026-08-31T00:00:00-03:00" })]),
    edition(2, "2026-07-09", [deal({ verdict: "evitaria", tlScore: 30, firstSeen: "2026-07-07", vigencia: "2026-08-31T00:00:00-03:00" })]),
  ];
  const d = consolidate({ editions: eds, windowStart: "2026-07-06", windowEnd: "2026-07-12", number: 1, entityReg: REG });
  const h = d.highlights.find((x) => x.transition);
  assert.ok(h, "deve haver um highlight com transição");
  assert.deepEqual(h.transition, { from: "vale-agir", to: "evitaria" });
  assert.equal(h.verdict, "evitaria");
  assert.ok(h.lineage && typeof h.lineage.edition === "number");
});

test("consolidate: determinístico — mesma entrada, mesma saída", () => {
  const eds = [edition(1, "2026-07-08", [deal(), deal({ routeKey: "esfera->latam-pass", entityKey: "latam-pass" })])];
  const a = consolidate({ editions: eds, windowStart: "2026-07-06", windowEnd: "2026-07-12", number: 1, entityReg: REG });
  const b = consolidate({ editions: eds, windowStart: "2026-07-06", windowEnd: "2026-07-12", number: 1, entityReg: REG });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("consolidate: watch inclui vigência que cai na próxima semana", () => {
  const eds = [edition(1, "2026-07-10", [
    deal({ vigencia: "2026-07-15T23:59:00-03:00", firstSeen: "2026-06-30" }), // vence semana seguinte
  ])];
  const d = consolidate({ editions: eds, windowStart: "2026-07-06", windowEnd: "2026-07-12", number: 1, entityReg: REG });
  assert.ok(d.watch.some((w) => /encerra em 2026-07-15/.test(w)));
});

test("isoWeekLabel: semana ISO correta", () => {
  assert.equal(isoWeekLabel("2026-07-12"), "2026-W28"); // domingo da W28
  assert.equal(isoWeekLabel("2026-07-13"), "2026-W29"); // segunda da W29
});

test("weeklySignals: exporta transição verdictStart→verdictEnd por Fio", async () => {
  const { weeklySignals } = await import("../scripts/weekly-consolidate.mjs");
  const eds = [
    edition(1, "2026-07-07", [deal({ verdict: "vale-agir", tlScore: 88, firstSeen: "2026-07-07", vigencia: "2026-08-31T00:00:00-03:00" })]),
    edition(2, "2026-07-09", [deal({ verdict: "evitaria", tlScore: 30, firstSeen: "2026-07-07", vigencia: "2026-08-31T00:00:00-03:00" })]),
  ];
  const s = weeklySignals({ editions: eds, windowStart: "2026-07-06", windowEnd: "2026-07-12" });
  assert.equal(s.isoWeek, "2026-W28");
  assert.deepEqual(s.generatedFrom, [1, 2]);
  const sig = s.signals.find((x) => x.fio === "livelo->smiles");
  assert.ok(sig);
  assert.equal(sig.verdictStart, "vale-agir");
  assert.equal(sig.verdictEnd, "evitaria");
  assert.equal(sig.transitioned, true);
  assert.equal(sig.tlScoreStart, 88);
  assert.equal(sig.tlScoreEnd, 30);
  assert.ok(Array.isArray(sig.lineage) && sig.lineage.length === 2);
});

// --- Passo 3: estado de Fio entre semanas (priorFioKeys do final curado) ---

test("priorFioKeys: deriva dos blocos do final curado (sem _meta)", async () => {
  const { priorFioKeys } = await import("../scripts/weekly-consolidate.mjs");
  const finalWk = {
    movements: { novas: [], seguem: [{ text: "x", fio: "livelo->smiles" }], venceram: [] },
    ranking: [{ rank: 1, fio: "esfera->latam-pass" }],
    highlights: [{ fio: "amex->lifemiles", title: "t", note: "n" }],
  };
  const keys = priorFioKeys(finalWk);
  assert.ok(keys.has("livelo->smiles") && keys.has("esfera->latam-pass") && keys.has("amex->lifemiles"));
});

test("priorFioKeys: prefere _meta.fios quando presente (rascunho)", async () => {
  const { priorFioKeys } = await import("../scripts/weekly-consolidate.mjs");
  const draft = { _meta: { fios: [{ key: "a" }, { key: "b" }] }, movements: { novas: [{ fio: "c" }] } };
  const keys = priorFioKeys(draft);
  assert.ok(keys.has("a") && keys.has("b") && !keys.has("c"));
});

test("consolidate: REABRIU usando o final anterior (continuidade sobrevive à curadoria)", () => {
  // Fio existia antes da janela (firstSeen antigo) e NÃO está no final anterior → REABRIU.
  const eds = [edition(1, "2026-07-08", [deal({ firstSeen: "2026-05-01", vigencia: "2026-08-31T00:00:00-03:00" })])];
  const prevFinal = { movements: { novas: [], seguem: [], venceram: [] }, ranking: [{ rank: 1, fio: "outra-rota" }], highlights: [] };
  const d = consolidate({ editions: eds, windowStart: "2026-07-06", windowEnd: "2026-07-12", number: 1, prevWeekly: prevFinal, entityReg: REG });
  assert.equal(d._meta.fios.find((f) => f.key === "livelo->smiles").state, "REABRIU");
});

// --- Passo 4: sanity-check de data ---

test("implausibleDate: pega erro de ano; ignora datas plausíveis", async () => {
  const { implausibleDate } = await import("../scripts/weekly-consolidate.mjs");
  const win = { windowStart: "2026-07-06", windowEnd: "2026-07-12" };
  assert.match(implausibleDate("2023-12-12", win), /anterior à janela/);
  assert.match(implausibleDate("2029-01-01", win), /após a janela/);
  assert.equal(implausibleDate("2026-07-31", win), null);
  assert.equal(implausibleDate("aguardando", win), null); // não-data não acusa
});

test("consolidate: data implausível vira aviso em _meta.warnings, não bloqueia", () => {
  const eds = [edition(1, "2026-07-08", [deal({ firstSeen: "2023-01-01", vigencia: "2026-08-31T00:00:00-03:00" })])];
  const d = consolidate({ editions: eds, windowStart: "2026-07-06", windowEnd: "2026-07-12", number: 1, entityReg: REG });
  assert.ok(Array.isArray(d._meta.warnings) && d._meta.warnings.some((w) => /firstSeen/.test(w)));
});
