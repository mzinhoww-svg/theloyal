// CALIBRAÇÃO A1 — REVALIDAÇÃO sobre a base corrigida + tratamento de fantasmas de
// percentual. READ-ONLY, mede-e-propõe (D-051/D-052): NÃO grava, NÃO versiona.
// Engine IMPORTADO (zero fork, D-038). Snapshot fresco da base sã atual.
//
// Fantasma = percentual parse-error (bônus de compra/cartão em PONTOS ou teto de
// blog gravado como taxa: >150% implausível; até 120000). Ele (1) infla o próprio
// item (percentil ~1,0) e (2) DEFLACIONA os reais da mesma rota (ECDF empurra todos
// para baixo). Tratamento = TETO de sanidade: percentual > teto → tratado como null
// (fora do percentil E fora do histórico da rota, de-envenenando). É PROPOSTA de
// rótulo; nenhuma escrita aqui.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { montarEntradas } from '../../lib/derivacao.mjs';
import { calcularScore, vereditoDaFaixa } from '../../lib/score.mjs';
import { cpmDeCustoBase } from '../../lib/cpm/custo-base.mjs';
import { rodarGoldenReplay } from '../../M2/rescore/golden-replay.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const SNAP = join(DIR, 'snapshot-corrigida.json');
const routeKey = (c) => `${c.tipo}|${c.origem_code}|${c.destino_code}|${c.publico}`;
const parKey = (o, d) => `${o}|${d}`;
const finite = (x) => { const n = Number(x); return Number.isFinite(n) ? n : null; };
const CAMPOS = ['id', 'tipo', 'origem_code', 'destino_code', 'publico', 'percentual', 'cpm_value', 'tier'];
const linhaObj = (arr) => Object.fromEntries(CAMPOS.map((k, i) => [k, arr[i]]));

function cpmEfetivo(c, custoMoeda, ratioPar) {
  const real = finite(c.cpm_value);
  if (real != null && real > 0) return real;
  if (c.tipo !== 'transferencia') return null;
  const custo = custoMoeda.get(c.origem_code); if (custo == null) return null;
  const ratio = ratioPar.get(parKey(c.origem_code, c.destino_code)); if (ratio == null) return null;
  const p = c.percentual; if (p == null || p === '' || !Number.isFinite(Number(p))) return null;
  return cpmDeCustoBase(custo, Number(p), ratio);
}
function configDoSnap(row) {
  return { versao: row.versao, percentil: { janela: row.percentil_janela, min_samples: row.percentil_min_samples }, eficiencia: { metodo: row.eficiencia_metodo, janela: row.eficiencia_janela }, raridade: { janela: row.raridade_janela, limiares: row.raridade_limiares.map((l) => ({ max: l.max == null ? Infinity : l.max, valor: l.valor })) }, abrangencia: { janela: row.abrangencia_janela, mapa: row.abrangencia_mapa } };
}
function pesosDoSnap(r) { return { versao: r.versao, peso_percentil: +r.peso_percentil, peso_eficiencia: +r.peso_eficiencia, peso_raridade: +r.peso_raridade, peso_abrangencia: +r.peso_abrangencia, shrink_k: +r.shrink_k, min_samples: +r.min_samples }; }
function quantil(s, q) { if (!s.length) return null; const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos); return lo === hi ? s[lo] : s[lo] + (pos - lo) * (s[hi] - s[lo]); }
function disc(v) {
  const s = [...v].sort((a, b) => a - b); const n = s.length; if (!n) return { n: 0 };
  const media = s.reduce((a, b) => a + b, 0) / n;
  const desvio = Math.sqrt(s.reduce((a, b) => a + (b - media) ** 2, 0) / n);
  const cont = new Map(); for (const x of s) cont.set(x, (cont.get(x) || 0) + 1);
  let H = 0; for (const c of cont.values()) { const p = c / n; H -= p * Math.log2(p); }
  const em65 = s.filter((x) => x === 65).length, banda = s.filter((x) => x >= 55 && x <= 69).length;
  const alto = s.filter((x) => x >= 70).length;
  return { n, q1: +quantil(s, 0.25).toFixed(1), mediana: +quantil(s, 0.5).toFixed(1), q3: +quantil(s, 0.75).toFixed(1), iqr: +(quantil(s, 0.75) - quantil(s, 0.25)).toFixed(1), media: +media.toFixed(2), desvio: +desvio.toFixed(2), distintos: cont.size, entropia_bits: +H.toFixed(3), em65, em65_pct: +(100 * em65 / n).toFixed(1), banda_pct: +(100 * banda / n).toFixed(1), alto_ge70: alto, alto_pct: +(100 * alto / n).toFixed(1) };
}

const snap = JSON.parse(readFileSync(SNAP, 'utf8'));
const campanhas = snap.campanhas.map(linhaObj);
const pesos = pesosDoSnap(snap.score_pesos);
const config = configDoSnap(snap.derivacao_config);
const custoMoeda = new Map(snap.custo_base_moeda.filter((m) => m.custo_milheiro != null).map((m) => [m.moeda, +m.custo_milheiro]));
const ratioPar = new Map(snap.custo_base_ratio.filter((r) => r.ratio != null).map((r) => [parKey(r.origem, r.destino), +r.ratio]));

