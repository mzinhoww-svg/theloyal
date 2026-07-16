#!/usr/bin/env node
// Emite SQL COMPACTO de lookup (sem dados de campanha): programas, aliases,
// ruído, genérico, tipo-map. A canonicalização roda set-based no banco.
// ENV: OUT.  node v2/scripts/emit-lookup-sql.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizar, MAPA_TIPO } from '../lib/identidade.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const SEED = JSON.parse(readFileSync(join(__dir, '..', 'db', 'seed-aliases.json'), 'utf8'));
const OUT = process.env.OUT || '/tmp/lookup';
mkdirSync(OUT, { recursive: true });
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const arr = (a) => `ARRAY[${a.map(q).join(',')}]::text[]`;

// programas (code,name,kind) — compacto, um único INSERT ... VALUES
const provals = SEED.programas.map((p) => `(${q(p.code)},${q(p.name)},${q(p.kind)},true)`);
writeFileSync(join(OUT, '00_programs.sql'),
  `insert into public.loyalty_programs (code,name,kind,active) values\n${provals.join(',\n')}\non conflict (code) do update set name=excluded.name, kind=excluded.kind;\n`);

// programa_aliases: pares (alias_normalizado, code) — aliases + name + code
const seen = new Set(); const pairs = [];
for (const p of SEED.programas) {
  for (const al of [...(p.aliases || []), p.name, p.code]) {
    const n = normalizar(al);
    if (!n || seen.has(n)) continue; seen.add(n);
    pairs.push(`(${q(n)},${q(p.code)},'seed')`);
  }
}
writeFileSync(join(OUT, '01_aliases.sql'),
  `insert into public.programa_aliases (alias_normalizado,programa_code,origem_deteccao) values\n${pairs.join(',\n')}\non conflict (alias_normalizado) do nothing;\n`);

// pares_transferencia
let pares = '';
for (const pt of SEED.pares_transferencia_seed || []) {
  pares += `insert into public.pares_transferencia (origem_code,destino_code,paridade_base) values (${q(pt.origem_code)},${q(pt.destino_code)},${pt.paridade_base}) on conflict do nothing;\n`;
}
writeFileSync(join(OUT, '02_pares.sql'), pares);

// lookup tables: tl_ruido, tl_generico, tl_tipo_map (normalizados)
const ruido = [...new Set((SEED.ruido || []).map(normalizar))].filter(Boolean);
const gen = [...new Set((SEED.generico_recuperavel || []).map(normalizar))].filter(Boolean);
const tmap = [...new Set(Object.entries(MAPA_TIPO).map(([k, v]) => `(${q(normalizar(k))},${q(v)})`))];
let lk = 'drop table if exists public.tl_ruido; create table public.tl_ruido(v text primary key);\n';
lk += `insert into public.tl_ruido(v) values ${ruido.map((v) => `(${q(v)})`).join(',')} on conflict do nothing;\n`;
lk += 'drop table if exists public.tl_generico; create table public.tl_generico(v text primary key);\n';
lk += `insert into public.tl_generico(v) values ${gen.map((v) => `(${q(v)})`).join(',')} on conflict do nothing;\n`;
lk += 'drop table if exists public.tl_tipo_map; create table public.tl_tipo_map(bruto text primary key, canon text);\n';
lk += `insert into public.tl_tipo_map(bruto,canon) values ${tmap.join(',')} on conflict do nothing;\n`;
writeFileSync(join(OUT, '03_lookups.sql'), lk);

console.log(`programas=${SEED.programas.length} aliases=${pairs.length} ruido=${ruido.length} generico=${gen.length} tipos=${tmap.length}`);
