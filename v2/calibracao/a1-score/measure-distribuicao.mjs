// CALIBRAÇÃO A1 — medição READ-ONLY da distribuição real do TL Score sobre a BASE SÃ.
// mede-e-propõe (D-051): NÃO grava nada no banco nem em config. Só computa em
// memória e escreve os JSONs de medição sob este diretório.
//
// D-038: IMPORTA o engine testado (montarEntradas ← derivacao.mjs · calcularScore
// ← score.mjs · cpmDeCustoBase ← cpm/custo-base.mjs). ZERO fork. A orquestração
// (route key, população de CPM, cpmEfetivo) é transcrição fiel de rescore-1.mjs /
// rescore-2.mjs — os mesmos runners já aprovados — apenas com relatório mais rico
// (histograma completo, quartis, mediana, empilhamento, poder de discriminação).
//
// Fonte de dados: snapshot.json (leitura MCP SELECT da base sã, sem inventar dado).
// Vetores: os do snapshot = os do banco (score_pesos.v1 · derivacao.v1), conferidos
// live neste turno.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { montarEntradas } from '../../lib/derivacao.mjs';
import { calcularScore, vereditoDaFaixa } from '../../lib/score.mjs';
import { cpmDeCustoBase } from '../../lib/cpm/custo-base.mjs';
import { rodarGoldenReplay } from '../../M2/rescore/golden-replay.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const SNAP = join(DIR, 'snapshot.json');
const CRAWLAVEIS = new Set(['smiles', 'livelo', 'esfera', 'tap_milesgo']);
const ALTO = 70;

const routeKey = (c) => `${c.tipo}|${c.origem_code}|${c.destino_code}|${c.publico}`;
const parKey = (o, d) => `${o}|${d}`;
const finite = (x) => { const n = Number(x); return Number.isFinite(n) ? n : null; };
function programa(c) {
  if (c.destino_code && c.destino_code !== 'sem_destino') return c.destino_code;
  return c.origem_code || 'desconhecido';
}

// CPM VIVO — transcrição fiel de cpmEfetivo() de rescore-2.mjs (importa cpmDeCustoBase).
function cpmEfetivo(c, custoMoeda, ratioPar) {
  const real = finite(c.cpm_value);
  if (real != null && real > 0) return { cpm: real, origem_cpm: 'observado' };
  if (c.tipo !== 'transferencia') return { cpm: c.cpm_value ?? null, origem_cpm: 'nao_transferencia' };
  const custo = custoMoeda.get(c.origem_code);
  if (custo == null) return { cpm: null, origem_cpm: 'null_sem_custo_origem' };
  const ratio = ratioPar.get(parKey(c.origem_code, c.destino_code));
  if (ratio == null) return { cpm: null, origem_cpm: 'null_sem_ratio' };
  const p = c.percentual;
  if (p == null || p === '' || !Number.isFinite(Number(p))) return { cpm: null, origem_cpm: 'null_sem_percentual' };
  const cpm = cpmDeCustoBase(custo, Number(p), ratio);
  if (cpm == null) return { cpm: null, origem_cpm: 'null_calc_invalido' };
  return { cpm, origem_cpm: 'reconstruido' };
}

function configDoSnap(row) {
  return {
    versao: row.versao,
    percentil: { janela: row.percentil_janela, min_samples: row.percentil_min_samples },
    eficiencia: { metodo: row.eficiencia_metodo, janela: row.eficiencia_janela },
    raridade: { janela: row.raridade_janela, limiares: row.raridade_limiares.map((l) => ({ max: l.max == null ? Infinity : l.max, valor: l.valor })) },
    abrangencia: { janela: row.abrangencia_janela, mapa: row.abrangencia_mapa },
  };
}
function pesosDoSnap(row) {
  return { versao: row.versao, peso_percentil: +row.peso_percentil, peso_eficiencia: +row.peso_eficiencia, peso_raridade: +row.peso_raridade, peso_abrangencia: +row.peso_abrangencia, shrink_k: +row.shrink_k, min_samples: +row.min_samples };
}

const CAMPOS = ['id', 'tipo', 'origem_code', 'destino_code', 'publico', 'percentual', 'cpm_value', 'tier'];
const linhaObj = (arr) => Object.fromEntries(CAMPOS.map((k, i) => [k, arr[i]]));

