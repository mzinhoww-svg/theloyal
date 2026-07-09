#!/usr/bin/env node
// CLI de validacao do The Loyal Daily.
//   node scripts/validate-daily.mjs <edition.json> [--now ISO] [--lenient]
// exit 0 = valido, 1 = com erros.
import fs from "node:fs";
import { validateEdition } from "../renderer/validate.mjs";

const args = process.argv.slice(2);
const lenient = args.includes("--lenient");
const nowIdx = args.indexOf("--now");
const now = nowIdx >= 0 ? args[nowIdx + 1] : undefined;
const input = args.find((a, i) => !a.startsWith("--") && !(nowIdx >= 0 && i === nowIdx + 1));

if (!input) { console.error("uso: node scripts/validate-daily.mjs <edition.json> [--now ISO] [--lenient]"); process.exit(2); }

const ed = JSON.parse(fs.readFileSync(input, "utf8"));
const { errors, warnings, stats } = validateEdition(ed, { lenient, now });

for (const w of warnings) console.error("AVISO:", w);
for (const e of errors) console.error("ERRO:", e);
console.error(`\nDeals: ${stats.deals}/3 . Program: ${stats.program_watch}/5 . Bank: ${stats.bank_cards_watch}/5 . Retail: ${stats.retail_coalition}/5 . Sinais: ${stats.sinais_rapidos}/5`);
console.log(errors.length ? `REPROVADO: ${errors.length} erro(s)` : "APROVADO");
process.exit(errors.length ? 1 : 0);
