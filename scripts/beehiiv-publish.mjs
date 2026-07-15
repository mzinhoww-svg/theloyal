// Publisher do The Loyal Daily no Beehiiv.
// Publica o conteúdo JÁ RENDERIZADO (out/email/NNNN.html + out/plain/NNNN.txt)
// sem alterar nada editorialmente. Plumbing compartilhado em beehiiv-core.mjs.
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
import { existsSync, readFileSync } from "node:fs";
import { editionSlug, loadEdition, pad } from "./lib.mjs";
import { renderEmail, renderPlain } from "./render.mjs";
import { report, validateEdition } from "./validate.mjs";
import { buildPayload, contentHash, fail, parseArgs, publish } from "./beehiiv-core.mjs";

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
// arquivos por editionSlug (NNNN). Só regenera se o arquivo não existir — e
// avisa, para o operador rodar render antes.
function readRendered(ed, kind) {
  const renderSlug = editionSlug(ed);
  const file = kind === "email" ? `out/email/${renderSlug}.html` : `out/plain/${renderSlug}.txt`;
  if (existsSync(file)) return { content: readFileSync(file, "utf8"), source: file, regenerated: false };
  const content = kind === "email" ? renderEmail(ed) : renderPlain(ed);
  return { content, source: `${file} (regenerado — rode npm run render)`, regenerated: true };
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

  // 1. QA gate — não publicar sem QA.
  const qa = validateEdition(ed);
  report(ed, qa);
  if (qa.errors.length) {
    qa.errors.forEach((e) => console.error(`  ✗ ${e}`));
    fail(`QA falhou (${qa.errors.length} erro(s)). Ver out/qa/${editionSlug(ed)}.md. Nada foi enviado.`);
  }
  console.log(`[beehiiv] QA OK — ${qa.warnings.length} aviso(s).`);

  // 2. Conteúdo já renderizado (não reescreve).
  const email = readRendered(ed, "email");
  const plain = readRendered(ed, "plain");
  if (email.regenerated || plain.regenerated) {
    console.warn("[beehiiv] Aviso: artefato ausente foi regenerado. Rode npm run render para versionar a peça.");
  }

  // 3. Núcleo compartilhado: idempotência → payload → API/mock → ledger → status.
  const { errors } = await publish({
    meta: { number: ed.number, date: ed.date, productType: ed.productType ?? "daily" },
    subject: ed.subject, preheader: ed.preheader, tags,
    html: email.content, plain: plain.content,
    slug, action: opts.action, scheduledAt, test: opts.test, force: opts.force, dryRun: opts.dryRun,
  });
  if (errors.length) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(`[beehiiv] Erro: ${err.message ?? err}`); process.exit(1); });
}

export { buildPayload, contentHash, derivedSlug };
