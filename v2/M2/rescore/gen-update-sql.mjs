// Gera UPDATE ... FROM (VALUES ...) batelado e IDEMPOTENTE a partir de
// out/rescore-2-rows.json. Só toca campaigns com identidade_id IS NOT NULL
// (guarda no WHERE). Grava tl_score_bruto, veredito_bruto, override_aplicado,
// versao_pesos. NÃO toca tl_score legado nem o backup. Escreve chunks em
// out/sql-2/chunk_NN.sql para execução serializada via MCP.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const rows = JSON.parse(readFileSync(join(DIR, 'out', 'rescore-2-rows.json'), 'utf8'));

const VEREDITOS = new Set(['Só para casos específicos', 'Vale olhar', 'Esperaria', 'Vale agir', 'Evitaria', 'Não confirmado']);
const OVERRIDES = new Set(['sem_tier1', 'conta_nao_calculavel']);
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function valTuple(r) {
  if (!Number.isInteger(r.tl_score_bruto)) throw new Error(`bruto não-inteiro em ${r.id}`);
  if (!VEREDITOS.has(r.veredito_bruto)) throw new Error(`veredito inesperado em ${r.id}: ${r.veredito_bruto}`);
  const ovr = r.override_aplicado == null ? 'null' : (OVERRIDES.has(r.override_aplicado) ? q(r.override_aplicado) : (() => { throw new Error(`override inesperado ${r.override_aplicado}`); })());
  if (r.versao_pesos !== 'v1') throw new Error(`versao_pesos inesperada em ${r.id}: ${r.versao_pesos}`);
  return `(${q(r.id)}, ${r.tl_score_bruto}, ${q(r.veredito_bruto)}, ${ovr}, ${q(r.versao_pesos)})`;
}

const CHUNK = 700;
mkdirSync(join(DIR, 'out', 'sql-2'), { recursive: true });
let idx = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const slice = rows.slice(i, i + CHUNK);
  const values = slice.map(valTuple).join(',\n  ');
  const sql = `-- RE-SCORE-2 chunk ${String(idx).padStart(2, '0')} · ${slice.length} linhas · idempotente · só identidade_id IS NOT NULL
update campaigns c set
  tl_score_bruto    = v.bruto,
  veredito_bruto    = v.vb,
  override_aplicado = v.ovr,
  versao_pesos      = v.vp
from (values
  ${values}
) as v(id, bruto, vb, ovr, vp)
where c.id = v.id and c.identidade_id is not null;
`;
  writeFileSync(join(DIR, 'out', 'sql-2', `chunk_${String(idx).padStart(2, '0')}.sql`), sql);
  idx++;
}
console.log(`gerados ${idx} chunks (${rows.length} linhas, ${CHUNK}/chunk) em out/sql-2/`);
