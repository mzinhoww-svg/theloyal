#!/usr/bin/env node
// =====================================================================
// coleta-tier1.mjs — Runner da COLETA TIER 1 automatica, modo DRY-RUN
// "confirma-e-mostra" (D-049 §3.5). Parte A (coleta) + Parte C (gate de
// confianca) das vivas crawleaveis (origem in livelo/smiles/esfera/tap).
//
// INVARIANTE (a trava da tarefa): este runner NAO grava tier=1, NAO corrige
// dado, NAO publica. So COMPUTA e REPORTA a decisao que o gate TOMARIA a
// varios limiares — o operador crava o limiar de partida vendo o 1o lote.
//
// Fluxo por viva crawleavel (SPEC §1, D-047/D-045):
//   1. resolve a URL OFICIAL (regulamento_url em dominio oficial; a varredura de
//      sitemap dos adapters cruza-confirma e mede cobertura).
//   2. fetch redirect-manual: 200 = viva; 3xx->/promocao = encerrada (nao confirma).
//   3. detecta campanha vs evergreen pela JANELA DE VIGENCIA no regulamento
//      (D-047): sem janela datada = evergreen -> nao confirma (pula).
//   4. extrai termos (%, publico) do regulamento -> escala oficial.
//   5. classificarResultado (corrobora_limpo/ajuste/refuta) + confianca() pura.
//   6. mostra a decisao do gate a varios limiares vs um limiar conservador.
//
// Reusa: adapters/*, matcher-url, vigencia (parser), confianca. Nucleo puro
// injetavel (fetchImpl/discovered) -> testavel sem rede. CLI faz o fetch real
// e SEMPRE opera em mock/dry-run (nada e escrito).
//
// NOTA (coleta-tier1-producao): node:fs/promises|url|path NAO sao importados
// no topo do arquivo de proposito — so o CLI (main(), abaixo) precisa deles
// para ler a fixture local. Import estatico quebraria o load deste modulo em
// runtimes sem esses builtins (ex.: Supabase Edge Runtime/Deno), que so
// consomem as funcoes puras (coletarLote/descobrirTodos/fetchOficial) e nunca
// chamam main(). Import dinamico dentro de main() resolve isso.
// =====================================================================
import { adapterPara } from '../adapters/run.mjs';
import { parseVigencia } from '../vigencia.mjs';
import { confianca, classificarResultado, CONFIANCA_V1 } from './confianca.mjs';

// globalThis.process?.env (nao `process.env` cru): seguro em runtimes sem
// `process` global (Supabase Edge Runtime/Deno) — nao lanca ReferenceError
// na carga do modulo, mesmo quando este export nunca e chamado.
const UA = globalThis.process?.env?.TL_USER_AGENT
  || 'TheLoyalBot/1.0 (+https://theloyal.com.br; contato@theloyal.com.br)';

// Limiar de CONFIANCA conservador de PARTIDA (D-049 §3.5): proposta do agente; o
// operador crava vendo o 1o lote. Justificativa no relatorio LOTE-1.
export const LIMIAR_PARTIDA = 0.75;
// Grade de limiares mostrada por item (onde cada confirmacao cai).
export const LIMIARES = [0.60, 0.70, 0.75, 0.80, 0.90];
// Corte de VALOR (§5, D-048): item so consome confirmacao se tl_score_bruto >= piso.
export const PISO_VALOR = 70;

// ── decode/limpeza de HTML (Livelo serve JSON com < escapado) ──────────
function decodeHtml(html) {
  return String(html || '')
    .replace(/\\u003c/gi, '<').replace(/\\u003e/gi, '>').replace(/\\u0026/gi, '&')
    .replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\t/g, ' ');
}
const stripTags = (s) => String(s || '').replace(/<[^>]*>/g, ' ');
const colapsar = (s) => stripTags(decodeHtml(s)).replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// ── deteccao de JANELA DE VIGENCIA no regulamento (D-047) ──────────────────
// Campanha = regulamento com janela datada. Evergreen = paridade/institucional
// sem janela. Padroes reais: "Valido das 10h do dia 01/07 ate as 23h59 do dia
// 31/07/2026", "de 15/07 a 17/07", "Periodo de Vigencia ... 10h00".
const JANELA_RES = [
  /v[aá]lid[oa]\s+das?\s+\d{1,2}h[^.]{0,80}?(?:[àa]s|at[ée])[^.]{0,80}?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/i,
  /d(?:e|as)\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+(?:a|at[ée])\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/i,
  /(?:per[ií]odo\s+de\s+vig[eê]ncia|vig[eê]ncia\s+da\s+(?:campanha|promo))[^.]{0,120}?\d{1,2}\/\d{1,2}/i,
  /at[ée]\s+(?:as?\s+)?\d{1,2}h\d{0,2}\s+d(?:o|e)\s+dia\s+\d{1,2}\/\d{1,2}/i,
];

