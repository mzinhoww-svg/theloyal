// Publisher do The Loyal Weekly no Beehiiv.
// Publica a Weekly JÁ RENDERIZADA (out/weekly/<slug>.html + out/weekly-plain/
// <slug>.txt) sem reescrever conteúdo. Plumbing compartilhado em beehiiv-core.mjs
// (o mesmo do Daily — uma trilha só, sem "gêmeos"). Idempotente, mock sem
// credencial, status em content/beehiiv-status.json.
//
// Uso:
//   node scripts/beehiiv-publish-weekly.mjs [content/weekly/AAAA-Wnn.json] [opções]
//   --draft (default) · --publish · --schedule <ISO> · --test <email> · --force · --dry-run
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { renderWeeklyEmail, renderWeeklyPlain, validateWeekly } from "./render-weekly.mjs";
import { fail, parseArgs, publish } from "./beehiiv-core.mjs";

const WEEKLY_DIR = "content/weekly";

function weeklySlug(wk) {
  return wk.slug ?? `weekly-${String(wk.number).padStart(4, "0")}`;
}

// Resolve a Weekly a publicar: caminho explícito, ou a última em content/weekly
// (ignora rascunhos *.draft.json).
function resolveWeekly(path) {
  if (path) return { wk: JSON.parse(readFileSync(path, "utf8")), origin: path };
  if (existsSync(WEEKLY_DIR)) {
    const files = readdirSync(WEEKLY_DIR).filter((f) => f.endsWith(".json") && !f.endsWith(".draft.json")).sort();
    if (files.length) {
      const p = `${WEEKLY_DIR}/${files[files.length - 1]}`;
      return { wk: JSON.parse(readFileSync(p, "utf8")), origin: p };
    }
  }
  throw new Error("Sem Weekly: passe content/weekly/AAAA-Wnn.json ou gere uma edição antes.");
}

// Lê o artefato JÁ RENDERIZADO; regenera (avisando) só se ausente.
function readRendered(wk, kind) {
  const slug = weeklySlug(wk);
  const file = kind === "email" ? `out/weekly/${slug}.html` : `out/weekly-plain/${slug}.txt`;
  if (existsSync(file)) return { content: readFileSync(file, "utf8"), regenerated: false };
  const content = kind === "email" ? renderWeeklyEmail(wk) : renderWeeklyPlain(wk);
  return { content, regenerated: true };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { wk, origin } = resolveWeekly(opts.path);
  const slug = weeklySlug(wk);
  const scheduledAt = opts.action === "schedule" ? opts.schedule : (opts.action === "publish" ? null : wk.scheduledAt ?? null);

  if (opts.action === "schedule") {
    if (!scheduledAt) fail("--schedule exige um ISO 8601, ex: --schedule 2026-07-20T09:00:00-03:00");
    if (Number.isNaN(Date.parse(scheduledAt))) fail(`--schedule inválido: ${scheduledAt}`);
  }
  if (!wk.subject) fail("A Weekly precisa de `subject` para virar title no Beehiiv. Adicione ao JSON final.");

  console.log(`[beehiiv] Weekly Nº ${wk.number} (${origin}) → slug "${slug}", ação "${opts.action}".`);

  // 1. QA gate — as mesmas regras invioláveis do Daily (validateWeekly).
  const qa = validateWeekly(wk);
  if (qa.errors.length) {
    qa.errors.forEach((e) => console.error(`  ✗ ${e}`));
    fail(`QA da Weekly falhou (${qa.errors.length} erro(s)). Nada foi enviado.`);
  }
  console.log(`[beehiiv] QA OK — ${qa.warnings.length} aviso(s).`);

  // 2. Conteúdo já renderizado (não reescreve).
  const email = readRendered(wk, "email");
  const plain = readRendered(wk, "plain");
  if (email.regenerated || plain.regenerated) {
    console.warn("[beehiiv] Aviso: artefato ausente foi regenerado. Rode npm run weekly para versionar a peça.");
  }

  // 3. Núcleo compartilhado (mesmo do Daily).
  const { errors } = await publish({
    meta: { number: wk.number, period: wk.period, productType: "weekly" },
    subject: wk.subject, preheader: wk.preheader, tags: Array.isArray(wk.tags) ? wk.tags : [],
    html: email.content, plain: plain.content,
    slug, action: opts.action, scheduledAt, test: opts.test, force: opts.force, dryRun: opts.dryRun,
  });
  if (errors.length) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(`[beehiiv] Erro: ${err.message ?? err}`); process.exit(1); });
}

export { weeklySlug };
