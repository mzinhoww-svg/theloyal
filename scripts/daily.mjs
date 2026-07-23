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
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { renderBeehiivHtml } from '../v2/lib/digest/render-beehiiv.mjs';
import { renderEmail } from '../renderer/email.mjs';
import { gate } from '../v2/lib/gate-unico.mjs';
import { anotarRevisao } from '../v2/lib/verificacao/integrar.mjs';
import { montarEdicaoDoDia, resolverNumeroEdicao, reconstruirConjuntoVivo, revalidarVigencia, filtrarVivos } from '../v2/lib/digest/montar-edicao.mjs';
import { hojeSaoPaulo } from './lib.mjs';
import { capturarEdicao } from './outcomes.mjs';

const LEDGER = 'content/daily-status.json';
const OUT = 'out/daily';
const EDICOES_DIR = 'content/editions';

function log(step, msg) { console.log(`[daily]${step ? ` ${step}` : ''} ${msg}`); }

function parse(argv) {
  const o = { edition: null, campaigns: null, news: null, forecast: null, now: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--campaigns') o.campaigns = argv[++i];
    else if (a === '--news') o.news = argv[++i];
    else if (a === '--forecast') o.forecast = argv[++i];
    else if (a === '--now') o.now = argv[++i];
    else if (!a.startsWith('--')) o.edition = a;
  }
  return o;
}

// Lê um JSON opcional; ausente/ilegível → default (nunca lança).
function lerJsonOpcional(path, def = null) {
  try { return path && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : def; }
  catch { return def; }
}

// Aceita snapshot como array de linhas OU objeto { campaigns, newsRaw, forecast }.
function normalizarSnapshot(raw) {
  if (Array.isArray(raw)) return { rows: raw, newsRaw: [], forecast: null };
  if (raw && typeof raw === 'object') {
    return { rows: raw.campaigns || raw.rows || [], newsRaw: raw.newsRaw || raw.news_raw || [], forecast: raw.forecast || null };
  }
  return { rows: [], newsRaw: [], forecast: null };
}

