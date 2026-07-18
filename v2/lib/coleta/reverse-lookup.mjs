#!/usr/bin/env node
// =====================================================================
// reverse-lookup.mjs — Frente B da cobertura de fontes (SPEC-SLICE-COBERTURA
// -FONTES §2). Modo DRY-RUN "confirma-e-mostra" (D-050). PURO no núcleo,
// fetch injetável. NÃO grava tier=1, NÃO corrige dado, NÃO publica.
//
// O forward pass do lote-1 (coleta-tier1.mjs) parte do `regulamento_url` de
// terceiro OU de um match de slug estreito (transferencia/hotelaria). Sobram
// 15 vivas "sem_url_oficial". A Frente B faz o INVERSO e EXAUSTIVO: dada uma
// viva de terceiro (origem/destino/%), VARRE o **sitemap OFICIAL** do programa
// (origem e/ou destino — o que tiver adapter) e casa cada URL de campanha com
// a viva pela IDENTIDADE do M1 (`matcher-url.casarUrlCampanha`). Retorna as
// URL(s) candidata(s) **do domínio oficial** ou vazio.
//
// OS 4 TRAVAMENTOS (invioláveis, SPEC §7):
//   1. Reverse-lookup ALIMENTA o gate, não o pula: cada candidata passa por
//      `avaliarViva` (coleta-tier1) → confianca()/classificarResultado()
//      (D-048/D-049): corrobora_limpo / corrobora_com_ajuste / refuta.
//   2. Motor de busca = SITEMAP OFICIAL do programa. NUNCA web search geral.
//      Sem candidata no sitemap → FILA MANUAL (D-003), jamais web search.
//   3. Domínio oficial só: o candidato nasce da varredura do sitemap do
//      programa (host do adapter). Blog nunca entra.
//   4. Campanha vs evergreen pela JANELA DE VIGÊNCIA no regulamento (D-047),
//      herdado de `avaliarViva`.
//
// Reuso (não forka): matcher-url (casa URL↔identidade), adapters/base
// (extrairCampanha/descobrirUrls), adapters/run (adapterPara/ADAPTERS),
// identidade (construirIndices), coleta-tier1 (avaliarViva = o gate inteiro).
// =====================================================================
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { casarUrlCampanha } from '../matcher-url.mjs';
import { extrairCampanha } from '../adapters/base.mjs';
import { ADAPTERS } from '../adapters/run.mjs';
import { construirIndices } from '../identidade.mjs';
import { avaliarViva, LIMIAR_PARTIDA, PISO_VALOR } from './coleta-tier1.mjs';

const UA = process.env.TL_USER_AGENT
  || 'TheLoyalBot/1.0 (+https://theloyal.com.br; contato@theloyal.com.br)';

// ── mapeamento code → adapter ──────────────────────────────────────────────
/** Adapter cujo `programa` é exatamente este code (livelo/smiles/esfera/tap_milesgo). */
export function adapterDeCode(code) {
  if (!code) return null;
  return ADAPTERS.find((a) => a.programa === code) || null;
}

/** Programas do PAR da viva que têm adapter (origem e/ou destino). Só estes têm
 *  sitemap oficial para varrer; o resto do par (banco/varejo) não tem alcance. */
export function programasAlvo(viva) {
  const out = [];
  for (const code of [viva.origem_code, viva.destino_code]) {
    if (code && adapterDeCode(code) && !out.includes(code)) out.push(code);
  }
  return out;
}

// ── casamento par-nível (o "par" da SPEC §2, não a tupla-de-público) ─────────
const semDestino = (x) => x == null || x === 'sem_destino';

/** true se a identidade resolvida da URL casa o PAR (origem+destino) da viva.
 *  Público fica para o gate (D-047 separa em N identidades); aqui casamos o par. */
export function pareiaComViva(identidade, viva) {
  if (!identidade) return false;
  const destOk = identidade.destino_code === viva.destino_code
    || (semDestino(identidade.destino_code) && semDestino(viva.destino_code));
  return identidade.origem_code === viva.origem_code && destOk;
}

// Payload TIER 1 a partir de UMA url de sitemap (sem HTML ainda): extrairCampanha
// deriva slug/percentual da própria URL. programa = dono do sitemap (origem).
function payloadDeUrl(url, programaCode) {
  return extrairCampanha('', { url, programa: programaCode });
}

/**
 * VARREDURA REVERSA (o núcleo novo). PURA: dada a viva e as URLs de campanha já
 * descobertas nos sitemaps oficiais, casa cada URL com a identidade do M1 e
 * devolve as candidatas cujo PAR bate. Nada de web search — só sitemap oficial.
 *
 * @param {object} args
 *   viva        linha da viva.
 *   discovered  { [programCode]: string[] }  URLs de campanha por programa (sitemap).
 *   indices     saída de construirIndices(seed).
 *   ref         data de referência YYYY-MM-DD.
 * @returns {{ candidatos: Array<{url,programa,forca,acao_matcher}>,
 *             sitemaps_varridos: Array<{programa,n_urls}> }}
 */
