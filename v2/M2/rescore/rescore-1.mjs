// RE-SCORE-1 sobre a BASE SÃ (D-038 · continuação do dry-run). Adaptação MÍNIMA
// de rescore-dryrun.mjs: a ÚNICA mudança de seleção é filtrar
//   identidade_id IS NOT NULL   (base sã; os 13 self-loops de transferência foram
//   para revisão com identidade_id NULL e ficam FORA do conjunto pontuado).
// Toda a lógica de montarEntradas/calcularScore/baldes/anomalias é IMPORTADA e
// idêntica ao dry-run — zero fork do engine (INV-12). Não inventa dado (INV-03).
//
// Este runner COMPUTA em memória e ESCREVE dois arquivos:
//   out/rescore-1.json        — saída-máquina + relatório (baldes, anomalias, veredito)
//   out/rescore-1-rows.json   — [{id, tl_score_bruto, veredito_bruto, override_aplicado}]
//                               (insumo do passo de GRAVAÇÃO batelado; a gravação
//                                é um 2º passo, só após a trava de anomalia passar)
// NÃO grava na base — a gravação em campaigns é feita à parte, via MCP, sobre este
// arquivo de linhas, e só se a trava de anomalia (D-038) confirmar base limpa.
//
// Leitura via PostgREST com a anon key (SUPABASE_ANON_KEY). score_pesos tem RLS
// que bloqueia anon → a linha do banco vem por SCORE_PESOS_V1_JSON (mesma linha
// do banco, lida por leitura privilegiada). Sem chave → erro explícito.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { montarEntradas } from '../../lib/derivacao.mjs';
import { calcularScore } from '../../lib/score.mjs';
import { rodarGoldenReplay } from './golden-replay.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const URL = (process.env.SUPABASE_URL || 'https://qjqnqcsdnpvvmyzkavoq.supabase.co').replace(/\/$/, '');
const KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const CRAWLAVEIS = new Set(['smiles', 'livelo', 'esfera', 'tap_milesgo']);
const ALTO = 70;

function assertKey() {
  if (!KEY) {
    console.error('Falta SUPABASE_ANON_KEY (ou SERVICE_KEY) no ambiente. Sem chave o runner não lê o banco — não invento dado.');
    process.exit(2);
  }
}

