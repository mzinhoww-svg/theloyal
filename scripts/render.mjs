// Renderização da edição: e-mail HTML (coluna única 600px, fallbacks Georgia/
// Arial/Consolas, zero request externo) e versão em texto puro.
// Uso: node scripts/render.mjs [caminho-da-edicao.json]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CONFIDENCE, RADAR_NOTE_DEFAULT, TOKENS, VERDICTS, editionSlug, listEditionFiles, loadEdition } from "./lib.mjs";
import { assessForecastArtifact, DEFAULT_MAX_FORECAST_AGE_HOURS } from "./forecast-freshness.mjs";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";
const MONO = "Consolas, 'Courier New', monospace";
const FORECAST_PATH = "content/forecast.json";

// Radar do Daily: override manual no JSON tem prioridade; ausente, puxa
// digest.radarDaily do forecast — SÓ se fresco e completo (gate C0), igual ao
// Weekly. Stale/ausente/inválido ⇒ null (nunca publica número desatualizado em
// silêncio). Antes o radar do Daily era só colado à mão (INCONS-9).
export function resolveDailyRadar(ed) {
  if (ed.radar && Array.isArray(ed.radar.windows) && ed.radar.windows.length) return ed.radar; // override manual
  if (!existsSync(FORECAST_PATH)) return null;
  let fc;
  try {
    fc = JSON.parse(readFileSync(FORECAST_PATH, "utf8"));
  } catch {
    console.error("[render] content/forecast.json inválido — radar automático do Daily não usado.");
    return null;
  }
  const maxAgeHours = Number(process.env.MAX_FORECAST_AGE_HOURS) || DEFAULT_MAX_FORECAST_AGE_HOURS;
  const health = assessForecastArtifact(fc, { maxAgeHours });
  if (health.status !== "fresh") {
    console.error(`[render] forecast.json ${health.status} — radar automático do Daily NÃO usado (sem números stale).`);
    return null;
  }
  const windows = fc?.digest?.radarDaily ?? [];
  if (!windows.length) return null;
  return { note: RADAR_NOTE_DEFAULT, windows };
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function badge(verdict, score) {
  const v = VERDICTS[verdict] ?? VERDICTS["nao-confirmado"];
  const scoreHtml = typeof score === "number" ? ` <span style="font-family:${MONO};font-size:14px">${score}</span>` : "";
  return `<span style="display:inline-block;background:${v.bg};color:${v.fg};border-radius:9999px;padding:4px 12px;font-family:${SANS};font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em">${esc(v.label)}${scoreHtml}</span>`;
}

function contaBlock(conta) {
  const rows = conta.rows
    .map(
      ([k, val]) =>
        `<tr><td style="color:${TOKENS.g400};padding:2px 0">${esc(k)}</td><td align="right" style="color:${TOKENS.paper};padding:2px 0">${esc(val)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TOKENS.ink};border-radius:8px;font-family:${MONO};font-size:13px;line-height:1.8;margin:16px 0">
    <tr><td style="padding:16px 20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
        <tr><td colspan="2" style="border-top:1px solid ${TOKENS.g700};padding-top:8px"></td></tr>
        <tr><td style="color:${TOKENS.green500};padding-top:2px">${esc(conta.result[0])}</td><td align="right" style="color:${TOKENS.green500};font-weight:bold">${esc(conta.result[1])}</td></tr>
      </table>
    </td></tr>
  </table>`;
}

function label(text) {
  return `<div style="border-top:1px solid ${TOKENS.line};padding-top:12px;margin:28px 0 12px;font-family:${SANS};font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:${TOKENS.g500}">${esc(text)}</div>`;
}

export function renderEmail(ed) {
  const dealsHtml = ed.deals
    .map(
      (d) => `${label("Deal Desk")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${TOKENS.line};border-radius:8px">
      <tr><td style="padding:20px">
        <div style="font-family:${MONO};font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${TOKENS.g400}">${esc(d.category)}</div>
        <div style="font-family:${SERIF};font-size:20px;font-weight:bold;color:${TOKENS.ink};margin-top:8px">${esc(d.title)}</div>
        <div style="font-family:${SANS};font-size:15px;line-height:1.6;color:${TOKENS.g500};margin-top:8px">${esc(d.context)}</div>
        ${contaBlock(d.conta)}
        <div style="margin-top:12px">${badge(d.verdict, d.tlScore)} <span style="font-family:${SANS};font-size:14px;font-weight:bold;color:${TOKENS.ink}">${esc(d.verdictNote ?? "")}</span></div>
        <div style="font-family:${SANS};font-size:13px;color:${TOKENS.g500};margin-top:10px">Fonte: ${esc(d.source)}</div>
      </td></tr>
    </table>`,
    )
    .join("");

  const fechaHtml = (ed.fechaLogo ?? [])
    .map(
      (f) => `<div style="font-family:${SANS};font-size:15px;line-height:1.6;color:${TOKENS.ink};margin-top:8px">
        <span style="display:inline-block;background:${TOKENS.yellow500};color:${TOKENS.ink};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:bold;margin-right:8px">${esc(f.tag)}</span>${esc(f.text)} <span style="font-family:${MONO};font-size:14px">${esc(f.cpm)}</span> ${esc(f.note ?? "")}
      </div>`,
    )
    .join("");

  const shopping = ed.shoppingWatch ?? [];
  const shoppingHtml = shopping.length
    ? label("Shopping · VPM observado") +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${TOKENS.line};border-radius:8px;font-family:${MONO};font-size:13px;margin-top:4px">
        <tr style="color:${TOKENS.g400}"><td style="padding:8px 12px">Player</td><td style="padding:8px 12px">Categoria</td><td align="right" style="padding:8px 12px">VPM observado</td></tr>
        ${shopping.map((s) => `<tr style="border-top:1px solid ${TOKENS.line}"><td style="padding:8px 12px;color:${TOKENS.ink}">${esc(s.player)}</td><td style="padding:8px 12px;color:${TOKENS.g500}">${esc(s.category)}</td><td align="right" style="padding:8px 12px;color:${TOKENS.ink}">${esc(s.vpmObservado)}</td></tr>`).join("")}
      </table>
      <div style="font-family:${SANS};font-size:12px;line-height:1.6;color:${TOKENS.g400};margin-top:6px">Custo de fabricação de resgate não-aéreo por catálogo público (R$/milheiro). Mediana com outliers e promo fora da banda; n/c quando a amostra é insuficiente.</div>`
    : "";
  const radar = resolveDailyRadar(ed);
  const radarHtml = radar && Array.isArray(radar.windows) && radar.windows.length
    ? label("Radar de janelas") +
      `<div style="font-family:${SANS};font-size:13px;color:${TOKENS.g500};line-height:1.5;margin-bottom:12px">${esc(radar.note ?? RADAR_NOTE_DEFAULT)}</div>` +
      radar.windows
        .map((w) => {
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
        })
        .join("")
    : "";

  const sourcesHtml = ed.sources
    .map((s) => `<a href="${esc(s.url)}" style="color:${TOKENS.blue600};text-decoration:underline">${esc(s.label)}</a>`)
    .join(" · ");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>The Loyal — Nº ${ed.number}</title></head>
<body style="margin:0;background:${TOKENS.paperDark};font-family:${SANS};color:${TOKENS.ink}">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(ed.preheader ?? "")}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TOKENS.paperDark}">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${TOKENS.paper}">
        <tr><td style="border-bottom:4px double ${TOKENS.ink};padding:20px 24px">
          <table role="presentation" width="100%"><tr>
            <td style="font-family:${SERIF};font-size:22px;font-weight:bold;color:${TOKENS.ink}">The Loyal</td>
            <td align="right" style="font-family:${MONO};font-size:12px;color:${TOKENS.g500}">Nº ${ed.number}</td>
          </tr><tr>
            <td style="font-family:${MONO};font-size:11px;color:${TOKENS.g400};padding-top:4px">${esc(ed.weekday)} · ${esc(ed.publishTime)}</td>
            <td align="right" style="font-family:${MONO};font-size:11px;color:${TOKENS.g400};padding-top:4px">LEITURA DE ${ed.readingMinutes} MIN</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:12px 24px 32px">
          ${label("O sinal do dia")}
          <div style="border-left:3px solid ${TOKENS.blue600};padding-left:20px;font-family:${SANS};font-size:18px;line-height:1.55;color:${TOKENS.ink}">${esc(ed.signal)}</div>
          ${dealsHtml}
          ${fechaHtml ? label("Fecha logo") + fechaHtml : ""}
          ${shoppingHtml}
          ${radarHtml}
          ${label("Fontes")}
          <div style="font-family:${SANS};font-size:13px;color:${TOKENS.g500};line-height:1.7">${sourcesHtml}</div>
          <div style="border-top:1px solid ${TOKENS.line};margin-top:24px;padding-top:16px;font-family:${SANS};font-size:12px;line-height:1.6;color:${TOKENS.g400}">
            ${ed.illustrative ? "Edição ilustrativa. Números de exemplo. " : ""}${esc(ed.disclaimer)}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function renderPlain(ed) {
  const L = [];
  L.push("THE LOYALTY");
  L.push(`Nº ${ed.number} · ${ed.weekday} · ${ed.publishTime} · LEITURA DE ${ed.readingMinutes} MIN`);
  if (ed.illustrative) L.push("(edição ilustrativa — números de exemplo)");
  L.push("=".repeat(60), "");
  L.push("O SINAL DO DIA");
  L.push(ed.signal, "");
  for (const d of ed.deals) {
    L.push("DEAL DESK");
    L.push(d.category);
    L.push(d.title);
    L.push(d.context, "");
    const w = Math.max(...d.conta.rows.map(([k]) => k.length), d.conta.result[0].length);
    for (const [k, v] of d.conta.rows) L.push(`  ${k.padEnd(w)}  ${v}`);
    L.push(`  ${"-".repeat(w + 20)}`);
    L.push(`  ${d.conta.result[0].padEnd(w)}  ${d.conta.result[1]}`, "");
    const label = (VERDICTS[d.verdict] ?? VERDICTS["nao-confirmado"]).label;
    L.push(`[${label}${typeof d.tlScore === "number" ? " " + d.tlScore : ""}] ${d.verdictNote ?? ""}`);
    L.push(`Fonte: ${d.source}`, "");
  }
  for (const f of ed.fechaLogo ?? []) {
    L.push("FECHA LOGO");
    L.push(`[${f.tag}] ${f.text} ${f.cpm} ${f.note ?? ""}`, "");
  }
  if ((ed.shoppingWatch ?? []).length) {
    L.push("SHOPPING · VPM OBSERVADO (R$/milheiro, catálogo público)");
    for (const s of ed.shoppingWatch) L.push(`  ${s.player} · ${s.category}: ${s.vpmObservado}`);
  }
  const radar = resolveDailyRadar(ed);
  if (radar && Array.isArray(radar.windows) && radar.windows.length) {
    L.push("RADAR DE JANELAS");
    L.push(radar.note ?? RADAR_NOTE_DEFAULT, "");
    for (const w of radar.windows) {
      const c = (CONFIDENCE[w.confidence] ?? CONFIDENCE.baixa).label;
      L.push(`  ${w.label}${w.bonus ? " " + w.bonus : ""}  —  ${w.window}  [${c}]`);
      if (w.basis) L.push(`    ${w.basis}`);
    }
    L.push("");
  }
  L.push("FONTES");
  for (const s of ed.sources) L.push(`- ${s.label}: ${s.url}`);
  L.push("");
  L.push("-".repeat(60));
  L.push((ed.illustrative ? "Edição ilustrativa. Números de exemplo. " : "") + ed.disclaimer);
  return L.join("\n") + "\n";
}

function main() {
  const arg = process.argv[2];
  const files = arg ? [arg] : listEditionFiles().map((f) => `content/editions/${f}`);
  mkdirSync("out/email", { recursive: true });
  mkdirSync("out/plain", { recursive: true });
  for (const path of files) {
    const ed = loadEdition(path);
    const slug = editionSlug(ed);
    writeFileSync(`out/email/${slug}.html`, renderEmail(ed));
    writeFileSync(`out/plain/${slug}.txt`, renderPlain(ed));
    console.log(`[render] Nº ${ed.number} → out/email/${slug}.html · out/plain/${slug}.txt`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
