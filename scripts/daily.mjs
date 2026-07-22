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
    // news_raw processadas do dia (Clipping só usa as que tiverem síntese própria).
    let newsRaw = [];
    try {
      const nr = await fetch(`${url}/rest/v1/news_raw?select=id,source,title,url,summary,processed,published_at&processed=eq.true&published_at=eq.${hoje}`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
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
// Envio é idempotente: uma vez enviado num dia, nunca reenvia. Sem BEEHIIV_API_KEY
// → mock (nunca chama a API).
async function upsertRascunho({ ed, html, hoje, publicar = false }) {
  const ledger = loadLedger();
  const chave = ed.date; // idempotência por data da edição
  const hash = contentHash(html);
  const prev = ledger[chave];

  // Trava dura de reenvio: se já foi enviado hoje, nunca reenvia (mesmo com hash novo).
  if (prev?.enviado) {
    log('[5/5]', `edição do dia ${chave} JÁ ENVIADA (${prev.postId}) — reenvio bloqueado (idempotente).`);
    return { postId: prev.postId, status: 'ja-enviado', url: prev.url, enviado: true };
  }
  if (prev && prev.contentHash === hash && !publicar) {
    log('[5/5]', `rascunho do dia ${chave} já está no mesmo conteúdo (${prev.postId || 'mock'}) — idempotente, nada a fazer.`);
    return { postId: prev.postId, status: 'noop-idempotente', url: prev.url };
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;
  const statusAlvo = publicar ? 'confirmed' : 'draft';
  let record;
  if (apiKey && pubId) {
    // Reusa o post do dia se já existe (PATCH); senão cria (POST).
    const body = { title: ed.beehiivTitle || `The Loyal Daily — ${ed.date}`, status: statusAlvo, body_content: html };
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
    record = { postId: j?.data?.id || prev?.postId, status: publicar ? 'ENVIADO (auto-publish)' : (isUpdate ? 'atualizado' : 'criado'), url: j?.data?.web_url || prev?.url, enviado: publicar };
    log('[5/5]', `Beehiiv: ${record.status} (${record.postId})${publicar ? ' — status confirmed, ENVIO REAL' : ' — status draft, sem envio'}.`);
  } else {
    record = { postId: prev?.postId || null, status: `mock (sem BEEHIIV_API_KEY)${publicar ? ' — ENVIO seria disparado' : ''}`, url: prev?.url || null, enviado: false };
    log('[5/5]', `MOCK: sem credencial Beehiiv — ${publicar ? 'ENVIO seria disparado (auto-elegível)' : 'rascunho não enviado'}. Alvo do dia ${chave}: ${record.postId || '(a criar na 1ª publicação real)'}.`);
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
  const { rows: rowsBrutas, newsRaw, forecast, fonte } = await carregarCampanhas({
    campaignsPath: opts.campaigns, newsPath: opts.news, forecastPath: opts.forecast, hoje,
  });
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
