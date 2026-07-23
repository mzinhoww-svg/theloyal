// outcomes.mjs — I/O do outcomes-ledger (GAMMA). A LÓGICA pura vive em
// v2/lib/outcomes/ledger.mjs; aqui só o plumbing REST (ler confirmações, gravar
// captura, registrar ação humana). Segue o mesmo padrão de fetch REST do runner.
//
// Uso standalone (backfill / captura manual de uma edição já em disco):
//   node scripts/outcomes.mjs capturar content/editions/0029.json [--campaigns snap.json]
//   node scripts/outcomes.mjs acao --edition 2026-07-22 --acao aprovado_1clique [--motivo ..]
import { readFileSync, existsSync } from 'node:fs';
import { montarLinhasOutcome, linhaAcaoHumana } from '../v2/lib/outcomes/ledger.mjs';
import { reconstruirConjuntoVivo, revalidarVigencia } from '../v2/lib/digest/montar-edicao.mjs';

const restHeaders = (key) => ({ apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' });

function creds() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  return { url, key, ok: Boolean(url && key) };
}

// Lê, por campaign_id, a confirmação TIER1 mais recente (papel confirmacao_oficial)
// — a fonte dos 5 sinais de D-048. Sem creds/erro → map vazio (captura sem sinais).
export async function carregarFontesConfirmacao({ url, key, ids, fetchImpl = fetch }) {
  const out = {};
  const unicos = [...new Set((ids || []).filter(Boolean))];
  if (!url || !key || unicos.length === 0) return out;
  const inList = unicos.map((s) => `"${String(s).replace(/"/g, '')}"`).join(',');
  try {
    const q = `campanha_fontes?campaign_id=in.(${inList})&papel=eq.confirmacao_oficial`
      + `&select=campaign_id,payload,verificado_em&order=verificado_em.desc`;
    const r = await fetchImpl(`${url}/rest/v1/${q}`, { headers: restHeaders(key) });
    if (!r.ok) return out;
    for (const row of await r.json()) {
      if (row && row.campaign_id && !(row.campaign_id in out)) out[row.campaign_id] = row; // 1ª = mais recente
    }
  } catch { /* captura degrada para sem-sinais */ }
  return out;
}

// Upsert idempotente das linhas de captura. merge-duplicates só toca as colunas
// enviadas — como a captura NÃO envia acao_humana/desfecho, um recapture preserva
// a ação humana e o desfecho já gravados (nunca os zera).
export async function gravarLinhasOutcome({ url, key, rows, fetchImpl = fetch }) {
  if (!url || !key || !rows?.length) return { gravadas: 0 };
  // on_conflict EXPLÍCITO: a tabela tem PK `id` (identity) E a unique
  // (edition_date,section,item_key). Sem o alvo, o PostgREST resolve o upsert
  // pela PK e um recapture colide na unique (409). O alvo aponta a unique certa.
  const r = await fetchImpl(`${url}/rest/v1/daily_outcomes?on_conflict=edition_date,section,item_key`, {
    method: 'POST',
    headers: { ...restHeaders(key), prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`daily_outcomes upsert ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { gravadas: rows.length };
}

// Registra a AÇÃO HUMANA (1-clique) numa edição inteira. Só preenche linhas que
// ainda não têm ação (não sobrescreve uma correção/rejeição já registrada).
export async function gravarAcaoHumanaEdicao({ url, key, editionDate, acao, motivo = null, em, fetchImpl = fetch }) {
  if (!url || !key) return { atualizadas: 0, motivo: 'sem creds' };
  const patch = { ...linhaAcaoHumana({ acao, motivo, em }), atualizado_em: em ?? new Date().toISOString() };
  const q = `daily_outcomes?edition_date=eq.${editionDate}&acao_humana=is.null`;
  const r = await fetchImpl(`${url}/rest/v1/${q}`, {
    method: 'PATCH',
    headers: { ...restHeaders(key), prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`daily_outcomes acao ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { atualizadas: true, acao };
}

// Captura de alto nível: dada a edição + as campanhas que a montaram, monta as
// linhas (puro), carrega as confirmações e grava. Reutilizado pelo runner e pelo
// backfill. Sem creds → no-op reportado (dev/mock).
export async function capturarEdicao({ ed, campaigns, fetchImpl = fetch }) {
  const { url, key, ok } = creds();
  if (!ok) return { gravadas: 0, motivo: 'sem creds (mock)' };
  const idsSurfaceados = [...new Set((campaigns || []).map((c) => c?.id).filter(Boolean))];
  const fontesById = await carregarFontesConfirmacao({ url, key, ids: idsSurfaceados, fetchImpl });
  const rows = montarLinhasOutcome({ ed, campaigns, fontesById });
  const res = await gravarLinhasOutcome({ url, key, rows, fetchImpl });
  return { ...res, secoes: rows.reduce((a, r) => ((a[r.section] = (a[r.section] || 0) + 1), a), {}) };
}

// ---- CLI (backfill / operação manual) ----
async function mainCli(argv) {
  const [cmd, ...rest] = argv;
  if (cmd === 'capturar') {
    const edPath = rest.find((a) => !a.startsWith('--'));
    if (!edPath || !existsSync(edPath)) throw new Error('capturar: passe content/editions/NNNN.json');
    const ed = JSON.parse(readFileSync(edPath, 'utf8'));
    // Reconstrói as campanhas do dia a partir de um snapshot, se fornecido; senão
    // usa o que a edição referencia (backfill mínimo — sem snapshot, só clipping/urls).
    const snapIdx = rest.indexOf('--campaigns');
    let campaigns = [];
    if (snapIdx >= 0 && rest[snapIdx + 1] && existsSync(rest[snapIdx + 1])) {
      const raw = JSON.parse(readFileSync(rest[snapIdx + 1], 'utf8'));
      const rows = Array.isArray(raw) ? raw : (raw.campaigns || raw.rows || []);
      campaigns = revalidarVigencia(reconstruirConjuntoVivo(rows, ed.date), ed.date);
    }
    const res = await capturarEdicao({ ed, campaigns });
    console.log(`[outcomes] capturar ${edPath}: ${res.gravadas} linha(s) ${JSON.stringify(res.secoes || {})}${res.motivo ? ` (${res.motivo})` : ''}`);
    return;
  }
  if (cmd === 'acao') {
    const get = (f) => { const i = rest.indexOf(f); return i >= 0 ? rest[i + 1] : undefined; };
    const editionDate = get('--edition');
    const acao = get('--acao');
    if (!editionDate || !acao) throw new Error('acao: --edition <YYYY-MM-DD> --acao <aprovado_1clique|corrigido|rejeitado> [--motivo ..]');
    const { url, key } = creds();
    const res = await gravarAcaoHumanaEdicao({ url, key, editionDate, acao, motivo: get('--motivo') ?? null });
    console.log(`[outcomes] acao ${acao} @ ${editionDate}: ${JSON.stringify(res)}`);
    return;
  }
  throw new Error(`comando desconhecido "${cmd}" (esperado: capturar | acao)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mainCli(process.argv.slice(2)).catch((e) => { console.error(`[outcomes] Erro: ${e.message ?? e}`); process.exit(1); });
}
