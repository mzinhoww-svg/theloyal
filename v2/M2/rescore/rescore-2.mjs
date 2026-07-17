// RE-SCORE-2 sobre a BASE SÃ (D-032 · continuação do re-score-1). Adaptação
// MÍNIMA de rescore-1.mjs: a ÚNICA mudança de LÓGICA é o CPM VIVO de
// transferência — para `tipo='transferencia'`, o CPM que alimenta a eficiência
// deixa de ser só `cpm_value` (quase sempre null) e passa a ser reconstruído do
// CUSTO-BASE da moeda de origem × RATIO do par (v2/lib/cpm/custo-base.mjs):
//
//   observado (cpm_value>0) vence; senão cpmDeCustoBase(custo_origem, %, ratio);
//   origem sem custo-base → CPM null (D-035); par sem ratio → CPM null (D-039);
//   NUNCA 1:1 implícito. O CPM efetivo entra em campanha.cpm_value e segue pela
//   MESMA montarEntradas/derivarEficiencia/calcularScore — ZERO fork do engine
//   (INV-12). Não inventa dado (INV-03).
//
// A população de referência da eficiência (ECDF) passa a ser a POPULAÇÃO DE CPM
// EFETIVO (observados + reconstruídos): no re-score-1 ela tinha n=10 (quase só
// null) e a eficiência era inócua; agora é uma distribuição real.
//
// Fonte de dados: SUPABASE_ANON_KEY (REST) se houver; senão um SNAPSHOT local
// (RESCORE_SNAPSHOT, default out/snapshot.json) produzido por leitura via MCP —
// os MESMOS dados do banco, sem inventar. NÃO grava na base: a gravação é passo 2
// (via MCP UPDATE batelado), só após a trava de anomalia (D-038) confirmar limpo.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { montarEntradas } from '../../lib/derivacao.mjs';
import { calcularScore } from '../../lib/score.mjs';
import { cpmDeCustoBase } from '../../lib/cpm/custo-base.mjs';
import { rodarGoldenReplay } from './golden-replay.mjs';
import { rodarGoldenCpm } from './golden-cpm.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const URL = (process.env.SUPABASE_URL || 'https://qjqnqcsdnpvvmyzkavoq.supabase.co').replace(/\/$/, '');
const KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SNAP = process.env.RESCORE_SNAPSHOT || join(DIR, 'out', 'snapshot.json');

const CRAWLAVEIS = new Set(['smiles', 'livelo', 'esfera', 'tap_milesgo']);
const ALTO = 70;

async function rest(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  if (!res.ok) throw new Error(`REST ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function restAll(table, select, extra = '') {
  const page = 1000; let from = 0; const out = [];
  for (;;) {
    const res = await fetch(`${URL}/rest/v1/${table}?select=${select}${extra}`, {
      headers: { apikey: KEY, authorization: `Bearer ${KEY}`, Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) throw new Error(`REST ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < page) break;
    from += page;
  }
  return out;
}

function configDoBanco(row) {
  return {
    versao: row.versao,
    percentil: { janela: row.percentil_janela, min_samples: row.percentil_min_samples },
    eficiencia: { metodo: row.eficiencia_metodo, janela: row.eficiencia_janela },
    raridade: {
      janela: row.raridade_janela,
      limiares: row.raridade_limiares.map((l) => ({ max: l.max == null ? Infinity : l.max, valor: l.valor })),
    },
    abrangencia: { janela: row.abrangencia_janela, mapa: row.abrangencia_mapa },
  };
}
function pesosDoBanco(row) {
  return {
    versao: row.versao,
    peso_percentil: Number(row.peso_percentil), peso_eficiencia: Number(row.peso_eficiencia),
    peso_raridade: Number(row.peso_raridade), peso_abrangencia: Number(row.peso_abrangencia),
    shrink_k: Number(row.shrink_k), min_samples: Number(row.min_samples),
  };
}

