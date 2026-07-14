#!/usr/bin/env node
// Gera o artefato de previsão de janelas a partir do ledger (Supabase).
//   node scripts/forecast.mjs [--now YYYY-MM-DD] [--out content/forecast.json]
//
// Sem credenciais/rede, opera em modo offline: preserva o forecast.json atual
// (se existir) ou escreve um artefato vazio — nunca quebra o pipeline.
//
// O motor é scripts/predictions.mjs (espelho de lib/predictions.ts).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildForecast, radarItems, upcomingWindows } from "./predictions.mjs";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://qjqnqcsdnpvvmyzkavoq.supabase.co").replace(/\/+$/, "");
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "sb_publishable_P8p6JOjLfCVwr6QqgLxjqw_NbqMHKV-";

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

  const fc = buildForecast(rows, { now: NOW });

  // Fatias prontas para os digests.
  const daily = upcomingWindows(fc, { now: NOW, horizonDays: 10, minConfidence: "media" });
  const weekly = upcomingWindows(fc, { now: NOW, horizonDays: 21, minConfidence: "baixa" });

  const artifact = {
    generatedAt: new Date().toISOString(),
    generatedFor: fc.generatedFor,
    source: "supabase",
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
      `${fc.withPrediction} com previsão · daily ${daily.length} · weekly ${weekly.length}. Artefato: ${OUT}`,
  );
}

main().catch((err) => {
  console.error("[forecast] erro:", err);
  process.exit(1);
});
