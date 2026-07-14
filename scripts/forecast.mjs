#!/usr/bin/env node
// Gera o artefato de previsão de janelas a partir do ledger (Supabase).
//   node scripts/forecast.mjs [--now YYYY-MM-DD] [--out content/forecast.json]
//
// Sem credenciais/rede, opera em modo offline: preserva o forecast.json atual
// (se existir) ou escreve um artefato vazio — nunca quebra o pipeline.
//
// O motor é scripts/forecast-engine.mjs (espelho de lib/forecast.ts).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildForecast, radarItems, resolveConfig, upcomingWindows } from "./forecast-engine.mjs";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://qjqnqcsdnpvvmyzkavoq.supabase.co").replace(/\/+$/, "");
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "sb_publishable_P8p6JOjLfCVwr6QqgLxjqw_NbqMHKV-";
// forecast_config e forecast_overrides têm RLS: só a service key lê. Sem ela,
// o CLI cai nos defaults do motor (mesma calibração de sempre).
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || null;

async function sbGet(path, key) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} ${res.statusText}`);
  return res.json();
}

// Busca a config do admin (forecast_config) e os overrides. Falha silenciosa →
// defaults + sem overrides, para o CLI nunca quebrar sem a service key.
async function fetchAdminConfig() {
  if (!SERVICE_KEY) return { configPartial: null, overrides: [], source: "default" };
  try {
    const [cfgRows, overrides] = await Promise.all([
      sbGet("forecast_config?id=eq.1&limit=1", SERVICE_KEY),
      sbGet("forecast_overrides?select=scope,route,action,confidence", SERVICE_KEY),
    ]);
    const r = Array.isArray(cfgRows) ? cfgRows[0] : null;
    const configPartial = r
      ? {
          waveEpsilonDays: Number(r.wave_epsilon_days),
          minSamples: Number(r.min_samples),
          samplesAlta: Number(r.samples_alta),
          samplesMedia: Number(r.samples_media),
          cvAlta: Number(r.cv_alta),
          cvMedia: Number(r.cv_media),
          horizonDaily: Number(r.horizon_daily),
          horizonWeekly: Number(r.horizon_weekly),
        }
      : null;
    return { configPartial, overrides: Array.isArray(overrides) ? overrides : [], source: r ? "supabase" : "default" };
  } catch (err) {
    console.error(`[forecast] config do admin indisponível (${err instanceof Error ? err.message : err}); usando defaults.`);
    return { configPartial: null, overrides: [], source: "default" };
  }
}

const args = process.argv.slice(2);
function flag(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const NOW = flag("now", new Date().toISOString().slice(0, 10));
const OUT = flag("out", "content/forecast.json");

async function fetchCampaigns() {
  const url = `${SUPABASE_URL}/rest/v1/campaigns?select=*&order=observed_at.desc&limit=2000`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} ${res.statusText}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error("Resposta inesperada do Supabase");
  return rows;
}

function writeOffline(reason) {
  console.error(`[forecast] modo offline: ${reason}`);
  if (existsSync(OUT)) {
    console.error(`[forecast] mantendo ${OUT} existente (não sobrescrito).`);
    return;
  }
  const empty = {
    generatedAt: null,
    generatedFor: NOW,
    source: "offline",
    routesTracked: 0,
    clustersTracked: 0,
    withPrediction: 0,
    clusters: [],
    routes: [],
    digest: { daily: [], weekly: [] },
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(empty, null, 2) + "\n");
  console.error(`[forecast] artefato vazio escrito em ${OUT}.`);
}

async function main() {
  let rows;
  try {
    rows = await fetchCampaigns();
  } catch (err) {
    writeOffline(err instanceof Error ? err.message : String(err));
    return;
  }

  // Config e overrides do admin (mesma calibração do /admin/forecast).
  const { configPartial, overrides, source: configSource } = await fetchAdminConfig();
  const config = resolveConfig(configPartial);

  const fc = buildForecast(rows, { now: NOW, config });

  // Aplica overrides do operador: confiança sobrescrita e silenciamento (mute
  // retira dos radares dos digests), como no admin.
  const keyOf = (f) => `${f.scope}:${f.route}`;
  const ovMap = new Map(overrides.map((o) => [`${o.scope}:${o.route}`, o]));
  for (const f of [...fc.routes, ...fc.clusters]) {
    const o = ovMap.get(keyOf(f));
    if (o?.action === "confidence" && o.confidence) f.confidence = o.confidence;
  }
  const mutedKeys = new Set(overrides.filter((o) => o.action === "mute").map((o) => `${o.scope}:${o.route}`));
  const notMuted = (f) => !mutedKeys.has(keyOf(f));

  // Fatias prontas para os digests (horizontes vêm da config).
  const daily = upcomingWindows(fc, { now: NOW, horizonDays: config.horizonDaily, minConfidence: "media" }).filter(notMuted);
  const weekly = upcomingWindows(fc, { now: NOW, horizonDays: config.horizonWeekly, minConfidence: "baixa" }).filter(notMuted);

  const artifact = {
    generatedAt: new Date().toISOString(),
    generatedFor: fc.generatedFor,
    source: "supabase",
    configSource,
    config,
    overridesApplied: overrides.length,
    ledgerRows: rows.length,
    routesTracked: fc.routesTracked,
    clustersTracked: fc.clustersTracked,
    withPrediction: fc.withPrediction,
    clusters: fc.clusters,
    routes: fc.routes,
    digest: {
      daily,
      weekly,
      radarDaily: radarItems(daily),
      radarWeekly: radarItems(weekly),
    },
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(artifact, null, 2) + "\n");
  console.log(
    `[forecast] OK — ${rows.length} linhas · ${fc.routesTracked} rotas · ${fc.clustersTracked} programas · ` +
      `${fc.withPrediction} com previsão · daily ${daily.length} · weekly ${weekly.length} · ` +
      `config=${configSource} · overrides=${overrides.length}. Artefato: ${OUT}`,
  );
}

main().catch((err) => {
  console.error("[forecast] erro:", err);
  process.exit(1);
});
