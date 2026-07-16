#!/usr/bin/env node
// Read-only: imprime a régua vigente + cobertura do banco D a partir da REST pública
// do Supabase (mesma anon key do /admin). NÃO escreve nada. Para o ritual completo
// (que pode mover a régua) use o conector Supabase conforme docs/VALUATIONS-RUNBOOK.md.
// BKL-03: sem fallback hardcoded de URL/chave.
const URL = process.env.SUPABASE_URL || "";
const KEY = process.env.SUPABASE_ANON || "";
if (!URL || !KEY) {
  console.error("[valuations] SUPABASE_URL/SUPABASE_ANON ausentes — configure o ambiente.");
  process.exit(1);
}
const h = { apikey: KEY, authorization: `Bearer ${KEY}` };
const get = async (p) => {
  const r = await fetch(`${URL}/rest/v1/${p}`, { headers: h, cache: "no-store" });
  if (!r.ok) throw new Error(`${p} -> ${r.status}`);
  return r.json();
};
const money = (v) => (v == null ? "—" : Number(v).toFixed(2));
(async () => {
  const rule = await get("valuations?select=program,piso,teto,confidence,period_id&is_current=eq.true&order=program.asc");
  const passagens = await get("passagens?select=id");
  console.log(`\nRÉGUA VIGENTE — period ${rule[0]?.period_id ?? "?"} (${rule.length} programas)`);
  console.log("programa".padEnd(14), "piso".padStart(6), "teto".padStart(6), "  confiança");
  for (const v of rule) console.log(v.program.padEnd(14), money(v.piso).padStart(6), money(v.teto).padStart(6), "  " + (v.confidence ?? "—"));
  // sanidade
  const bad = rule.filter((v) => Number(v.piso) > Number(v.teto));
  console.log(`\nSanidade: ${bad.length ? "FALHA piso>teto em " + bad.map((b)=>b.program).join(",") : "ok (piso<=teto)"}`);
  console.log(`Banco D (passagens/resgate): ${passagens.length} obs${passagens.length ? "" : "  ← sem base p/ VPM; régua só pode ser mantida"}`);
})().catch((e) => { console.error("erro:", e.message); process.exit(1); });
