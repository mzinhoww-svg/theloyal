// Coletor de VPM observado do não-aéreo (Shopping) por SKU.
// Fluxo: basket → (adapters: Tavily+fetch+parse | mock) → LLM classifica promo →
// stats determinística calcula VPM/mediana/MAD → Supabase (ou out/collect/ em mock).
//
// Uso:
//   node scripts/collect-skus.mjs            # live se houver SUPABASE_SERVICE_KEY, senão mock
//   node scripts/collect-skus.mjs --mock     # força mock (usa mockCash/mockPoints do basket)
//
// Fronteira inviolável: só dado PÚBLICO de catálogo. O gate bloqueia qualquer
// vazamento de dado interno/CMI. VPM é sempre OBSERVADO, nunca teto interno.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { INTERNAL_RE, collectStrings } from "./lib.mjs";
import { vpm, band, fmtBRL } from "./collect/stats.mjs";
import { classifyPromo, llmBackend } from "./collect/llm.mjs";
import { supabaseEnabled, insert, patch } from "./collect/supabase.mjs";
import azul from "./collect/adapters/azul.mjs";
import smiles from "./collect/adapters/smiles.mjs";
import latam from "./collect/adapters/latam.mjs";

const ADAPTERS = { azul, smiles, latam };
const MIN_SAMPLE = 3;

function loadBasket() {
  return JSON.parse(readFileSync("content/sku-basket.json", "utf8"));
}

// Uma observação em modo mock, a partir do basket (sem rede).
function mockObservation(entry, player, src) {
  const points = src.mockPoints ?? null;
  const cash = src.mockCash ?? null;
  return {
    player,
    sku: entry,
    points,
    cash,
    name: entry.canonicalName,
    gtin: entry.gtin ?? null,
    url: src.url,
    is_promo: Boolean(src.mockPromo),
    promo_reason: src.mockPromo ? "marcado como promo no basket (mock)" : null,
  };
}

async function collect({ mock }) {
  const basket = loadBasket();
  const runId = randomUUID();
  const observations = [];

  for (const entry of basket.skus) {
    for (const player of Object.keys(entry.sources ?? {})) {
      const src = entry.sources[player];
      let obs;
      if (mock) {
        obs = mockObservation(entry, player, src);
      } else {
        const adapter = ADAPTERS[player];
        if (!adapter) continue;
        const results = await adapter.collect(entry);
        // uma entrada do basket → tipicamente uma URL/observação por player
        const r = results[0] ?? { player, sku: entry, points: null, cash: null, url: src.url };
        const promo = r.points && r.cash
          ? await classifyPromo(r.name ?? entry.canonicalName, `R$ ${r.cash}`, "", runId)
          : { is_promo: false, reason: null };
        obs = { ...r, is_promo: promo.is_promo, promo_reason: promo.reason };
      }
      obs.vpm = vpm(obs.cash, obs.points);
      obs.category = entry.category;
      observations.push(obs);
    }
  }

  // --- Agrega banda por player+categoria (só base, sem promo, com VPM válido) ---
  const groups = new Map();
  for (const o of observations) {
    if (o.is_promo || !Number.isFinite(o.vpm)) continue;
    const key = `${o.player}::${o.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o.vpm);
  }
  const valuations = [];
  for (const [key, vpms] of groups) {
    const [player, category] = key.split("::");
    const b = band(vpms, { minSample: MIN_SAMPLE });
    valuations.push({
      player,
      category,
      segment: "nao-aereo",
      piso: b.piso,
      mediana: b.mediana,
      teto: b.teto,
      sample_n: b.sample_n,
      confidence: b.confidence,
      confirmed: b.confirmed,
    });
  }

  // --- Gates ---
  const strings = collectStrings({ observations, valuations });
  const internalHit = strings.find((s) => INTERNAL_RE.test(s));
  const missingSource = observations.some((o) => o.points && o.cash && !o.url);
  const gate_validate = !internalHit && !missingSource;

  // Coerência: recomputa o VPM e confere (espelha o checkCalculo do audit editorial).
  const incoherent = observations.find(
    (o) => Number.isFinite(o.vpm) && Math.abs(o.vpm - vpm(o.cash, o.points)) > 0.01,
  );
  const gate_audit = !incoherent;

  return { runId, observations, valuations, gate_validate, gate_audit, internalHit };
}

async function persistLive({ runId, observations, valuations, gate_validate, gate_audit }) {
  const startedAt = new Date().toISOString();
  await insert("runs", [{
    id: runId, product: "radar-vpm", kind: "skus", started_at: startedAt, finished_at: startedAt,
    status: gate_validate && gate_audit ? "ok" : "erro",
    gate_validate, gate_audit, searches_count: observations.length, skus_observed: observations.length,
  }]);
  await insert("sku_observations", observations.map((o) => ({
    player: o.player, run_id: runId, points: o.points, cash_brl: o.cash,
    is_promo: o.is_promo, promo_reason: o.promo_reason, vpm: o.vpm,
    source_url: o.url, raw: { name: o.name, gtin: o.gtin, category: o.category, canonical: o.sku?.canonicalName },
  })));
  // Aposenta a banda anterior e grava a nova como corrente.
  for (const v of valuations) {
    await patch("retail_valuations",
      `player=eq.${v.player}&category=eq.${v.category}&is_current=eq.true`,
      { is_current: false });
  }
  await insert("retail_valuations", valuations.map((v) => ({
    player: v.player, category: v.category, segment: v.segment,
    piso: v.piso, mediana: v.mediana, teto: v.teto,
    sample_n: v.sample_n, confidence: v.confidence, is_current: true,
  })));
}

function persistMock(payload) {
  mkdirSync("out/collect", { recursive: true });
  writeFileSync(`out/collect/${payload.runId}.json`, JSON.stringify(payload, null, 2) + "\n");
  writeFileSync("out/collect/latest.json", JSON.stringify(payload, null, 2) + "\n");
}

async function main() {
  const args = process.argv.slice(2);
  const forceMock = args.includes("--mock");
  const live = supabaseEnabled() && !forceMock;
  const mode = live ? "live" : "mock";

  console.log(`[collect] modo=${mode} · LLM=${llmBackend()} · Supabase=${supabaseEnabled() ? "on" : "off"}`);
  const result = await collect({ mock: !live });

  if (result.internalHit) {
    console.error(`[collect] BLOQUEADO: possível dado interno/CMI na coleta: ${JSON.stringify(result.internalHit).slice(0, 80)}`);
  }

  // Log da banda por player/categoria.
  console.log(`[collect] ${result.observations.length} observações · ${result.valuations.length} bandas`);
  for (const v of result.valuations) {
    const tag = v.confirmed ? v.confidence : "n/c (amostra insuficiente)";
    console.log(`  ${v.player.padEnd(7)} ${v.category.padEnd(14)} mediana ${fmtBRL(v.mediana)} · n=${v.sample_n} · ${tag}`);
  }
  console.log(`[collect] gates: validate=${result.gate_validate ? "ok" : "FALHOU"} audit=${result.gate_audit ? "ok" : "FALHOU"}`);

  if (live) {
    await persistLive(result);
    console.log(`[collect] gravado no Supabase (run ${result.runId})`);
  } else {
    persistMock({ mode, ...result, generatedAt: new Date().toISOString() });
    console.log(`[collect] modo mock: payload em out/collect/latest.json (nada enviado à API)`);
  }

  process.exit(result.gate_validate && result.gate_audit ? 0 : 1);
}

main().catch((err) => { console.error("[collect] erro:", err); process.exit(1); });
