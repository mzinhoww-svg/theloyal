// Gera o VPM observado por player a partir da banda mais recente (Supabase
// retail_valuations, ou out/collect/latest.json em mock) e injeta no relatório Pro.
// A edição segue revisada por humano: por padrão só IMPRIME o snippet; com
// --write <arquivo.json> grava o vpmObservado nas linhas da matriz que casam por player.
//
// Uso:
//   node scripts/pro-vpm.mjs                         # imprime resumo por player
//   node scripts/pro-vpm.mjs --write content/pro/2026-07.json
import { readFileSync, writeFileSync } from "node:fs";
import { median, fmtBRL } from "./collect/stats.mjs";

const PLAYER_LABEL = { azul: "Azul", smiles: "Smiles", latam: "LATAM Pass", livelo: "Livelo", esfera: "Esfera" };

async function loadValuations() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
  if (url && key) {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/retail_valuations?is_current=eq.true&select=*`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
    });
    if (res.ok) return { source: "supabase", rows: await res.json() };
  }
  try {
    const payload = JSON.parse(readFileSync("out/collect/latest.json", "utf8"));
    return { source: "mock (out/collect/latest.json)", rows: payload.valuations ?? [] };
  } catch {
    return { source: "vazio", rows: [] };
  }
}

// VPM por player = mediana das medianas das categorias com amostra confirmada.
function perPlayer(rows) {
  const byPlayer = new Map();
  for (const r of rows) {
    const confirmed = r.confirmed ?? (Number(r.sample_n) >= 3);
    if (!confirmed || !Number.isFinite(Number(r.mediana))) continue;
    if (!byPlayer.has(r.player)) byPlayer.set(r.player, []);
    byPlayer.get(r.player).push(Number(r.mediana));
  }
  const out = [];
  for (const [player, medians] of byPlayer) {
    out.push({ player, label: PLAYER_LABEL[player] ?? player, vpm: median(medians), sample: medians.length });
  }
  return out.sort((a, b) => (a.vpm ?? 0) - (b.vpm ?? 0));
}

async function main() {
  const args = process.argv.slice(2);
  const writeIdx = args.indexOf("--write");
  const target = writeIdx >= 0 ? args[writeIdx + 1] : null;

  const { source, rows } = await loadValuations();
  const players = perPlayer(rows);

  console.log(`[pro-vpm] fonte: ${source} · ${players.length} player(s) com banda confirmada`);
  for (const p of players) console.log(`  ${p.label.padEnd(12)} ${fmtBRL(p.vpm)}  (${p.sample} categoria(s))`);

  if (!target) {
    console.log("\nSnippet para colar em matrix.rows[].vpmObservado:");
    console.log(JSON.stringify(players.map((p) => ({ player: p.label, vpmObservado: fmtBRL(p.vpm) })), null, 2));
    console.log("\nRode com --write <arquivo.json> para injetar automaticamente (revisar depois).");
    return;
  }

  const report = JSON.parse(readFileSync(target, "utf8"));
  let patched = 0;
  for (const row of report.matrix?.rows ?? []) {
    const match = players.find((p) => row.player.toLowerCase().includes(p.player) || row.player.toLowerCase().includes(p.label.toLowerCase()));
    if (match) { row.vpmObservado = fmtBRL(match.vpm); patched++; }
  }
  writeFileSync(target, JSON.stringify(report, null, 2) + "\n");
  console.log(`[pro-vpm] ${patched} linha(s) da matriz atualizada(s) em ${target}. Revise antes de publicar.`);
}

main().catch((err) => { console.error("[pro-vpm] erro:", err); process.exit(1); });
