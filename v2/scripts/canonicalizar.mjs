#!/usr/bin/env node
// =====================================================================
// canonicalizar.mjs — popula a camada canônica a partir de campaigns (M1)
// Spec: v2/db/SPEC-M1-identidade.md. Aditivo/idempotente/resumível (8.1).
//
// USO:
//   node v2/scripts/canonicalizar.mjs --dry-run     # relatório, NÃO escreve
//   node v2/scripts/canonicalizar.mjs --apply       # escreve (após snapshot D-006)
//   flags: --limit N  --offset N  --batch N (default 500)
//
// ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Sem elas -> aborta (não faz mock
// silencioso). Pré-requisito para --apply: migration 001 aplicada + snapshot.
// =====================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { construirAliasMap, resolverCampanha } from '../lib/identidade.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const SEED = JSON.parse(readFileSync(join(__dir, '..', 'db', 'seed-aliases.json'), 'utf8'));
const ALIAS_MAP = construirAliasMap(SEED.programas);

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DRY = has('--dry-run') || !has('--apply');
const BATCH = parseInt(val('--batch', '500'), 10);
const LIMIT = val('--limit', null) ? parseInt(val('--limit', '0'), 10) : null;
let OFFSET = parseInt(val('--offset', '0'), 10);

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('ERRO: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. Abortando (sem mock silencioso).');
  process.exit(1);
}
const REF = (process.env.REF_DATE || new Date().toISOString().slice(0, 10));

async function rest(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`REST ${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const stats = {
  lidas: 0, resolvidas: 0, revisao: 0, identidades: new Set(),
  porTipo: {}, programas: new Set(), vigConfiavel: 0, vigIndeterminada: 0,
  revisaoMotivos: {},
};

function contabiliza(r) {
  stats.lidas++;
  if (r.vigencia_confiavel) stats.vigConfiavel++; else stats.vigIndeterminada++;
  if (r.tipo) stats.porTipo[r.tipo] = (stats.porTipo[r.tipo] || 0) + 1;
  if (r.origemCode) stats.programas.add(r.origemCode);
  if (r.destinoCode) stats.programas.add(r.destinoCode);
  if (r.resolvido) { stats.resolvidas++; stats.identidades.add(r.identity_key); }
  else { stats.revisao++; stats.revisaoMotivos[r.revisao] = (stats.revisaoMotivos[r.revisao] || 0) + 1; }
}

async function upsertIdentidade(r) {
  // idempotente: on conflict identity_key
  const rows = await rest('campanha_identidade?on_conflict=identity_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: [{ tipo: r.tipo, origem_code: r.origemCode, destino_code: r.destinoCode, publico: r.publico, identity_key: r.identity_key }],
  });
  return rows?.[0]?.id;
}

async function jaTemVersao(campaignId, identityKey) {
  const rows = await rest(`campanha_versoes?campaign_id=eq.${encodeURIComponent(campaignId)}&evento=eq.canonicalizacao&select=payload_depois&order=em.desc&limit=1`);
  return rows?.[0]?.payload_depois?.identity_key === identityKey;
}

async function aplicar(camp, r) {
  const identidadeId = await upsertIdentidade(r);
  const depois = { identity_key: r.identity_key, tipo: r.tipo, origem_code: r.origemCode, destino_code: r.destinoCode, publico: r.publico, estado: r.estado, vigencia_fim_date: r.vigencia_fim_date, vigencia_confiavel: r.vigencia_confiavel };
  // idempotência: só grava evento se mudou
  if (!(await jaTemVersao(camp.id, r.identity_key))) {
    await rest('campanha_versoes', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: [{ identidade_id: identidadeId, campaign_id: camp.id, evento: 'canonicalizacao',
        payload_antes: { origem: camp.origem, destino: camp.destino, tipo: camp.tipo, vigencia_fim: camp.vigencia_fim },
        payload_depois: depois, origem: 'matcher' }],
    });
  }
  await rest(`campaigns?id=eq.${encodeURIComponent(camp.id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: { identidade_id: identidadeId, origem_code: r.origemCode, destino_code: r.destinoCode,
      publico: r.publico, vigencia_fim_date: r.vigencia_fim_date, vigencia_confiavel: r.vigencia_confiavel,
      estado: r.estado, canonicalizado_em: new Date().toISOString() },
  });
}

async function aplicarRevisao(camp, r) {
  // não resolvido: só marca estado (indeterminada) + registra na trilha, sem identidade
  await rest(`campaigns?id=eq.${encodeURIComponent(camp.id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: { estado: r.estado, vigencia_fim_date: r.vigencia_fim_date, vigencia_confiavel: r.vigencia_confiavel,
      canonicalizado_em: new Date().toISOString() },
  });
  await rest('campanha_versoes', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: [{ campaign_id: camp.id, evento: 'canonicalizacao',
      payload_antes: { origem: camp.origem, destino: camp.destino, tipo: camp.tipo },
      payload_depois: { revisao: r.revisao, estado: r.estado }, origem: 'matcher' }],
  });
}

async function main() {
  console.log(`[canonicalizar] modo=${DRY ? 'DRY-RUN' : 'APPLY'} ref=${REF} batch=${BATCH}`);
  let processadas = 0;
  for (;;) {
    if (LIMIT != null && processadas >= LIMIT) break;
    const take = LIMIT != null ? Math.min(BATCH, LIMIT - processadas) : BATCH;
    const camps = await rest(`campaigns?select=id,origem,destino,tipo,vigencia_fim,tier,notes,paridade,valor_leitura&order=id.asc&offset=${OFFSET}&limit=${take}`);
    if (!camps.length) break;
    for (const camp of camps) {
      const r = resolverCampanha(camp, ALIAS_MAP, REF);
      contabiliza(r);
      if (!DRY) { r.resolvido ? await aplicar(camp, r) : await aplicarRevisao(camp, r); }
    }
    processadas += camps.length; OFFSET += camps.length;
    process.stdout.write(`\r  processadas: ${processadas}`);
  }
  console.log('\n--- RELATÓRIO ---');
  console.log(`lidas:            ${stats.lidas}`);
  console.log(`resolvidas:       ${stats.resolvidas}`);
  console.log(`em revisão:       ${stats.revisao}`);
  console.log(`identidades únicas:${stats.identidades.size}`);
  console.log(`programas usados: ${stats.programas.size} (${[...stats.programas].sort().join(', ')})`);
  console.log(`vigência confiável/indeterminada: ${stats.vigConfiavel}/${stats.vigIndeterminada}`);
  console.log('por tipo:', JSON.stringify(stats.porTipo));
  console.log('motivos de revisão:', JSON.stringify(stats.revisaoMotivos));
  if (DRY) console.log('\n(DRY-RUN: nada foi escrito. Rode --apply após snapshot + migration 001.)');
}

main().catch((e) => { console.error('\nFALHA:', e.message); process.exit(1); });
