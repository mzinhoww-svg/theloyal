#!/usr/bin/env node
// =====================================================================
// dryrun-report.mjs — DRY-RUN read-only da canonicalização (M1)
// Lê campaigns via REST (chave anon, política anon_read_campaigns) e roda o
// matcher testado. NÃO escreve nada. Produz: totais por desfecho, amostras
// por motivo de revisão, e distintos de origem_nao_resolvida (p/ achar
// programa real que escapou do A+C -> vira INSERT no seed antes do apply).
//
// ENV: SUPABASE_URL, SUPABASE_ANON_KEY.  node v2/scripts/dryrun-report.mjs
// =====================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { construirIndices, resolverCampanha } from '../lib/identidade.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const SEED = JSON.parse(readFileSync(join(__dir, '..', 'db', 'seed-aliases.json'), 'utf8'));
const IX = construirIndices(SEED);

const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_ANON_KEY;
if (!URL || !KEY) { console.error('defina SUPABASE_URL e SUPABASE_ANON_KEY'); process.exit(1); }
const REF = process.env.REF_DATE || new Date().toISOString().slice(0, 10);

async function page(offset, limit) {
  const sel = 'id,origem,destino,tipo,vigencia_fim,tier,notes,paridade,valor_leitura';
  const res = await fetch(`${URL}/rest/v1/campaigns?select=${sel}&order=id.asc&offset=${offset}&limit=${limit}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

const out = { total: 0, rota: 0, lado_unico: 0, bucketed: 0, revisao: 0 };
const porMotivo = {}, amostras = {}, origemNaoResolvida = {};
const push = (m, c) => { (amostras[m] ??= []); if (amostras[m].length < 20) amostras[m].push(c); };

let offset = 0;
for (;;) {
  const rows = await page(offset, 1000);
  if (!rows.length) break;
  for (const c of rows) {
    const r = resolverCampanha(c, IX, REF);
    out.total++;
    if (r.resolvido) {
      if (r.lado_unico) out.lado_unico++; else out.rota++;
      if (r.bucketed) out.bucketed++;
    } else {
      out.revisao++;
      porMotivo[r.revisao] = (porMotivo[r.revisao] || 0) + 1;
      push(r.revisao, { id: c.id, origem: c.origem, destino: c.destino, tipo: c.tipo, vig: c.vigencia_fim });
      if (r.revisao === 'origem_nao_resolvida') {
        const k = (r.origem_bruto || '(vazio)');
        origemNaoResolvida[k] = (origemNaoResolvida[k] || 0) + 1;
      }
    }
  }
  offset += rows.length;
  process.stderr.write(`\r  lidas: ${out.total}`);
}
const pct = (x) => `${((x / out.total) * 100).toFixed(1)}%`;
console.log('\n=================== DRY-RUN (read-only) ===================');
console.log(`total campanhas:            ${out.total}`);
console.log(`resolvida por ROTA:         ${out.rota} (${pct(out.rota)})`);
console.log(`resolvida por LADO ÚNICO:   ${out.lado_unico} (${pct(out.lado_unico)})`);
console.log(`  (com bucket em algum lado:${out.bucketed})`);
console.log(`em REVISÃO:                 ${out.revisao} (${pct(out.revisao)})`);
console.log('  por motivo:', JSON.stringify(porMotivo));

for (const [motivo, arr] of Object.entries(amostras)) {
  console.log(`\n--- amostra revisão [${motivo}] (${porMotivo[motivo]} total, mostrando ${arr.length}) ---`);
  for (const c of arr) console.log(`   ${c.id.slice(0, 40)} | origem="${c.origem}" destino="${c.destino}" tipo="${c.tipo}" vig="${c.vig}"`);
}

console.log('\n--- origem_nao_resolvida: distintos por frequência (checar programa real que escapou do A+C) ---');
const dist = Object.entries(origemNaoResolvida).sort((a, b) => b[1] - a[1]);
console.log('   ' + dist.map(([v, n]) => `${v}(${n})`).join(', '));
console.log(`   (${dist.length} distintos)`);