const routeKey = (c) => `${c.tipo}|${c.origem_code}|${c.destino_code}|${c.publico}`;
// BUG (fix desta rodada): Number(null) === 0, então a versão antiga desta função
// devolvia 0 para percentual/cpm ausente — o guard `!= null` a jusante não pegava
// isso, e o 0 falso entrava no historico da rota (ECDF). null/undefined tratados
// ANTES da coerção, para nunca virar 0 por acidente (mesmo espírito do INV-03
// já documentado no comentário de cpmEfetivo acima).
const finite = (x) => { if (x == null) return null; const n = Number(x); return Number.isFinite(n) ? n : null; };
const parKey = (o, d) => `${o}|${d}`;
function programa(c) {
  if (c.destino_code && c.destino_code !== 'sem_destino') return c.destino_code;
  return c.origem_code || 'desconhecido';
}

// ---------------------------------------------------------------------------
// CPM VIVO de transferência (D-032/D-035/D-039). Retorna {cpm, origem_cpm}.
//   origem_cpm ∈ observado | reconstruido | null_sem_custo_origem |
//               null_sem_ratio | null_sem_percentual | nao_transferencia
// Contrato travado: par sem ratio (ausente OU null) ⇒ NÃO chama cpmDeCustoBase,
// CPM null (nunca 1:1). Origem sem custo-base ⇒ CPM null (D-035). Percentual
// ausente/não-finito ⇒ CPM null (bônus é fator; não coage null→0, INV-03).
// ---------------------------------------------------------------------------
function cpmEfetivo(c, custoMoeda, ratioPar) {
  const real = finite(c.cpm_value);
  if (real != null && real > 0) return { cpm: real, origem_cpm: 'observado' };
  if (c.tipo !== 'transferencia') return { cpm: c.cpm_value ?? null, origem_cpm: 'nao_transferencia' };

  const custo = custoMoeda.get(c.origem_code);
  if (custo == null) return { cpm: null, origem_cpm: 'null_sem_custo_origem' };

  const ratio = ratioPar.get(parKey(c.origem_code, c.destino_code));
  if (ratio == null) return { cpm: null, origem_cpm: 'null_sem_ratio' }; // D-039: ausente OU null

  const p = c.percentual;
  if (p == null || p === '' || !Number.isFinite(Number(p))) {
    return { cpm: null, origem_cpm: 'null_sem_percentual' }; // bônus é fator; não chuta 0
  }
  const cpm = cpmDeCustoBase(custo, Number(p), ratio); // helper EXIGE ratio (sem default)
  if (cpm == null) return { cpm: null, origem_cpm: 'null_calc_invalido' };
  return { cpm, origem_cpm: 'reconstruido' };
}

// ---------------------------------------------------------------------------
// Carregamento de dados: REST (se ANON_KEY) ou SNAPSHOT local (leitura MCP).
// Snapshot compacto: campanhas como array-de-arrays [id,tipo,origem,destino,
// publico,percentual,cpm_value,tier]; tabelas de custo-base e vetores idem banco.
// ---------------------------------------------------------------------------
const CAMPOS = ['id', 'tipo', 'origem_code', 'destino_code', 'publico', 'percentual', 'cpm_value', 'tier'];
function linhaParaObj(arr) { const o = {}; CAMPOS.forEach((k, i) => (o[k] = arr[i])); return o; }

