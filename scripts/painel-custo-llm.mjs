// Painel de custo LLM (M2.5 · REQ-34/35) — relatório de terminal.
// LÊ `llm_jobs` + `model_registry` do Supabase e SOMA por dia × estágio, usando
// a lógica pura e testada de v2/lib/painel-custo-llm.mjs.
//
//   node scripts/painel-custo-llm.mjs            # live se houver SUPABASE_SERVICE_KEY
//   node scripts/painel-custo-llm.mjs --dias 7   # janela (default 30)
//
// Custo em USD só aparece para estágios com preço aprovado no model_registry.
// Sem preço → "n/c" (Não confirmado), NUNCA R$0 — o teto (LLM_DAILY_BUDGET_USD)
// é só visibilidade, não enforcement (spec §3).
import { supabaseEnabled, select } from "./collect/supabase.mjs";
import { agregarPorDiaEstagio, registryMap, consumoDoDia } from "../v2/lib/painel-custo-llm.mjs";

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const fmtUsd = (v) => (v == null ? "n/c" : `$${v.toFixed(6)}`);
const fmtMs = (v) => (v == null ? "—" : `${Math.round(v)}ms`);
const pad = (s, n) => String(s).padEnd(n);

async function main() {
  const dias = Number(arg("--dias", "30"));
  const teto = process.env.LLM_DAILY_BUDGET_USD ? Number(process.env.LLM_DAILY_BUDGET_USD) : null;

  if (!supabaseEnabled()) {
    console.log("[painel] Supabase off (sem SUPABASE_SERVICE_KEY) — nada a somar. Configure as chaves para ler llm_jobs.");
    process.exit(0);
  }

  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const { rows: jobs } = await select(
    "llm_jobs",
    `select=estagio,provider,modelo,tokens_in,tokens_out,latencia_ms,status,criado_em&criado_em=gte.${desde}&order=criado_em.desc`,
  );
  const { rows: registry } = await select("model_registry", "select=estagio,preco_input_por_1k_usd,preco_output_por_1k_usd");

  const reg = registryMap(registry);
  const agregado = agregarPorDiaEstagio(jobs, reg);

  console.log(`\n[painel de custo LLM] janela ${dias}d · ${jobs.length} chamadas · ${registry.length} estágios com modelo registrado`);
  const semPreco = registry.filter((r) => r.preco_input_por_1k_usd == null || r.preco_output_por_1k_usd == null).length;
  if (semPreco || registry.length === 0) {
    console.log(`[painel] ${registry.length === 0 ? "model_registry vazio" : `${semPreco} estágio(s) sem preço`} → custo USD = n/c (Não confirmado). Preço é seed a aprovar (INV-03).`);
  }

  console.log("\n" + [pad("dia", 12), pad("estágio", 20), pad("cham.", 6), pad("tok_in", 10), pad("tok_out", 10), pad("custo_usd", 14), pad("p50", 8), pad("p95", 8), pad("err", 4), "fb"].join(" "));
  console.log("-".repeat(104));
  for (const l of agregado) {
    console.log([
      pad(l.dia, 12), pad(l.estagio, 20), pad(l.chamadas, 6),
      pad(l.tokens_in_total, 10), pad(l.tokens_out_total, 10),
      pad(fmtUsd(l.custo_usd_total), 14),
      pad(fmtMs(l.latencia_p50_ms), 8), pad(fmtMs(l.latencia_p95_ms), 8),
      pad(l.erros, 4), l.fallbacks,
    ].join(" "));
  }

  // Consumo do dia mais recente contra o teto (visibilidade, spec §3).
  const hoje = agregado[0]?.dia;
  if (hoje) {
    const c = consumoDoDia(agregado, hoje, teto);
    console.log(`\n[dia ${hoje}] ${c.chamadas} chamadas · custo ${fmtUsd(c.custo_usd)}` +
      (teto != null ? ` · teto $${teto} · resta ${c.resta_usd == null ? "n/c" : "$" + c.resta_usd.toFixed(6)}` : " · sem teto configurado (LLM_DAILY_BUDGET_USD)"));
  }
  console.log("");
}

main().catch((err) => { console.error("[painel] erro:", err); process.exit(1); });