export function candidatosSitemap({ viva, discovered = {}, indices, ref }) {
  const candidatos = [];
  const sitemaps_varridos = [];
  const vistos = new Set();

  for (const code of programasAlvo(viva)) {
    const urls = discovered[code] || [];
    sitemaps_varridos.push({ programa: code, n_urls: urls.length });

    for (const url of urls) {
      const payload = payloadDeUrl(url, code);
      const r = casarUrlCampanha(payload, indices, [viva], ref);

      let forca = null;
      if (r.acao === 'confirmar' && r.campaign_id === viva.id) {
        forca = 'identidade'; // casou a tupla completa (público incluso)
      } else if (r.acao === 'criar' && pareiaComViva(r.identidade, viva)) {
        forca = 'par'; // casou o par; público diverge (gate separa, D-047)
      }
      if (!forca) continue;
      if (vistos.has(url)) continue;
      vistos.add(url);
      candidatos.push({ url, programa: code, forca, acao_matcher: r.acao });
    }
  }
  return { candidatos, sitemaps_varridos };
}

// ── ranking do desfecho do gate (melhor candidata por viva) ─────────────────
const ORDEM_RESULTADO = { corrobora_limpo: 4, corrobora_com_ajuste: 3, refuta: 2, nao_verificavel: 1 };
function melhorAvaliacao(avals) {
  return [...avals].sort((a, b) => {
    const dr = (ORDEM_RESULTADO[b.resultado] || 0) - (ORDEM_RESULTADO[a.resultado] || 0);
    if (dr !== 0) return dr;
    return (b.confianca || 0) - (a.confianca || 0);
  })[0];
}

// Onde a viva CAI, medido pelo RESULTADO do gate (o corte que o operador quer):
//   resolvido_tier1        = achou página datada oficial que o gate CORROBORA
//                            (limpo = auto-confirmável; ajuste = confirmável, separar público)
//   candidata_nao_confirma = sitemap expôs uma página, mas é evergreen/encerrada
//                            /refuta → não vira TIER 1 (o gate barrou, correto)
//   fila_manual            = sitemap NÃO expôs nenhuma página do par (D-003)
export function classificarDesfecho(melhor) {
  if (!melhor) return { fila: 'fila_manual', rotulo: 'manual: sitemap oficial não expôs a página do par' };
  const r = melhor.resultado;
  const s = melhor.status_coleta;
  if (r === 'corrobora_limpo') return { fila: 'resolvido_tier1', rotulo: 'resolvido: TIER 1 confirmável (corrobora_limpo)' };
  if (r === 'corrobora_com_ajuste') return { fila: 'resolvido_tier1', rotulo: 'resolvido: TIER 1 confirmável, separar por público (corrobora_com_ajuste, D-047)' };
  if (r === 'refuta') return { fila: 'candidata_nao_confirma', rotulo: 'candidata oficial REFUTA o termo (remove/rebaixa)' };
  if (s === 'evergreen') return { fila: 'candidata_nao_confirma', rotulo: 'candidata sem janela = evergreen (D-047), não confirma' };
  if (s === 'nao_200') return { fila: 'candidata_nao_confirma', rotulo: 'candidata 3xx/encerrada (não confirmável)' };
  return { fila: 'candidata_nao_confirma', rotulo: 'candidata não verificável' };
}

function resumoViva(viva) {
  return {
    id: viva.id, tipo: viva.tipo, origem: viva.origem_code, destino: viva.destino_code,
    publico: viva.publico, pct_ingerido: viva.percentual, tl_score_bruto: viva.tl_score_bruto,
    veredito_bruto: viva.veredito_bruto, estado: viva.estado,
    passa_corte_valor: (viva.tl_score_bruto ?? 0) >= PISO_VALOR,
  };
}

/**
 * Orquestrador do lote (I/O injetável). `fetchImpl(url)->{status,location,html}`.
 * `discovered` = URLs de campanha já descobertas nos sitemaps (por programa).
 * SEMPRE dry-run: retorna o relatório, nunca escreve.
 */
export async function reverseLookupLote({ vivas, discovered = {}, indices, fetchImpl, ref }) {
  const itens = [];
  for (const viva of vivas) {
    const { candidatos, sitemaps_varridos } = candidatosSitemap({ viva, discovered, indices, ref });

    if (candidatos.length === 0) {
      const gateBloqueado = avaliarViva({ viva, oficial: null, resp: null });
      itens.push({
        ...resumoViva(viva), sitemaps_varridos, candidatos: [],
        desfecho: classificarDesfecho(null),
        melhor: { resultado: gateBloqueado.resultado, confianca: gateBloqueado.confianca, status_coleta: 'sem_candidata_sitemap' },
        avaliacoes: [],
      });
      continue;
    }

    const avaliacoes = [];
    for (const c of candidatos) {
      let resp = null;
      try { resp = await fetchImpl(c.url); }
      catch (e) { resp = { status: 0, location: '', html: '', erro: String(e).slice(0, 140) }; }
      const oficial = { url: c.url, via: `reverse-lookup:${c.forca}`, sitemap_confirma: true };
      const av = avaliarViva({ viva, oficial, resp });
      avaliacoes.push({ url: c.url, forca: c.forca, ...av });
    }
    const melhor = melhorAvaliacao(avaliacoes);
    itens.push({
      ...resumoViva(viva), sitemaps_varridos,
      candidatos: candidatos.map((c) => ({ url: c.url, forca: c.forca })),
      desfecho: classificarDesfecho(melhor), melhor, avaliacoes,
    });
  }
  return {
    ref, modo: 'reverse-lookup dry-run (confirma-e-mostra, D-050)',
    limiar_partida: LIMIAR_PARTIDA, piso_valor: PISO_VALOR,
    contagens: contar(itens), itens,
  };
}

