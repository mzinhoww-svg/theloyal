// Publisher do The Loyal no Beehiiv.
// Publica o conteúdo JÁ RENDERIZADO (out/email/NNNN.html + out/plain/NNNN.txt)
// sem alterar nada editorialmente. Não reescreve conteúdo, não muda tokens.
//
// Fluxo: QA gate → monta payload Create Post → draft/preview → (teste) →
// agenda/publica → registra status. Idempotente: um mesmo conteúdo nunca é
// disparado duas vezes.
//
// Sem BEEHIIV_API_KEY/BEEHIIV_PUBLICATION_ID → modo mock (dry-run): valida e
// escreve os artefatos, sem tocar na API. Mesma convenção do route de inscrição.
//
// Uso:
//   node scripts/beehiiv-publish.mjs [content/editions/NNNN.json] [opções]
//   --draft            (default) cria/atualiza rascunho — status "draft"
//   --publish          confirma e envia agora — status "confirmed"
//   --schedule <ISO>   agenda o envio — status "confirmed" + scheduled_at
//   --test <email>     registra pedido de envio de teste (feito no rascunho)
//   --force            ignora a trava de idempotência (re-disparo consciente)
//   --dry-run          nunca chama a API, mesmo com credenciais
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { editionSlug, loadEdition, pad } from "./lib.mjs";
import { renderEmail, renderPlain } from "./render.mjs";
import { report, validateEdition } from "./validate.mjs";

const API_BASE = "https://api.beehiiv.com/v2";
const LEDGER_PATH = "content/beehiiv-status.json";
const OUT_DIR = "out/beehiiv";

// Ações que efetivamente disparam e-mail. Trava anti-duplicação só se aplica a elas.
const DISPATCH_ACTIONS = new Set(["publish", "schedule"]);

function parseArgs(argv) {
  const opts = { action: "draft", path: null, schedule: null, test: null, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--draft") opts.action = "draft";
    else if (a === "--publish") opts.action = "publish";
    else if (a === "--schedule") { opts.action = "schedule"; opts.schedule = argv[++i]; }
    else if (a === "--test") opts.test = argv[++i];
    else if (a === "--force") opts.force = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (!a.startsWith("--")) opts.path = a;
    else throw new Error(`Opção desconhecida: ${a}`);
  }
  return opts;
}

// Resolve a edição a publicar: caminho explícito, ou a última em content/latest.json.
function resolveEdition(path) {
  if (path) return { edition: loadEdition(path), origin: path };
  if (existsSync("content/latest.json")) {
    const latest = JSON.parse(readFileSync("content/latest.json", "utf8"));
    return { edition: latest, origin: "content/latest.json" };
  }
  throw new Error("Sem edição: passe content/editions/NNNN.json ou rode npm run publish antes.");
}

function derivedSlug(ed) {
  const product = ed.productType ?? "daily";
  return ed.slug ?? `${product}-${pad(ed.number)}`;
}

// Lê o artefato JÁ RENDERIZADO do disco (a peça entregue). O render nomeia os
// arquivos por editionSlug (NNNN), independente do slug web do Beehiiv. Só
// regenera se o arquivo não existir — e avisa, para o operador rodar render antes.
function readRendered(ed, kind) {
  const renderSlug = editionSlug(ed);
  const file = kind === "email" ? `out/email/${renderSlug}.html` : `out/plain/${renderSlug}.txt`;
  if (existsSync(file)) return { content: readFileSync(file, "utf8"), source: file, regenerated: false };
  const content = kind === "email" ? renderEmail(ed) : renderPlain(ed);
  return { content, source: `${file} (regenerado — rode npm run render)`, regenerated: true };
}

// Monta o corpo do Create Post do Beehiiv a partir da edição + artefatos.
// Não reescreve conteúdo: html e texto entram como vieram do render.
function buildPayload(ed, { html, slug, action, scheduledAt, tags }) {
  const title = ed.subject;
  if (!title) throw new Error("subject ausente — o Beehiiv exige title no Create Post.");

  const status = action === "publish" || action === "schedule" ? "confirmed" : "draft";
  const payload = {
    title,
    body_content: html,
    status,
    email_settings: {
      subject_line: ed.subject,
      preview_text: ed.preheader ?? "",
    },
    web_settings: { slug },
  };
  if (tags.length) payload.content_tags = tags;
  if (scheduledAt) payload.scheduled_at = scheduledAt;
  return payload;
}

function loadLedger() {
  if (existsSync(LEDGER_PATH)) return JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  return { posts: {} };
}

function saveLedger(ledger) {
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + "\n");
}

// Hash do que efetivamente sai: conteúdo + metadados de envio. Muda o conteúdo,
// muda o hash — é a chave da idempotência.
function contentHash({ html, plain, slug, subject, preheader, tags, scheduledAt }) {
  const h = createHash("sha256");
  h.update(JSON.stringify({ html, plain, slug, subject, preheader, tags, scheduledAt: scheduledAt ?? null }));
  return "sha256:" + h.digest("hex");
}

