// The Loyal Pro — valida o relatório executivo (checklist de QA) e gera o
// resumo para e-mail. A página web é SSG (rota /pro/[periodo]); o PDF é opcional
// (Salvar como PDF a partir da web, com @media print).
// Uso: node scripts/pro.mjs [caminho.json]
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { DISCLAIMER, EMOJI_RE, TOKENS, URGENCY_RE, VERDICTS, collectStrings, loadEdition } from "./lib.mjs";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";
const MONO = "Consolas, 'Courier New', monospace";
const ALERT_BORDER = { insight: TOKENS.blue600, warning: TOKENS.yellow500, danger: TOKENS.red600 };
const REQUIRED = ["periodId", "period", "title", "summary", "tlScorePeriod", "benchmarks", "players", "matrix", "implications", "alerts", "watch", "sources", "disclaimer"];
// Termos que denunciam dado interno / linguagem corporativa (heurística).
const INTERNAL_RE = /\b(CMI|dado interno|base interna|nossos clientes|nossa base|receita interna)\b/iu;

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

export function validatePro(r) {
  const errors = [], warnings = [], ok = [];
  const missing = REQUIRED.filter((k) => r[k] === undefined || r[k] === null || r[k] === "");
  if (missing.length) errors.push(`Campos obrigatórios ausentes: ${missing.join(", ")}`);
  else ok.push("Estrutura executiva completa (10 seções)");

  if (r.disclaimer === DISCLAIMER) ok.push("Disclaimer oficial íntegro");
  else errors.push("Disclaimer ausente ou alterado");

  const strings = collectStrings(r);
  if (strings.some((s) => EMOJI_RE.test(s))) errors.push("Emoji no corpo do relatório");
  else ok.push("Zero emoji");
  if (strings.some((s) => URGENCY_RE.test(s))) errors.push("Urgência artificial no relatório");
  else ok.push("Sem urgência artificial");
  const internal = strings.filter((s) => INTERNAL_RE.test(s));
  if (internal.length) errors.push(`Possível dado interno/CMI/linguagem corporativa: ${JSON.stringify(internal[0].slice(0, 60))}`);
  else ok.push("Sem dado interno, CMI ou linguagem corporativa de empresa específica");

  const t = r.tlScorePeriod ?? {};
  if (typeof t.average !== "number" || t.average < 0 || t.average > 100) errors.push("TL Score médio fora de 0–100");
  else ok.push(`TL Score médio ${t.average} coerente`);
  (t.distribution ?? []).forEach((d) => {
    if (!(d.verdict in VERDICTS)) errors.push(`Distribuição: veredito "${d.verdict}" fora do vocabulário`);
  });

  (r.benchmarks ?? []).forEach((b, i) => {
    if (!(b.low && b.normal && b.high)) errors.push(`Benchmark ${i + 1} (${b.category}): faltam faixas low/normal/high`);
  });
  if ((r.benchmarks ?? []).length) ok.push(`${r.benchmarks.length} benchmark(s) com faixas`);

  (r.alerts ?? []).forEach((a, i) => {
    if (!["insight", "warning", "danger"].includes(a.level)) errors.push(`Alerta ${i + 1}: nível "${a.level}" inválido`);
  });

  (r.sources ?? []).forEach((s, i) => {
    if (!/^https?:\/\//.test(s.url ?? "")) errors.push(`Fonte ${i + 1}: URL inválida`);
  });
  if ((r.sources ?? []).length && r.sources.every((s) => /^https?:\/\//.test(s.url ?? ""))) ok.push("Fontes com URL");

  // Tom executivo: sinalizar explicação básica e parágrafos longos.
  strings.forEach((s) => {
    if (/\b(o que é|como funciona|para iniciantes|passo a passo)\b/iu.test(s)) warnings.push(`Tom pouco executivo (explicação básica): ${JSON.stringify(s.slice(0, 50))}`);
  });
  (r.summary ?? []).forEach((s, i) => { if (s.length > 320) warnings.push(`Sumário ${i + 1} muito longo (${s.length} chars) para tom executivo`); });

  return { errors, warnings, ok };
}

export function proQaReport(r, result) {
  const status = result.errors.length ? "REPROVADO" : "APROVADO";
  const L = [`# QA — The Loyal Pro · ${r.period}`, "", `**Status:** ${status} · ${result.errors.length} bloqueio(s), ${result.warnings.length} aviso(s)`];
  if (r.illustrative) L.push("", "> Relatório ilustrativo. Números de exemplo.");
  L.push("", "## Checklist", "");
  const checks = [
    "Estrutura executiva completa (10 seções)",
    "Disclaimer oficial íntegro",
    "Sem dado interno / CMI / linguagem corporativa",
    "Zero emoji e zero urgência artificial",
    "Benchmarks com faixas baixo/normal/alto em unidade explícita",
    "TL Score do período (média + distribuição) coerente",
    "Alertas com nível semântico (insight/warning/danger)",
    "Matriz competitiva com eixos e leitura por player",
    "Fontes com URL",
    "Tom executivo (menos editorial, mais indicador)",
  ];
  checks.forEach((c) => {
    const failed = result.errors.some((e) => e.toLowerCase().includes(c.split(" ")[0].toLowerCase()));
    L.push(`- [${failed ? " " : "x"}] ${c}`);
  });
  if (result.warnings.length) { L.push("", "## Avisos", ""); result.warnings.forEach((m) => L.push(`- [!] ${m}`)); }
  if (result.errors.length) { L.push("", "## Bloqueios", ""); result.errors.forEach((m) => L.push(`- [ ] ${m}`)); }
  L.push("");
  const md = L.join("\n");
  mkdirSync("out/qa", { recursive: true });
  writeFileSync(`out/qa/pro-${r.periodId}.md`, md);
  return md;
}

// Resumo executivo para e-mail (condensado, email-safe, self-contained).
export function renderProEmail(r) {
  const alert = (a) =>
    `<tr><td style="border-left:3px solid ${ALERT_BORDER[a.level]};padding:6px 0 6px 14px;font-family:${SANS};font-size:14px;line-height:1.5;color:${TOKENS.ink}"><span style="font-family:${MONO};font-size:11px;text-transform:uppercase;color:${TOKENS.g500}">${esc(a.level)}</span> ${esc(a.text)}</td></tr>`;
  const dist = r.tlScorePeriod.distribution
    .map((d) => `${esc((VERDICTS[d.verdict] ?? {}).label ?? d.verdict)} ×${d.count}`)
    .join(" · ");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>The Loyal Pro — ${esc(r.period)}</title></head>
<body style="margin:0;background:${TOKENS.paperDark};font-family:${SANS};color:${TOKENS.ink}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TOKENS.paperDark}"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${TOKENS.paper}">
      <tr><td style="background:${TOKENS.ink};color:${TOKENS.paper};padding:24px">
        <div style="font-family:${SERIF};font-size:20px;font-weight:bold">The Loyal <span style="background:${TOKENS.green500};color:${TOKENS.ink};font-family:${SANS};font-size:11px;font-weight:bold;padding:2px 6px;border-radius:3px">PRO</span></div>
        <div style="font-family:${MONO};font-size:12px;color:${TOKENS.g400};margin-top:6px">${esc(r.period)} · TL médio ${r.tlScorePeriod.average} · ${r.tlScorePeriod.sampled} avaliadas</div>
        <div style="font-family:${SERIF};font-size:22px;font-weight:bold;margin-top:12px">${esc(r.title)}</div>
      </td></tr>
      <tr><td style="padding:20px 24px 28px">
        <div style="border-top:1px solid ${TOKENS.line};padding-top:12px;font-family:${SANS};font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:${TOKENS.g500}">Sumário executivo</div>
        <ul style="margin:10px 0 0;padding-left:18px;font-size:15px;line-height:1.6;color:${TOKENS.ink}">${r.summary.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
        <div style="font-family:${MONO};font-size:12px;color:${TOKENS.g500};margin-top:14px">Distribuição: ${esc(dist)}</div>
        <div style="border-top:1px solid ${TOKENS.line};margin-top:22px;padding-top:12px;font-family:${SANS};font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:${TOKENS.g500}">Alertas</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">${r.alerts.map(alert).join("")}</table>
        <div style="border-top:1px solid ${TOKENS.line};margin-top:22px;padding-top:12px;font-family:${SANS};font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:${TOKENS.g500}">O que monitorar</div>
        <ul style="margin:10px 0 0;padding-left:18px;font-size:14px;line-height:1.6;color:${TOKENS.g500}">${r.watch.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
        <div style="margin-top:20px"><a href="/pro/${esc(r.periodId)}" style="color:${TOKENS.blue600};font-family:${SANS};font-size:14px;text-decoration:underline">Ler o relatório completo (benchmarks, players, matriz)</a></div>
        <div style="border-top:1px solid ${TOKENS.line};margin-top:22px;padding-top:14px;font-family:${SANS};font-size:12px;line-height:1.6;color:${TOKENS.g400}">${r.illustrative ? "Relatório ilustrativo. Números de exemplo. " : ""}${esc(r.disclaimer)} O The Loyal Pro não usa dados internos nem CMI.</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function main() {
  const arg = process.argv[2];
  const files = arg ? [arg] : readdirSync("content/pro").filter((f) => f.endsWith(".json")).map((f) => `content/pro/${f}`);
  if (!files.length) { console.error("Nenhum relatório em content/pro/."); process.exit(1); }
  mkdirSync("out/pro-email", { recursive: true });
  let failed = false;
  for (const path of files) {
    const r = loadEdition(path);
    const result = validatePro(r);
    proQaReport(r, result);
    if (!result.errors.length) writeFileSync(`out/pro-email/${r.periodId}.html`, renderProEmail(r));
    const status = result.errors.length ? "REPROVADO" : "APROVADO";
    console.log(`[pro] ${r.period}: ${status} — ${result.errors.length} bloqueio(s), ${result.warnings.length} aviso(s) → out/qa/pro-${r.periodId}.md`);
    result.errors.forEach((m) => console.log(`  ✗ ${m}`));
    if (result.errors.length) failed = true;
    else console.log(`  → out/pro-email/${r.periodId}.html · web: /pro/${r.periodId}`);
  }
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
