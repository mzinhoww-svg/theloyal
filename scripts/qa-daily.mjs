#!/usr/bin/env node
// Sistema de QA do The Loyal Daily.
//   node scripts/qa-daily.mjs <edition.json> [--now ISO] [--out qa.md]
// Saida: APROVADO/REPROVADO, bloqueios, avisos, correcoes sugeridas. exit 0/1.
import fs from "node:fs";
import { auditEdition } from "../renderer/audit.mjs";

const args = process.argv.slice(2);
const nowIdx = args.indexOf("--now");
const outIdx = args.indexOf("--out");
const now = nowIdx >= 0 ? args[nowIdx + 1] : undefined;
const out = outIdx >= 0 ? args[outIdx + 1] : null;
const input = args.find((a, i) => !a.startsWith("--") && !(nowIdx >= 0 && i === nowIdx + 1) && !(outIdx >= 0 && i === outIdx + 1));

if (!input) { console.error("uso: node scripts/qa-daily.mjs <edition.json> [--now ISO] [--out qa.md]"); process.exit(2); }

let ed;
try { ed = JSON.parse(fs.readFileSync(input, "utf8")); }
catch (e) { console.error("REPROVADO\nBLOQUEIO [integridade JSON]: JSON invalido -", e.message); process.exit(1); }

const r = auditEdition(ed, { now });

const lines = [];
const push = (s = "") => lines.push(s);
push(`RESULTADO: ${r.approved ? "APROVADO" : "REPROVADO"}`);
push(`Dimensoes com apontamento: ${r.dimensions.length ? r.dimensions.join(", ") : "nenhuma"}`);
push("");
push(`BLOQUEIOS (${r.blocks.length})`);
if (!r.blocks.length) push("  nenhum");
for (const b of r.blocks) { push(`  [${b.dimensao}] ${b.msg}`); push(`      correcao: ${b.correcao}`); }
push("");
push(`AVISOS (${r.warnings.length})`);
if (!r.warnings.length) push("  nenhum");
for (const w of r.warnings) { push(`  [${w.dimensao}] ${w.msg}`); push(`      correcao: ${w.correcao}`); }
push("");
push("CONTRASTE (ratios)");
for (const c of r.contrast) push(`  ${c.pass ? "OK " : "!! "} ${c.ratio}:1  ${c.role}`);

const report = lines.join("\n");
console.log(report);

if (out) {
  const md = [
    `# QA . The Loyal Daily${ed.meta?.numero ? ` . No ${ed.meta.numero}` : ""}`, "",
    `**Resultado:** ${r.approved ? "APROVADO" : "REPROVADO"}`, "",
    `## Bloqueios (${r.blocks.length})`,
    ...(r.blocks.length ? r.blocks.map((b) => `- **[${b.dimensao}]** ${b.msg}\n  - correcao: ${b.correcao}`) : ["nenhum"]), "",
    `## Avisos (${r.warnings.length})`,
    ...(r.warnings.length ? r.warnings.map((w) => `- **[${w.dimensao}]** ${w.msg}\n  - correcao: ${w.correcao}`) : ["nenhum"]), "",
    `## Contraste`,
    ...r.contrast.map((c) => `- ${c.pass ? "OK" : "FALHA"} \`${c.ratio}:1\` ${c.role}`), "",
    `## Calculo`, `- ${r.calculo.ok === true ? "OK" : r.calculo.ok === false ? "FALHA" : "N/D"}: ${r.calculo.msg}`, "",
  ].join("\n");
  fs.writeFileSync(out, md);
  console.log(`\nRelatorio salvo em ${out}`);
}

process.exit(r.approved ? 0 : 1);
