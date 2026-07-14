// The Loyal Weekly — valida e renderiza o digest semanal (e-mail HTML, plain
// text e web archive). Centro é o Radar de janelas: se o JSON não trouxer
// `radar`, o render puxa digest.radarWeekly de content/forecast.json — o weekly
// é alimentado diretamente pela camada de previsão.
// Uso: node scripts/render-weekly.mjs [content/weekly/AAAA-Wnn.json]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CONFIDENCE, DISCLAIMER, EMOJI_RE, INTERNAL_RE, RADAR_NOTE_DEFAULT, TOKENS, URGENCY_RE, VERDICTS,
  collectStrings,
} from "./lib.mjs";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";
const MONO = "Consolas, 'Courier New', monospace";
const WEEKLY_DIR = "content/weekly";
const FORECAST_PATH = "content/forecast.json";

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Se o weekly não trouxer radar, usa digest.radarWeekly do forecast (se houver).
function resolveRadar(wk) {
  if (wk.radar && Array.isArray(wk.radar.windows) && wk.radar.windows.length) return wk.radar;
  if (!existsSync(FORECAST_PATH)) return null;
  try {
    const fc = JSON.parse(readFileSync(FORECAST_PATH, "utf8"));
    const windows = fc?.digest?.radarWeekly ?? [];
    if (!windows.length) return null;
    return { note: RADAR_NOTE_DEFAULT, windows };
  } catch {
    return null;
  }
}

// ---------- Validação editorial ----------
const REQUIRED = ["number", "period", "dateStart", "dateEnd", "publishTime", "readingMinutes", "signal", "watch", "sources", "disclaimer"];