// --- estatística pura -------------------------------------------------------
function quantil(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}
function resumo(valores) {
  const s = [...valores].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return { n: 0 };
  const soma = s.reduce((a, b) => a + b, 0);
  const media = soma / n;
  const varia = s.reduce((a, b) => a + (b - media) ** 2, 0) / n;
  const q1 = quantil(s, 0.25), q2 = quantil(s, 0.5), q3 = quantil(s, 0.75);
  const cont = new Map();
  for (const v of s) cont.set(v, (cont.get(v) || 0) + 1);
  let moda = null, modaN = -1;
  for (const [v, c] of cont) if (c > modaN) { moda = v; modaN = c; }
  let H = 0;
  for (const c of cont.values()) { const p = c / n; H -= p * Math.log2(p); }
  const Hmax = Math.log2(cont.size || 1);
  return {
    n, min: s[0], max: s[n - 1], media: +media.toFixed(2), desvio: +Math.sqrt(varia).toFixed(2),
    q1, mediana: q2, q3, iqr: q3 - q1,
    moda, moda_freq: modaN, moda_pct: +(100 * modaN / n).toFixed(1),
    valores_distintos: cont.size,
    entropia_bits: +H.toFixed(3), entropia_norm: Hmax ? +(H / Hmax).toFixed(3) : 0,
  };
}
function histograma(valores, larg = 5) {
  const bins = new Map();
  for (const v of valores) { const b = Math.floor(v / larg) * larg; bins.set(b, (bins.get(b) || 0) + 1); }
  return [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([lo, n]) => ({ faixa: `${lo}-${lo + larg - 1}`, n }));
}
function contaExata(valores) {
  const c = new Map();
  for (const v of valores) c.set(v, (c.get(v) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]);
}
function bandaVeredito(valores) {
  const b = {};
  for (const v of valores) { const k = vereditoDaFaixa(v); b[k] = (b[k] || 0) + 1; }
  return b;
}