/** Acha a janela de vigencia no texto do regulamento (ja limpo). */
export function detectarJanela(texto) {
  for (const re of JANELA_RES) {
    const m = texto.match(re);
    if (m) {
      const v = parseVigencia({ texto: m[0] });
      return { tem: true, texto: m[0].slice(0, 160), fim_date: v.confiavel ? v.vigencia_fim : null, confiavel: v.confiavel };
    }
  }
  return { tem: false, texto: null, fim_date: null, confiavel: false };
}

// ── extracao da ESCALA de bonus (%, publico) do regulamento ────────────────
// So conta % em CONTEXTO DE BONUS (evita "5% no PIX", "width:100%"). Publico
// pela palavra proxima (para todos->geral; clube/assinante/categoria/diamante/
// plano N.000->clube; cartao->cartao). Proveniencia: o trecho casado.
const PUB_KEYS = [
  [/\b(clube|assinant|categoria|diamante|plano\s+\d|\d\.\d{3})\b/i, 'clube'],
  [/\b(cart[aã]o|cart[oõ]es)\b/i, 'cartao'],
  [/\b(para\s+todos|todos\s+os|geral|qualquer)\b/i, 'geral'],
];
function publicoDoTrecho(trecho) {
  for (const [re, pub] of PUB_KEYS) if (re.test(trecho)) return pub;
  return null;
}