export function validateWeekly(wk) {
  const errors = [], warnings = [], ok = [];
  const missing = REQUIRED.filter((k) => wk[k] === undefined || wk[k] === null || wk[k] === "");
  if (missing.length) errors.push(`Campos obrigatórios ausentes: ${missing.join(", ")}`);
  else ok.push("Estrutura do weekly completa");

  if (typeof wk.disclaimer === "string" && wk.disclaimer.includes(DISCLAIMER)) ok.push("Disclaimer íntegro");
  else errors.push("Disclaimer ausente ou alterado");

  const strings = collectStrings(wk);
  if (strings.some((s) => EMOJI_RE.test(s))) errors.push("Emoji no corpo do weekly");
  else ok.push("Zero emoji");
  if (strings.some((s) => URGENCY_RE.test(s))) errors.push("Urgência artificial no weekly");
  else ok.push("Sem urgência artificial");
  if (strings.some((s) => INTERNAL_RE.test(s))) errors.push("Possível dado interno/CMI no weekly");
  else ok.push("Sem dado interno/CMI");

  const radar = wk.radar;
  if (radar) {
    (radar.windows ?? []).forEach((w, i) => {
      if (!w.label || !w.window) errors.push(`Radar ${i + 1}: label/window ausente`);
      if (!["alta", "media", "baixa"].includes(w.confidence)) errors.push(`Radar ${i + 1}: confiança "${w.confidence}" inválida (em-formacao nunca vira radar)`);
    });
    if (!errors.some((e) => e.startsWith("Radar"))) ok.push(`Radar coerente (${(radar.windows ?? []).length} janela(s), sem veredito)`);
  }

  (wk.highlights ?? []).forEach((hl, i) => {
    if (hl.verdict && !(hl.verdict in VERDICTS)) errors.push(`Destaque ${i + 1}: veredito "${hl.verdict}" fora do vocabulário`);
  });

  (wk.sources ?? []).forEach((s, i) => {
    if (!/^https?:\/\//.test(s.url ?? "")) errors.push(`Fonte ${i + 1}: URL inválida`);
  });
  if ((wk.sources ?? []).length) ok.push(`${wk.sources.length} fonte(s) com URL`);

  return { errors, warnings, ok };
}

// ---------- Radar (HTML e-mail) ----------
function radarEmail(radar) {
  if (!radar) return "";
  const rows = radar.windows.map((w) => {
    const c = CONFIDENCE[w.confidence] ?? CONFIDENCE.baixa;
    const bonus = w.bonus ? ` <span style="font-family:${MONO};font-size:13px;color:${TOKENS.g500}">${esc(w.bonus)}</span>` : "";
    const basis = w.basis ? `<div style="font-family:${SANS};font-size:12px;color:${TOKENS.g400};margin-top:2px">${esc(w.basis)}</div>` : "";
    return `<div style="border-top:1px solid ${TOKENS.line};padding:10px 0">
      <div style="display:flex;justify-content:space-between;gap:12px">
        <span style="font-family:${SANS};font-size:15px;font-weight:bold;color:${TOKENS.ink}">${esc(w.label)}${bonus}</span>
        <span style="font-family:${MONO};font-size:14px;color:${TOKENS.ink};white-space:nowrap">${esc(w.window)}</span>
      </div>
      <div style="margin-top:6px"><span style="display:inline-block;background:${c.bg};color:${c.fg};border-radius:9999px;padding:2px 10px;font-family:${SANS};font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em">${esc(c.label)}</span></div>
      ${basis}
    </div>`;
  }).join("");
  return `<div style="font-family:${SANS};font-size:13px;color:${TOKENS.g500};line-height:1.5;margin-bottom:12px">${esc(radar.note ?? RADAR_NOTE_DEFAULT)}</div>${rows}`;
}

function labelBlock(text) {
  return `<div style="border-top:1px solid ${TOKENS.line};padding-top:12px;margin:28px 0 12px;font-family:${SANS};font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:${TOKENS.g500}">${esc(text)}</div>`;
}

function listBlock(items) {
  return `<ul style="margin:0;padding-left:20px;font-family:${SANS};font-size:15px;line-height:1.7;color:${TOKENS.ink}">${items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
}

export function renderWeeklyEmail(wk) {
  const radar = resolveRadar(wk);
  const mov = wk.movements ?? {};
  const movHtml = ["novas", "seguem", "venceram"]
    .filter((k) => Array.isArray(mov[k]) && mov[k].length)
    .map((k) => `<div style="margin-top:8px"><span style="font-family:${MONO};font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${TOKENS.g400}">${k === "novas" ? "Abriram" : k === "seguem" ? "Seguem" : "Encerraram"}</span>${listBlock(mov[k])}</div>`)
    .join("");
  const hlHtml = (wk.highlights ?? []).map((hl) => {
    const badge = hl.verdict ? (() => { const v = VERDICTS[hl.verdict] ?? VERDICTS["nao-confirmado"]; const sc = typeof hl.score === "number" ? ` <span style="font-family:${MONO};font-size:13px">${hl.score}</span>` : ""; return `<span style="display:inline-block;background:${v.bg};color:${v.fg};border-radius:9999px;padding:3px 10px;font-family:${SANS};font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em">${esc(v.label)}${sc}</span> `; })() : "";
    return `<div style="border:1px solid ${TOKENS.line};border-radius:8px;padding:16px;margin-top:12px"><div style="font-family:${SERIF};font-size:18px;font-weight:bold;color:${TOKENS.ink}">${esc(hl.title)}</div><div style="font-family:${SANS};font-size:14px;line-height:1.6;color:${TOKENS.g500};margin-top:6px">${esc(hl.note)}</div><div style="margin-top:8px">${badge}</div></div>`;
  }).join("");
  const sourcesHtml = wk.sources.map((s) => `<a href="${esc(s.url)}" style="color:${TOKENS.blue600};text-decoration:underline">${esc(s.label)}</a>`).join(" · ");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>The Loyal Weekly — Nº ${wk.number}</title></head>
<body style="margin:0;background:${TOKENS.paperDark};font-family:${SANS};color:${TOKENS.ink}">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(wk.preheader ?? "")}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TOKENS.paperDark}">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${TOKENS.paper}">
        <tr><td style="border-bottom:4px double ${TOKENS.ink};padding:20px 24px">
          <table role="presentation" width="100%"><tr>
            <td style="font-family:${SERIF};font-size:22px;font-weight:bold;color:${TOKENS.ink}">The Loyal <span style="font-family:${MONO};font-size:12px;font-weight:normal;color:${TOKENS.g500}">Weekly</span></td>
            <td align="right" style="font-family:${MONO};font-size:12px;color:${TOKENS.g500}">Nº ${wk.number}</td>
          </tr><tr>
            <td style="font-family:${MONO};font-size:11px;color:${TOKENS.g400};padding-top:4px">${esc(wk.period)}</td>
            <td align="right" style="font-family:${MONO};font-size:11px;color:${TOKENS.g400};padding-top:4px">LEITURA DE ${wk.readingMinutes} MIN</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:12px 24px 32px">
          ${labelBlock("A semana em uma tese")}
          <div style="border-left:3px solid ${TOKENS.blue600};padding-left:20px;font-family:${SANS};font-size:18px;line-height:1.55;color:${TOKENS.ink}">${esc(wk.signal)}</div>
          ${radar ? labelBlock("Radar de janelas") + radarEmail(radar) : ""}
          ${movHtml ? labelBlock("Movimentos da semana") + movHtml : ""}
          ${hlHtml ? labelBlock("Destaques") + hlHtml : ""}
          ${labelBlock("O que monitorar")}
          ${listBlock(wk.watch)}
          ${labelBlock("Fontes")}
          <div style="font-family:${SANS};font-size:13px;color:${TOKENS.g500};line-height:1.7">${sourcesHtml}</div>
          <div style="border-top:1px solid ${TOKENS.line};margin-top:24px;padding-top:16px;font-family:${SANS};font-size:12px;line-height:1.6;color:${TOKENS.g400}">
            ${wk.illustrative ? "Edição ilustrativa. Números de exemplo. " : ""}${esc(wk.disclaimer)}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function renderWeeklyPlain(wk) {
  const radar = resolveRadar(wk);
  const L = [];
  L.push("THE LOYAL — WEEKLY");
  L.push(`Nº ${wk.number} · ${wk.period} · LEITURA DE ${wk.readingMinutes} MIN`);
  if (wk.illustrative) L.push("(edição ilustrativa — números de exemplo)");
  L.push("=".repeat(60), "");
  L.push("A SEMANA EM UMA TESE");
  L.push(wk.signal, "");
  if (radar) {
    L.push("RADAR DE JANELAS");
    L.push(radar.note ?? RADAR_NOTE_DEFAULT, "");
    for (const w of radar.windows) {
      const c = (CONFIDENCE[w.confidence] ?? CONFIDENCE.baixa).label;
      L.push(`  ${w.label}${w.bonus ? " " + w.bonus : ""}  —  ${w.window}  [${c}]`);
      if (w.basis) L.push(`    ${w.basis}`);
    }
    L.push("");
  }
  const mov = wk.movements ?? {};
  if ((mov.novas || mov.seguem || mov.venceram)) {
    L.push("MOVIMENTOS DA SEMANA");
    for (const [k, title] of [["novas", "Abriram"], ["seguem", "Seguem"], ["venceram", "Encerraram"]]) {
      if (Array.isArray(mov[k]) && mov[k].length) {
        L.push(`  ${title}:`);
        for (const t of mov[k]) L.push(`    - ${t}`);
      }
    }
    L.push("");
  }
  for (const hl of wk.highlights ?? []) {
    L.push("DESTAQUE");
    const v = hl.verdict ? `[${(VERDICTS[hl.verdict] ?? VERDICTS["nao-confirmado"]).label}${typeof hl.score === "number" ? " " + hl.score : ""}] ` : "";
    L.push(`${hl.title}`);
    L.push(`${v}${hl.note}`, "");
  }
  L.push("O QUE MONITORAR");
  for (const t of wk.watch) L.push(`  - ${t}`);
  L.push("");
  L.push("FONTES");
  for (const s of wk.sources) L.push(`  - ${s.label}: ${s.url}`);
  L.push("");
  L.push("-".repeat(60));
  L.push((wk.illustrative ? "Edição ilustrativa. Números de exemplo. " : "") + wk.disclaimer);
  return L.join("\n") + "\n";
}

// ---------- Web archive (React) ----------
function ConfPill({ conf }) {
  const c = CONFIDENCE[conf] ?? CONFIDENCE.baixa;
  return h("span", { className: "tl-conf", style: { background: c.bg, color: c.fg } }, c.label);
}

function WeeklyArticle({ wk, radar }) {
  return h(
    "article",
    { className: "tl-web" },
    h("header", { className: "tl-head" },
      h("div", { className: "tl-head-row" },
        h("span", { className: "tl-brand" }, "The Loyal ", h("span", { className: "mono tl-kicker" }, "Weekly")),
        h("span", { className: "tl-num mono" }, `Nº ${wk.number}`)),
      h("div", { className: "tl-meta mono" }, wk.period)),
    h("h1", { className: "tl-sr" }, `The Loyal Weekly Nº ${wk.number} — ${wk.subject ?? wk.period}`),
    h("section", null,
      h("span", { className: "tl-label" }, "A semana em uma tese"),
      h("blockquote", { className: "tl-quote" }, h("p", { className: "tl-signal" }, wk.signal))),
    radar
      ? h("section", null,
          h("span", { className: "tl-label" }, "Radar de janelas"),
          h("p", { className: "tl-radar-note" }, radar.note ?? RADAR_NOTE_DEFAULT),
          h("ul", { className: "tl-radar" },
            radar.windows.map((w, i) =>
              h("li", { key: i, className: "tl-radar-item" },
                h("div", { className: "tl-radar-head" },
                  h("span", { className: "tl-radar-label" }, w.label, w.bonus ? h("span", { className: "mono tl-radar-bonus" }, ` ${w.bonus}`) : null),
                  h("span", { className: "mono tl-radar-window" }, w.window)),
                h(ConfPill, { conf: w.confidence }),
                w.basis ? h("div", { className: "tl-radar-basis" }, w.basis) : null))))
      : null,
    wk.movements
      ? h("section", null,
          h("span", { className: "tl-label" }, "Movimentos da semana"),
          [["novas", "Abriram"], ["seguem", "Seguem"], ["venceram", "Encerraram"]]
            .filter(([k]) => Array.isArray(wk.movements[k]) && wk.movements[k].length)
            .map(([k, title], gi) =>
              h("div", { key: gi, className: "tl-mov" },
                h("span", { className: "tl-mov-title mono" }, title),
                h("ul", null, wk.movements[k].map((t, i) => h("li", { key: i }, t))))))
      : null,
    (wk.highlights ?? []).length
      ? h("section", null,
          h("span", { className: "tl-label" }, "Destaques"),
          wk.highlights.map((hl, i) =>
            h("div", { key: i, className: "tl-deal" },
              h("h2", { className: "tl-title" }, hl.title),
              h("p", { className: "tl-context" }, hl.note))))
      : null,
    h("section", null,
      h("span", { className: "tl-label" }, "O que monitorar"),
      h("ul", { className: "tl-watch" }, wk.watch.map((t, i) => h("li", { key: i }, t)))),
    h("section", null,
      h("span", { className: "tl-label" }, "Fontes"),
      h("ul", { className: "tl-sources" }, wk.sources.map((s, i) => h("li", { key: i }, h("a", { href: s.url, rel: "nofollow noopener" }, s.label))))),
    h("p", { className: "tl-disclaimer" }, `${wk.illustrative ? "Edição ilustrativa. Números de exemplo. " : ""}${wk.disclaimer}`),
  );
}

const STYLESHEET = `
:root{--ink:${TOKENS.ink};--paper:${TOKENS.paper};--surface:${TOKENS.surface};--line:${TOKENS.line};--g700:${TOKENS.g700};--g500:${TOKENS.g500};--g400:${TOKENS.g400};--green100:${TOKENS.green100};--green700:${TOKENS.green700};--blue100:${TOKENS.blue100};--blue600:${TOKENS.blue600};--blue700:${TOKENS.blue700};--paper-dark:${TOKENS.paperDark}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:'Inter',Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6}
.mono{font-family:'JetBrains Mono',Consolas,'Courier New',monospace}
main{padding:48px 20px}
.tl-web{max-width:720px;margin:0 auto;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:40px 32px}
.tl-head{border-bottom:4px double var(--ink);padding-bottom:16px;display:flex;flex-direction:column;gap:4px}
.tl-head-row{display:flex;justify-content:space-between;align-items:baseline;gap:16px}
.tl-brand{font-family:'Fraunces',Georgia,serif;font-weight:700;font-size:24px}
.tl-kicker{font-size:12px;font-weight:400;color:var(--g500)}
.tl-num{font-size:12px;color:var(--g500)}
.tl-meta{font-size:12px;color:var(--g400)}
.tl-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.tl-label{display:block;border-top:1px solid var(--line);padding-top:16px;margin:36px 0 12px;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:var(--g500)}
.tl-quote{margin:0}.tl-signal{border-left:3px solid var(--blue600);padding-left:20px;font-size:19px;line-height:1.55;margin:0}
.tl-radar-note{margin:0 0 12px;font-size:13px;color:var(--g500)}
.tl-radar{list-style:none;padding:0;margin:0}
.tl-radar-item{border-top:1px solid var(--line);padding:12px 0}
.tl-radar-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.tl-radar-label{font-weight:600}.tl-radar-bonus{font-size:13px;color:var(--g500)}
.tl-radar-window{font-size:14px;white-space:nowrap}
.tl-conf{display:inline-block;margin-top:6px;border-radius:9999px;padding:2px 10px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em}
.tl-radar-basis{margin-top:6px;font-size:12px;color:var(--g400)}
.tl-mov{margin-top:10px}.tl-mov-title{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--g400)}
.tl-mov ul,.tl-watch{margin:4px 0 0;padding-left:20px}
.tl-deal{border:1px solid var(--line);border-radius:8px;padding:20px;margin-top:12px}
.tl-title{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:20px;margin:0}
.tl-context{color:var(--g500);margin:8px 0 0}
.tl-sources{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:14px}
a{color:var(--blue600);text-decoration:underline;text-underline-offset:2px}a:hover{color:var(--blue700)}
.tl-disclaimer{border-top:1px solid var(--line);margin-top:24px;padding-top:16px;font-size:13px;color:var(--g400)}
@media (max-width:560px){.tl-web{padding:28px 20px}}
`;

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap";

export function renderWeeklyWeb(wk) {
  const radar = resolveRadar(wk);
  const body = renderToStaticMarkup(h(WeeklyArticle, { wk, radar }));
  const desc = (wk.preheader ?? wk.signal).slice(0, 160);
  const escAttr = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Loyal Weekly — Nº ${wk.number}</title><meta name="description" content="${escAttr(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS_HREF}" rel="stylesheet"><style>${STYLESHEET}</style></head>
<body><main>${body}</main></body></html>`;
}

