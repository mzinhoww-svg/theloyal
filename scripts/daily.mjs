#!/usr/bin/env node
// daily.mjs — RUNNER DIÁRIO ponta a ponta do The Loyal Daily (M2.7 / A2).
// Um comando (`npm run daily`) faz, SEM intervenção manual por etapa:
//   1. resolve a edição do dia (content/editions/NNNN.json)
//   2. montagem/verificação: roda a pré-superfície (D-060/D-061) sobre os
//      candidatos vivos → fila de revisão + trilha idempotente (wire ponto b)
//   3. render: Beehiiv (Tiptap) + e-mail → out/daily/
//   4. GATE ÚNICO bloqueante (M2.4): schema→dado→editorial. Vermelho ABORTA
//      antes de qualquer rascunho — nunca publica peça reprovada.
//   5. rascunho draft-only IDEMPOTENTE POR DATA no Beehiiv (reusa o post do
//      dia; NUNCA envia). Sem BEEHIIV_API_KEY → modo mock (reporta o alvo).
//
// Idempotência dura: rodar duas vezes no mesmo dia não cria dois posts nem
// dispara envio — a chave é a DATA da edição (ledger content/daily-status.json).
// Auto-publish OFF por design: status é sempre "draft"; o envio é decisão
// humana (fora deste runner).
//
// Fontes de dado:
//   - campanhas: REST vivo se SUPABASE_URL/KEY presentes; senão --campaigns
//     <snapshot.json> (export real do banco) ou vazio (gate acusa a falta).
//   - Beehiiv: REST se BEEHIIV_API_KEY presente; senão mock (nunca chama a API).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { renderBeehiivHtml } from '../v2/lib/digest/render-beehiiv.mjs';
import { renderEmail } from '../renderer/email.mjs';
import { gate } from '../v2/lib/gate-unico.mjs';
import { anotarRevisao } from '../v2/lib/verificacao/integrar.mjs';

const LEDGER = 'content/daily-status.json';
const OUT = 'out/daily';

function log(step, msg) { console.log(`[daily]${step ? ` ${step}` : ''} ${msg}`); }

function parse(argv) {
  const o = { edition: null, campaigns: null, now: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--campaigns') o.campaigns = argv[++i];
    else if (a === '--now') o.now = argv[++i];
    else if (!a.startsWith('--')) o.edition = a;
  }
  return o;
}

function resolveEditionPath(explicit) {
  if (explicit) return explicit;
  if (existsSync('content/latest.json')) return 'content/latest.json';
  throw new Error('sem edição: passe content/editions/NNNN.json ou gere content/latest.json');
}

// Campanhas vivas + fechadas recentes (para o gate casar ofertasAtivas e
// oQueFechouSemana). REST vivo quando há credencial; senão o snapshot.
async function carregarCampanhas({ campaignsPath }) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    const select = 'id,origem_code,destino_code,tipo,tier,estado,tl_score_bruto,veredito_bruto,override_aplicado,percentual,paridade,vigencia_fim,vigencia_fim_date,first_seen,notes';
    const path = `campaigns?select=${select}&or=(estado.in.(ativa,detectada,ultimos_dias),and(estado.eq.encerrada,tier.eq.1))`;
    const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`REST campaigns ${r.status}`);
    return { rows: await r.json(), fonte: 'banco vivo (REST)' };
  }
  if (campaignsPath && existsSync(campaignsPath)) {
    return { rows: JSON.parse(readFileSync(campaignsPath, 'utf8')), fonte: `snapshot ${campaignsPath}` };
  }
  return { rows: [], fonte: 'nenhuma (sem credencial nem snapshot — gate acusará a falta)' };
}

function contentHash(html) { return createHash('sha256').update(html).digest('hex').slice(0, 16); }

function loadLedger() { return existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : {}; }
function saveLedger(l) { writeFileSync(LEDGER, JSON.stringify(l, null, 2) + '\n'); }

