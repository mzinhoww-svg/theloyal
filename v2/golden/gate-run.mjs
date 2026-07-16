// Mede o gate contra os 86 rótulos. Camada A (código) + Camada B (passe offline).
//   node v2/golden/gate-run.mjs         -> relatório completo
//   node v2/golden/gate-run.mjs --a     -> só camada A (diagnóstico)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { camadaA, issuersDoSeed } from '../lib/gate.mjs';
import { judgeOffline, CONF_MIN } from '../lib/gate-llm.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const rot = JSON.parse(readFileSync(join(DIR, 'AMOSTRA-100-ROTULADA.json'), 'utf8'));
const seed = JSON.parse(readFileSync(join(DIR, '..', 'db', 'seed-aliases.json'), 'utf8'));
const ISSUERS = issuersDoSeed(seed);
const onlyA = process.argv.includes('--a');

const toInput = (r) => ({
  news_item_id: r.id, titulo: r.input?.titulo || '', trecho: r.input?.trecho || '',
  tipo: r.extracao_atual?.tipo, percentual: r.extracao_atual?.percentual,
  origem: r.extracao_atual?.origem, destino: r.extracao_atual?.destino,
});
const runA = (r) => camadaA(toInput(r), { issuers: ISSUERS });

// ── Camada A sozinha ────────────────────────────────────────────────
if (onlyA) {
  let falsosRejeitos = 0;
  const rejA = [];
  for (const r of rot) {
    const d = runA(r);
    if (d.rejeitado) {
      rejA.push({ id: r.id, motivo: d.motivo, ev: d.evidencia, verdade: r.classe });
      if (r.classe === 'campanha') falsosRejeitos++;
    }
  }
  console.log(`Camada A rejeitou ${rejA.length}. Falsos-rejeitos (campanha real derrubada): ${falsosRejeitos}`);
  for (const x of rejA) console.log(`  ${x.verdade === 'campanha' ? 'XX' : 'ok'} ${x.motivo.padEnd(24)} ${x.id}`);
  const passam = rot.filter((r) => !runA(r).rejeitado);
  console.log(`\nPassam para B: ${passam.length} (${passam.filter((r) => r.classe === 'nao_campanha').length} negativos + ${passam.filter((r) => r.classe === 'campanha').length} campanhas)`);
  for (const r of passam.filter((r) => r.classe === 'nao_campanha')) console.log(`  neg->B  ${r.id}`);
  process.exit(0);
}

// ── Gate completo (A + B) ───────────────────────────────────────────
const decisions = [];
for (const r of rot) {
  const input = toInput(r);
  const a = camadaA(input, { issuers: ISSUERS });
  if (a.rejeitado) { decisions.push({ id: r.id, verdade: r.classe, final: 'rejeitada', camada: 'deterministica', motivo: a.motivo, evidencia: a.evidencia, confidence: null }); continue; }
  const b = judgeOffline(r.id, input);          // veredito da LLM (passe offline)
  if (b.veredito === 'campanha') { decisions.push({ id: r.id, verdade: r.classe, final: 'campanha', camada: 'llm', motivo: null, confidence: b.confidence, flags: b.flags }); continue; }
  // b.veredito === 'rejeitar'
  const status = b.confidence < CONF_MIN ? 'revisao' : 'rejeitada';   // abstenção (D-016)
  decisions.push({ id: r.id, verdade: r.classe, final: status, camada: 'llm', motivo: b.motivo, evidencia: b.evidencia, confidence: b.confidence, flags: b.flags });
}

// ── Métricas ────────────────────────────────────────────────────────
const rejeitadas = decisions.filter((d) => d.final === 'rejeitada');
const revisao = decisions.filter((d) => d.final === 'revisao');
const passaram = decisions.filter((d) => d.final === 'campanha');
const negTotal = rot.filter((r) => r.classe === 'nao_campanha').length;
const campTotal = rot.filter((r) => r.classe === 'campanha').length;

const rejCorretas = rejeitadas.filter((d) => d.verdade === 'nao_campanha').length;
const rejPrecision = rejeitadas.length ? rejCorretas / rejeitadas.length : null;
const rejRecall = rejCorretas / negTotal;
// recall de campanha: campanhas reais que SOBREVIVEM (final != rejeitada). revisão preserva.
const campSobrevive = decisions.filter((d) => d.verdade === 'campanha' && d.final !== 'rejeitada').length;
const campRecall = campSobrevive / campTotal;
const campDerrubada = decisions.filter((d) => d.verdade === 'campanha' && d.final === 'rejeitada');

const porMotivo = {};
for (const d of rejeitadas) porMotivo[d.motivo] = (porMotivo[d.motivo] || 0) + 1;
const porCamada = { deterministica: rejeitadas.filter((d) => d.camada === 'deterministica').length, llm: rejeitadas.filter((d) => d.camada === 'llm').length };

const out = {
  gerado_em: '2026-07-16', total: rot.length, campanhas: campTotal, negativos: negTotal,
  alvo: { rej_precision: 0.90, camp_recall: 0.95, rej_recall_secundario: 0.70 },
  resultado: {
    rejeitadas: rejeitadas.length, em_revisao: revisao.length, passaram_como_campanha: passaram.length,
    rejeicao_precision: round(rejPrecision), rejeicao_recall: round(rejRecall),
    campanha_recall: round(campRecall), campanhas_derrubadas: campDerrubada.map((d) => d.id),
    por_motivo: porMotivo, por_camada: porCamada,
  },
  bate_portao: rejPrecision >= 0.90 && campRecall >= 0.95,
};
// split dos que sobem para B (ambiguo real vs regra determinística faltante)
const foramParaB = decisions.filter((d) => d.camada === 'llm' && d.verdade === 'nao_campanha');
const split = { ambiguo_real: [], regra_faltante: [] };
for (const d of foramParaB) {
  const fl = d.flags || [];
  if (fl.includes('regra_faltante')) split.regra_faltante.push(d.id);
  else split.ambiguo_real.push(d.id);
}
out.resultado.split_camada_b = { ambiguo_real: split.ambiguo_real, regra_faltante: split.regra_faltante };

// lock da camada A (D-017): rejeições determinísticas congeladas p/ não-regressão
const lockA = rot.map((r) => runA(r)).map((d, i) => (d.rejeitado ? { id: rot[i].id, motivo: d.motivo } : null)).filter(Boolean);
out.resultado.deterministicas_travadas = lockA;

writeFileSync(join(DIR, 'GATE-METRICAS.json'), JSON.stringify(out, null, 2));
writeFileSync(join(DIR, 'GATE-A-LOCK.json'), JSON.stringify(lockA, null, 1));
console.log(JSON.stringify(out, null, 2));

// mapa de erros: negativos que escaparam (final=campanha) e revisões
const escaparam = decisions.filter((d) => d.verdade === 'nao_campanha' && d.final === 'campanha');
if (escaparam.length) { console.log('\nNegativos que ESCAPARAM (falso-negativo):'); for (const d of escaparam) console.log(`  ${d.id}  [flags: ${(d.flags || []).join(',')}]`); }
if (revisao.length) { console.log('\nEm revisão (abstenção):'); for (const d of revisao) console.log(`  ${d.verdade === 'campanha' ? 'CAMP' : 'neg '} ${d.id}  ${d.motivo || ''} (conf ${d.confidence})`); }

function round(x) { return x == null ? null : Math.round(x * 1000) / 1000; }
