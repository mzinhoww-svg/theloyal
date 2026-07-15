#!/usr/bin/env node
// Coletor do Radar de VPM (Fase 5). Renderiza cada fonte de PRODUTO com
// navegador headless (Playwright), extrai preço/pontos pelo adapter do programa
// e grava uma NOVA observação (nunca sobrescreve histórico). Fila com
// claim/retry/dead_letter; pós-coleta chama shopping_recompute.
//   node scripts/shopping/collect.mjs [--mock] [--limit N]
// Roda no GitHub Actions (não em serverless): Playwright precisa de navegador.
// Sem SUPABASE_SERVICE_KEY → não persiste (modo mock/dry).
import { mkdirSync, writeFileSync } from "node:fs";
import { ADAPTERS, ADAPTER_VERSION, diagnose } from "./adapters.mjs";

const SB_URL = (process.env.SUPABASE_URL || "https://qjqnqcsdnpvvmyzkavoq.supabase.co").replace(/\/+$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
const args = process.argv.slice(2);
const DIAGNOSE = args.includes("--diagnose");
const MOCK = !DIAGNOSE && (args.includes("--mock") || !SB_KEY);
const LIMIT = (() => { const i = args.indexOf("--limit"); return i >= 0 ? Number(args[i + 1]) : 40; })();
const OUT_DIR = (() => { const i = args.indexOf("--out"); return i >= 0 ? args[i + 1] : "diagnostics"; })();
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

// Flags do navegador. AutomationControlled reduz detecção de bot.
// (--disable-http2 foi testado contra a Azul e removido: não destravou o portal
// — só trocou a falha instantânea por timeout de 45s, inchando o run. A Azul
// bloqueia a coleta headless no nível de rede; precisa de outra abordagem.)
const LAUNCH_ARGS = ["--no-sandbox", "--disable-blink-features=AutomationControlled"];

// goto com 1 retry para falhas transitórias, mas NÃO repete em timeout — um
// portal que pendura (ex.: Azul) é bloqueio determinístico, não vale gastar
// outros 25s. Timeout curto (25s) para falhar rápido nas fontes bloqueadas.
async function gotoResilient(page, url) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      return;
    } catch (e) {
      if (attempt === 2 || /timeout/i.test(String(e))) throw e;
      await page.waitForTimeout(1500);
    }
  }
}

async function collectOne(browser, source) {
  const ctx = await browser.newContext({
    locale: "pt-BR",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  });
  const page = await ctx.newPage();
  try {
    await gotoResilient(page, source.product_url);
    await page.waitForTimeout(5000);
    const adapter = ADAPTERS[source.program_code];
    if (!adapter) throw new Error(`sem adapter para ${source.program_code}`);
    return await adapter(page);
  } finally {
    await ctx.close();
  }
}

// Fontes de PRODUTO ativas (catálogo aprovado é a fonte de verdade).
async function fetchSources() {
  const res = await fetch(
    `${SB_URL}/rest/v1/shopping_product_sources?select=id,program_code,product_url,product_id,shopping_products!inner(status,approved)&source_url_type=eq.product&source_status=in.(active,pending_validation)&shopping_products.status=eq.active&limit=${LIMIT}`,
    { headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` } },
  );
  if (!res.ok) throw new Error(`fontes → ${res.status} ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

// Modo diagnóstico: renderiza cada fonte, salva HTML + screenshot + candidatos
// de preço/pontos em OUT_DIR e um report.json. Não toca no banco — só evidência
// para afinar os seletores por portal. Precisa da service key só para LER as
// fontes; nenhuma observação/queue/run é criada.
async function runDiagnose() {
  if (!SB_KEY) {
    console.error("[diagnose] SUPABASE_SERVICE_KEY ausente — necessária para ler as fontes.");
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const sources = await fetchSources();
  console.log(`[diagnose] ${sources.length} fontes · saída em ${OUT_DIR}/`);

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  const report = [];

  for (const s of sources) {
    const slug = `${s.program_code}__${String(s.id).slice(0, 8)}`;
    const ctx = await browser.newContext({
      locale: "pt-BR",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    });
    const page = await ctx.newPage();
    const entry = { source_id: s.id, program_code: s.program_code, url: s.product_url, slug };
    try {
      await gotoResilient(page, s.product_url);
      await page.waitForTimeout(5000);
      const d = await diagnose(page, s.program_code);
      writeFileSync(`${OUT_DIR}/${slug}.html`, await page.content());
      await page.screenshot({ path: `${OUT_DIR}/${slug}.png`, fullPage: true }).catch(() => {});
      Object.assign(entry, d);
      const ext = d.extraction || {};
      console.log(`[diagnose] ${slug} · preço=${ext.reference_price ?? "—"} pts=${ext.standard_points ?? "—"} · cand.preço=${d.debug?.priceCandidates?.length ?? 0} cand.pts=${d.debug?.pointsCandidates?.length ?? 0}`);
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e);
      console.error(`[diagnose] falha ${slug}: ${entry.error}`);
    } finally {
      await ctx.close();
    }
    report.push(entry);
  }
  await browser.close();
  writeFileSync(`${OUT_DIR}/report.json`, JSON.stringify({ generatedAt: new Date().toISOString(), sources: report.length, report }, null, 2) + "\n");
  const withPrice = report.filter((r) => r.extraction?.reference_price != null).length;
  const withPts = report.filter((r) => r.extraction?.standard_points != null).length;
  console.log(`[diagnose] OK — ${report.length} fontes · ${withPrice} c/ preço · ${withPts} c/ pontos · report em ${OUT_DIR}/report.json`);
}

async function main() {
  if (DIAGNOSE) return runDiagnose();

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
  const sources = await fetchSources();
  console.log(`[collect] ${sources.length} fontes de produto selecionadas`);

  for (const s of sources) await sb("shopping_collection_queue", { method: "POST", prefer: "return=minimal,resolution=merge-duplicates", body: { run_id: run.id, source_id: s.id, status: "pending" } }).catch(() => {});

  // 3. navegador
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
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