// Upsert do rascunho, idempotente por DATA. Sem BEEHIIV_API_KEY → mock: registra
// o alvo e o hash, não chama a API. NUNCA envia (status sempre draft).
async function upsertRascunho({ ed, html, hoje }) {
  const ledger = loadLedger();
  const chave = ed.date; // idempotência por data da edição
  const hash = contentHash(html);
  const prev = ledger[chave];

  if (prev && prev.contentHash === hash) {
    log('[5/5]', `rascunho do dia ${chave} já está no mesmo conteúdo (${prev.postId || 'mock'}) — idempotente, nada a fazer.`);
    return { postId: prev.postId, status: 'noop-idempotente', url: prev.url };
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;
  let record;
  if (apiKey && pubId) {
    // Reusa o post do dia se já existe (PATCH); senão cria (POST). Draft-only.
    const body = { title: ed.beehiivTitle || `The Loyal Daily — ${ed.date}`, status: 'draft', body_content: html };
    const isUpdate = Boolean(prev?.postId);
    const endpoint = isUpdate
      ? `https://api.beehiiv.com/v2/publications/${pubId}/posts/${prev.postId}`
      : `https://api.beehiiv.com/v2/publications/${pubId}/posts`;
    const r = await fetch(endpoint, {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Beehiiv ${isUpdate ? 'PATCH' : 'POST'} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    record = { postId: j?.data?.id || prev?.postId, status: isUpdate ? 'atualizado' : 'criado', url: j?.data?.web_url || prev?.url };
    log('[5/5]', `rascunho ${record.status} no Beehiiv (${record.postId}) — status draft, sem envio.`);
  } else {
    record = { postId: prev?.postId || null, status: 'mock (sem BEEHIIV_API_KEY)', url: prev?.url || null };
    log('[5/5]', `MOCK: sem credencial Beehiiv — rascunho não enviado. Alvo idempotente do dia ${chave}: ${record.postId || '(a criar na 1ª publicação real)'}. Artefato em ${OUT}/.`);
  }

  ledger[chave] = { ...record, contentHash: hash, lastRun: hoje, editionNumber: ed.number };
  saveLedger(ledger);
  return record;
}

async function main() {
  const opts = parse(process.argv.slice(2));
  const edPath = resolveEditionPath(opts.edition);
  const ed = JSON.parse(readFileSync(edPath, 'utf8'));
  const hoje = opts.now || ed.date;
  log('[1/5]', `edição nº ${ed.number} (${ed.date}) de ${edPath}`);

  // 2. Montagem/verificação — pré-superfície sobre os candidatos vivos.
  const { rows: campaignsFromDb, fonte } = await carregarCampanhas({ campaignsPath: opts.campaigns });
  const vivos = campaignsFromDb.filter((c) => ['ativa', 'detectada', 'ultimos_dias'].includes(c.estado));
  const { paraRevisao, resumo } = anotarRevisao(vivos, { hoje });
  log('[2/5]', `campanhas: ${fonte} — ${campaignsFromDb.length} linhas (${vivos.length} vivas). Pré-superfície: ${resumo.aprovados} limpas, ${resumo.para_revisao} para revisão.`);
  for (const { item, flags } of paraRevisao) log('[2/5]', `  · REVISÃO ${item.id}: ${flags.map((f) => f.flag).join(', ')}`);

  // 3. Render.
  mkdirSync(OUT, { recursive: true });
  const beehiivHtml = renderBeehiivHtml(ed);
  const emailHtml = renderEmail(ed);
  writeFileSync(`${OUT}/${String(ed.number).padStart(4, '0')}-beehiiv.html`, beehiivHtml);
  writeFileSync(`${OUT}/${String(ed.number).padStart(4, '0')}-email.html`, emailHtml);
  log('[3/5]', `render OK → ${OUT}/${String(ed.number).padStart(4, '0')}-{beehiiv,email}.html`);

  // 4. Gate único bloqueante.
  const veredito = gate(ed, { campaignsFromDb, renderedHtml: beehiivHtml, hoje, now: hoje });
  if (!veredito.pass) {
    log('[4/5]', `GATE VERMELHO na camada "${veredito.camada}" — ${veredito.violacoes.length} violação(ões). Rascunho NÃO gerado:`);
    for (const v of veredito.violacoes.slice(0, 12)) log('', `  ✗ ${v}`);
    log('', `Fila de revisão (não bloqueia, informativa): ${veredito.revisao.length} item(ns).`);
    process.exitCode = 1;
    return;
  }
  log('[4/5]', `GATE VERDE. Fila de revisão anexa: ${veredito.revisao.length} item(ns) para o operador ver antes de aprovar.`);

  // 5. Rascunho idempotente draft-only.
  const rasc = await upsertRascunho({ ed, html: beehiivHtml, hoje });
  log('', `FIM. Rascunho: ${rasc.status}${rasc.url ? ` — ${rasc.url}` : ''}. Auto-publish OFF; envio é decisão humana.`);
}

main().catch((e) => { console.error('[daily] ERRO:', e.stack || e.message); process.exit(1); });