async function carregarDados() {
  if (KEY) {
    const [pesosRows, derivRows, moedas, ratios] = await Promise.all([
      rest('score_pesos?versao=eq.v1').catch(() => []),
      rest('derivacao_config?versao=eq.derivacao.v1'),
      rest('custo_base_moeda?select=moeda,custo_milheiro'),
      rest('custo_base_ratio?select=origem,destino,ratio'),
    ]);
    let pesosRow = pesosRows[0];
    if (!pesosRow && process.env.SCORE_PESOS_V1_JSON) pesosRow = JSON.parse(process.env.SCORE_PESOS_V1_JSON);
    if (!pesosRow) throw new Error('score_pesos.v1 ausente (anon RLS; passe SCORE_PESOS_V1_JSON).');
    if (!derivRows.length) throw new Error('derivacao_config.derivacao.v1 ausente no banco.');
    const campanhas = await restAll('campaigns', CAMPOS.join(','), '&identidade_id=not.is.null');
    return { fonte: 'REST(anon)', campanhas, pesosRow, derivRow: derivRows[0], moedas, ratios };
  }
  if (!existsSync(SNAP)) {
    console.error(`Sem SUPABASE_ANON_KEY e sem snapshot em ${SNAP}. Sem dado o runner não pontua (INV-03).`);
    process.exit(2);
  }
  const s = JSON.parse(readFileSync(SNAP, 'utf8'));
  const campanhas = s.campanhas.map(linhaParaObj);
  return {
    fonte: `SNAPSHOT ${SNAP} (leitura MCP do banco)`,
    campanhas, pesosRow: s.score_pesos, derivRow: s.derivacao_config,
    moedas: s.custo_base_moeda, ratios: s.custo_base_ratio,
  };
}

