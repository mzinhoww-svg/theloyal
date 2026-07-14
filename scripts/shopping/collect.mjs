#!/usr/bin/env node
// Coletor do Radar de VPM (Fase 5). Renderiza cada fonte de PRODUTO com
// navegador headless (Playwright), extrai preço/pontos pelo adapter do programa
// e grava uma NOVA observação (nunca sobrescreve histórico). Fila com
// claim/retry/dead_letter; pós-coleta chama shopping_recompute.
//   node scripts/shopping/collect.mjs [--mock] [--limit N]
// Roda no GitHub Actions (não em serverless): Playwright precisa de navegador.
// Sem SUPABASE_SERVICE_KEY → não persiste (modo mock/dry).
import { ADAPTERS, ADAPTER_VERSION } from "./adapters.mjs";

const SB_URL = (process.env.SUPABASE_URL || "https://qjqnqcsdnpvvmyzkavoq.supabase.co").replace(/\/+$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
const args = process.argv.slice(2);
const MOCK = args.includes("--mock") || !SB_KEY;
const LIMIT = (() => { const i = args.indexOf("--limit"); return i >= 0 ? Number(args[i + 1]) : 40; })();
const MAX_ATTEMPTS = 3;

async function sb(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, "content-type": "application/json", ...(prefer ? { prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${(await res.text()).slice(0, 160)}`);
  return prefer?.includes("return=representation") ? res.json() : null;
}
const rpc = (fn, a = {}) =>
  fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" }, body: JSON.stringify(a) }).then((r) => r.json());

async function collectOne(browser, source) {
  const ctx = await browser.newContext({
    locale: "pt-BR",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  });
  const page = await ctx.newPage();
  try {
    await page.goto(source.product_url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(5000);
    const adapter = ADAPTERS[source.program_code];
    if (!adapter) throw new Error(`sem adapter para ${source.program_code}`);
    return await adapter(page);
  } finally {
    await ctx.close();
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[collect] modo=${MOCK ? "mock/dry" : "live"} limit=${LIMIT}`);

  if (MOCK) {
    console.log("[collect] mock: sem navegador, sem escrita. (defina SUPABASE_SERVICE_KEY para live)");
    return;
  }

  // 1. run
  const [run] = await sb("shopping_collection_runs", {
    method: "POST",
    prefer: "return=representation",
    body: { trigger_type: process.env.COLLECT_TRIGGER || "scheduled", status: "running", started_at: startedAt },
  });

  // 2. fontes de PRODUTO ativas (catálogo aprovado é a fonte de verdade)
  const sources = await (async () => {
    const res = await fetch(
      `${SB_URL}/rest/v1/shopping_product_sources?select=id,program_code,product_url,product_id,shopping_products!inner(status,approved)&source_url_type=eq.product&source_status=in.(active,pending_validation)&shopping_products.status=eq.active&limit=${LIMIT}`,
      { headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` } },
    );
    return res.json();
  })();
  console.log(`[collect] ${sources.length} fontes de produto selecionadas`);

  for (const s of sources) await sb("shopping_collection_queue", { method: "POST", prefer: "return=minimal,resolution=merge-duplicates", body: { run_id: run.id, source_id: s.id, status: "pending" } }).catch(() => {});

  // 3. navegador
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  let ok = 0, fail = 0, obs = 0;

  for (const s of sources) {
    const qf = `run_id=eq.${run.id}&source_id=eq.${s.id}`;
    await sb(`shopping_collection_queue?${qf}`, { method: "PATCH", body: { status: "running", claimed_at: new Date().toISOString(), attempt_count: 1 } }).catch(() => {});
    try {
      const r = await collectOne(browser, s);
      await sb("shopping_observations", {
        method: "POST",
        body: {
          run_id: run.id, source_id: s.id, product_id: s.product_id, program_code: s.program_code,
          captured_at: new Date().toISOString(), observed_title: r.observed_title,
          reference_price: r.reference_price, listed_price: r.reference_price,
          reference_price_type: r.reference_price != null ? "a_vista" : null, reference_price_source: "marketplace",
          reference_price_captured_at: r.reference_price != null ? new Date().toISOString() : null,
          standard_points: r.standard_points, elite_points: r.elite_points,
          hybrid_points: r.hybrid_points, hybrid_cash: r.hybrid_cash,
          availability: r.availability, match_confidence: "medium", extraction_confidence: r.extraction_confidence,
          extraction_method: "browser_headless", adapter_version: ADAPTER_VERSION, calculation_version: "shopping_vpm_v1",
          source_url: s.product_url,
          validation_status: r.reference_price && r.standard_points ? "auto" : "insufficient",
        },
      });
      await sb(`shopping_collection_queue?${qf}`, { method: "PATCH", body: { status: "success", completed_at: new Date().toISOString() } }).catch(() => {});
      await sb(`shopping_product_sources?id=eq.${s.id}`, { method: "PATCH", body: { last_validated_at: new Date().toISOString(), consecutive_failures: 0, source_status: r.reference_price && r.standard_points ? "active" : "pending_validation" } }).catch(() => {});
      ok++; obs++;
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 200);
      await sb(`shopping_collection_queue?${qf}`, { method: "PATCH", body: { status: "error", last_error_message: msg, next_retry_at: new Date(Date.now() + 3600000).toISOString() } }).catch(() => {});
      await sb(`shopping_product_sources?id=eq.${s.id}`, { method: "PATCH", body: { consecutive_failures: MAX_ATTEMPTS } }).catch(() => {});
      console.error(`[collect] falha ${s.program_code} ${s.product_url}: ${msg}`);
      fail++;
    }
  }
  await browser.close();

  // 4. recompute
  const rec = await rpc("shopping_recompute", {}).catch((e) => ({ error: String(e) }));

  // 5. finaliza
  await sb(`shopping_collection_runs?id=eq.${run.id}`, {
    method: "PATCH",
    body: {
      status: fail && ok ? "partial" : fail ? "failed" : "success",
      completed_at: new Date().toISOString(),
      selected_sources: sources.length, successful_sources: ok, failed_sources: fail, observations_created: obs,
      metadata: { recompute: rec },
    },
  });
  console.log(`[collect] OK — ${ok} sucesso, ${fail} falha, ${obs} observações. recompute=${JSON.stringify(rec)}`);
}

main().catch((e) => { console.error("[collect] erro fatal:", e); process.exit(1); });