// ---------- CLI ----------
function listWeeklyFiles() {
  if (!existsSync(WEEKLY_DIR)) return [];
  return readdirSync(WEEKLY_DIR).filter((f) => f.endsWith(".json")).sort();
}

function main() {
  const arg = process.argv[2];
  const files = arg ? [arg] : listWeeklyFiles().map((f) => `${WEEKLY_DIR}/${f}`);
  if (!files.length) { console.error("Nenhum weekly em content/weekly/."); process.exit(1); }
  mkdirSync("out/weekly", { recursive: true });
  mkdirSync("out/weekly-plain", { recursive: true });
  mkdirSync("out/weekly-web", { recursive: true });
  let failed = false;
  for (const path of files) {
    const wk = JSON.parse(readFileSync(path, "utf8"));
    const result = validateWeekly(wk);
    result.errors.forEach((m) => console.error(`  ✗ ${m}`));
    if (result.errors.length) { failed = true; console.error(`[weekly] Nº ${wk.number}: FALHOU — ${result.errors.length} erro(s)`); continue; }
    const slug = wk.slug ?? `weekly-${String(wk.number).padStart(4, "0")}`;
    writeFileSync(`out/weekly/${slug}.html`, renderWeeklyEmail(wk));
    writeFileSync(`out/weekly-plain/${slug}.txt`, renderWeeklyPlain(wk));
    writeFileSync(`out/weekly-web/${slug}.html`, renderWeeklyWeb(wk));
    console.log(`[weekly] Nº ${wk.number}: OK → out/weekly/${slug}.html · out/weekly-plain/${slug}.txt · out/weekly-web/${slug}.html`);
  }
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
