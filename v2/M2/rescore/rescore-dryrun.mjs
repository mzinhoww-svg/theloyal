// Re-score runner — DRY-RUN (D-038). NÃO grava nada. Lê a base inteira, monta as
// entradas e pontua com o MESMO engine testado — IMPORTADO, nunca uma cópia:
//   montarEntradas  ← ../../lib/derivacao.mjs   (derivação pura, DERIVACAO_V1)
//   calcularScore   ← ../../lib/score.mjs       (engine puro, SLICE-4)
// Os vetores (score_pesos.v1, derivacao_config.derivacao.v1) são LIDOS DO BANCO.
// O runner só orquestra: lê o dado, agrupa por rota, chama as funções, coleta.
//
// TRAVA: dry-run. Computa em memória, classifica os 4 baldes por programa e
// levanta anomalias por linha E por programa. NÃO escreve tl_score_bruto/
// veredito/override na base. A gravação é um 2º passo, só após revisão humana.
//
// Leitura via PostgREST com a anon key (política de leitura pública em campaigns/
// score_pesos/derivacao_config). Sem credencial → erro explícito (não inventa).
//   SUPABASE_URL       (default: projeto the-loyalty)
//   SUPABASE_ANON_KEY  | SUPABASE_SERVICE_KEY | SUPABASE_SERVICE_ROLE_KEY

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { montarEntradas } from '../../lib/derivacao.mjs';
import { calcularScore } from '../../lib/score.mjs';
import { rodarGoldenReplay } from './golden-replay.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const URL = (process.env.SUPABASE_URL || 'https://qjqnqcsdnpvvmyzkavoq.supabase.co').replace(/\/$/, '');
const KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Programas com sitemap próprio (adapters M2): confirmam TIER 1 crawlando o
// próprio site. Uma campanha é "alcançável" se origem OU destino é um deles.
const CRAWLAVEIS = new Set(['smiles', 'livelo', 'esfera', 'tap_milesgo']);
const ALTO = 70; // "score alto" = Vale olhar+ (bruto >= 70), pela régua do engine.

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

