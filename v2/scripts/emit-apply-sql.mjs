#!/usr/bin/env node
// Gera o SQL idempotente de aplicação (staging + finalize + domínio) a partir
// do matcher testado (leitura anon). Escreve arquivos no diretório OUT.
// ENV: SUPABASE_URL, SUPABASE_ANON_KEY, OUT.  node v2/scripts/emit-apply-sql.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { construirIndices, resolverCampanha, normalizar } from '../lib/identidade.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const SEED = JSON.parse(readFileSync(join(__dir, '..', 'db', 'seed-aliases.json'), 'utf8'));
const IX = construirIndices(SEED);
const OUT = process.env.OUT || '/tmp/apply';
mkdirSync(OUT, { recursive: true });
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_ANON_KEY, REF = '2026-07-16';

const q = (s) => s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`;
const b = (v) => v === null || v === undefined ? 'null' : (v ? 'true' : 'false');
const j = (o) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
const arr = (a) => `ARRAY[${a.map((x) => q(x)).join(',')}]::text[]`;

// ---- domínio ----
let dom = '-- domínio: programas + aliases + pares\n';
for (const p of SEED.programas) {
  dom += `insert into public.loyalty_programs (code,name,kind,aliases,active) values (${q(p.code)},${q(p.name)},${q(p.kind)},${arr(p.aliases || [])},true) on conflict (code) do update set name=excluded.name, kind=excluded.kind, aliases=excluded.aliases;\n`;
}
const aliasSeen = new Set();
for (const p of SEED.programas) {
  for (const al of [...(p.aliases || []), p.name, p.code]) {
    const n = normalizar(al);
    if (!n || aliasSeen.has(n)) continue; aliasSeen.add(n);
    dom += `insert into public.programa_aliases (alias_normalizado,programa_code,origem_deteccao) values (${q(n)},${q(p.code)},'seed') on conflict (alias_normalizado) do nothing;\n`;
  }
}
for (const pt of SEED.pares_transferencia_seed || []) {
  dom += `insert into public.pares_transferencia (origem_code,destino_code,paridade_base) values (${q(pt.origem_code)},${q(pt.destino_code)},${pt.paridade_base}) on conflict do nothing;\n`;
}
writeFileSync(join(OUT, '00_domain.sql'), dom);

// ---- staging DDL ----
writeFileSync(join(OUT, '10_stage_ddl.sql'), `drop table if exists public._canon_stage;
create table public._canon_stage (
  id text primary key, resolvido boolean, revisao text, identity_key text, tipo text,
  origem_code text, destino_code text, publico text, origem_bruto text, destino_bruto text,
  lado_unico boolean, bucketed boolean, vig_date date, vig_confiavel boolean, estado text,
  payload_antes jsonb, payload_depois jsonb);\n`);

// ---- ler campaigns e gerar staging data ----
async function page(off, lim) {
  const sel = 'id,origem,destino,tipo,vigencia_fim,tier,notes,paridade,valor_leitura';
  const r = await fetch(`${URL}/rest/v1/campaigns?select=${sel}&order=id.asc&offset=${off}&limit=${lim}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}
const rows = []; let off = 0;
for (;;) { const p = await page(off, 1000); if (!p.length) break; rows.push(...p); off += p.length; }

const BATCH = 700; let fileN = 0; const cols = '(id,resolvido,revisao,identity_key,tipo,origem_code,destino_code,publico,origem_bruto,destino_bruto,lado_unico,bucketed,vig_date,vig_confiavel,estado,payload_antes,payload_depois)';
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  let sql = `insert into public._canon_stage ${cols} values\n`;
  const vals = chunk.map((c) => {
    const r = resolverCampanha(c, IX, REF);
    const pa = { origem: c.origem, destino: c.destino, tipo: c.tipo, vigencia_fim: c.vigencia_fim };
    const pd = r.resolvido
      ? { identity_key: r.identity_key, tipo: r.tipo, origem_code: r.origemCode, destino_code: r.destinoCode, publico: r.publico, estado: r.estado, lado_unico: r.lado_unico, bucketed: r.bucketed }
      : { revisao: r.revisao, estado: r.estado };
    return `(${q(c.id)},${b(r.resolvido)},${q(r.revisao || null)},${q(r.identity_key || null)},${q(r.tipo || null)},${q(r.origemCode || null)},${q(r.destinoCode || null)},${q(r.publico || null)},${q(r.origem_bruto || null)},${q(r.destino_bruto || null)},${b(r.lado_unico)},${b(r.bucketed)},${q(r.vigencia_fim_date || null)},${b(r.vigencia_confiavel)},${q(r.estado || null)},${j(pa)},${j(pd)})`;
  });
  sql += vals.join(',\n') + ' on conflict (id) do nothing;\n';
  writeFileSync(join(OUT, `11_stage_${String(++fileN).padStart(2, '0')}.sql`), sql);
}

// ---- finalize ----
writeFileSync(join(OUT, '20_finalize.sql'), `
insert into public.campanha_identidade (tipo,origem_code,destino_code,publico,identity_key)
select distinct tipo,origem_code,destino_code,publico,identity_key from public._canon_stage
where identity_key is not null
on conflict (identity_key) do nothing;

update public.campaigns c set
  identidade_id=ci.id, origem_code=s.origem_code, destino_code=s.destino_code, publico=s.publico,
  origem_bruto=s.origem_bruto, destino_bruto=s.destino_bruto, lado_unico=s.lado_unico, bucketed=s.bucketed,
  vigencia_fim_date=s.vig_date, vigencia_confiavel=s.vig_confiavel, estado=s.estado, canonicalizado_em=now()
from public._canon_stage s
left join public.campanha_identidade ci on ci.identity_key=s.identity_key
where c.id=s.id;
`);

// versoes (idempotente): NOT EXISTS por campaign+chave-de-desfecho
const versoesSql = `
insert into public.campanha_versoes (identidade_id,campaign_id,evento,payload_antes,payload_depois,origem)
select ci.id, s.id, 'canonicalizacao', s.payload_antes, s.payload_depois, 'matcher'
from public._canon_stage s
left join public.campanha_identidade ci on ci.identity_key=s.identity_key
where not exists (
  select 1 from public.campanha_versoes v
  where v.campaign_id=s.id and v.evento='canonicalizacao'
    and coalesce(v.payload_depois->>'identity_key','rev:'||coalesce(v.payload_depois->>'revisao',''))
      = coalesce(s.payload_depois->>'identity_key','rev:'||coalesce(s.payload_depois->>'revisao',''))
);`;
writeFileSync(join(OUT, '21_versoes.sql'), versoesSql + '\n');
writeFileSync(join(OUT, '40_idempotency.sql'), versoesSql + '\n');  // 2ª passada -> deve inserir 0

console.log(`OK: ${rows.length} campanhas, ${fileN} arquivos de staging em ${OUT}`);
