#!/usr/bin/env node
// rodar-producao.mjs — runner de PRODUÇÃO da coleta TIER 1
// (SPEC-SLICE-COLETA-TIER1-PRODUCAO.md). Substitui a fixture estática do CLI
// dry-run por leitura viva do banco + EXECUTA o plano de gravação
// (gravacao-tier1.mjs). Reusa coletarLote/descobrirTodos/fetchOficial de
// coleta-tier1.mjs (INV-12 — importa, nunca forka).
//
// Roda como script Node (CLI, local/CI) OU importado pelo entrypoint Deno da
// edge function `coleta-tier1` (mesmo arquivo, zero fork — fetch é global nos
// dois runtimes). Sem dependência de pacote além do que já roda no projeto.
//
// Idempotência: só reprocessa um candidato se ainda não houver linha de
// campanha_fontes para ele HOJE (evita reprocessar 4x/dia com o cron de 6h).
import { descobrirTodos, fetchOficial, coletarLote } from './coleta-tier1.mjs';
import { planoDeGravacao, LIMIAR_PRODUCAO } from './gravacao-tier1.mjs';

const CRAWLAVEIS = ['livelo', 'smiles', 'esfera', 'tap_milesgo'];
const PISO_VALOR = 70; // D-048 §5 — mesmo piso do dry-run, agora aplicado no filtro de entrada.
const ESTADOS_VIVO = ['ativa', 'detectada', 'ultimos_dias'];

function restHeaders(key, extra = {}) {
  return { apikey: key, authorization: `Bearer ${key}`, ...extra };
}

async function restGet(url, key, path) {
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: restHeaders(key) });
  if (!r.ok) throw new Error(`REST GET ${path} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

async function restPatch(url, key, path, body) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method: 'PATCH', headers: restHeaders(key, { 'content-type': 'application/json', prefer: 'return=minimal' }),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`REST PATCH ${path} ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

async function restInsert(url, key, path, rows) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method: 'POST', headers: restHeaders(key, { 'content-type': 'application/json', prefer: 'return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`REST POST ${path} ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

/** Candidatos vivos do banco: crawleáveis, sem tier=1, acima do piso de valor. */
export async function buscarCandidatos({ url, key }) {
  const estados = ESTADOS_VIVO.map((e) => `"${e}"`).join(',');
  const origens = CRAWLAVEIS.map((o) => `"${o}"`).join(',');
  const select = 'id,tipo,origem_code,destino_code,publico,percentual,tl_score_bruto,veredito_bruto,override_aplicado,identidade_id,vigencia_fim,first_seen';
  const path = `campaigns?select=${select}&estado=in.(${estados})&origem_code=in.(${origens})&tier=neq.1&tl_score_bruto=gte.${PISO_VALOR}&identidade_id=not.is.null`;
  const rows = await restGet(url, key, path);
  return rows.map((c) => ({
    id: c.id, origem_code: c.origem_code, destino_code: c.destino_code, tipo: c.tipo,
    publico: c.publico, percentual: c.percentual, tl_score_bruto: c.tl_score_bruto,
    veredito_bruto_atual: c.veredito_bruto, override_aplicado_atual: c.override_aplicado,
    identidade_id: c.identidade_id,
  }));
}

/** Ids já processados HOJE (idempotência — não reprocessa no mesmo dia). */
async function jaProcessadosHoje({ url, key }, hoje) {
  const rows = await restGet(url, key, `campanha_fontes?select=campaign_id&verificado_em=eq.${hoje}`);
  return new Set(rows.map((r) => r.campaign_id));
}

/** Executa o plano de UM item (grava/refuta/revisao) via REST. */
async function executarPlano({ url, key }, item, plano) {
  if (plano.campaignsUpdate) {
    await restPatch(url, key, `campaigns?id=eq.${encodeURIComponent(item.id)}`, plano.campaignsUpdate);
  }
  await restInsert(url, key, 'campanha_fontes', [{
    identidade_id: item.identidade_id, ...plano.campanhaFontesRow,
  }]);
  if (plano.campanhaVersoesRow) {
    await restInsert(url, key, 'campanha_versoes', [{
      identidade_id: item.identidade_id, ...plano.campanhaVersoesRow,
    }]);
  }
}

/**
 * Roda um ciclo completo: busca candidatos vivos, descobre URLs oficiais,
 * avalia (coletarLote, puro), grava o plano de cada item. Idempotente por dia.
 * @returns {object} resumo do ciclo (contagens por ação, itens processados).
 */
export async function rodarCiclo({ url, key, hoje = new Date().toISOString().slice(0, 10), limiar = LIMIAR_PRODUCAO }) {
  const candidatos = await buscarCandidatos({ url, key });
  const vistos = await jaProcessadosHoje({ url, key }, hoje);
  const vivas = candidatos.filter((c) => !vistos.has(c.id));

  if (vivas.length === 0) {
    return { candidatos_no_banco: candidatos.length, ja_processados_hoje: candidatos.length - vivas.length, processados_agora: 0, contagens: {}, itens: [] };
  }

  const get = async (u) => {
    const r = await fetch(u, { headers: restHeaders(key, { accept: 'application/xml' }), signal: AbortSignal.timeout(30000) });
    return r.status === 200 ? await r.text() : '';
  };
  const discovered = await descobrirTodos(get);

  const lote = await coletarLote({ vivas, discovered, fetchImpl: (u) => fetchOficial(u), ref: hoje });

  const contagens = { grava_tier1: 0, refuta: 0, revisao: 0 };
  const itens = [];
  for (const avaliado of lote.itens) {
    const original = vivas.find((v) => v.id === avaliado.id);
    const plano = planoDeGravacao(
      { ...avaliado, veredito_bruto_atual: original?.veredito_bruto_atual, override_aplicado_atual: original?.override_aplicado_atual },
      { limiar, hoje },
    );
    await executarPlano({ url, key }, original, plano);
    contagens[plano.acao]++;
    itens.push({ id: avaliado.id, acao: plano.acao, resultado: avaliado.resultado, confianca: avaliado.confianca, tl_score_bruto: original?.tl_score_bruto });
  }

  return { candidatos_no_banco: candidatos.length, ja_processados_hoje: candidatos.length - vivas.length, processados_agora: vivas.length, contagens, itens, limiar_usado: limiar };
}

// ── CLI (roda de verdade — não é dry-run; grava) ────────────────────────────
async function main() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios (grava em produção).');
  const resumo = await rodarCiclo({ url, key });
  console.log(JSON.stringify(resumo, null, 2));
}

// globalThis.process?.argv (nao `process.argv` cru): a linha roda no TOPO do
// modulo mesmo quando importado (nao chamado como CLI) — precisa ser segura
// em runtimes sem `process` global (Supabase Edge Runtime/Deno), senao a
// falha aqui derruba o import inteiro do modulo (ES module top-level throw).
if (globalThis.process?.argv?.[1] && import.meta.url === `file://${globalThis.process.argv[1]}`) main().catch((e) => { console.error(e.stack || e.message); globalThis.process?.exit?.(1); });