// Campanhas + news_raw do dia + forecast. REST vivo quando há credencial; senão
// o snapshot (--campaigns). `hoje` reconstrói o estado quando o snapshot é cru
// (sem `estado` — replay/export histórico); linhas do banco vivo já vêm com
// `estado` e passam intactas.
async function carregarCampanhas({ campaignsPath, newsPath, forecastPath, hoje }) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const forecastFromFile = lerJsonOpcional(forecastPath || 'content/forecast.json', null);
  if (url && key) {
    const select = 'id,origem_code,destino_code,tipo,tier,estado,tl_score_bruto,veredito_bruto,override_aplicado,percentual,paridade,cpm,publico,source_name,source_url,vigencia_fim,vigencia_fim_date,first_seen,notes,used_in';
    const path = `campaigns?select=${select}&or=(estado.in.(ativa,detectada,ultimos_dias),and(estado.eq.encerrada,tier.eq.1))`;
    const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`REST campaigns ${r.status}`);
    const rows = await r.json();
    // C1/INV-02: `tem_tier1` deriva de campanha_fontes (CONFIRMAÇÃO), nunca do campo
    // `tier` (claim do LLM sem lastro). O portão 2 do Deal Desk (passaTresPortoes)
    // lê essa marca. Sem a tabela/linha → tem_tier1=false (conservador: não publica).
    try {
      const cf = await fetch(`${url}/rest/v1/campanha_fontes?select=campaign_id`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
      const ids = cf.ok ? new Set((await cf.json()).map((f) => f.campaign_id)) : new Set();
      for (const row of rows) row.tem_tier1 = ids.has(row.id);
    } catch { for (const row of rows) row.tem_tier1 = false; }
    // EPSILON/D-086: triagem da Trilha B (limpo/historico_confirmado/revisao) gateia
    // Ofertas ativas (transparência) — DESACOPLADA do lastro-tier1. Lê a última
    // triagem por campanha (campanha_versoes evento=triagem_backlog_m3). Sem linha
    // → triagem_categoria=null (não-triado fica fora da transparência, INV-03).
    try {
      const tv = await fetch(`${url}/rest/v1/campanha_versoes?select=campaign_id,categoria:payload_depois->>categoria,em&evento=eq.triagem_backlog_m3&order=em.desc`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
      const cat = new Map();
      if (tv.ok) for (const v of await tv.json()) if (v.campaign_id && !cat.has(v.campaign_id)) cat.set(v.campaign_id, v.categoria ?? null);
      for (const row of rows) row.triagem_categoria = cat.get(row.id) ?? null;
    } catch { for (const row of rows) row.triagem_categoria = null; }
    // Clipping: notícia RECENTE (janela ~7 dias, não só hoje) com síntese PRÓPRIA
    // aprovada (summary presente E summary_review_reason null — reprovadas pelo crivo
    // A5/INV-25 nunca entram). Piso rígido 5 é aplicado a jusante (montarClipping).
    let newsRaw = [];
    try {
      const desde = new Date(Date.parse(`${hoje}T00:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10);
      const nq = `news_raw?select=id,source,title,url,summary,processed,published_at`
        + `&processed=eq.true&summary=not.is.null&summary_review_reason=is.null`
        + `&published_at=gte.${desde}&published_at=lte.${hoje}&order=published_at.desc`;
      const nr = await fetch(`${url}/rest/v1/${nq}`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
      if (nr.ok) newsRaw = await nr.json();
    } catch { /* news é opcional; Clipping degrada omitindo (regra-mãe) */ }
    return { rows, newsRaw, forecast: forecastFromFile, fonte: 'banco vivo (REST)' };
  }
  if (campaignsPath && existsSync(campaignsPath)) {
    const snap = normalizarSnapshot(lerJsonOpcional(campaignsPath, []));
    const cru = snap.rows.length > 0 && snap.rows.every((x) => x.estado === undefined);
    const rows = cru ? reconstruirConjuntoVivo(snap.rows, hoje) : snap.rows;
    const newsRaw = lerJsonOpcional(newsPath, null) || snap.newsRaw;
    return { rows, newsRaw, forecast: snap.forecast || forecastFromFile, fonte: `snapshot ${campaignsPath}${cru ? ' (estado reconstruído p/ ' + hoje + ')' : ''}` };
  }
  return { rows: [], newsRaw: [], forecast: forecastFromFile, fonte: 'nenhuma (sem credencial nem snapshot — gate acusará a falta)' };
}

// URLs de Clipping já usadas em edições anteriores (do MESMO dia não conta — a
// edição do dia reusa seu próprio arquivo, idempotente). EPSILON: uma notícia não
// reaparece no Clipping de dias diferentes.
function urlsClippingUsadas(hoje) {
  const usadas = new Set();
  if (!existsSync(EDICOES_DIR)) return usadas;
  for (const f of readdirSync(EDICOES_DIR).filter((x) => /^\d+\.json$/.test(x))) {
    const j = lerJsonOpcional(`${EDICOES_DIR}/${f}`, {});
    if (j.date === hoje) continue; // a própria edição do dia não bloqueia
    for (const c of Array.isArray(j.clipping) ? j.clipping : []) if (c?.url) usadas.add(c.url);
  }
  return usadas;
}

// Numeração idempotente por DATA: uma edição por dia, reusa o arquivo do dia se
// já existe, nunca reusa a 0001. Lê o índice local de edições.
function listarEdicoesExistentes() {
  if (!existsSync(EDICOES_DIR)) return [];
  return readdirSync(EDICOES_DIR).filter((f) => /^\d+\.json$/.test(f)).map((f) => {
    const j = lerJsonOpcional(`${EDICOES_DIR}/${f}`, {});
    return { number: j.number, date: j.date, illustrative: j.illustrative, file: f };
  });
}

function contentHash(html) { return createHash('sha256').update(html).digest('hex').slice(0, 16); }

function loadLedger() { return existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : {}; }
function saveLedger(l) { writeFileSync(LEDGER, JSON.stringify(l, null, 2) + '\n'); }

// ─── C2: trava de envio à prova de runner efêmero ────────────────────────────
// O ledger de arquivo (content/daily-status.json) NÃO sobrevive ao runner do
// Actions — a trava de reenvio morava ali e era inerte (um "Re-run" via ledger
// vazio e disparava um 2º envio). A verdade durável mora no banco (daily_sends,
// migration 019) e/ou no próprio Beehiiv. Estas peças leem/gravam essa verdade.

// Decisão PURA de envio. Combina três travas, todas REDUTORAS (nunca aumentam a
// permissão que o rating já concedeu em `publicar`):
//   (a) FRESHNESS: a edição tem de ser de HOJE (BRT). Edição com data ≠ hoje
//       NUNCA auto-envia (o gate antigo validava vigência contra ed.date, não
//       contra o dia real — um "Re-run" de ontem reenviaria a peça velha).
//   (b) TRAVA DURÁVEL: se o dia já consta enviado (banco, sobrevive ao runner),
//       reenvio é bloqueado — mesmo com ledger de arquivo zerado.
//   (c) FONTE DE VERDADE BEEHIIV: post do dia já enviado bloqueia (idempotência
//       server-side; a verdade final é o provedor, não nosso registro).
// Não faz I/O: recebe o estado já lido. Testável em isolamento.
export function decidirEnvio({ ed, hoje, publicar, lockRemoto = null, postBeehiivEnviado = null }) {
  if (!publicar) return { enviar: false, acao: 'draft', motivo: 'não elegível a envio — rascunho + 1 clique' };
  if (!ed || ed.date !== hoje) {
    return { enviar: false, acao: 'bloqueado-stale', postId: null,
      motivo: `freshness: edição ${ed?.date ?? '(sem data)'} não é de hoje (${hoje}) — edição velha nunca auto-envia` };
  }
  if (lockRemoto?.enviado) {
    return { enviar: false, acao: 'ja-enviado', postId: lockRemoto.post_id ?? null,
      motivo: `trava durável: dia ${ed.date} já enviado (${lockRemoto.post_id ?? 'sem post_id'}) — reenvio bloqueado` };
  }
  if (postBeehiivEnviado) {
    return { enviar: false, acao: 'ja-enviado-beehiiv', postId: postBeehiivEnviado.id ?? null,
      motivo: `fonte de verdade Beehiiv: post do dia ${ed.date} já enviado (${postBeehiivEnviado.id}) — não cria segundo` };
  }
  return { enviar: true, acao: 'enviar', postId: lockRemoto?.post_id ?? null,
    motivo: `edição fresca (${ed.date}=${hoje}), sem envio prévio — apto a enviar` };
}

const restHeaders = (key) => ({ apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' });

// Lê a trava durável do dia (null se ausente/sem creds/erro — degrada para draft).
async function lerLockEnvio({ url, key, date, fetchImpl = fetch }) {
  try {
    const r = await fetchImpl(`${url}/rest/v1/daily_sends?edition_date=eq.${date}&select=*`, { headers: restHeaders(key) });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch { return null; }
}

// Claim ATÔMICO do envio (RPC reservar_envio_diario). reservado=true só para quem
// faz a transição enviado false→true; concorrente/posterior recebe ja_enviado.
// Erro/sem creds → { reservado:false, ja_enviado:false } (o chamador não envia).
async function reservarEnvio({ url, key, date, number, fetchImpl = fetch }) {
  try {
    const r = await fetchImpl(`${url}/rest/v1/rpc/reservar_envio_diario`, {
      method: 'POST', headers: restHeaders(key),
      body: JSON.stringify({ p_edition_date: date, p_edition_number: number ?? null }),
    });
    if (!r.ok) return { reservado: false, ja_enviado: false, post_id: null };
    const j = await r.json();
    return Array.isArray(j) ? j[0] : j;
  } catch { return { reservado: false, ja_enviado: false, post_id: null }; }
}

// Grava/atualiza a trava do dia. `enviado` é OMITIDO no caminho draft (upsert
// merge só toca as colunas enviadas → monotonicidade de `enviado` preservada).
async function gravarLockEnvio({ url, key, date, number, postId, hash, enviado, sentAt, fetchImpl = fetch }) {
  try {
    const row = { edition_date: date, edition_number: number ?? null, post_id: postId ?? null, content_hash: hash ?? null };
    if (enviado === true) { row.enviado = true; row.sent_at = sentAt ?? new Date().toISOString(); }
    await fetchImpl(`${url}/rest/v1/daily_sends`, {
      method: 'POST', headers: { ...restHeaders(key), prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(row),
    });
  } catch { /* trava é aditiva; falha ao gravar não derruba o runner */ }
}

// Idempotência SERVER-SIDE: procura no Beehiiv um post do dia já ENVIADO
// (confirmed/published) antes de criar outro. Casa pelo título canônico do dia.
async function buscarPostDoDiaBeehiiv({ apiKey, pubId, ed, fetchImpl = fetch }) {
  try {
    const titulo = ed.beehiivTitle || `The Loyal Daily — ${ed.date}`;
    const r = await fetchImpl(`https://api.beehiiv.com/v2/publications/${pubId}/posts?limit=50&order_by=created&direction=desc`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const posts = Array.isArray(j?.data) ? j.data : [];
    const enviados = new Set(['confirmed', 'published', 'archived']);
    return posts.find((p) => p?.title === titulo && enviados.has(p?.status)) || null;
  } catch { return null; }
}

// Fila de revisão como ARTEFATO legível (A4): o operador a vê ANTES de aprovar
// o envio. Um item por flag, com motivo e o link da fonte quando houver. Nada
// aqui bloqueia — é a lista que o olho humano confere.
function escreverFilaRevisao({ ed, veredito, hoje }) {
  const n = String(ed.number).padStart(4, '0');
  const linhas = [
    `# Fila de revisão — Daily nº ${ed.number} (${ed.date})`,
    '',
    `Gerada em ${hoje}. Gate: **${veredito.pass ? 'VERDE' : `VERMELHO (camada ${veredito.camada})`}**.`,
    '',
    veredito.revisao.length === 0
      ? '_Nenhum item flagado hoje — nada a revisar antes de aprovar._'
      : `**${veredito.revisao.length} item(ns) para conferência humana** (flag é revisão, nunca descarte — D-060):`,
    '',
  ];
  for (const { item, flags } of veredito.revisao) {
    linhas.push(`- **${item.id}** — tipo ${item.tipo}, ${item.percentual ?? 's/%'}%, TL ${item.tl_score_bruto ?? '—'}, estado ${item.estado}`);
    for (const f of flags) linhas.push(`  - \`${f.flag}\`: ${f.motivo}`);
  }
  const auto = veredito.pass && veredito.revisao.length === 0;
  linhas.push('', '---', '',
    '## Aprovação',
    auto
      ? '- **Rating acima do mínimo** (gate verde, zero pendências): elegível a **envio automático** quando o auto-publish está ligado. Sem itens aqui para conferir.'
      : `- **Rating abaixo do mínimo** (${veredito.revisao.length} pendência(s) acima): **não** automatiza — requer **1 clique** do operador.`,
    '- 1 clique = disparar o envio pela ação única de publicação (workflow `Beehiiv Publish` com `confirm: PUBLICAR`, ou o botão de envio no Beehiiv).');
  writeFileSync(`${OUT}/${n}-revisao.md`, linhas.join('\n') + '\n');
  return `${OUT}/${n}-revisao.md`;
}

// Rating de auto-publish (decisão do operador): a edição é AUTO-ELEGÍVEL quando
// atinge o mínimo — gate VERDE **e** fila de revisão VAZIA (zero flags de
// pré-superfície, D-060). Abaixo do mínimo (qualquer pendência) → NÃO automatiza,
// vira rascunho + aprovação de 1 clique. O rating é de CONFIANÇA DE DADO, não da
// nota da oferta: um dia fraco mas limpo pode sair sozinho; um dia com bônus alto
// mas com item flagado espera o olho humano. Ajuste o mínimo aqui se o operador
// quiser outra régua.
export function avaliarRating(veredito) {
  const pendencias = veredito?.revisao?.length ?? 0;
  const auto = Boolean(veredito?.pass) && pendencias === 0;
  return {
    auto,
    pendencias,
    motivo: auto
      ? 'gate verde e zero pendências de revisão — acima do mínimo, elegível a auto-publish'
      : (!veredito?.pass ? 'gate vermelho — nunca publica' : `${pendencias} pendência(s) de revisão — abaixo do mínimo, requer 1 clique`),
  };
}

// Upsert do rascunho, idempotente por DATA. `publicar=true` só quando a edição é
// auto-elegível E o operador ligou o auto-publish (env TL_AUTOPUBLISH=on): aí o
// status vai a "confirmed" (ENVIA). Caso contrário fica "draft" (1 clique).
//
// C2 — a idempotência de ENVIO agora é DURÁVEL (banco daily_sends, migration 019)
// + fonte de verdade Beehiiv, não mais o arquivo efêmero. O caminho:
//   1. lê a trava durável do dia (sobrevive ao runner do Actions);
//   2. `decidirEnvio` aplica freshness (ed.date===hoje) + trava + Beehiiv;
//   3. envio real só após CLAIM ATÔMICO (RPC) — 2 runners no mesmo minuto ⇒ 1 só
//      envia; o outro vira no-op.
// O `post_id` do dia mora na trava durável (não no arquivo), então o reuso
// PATCH-vs-POST do rascunho funciona mesmo num runner novo. Sem BEEHIIV_API_KEY →
// mock; sem creds Supabase → cai no ledger de arquivo (dev local).
export async function upsertRascunho({ ed, html, hoje, publicar = false, io = {} }) {
  const {
    lerLock = lerLockEnvio, reservar = reservarEnvio, gravarLock = gravarLockEnvio,
    buscarPostBeehiiv = buscarPostDoDiaBeehiiv, fetchImpl = fetch, env = process.env,
  } = io;
  const chave = ed.date; // idempotência por data da edição
  const hash = contentHash(html);

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  // .trim() alinhado ao beehiiv-core.mjs: um secret com \n/espaço no fim faria o
  // pubId não casar o padrão ^pub_...$ do Beehiiv (400) só no runner (o publisher
  // trima e funcionava). Mesma disciplina nos dois caminhos.
  const apiKey = env.BEEHIIV_API_KEY?.trim();
  const pubId = env.BEEHIIV_PUBLICATION_ID?.trim();
  const durable = Boolean(url && key);

  // Estado prévio: em modo DURÁVEL (creds Supabase), o BANCO é a única verdade —
  // o arquivo (efêmero, poluível) é ignorado. Sem creds → arquivo é o fallback
  // local de dev. Nunca misturar as duas fontes (senão um arquivo velho
  // curto-circuita a decisão que o banco deveria mandar).
  const ledger = loadLedger();
  const fileLock = durable ? null : ledger[chave];
  const lockRemoto = durable ? await lerLock({ url, key, date: chave, fetchImpl }) : null;
  const lockEfetivo = durable
    ? lockRemoto
    : (fileLock?.enviado ? { enviado: true, post_id: fileLock.postId } : (fileLock ? { enviado: false, post_id: fileLock.postId } : null));
  let prevPostId = (durable ? lockRemoto?.post_id : fileLock?.postId) ?? null;

  // Fonte de verdade Beehiiv (server-side) só quando de fato iríamos enviar.
  let postBeehiivEnviado = null;
  if (publicar && ed.date === hoje && apiKey && pubId) {
    postBeehiivEnviado = await buscarPostBeehiiv({ apiKey, pubId, ed, fetchImpl });
  }

  const decisao = decidirEnvio({ ed, hoje, publicar, lockRemoto: lockEfetivo, postBeehiivEnviado });

  // Já enviado (durável ou Beehiiv) → no-op absoluto. Reconcilia banco↔Beehiiv.
  if (decisao.acao === 'ja-enviado' || decisao.acao === 'ja-enviado-beehiiv') {
    log('[5/5]', `dia ${chave}: ${decisao.motivo} — reenvio bloqueado (idempotente).`);
    if (durable && postBeehiivEnviado && !lockRemoto?.enviado) {
      await gravarLock({ url, key, date: chave, number: ed.number, postId: postBeehiivEnviado.id, hash, enviado: true, fetchImpl });
    }
    return { postId: decisao.postId ?? prevPostId, status: 'ja-enviado', url: fileLock?.url ?? null, enviado: true };
  }
  if (decisao.acao === 'bloqueado-stale') {
    log('[5/5]', `dia ${chave}: ${decisao.motivo} — rebaixa para rascunho (sem envio).`);
  }

  // Vai ENVIAR de verdade? Só há envio real com credencial Beehiiv — em mock NÃO
  // reservamos (senão uma rodada de dev travaria o dia no banco sem ter enviado).
  const enviarAgora = decisao.enviar;
  const vaiEnviarReal = enviarAgora && Boolean(apiKey && pubId);
  if (vaiEnviarReal && durable) {
    // CLAIM ATÔMICO antes de qualquer chamada real ao Beehiiv (2 runners ⇒ 1 envio).
    const res = await reservar({ url, key, date: chave, number: ed.number, fetchImpl });
    if (!res?.reservado) {
      log('[5/5]', `dia ${chave}: envio já reservado/feito por outra rodada (claim atômico) — no-op.`);
      return { postId: res?.post_id ?? prevPostId, status: 'ja-enviado', url: null, enviado: true };
    }
    prevPostId = res.post_id ?? prevPostId; // dono do envio; reusa o post do dia se já havia rascunho
  }

  const statusAlvo = enviarAgora ? 'confirmed' : 'draft';
  let record;
  if (apiKey && pubId) {
    const body = { title: ed.beehiivTitle || `The Loyal Daily — ${ed.date}`, status: statusAlvo, body_content: html };
    const isUpdate = Boolean(prevPostId);
    const endpoint = isUpdate
      ? `https://api.beehiiv.com/v2/publications/${pubId}/posts/${prevPostId}`
      : `https://api.beehiiv.com/v2/publications/${pubId}/posts`;
    const r = await fetchImpl(endpoint, {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const detalhe = `Beehiiv ${isUpdate ? 'PATCH' : 'POST'} ${r.status}: ${(await r.text()).slice(0, 200)}`;
      // ENVIO REAL que falha é RUIDOSO: não pode deixar a trava do dia (já reservada
      // atomicamente) num limbo silencioso reservado-mas-não-enviado.
      if (enviarAgora) throw new Error(detalhe);
      // RASCUNHO que falha NÃO derruba o run. No tier sem API (Launch) o POST volta
      // 400 — mas a edição, o render, o gate e o outcomes-ledger já são o produto do
      // dia. Degrada para "sem envio" e segue; a publicação acontece manualmente na UI.
      log('[5/5]', `Beehiiv indisponível — rascunho não criado via API (${detalhe}). Edição pronta em disco; publicação manual na UI do Beehiiv.`);
      record = { postId: prevPostId || null, status: `rascunho não publicado via API (${r.status}) — publicar na UI`, url: fileLock?.url || null, enviado: false };
    } else {
      const j = await r.json();
      record = { postId: j?.data?.id || prevPostId, status: enviarAgora ? 'ENVIADO (auto-publish)' : (isUpdate ? 'atualizado' : 'criado'), url: j?.data?.web_url || fileLock?.url, enviado: enviarAgora };
      log('[5/5]', `Beehiiv: ${record.status} (${record.postId})${enviarAgora ? ' — status confirmed, ENVIO REAL' : ' — status draft, sem envio'}.`);
    }
  } else {
    record = { postId: prevPostId || null, status: `mock (sem BEEHIIV_API_KEY)${enviarAgora ? ' — ENVIO seria disparado' : ''}`, url: fileLock?.url || null, enviado: false };
    log('[5/5]', `MOCK: sem credencial Beehiiv — ${enviarAgora ? 'ENVIO seria disparado (auto-elegível)' : 'rascunho não enviado'}. Alvo do dia ${chave}: ${record.postId || '(a criar na 1ª publicação real)'}.`);
  }

  // Persiste a trava durável (post_id sempre; enviado só quando de fato enviou —
  // o RPC já marcou enviado=true, aqui só gravamos post_id/hash). Arquivo continua
  // como cache local para dev sem Supabase.
  if (durable) {
    await gravarLock({ url, key, date: chave, number: ed.number, postId: record.postId, hash, enviado: record.enviado === true ? true : undefined, fetchImpl });
  }
  ledger[chave] = { ...record, contentHash: hash, lastRun: hoje, editionNumber: ed.number };
  saveLedger(ledger);
  return record;
}

async function main() {
  const opts = parse(process.argv.slice(2));
  // 'hoje' no fuso de São Paulo (não UTC): uma rodada noturna BRT não pode
  // escorregar para o dia seguinte na montagem/ledger/gate (M9).
  const hoje = opts.now || hojeSaoPaulo();

  // 1+2. Fonte viva do dia + MONTAGEM da edição fresca (ou carga estática
  // quando um caminho de edição é passado explicitamente — back-compat).
  const { rows: rowsBrutas, newsRaw: newsBrutas, forecast, fonte } = await carregarCampanhas({
    campaignsPath: opts.campaigns, newsPath: opts.news, forecastPath: opts.forecast, hoje,
  });
  // EPSILON: Clipping não repete notícia já usada em edição anterior (dedup por url).
  const usadas = urlsClippingUsadas(hoje);
  const newsRaw = (newsBrutas || []).filter((n) => !(n?.url && usadas.has(n.url)));
  // Revalidação de vigência no BOUNDARY: montagem, pré-superfície e gate veem a
  // MESMA verdade de vigência (vencida antes de `hoje` = 'encerrada'), mesmo que
  // o FSM do banco esteja stale. Sem isso, o gate diverge da edição montada.
  const campaignsFromDb = revalidarVigencia(rowsBrutas, hoje);

  let ed;
  let edPath;
  if (opts.edition) {
    ed = JSON.parse(readFileSync(opts.edition, 'utf8'));
    edPath = opts.edition;
    log('[1/5]', `edição ESTÁTICA nº ${ed.number} (${ed.date}) de ${edPath}`);
  } else {
    // Montagem DB→edição do dia, idempotente por data (M2.7). O número reusa o
    // arquivo do dia se já existe; senão max+1 (nunca 0001).
    const { number, reused } = resolverNumeroEdicao(hoje, listarEdicoesExistentes());
    ed = montarEdicaoDoDia({ asOf: hoje, campaigns: campaignsFromDb, newsRaw, forecast, number });
    edPath = `${EDICOES_DIR}/${String(number).padStart(4, '0')}.json`;
    mkdirSync(EDICOES_DIR, { recursive: true });
    writeFileSync(edPath, JSON.stringify(ed, null, 2) + '\n');
    log('[1/5]', `edição MONTADA nº ${number} (${hoje}) → ${edPath} ${reused ? '(reusou arquivo do dia — idempotente)' : '(número novo)'}. Fonte: ${fonte}. deals=${ed.deals.length}, ofertasAtivas=${ed.ofertasAtivas?.length || 0}, fechaLogo=${ed.fechaLogo?.length || 0}, cartoesBancos=${ed.cartoesBancosItens?.length || 0}, fechouSemana=${ed.oQueFechouSemana?.length || 0}, clipping=${ed.clipping?.length || 0}.`);
  }

  // Outcomes-ledger (GAMMA · D-048/D-202): CAPTURA as linhas da edição no momento
  // da montagem — o que foi mostrado + os 5 sinais de D-048 (lidos de
  // campanha_fontes), ação humana e desfecho ficam null (preenchidos depois, nunca
  // chutados). Pré-requisito de ligar autopublish. NUNCA bloqueia o runner.
  try {
    const cap = await capturarEdicao({ ed, campaigns: campaignsFromDb });
    log('[1/5]', `outcomes-ledger: ${cap.gravadas} linha(s) capturadas ${JSON.stringify(cap.secoes || {})}${cap.motivo ? ` (${cap.motivo})` : ''}.`);
  } catch (e) {
    log('[1/5]', `outcomes-ledger: captura falhou (não bloqueia) — ${e.message ?? e}.`);
  }

  // 2. Verificação — pré-superfície sobre os candidatos vivos (mesma fonte única
  // que o gate usa na camada de dado, para a fila do artefato e a do rating não
  // divergirem — M8).
  const vivos = filtrarVivos(campaignsFromDb);
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
  const filaPath = escreverFilaRevisao({ ed, veredito, hoje });
  if (!veredito.pass) {
    log('[4/5]', `GATE VERMELHO na camada "${veredito.camada}" — ${veredito.violacoes.length} violação(ões). Rascunho NÃO gerado:`);
    for (const v of veredito.violacoes.slice(0, 12)) log('', `  ✗ ${v}`);
    log('', `Fila de revisão (não bloqueia, informativa): ${veredito.revisao.length} item(ns) → ${filaPath}.`);
    process.exitCode = 1;
    return;
  }
  log('[4/5]', `GATE VERDE. Fila de revisão (${veredito.revisao.length} item(ns)) → ${filaPath}.`);

  // 5. Rating + rascunho. Auto-publish só quando: rating acima do mínimo E o
  // operador ligou TL_AUTOPUBLISH=on. Do contrário, rascunho + 1 clique.
  const rating = avaliarRating(veredito);
  const autopublishLigado = process.env.TL_AUTOPUBLISH === 'on';
  const publicar = rating.auto && autopublishLigado;
  log('', `Rating: ${rating.auto ? 'ACIMA do mínimo' : 'ABAIXO do mínimo'} — ${rating.motivo}. Auto-publish ${autopublishLigado ? 'LIGADO' : 'desligado'} → ${publicar ? 'ENVIO AUTOMÁTICO' : 'rascunho + 1 clique'}.`);
  const rasc = await upsertRascunho({ ed, html: beehiivHtml, hoje, publicar });
  log('', `FIM. ${rasc.status}${rasc.url ? ` — ${rasc.url}` : ''}. ${publicar ? 'Enviado automaticamente (rating acima do mínimo).' : 'Sem envio automático — 1 clique do operador quando quiser.'}`);
}

// Só roda como CLI — importado (teste), NÃO dispara o pipeline.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error('[daily] ERRO:', e.stack || e.message); process.exit(1); });
}
