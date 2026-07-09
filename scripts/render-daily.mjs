#!/usr/bin/env node
// CLI de render do The Loyal Daily.
//   node scripts/render-daily.mjs <edition.json> [outdir] [--now ISO] [--lenient]
// Gera: daily-email.html, daily-plaintext.txt, qa-report.md
// (o web archive e React: veja app/daily/preview e components/daily)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEdition } from "../renderer/validate.mjs";
import { renderEmail } from "../renderer/email.mjs";
import { renderPlaintext } from "../renderer/plaintext.mjs";
import { renderQA } from "../renderer/qa.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = { lenient: args.includes("--lenient") };
const nowIdx = args.indexOf("--now");
if (nowIdx >= 0) flags.now = args[nowIdx + 1];
const positional = args.filter((a, i) => !a.startsWith("--") && !(nowIdx >= 0 && i === nowIdx + 1));
const input = positional[0];
const outdir = positional[1] || "out";

if (!input) {
  console.error("uso: node scripts/render-daily.mjs <edition.json> [outdir] [--now ISO] [--lenient]");
  process.exit(2);
}

const ed = JSON.parse(fs.readFileSync(input, "utf8"));
const result = validateEdition(ed, { lenient: flags.lenient, now: flags.now });

for (const w of result.warnings) console.error("AVISO:", w);

fs.mkdirSync(outdir, { recursive: true });
const files = [];

if (result.errors.length) {
  for (const e of result.errors) console.error("ERRO:", e);
  const qaPath = path.join(outdir, "qa-report.md");
  fs.writeFileSync(qaPath, renderQA(ed, result, []));
  console.error(`\nRender abortado. QA em ${qaPath}. Corrija os erros ou use --lenient para limites.`);
  process.exit(1);
}

const emailPath = path.join(outdir, "daily-email.html");
const textPath = path.join(outdir, "daily-plaintext.txt");
fs.writeFileSync(emailPath, renderEmail(ed)); files.push(emailPath);
fs.writeFileSync(textPath, renderPlaintext(ed)); files.push(textPath);
const qaPath = path.join(outdir, "qa-report.md");
fs.writeFileSync(qaPath, renderQA(ed, result, files.concat("(web archive: /daily/preview via React)")));
files.push(qaPath);

console.log("OK. Arquivos gerados:");
for (const f of files) console.log("  " + f);
console.log("  web archive: rota React em /daily/preview");
