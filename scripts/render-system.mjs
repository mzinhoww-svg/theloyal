// Sistema de renderização do The Loyalty.
// Entrada: UM JSON editorial (content/edition.schema.json).
// Saídas, a partir dessa única fonte de verdade:
//   1. E-mail HTML email-safe .............. out/email/NNNN.html
//   2. Plain text fallback ................. out/plain/NNNN.txt
//   3. HTML web archive (React) ........... out/web/NNNN.html
//   4. Relatório de QA .................... out/qa/NNNN.md
//   5. Lista de arquivos gerados (manifest) out/manifest/NNNN.json
//
// Além de renderizar, o sistema VALIDA (estrutura, vigência, links, disclaimer,
// campos e blocos obrigatórios, integridade do conteúdo) e AUDITA os artefatos
// gerados contra as regras de e-mail-safe e de marca. Bloqueia (exit 1) em erro.
//
// Uso: node scripts/render-system.mjs [caminho-da-edicao.json]
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { EMOJI_RE, URGENCY_RE, INTERNAL_RE, DISCLAIMER, editionSlug, listEditionFiles, loadEdition } from "./lib.mjs";
import { validateEdition } from "./validate.mjs";
import { renderEmail, renderPlain } from "./render.mjs";
import { renderWebArchive } from "./render-web.mjs";

// ---------- Auditoria dos artefatos GERADOS ----------