function contar(itens) {
  const c = {
    total: itens.length,
    resolvido_tier1: 0, resolvido_limpo: 0, resolvido_ajuste: 0,
    candidata_nao_confirma: 0, fila_manual: 0,
    resolvido_e_forte: 0,
  };
  for (const it of itens) {
    const f = it.desfecho.fila;
    if (f === 'resolvido_tier1') {
      c.resolvido_tier1++;
      if (it.melhor.resultado === 'corrobora_limpo') c.resolvido_limpo++;
      else if (it.melhor.resultado === 'corrobora_com_ajuste') c.resolvido_ajuste++;
      if (it.passa_corte_valor) c.resolvido_e_forte++;
    } else if (f === 'candidata_nao_confirma') c.candidata_nao_confirma++;
    else if (f === 'fila_manual') c.fila_manual++;
  }
  return c;
}

// ── I/O real (CLI) ─────────────────────────────────────────────────────────
// fetch redirect-manual, UA identificado (o gate distingue 200 de 3xx).
async function fetchOficial(url, { timeoutMs = 25000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html' }, signal: ctrl.signal });
    const html = r.status === 200 ? await r.text() : '';
    return { status: r.status, location: r.headers.get('location') || '', html };
  } finally { clearTimeout(t); }
}

// Chromium dump-dom (D-047: render quando o SSR não trouxer a janela). Best-effort:
// o lote-1 achou o SSR mais estável (headless recebe interstício anti-bot), então
// só é acionado sob TL_CHROMIUM=1. Nunca vira caminho padrão.
const CHROMIUM = process.env.TL_CHROMIUM_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
function fetchChromium(url, { timeoutMs = 20000 } = {}) {
  return new Promise((resolve) => {
    const args = ['--headless=new', '--no-sandbox', '--disable-gpu', '--dump-dom', '--virtual-time-budget=8000', url];
    const p = spawn(CHROMIUM, args, { timeout: timeoutMs });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('error', () => resolve({ status: 0, location: '', html: '' }));
    p.on('close', () => resolve({ status: out ? 200 : 0, location: '', html: out }));
  });
}

// Descobre URLs de campanha por programa via sitemap+adapter (cross-confirm).
async function descobrirTodos(get, codes) {
  const out = {};
  for (const code of codes) {
    const ad = adapterDeCode(code);
    if (!ad) { out[code] = []; continue; }
    try {
      const xml = await get(ad.sitemap);
      const d = ad.descobrirUrls(xml);
      let urls = d.urls;
      if (d.tipo === 'index') {
        urls = [];
        for (const sub of (d.sub_sitemaps || []).slice(0, 8)) {
          try { urls.push(...ad.descobrirUrls(await get(sub)).urls); } catch { /* pula sub inacessível */ }
        }
      }
      out[code] = [...new Set(urls)];
    } catch { out[code] = []; }
  }
  return out;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const fx = JSON.parse(await readFile(join(here, 'fixtures', 'vivas-frente-b.json'), 'utf8'));
  const seed = JSON.parse(await readFile(join(here, '..', '..', 'db', 'seed-aliases.json'), 'utf8'));
  const indices = construirIndices(seed);
  const ref = fx.ref;

  console.error(`[DRY-RUN] Frente B reverse-lookup — ${fx.vivas.length} vivas sem fonte oficial, ref ${ref}. NADA e gravado.`);

  const get = async (u) => {
    const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/xml' }, signal: AbortSignal.timeout(30000) });
    return r.status === 200 ? await r.text() : '';
  };

  const codesAlvo = [...new Set(fx.vivas.flatMap((v) => programasAlvo(v)))];
  console.error(`[sitemap] programas com adapter no lote: ${codesAlvo.join(', ')}`);
  const discovered = await descobrirTodos(get, codesAlvo);
  console.error('[sitemap] URLs de campanha descobertas: ' + Object.entries(discovered).map(([k, v]) => `${k}=${v.length}`).join(' '));

  const useChromium = process.env.TL_CHROMIUM === '1';
  const fetchImpl = useChromium
    ? async (u) => { const s = await fetchOficial(u); return (s.status === 200 && s.html) ? s : fetchChromium(u); }
    : (u) => fetchOficial(u);

  const rel = await reverseLookupLote({ vivas: fx.vivas, discovered, indices, fetchImpl, ref });
  console.log(JSON.stringify(rel, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