async function rest(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: KEY, authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`REST ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Paginação por Range (PostgREST limita a 1000/página). `extra` = query adicional
// (ex.: filtro identidade_id=not.is.null da BASE SÃ).
async function restAll(table, select, extra = '') {
  const page = 1000;
  let from = 0;
  const out = [];
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
    peso_percentil: Number(row.peso_percentil),
    peso_eficiencia: Number(row.peso_eficiencia),
    peso_raridade: Number(row.peso_raridade),
    peso_abrangencia: Number(row.peso_abrangencia),
    shrink_k: Number(row.shrink_k),
    min_samples: Number(row.min_samples),
  };
}

const routeKey = (c) => `${c.tipo}|${c.origem_code}|${c.destino_code}|${c.publico}`;
const finite = (x) => { const n = Number(x); return Number.isFinite(n) ? n : null; };

function programa(c) {
  if (c.destino_code && c.destino_code !== 'sem_destino') return c.destino_code;
  return c.origem_code || 'desconhecido';
}

async function main() {
  assertKey();
  console.log(`RE-SCORE-1 (BASE SÃ) · lê ${URL} · NÃO grava (gravação é passo 2).\n`);

  // 0) Gate de fidelidade — engine importado reproduz o golden? Se não, PARA.
  const golden = rodarGoldenReplay();
  console.log(`[gate] golden replay (engine importado): ${golden.ok}/${golden.total}`);
  if (!golden.passou) {
    console.error('[gate] FALHOU — engine infiel ao golden. PARANDO (D-038). Nada computado em escala.');
    process.exit(1);
  }

  // 1) Vetores versionados DO BANCO.
  const [pesosRows, derivRows] = await Promise.all([
    rest('score_pesos?versao=eq.v1').catch(() => []),
    rest('derivacao_config?versao=eq.derivacao.v1'),
  ]);
  let pesosRow = pesosRows[0];
  let pesosFonte = 'REST(anon)';
  if (!pesosRow && process.env.SCORE_PESOS_V1_JSON) {
    pesosRow = JSON.parse(process.env.SCORE_PESOS_V1_JSON);
    pesosFonte = 'banco via SCORE_PESOS_V1_JSON (RLS bloqueia anon)';
  }
  if (!pesosRow) throw new Error('score_pesos.v1 ausente (anon RLS bloqueia; passe SCORE_PESOS_V1_JSON com a linha do banco).');
  if (!derivRows.length) throw new Error('derivacao_config.derivacao.v1 ausente no banco.');
  const pesos = pesosDoBanco(pesosRow);
  const config = configDoBanco(derivRows[0]);
  console.log(`[cfg] score_pesos fonte: ${pesosFonte}`);
  console.log(`[cfg] pesos v1 ${pesos.peso_percentil}/${pesos.peso_eficiencia}/${pesos.peso_raridade}/${pesos.peso_abrangencia} shrink_k=${pesos.shrink_k} · derivacao ${config.versao} (raridade n=1→${config.raridade.limiares[0].valor})`);

  // 2) Lê a BASE SÃ: SÓ identidade_id IS NOT NULL (a ÚNICA mudança de seleção).
  //    identidade_id entra no select; o filtro exclui os 13 self-loops de
  //    transferência (que foram para revisão com identidade_id NULL).
  const campanhasRaw = await restAll(
    'campaigns',
    'id,tipo,origem_code,destino_code,publico,percentual,cpm_value,tier,estado,identidade_id',
    '&identidade_id=not.is.null');
  // Defensivo: garante identidade_id não nulo (belt-and-suspenders; o filtro REST já cobre).
  const campanhas = campanhasRaw.filter((c) => c.identidade_id != null);
  console.log(`[db] ${campanhas.length} campanhas na BASE SÃ (identidade_id IS NOT NULL).`);
  if (campanhasRaw.length !== campanhas.length) {
    console.error(`[GUARDA] ${campanhasRaw.length - campanhas.length} linhas com identidade_id nulo escaparam do filtro REST — abortando.`);
    process.exit(3);
  }

  // 3) Contexto de rota + população global de CPM (MONTAGEM de entrada, não score).
  const rotas = new Map();
  for (const c of campanhas) {
    const k = routeKey(c);
    if (!rotas.has(k)) rotas.set(k, { historico: [], freq: 0 });
    const r = rotas.get(k);
    r.freq += 1;
    const p = finite(c.percentual);
    if (p != null) r.historico.push(p);
  }
  const distribuicaoCpm = campanhas.map((c) => finite(c.cpm_value)).filter((x) => x != null && x > 0);
  console.log(`[db] ${rotas.size} rotas distintas · população CPM n=${distribuicaoCpm.length}.`);

  // 4) Pontua cada campanha com o engine IMPORTADO.
  const resultados = [];
  for (const c of campanhas) {
    const k = routeKey(c);
    const r = rotas.get(k);
    const contexto = {
      historicoRota: r.historico,
      distribuicaoCpm,
      rota: k,
      frequencia: r.freq,
      publico: c.publico,
    };
    const entradas = montarEntradas(c, contexto, config);
    const s = calcularScore(entradas, pesos);
    resultados.push({ c, k, s });
  }

  // 5) Classificação dos 4 baldes (por linha) + flags auxiliares.
  const S = CRAWLAVEIS;
  function classificar({ c, s }) {
    const beco = s.override_aplicado === 'conta_nao_calculavel';
    const computavel = !beco;
    const alto = s.tl_score_bruto >= ALTO;
    const temTier1 = Number(c.tier) === 1;
    const alcancavel = S.has(c.origem_code) || S.has(c.destino_code);
    return {
      b1: computavel && alto && !temTier1,
      b2: beco,
      b3: computavel && !alto && !temTier1,
      b4: computavel && alto && alcancavel,
      computavel, alto, temTier1, alcancavel, beco,
      publicavel_agora: computavel && alto && temTier1,
    };
  }
  for (const r of resultados) r.cls = classificar(r);

  const tot = { b1: 0, b2: 0, b3: 0, b4: 0, publicavel_agora: 0 };
  for (const r of resultados) for (const b of ['b1', 'b2', 'b3', 'b4', 'publicavel_agora']) if (r.cls[b]) tot[b]++;

  // 6) Baldes por programa.
  const porPrograma = new Map();
  for (const r of resultados) {
    const p = programa(r.c);
    if (!porPrograma.has(p)) porPrograma.set(p, { n: 0, b1: 0, b2: 0, b3: 0, b4: 0, publicavel_agora: 0 });
    const g = porPrograma.get(p);
    g.n++;
    for (const b of ['b1', 'b2', 'b3', 'b4', 'publicavel_agora']) if (r.cls[b]) g[b]++;
  }

  // 7) ANOMALIAS POR LINHA.
  const anomLinha = { self_loop: [], sem_destino_infla: [], score_extremo_base_alta: [] };
  for (const r of resultados) {
    const { c, s } = r;
    const bd = Object.fromEntries((s.breakdown || []).map((x) => [x.componente, x]));
    if (c.origem_code && c.origem_code === c.destino_code && c.destino_code !== 'sem_destino') {
      if (c.tipo === 'transferencia') {
        anomLinha.self_loop.push({ id: c.id, tipo: c.tipo, rota: r.k, bruto: s.tl_score_bruto, veredito: s.veredito });
      }
    }
    if (c.destino_code === 'sem_destino' && bd.percentil && (bd.percentil.valor_bruto === 0 || bd.percentil.valor_bruto === 1) && (bd.percentil.base_n || 0) >= 10) {
      anomLinha.sem_destino_infla.push({ id: c.id, rota: r.k, percentil_bruto: bd.percentil.valor_bruto, base_n: bd.percentil.base_n, bruto: s.tl_score_bruto });
    }
    if (bd.percentil && (bd.percentil.valor_bruto === 0 || bd.percentil.valor_bruto === 1) && (bd.percentil.base_n || 0) >= 20) {
      anomLinha.score_extremo_base_alta.push({ id: c.id, rota: r.k, percentil_bruto: bd.percentil.valor_bruto, base_n: bd.percentil.base_n, bruto: s.tl_score_bruto });
    }
  }

  // 8) ANOMALIAS POR PROGRAMA (D-038).
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

  // 9) Golden vivo (drift vs PROPOSTA snapshot).
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
      caso,
      esperado_proposta: esperadoProposta[caso],
      vivo_bruto: hit ? hit.s.tl_score_bruto : null,
      vivo_veredito: hit ? hit.s.veredito : null,
      vivo_override: hit ? hit.s.override_aplicado : null,
      id: hit ? hit.c.id : '(não encontrado)',
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
    rescore: 'RE-SCORE-1',
    base: 'sã (identidade_id IS NOT NULL)',
    dry_run: true,
    gravou_na_base: false,
    fidelidade_golden: { ok: golden.ok, total: golden.total, linhas: golden.linhas },
    golden_vivo: goldenVivo,
    vetores: { pesos, derivacao_versao: config.versao, raridade_n1: config.raridade.limiares[0].valor },
    totais: { campanhas: campanhas.length, rotas: rotas.size, cpm_pop: distribuicaoCpm.length },
    baldes_total: tot,
    dist_veredito: distVeredito,
    dist_veredito_bruto: distVereditoBruto,
    dist_override: distOverride,
    baldes_por_programa: [...porPrograma.entries()].map(([p, g]) => ({ programa: p, ...g })).sort((a, b) => b.b4 - a.b4 || b.n - a.n),
    anomalias_por_linha: {
      self_loop_transferencia: anomLinha.self_loop,
      sem_destino_percentil_saturado: anomLinha.sem_destino_infla,
      percentil_saturado_base_alta: anomLinha.score_extremo_base_alta,
    },
    anomalias_por_programa: anomPrograma,
  };

  mkdirSync(join(DIR, 'out'), { recursive: true });
  const outPath = join(DIR, 'out', 'rescore-1.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2));

  // Arquivo de linhas para a GRAVAÇÃO batelada (id → bruto/veredito_bruto/override).
  const rows = resultados.map((r) => ({
    id: r.c.id,
    tl_score_bruto: r.s.tl_score_bruto,
    veredito_bruto: r.s.veredito_bruto,
    override_aplicado: r.s.override_aplicado,
  }));
  const rowsPath = join(DIR, 'out', 'rescore-1-rows.json');
  writeFileSync(rowsPath, JSON.stringify(rows));

  // Resumo humano.
  console.log(`\n=== RE-SCORE-1 (BASE SÃ · nada gravado neste passo) ===`);
  console.log(`campanhas ${out.totais.campanhas} · rotas ${out.totais.rotas} · CPM pop ${out.totais.cpm_pop}`);
  console.log(`\nBaldes (total):`);
  console.log(`  B1 confirmar-fila (alto+computável, só falta TIER 1): ${tot.b1}`);
  console.log(`  B2 beco (conta_nao_calculavel):                        ${tot.b2}`);
  console.log(`  B3 TIER 1 ausente + score baixo:                       ${tot.b3}`);
  console.log(`  B4 alto+computável+alcançável 4 sitemaps (CHAVE):      ${tot.b4}`);
  console.log(`  (já publicável — alto+computável+TIER 1):              ${tot.publicavel_agora}`);
  console.log(`\nDistribuição de veredito (final, pós-override):`);
  for (const [v, n] of Object.entries(distVeredito).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${v}`);
  console.log(`\nDistribuição de veredito_bruto (pré-override):`);
  for (const [v, n] of Object.entries(distVereditoBruto).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${v}`);
  console.log(`\nOverrides aplicados:`);
  for (const [v, n] of Object.entries(distOverride).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${v}`);
  console.log(`\nGolden vivo (drift vs PROPOSTA snapshot):`);
  for (const g of goldenVivo) console.log(`  ${g.caso} prop=${g.esperado_proposta} vivo=${g.vivo_bruto} drift=${g.drift >= 0 ? '+' + g.drift : g.drift}  ${g.vivo_veredito}${g.vivo_override ? ' [' + g.vivo_override + ']' : ''}  (${g.id})`);
  console.log(`\nTop 15 programas por B4:`);
  for (const g of out.baldes_por_programa.slice(0, 15)) console.log(`  ${String(g.b4).padStart(3)} B4 | n=${String(g.n).padStart(4)} b1=${g.b1} b2=${g.b2} b3=${g.b3} pub=${g.publicavel_agora} · ${g.programa}`);
  console.log(`\nAnomalias por linha: self-loop transf=${anomLinha.self_loop.length} · sem_destino percentil saturado=${anomLinha.sem_destino_infla.length} · percentil saturado base>=20=${anomLinha.score_extremo_base_alta.length}`);
  console.log(`Anomalias por PROGRAMA (${anomPrograma.length}):`);
  for (const a of anomPrograma.slice(0, 25)) console.log(`  [${a.eixo}] ${a.programa} (n=${a.n}): ${a.motivos.join(' · ')}`);
  console.log(`\nJSON: ${outPath}`);
  console.log(`Linhas p/ gravação: ${rowsPath} (${rows.length} linhas)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
