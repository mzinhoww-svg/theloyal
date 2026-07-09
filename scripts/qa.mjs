// QA global do The Loyalty: audita landing, JSON editorial, e-mail HTML e página
// web. Bloqueia (exit 1) qualquer regra inviolável quebrada.
// Uso: node scripts/qa.mjs   (rode `npm run render` antes, para o e-mail existir)
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { DISCLAIMER, EMOJI_RE, URGENCY_RE, collectStrings, listEditionFiles, loadEdition } from "./lib.mjs";
import { validateEdition } from "./validate.mjs";

const blocks = [];
const warns = [];
const passes = [];
const block = (m) => blocks.push(m);
const warn = (m) => warns.push(m);
const pass = (m) => passes.push(m);

// Componentes onde hex é permitido (exceção do mascote/gráficos).
const HEX_EXEMPT = new Set(["PontoMascot.tsx", "graphics.tsx"]);
// Cores default do Tailwind proibidas. gray/green/blue/yellow/red são tokens
// redefinidos da marca — permitidos.
const DEFAULT_COLOR_RE = /\b(?:bg|text|border|from|to|via|ring|fill|stroke|divide|placeholder|decoration|accent|outline)-(?:white|black|slate|zinc|neutral|stone|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|amber|orange|lime)(?:-\d{2,3})?\b/;
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

// ---------- 1. Landing / web: código-fonte dos componentes ----------
function auditSource() {
  const files = [...walk("app"), ...walk("components")];
  let hexHits = 0, defaultHits = 0;
  for (const f of files) {
    const base = f.split("/").pop();
    const src = readFileSync(f, "utf8");
    if (!HEX_EXEMPT.has(base) && HEX_RE.test(src)) { block(`Hex hardcoded em componente: ${f}`); hexHits++; }
    if (DEFAULT_COLOR_RE.test(src)) { block(`Cor default do Tailwind em ${f}: ${src.match(DEFAULT_COLOR_RE)[0]}`); defaultHits++; }
  }
  if (!hexHits) pass("Nenhum hex hardcoded fora de PontoMascot/graphics");
  if (!defaultHits) pass("Nenhuma cor default do Tailwind (bg-white/slate/indigo…)");

  // Disclaimer obrigatório no footer e na metodologia. Check semântico
  // (site oficial + transferir/resgatar, whitespace normalizado): aceita a
  // redação reescrita no rebrand sem ditar a copy exata.
  const footer = readFileSync("components/shell.tsx", "utf8");
  const metodo = readFileSync("components/sections.tsx", "utf8");
  const hasDisclaimer = (s) => {
    const t = s.replace(/\s+/g, " ");
    return /site oficial/i.test(t) && /transferir ou resgatar/i.test(t);
  };
  if (hasDisclaimer(footer)) pass("Disclaimer presente no footer");
  else block("Disclaimer ausente no footer (shell.tsx)");
  if (hasDisclaimer(metodo)) pass("Disclaimer presente na metodologia");
  else block("Disclaimer ausente na metodologia (sections.tsx)");

  // Fundo de página Paper, nunca branco.
  const globals = readFileSync("app/globals.css", "utf8");
  if (/bg-paper/.test(globals) && !/body[^}]*background:\s*#fff/i.test(globals)) pass("Fundo de página é Paper (bg-paper), não branco");
}

// ---------- 2. JSON editorial ----------
function auditEditions() {
  const files = listEditionFiles();
  if (!files.length) { warn("Nenhuma edição em content/editions/"); return; }
  for (const f of files) {
    const ed = loadEdition(`content/editions/${f}`);
    const r = validateEdition(ed);
    if (r.errors.length) r.errors.forEach((m) => block(`JSON Nº ${ed.number}: ${m}`));
    else pass(`JSON Nº ${ed.number}: validação editorial OK`);
  }
}

// ---------- 3. E-mail HTML gerado (edição + Pro) ----------
function auditEmailDir(dir) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".html"))) {
    const tag = `E-mail ${dir}/${f}`;
    const html = readFileSync(join(dir, f), "utf8");
    const textish = html.replace(/<[^>]+>/g, " ");
    if (EMOJI_RE.test(textish)) block(`${tag}: emoji no corpo`);
    if (URGENCY_RE.test(textish)) block(`${tag}: urgência artificial`);
    if (/color:\s*#F2C94C/i.test(html)) block(`${tag}: amarelo (#F2C94C) usado como texto`);
    if (/<script/i.test(html)) block(`${tag}: contém <script> (proibido em e-mail)`);
    if (/(?:src|background)\s*=?\s*["']?https?:\/\//i.test(html) || /url\(\s*https?:/i.test(html)) block(`${tag}: carrega recurso externo (deve ser self-contained)`);
    if (!html.includes(DISCLAIMER)) block(`${tag}: disclaimer oficial ausente`);
    if (!blocks.some((m) => m.startsWith(tag))) pass(`${tag}: sem emoji/urgência, self-contained, disclaimer presente`);
  }
}

function auditEmail() {
  if (!existsSync("out/email") && !existsSync("out/pro-email")) { warn("out/email ausente — rode `npm run render`"); return; }
  auditEmailDir("out/email");
  auditEmailDir("out/pro-email");
}

function main() {
  auditSource();
  auditEditions();
  auditEmail();

  console.log("== TL QA ==");
  passes.forEach((m) => console.log(`  ✓ ${m}`));
  warns.forEach((m) => console.log(`  ! ${m}`));
  blocks.forEach((m) => console.log(`  ✗ ${m}`));
  console.log(`\n${blocks.length ? "REPROVADO" : "APROVADO"} — ${blocks.length} bloqueio(s), ${warns.length} aviso(s), ${passes.length} ok`);
  process.exit(blocks.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