// Duas camadas independentes:
//  - percentual do ITEM (o que vira componente percentil): montarEntradas guarda
//    null corretamente (derivarPercentil), então null = beco. SEMPRE null-preservado.
//  - histórico da ROTA (a população do ECDF de outros itens): AQUI mora o bug do
//    runner de produção — `finite(null)→0` empurra 0, inflando percentil+base_n dos
//    bônus reais. coerce0=true reproduz esse bug; false = correto (null fora).
// O cap de ghost (percentual>teto → null) aplica-se às DUAS camadas.
function rodar(teto, coerce0 = false) {
  const pctItem = new Map();   // percentual do item (null-preservado + cap)
  const pctHist = new Map();   // contribuição ao histórico da rota
  let nNulados = 0;
  for (const c of campanhas) {
    const raw = c.percentual;
    let p = (raw == null || raw === '') ? null : (Number.isFinite(Number(raw)) ? Number(raw) : null);
    if (p != null && p > teto) { p = null; nNulados++; }
    pctItem.set(c.id, p);
    // histórico da rota. Modo bug (coerce0): ghost>teto→null (capado), senão
    // finite(raw) — que transforma null/'' em 0 e empurra. Modo correto: = pctItem.
    if (coerce0) {
      const rawNum = Number(raw);
      const capado = (Number.isFinite(rawNum) && rawNum > teto); // ghost removido
      pctHist.set(c.id, capado ? null : (Number.isFinite(rawNum) ? rawNum : null)); // null/''→0
    } else {
      pctHist.set(c.id, p);
    }
  }
  const rotas = new Map();
  for (const c of campanhas) {
    const k = routeKey(c);
    if (!rotas.has(k)) rotas.set(k, { historico: [], freq: 0 });
    const r = rotas.get(k); r.freq += 1;
    const p = pctHist.get(c.id); if (p != null) r.historico.push(p);
  }
  const pctEf = pctItem;
  const cpmPorId = new Map(campanhas.map((c) => [c.id, cpmEfetivo({ ...c, percentual: pctEf.get(c.id) }, custoMoeda, ratioPar)]));
  const distribuicaoCpm = campanhas.map((c) => cpmPorId.get(c.id)).map(finite).filter((x) => x != null && x > 0);

  const comp = [], conf = [];
  let beco = 0;
  for (const c of campanhas) {
    const k = routeKey(c); const r = rotas.get(k);
    const cpm = cpmPorId.get(c.id);
    const entradas = montarEntradas({ ...c, percentual: pctEf.get(c.id), cpm_value: cpm }, { historicoRota: r.historico, distribuicaoCpm, rota: k, frequencia: r.freq, publico: c.publico }, config);
    const s = calcularScore(entradas, pesos);
    if (s.override_aplicado === 'conta_nao_calculavel') { beco++; continue; }
    comp.push(s.tl_score_bruto);
    if (cpm != null && cpm > 0) conf.push(s.tl_score_bruto);
  }
  return { cenario: `${coerce0 ? 'coerce0(bug-runner)' : 'null-preservado'} · teto=${teto === Infinity ? 'sem' : teto}`, coerce0, teto: teto === Infinity ? 'sem' : teto, ghosts_nulados: nNulados, beco, cpm_pop: distribuicaoCpm.length, computaveis: disc(comp), confirmavel: disc(conf) };
}

const golden = rodarGoldenReplay();
if (!golden.passou) { console.error('golden falhou'); process.exit(1); }
console.log(`[gate] golden ${golden.ok}/${golden.total}`);

const cenarios = [
  rodar(Infinity, true),   // A — reproduz a foto original (bug do runner: null→0)
  rodar(Infinity, false),  // B — null-preservado, sem cap de ghost
  rodar(300, false),       // C — null-preservado + cap 300
  rodar(200, false),       // D — null-preservado + cap 200
  rodar(150, false),       // E — null-preservado + cap 150
];
writeFileSync(join(DIR, 'revalidacao.json'), JSON.stringify({ gerado_em: new Date().toISOString(), base: 'sã corrigida (identidade_id not null)', dry_run: true, gravou: false, golden: `${golden.ok}/${golden.total}`, cenarios }, null, 2));

const fmt = (d) => `Q1 ${d.q1} med ${d.mediana} Q3 ${d.q3} IQR ${d.iqr} σ ${d.desvio} dist ${d.distintos} H ${d.entropia_bits} em65 ${d.em65_pct}% banda ${d.banda_pct}% ≥70 ${d.alto_pct}%`;
console.log('\nCOMPUTÁVEIS:');
for (const c of cenarios) console.log(`  ${c.cenario.padEnd(30)} (nula ${String(c.ghosts_nulados).padStart(3)}, beco ${c.beco}, n=${c.computaveis.n}) ${fmt(c.computaveis)}`);
console.log('\nCONFIRMÁVEL (CPM vivo):');
for (const c of cenarios) console.log(`  ${c.cenario.padEnd(30)} (n=${c.confirmavel.n}) ${fmt(c.confirmavel)}`);
console.log(`\nJSON: ${join(DIR, 'revalidacao.json')}`);