// --- runner -----------------------------------------------------------------
function main() {
  const golden = rodarGoldenReplay();
  if (!golden.passou) { console.error(`[gate] golden ${golden.ok}/${golden.total} FALHOU — engine infiel, PARANDO (D-038).`); process.exit(1); }
  console.log(`[gate] golden replay ${golden.ok}/${golden.total} (engine importado, zero fork).`);

  const snap = JSON.parse(readFileSync(SNAP, 'utf8'));
  const campanhas = snap.campanhas.map(linhaObj);
  const pesos = pesosDoSnap(snap.score_pesos);
  const config = configDoSnap(snap.derivacao_config);
  const custoMoeda = new Map(snap.custo_base_moeda.filter((m) => m.custo_milheiro != null).map((m) => [m.moeda, +m.custo_milheiro]));
  const ratioPar = new Map(snap.custo_base_ratio.filter((r) => r.ratio != null).map((r) => [parKey(r.origem, r.destino), +r.ratio]));
  console.log(`[db] ${campanhas.length} campanhas (base sã) · pesos ${pesos.peso_percentil}/${pesos.peso_eficiencia}/${pesos.peso_raridade}/${pesos.peso_abrangencia} · ${custoMoeda.size} moedas · ${ratioPar.size} ratios.`);

  const rotas = new Map();
  for (const c of campanhas) {
    const k = routeKey(c);
    if (!rotas.has(k)) rotas.set(k, { historico: [], freq: 0 });
    const r = rotas.get(k); r.freq += 1;
    const p = finite(c.percentual); if (p != null) r.historico.push(p);
  }

  function rodar(passe, pesosUsar = pesos) {
    const cpmVivo = passe === 2;
    const cpmInfo = new Map();
    const cpmOrigemDist = {};
    for (const c of campanhas) {
      let info;
      if (cpmVivo) info = cpmEfetivo(c, custoMoeda, ratioPar);
      else { const real = finite(c.cpm_value); info = { cpm: real != null && real > 0 ? real : null, origem_cpm: real > 0 ? 'observado' : 'cego' }; }
      cpmInfo.set(c.id, info);
      cpmOrigemDist[info.origem_cpm] = (cpmOrigemDist[info.origem_cpm] || 0) + 1;
    }
    const distribuicaoCpm = campanhas.map((c) => cpmInfo.get(c.id).cpm).map(finite).filter((x) => x != null && x > 0);

    const resultados = [];
    for (const c of campanhas) {
      const k = routeKey(c);
      const r = rotas.get(k);
      const cpm = cpmInfo.get(c.id).cpm;
      const campanhaComCpm = { ...c, cpm_value: cpm };
      const contexto = { historicoRota: r.historico, distribuicaoCpm, rota: k, frequencia: r.freq, publico: c.publico };
      const entradas = montarEntradas(campanhaComCpm, contexto, config);
      const s = calcularScore(entradas, pesosUsar);
      const beco = s.override_aplicado === 'conta_nao_calculavel';
      resultados.push({ c, k, s, cpm, origem_cpm: cpmInfo.get(c.id).origem_cpm, beco, computavel: !beco });
    }

    const brutosTodos = resultados.map((r) => r.s.tl_score_bruto);
    const comput = resultados.filter((r) => r.computavel);
    const brutosComput = comput.map((r) => r.s.tl_score_bruto);
    const b4 = resultados.filter((r) => {
      const alto = r.s.tl_score_bruto >= ALTO;
      const alcancavel = CRAWLAVEIS.has(r.c.origem_code) || CRAWLAVEIS.has(r.c.destino_code);
      return r.computavel && alto && alcancavel;
    });
    const b4ContaFechada = b4.filter((r) => r.cpm != null && r.cpm > 0);
    const em65 = brutosComput.filter((v) => v === 65).length;
    const bandaNeutra = brutosComput.filter((v) => v >= 55 && v <= 69).length;
    // subconjunto CONFIRMÁVEL: computável + CPM efetivo vivo (conta fechável) — foco D-042
    const conf = comput.filter((r) => r.cpm != null && r.cpm > 0);
    const brutosConf = conf.map((r) => r.s.tl_score_bruto);

    return {
      passe, cpm_vivo: cpmVivo, cpm_origem_dist: cpmOrigemDist, cpm_pop: distribuicaoCpm.length,
      totais: { campanhas: resultados.length, computaveis: comput.length, beco: resultados.length - comput.length, conta_fechada: conf.length },
      resumo_todos: resumo(brutosTodos), resumo_computaveis: resumo(brutosComput), resumo_confirmavel: resumo(brutosConf),
      histograma_computaveis: histograma(brutosComput, 5),
      conta_exata_top: contaExata(brutosComput).slice(0, 20).map(([v, n]) => ({ score: v, n, pct: +(100 * n / brutosComput.length).toFixed(1) })),
      veredito_bruto_computaveis: bandaVeredito(brutosComput),
      empilhamento: {
        em_65: em65, em_65_pct: +(100 * em65 / brutosComput.length).toFixed(1),
        banda_neutra_55_69: bandaNeutra, banda_neutra_pct: +(100 * bandaNeutra / brutosComput.length).toFixed(1),
      },
      b4: { total: b4.length, conta_fechada: b4ContaFechada.length, so_percentil: b4.length - b4ContaFechada.length },
      _resultados: resultados,
    };
  }

  const p1 = rodar(1);
  const p2 = rodar(2);

  const enxuto = (p) => ({ passe: p.passe, cpm_vivo: p.cpm_vivo, cpm_origem_dist: p.cpm_origem_dist, cpm_pop: p.cpm_pop, totais: p.totais, resumo_todos: p.resumo_todos, resumo_computaveis: p.resumo_computaveis, resumo_confirmavel: p.resumo_confirmavel, histograma_computaveis: p.histograma_computaveis, conta_exata_top: p.conta_exata_top, veredito_bruto_computaveis: p.veredito_bruto_computaveis, empilhamento: p.empilhamento, b4: p.b4 });

  const relatorio = { gerado_em: new Date().toISOString(), base: 'sã (identidade_id IS NOT NULL)', dry_run: true, gravou_na_base: false, golden: `${golden.ok}/${golden.total}`, pesos, derivacao: config.versao, rescore_1: enxuto(p1), rescore_2: enxuto(p2) };
  writeFileSync(join(DIR, 'medicao.json'), JSON.stringify(relatorio, null, 2));

  for (const p of [p1, p2]) {
    const R = p.resumo_computaveis, C = p.resumo_confirmavel;
    console.log(`\n=== RE-SCORE-${p.passe} ${p.cpm_vivo ? '(CPM VIVO)' : '(CPM-cego)'} · computáveis n=${R.n} (beco=${p.totais.beco}) ===`);
    console.log(`  CPM pop=${p.cpm_pop} · CPM origem: ${JSON.stringify(p.cpm_origem_dist)}`);
    console.log(`  [computáveis] min ${R.min} · Q1 ${R.q1} · mediana ${R.mediana} · Q3 ${R.q3} · max ${R.max} · IQR ${R.iqr}`);
    console.log(`  [computáveis] media ${R.media} · desvio ${R.desvio} · moda ${R.moda} (${R.moda_pct}%) · distintos ${R.valores_distintos} · entropia_norm ${R.entropia_norm}`);
    console.log(`  [confirmável n=${C.n}] mediana ${C.mediana} · Q1 ${C.q1} · Q3 ${C.q3} · desvio ${C.desvio} · distintos ${C.valores_distintos} · entropia_norm ${C.entropia_norm}`);
    console.log(`  em 65: ${p.empilhamento.em_65} (${p.empilhamento.em_65_pct}%) · banda 55-69: ${p.empilhamento.banda_neutra_55_69} (${p.empilhamento.banda_neutra_pct}%)`);
    console.log(`  B4=${p.b4.total} (conta fechada ${p.b4.conta_fechada} / só-percentil ${p.b4.so_percentil})`);
    console.log(`  veredito_bruto: ${JSON.stringify(p.veredito_bruto_computaveis)}`);
    console.log(`  top valores: ${p.conta_exata_top.slice(0, 10).map((x) => `${x.score}×${x.n}`).join(' ')}`);
  }
  console.log(`\nJSON: ${join(DIR, 'medicao.json')}`);
}

main();
