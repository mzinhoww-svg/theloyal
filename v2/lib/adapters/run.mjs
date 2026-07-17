#!/usr/bin/env node
// =====================================================================
// run.mjs — A ESTRADA ponta a ponta: URL oficial verificada -> confirmar_tier1.
// Fluxo por URL (a decisão "esta URL = esta campanha" é do matcher/humano, D-003):
//   1. resolve o adapter pelo host; recusa se o robots do programa proíbe (D-009).
//   2. fetch simples com UA identificado e SEM seguir redirect: campanha
//      encerrada devolve 302 -> /promocao (achado real). 200 direto = viva.
//   3. extrairCampanha (puro) -> payload de evidência.
//   4. confirmar_tier1(campaign_id, url_canonica, verificado_em) via RPC.
// Sem credenciais -> MOCK (dry-run: mostra o que enfileiraria, não escreve).
// Lógica pura injetável (deps) -> testável sem rede nem banco (adapters.test.mjs).
//
// ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. UA: TL_USER_AGENT (opcional).
// USO: node v2/lib/adapters/run.mjs <campaign_id> <url_oficial> [verificado_em]
// =====================================================================
import smiles from './smiles.mjs';
import livelo from './livelo.mjs';
import esfera from './esfera.mjs';
import tap from './tap.mjs';

export const ADAPTERS = [smiles, livelo, esfera, tap];
// globalThis.process?.env — seguro em runtimes sem `process` global (ver
// mesma nota em coleta-tier1.mjs); este arquivo é importado (não só
// executado como CLI) pela edge function coleta-tier1.
const UA = globalThis.process?.env?.TL_USER_AGENT
  || 'TheLoyalBot/1.0 (+https://theloyal.com.br; contato@theloyal.com.br)';

/** Resolve o adapter dono de uma URL pelo host do sitemap. */
export function adapterPara(url) {
  let host;
  try { host = new URL(url).host.replace(/^www\./, ''); } catch { return null; }
  return ADAPTERS.find((a) => {
    try { return new URL(a.sitemap).host.replace(/^www\./, '') === host; } catch { return false; }
  }) || null;
}

// fetch real com UA identificado, redirect manual, timeout. Isolado p/ DI.
async function fetchOficial(url, { timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': UA, accept: 'text/html' },
      signal: ctrl.signal,
    });
    const status = r.status;
    const location = r.headers.get('location') || '';
    const html = status === 200 ? await r.text() : '';
    return { status, location, html };
  } finally { clearTimeout(t); }
}

// RPC PostgREST p/ confirmar_tier1. Isolado p/ DI.
async function rpcConfirmar({ url: base, key }, { campaignId, urlCanonica, verificadoEm }) {
  const r = await fetch(`${base}/rest/v1/rpc/confirmar_tier1`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_campaign_id: campaignId, p_url: urlCanonica,
      ...(verificadoEm ? { p_verificado_em: verificadoEm } : {}),
    }),
  });
  if (!r.ok) throw new Error(`rpc confirmar_tier1 -> ${r.status}: ${await r.text()}`);
  return r.json();
}

/**
 * Núcleo puro/injetável. deps.fetchImpl(url) -> {status,location,html};
 * deps.confirmar(payload) -> resultado do RPC (ou undefined em mock).
 * @returns {{ok:boolean, motivo?:string, payload?:object, confirmacao?:object}}
 */
export async function confirmarUrl({ campaignId, url, verificadoEm }, deps) {
  const { fetchImpl, confirmar, mock = false } = deps;
  if (!campaignId || !url) return { ok: false, motivo: 'campaign_id e url obrigatórios' };

  const adapter = adapterPara(url);
  if (!adapter) return { ok: false, motivo: `sem adapter para ${url}` };
  if (!adapter.urlPermitida(url)) return { ok: false, motivo: 'url bloqueada por robots/ToS (D-009)' };

  const resp = await fetchImpl(url);
  if (resp.status !== 200) {
    // 3xx de campanha encerrada (-> /promocao) NÃO confirma: a página oficial
    // não existe mais naquela URL. Reportar, nunca forçar TIER 1.
    return { ok: false, motivo: `página não confirmável (HTTP ${resp.status}${resp.location ? ` -> ${resp.location}` : ''})` };
  }

  const payload = adapter.extrairCampanha(resp.html, url);
  const confirmacao = mock
    ? undefined
    : await confirmar({ campaignId, urlCanonica: payload.url_canonica, verificadoEm });

  return { ok: true, payload, confirmacao };
}

// ── CLI ──────────────────────────────────────────────────────────────
async function main() {
  const [campaignId, url, verificadoEm] = process.argv.slice(2);
  if (!campaignId || !url) {
    console.error('uso: node v2/lib/adapters/run.mjs <campaign_id> <url_oficial> [verificado_em]');
    process.exit(1);
  }
  const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mock = !SB || !KEY;
  if (mock) console.error('[MOCK] sem SUPABASE_URL/SERVICE_ROLE_KEY — dry-run, nada é escrito.');

  const res = await confirmarUrl({ campaignId, url, verificadoEm }, {
    fetchImpl: (u) => fetchOficial(u),
    confirmar: (args) => rpcConfirmar({ url: SB, key: KEY }, args),
    mock,
  });

  console.log(JSON.stringify(res, null, 2));
  if (!res.ok) process.exit(2);
}

if (globalThis.process?.argv?.[1] && import.meta.url === `file://${globalThis.process.argv[1]}`) main().catch((e) => { console.error(e.message); globalThis.process?.exit?.(1); });
