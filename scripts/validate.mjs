// Validação editorial: aplica as regras invioláveis e os checklists de QA do
// Operating Manual (fonte, cálculo, vigência, vocabulário) e gera um QA report.
// Uso: node scripts/validate.mjs [caminho-da-edicao.json]
import { mkdirSync, writeFileSync } from "node:fs";
import {
  DISCLAIMER, EMOJI_RE, URGENCY_RE, INTERNAL_RE, VERDICTS, TL_WEIGHTS,
  collectStrings, editionSlug, isExpired, isValidLink, listEditionFiles, loadEdition, verdictForScore,
} from "./lib.mjs";

const REQUIRED = ["number", "date", "weekday", "publishTime", "readingMinutes", "signal", "deals", "sources", "disclaimer"];
// Blocos obrigatórios da estrutura editorial (não só campos escalares).
const REQUIRED_BLOCKS = ["signal", "deals", "sources", "disclaimer"];
const DEAL_REQUIRED = ["category", "title", "context", "conta", "verdict", "source"];

export function validateEdition(ed) {
  const errors = [];
  const warnings = [];
  const ok = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  const pass = (m) => ok.push(m);

  // 1. Campos obrigatórios da estrutura do Daily.
  const missing = REQUIRED.filter((k) => ed[k] === undefined || ed[k] === null || ed[k] === "");
  if (missing.length) err(`Campos obrigatórios ausentes: ${missing.join(", ")}`);
  else pass("Estrutura do Daily completa (todos os campos obrigatórios presentes)");

  // 2. Disclaimer obrigatório (regra inviolável 10).
  if (typeof ed.disclaimer === "string" && ed.disclaimer.includes(DISCLAIMER)) pass("Disclaimer presente e íntegro");
  else err("Disclaimer ausente ou alterado — deve conter a frase oficial completa");

  // 3. Sem emoji no corpo (regra inviolável 5).
  const strings = collectStrings(ed);
  const withEmoji = strings.filter((s) => EMOJI_RE.test(s));
  if (withEmoji.length) err(`Emoji proibido no corpo editorial: ${withEmoji.slice(0, 2).map((s) => JSON.stringify(s.slice(0, 40))).join(", ")}`);
  else pass("Zero emoji no corpo editorial");

  // 4. Sem urgência artificial (regra inviolável 4).
  const withUrgency = strings.filter((s) => URGENCY_RE.test(s));
  if (withUrgency.length) err(`Urgência artificial proibida: ${withUrgency.slice(0, 2).map((s) => JSON.stringify(s.slice(0, 50))).join(", ")}`);
  else pass("Sem urgência artificial (imperdível/corra/última chance…)");

  // 4b. Sem dado interno / CMI / métrica proprietária (regra inviolável 1).
  const withInternal = strings.filter((s) => INTERNAL_RE.test(s));
  if (withInternal.length) err(`Dado interno/CMI proibido no corpo editorial: ${withInternal.slice(0, 2).map((s) => JSON.stringify(s.slice(0, 50))).join(", ")}`);
  else pass("Sem dado interno / CMI / métrica proprietária");

  // 4c. Blocos obrigatórios presentes e não-vazios.
  const emptyBlocks = REQUIRED_BLOCKS.filter((b) => {
    const v = ed[b];
    return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  });
  if (emptyBlocks.length) err(`Blocos obrigatórios ausentes ou vazios: ${emptyBlocks.join(", ")}`);
  else pass("Blocos obrigatórios presentes (sinal, Deal Desk, fontes, disclaimer)");

  // 5. Deal Desk: fonte, vigência, cálculo, TL Score ↔ veredito.
  const deals = Array.isArray(ed.deals) ? ed.deals : [];
  if (!deals.length) warn("Deal Desk vazio: nenhuma oportunidade na edição");
  deals.forEach((d, i) => {
    const tag = `Deal ${i + 1} (${d.title ?? "sem título"})`;

    // Estrutura do bloco: todos os campos obrigatórios do deal.
    const dealMissing = DEAL_REQUIRED.filter((k) => d[k] === undefined || d[k] === null || d[k] === "");
    if (dealMissing.length) err(`${tag}: campos obrigatórios ausentes: ${dealMissing.join(", ")}`);

    if (!d.source) err(`${tag}: sem fonte — sem fonte confiável não entra no Deal Desk (overrule)`);
    // Integridade do Conta Block: linhas + resultado completo.
    if (!d.conta || !Array.isArray(d.conta.rows) || d.conta.rows.length === 0) err(`${tag}: Conta Block sem linhas de cálculo`);
    if (!d.conta || !d.conta.result || !d.conta.result[1]) err(`${tag}: Conta Block incompleto (falta o resultado)`);
    if (!(d.verdict in VERDICTS)) { err(`${tag}: veredito "${d.verdict}" fora do vocabulário oficial`); return; }

    // Link da fonte do deal (quando presente) deve ser http(s) válido; https recomendado.
    if (d.sourceUrl !== undefined) {
      if (!/^https?:\/\//.test(d.sourceUrl)) err(`${tag}: sourceUrl inválida (deve ser http(s) absoluta)`);
      else if (!isValidLink(d.sourceUrl)) warn(`${tag}: sourceUrl não usa https`);
    }

    const hasVigencia = Boolean(d.vigencia);

    // Overrule Operating Manual 5.4: sem vigência confirmada → Não confirmado.
    if (!hasVigencia && d.verdict !== "nao-confirmado") {
      err(`${tag}: sem vigência confirmada, o veredito final deve ser "nao-confirmado" (overrule 5.4)`);
    }

    // Vigência já vencida em relação à data da edição → o deal não está mais vivo.
    if (hasVigencia && ed.date && isExpired(d.vigencia, ed.date)) {
      err(`${tag}: vigência (${d.vigencia}) já vencida na data da edição (${ed.date})`);
    }

    if (d.verdict === "nao-confirmado") {
      pass(`${tag}: Não confirmado — consistente`);
      return;
    }

    if (typeof d.tlScore !== "number" || d.tlScore < 0 || d.tlScore > 100) {
      err(`${tag}: TL Score ausente ou fora de 0–100`);
    } else {
      const expected = verdictForScore(d.tlScore);
      if (expected !== d.verdict) err(`${tag}: TL Score ${d.tlScore} mapeia para "${expected}", mas o veredito é "${d.verdict}"`);
      else pass(`${tag}: TL Score ${d.tlScore} ↔ ${VERDICTS[d.verdict].label} coerente`);
    }

    // Se houver breakdown dos 8 critérios, a soma ponderada tem de fechar.
    if (d.scoreBreakdown) {
      const sum = Object.entries(TL_WEIGHTS).reduce((acc, [k, w]) => acc + (Number(d.scoreBreakdown[k] ?? 0) / 100) * w, 0);
      if (Math.round(sum) !== d.tlScore) err(`${tag}: soma ponderada do breakdown (${Math.round(sum)}) ≠ TL Score declarado (${d.tlScore})`);
      else pass(`${tag}: breakdown fecha com o TL Score (conta feita)`);
    }
  });

  // 6. Fontes com URL.
  const sources = Array.isArray(ed.sources) ? ed.sources : [];
  if (!sources.length) err("Nenhuma fonte listada na edição");
  sources.forEach((s, i) => {
    if (!s.label) warn(`Fonte ${i + 1}: sem rótulo`);
    if (!/^https?:\/\//.test(s.url ?? "")) err(`Fonte ${i + 1}: URL inválida ou ausente`);
    else if (!isValidLink(s.url)) warn(`Fonte ${i + 1}: URL não usa https`);
  });
  if (sources.every((s) => /^https?:\/\//.test(s.url ?? "")) && sources.length) pass("Todas as fontes têm URL válida");

  // Vigência dos itens "Fecha logo" (quando presente): não pode estar vencida.
  (Array.isArray(ed.fechaLogo) ? ed.fechaLogo : []).forEach((f, i) => {
    if (f.vigencia && ed.date && isExpired(f.vigencia, ed.date)) {
      err(`Fecha logo ${i + 1} (${f.tag ?? "sem tag"}): vigência (${f.vigencia}) já vencida na data da edição`);
    }
  });

  // Shopping · VPM observado (opcional): dado público, com fonte, framing "observado".
  const shopping = Array.isArray(ed.shoppingWatch) ? ed.shoppingWatch : [];
  shopping.forEach((s, i) => {
    const tag = `Shopping ${i + 1} (${s.player ?? "sem player"})`;
    const req = ["player", "category", "vpmObservado", "source"].filter((k) => !s[k]);
    if (req.length) err(`${tag}: campos obrigatórios ausentes: ${req.join(", ")}`);
    if (s.sourceUrl !== undefined && !/^https?:\/\//.test(s.sourceUrl)) err(`${tag}: sourceUrl inválida (http(s) absoluta)`);
    else if (s.sourceUrl !== undefined && !isValidLink(s.sourceUrl)) warn(`${tag}: sourceUrl não usa https`);
  });
  if (shopping.length) pass(`Shopping · VPM observado: ${shopping.length} leitura(s) de catálogo público`);

  return { errors, warnings, ok };
}

export function report(ed, result) {
  const slug = editionSlug(ed);
  const status = result.errors.length ? "FALHOU" : "APROVADA";
  const lines = [];
  lines.push(`# QA report — Edição Nº ${ed.number} (${ed.date})`);
  lines.push("");
  lines.push(`**Status:** ${status} · ${result.errors.length} erro(s), ${result.warnings.length} aviso(s)`);
  if (ed.illustrative) lines.push("", "> Edição ilustrativa. Números de exemplo.");
  lines.push("", "## Conformidade", "");
  result.ok.forEach((m) => lines.push(`- [x] ${m}`));
  if (result.warnings.length) {
    lines.push("", "## Avisos", "");
    result.warnings.forEach((m) => lines.push(`- [!] ${m}`));
  }
  if (result.errors.length) {
    lines.push("", "## Erros (bloqueiam a publicação)", "");
    result.errors.forEach((m) => lines.push(`- [ ] ${m}`));
  }
  lines.push("");
  const md = lines.join("\n");
  mkdirSync("out/qa", { recursive: true });
  writeFileSync(`out/qa/${slug}.md`, md);
  return md;
}

function main() {
  const arg = process.argv[2];
  const files = arg ? [arg] : listEditionFiles().map((f) => `content/editions/${f}`);
  if (!files.length) { console.error("Nenhuma edição encontrada em content/editions/."); process.exit(1); }
  let failed = false;
  for (const path of files) {
    const ed = loadEdition(path);
    const result = validateEdition(ed);
    report(ed, result);
    const status = result.errors.length ? "FALHOU" : "OK";
    console.log(`[validate] Nº ${ed.number}: ${status} — ${result.errors.length} erro(s), ${result.warnings.length} aviso(s) → out/qa/${String(ed.number).padStart(4, "0")}.md`);
    result.errors.forEach((m) => console.log(`  ✗ ${m}`));
    if (result.errors.length) failed = true;
  }
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