async function main() {
  console.log(`RE-SCORE-2 (BASE SÃ · CPM VIVO) · NÃO grava (gravação é passo 2).\n`);

  // 0) GATE de fidelidade BLOQUEANTE: golden 6/6 (engine) + golden CPM vivo 2/2.
  const golden = rodarGoldenReplay();
  console.log(`[gate] golden replay 6/6 (engine importado): ${golden.ok}/${golden.total}`);
  if (!golden.passou) { console.error('[gate] golden 6/6 FALHOU — PARANDO (D-038).'); process.exit(1); }
  const goldenCpm = rodarGoldenCpm();
  console.log(`[gate] golden CPM vivo (custo-base×ratio): ${goldenCpm.ok}/${goldenCpm.total}`);
  for (const l of goldenCpm.linhas) console.log(`        ${l.bateu ? 'OK' : 'XX'} ${l.caso} ${l.detalhe}`);
  if (!goldenCpm.passou) { console.error('[gate] golden CPM vivo FALHOU — caminho novo infiel, PARANDO (D-032/D-039).'); process.exit(1); }

  // 1) Dados + vetores.
  const { fonte, campanhas: campanhasRaw, pesosRow, derivRow, moedas, ratios } = await carregarDados();
  const pesos = pesosDoBanco(pesosRow);
  const config = configDoBanco(derivRow);
  console.log(`[cfg] fonte de dados: ${fonte}`);
  console.log(`[cfg] pesos v1 ${pesos.peso_percentil}/${pesos.peso_eficiencia}/${pesos.peso_raridade}/${pesos.peso_abrangencia} shrink_k=${pesos.shrink_k} · derivacao ${config.versao} (raridade n=1→${config.raridade.limiares[0].valor})`);

  // BLINDAGEM (vetor stale): raridade n=1 DEVE ser 0.85 (D-037). Senão ABORTA.
  const raridadeN1 = config.raridade.limiares[0].valor;
  if (raridadeN1 !== 0.85) {
    console.error(`[GUARDA D-037] raridade n=1 = ${raridadeN1} (esperado 0.85). Vetor STALE — ABORTANDO, nada computado.`);
    process.exit(4);
  }
  console.log(`[guarda] raridade n=1 === 0.85 (D-037): OK`);

  // Base sã defensiva.
  const campanhas = campanhasRaw.filter((c) => c.id != null);
  console.log(`[db] ${campanhas.length} campanhas na BASE SÃ.`);

  // Tabelas de custo-base → Maps.
  const custoMoeda = new Map(moedas.filter((m) => m.custo_milheiro != null).map((m) => [m.moeda, Number(m.custo_milheiro)]));
  const ratioPar = new Map(ratios.filter((r) => r.ratio != null).map((r) => [parKey(r.origem, r.destino), Number(r.ratio)]));
  console.log(`[cpm] custo-base: ${custoMoeda.size} moedas · ${ratioPar.size} ratios não-nulos.`);

  // 2) CPM VIVO por campanha (antes da montagem de entradas).
  const cpmInfo = new Map();
  const cpmOrigemDist = {};
  for (const c of campanhas) {
    const info = cpmEfetivo(c, custoMoeda, ratioPar);
    cpmInfo.set(c.id, info);
    cpmOrigemDist[info.origem_cpm] = (cpmOrigemDist[info.origem_cpm] || 0) + 1;
  }

  // 3) Contexto de rota + população de CPM EFETIVO (a mudança-chave da eficiência).
  const rotas = new Map();
  for (const c of campanhas) {
    const k = routeKey(c);
    if (!rotas.has(k)) rotas.set(k, { historico: [], freq: 0 });
    const r = rotas.get(k);
    r.freq += 1;
    const p = finite(c.percentual);
    if (p != null) r.historico.push(p);
  }
  const distribuicaoCpm = campanhas
    .map((c) => cpmInfo.get(c.id).cpm)
    .map(finite)
    .filter((x) => x != null && x > 0);
  console.log(`[db] ${rotas.size} rotas distintas · população CPM EFETIVO n=${distribuicaoCpm.length} (re-score-1 usava n=10).`);

  // 4) Pontua com o engine IMPORTADO — CPM efetivo entra em cpm_value.
  const resultados = [];
  for (const c of campanhas) {
    const k = routeKey(c);
    const r = rotas.get(k);
    const cpm = cpmInfo.get(c.id).cpm;
    const campanhaComCpm = { ...c, cpm_value: cpm }; // só troca a ENTRADA; engine intacto
    const contexto = { historicoRota: r.historico, distribuicaoCpm, rota: k, frequencia: r.freq, publico: c.publico };
    const entradas = montarEntradas(campanhaComCpm, contexto, config);
    const s = calcularScore(entradas, pesos);
    resultados.push({ c, k, s, cpm, origem_cpm: cpmInfo.get(c.id).origem_cpm });
  }

  // 5) Baldes por linha.
  const S = CRAWLAVEIS;
  function classificar({ c, s }) {
    const beco = s.override_aplicado === 'conta_nao_calculavel';
    const computavel = !beco;
    const alto = s.tl_score_bruto >= ALTO;
    const temTier1 = Number(c.tier) === 1;
    const alcancavel = S.has(c.origem_code) || S.has(c.destino_code);
    return {
      b1: computavel && alto && !temTier1, b2: beco, b3: computavel && !alto && !temTier1,
      b4: computavel && alto && alcancavel,
      computavel, alto, temTier1, alcancavel, beco, publicavel_agora: computavel && alto && temTier1,
    };
  }
  for (const r of resultados) r.cls = classificar(r);

  const tot = { b1: 0, b2: 0, b3: 0, b4: 0, publicavel_agora: 0 };
  for (const r of resultados) for (const b of ['b1', 'b2', 'b3', 'b4', 'publicavel_agora']) if (r.cls[b]) tot[b]++;

  // 5b) ASSINATURA do B4: conta fechada (CPM efetivo não-null) vs só-percentil (CPM null).
  const b4 = resultados.filter((r) => r.cls.b4);
  const b4ContaFechada = b4.filter((r) => r.cpm != null && r.cpm > 0);
  const b4SoPercentil = b4.filter((r) => r.cpm == null || !(r.cpm > 0));
  const assinaturaPorPrograma = new Map();
  for (const r of b4) {
    const p = programa(r.c);
    if (!assinaturaPorPrograma.has(p)) assinaturaPorPrograma.set(p, { conta_fechada: 0, so_percentil: 0 });
    const g = assinaturaPorPrograma.get(p);
    if (r.cpm != null && r.cpm > 0) g.conta_fechada++; else g.so_percentil++;
  }

  // 6) Baldes por programa + composição do B4 (ids p/ diff vs re-score-1).
  const porPrograma = new Map();
  const b4IdsPorPrograma = new Map();
  for (const r of resultados) {
    const p = programa(r.c);
    if (!porPrograma.has(p)) porPrograma.set(p, { n: 0, b1: 0, b2: 0, b3: 0, b4: 0, publicavel_agora: 0 });
    const g = porPrograma.get(p);
    g.n++;
    for (const b of ['b1', 'b2', 'b3', 'b4', 'publicavel_agora']) if (r.cls[b]) g[b]++;
    if (r.cls.b4) { if (!b4IdsPorPrograma.has(p)) b4IdsPorPrograma.set(p, []); b4IdsPorPrograma.get(p).push(r.c.id); }
  }

  // 7) Anomalias por linha.
  const anomLinha = { self_loop: [], sem_destino_infla: [], score_extremo_base_alta: [] };
  for (const r of resultados) {
    const { c, s } = r;
    const bd = Object.fromEntries((s.breakdown || []).map((x) => [x.componente, x]));
    if (c.origem_code && c.origem_code === c.destino_code && c.destino_code !== 'sem_destino' && c.tipo === 'transferencia') {
      anomLinha.self_loop.push({ id: c.id, tipo: c.tipo, rota: r.k, bruto: s.tl_score_bruto, veredito: s.veredito });
    }
    if (c.destino_code === 'sem_destino' && bd.percentil && (bd.percentil.valor_bruto === 0 || bd.percentil.valor_bruto === 1) && (bd.percentil.base_n || 0) >= 10) {
      anomLinha.sem_destino_infla.push({ id: c.id, rota: r.k, percentil_bruto: bd.percentil.valor_bruto, base_n: bd.percentil.base_n, bruto: s.tl_score_bruto });
    }
    if (bd.percentil && (bd.percentil.valor_bruto === 0 || bd.percentil.valor_bruto === 1) && (bd.percentil.base_n || 0) >= 20) {
      anomLinha.score_extremo_base_alta.push({ id: c.id, rota: r.k, percentil_bruto: bd.percentil.valor_bruto, base_n: bd.percentil.base_n, bruto: s.tl_score_bruto });
    }
  }

  // 8) Anomalias por PROGRAMA (D-038).
  function anomaliasPorEixo(eixoFn, nomeEixo) {
    const grupos = new Map();
    for (const r of resultados) {
      const key = eixoFn(r.c);
      if (!key) continue;
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push(r);
    }
    const flags = [];
    for (const [key, arr] of grupos) {
      const n = arr.length;
      if (n < 5) continue;
      const beco = arr.filter((r) => r.cls.beco).length;
      const comput = arr.filter((r) => r.cls.computavel);
      const semDestino = arr.filter((r) => r.c.destino_code === 'sem_destino').length;
      const brutos = comput.map((r) => r.s.tl_score_bruto);
      const distintos = new Set(brutos).size;
      const altos = comput.filter((r) => r.s.tl_score_bruto >= 85).length;
      const motivos = [];
      if (beco / n >= 0.9) motivos.push(`beco_quase_total ${beco}/${n}`);
      if (comput.length >= 5 && distintos <= 1) motivos.push(`score_identico (${distintos} valor distinto em ${comput.length} computáveis: ${brutos[0]})`);
      if (comput.length >= 5 && altos / comput.length >= 0.9) motivos.push(`tudo_alto (${altos}/${comput.length} Vale agir)`);
      if (nomeEixo === 'origem' && semDestino / n >= 0.8) motivos.push(`destino_nunca_resolvido ${semDestino}/${n} sem_destino`);
      if (motivos.length) flags.push({ eixo: nomeEixo, programa: key, n, beco, computaveis: comput.length, scores_distintos: distintos, motivos });
    }
    return flags.sort((a, b) => b.n - a.n);
  }
  const anomPrograma = [
    ...anomaliasPorEixo((c) => c.destino_code, 'destino'),
    ...anomaliasPorEixo((c) => c.origem_code, 'origem'),
  ];

  // 9) Golden vivo (drift vs PROPOSTA snapshot) — informativo.
  const alvos = {
    A: (r) => r.c.id === 'livelo-azul-transferencia-2026-07-05',
    B: (r) => r.c.id === 'bancos-smiles-transferencia-2026-07-10',
    C: (r) => r.c.tipo === 'transferencia' && r.c.origem_code === 'itau' && r.c.destino_code === 'latam_pass' && r.c.publico === 'geral' && Number(r.c.percentual) === 40,
    D: (r) => r.c.tipo === 'transferencia' && r.c.origem_code === 'itau' && r.c.destino_code === 'latam_pass' && r.c.publico === 'geral' && Number(r.c.percentual) === 25,
    E: (r) => r.c.id === 'livelo-connectmiles-transferencia-2026-07-12',
    F: (r) => r.c.id === 'accor-accor-clube-na',
  };
  const esperadoProposta = { A: 77, B: 59, C: 79, D: 37, E: 44, F: 27 };
  const goldenVivo = [];
  for (const [caso, pred] of Object.entries(alvos)) {
    const hit = resultados.find(pred);
    goldenVivo.push({
      caso, esperado_proposta: esperadoProposta[caso],
      vivo_bruto: hit ? hit.s.tl_score_bruto : null, vivo_veredito: hit ? hit.s.veredito : null,
      vivo_override: hit ? hit.s.override_aplicado : null, vivo_cpm: hit ? hit.cpm : null,
      vivo_origem_cpm: hit ? hit.origem_cpm : null, id: hit ? hit.c.id : '(não encontrado)',
      drift: hit ? hit.s.tl_score_bruto - esperadoProposta[caso] : null,
    });
  }

  const distVeredito = {};
  for (const r of resultados) distVeredito[r.s.veredito] = (distVeredito[r.s.veredito] || 0) + 1;
  const distVereditoBruto = {};
  for (const r of resultados) distVereditoBruto[r.s.veredito_bruto] = (distVereditoBruto[r.s.veredito_bruto] || 0) + 1;
  const distOverride = {};
  for (const r of resultados) { const o = r.s.override_aplicado || '(nenhum)'; distOverride[o] = (distOverride[o] || 0) + 1; }

  const out = {
    gerado_em: new Date().toISOString(),
    rescore: 'RE-SCORE-2',
    base: 'sã (identidade_id IS NOT NULL)',
    dry_run: true, gravou_na_base: false,
    cpm_vivo: true,
    fidelidade_golden: { engine_6: { ok: golden.ok, total: golden.total }, cpm_vivo_2: { ok: goldenCpm.ok, total: goldenCpm.total, linhas: goldenCpm.linhas } },
    golden_vivo: goldenVivo,
    vetores: { pesos, derivacao_versao: config.versao, raridade_n1: raridadeN1 },
    totais: { campanhas: campanhas.length, rotas: rotas.size, cpm_pop_efetivo: distribuicaoCpm.length },
    cpm_origem_dist: cpmOrigemDist,
    baldes_total: tot,
    b4_assinatura: {
      total: b4.length,
      conta_fechada: b4ContaFechada.length,
      so_percentil: b4SoPercentil.length,
      por_programa: [...assinaturaPorPrograma.entries()].map(([p, g]) => ({ programa: p, ...g })).sort((a, b) => (b.conta_fechada + b.so_percentil) - (a.conta_fechada + a.so_percentil)),
    },
    dist_veredito: distVeredito,
    dist_veredito_bruto: distVereditoBruto,
    dist_override: distOverride,
    baldes_por_programa: [...porPrograma.entries()].map(([p, g]) => ({ programa: p, ...g })).sort((a, b) => b.b4 - a.b4 || b.n - a.n),
    b4_ids_por_programa: [...b4IdsPorPrograma.entries()].map(([p, ids]) => ({ programa: p, ids })),
    anomalias_por_linha: {
      self_loop_transferencia: anomLinha.self_loop,
      sem_destino_percentil_saturado: anomLinha.sem_destino_infla,
      percentil_saturado_base_alta: anomLinha.score_extremo_base_alta,
    },
    anomalias_por_programa: anomPrograma,
  };

  mkdirSync(join(DIR, 'out'), { recursive: true });
  writeFileSync(join(DIR, 'out', 'rescore-2.json'), JSON.stringify(out, null, 2));
  const rows = resultados.map((r) => ({
    id: r.c.id, tl_score_bruto: r.s.tl_score_bruto, veredito_bruto: r.s.veredito_bruto,
    override_aplicado: r.s.override_aplicado, versao_pesos: r.s.versao_pesos,
  }));
  writeFileSync(join(DIR, 'out', 'rescore-2-rows.json'), JSON.stringify(rows));

  // Resumo humano.
  console.log(`\n=== RE-SCORE-2 (BASE SÃ · CPM VIVO · nada gravado neste passo) ===`);
  console.log(`campanhas ${out.totais.campanhas} · rotas ${out.totais.rotas} · CPM pop efetivo ${out.totais.cpm_pop_efetivo}`);
  console.log(`\nCPM origem (transferências e não-transf):`);
  for (const [k, v] of Object.entries(cpmOrigemDist).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`);
  console.log(`\nBaldes (total): B1=${tot.b1} B2=${tot.b2} B3=${tot.b3} B4=${tot.b4} pub=${tot.publicavel_agora}`);
  console.log(`\nB4 ASSINATURA: total ${b4.length} · conta fechada (CPM efetivo) ${b4ContaFechada.length} · só-percentil (CPM null) ${b4SoPercentil.length}`);
  for (const g of out.b4_assinatura.por_programa) console.log(`  ${g.programa}: conta_fechada=${g.conta_fechada} so_percentil=${g.so_percentil}`);
  console.log(`\nDistribuição veredito_bruto:`);
  for (const [v, n] of Object.entries(distVereditoBruto).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${v}`);
  console.log(`\nGolden vivo (drift vs PROPOSTA):`);
  for (const g of goldenVivo) console.log(`  ${g.caso} prop=${g.esperado_proposta} vivo=${g.vivo_bruto} drift=${g.drift >= 0 ? '+' + g.drift : g.drift} cpm=${g.vivo_cpm}[${g.vivo_origem_cpm}] ${g.vivo_veredito}${g.vivo_override ? ' [' + g.vivo_override + ']' : ''} (${g.id})`);
  console.log(`\nTop 15 programas por B4:`);
  for (const g of out.baldes_por_programa.slice(0, 15)) console.log(`  ${String(g.b4).padStart(3)} B4 | n=${String(g.n).padStart(4)} b1=${g.b1} b2=${g.b2} b3=${g.b3} · ${g.programa}`);
  console.log(`\nAnomalias por linha: self-loop=${anomLinha.self_loop.length} · sem_destino sat=${anomLinha.sem_destino_infla.length} · percentil sat base>=20=${anomLinha.score_extremo_base_alta.length}`);
  console.log(`Anomalias por PROGRAMA (${anomPrograma.length}):`);
  for (const a of anomPrograma.slice(0, 30)) console.log(`  [${a.eixo}] ${a.programa} (n=${a.n}): ${a.motivos.join(' · ')}`);
  console.log(`\nJSON: ${join(DIR, 'out', 'rescore-2.json')}`);
  console.log(`Linhas p/ gravação: ${join(DIR, 'out', 'rescore-2-rows.json')} (${rows.length} linhas)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