// Paginação por Range (PostgREST limita a 1000/página).
async function restAll(table, select) {
  const page = 1000;
  let from = 0;
  const out = [];
  for (;;) {
    const res = await fetch(`${URL}/rest/v1/${table}?select=${select}`, {
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

// Espelha uma linha de derivacao_config no shape que DERIVACAO_V1 usa (null→Infinity).
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
  // Programa de crédito = destino; quando o destino não foi resolvido, cai no origem.
  if (c.destino_code && c.destino_code !== 'sem_destino') return c.destino_code;
  return c.origem_code || 'desconhecido';
}

async function main() {
  assertKey();
  console.log(`Re-score DRY-RUN · lê ${URL} · nada é gravado.\n`);

  // 0) Gate de fidelidade — engine importado reproduz o golden? Se não, PARA.
  const golden = rodarGoldenReplay();
  console.log(`[gate] golden replay (engine importado): ${golden.ok}/${golden.total}`);
  if (!golden.passou) {
    console.error('[gate] FALHOU — engine infiel ao golden. PARANDO (D-038). Nada computado em escala.');
    process.exit(1);
  }

  // 1) Lê vetores versionados DO BANCO (não do código).
  //    score_pesos tem RLS mais restrito que derivacao_config: a anon key não
  //    enxerga as linhas (retorna []). Fallback: a linha do banco injetada via
  //    env SCORE_PESOS_V1_JSON (extraída do MESMO banco por leitura privilegiada
  //    — MCP/service). Continua sendo o vetor do banco, não um chute de código.
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

  // 2) Lê a base inteira.
  const campanhas = await restAll('campaigns', 'id,tipo,origem_code,destino_code,publico,percentual,cpm_value,tier,estado');
  console.log(`[db] ${campanhas.length} campanhas lidas.`);

  // 3) Monta contexto de rota (histórico de percentual + frequência) e a
  //    população global de CPM. Isto é MONTAGEM de entrada, não score.
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
      // tem_tier1 NÃO é passado: campanha_fontes está vazia hoje, então o engine
      // usa Number(campanha.tier)===1 (como o golden). Quando campanha_fontes
      // encher, tem_tier1 deve vir de lá (INV-02) — dívida registrada no relatório.
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
      b1: computavel && alto && !temTier1,          // passaria os 2 portões se TIER 1 (só falta fonte)
      b2: beco,                                      // beco conta_nao_calculavel
      b3: computavel && !alto && !temTier1,          // TIER 1 ausente mas score baixo
      b4: computavel && alto && alcancavel,          // alto + computável + alcançável pelos 4 sitemaps (NÚMERO-CHAVE)
      computavel, alto, temTier1, alcancavel, beco,
      publicavel_agora: computavel && alto && temTier1, // já passa os 2 portões (tem TIER 1)
    };
  }
  for (const r of resultados) r.cls = classificar(r);

  const tot = { b1: 0, b2: 0, b3: 0, b4: 0, publicavel_agora: 0 };
  for (const r of resultados) for (const b of ['b1', 'b2', 'b3', 'b4', 'publicavel_agora']) if (r.cls[b]) tot[b]++;

  // 6) Baldes por programa (destino de crédito; sem_destino cai no origem).
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
    // self-loop: origem===destino. Legítimo em compra/clube (comprar pontos no
    // próprio programa); SUSPEITO em transferência (transferir p/ si não é rota).
    if (c.origem_code && c.origem_code === c.destino_code && c.destino_code !== 'sem_destino') {
      if (c.tipo === 'transferencia') {
        anomLinha.self_loop.push({ id: c.id, tipo: c.tipo, rota: r.k, bruto: s.tl_score_bruto, veredito: s.veredito });
      }
    }
    // sem_destino inflando/zerando percentil: a rota lumpa campanhas
    // heterogêneas (destino nunca resolvido) → percentil pode saturar em 0/1
    // com base grande. Flag quando percentil presente, base>=10 e valor∈{0,1}.
    if (c.destino_code === 'sem_destino' && bd.percentil && (bd.percentil.valor_bruto === 0 || bd.percentil.valor_bruto === 1) && (bd.percentil.base_n || 0) >= 10) {
      anomLinha.sem_destino_infla.push({ id: c.id, rota: r.k, percentil_bruto: bd.percentil.valor_bruto, base_n: bd.percentil.base_n, bruto: s.tl_score_bruto });
    }
    // percentil saturado (0 ou 1) com base grande em QUALQUER rota — sinal de
    // rota mal canonicalizada (tudo igual) ou de extremo real; listar para olho.
    if (bd.percentil && (bd.percentil.valor_bruto === 0 || bd.percentil.valor_bruto === 1) && (bd.percentil.base_n || 0) >= 20) {
      anomLinha.score_extremo_base_alta.push({ id: c.id, rota: r.k, percentil_bruto: bd.percentil.valor_bruto, base_n: bd.percentil.base_n, bruto: s.tl_score_bruto });
    }
  }

  // 8) ANOMALIAS POR PROGRAMA (D-038): um programa inteiro suspeito → sinal de
  //    canonicalização torta NAQUELE programa, não de mercado. Dois eixos:
  //    destino_code e origem_code (a torta pode estar em qualquer lado).
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
      if (n < 5) continue; // amostra pequena não sustenta veredito de programa
      const beco = arr.filter((r) => r.cls.beco).length;
      const comput = arr.filter((r) => r.cls.computavel);
      const semDestino = arr.filter((r) => r.c.destino_code === 'sem_destino').length;
      const brutos = comput.map((r) => r.s.tl_score_bruto);
      const distintos = new Set(brutos).size;
      const altos = comput.filter((r) => r.s.tl_score_bruto >= 85).length; // Vale agir
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

  // 9) Golden vivo (ilustrativo): roda os 6 golden ponta-a-ponta no banco atual
  //    e mostra o drift vs a PROPOSTA (que é snapshot). Divergência aqui = DADO
  //    mudou, não engine (o engine já provou 6/6 na golden-replay).
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

  // Distribuição de veredito (panorama).
  const distVeredito = {};
  for (const r of resultados) distVeredito[r.s.veredito] = (distVeredito[r.s.veredito] || 0) + 1;

  const out = {
    gerado_em: new Date().toISOString(),
    dry_run: true,
    gravou_na_base: false,
    fidelidade_golden: { ok: golden.ok, total: golden.total, linhas: golden.linhas },
    golden_vivo: goldenVivo,
    vetores: { pesos, derivacao_versao: config.versao, raridade_n1: config.raridade.limiares[0].valor },
    totais: { campanhas: campanhas.length, rotas: rotas.size, cpm_pop: distribuicaoCpm.length },
    baldes_total: tot,
    dist_veredito: distVeredito,
    baldes_por_programa: [...porPrograma.entries()].map(([p, g]) => ({ programa: p, ...g })).sort((a, b) => b.b4 - a.b4 || b.n - a.n),
    anomalias_por_linha: {
      self_loop_transferencia: anomLinha.self_loop,
      sem_destino_percentil_saturado: anomLinha.sem_destino_infla,
      percentil_saturado_base_alta: anomLinha.score_extremo_base_alta,
    },
    anomalias_por_programa: anomPrograma,
  };

  mkdirSync(join(DIR, 'out'), { recursive: true });
  const outPath = join(DIR, 'out', 'rescore-dryrun.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2));

  // Resumo humano.
  console.log(`\n=== DRY-RUN (nada gravado) ===`);
  console.log(`campanhas ${out.totais.campanhas} · rotas ${out.totais.rotas} · CPM pop ${out.totais.cpm_pop}`);
  console.log(`\nBaldes (total):`);
  console.log(`  B1 confirmar-fila (alto+computável, só falta TIER 1): ${tot.b1}`);
  console.log(`  B2 beco (conta_nao_calculavel):                        ${tot.b2}`);
  console.log(`  B3 TIER 1 ausente + score baixo:                       ${tot.b3}`);
  console.log(`  B4 alto+computável+alcançável 4 sitemaps (CHAVE):      ${tot.b4}`);
  console.log(`  (já publicável — alto+computável+TIER 1):              ${tot.publicavel_agora}`);
  console.log(`\nDistribuição de veredito:`);
  for (const [v, n] of Object.entries(distVeredito).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${v}`);
  console.log(`\nGolden vivo (drift vs PROPOSTA snapshot):`);
  for (const g of goldenVivo) console.log(`  ${g.caso} prop=${g.esperado_proposta} vivo=${g.vivo_bruto} drift=${g.drift >= 0 ? '+' + g.drift : g.drift}  ${g.vivo_veredito}${g.vivo_override ? ' [' + g.vivo_override + ']' : ''}  (${g.id})`);
  console.log(`\nTop 15 programas por B4:`);
  for (const g of out.baldes_por_programa.slice(0, 15)) console.log(`  ${String(g.b4).padStart(3)} B4 | n=${String(g.n).padStart(4)} b1=${g.b1} b2=${g.b2} b3=${g.b3} pub=${g.publicavel_agora} · ${g.programa}`);
  console.log(`\nAnomalias por linha: self-loop transf=${anomLinha.self_loop.length} · sem_destino percentil saturado=${anomLinha.sem_destino_infla.length} · percentil saturado base>=20=${anomLinha.score_extremo_base_alta.length}`);
  console.log(`Anomalias por PROGRAMA (${anomPrograma.length}):`);
  for (const a of anomPrograma.slice(0, 25)) console.log(`  [${a.eixo}] ${a.programa} (n=${a.n}): ${a.motivos.join(' · ')}`);
  console.log(`\nJSON completo: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