/** Extrai [{pct, publico, trecho}] de trechos "<n>% de bonus" / "ate <n>%". */
export function extrairEscala(texto) {
  const escala = [];
  const vistos = new Set();
  const re = /(?:at[ée]\s+)?(\d{1,3})\s*%\s*(?:de\s+)?b[oô]nus|b[oô]nus\s+de\s+(\d{1,3})\s*%/gi;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const pct = Number(m[1] ?? m[2]);
    if (!Number.isFinite(pct) || pct < 1 || pct > 1000) continue;
    const ini = Math.max(0, m.index - 70);
    const trecho = texto.slice(ini, m.index + m[0].length + 40);
    const publico = publicoDoTrecho(trecho);
    const chave = `${pct}|${publico}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    escala.push({ pct, publico, trecho: trecho.replace(/\s+/g, ' ').trim().slice(0, 90) });
  }
  // Consolida: se um pct ja aparece com publico NOMEADO, descarta a duplicata de
  // publico null do mesmo pct (mesmo numero citado 2x nao e faixa nova).
  const pctComPublico = new Set(escala.filter((f) => f.publico != null).map((f) => f.pct));
  return escala.filter((f) => f.publico != null || !pctComPublico.has(f.pct));
}

/**
 * Analisa o regulamento oficial (HTML ja buscado). PURO.
 * @returns {{janela, escala, evergreen, termos_legiveis}}
 */
export function analisarRegulamento(html) {
  const texto = colapsar(html);
  const janela = detectarJanela(texto);
  const escala = extrairEscala(texto);
  return {
    janela,
    escala,
    evergreen: !janela.tem,        // sem janela datada = evergreen (D-047)
    termos_legiveis: escala.length > 0,
  };
}

// ── resolucao da URL oficial da viva ───────────────────────────────────────
/** URL oficial candidata: regulamento_url em dominio oficial (adapter resolve). */
export function urlOficialDe(viva, discovered = []) {
  const reg = viva.regulamento_url;
  if (reg && adapterPara(reg)) {
    const sitemapConfirma = discovered.includes(reg);
    return { url: reg, via: 'regulamento_url', sitemap_confirma: sitemapConfirma };
  }
  // fallback: match por slug de parceiro nas URLs de sitemap (transferencia/hotelaria)
  if (viva.destino_code && ['transferencia', 'hotelaria'].includes(viva.tipo)) {
    const alvo = String(viva.destino_code).toLowerCase();
    const hit = discovered.find((u) => u.toLowerCase().includes(alvo) && adapterPara(u));
    if (hit) return { url: hit, via: 'sitemap+matcher', sitemap_confirma: true };
  }
  return null;
}

// ── decisao do gate a um limiar (matriz D-049, confirma-e-mostra) ───────────
/** O que o gate FARIA a `limiar` — nada e executado (dry-run). */
export function decisaoNoLimiar(score, resultado, limiar) {
  if (resultado === 'nao_verificavel') return 'revisao (nada a corroborar)';
  if (resultado === 'corrobora_com_ajuste') return 'revisao (separar por publico, D-047)';
  if (score >= limiar) {
    if (resultado === 'corrobora_limpo') return 'auto: publica (3 portoes)';
    if (resultado === 'refuta') return 'auto: remove/rebaixa (firmeza)';
  }
  return 'revisao humana';
}

// ── avaliacao pura de UMA viva (sem I/O) ───────────────────────────────────
/**
 * @param {object} args
 *   viva      linha crawleavel.
 *   oficial   {url,via,sitemap_confirma}|null  URL oficial resolvida.
 *   resp      {status,location,html}|null  resposta do fetch (null se sem URL).
 * @returns {object} avaliacao completa do item (sinais, confianca, resultado, decisoes).
 */
export function avaliarViva({ viva, oficial, resp }) {
  const base = {
    id: viva.id, origem: viva.origem_code, destino: viva.destino_code, tipo: viva.tipo,
    publico: viva.publico, pct_ingerido: viva.percentual, tl_score_bruto: viva.tl_score_bruto,
    passa_corte_valor: (viva.tl_score_bruto ?? 0) >= PISO_VALOR,
  };

  // Sem URL oficial -> bloqueado, nunca forca TIER 1 (INV-01/INV-03).
  if (!oficial) {
    const sinais = { fonte_oficial: false, janela_vigencia_clara: false, estado_vivo_200: false, publico_inequivoco: false, termos_legiveis: false, resultado: 'nao_verificavel' };
    const c = confianca(sinais);
    return { ...base, status_coleta: 'sem_url_oficial', motivo: 'adapter/matcher nao achou URL oficial (fonte de terceiro/sem regulamento)', url_oficial: null, janela: null, escala: [], resultado: c.resultado, confianca: c.score, breakdown: c.breakdown, decisoes: mapaDecisoes(c.score, c.resultado) };
  }

  // 3xx / nao-200 -> encerrada, nao confirma.
  if (!resp || resp.status !== 200) {
    const sinais = { fonte_oficial: true, janela_vigencia_clara: false, estado_vivo_200: false, publico_inequivoco: false, termos_legiveis: false, resultado: 'nao_verificavel' };
    const c = confianca(sinais);
    return { ...base, status_coleta: 'nao_200', motivo: `HTTP ${resp ? resp.status : 'sem_resposta'}${resp && resp.location ? ` -> ${resp.location}` : ''} (encerrada/redirect)`, url_oficial: oficial.url, via: oficial.via, janela: null, escala: [], resultado: c.resultado, confianca: c.score, breakdown: c.breakdown, decisoes: mapaDecisoes(c.score, c.resultado) };
  }

  const reg = analisarRegulamento(resp.html);

  // Evergreen (sem janela) -> nao confirma (D-047).
  if (reg.evergreen) {
    const sinais = { fonte_oficial: true, janela_vigencia_clara: false, estado_vivo_200: true, publico_inequivoco: false, termos_legiveis: reg.termos_legiveis, resultado: 'nao_verificavel' };
    const c = confianca(sinais);
    return { ...base, status_coleta: 'evergreen', motivo: 'regulamento sem janela de vigencia datada = evergreen (D-047), nao confirma campanha', url_oficial: oficial.url, via: oficial.via, sitemap_confirma: oficial.sitemap_confirma, janela: reg.janela, escala: reg.escala, resultado: c.resultado, confianca: c.score, breakdown: c.breakdown, decisoes: mapaDecisoes(c.score, c.resultado) };
  }

  // Campanha viva com janela -> corrobora termos.
  const rr = classificarResultado({ pct_ingerido: viva.percentual, publico_ingerido: viva.publico, escala_oficial: reg.escala }, CONFIANCA_V1);
  const sinais = {
    fonte_oficial: true,
    janela_vigencia_clara: reg.janela.tem && reg.janela.confiavel,
    estado_vivo_200: true,
    publico_inequivoco: rr.publico_inequivoco,
    termos_legiveis: reg.termos_legiveis,
    resultado: rr.resultado,
  };
  const c = confianca(sinais);
  return {
    ...base, status_coleta: 'campanha', motivo: rr.motivo,
    url_oficial: oficial.url, via: oficial.via, sitemap_confirma: oficial.sitemap_confirma,
    janela: reg.janela, escala: reg.escala, resultado: rr.resultado, tier_casado: rr.tier_casado,
    confianca: c.score, breakdown: c.breakdown, decisoes: mapaDecisoes(c.score, c.resultado),
  };
}

function mapaDecisoes(score, resultado) {
  const m = {};
  for (const l of LIMIARES) m[l.toFixed(2)] = decisaoNoLimiar(score, resultado, l);
  return m;
}

// ── orquestrador (I/O injetavel) ───────────────────────────────────────────
/**
 * Coleta o lote inteiro. `fetchImpl(url)->{status,location,html}` injetavel.
 * `discovered` = URLs de campanha ja descobertas nos sitemaps (cross-confirm).
 * SEMPRE dry-run: retorna o relatorio, nunca escreve.
 */
export async function coletarLote({ vivas, discovered = {}, fetchImpl, ref }) {
  const itens = [];
  for (const viva of vivas) {
    const discList = discovered[viva.origem_code] || [];
    const oficial = urlOficialDe(viva, discList);
    let resp = null;
    if (oficial) {
      try { resp = await fetchImpl(oficial.url); }
      catch (e) { resp = { status: 0, location: '', html: '', erro: String(e).slice(0, 120) }; }
    }
    itens.push(avaliarViva({ viva, oficial, resp }));
  }
  return { ref, limiar_partida: LIMIAR_PARTIDA, piso_valor: PISO_VALOR, versao_confianca: CONFIANCA_V1.versao, contagens: contar(itens), itens };
}

function contar(itens) {
  const c = { total: itens.length, corrobora_limpo: 0, corrobora_com_ajuste: 0, refuta: 0, evergreen: 0, encerrado: 0, sem_url_oficial: 0, publicariam_no_limiar_partida: 0 };
  for (const it of itens) {
    if (it.status_coleta === 'evergreen') c.evergreen++;
    else if (it.status_coleta === 'nao_200') c.encerrado++;
    else if (it.status_coleta === 'sem_url_oficial') c.sem_url_oficial++;
    else if (it.resultado === 'corrobora_limpo') c.corrobora_limpo++;
    else if (it.resultado === 'corrobora_com_ajuste') c.corrobora_com_ajuste++;
    else if (it.resultado === 'refuta') c.refuta++;
    if (it.decisoes?.[LIMIAR_PARTIDA.toFixed(2)] === 'auto: publica (3 portoes)') c.publicariam_no_limiar_partida++;
  }
  return c;
}

// ── fetch real (redirect-manual, UA identificado) ──────────────────────────
export async function fetchOficial(url, { timeoutMs = 25000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html' }, signal: ctrl.signal });
    const html = r.status === 200 ? await r.text() : '';
    return { status: r.status, location: r.headers.get('location') || '', html };
  } finally { clearTimeout(t); }
}

// Descobre URLs de campanha por programa (sitemap + adapter). Cross-confirma URLs.
export async function descobrirTodos(get) {
  const { default: smiles } = await import('../adapters/smiles.mjs');
  const { default: livelo } = await import('../adapters/livelo.mjs');
  const { default: esfera } = await import('../adapters/esfera.mjs');
  const mapCode = { livelo: livelo, smiles: smiles, esfera: esfera };
  const out = {};
  for (const [code, ad] of Object.entries(mapCode)) {
    try {
      const xml = await get(ad.sitemap);
      let d = ad.descobrirUrls(xml);
      let urls = d.urls;
      if (d.tipo === 'index') {
        urls = [];
        for (const sub of (d.sub_sitemaps || []).slice(0, 6)) {
          const sx = await get(sub);
          urls.push(...ad.descobrirUrls(sx).urls);
        }
      }
      out[code] = urls;
    } catch (e) { out[code] = []; }
  }
  return out;
}

// ── CLI (dry-run sempre) ───────────────────────────────────────────────────
async function main() {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const fx = JSON.parse(await readFile(join(here, 'fixtures', 'vivas-crawleaveis.json'), 'utf8'));
  const ref = fx.ref;
  console.error(`[DRY-RUN] confirma-e-mostra — ${fx.vivas.length} vivas crawleaveis, ref ${ref}. NADA e gravado.`);

  const get = async (u) => {
    const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/xml' }, signal: AbortSignal.timeout(30000) });
    return r.status === 200 ? await r.text() : '';
  };
  const discovered = await descobrirTodos(get);
  console.error(`[sitemap] livelo=${(discovered.livelo || []).length} esfera=${(discovered.esfera || []).length} smiles=${(discovered.smiles || []).length} URLs de campanha`);

  const rel = await coletarLote({ vivas: fx.vivas, discovered, fetchImpl: (u) => fetchOficial(u), ref });
  console.log(JSON.stringify(rel, null, 2));
}

if (globalThis.process?.argv?.[1] && import.meta.url === `file://${globalThis.process.argv[1]}`) main().catch((e) => { console.error(e.stack || e.message); globalThis.process?.exit?.(1); });
