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
      sbGet("forecast_overrides?select=scope,route,action,confidence,note", SERVICE_KEY),
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

// Leitura COMPLETA e paginada do ledger (ordem explicita id.asc), sem o limite
// silencioso de 2000 nem a ordem padrao do banco. Fase C0. complete=false so se
// o teto de seguranca de paginas for atingido; falha de rede lanca -> modo
// offline (mantem o artefato anterior).
async function fetchCampaigns() {
  const pageSize = 1000;
  const maxPages = 50;
  const rows = [];
  let pages = 0;
  for (let offset = 0; ; offset += pageSize) {
    if (pages >= maxPages) return { rows, complete: false };
    const url = `${SUPABASE_URL}/rest/v1/campaigns?select=*&order=id.asc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) throw new Error(`Supabase ${res.status} ${res.statusText}`);
    const chunk = await res.json();
    if (!Array.isArray(chunk)) throw new Error("Resposta inesperada do Supabase");
    pages++;
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return { rows, complete: true };
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
  let rows, datasetComplete;
  try {
    ({ rows, complete: datasetComplete } = await fetchCampaigns());
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
    // Override com nota libera elegibilidade editorial de série bloqueada por
    // amostra/intervalo/horizonte (nunca por dataset incompleto). Fase C0.
    if (!f.editorialEligible && (o?.action === "pin" || o?.action === "confidence") && o?.note && String(o.note).trim()) {
      f.editorialEligible = true;
      f.editorialOverridden = true;
    }
  }
  const mutedKeys = new Set(overrides.filter((o) => o.action === "mute").map((o) => `${o.scope}:${o.route}`));
  const notMuted = (f) => !mutedKeys.has(keyOf(f));

  // Fatias prontas para os digests (horizontes vêm da config). Dataset
  // incompleto NÃO gera números editoriais — radares saem vazios com motivo.
  const daily = datasetComplete
    ? upcomingWindows(fc, { now: NOW, horizonDays: config.horizonDaily, minConfidence: "media" }).filter(notMuted)
    : [];
  const weekly = datasetComplete
    ? upcomingWindows(fc, { now: NOW, horizonDays: config.horizonWeekly, minConfidence: "baixa" }).filter(notMuted)
    : [];

  // Frescor: maior observed_at do ledger (sem novo schema) para o consumidor
  // aferir a idade do dado, além do generatedAt.
  const dataMaxObservedAt = rows.reduce((mx, r) => {
    const v = typeof r.observed_at === "string" ? r.observed_at.slice(0, 10) : null;
    return v && (!mx || v > mx) ? v : mx;
  }, null);

  const artifact = {
    generatedAt: new Date().toISOString(),
    generatedFor: fc.generatedFor,
    source: "supabase",
    modelVersion: "forecast_recurrence_v1",
    configSource,
    config,
    overridesApplied: overrides.length,
    ledgerRows: rows.length,
    datasetComplete,
    dataMaxObservedAt,
    radarBlocked: datasetComplete ? null : "leitura do ledger incompleta — radar não gerado",
    routesTracked: fc.routesTracked,
    clustersTracked: fc.clustersTracked,
    withPrediction: fc.withPrediction,
    clusters: fc.clusters,
    routes: fc.routes,
    digest: {
      daily,
      weekly,
      radarDaily: datasetComplete ? radarItems(daily) : [],
      radarWeekly: datasetComplete ? radarItems(weekly) : [],
    },
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(artifact, null, 2) + "\n");

  // Diagnóstico estruturado (Fase C0 §18) — sem segredos.
  const all = [...fc.routes, ...fc.clusters];
  const semData = rows.filter((r) => (r.tipo ?? "").toLowerCase() === "transferencia").length -
    all.filter((f) => f.scope === "route").reduce((a, f) => a + f.samples, 0); // aproximação diagnóstica
  const diag = {
    campaignsLoaded: rows.length,
    datasetComplete,
    seriesTotal: all.length,
    seriesEligible: all.filter((f) => f.editorialEligible).length,
    blockedSample: all.filter((f) => /historico_insuficiente|em_formacao/.test(f.editorialBlockReason ?? "")).length,
    blockedInterval: all.filter((f) => /intervalo_extremo/.test(f.editorialBlockReason ?? "")).length,
    blockedHorizon: all.filter((f) => /horizonte_excedido/.test(f.editorialBlockReason ?? "")).length,
    dataMaxObservedAt,
  };
  console.log(`[forecast] diag ${JSON.stringify(diag)}`);
  console.log(
    `[forecast] OK — ${rows.length} linhas · ${fc.routesTracked} rotas · ${fc.clustersTracked} programas · ` +
      `${fc.withPrediction} com previsão · daily ${daily.length} · weekly ${weekly.length} · ` +
      `dataset ${datasetComplete ? "completo" : "INCOMPLETO"} · config=${configSource} · overrides=${overrides.length}. Artefato: ${OUT}`,
  );
}

main().catch((err) => {
  console.error("[forecast] erro:", err);
  process.exit(1);
});
