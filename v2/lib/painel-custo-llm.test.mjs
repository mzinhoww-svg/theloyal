// Golden do painel de custo LLM (M2.5). node --test v2/lib/painel-custo-llm.test.mjs
// INV-03/INV-12: preço/tokens ausentes ⇒ custo null, NUNCA 0 coagido.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  custoUsd,
  percentileCont,
  agregarPorDiaEstagio,
  registryMap,
  consumoDoDia,
} from "./painel-custo-llm.mjs";

const PRECO = { preco_input_por_1k_usd: 0.002, preco_output_por_1k_usd: 0.006 };
const SEM_PRECO = { preco_input_por_1k_usd: null, preco_output_por_1k_usd: null };

// ── custoUsd: a conta e os casos de null ──
test("custoUsd: tokens × preço (1000 in, 1000 out)", () => {
  assert.equal(custoUsd({ tokens_in: 1000, tokens_out: 1000 }, PRECO), 0.002 + 0.006);
});

test("custoUsd: preço ausente ⇒ null, NUNCA 0", () => {
  const c = custoUsd({ tokens_in: 5000, tokens_out: 2000 }, SEM_PRECO);
  assert.equal(c, null);
  assert.notEqual(c, 0);
});

test("custoUsd: sem linha de registry ⇒ null", () => {
  assert.equal(custoUsd({ tokens_in: 100, tokens_out: 50 }, undefined), null);
});

test("custoUsd: token faltando ⇒ null (não fabrica parcial, não coage 0)", () => {
  assert.equal(custoUsd({ tokens_in: 1000, tokens_out: null }, PRECO), null);
  assert.equal(custoUsd({ tokens_in: null, tokens_out: 1000 }, PRECO), null);
  assert.equal(custoUsd({ tokens_in: undefined, tokens_out: undefined }, PRECO), null);
});

test("custoUsd: zero token real é 0, não null (0 observado ≠ dado ausente)", () => {
  assert.equal(custoUsd({ tokens_in: 0, tokens_out: 0 }, PRECO), 0);
});

// ── percentileCont: interpolação estilo Postgres ──
test("percentileCont: p50 e p95", () => {
  assert.equal(percentileCont([10, 20, 30, 40], 0.5), 25);
  assert.equal(percentileCont([100], 0.95), 100);
  assert.equal(percentileCont([], 0.5), null);
});

// ── agregarPorDiaEstagio ──
const REG = registryMap([
  { estagio: "extracao_campanhas", preco_input_por_1k_usd: 0.002, preco_output_por_1k_usd: 0.006 },
  { estagio: "radar_vpm_match", preco_input_por_1k_usd: null, preco_output_por_1k_usd: null },
]);

const JOBS = [
  { estagio: "extracao_campanhas", tokens_in: 1000, tokens_out: 1000, latencia_ms: 100, status: "ok", criado_em: "2026-07-17T10:00:00Z" },
  { estagio: "extracao_campanhas", tokens_in: 2000, tokens_out: 500, latencia_ms: 300, status: "ok", criado_em: "2026-07-17T11:00:00Z" },
  { estagio: "extracao_campanhas", tokens_in: 500, tokens_out: 100, latencia_ms: 200, status: "erro", criado_em: "2026-07-17T12:00:00Z" },
  { estagio: "radar_vpm_match", tokens_in: 800, tokens_out: 200, latencia_ms: 50, status: "ok", criado_em: "2026-07-17T09:00:00Z" },
  { estagio: "extracao_campanhas", tokens_in: 100, tokens_out: 100, latencia_ms: 90, status: "fallback", criado_em: "2026-07-16T09:00:00Z" },
];

test("agrega chamadas/tokens/status por dia×estágio", () => {
  const ag = agregarPorDiaEstagio(JOBS, REG);
  const ext17 = ag.find((l) => l.dia === "2026-07-17" && l.estagio === "extracao_campanhas");
  assert.equal(ext17.chamadas, 3);
  assert.equal(ext17.tokens_in_total, 3500);
  assert.equal(ext17.tokens_out_total, 1600);
  assert.equal(ext17.erros, 1);
  assert.equal(ext17.custo_confirmado, true);
  // custo = (3500/1000*0.002) + (1600/1000*0.006) = 0.007 + 0.0096
  assert.ok(Math.abs(ext17.custo_usd_total - (0.007 + 0.0096)) < 1e-9);
});

test("estágio sem preço ⇒ custo_usd_total null, custo_confirmado false", () => {
  const ag = agregarPorDiaEstagio(JOBS, REG);
  const radar = ag.find((l) => l.estagio === "radar_vpm_match");
  assert.equal(radar.custo_usd_total, null);
  assert.equal(radar.custo_confirmado, false);
  assert.equal(radar.tokens_in_total, 800); // tokens ainda somam (observados)
});

test("ordena dia desc, estágio asc", () => {
  const ag = agregarPorDiaEstagio(JOBS, REG);
  assert.equal(ag[0].dia, "2026-07-17");
  assert.equal(ag.at(-1).dia, "2026-07-16");
});

test("aceita registry como array (não só Map)", () => {
  const ag = agregarPorDiaEstagio(JOBS, [
    { estagio: "extracao_campanhas", preco_input_por_1k_usd: 0.002, preco_output_por_1k_usd: 0.006 },
  ]);
  const ext17 = ag.find((l) => l.dia === "2026-07-17" && l.estagio === "extracao_campanhas");
  assert.ok(ext17.custo_usd_total > 0);
});

// ── consumoDoDia: visibilidade contra o teto (spec §3) ──
test("consumoDoDia: custo do dia e resta contra o teto", () => {
  const ag = agregarPorDiaEstagio(JOBS, REG);
  const c = consumoDoDia(ag, "2026-07-17", 1.0);
  assert.ok(c.custo_usd > 0);            // só o estágio com preço entra
  assert.equal(c.resta_usd, 1.0 - c.custo_usd);
  assert.equal(c.chamadas, 4);            // 3 extracao + 1 radar
});

test("consumoDoDia: dia sem nenhum preço ⇒ custo null (não afirma R$0 gasto)", () => {
  const soRadar = agregarPorDiaEstagio(
    [{ estagio: "radar_vpm_match", tokens_in: 10, tokens_out: 10, status: "ok", criado_em: "2026-07-18T00:00:00Z" }],
    REG,
  );
  const c = consumoDoDia(soRadar, "2026-07-18", 1.0);
  assert.equal(c.custo_usd, null);
  assert.equal(c.resta_usd, null);
});
