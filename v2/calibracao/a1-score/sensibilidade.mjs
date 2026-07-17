// CALIBRAÇÃO A1 — sensibilidade READ-ONLY: varre candidatos de vetor (shrink_k,
// pesos) e mede o efeito na DISCRIMINAÇÃO, sobre três lentes:
//   (a) computáveis (n≈1996) — a foto pública
//   (b) percentil base-suficiente (rota com ≥min_samples de %) — onde há sinal real
//   (c) confirmável (CPM efetivo vivo) — o conjunto D-042
// mede-e-propõe (D-051): NÃO grava. Importa o engine (zero fork, D-038). O engine
// lê shrink_k/min_samples/pesos do objeto `pesos` → variar candidato = variar o
// objeto, sem tocar score.mjs.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { montarEntradas } from '../../lib/derivacao.mjs';
import { calcularScore } from '../../lib/score.mjs';
import { cpmDeCustoBase } from '../../lib/cpm/custo-base.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const SNAP = join(DIR, 'snapshot.json');
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
function quantil(s, q) { const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos); return lo === hi ? s[lo] : s[lo] + (pos - lo) * (s[hi] - s[lo]); }
function disc(valores) {
  const s = [...valores].sort((a, b) => a - b); const n = s.length; if (!n) return { n: 0 };
  const media = s.reduce((a, b) => a + b, 0) / n;
  const desvio = Math.sqrt(s.reduce((a, b) => a + (b - media) ** 2, 0) / n);
  const cont = new Map(); for (const v of s) cont.set(v, (cont.get(v) || 0) + 1);
  let H = 0; for (const c of cont.values()) { const p = c / n; H -= p * Math.log2(p); }
  const em65 = s.filter((v) => v === 65).length;
  const banda = s.filter((v) => v >= 55 && v <= 69).length;
  return { n, mediana: +quantil(s, 0.5).toFixed(1), q1: +quantil(s, 0.25).toFixed(1), q3: +quantil(s, 0.75).toFixed(1), iqr: +(quantil(s, 0.75) - quantil(s, 0.25)).toFixed(1), desvio: +desvio.toFixed(2), distintos: cont.size, entropia_bits: +H.toFixed(3), em65, em65_pct: +(100 * em65 / n).toFixed(1), banda_pct: +(100 * banda / n).toFixed(1) };
}

const snap = JSON.parse(readFileSync(SNAP, 'utf8'));
const campanhas = snap.campanhas.map(linhaObj);
const config = configDoSnap(snap.derivacao_config);
const custoMoeda = new Map(snap.custo_base_moeda.filter((m) => m.custo_milheiro != null).map((m) => [m.moeda, +m.custo_milheiro]));
const ratioPar = new Map(snap.custo_base_ratio.filter((r) => r.ratio != null).map((r) => [parKey(r.origem, r.destino), +r.ratio]));
const V1 = { versao: 'v1', peso_percentil: 0.45, peso_eficiencia: 0.30, peso_raridade: 0.15, peso_abrangencia: 0.10, shrink_k: 5, min_samples: 3 };

// contexto de rota (CPM vivo — re-score-2, o cenário relevante p/ calibração)
const rotas = new Map();
for (const c of campanhas) { const k = routeKey(c); if (!rotas.has(k)) rotas.set(k, { historico: [], freq: 0 }); const r = rotas.get(k); r.freq += 1; const p = finite(c.percentual); if (p != null) r.historico.push(p); }
const cpmPorId = new Map(campanhas.map((c) => [c.id, cpmEfetivo(c, custoMoeda, ratioPar)]));
const distribuicaoCpm = campanhas.map((c) => cpmPorId.get(c.id)).map(finite).filter((x) => x != null && x > 0);

function rodarVetor(pesos) {
  const comp = [], baseSuf = [], conf = [];
  for (const c of campanhas) {
    const k = routeKey(c); const r = rotas.get(k);
    const cpm = cpmPorId.get(c.id);
    const contexto = { historicoRota: r.historico, distribuicaoCpm, rota: k, frequencia: r.freq, publico: c.publico };
    const entradas = montarEntradas({ ...c, cpm_value: cpm }, contexto, config);
    const s = calcularScore(entradas, pesos);
    if (s.override_aplicado === 'conta_nao_calculavel') continue; // beco fora
    comp.push(s.tl_score_bruto);
    const pctComp = (s.breakdown || []).find((b) => b.componente === 'percentil');
    if (pctComp && pctComp.base_n != null && pctComp.base_n >= pesos.min_samples) baseSuf.push(s.tl_score_bruto);
    if (cpm != null && cpm > 0) conf.push(s.tl_score_bruto);
  }
  return { computaveis: disc(comp), base_suficiente: disc(baseSuf), confirmavel: disc(conf) };
}

// candidatos: só shrink_k varia (isola o efeito da amortização) + variantes de peso.
const candidatos = [
  { nome: 'v1 (baseline)', pesos: { ...V1 } },
  { nome: 'shrink_k=3', pesos: { ...V1, shrink_k: 3 } },
  { nome: 'shrink_k=2', pesos: { ...V1, shrink_k: 2 } },
  { nome: 'shrink_k=8', pesos: { ...V1, shrink_k: 8 } },
  { nome: 'percentil0.50 efic0.25', pesos: { ...V1, peso_percentil: 0.50, peso_eficiencia: 0.25 } },
  { nome: 'efic0.35 percentil0.40', pesos: { ...V1, peso_percentil: 0.40, peso_eficiencia: 0.35 } },
  { nome: 'raridade0.20 abr0.05', pesos: { ...V1, peso_raridade: 0.20, peso_abrangencia: 0.05 } },
  { nome: 'raridade0.10 percentil0.50', pesos: { ...V1, peso_raridade: 0.10, peso_percentil: 0.50 } },
];

const linhas = candidatos.map((cd) => ({ candidato: cd.nome, pesos: cd.pesos, ...rodarVetor(cd.pesos) }));
writeFileSync(join(DIR, 'sensibilidade.json'), JSON.stringify({ gerado_em: new Date().toISOString(), base: 'sã · CPM vivo (re-score-2)', dry_run: true, linhas }, null, 2));

const fmt = (d) => `med ${d.mediana} IQR ${d.iqr} σ ${d.desvio} dist ${d.distintos} H ${d.entropia_bits} em65 ${d.em65_pct}% banda ${d.banda_pct}%`;
console.log('LENTE (a) COMPUTÁVEIS (n≈1996):');
for (const l of linhas) console.log(`  ${l.candidato.padEnd(28)} ${fmt(l.computaveis)}`);
console.log('\nLENTE (b) PERCENTIL BASE-SUFICIENTE (base_n≥min_samples):');
for (const l of linhas) console.log(`  ${l.candidato.padEnd(28)} n=${l.base_suficiente.n} ${fmt(l.base_suficiente)}`);
console.log('\nLENTE (c) CONFIRMÁVEL (CPM vivo):');
for (const l of linhas) console.log(`  ${l.candidato.padEnd(28)} n=${l.confirmavel.n} ${fmt(l.confirmavel)}`);
console.log(`\nJSON: ${join(DIR, 'sensibilidade.json')}`);
