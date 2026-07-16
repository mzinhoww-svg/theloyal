#!/usr/bin/env node
// =====================================================================
// worker.mjs — consumidor da job_queue em lote, retomável (M1 slice 2)
// Loop: jq_claim -> despacha por tipo -> jq_complete / jq_fail (backoff).
// Sem SLA rígido (8.1); integridade > latência. Nenhum job descartado (INV-14).
//
// ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WORKER_ID (opcional),
//      BATCH (default 10), MAX_LOOPS (default 0 = infinito).
// USO: node v2/scripts/worker.mjs
// =====================================================================
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const WORKER = process.env.WORKER_ID || `w-${process.pid}`;
const BATCH = parseInt(process.env.BATCH || '10', 10);
const MAX_LOOPS = parseInt(process.env.MAX_LOOPS || '0', 10);

async function rpc(fn, args) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {}),
  });
  if (!r.ok) throw new Error(`rpc ${fn} -> ${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

// Handlers plugáveis por tipo. Cada um recebe o job e resolve/rejeita.
// Placeholders: as próximas slices ligam coleta/extração/recheck reais.
const HANDLERS = {
  recheck_vigencia: async () => { /* slice: recheck de itens <72h -> transição de estado */ },
  confirmacao_tier1: async () => { /* slice 3: registra fonte tier1 + promove estado (incremental) */ },
  // extracao, resolucao, analise, digest, coleta_rss, backfill... entram nas slices seguintes
};

async function processar(job) {
  const h = HANDLERS[job.tipo];
  if (!h) throw new Error(`sem handler para tipo=${job.tipo}`);
  await h(job);
}

async function main() {
  let loops = 0, vazios = 0;
  for (;;) {
    if (MAX_LOOPS && loops >= MAX_LOOPS) break;
    loops++;
    const jobs = await rpc('jq_claim', { p_worker: WORKER, p_batch: BATCH });
    if (!jobs || !jobs.length) { vazios++; if (MAX_LOOPS) break; if (vazios >= 3) break; continue; }
    vazios = 0;
    for (const job of jobs) {
      try { await processar(job); await rpc('jq_complete', { p_id: job.id }); }
      catch (e) {
        const novo = await rpc('jq_fail', { p_id: job.id, p_err: String(e && e.message || e) });
        console.error(`job ${job.id} (${job.tipo}) falhou -> ${novo}: ${e.message}`);
      }
    }
    console.log(`worker=${WORKER} lote=${jobs.length} loop=${loops}`);
  }
  console.log(`worker=${WORKER} encerrou (loops=${loops})`);
}
main().catch((e) => { console.error('FALHA worker:', e.message); process.exit(1); });