// E-mail: 600px, coluna única, CSS inline, self-contained, sem :root/JS/fontes
// externas/imagem, disclaimer íntegro, sem emoji/urgência/amarelo-texto.
function auditEmail(html) {
  const checks = [];
  const ck = (ok, label) => checks.push({ ok, label });
  const text = html.replace(/<[^>]+>/g, " ");
  ck(/<!doctype html>/i.test(html), "Tem doctype");
  ck(/width=("|')?600\b/.test(html), "Coluna única de 600px");
  ck(!/<style[\s>]/i.test(html), "Sem <style> (CSS 100% inline)");
  ck(!/:root/.test(html), "Sem :root");
  ck(!/<script/i.test(html), "Sem JavaScript");
  ck(!/fonts\.(googleapis|gstatic)\.com/i.test(html), "Sem Google Fonts");
  ck(!/@import/i.test(html), "Sem @import");
  ck(!/(?:src|background)\s*=?\s*["']?https?:\/\//i.test(html) && !/url\(\s*https?:/i.test(html), "Self-contained (nenhum recurso externo carregado)");
  ck(!/<img[\s>]/i.test(html), "Sem imagem (nada de stock/avião)");
  ck(!/color:\s*#F2C94C/i.test(html), "Amarelo nunca como texto");
  ck(!EMOJI_RE.test(text), "Sem emoji no corpo");
  ck(!URGENCY_RE.test(text), "Sem urgência artificial");
  ck(!INTERNAL_RE.test(text), "Sem dado interno / CMI");
  ck(html.includes(DISCLAIMER), "Disclaimer oficial íntegro");
  return checks;
}

// Web archive: usa as três fontes da marca, landmarks e h1 únicos, self-contained
// (exceto fontes), sem JS/imagem/emoji, disclaimer presente.
function auditWeb(html) {
  const checks = [];
  const ck = (ok, label) => checks.push({ ok, label });
  const text = html.replace(/<[^>]+>/g, " ");
  ck(/<html lang="pt-BR"/.test(html), 'html lang="pt-BR"');
  ck((html.match(/<h1[\s>]/gi) ?? []).length === 1, "Exatamente uma h1");
  ck(/<main id="conteudo"/.test(html), "Landmark main#conteudo");
  ck(/Fraunces/.test(html) && /Inter/.test(html) && /JetBrains\+?\s?Mono/.test(html), "Fraunces + Inter + JetBrains Mono");
  ck(!/<script/i.test(html), "Sem JavaScript");
  ck(!/<img[\s>]/i.test(html), "Sem imagem (nada de stock/avião)");
  ck(!EMOJI_RE.test(text), "Sem emoji no corpo");
  ck(!URGENCY_RE.test(text), "Sem urgência artificial");
  ck(!INTERNAL_RE.test(text), "Sem dado interno / CMI");
  ck(html.includes(DISCLAIMER), "Disclaimer oficial presente");
  return checks;
}

// ---------- Relatório de QA (Markdown) ----------

function buildReport(ed, editorial, emailChecks, webChecks) {
  const artifactFail = [...emailChecks, ...webChecks].filter((c) => !c.ok);
  const blocked = editorial.errors.length > 0 || artifactFail.length > 0;
  const status = blocked ? "FALHOU" : "APROVADA";
  const L = [];
  L.push(`# QA report — Edição Nº ${ed.number} (${ed.date})`, "");
  L.push(`**Status:** ${status} · ${editorial.errors.length} erro(s) editorial(is), ${artifactFail.length} falha(s) de artefato, ${editorial.warnings.length} aviso(s)`);
  if (ed.illustrative) L.push("", "> Edição ilustrativa. Números de exemplo.");

  L.push("", "## Validação editorial", "");
  editorial.ok.forEach((m) => L.push(`- [x] ${m}`));
  if (editorial.warnings.length) {
    L.push("", "### Avisos", "");
    editorial.warnings.forEach((m) => L.push(`- [!] ${m}`));
  }
  if (editorial.errors.length) {
    L.push("", "### Erros (bloqueiam a publicação)", "");
    editorial.errors.forEach((m) => L.push(`- [ ] ${m}`));
  }

  L.push("", "## Artefato — E-mail (email-safe)", "");
  emailChecks.forEach((c) => L.push(`- [${c.ok ? "x" : " "}] ${c.label}`));

  L.push("", "## Artefato — Web archive", "");
  webChecks.forEach((c) => L.push(`- [${c.ok ? "x" : " "}] ${c.label}`));

  L.push("");
  return { md: L.join("\n"), blocked, status };
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function fileEntry(type, path) {
  const buf = readFileSync(path);
  return { type, path, bytes: buf.length, sha256: sha256(buf) };
}

// ---------- Pipeline de uma edição ----------

export function renderSystem(ed, { generatedAt } = {}) {
  const slug = editionSlug(ed);
  ["out/email", "out/plain", "out/web", "out/qa", "out/manifest"].forEach((d) => mkdirSync(d, { recursive: true }));

  // 1–3. Renderizações a partir do único JSON.
  const emailHtml = renderEmail(ed);
  const plainTxt = renderPlain(ed);
  const webHtml = renderWebArchive(ed);
  writeFileSync(`out/email/${slug}.html`, emailHtml);
  writeFileSync(`out/plain/${slug}.txt`, plainTxt);
  writeFileSync(`out/web/${slug}.html`, webHtml);

  // Validação editorial + auditoria dos artefatos gerados.
  const editorial = validateEdition(ed);
  const emailChecks = auditEmail(emailHtml);
  const webChecks = auditWeb(webHtml);

  // 4. Relatório de QA.
  const { md, blocked, status } = buildReport(ed, editorial, emailChecks, webChecks);
  writeFileSync(`out/qa/${slug}.md`, md);

  // 5. Lista de arquivos gerados (manifest).
  const outputs = [
    fileEntry("email", `out/email/${slug}.html`),
    fileEntry("plain", `out/plain/${slug}.txt`),
    fileEntry("web", `out/web/${slug}.html`),
    fileEntry("qa", `out/qa/${slug}.md`),
  ];
  const manifest = {
    number: ed.number,
    date: ed.date,
    slug,
    status,
    generatedAt: generatedAt ?? new Date().toISOString(),
    input: `content/editions/${slug}.json`,
    outputs,
    qa: {
      blocked,
      editorial: {
        errors: editorial.errors,
        warnings: editorial.warnings,
        okCount: editorial.ok.length,
      },
      artifacts: {
        email: emailChecks,
        web: webChecks,
      },
    },
  };
  const manifestPath = `out/manifest/${slug}.json`;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  // O manifest lista a si mesmo por último (self-referência intencional).
  manifest.outputs.push({ type: "manifest", path: manifestPath, bytes: null, sha256: null });

  return { manifest, blocked, status };
}

function main() {
  const arg = process.argv[2];
  const files = arg ? [arg] : listEditionFiles().map((f) => `content/editions/${f}`);
  if (!files.length) { console.error("Nenhuma edição encontrada em content/editions/."); process.exit(1); }

  let failed = false;
  for (const path of files) {
    const ed = loadEdition(path);
    const { manifest, blocked, status } = renderSystem(ed);
    console.log(`\n[render-system] Nº ${ed.number} — ${status}`);
    console.log("  Arquivos gerados:");
    for (const o of manifest.outputs) {
      const size = o.bytes == null ? "" : ` (${o.bytes} B)`;
      console.log(`    · ${o.type.padEnd(8)} ${o.path}${size}`);
    }
    if (blocked) {
      failed = true;
      const ed0 = manifest.qa.editorial.errors;
      const art = [...manifest.qa.artifacts.email, ...manifest.qa.artifacts.web].filter((c) => !c.ok);
      console.log("  QA BLOQUEADO:");
      ed0.forEach((m) => console.log(`    ✗ ${m}`));
      art.forEach((c) => console.log(`    ✗ artefato: ${c.label}`));
    }
  }
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
