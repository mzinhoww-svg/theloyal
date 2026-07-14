// Publicação: valida, e se aprovado escreve content/latest.json e
// content/index.json. NÃO envia e-mail — o envio é um passo manual (revisão + PR).
// Uso: node scripts/publish.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { editionSlug, listEditionFiles, loadEdition } from "./lib.mjs";
import { validateEdition } from "./validate.mjs";

function main() {
  const files = listEditionFiles();
  if (!files.length) { console.error("Nenhuma edição em content/editions/."); process.exit(1); }

  const editions = files.map((f) => loadEdition(`content/editions/${f}`));

  // Gate: nenhuma edição pode ter erro de QA. O relatório de QA (out/qa/NNNN.md)
  // é produzido pelo render:system; aqui só validamos, sem sobrescrevê-lo.
  let blocked = false;
  for (const ed of editions) {
    const result = validateEdition(ed);
    if (result.errors.length) {
      blocked = true;
      console.error(`[publish] BLOQUEADO — Nº ${ed.number} tem ${result.errors.length} erro(s) de QA. Ver out/qa/${editionSlug(ed)}.md`);
    }
  }
  if (blocked) process.exit(1);

  const sorted = [...editions].sort((a, b) => b.number - a.number);
  const latest = sorted[0];

  const index = sorted.map((ed) => ({
    number: ed.number,
    date: ed.date,
    weekday: ed.weekday,
    subject: ed.subject ?? null,
    readingMinutes: ed.readingMinutes,
    deals: ed.deals.length,
    illustrative: Boolean(ed.illustrative),
    file: `content/editions/${editionSlug(ed)}.json`,
  }));

  mkdirSync("content", { recursive: true });
  writeFileSync("content/latest.json", JSON.stringify({ ...latest, generatedAt: new Date().toISOString() }, null, 2) + "\n");
  writeFileSync("content/index.json", JSON.stringify({ count: index.length, editions: index }, null, 2) + "\n");

  console.log(`[publish] OK — ${index.length} edição(ões). Última: Nº ${latest.number} (${latest.date}).`);
  console.log("[publish] content/latest.json e content/index.json atualizados.");
  console.log("[publish] E-MAIL NÃO ENVIADO (envio é manual). Revise out/email, abra/atualize o PR e envie pelo Beehiiv após aprovação.");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
