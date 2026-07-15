// Núcleo compartilhado do publisher Beehiiv — Daily e Weekly.
// Concentra o plumbing (parse de opções, idempotência por hash de conteúdo,
// montagem do Create Post, chamada de API / mock, ledger e relatório) para que
// Daily e Weekly não virem duas implementações divergentes (anti-"gêmeos").
// Cada produto só monta seu artefato (QA + HTML renderizado) e chama publish().
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export const API_BASE = "https://api.beehiiv.com/v2";
export const LEDGER_PATH = "content/beehiiv-status.json";
export const OUT_DIR = "out/beehiiv";

// Ações que efetivamente disparam e-mail. Trava anti-duplicação só se aplica a elas.
export const DISPATCH_ACTIONS = new Set(["publish", "schedule"]);

export function parseArgs(argv) {
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

// Monta o corpo do Create Post. Não reescreve conteúdo: html entra como veio do
// render. Genérico — Daily e Weekly passam seus próprios campos.
export function buildPayload({ subject, preheader, html, slug, action, scheduledAt, tags = [] }) {
  if (!subject) throw new Error("subject ausente — o Beehiiv exige title no Create Post.");
  const status = action === "publish" || action === "schedule" ? "confirmed" : "draft";
  const payload = {
    title: subject,
    body_content: html,
    status,
    email_settings: { subject_line: subject, preview_text: preheader ?? "" },
    web_settings: { slug },
  };
  if (tags.length) payload.content_tags = tags;
  if (scheduledAt) payload.scheduled_at = scheduledAt;
  return payload;
}

export function loadLedger() {
  if (existsSync(LEDGER_PATH)) return JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  return { posts: {} };
}

export function saveLedger(ledger) {
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + "\n");
}

// Hash do que efetivamente sai: conteúdo + metadados de envio. Muda o conteúdo,
// muda o hash — é a chave da idempotência.
export function contentHash({ html, plain, slug, subject, preheader, tags, scheduledAt }) {
  const h = createHash("sha256");
  h.update(JSON.stringify({ html, plain, slug, subject, preheader, tags, scheduledAt: scheduledAt ?? null }));
  return "sha256:" + h.digest("hex");
}

export async function callBeehiiv({ pubId, apiKey, payload }) {
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

export function writeReport(slug, record, errors) {
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

export function printStatus(record) {
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

export function fail(msg) {
  console.error(`[beehiiv] BLOQUEADO — ${msg}`);
  process.exit(1);
}

// Orquestra idempotência → payload → API/mock → ledger → relatório → status.
// `meta` são os campos de identidade que entram no ledger (number/date/productType).
// Retorna { record, errors }. Não faz process.exit (o chamador decide).
export async function publish({ meta, subject, preheader, tags = [], html, plain, slug, action, scheduledAt = null, test = null, force = false, dryRun = false }) {
  const hash = contentHash({ html, plain, slug, subject, preheader, tags, scheduledAt });

  const ledger = loadLedger();
  const prev = ledger.posts[slug];
  const isDispatch = DISPATCH_ACTIONS.has(action);
  if (prev && prev.contentHash === hash && !force) {
    const alreadyDispatched = prev.status === "published" || prev.status === "scheduled";
    if (isDispatch && alreadyDispatched) {
      fail(`conteúdo idêntico já ${prev.status === "published" ? "publicado" : "agendado"} (${prev.postId ?? "sem id"}). Use --force para re-disparar conscientemente.`);
    }
    if (!isDispatch) {
      console.log(`[beehiiv] Rascunho já registrado com o mesmo conteúdo (${prev.postId ?? "mock"}). Nada a fazer (idempotente).`);
      printStatus(prev);
      return { record: prev, errors: [], noop: true };
    }
  }

  const payload = buildPayload({ subject, preheader, html, slug, action, scheduledAt, tags });
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/${slug}.request.json`, JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(`${OUT_DIR}/${slug}.preview.html`, html);
  const localPreview = `${OUT_DIR}/${slug}.preview.html`;

  const apiKey = process.env.BEEHIIV_API_KEY?.trim();
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID?.trim();
  const live = Boolean(apiKey && publicationId) && !dryRun;

  const nowIso = new Date().toISOString();
  const record = {
    ...meta,
    slug,
    contentHash: hash,
    action,
    mode: live ? "live" : (dryRun ? "dry-run" : "mock"),
    postId: prev?.postId ?? null,
    previewUrl: prev?.previewUrl ?? localPreview,
    postUrl: prev?.postUrl ?? null,
    scheduledAt: scheduledAt ?? null,
    testRequestedFor: test ?? prev?.testRequestedFor ?? null,
    status: action === "publish" ? "published" : action === "schedule" ? "scheduled" : "draft",
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
    console.log(`[beehiiv] Modo ${record.mode}: nada enviado à API. Payload em ${OUT_DIR}/${slug}.request.json.`);
  }

  const history = Array.isArray(prev?.history) ? prev.history : [];
  history.push({ at: nowIso, action, mode: record.mode, status: record.status, contentHash: hash, forced: force });
  ledger.posts[slug] = { ...record, history };
  saveLedger(ledger);
  writeReport(slug, record, errors);
  printStatus(record);
  return { record, errors };
}