async function callBeehiiv({ pubId, apiKey, payload }) {
  const res = await fetch(`${API_BASE}/publications/${pubId}/posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Beehiiv respondeu ${res.status}: ${text.slice(0, 500)}`);
  let data = {};
  try { data = JSON.parse(text); } catch { /* resposta não-JSON */ }
  return data.data ?? data;
}

function writeReport(slug, record, errors) {
  mkdirSync(OUT_DIR, { recursive: true });
  const L = [];
  L.push(`# Publicação Beehiiv — ${slug}`);
  L.push("");
  L.push(`**Status da publicação:** ${record.status}`);
  L.push(`**Modo:** ${record.mode}`);
  L.push(`**Link de preview:** ${record.previewUrl ?? "—"}`);
  L.push(`**Link do post:** ${record.postUrl ?? "—"}`);
  L.push(`**Post ID:** ${record.postId ?? "—"}`);
  L.push(`**Data agendada:** ${record.scheduledAt ?? "—"}`);
  L.push(`**Hash do conteúdo:** ${record.contentHash}`);
  if (record.testRequestedFor) L.push(`**Teste solicitado para:** ${record.testRequestedFor}`);
  L.push("");
  L.push("## Erros");
  L.push(errors.length ? errors.map((e) => `- ${e}`).join("\n") : "Nenhum.");
  L.push("");
  writeFileSync(`${OUT_DIR}/${slug}.md`, L.join("\n"));
}

