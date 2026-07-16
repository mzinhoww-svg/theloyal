// Revalidação do golden PÓS-canonicalização (M2 slice 2, medição barata).
// Compara programa(origem+destino) do estado canônico (campaigns.origem_code/destino_code,
// pós-migration 001) contra o mesmo gabarito, e contrasta com a extração crua.
//   node v2/golden/postcanon.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const DIR = dirname(fileURLToPath(import.meta.url));
const SCRATCH = process.env.CANON || '/tmp/claude-0/-home-user-theloyal/c6704681-93f7-5df4-aecd-88b2c17cf278/scratchpad/canon.json';
const rot = JSON.parse(readFileSync(join(DIR, 'AMOSTRA-100-ROTULADA.json'), 'utf8'));
const canon = new Map(JSON.parse(readFileSync(SCRATCH, 'utf8')).map((r) => [r.id, r]));
const SD = 'sem_destino', MC = 'multiplos_cartoes';

// registry canônico -> namespace do gabarito
const ALIAS = { accor: 'all_accor', qatar: 'qatar_privilege', tap_milesgo: 'tap', mastercard: 'surpreenda' };
const norm = (c) => (c == null ? '' : (ALIAS[String(c).toLowerCase()] || String(c).toLowerCase()));
const NO = new Set(['', 'desconhecido', 'null', 'na']);
const isNo = (c) => NO.has(String(c ?? '').toLowerCase());

function cmpOrigem(extr, gab) {
  const e = norm(extr);
  if (gab === null) return isNo(extr) ? 'match' : 'spurious';
  if (gab === MC) return e === MC ? 'match' : 'multi_banco_miss';
  if (isNo(extr)) return 'missed';
  return e === gab ? 'match' : 'wrong';
}
// modo strict: SD exige "sem destino". modo conv: aceita self-loop own-program (destino==origem==gab.origem) como SD.
function cmpDestino(extrDest, extrOrig, gabDest, gabOrig, conv) {
  const ed = norm(extrDest);
  if (gabDest === SD) {
    if (isNo(extrDest)) return 'match';
    if (conv && ed && ed === norm(extrOrig) && ed === gabOrig) return 'match_selfloop';
    return 'spurious';
  }
  if (gabDest === null) return isNo(extrDest) ? 'match' : 'spurious';
  if (isNo(extrDest)) return 'missed';
  return ed === gabDest ? 'match' : 'wrong';
}
function prog(rows, conv) {
  const bag = {};
  const t = (k) => (bag[k] = (bag[k] || 0) + 1);
  for (const r of rows) {
    const c = canon.get(r.id);
    t('O_' + cmpOrigem(c.origem_code, r.gabarito.origem_programa));
    t('D_' + cmpDestino(c.destino_code, c.origem_code, r.gabarito.destino_programa, r.gabarito.origem_programa, conv));
  }
  const s = (ks) => ks.reduce((a, k) => a + (bag[k] || 0), 0);
  const correct = s(['O_match', 'D_match', 'D_match_selfloop']);
  const retrieved = s(['O_match', 'O_wrong', 'O_spurious', 'D_match', 'D_match_selfloop', 'D_wrong', 'D_spurious']);
  const relevant = s(['O_match', 'O_wrong', 'O_missed', 'O_multi_banco_miss', 'D_match', 'D_match_selfloop', 'D_wrong', 'D_missed']);
  return { precision: +(correct / retrieved).toFixed(3), recall: +(correct / relevant).toFixed(3), correct, retrieved, relevant, bag };
}
const camp = rot.filter((r) => r.classe === 'campanha');
console.log('n campanhas:', camp.length);
console.log('\nprograma PÓS-canon (strict, SD exige sem_destino):');
console.log(JSON.stringify(prog(camp, false), null, 0));
console.log('\nprograma PÓS-canon (convenção canônica: self-loop own-program = single-sided):');
console.log(JSON.stringify(prog(camp, true), null, 0));
console.log('\n(referência extração crua: precision 0,704 / recall 0,894)');