function fail(msg) {
  console.error(`[beehiiv] BLOQUEADO — ${msg}`);
  process.exit(1);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { edition: ed, origin } = resolveEdition(opts.path);
  const slug = derivedSlug(ed);
  const tags = Array.isArray(ed.tags) ? ed.tags : [];
  const scheduledAt = opts.action === "schedule" ? opts.schedule : (opts.action === "publish" ? null : ed.scheduledAt ?? null);

  if (opts.action === "schedule") {
    if (!scheduledAt) fail("--schedule exige um ISO 8601, ex: --schedule 2026-07-09T08:00:00-03:00");
    if (Number.isNaN(Date.parse(scheduledAt))) fail(`--schedule inválido: ${scheduledAt}`);
  }

  console.log(`[beehiiv] Edição Nº ${ed.number} (${origin}) → slug "${slug}", ação "${opts.action}".`);

  // 1. QA gate — não publicar sem QA (regra do Publisher + gate do pipeline).
  const qa = validateEdition(ed);
  report(ed, qa);
  if (qa.errors.length) {
    qa.errors.forEach((e) => console.error(`  ✗ ${e}`));
    fail(`QA falhou (${qa.errors.length} erro(s)). Ver out/qa/${editionSlug(ed)}.md. Nada foi enviado.`);
  }
  console.log(`[beehiiv] QA OK — ${qa.warnings.length} aviso(s).`);

  // Régua de publicação (Fase 1.4): só a FAIXA A auto-publica. Verdicto de ação
  // (faixa B/C) ou item rebaixado pela régua (faixa D) exige revisão/assinatura —
  // o dispatch (publish/schedule) bloqueia sem --force. Draft/preview seguem livres.
  if (DISPATCH_ACTIONS.has(opts.action) && !opts.force) {
    const pending = (qa.dispositions ?? []).filter((x) => x.disposition.faixa !== "A");
    if (pending.length) {
      pending.forEach((x) => console.error(`  ⚠ Deal ${x.index + 1} (${x.title ?? "sem título"}): faixa ${x.disposition.faixa} — ${x.disposition.reasons[0] ?? ""}`));
      fail(
        `régua: ${pending.length} item(ns) fora da faixa A (auto-publicação). Verdicto de ação exige ` +
          `revisão/assinatura de score; rebaixe para monitoramento/nao-confirmado, revise, ou use --force conscientemente.`,
      );
    }
    console.log("[beehiiv] Régua OK — todos os itens em faixa A (auto-publicação liberada).");
  }

  // 2. Conteúdo já renderizado (não reescreve).
  const email = readRendered(ed, "email");
  const plain = readRendered(ed, "plain");
  if (email.regenerated || plain.regenerated) {
    console.warn(`[beehiiv] Aviso: artefato ausente foi regenerado. Rode npm run render para versionar a peça.`);
  }

  const hash = contentHash({ html: email.content, plain: plain.content, slug, subject: ed.subject, preheader: ed.preheader, tags, scheduledAt });

  // 3. Idempotência — não disparar duas vezes o mesmo conteúdo.
  const ledger = loadLedger();
  const prev = ledger.posts[slug];
  const isDispatch = DISPATCH_ACTIONS.has(opts.action);
  if (prev && prev.contentHash === hash && !opts.force) {
    const alreadyDispatched = prev.status === "published" || prev.status === "scheduled";
    if (isDispatch && alreadyDispatched) {
      fail(`conteúdo idêntico já ${prev.status === "published" ? "publicado" : "agendado"} (${prev.postId ?? "sem id"}). Use --force para re-disparar conscientemente.`);
    }
    if (!isDispatch) {
      console.log(`[beehiiv] Rascunho já registrado com o mesmo conteúdo (${prev.postId ?? "mock"}). Nada a fazer (idempotente).`);
      printStatus(prev);
      return;
    }
  }

  // 4. Payload Create Post.
  const payload = buildPayload(ed, { html: email.content, slug, action: opts.action, scheduledAt, tags });

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/${slug}.request.json`, JSON.stringify(payload, null, 2) + "\n");
  // Preview local: o HTML de e-mail exato, abrível no navegador.
  writeFileSync(`${OUT_DIR}/${slug}.preview.html`, email.content);
  const localPreview = `${OUT_DIR}/${slug}.preview.html`;

  const apiKey = process.env.BEEHIIV_API_KEY?.trim();
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID?.trim();
  const live = Boolean(apiKey && publicationId) && !opts.dryRun;

  const nowIso = new Date().toISOString();
  // Log da régua aplicada por item (Fase 2.3): base para o motor de acurácia
  // cruzar "o que publicamos como ação de fato se confirmou?".
  const dispositions = (qa.dispositions ?? []).map((x) => ({
    index: x.index,
    title: x.title,
    faixa: x.disposition.faixa,
    downgradeTo: x.disposition.downgradeTo,
    tier: x.disposition.tier,
  }));
  const record = {
    number: ed.number,
    date: ed.date,
    productType: ed.productType ?? "daily",
    slug,
    contentHash: hash,
    action: opts.action,
    mode: live ? "live" : (opts.dryRun ? "dry-run" : "mock"),
    provenance: "cli", // trilha CLI; campos do MCP (ex.: provenance próprio) são preservados no merge abaixo
    dispositions,
    postId: prev?.postId ?? null,
    previewUrl: prev?.previewUrl ?? localPreview,
    postUrl: prev?.postUrl ?? null,
    scheduledAt: scheduledAt ?? null,
    testRequestedFor: opts.test ?? prev?.testRequestedFor ?? null,
    status: opts.action === "publish" ? "published" : opts.action === "schedule" ? "scheduled" : "draft",
    updatedAt: nowIso,
  };

  const errors = [];
  if (live) {
    const pubId = publicationId.startsWith("pub_") ? publicationId : `pub_${publicationId}`;
    try {
      const data = await callBeehiiv({ pubId, apiKey, payload });
      record.postId = data.id ?? record.postId;
      record.postUrl = data.web_url ?? data.url ?? record.postUrl;
      if (data.preview_url) record.previewUrl = data.preview_url;
      console.log(`[beehiiv] API OK — post ${record.postId}.`);
    } catch (err) {
      errors.push(String(err.message ?? err));
      record.status = "error";
      console.error(`[beehiiv] Falha na API: ${err.message ?? err}`);
    }
  } else {
    // Mock/dry-run: registra o que SERIA enviado, sem tocar na API. status fica
    // limpo (draft/scheduled/published); o modo distingue mock de live.
    console.log(`[beehiiv] Modo ${record.mode}: nada enviado à API. Payload em ${OUT_DIR}/${slug}.request.json.`);
  }

  // 5. Registra status (idempotência + histórico). Preserva campos desconhecidos
  // do registro anterior (ex.: `provenance` gravado por outra trilha como o MCP —
  // P0.3), para o script não ficar cego ao que o MCP publicou.
  const history = Array.isArray(prev?.history) ? prev.history : [];
  history.push({ at: nowIso, action: opts.action, mode: record.mode, status: record.status, contentHash: hash, forced: opts.force });
  ledger.posts[slug] = { ...(prev ?? {}), ...record, history };
  saveLedger(ledger);
  writeReport(slug, record, errors);

  printStatus(record);
  if (errors.length) process.exit(1);
}

function printStatus(record) {
  console.log("");
  console.log("── STATUS DA PUBLICAÇÃO ──────────────────────────────");
  console.log(`  status        : ${record.status}`);
  console.log(`  modo          : ${record.mode ?? "—"}`);
  console.log(`  preview        : ${record.previewUrl ?? "—"}`);
  console.log(`  post           : ${record.postUrl ?? "—"}`);
  console.log(`  post id        : ${record.postId ?? "—"}`);
  console.log(`  data agendada  : ${record.scheduledAt ?? "—"}`);
  if (record.testRequestedFor) console.log(`  teste p/       : ${record.testRequestedFor}`);
  console.log("──────────────────────────────────────────────────────");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(`[beehiiv] Erro: ${err.message ?? err}`); process.exit(1); });
}

export { buildPayload, contentHash, derivedSlug };
