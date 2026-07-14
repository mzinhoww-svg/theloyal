// Renderização da versão WEB ARCHIVE da edição: uma página HTML autocontida,
// gerada a partir de COMPONENTES REACT (react-dom/server), com Fraunces, Inter e
// JetBrains Mono (Google Fonts é permitido na web — proibido apenas no e-mail).
// Diferente da rota Next.js /edicao/[numero], este arquivo é um snapshot estático
// e portável (um único .html) para arquivamento/permalink.
// Uso: node scripts/render-web.mjs [caminho-da-edicao.json]
import { mkdirSync, writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CONFIDENCE, RADAR_NOTE_DEFAULT, TOKENS, VERDICTS, editionSlug, listEditionFiles, loadEdition } from "./lib.mjs";

// ---------- Componentes React (mesmos blocos canônicos da marca) ----------

function Conta({ conta }) {
  return h(
    "div",
    { className: "tl-conta mono", role: "figure", "aria-label": "Bloco de cálculo" },
    conta.rows.map(([k, v], i) =>
      h(
        "div",
        { className: "tl-conta-row", key: i },
        h("span", { className: "tl-conta-key" }, k),
        h("span", { className: "tl-conta-val" }, v),
      ),
    ),
    h(
      "div",
      { className: "tl-conta-result" },
      h("span", null, conta.result[0]),
      h("span", { className: "tl-conta-result-val" }, conta.result[1]),
    ),
  );
}

function Badge({ verdict, score }) {
  const dashed = verdict === "nao-confirmado";
  const v = VERDICTS[verdict] ?? VERDICTS["nao-confirmado"];
  const style = dashed
    ? { color: v.fg, border: `1px dashed ${TOKENS.g400}` }
    : { background: v.bg, color: v.fg };
  return h(
    "span",
    { className: "tl-badge", style },
    v.label,
    typeof score === "number"
      ? h("span", { className: "tl-badge-score mono" }, String(score))
      : null,
  );
}

function Article({ ed }) {
  return h(
    "article",
    { className: "tl-web" },
    h(
      "header",
      { className: "tl-head" },
      h(
        "div",
        { className: "tl-head-row" },
        h("span", { className: "tl-brand" }, h("span", null, "The "), "Loyalty"),
        h("span", { className: "tl-num mono" }, `Nº ${ed.number}`),
      ),
      h(
        "div",
        { className: "tl-head-row tl-meta mono" },
        h("span", null, `${ed.weekday} · ${ed.publishTime}`),
        h("span", null, `LEITURA DE ${ed.readingMinutes} MIN`),
      ),
    ),
    h("h1", { className: "tl-sr" }, `The Loyalty Nº ${ed.number} — ${ed.subject ?? "Edição do Daily"}`),
    h(
      "section",
      { "aria-labelledby": "sinal" },
      h("span", { className: "tl-label" }, "O sinal do dia"),
      h("blockquote", { className: "tl-quote" }, h("p", { id: "sinal", className: "tl-signal" }, ed.signal)),
    ),
    ed.deals.map((d, i) =>
      h(
        "section",
        { key: i },
        h("span", { className: "tl-label" }, "Deal Desk"),
        h(
          "div",
          { className: "tl-deal" },
          h("p", { className: "tl-cat mono" }, d.category),
          h("h2", { className: "tl-title" }, d.title),
          h("p", { className: "tl-context" }, d.context),
          h(Conta, { conta: d.conta }),
          h(
            "div",
            { className: "tl-verdict" },
            h(
              Badge,
              d.verdict === "nao-confirmado"
                ? { verdict: "nao-confirmado", score: d.tlScore }
                : { verdict: d.verdict, score: d.tlScore ?? 0 },
            ),
            d.verdictNote ? h("span", { className: "tl-note" }, d.verdictNote) : null,
          ),
          h(
            "p",
            { className: "tl-source" },
            "Fonte: ",
            d.sourceUrl
              ? h("a", { href: d.sourceUrl, rel: "nofollow noopener" }, d.source)
              : d.source,
          ),
        ),
      ),
    ),
    ed.fechaLogo && ed.fechaLogo.length
      ? h(
          "section",
          null,
          h("span", { className: "tl-label" }, "Fecha logo"),
          h(
            "ul",
            { className: "tl-fecha" },
            ed.fechaLogo.map((f, i) =>
              h(
                "li",
                { key: i },
                h("span", { className: "tl-fecha-tag" }, f.tag),
                ` ${f.text} `,
                f.cpm ? h("span", { className: "mono tl-cpm" }, f.cpm) : null,
                f.note ? ` ${f.note}` : null,
              ),
            ),
          ),
        )
      : null,
    ed.shoppingWatch && ed.shoppingWatch.length
      ? h(
          "section",
          null,
          h("span", { className: "tl-label" }, "Shopping · VPM observado"),
          h(
            "table",
            { className: "tl-shop mono" },
            h(
              "thead",
              null,
              h(
                "tr",
                null,
                h("th", null, "Player"),
                h("th", null, "Categoria"),
                h("th", { className: "tl-right" }, "VPM observado"),
              ),
            ),
            h(
              "tbody",
              null,
              ed.shoppingWatch.map((s, i) =>
                h(
                  "tr",
                  { key: i },
                  h("td", null, s.player),
                  h("td", { className: "tl-shop-cat" }, s.category),
                  h("td", { className: "tl-right" }, s.vpmObservado),
                ),
              ),
            ),
          ),
          h(
            "p",
            { className: "tl-shop-note" },
            "Custo de fabricação de resgate não-aéreo por catálogo público (R$/milheiro). Mediana com outliers e promo fora da banda; n/c quando a amostra é insuficiente.",
          ),
        )
      : null,
    ed.radar && Array.isArray(ed.radar.windows) && ed.radar.windows.length
      ? h(
          "section",
          null,
          h("span", { className: "tl-label" }, "Radar de janelas"),
          h("p", { className: "tl-radar-note" }, ed.radar.note ?? RADAR_NOTE_DEFAULT),
          h(
            "ul",
            { className: "tl-radar" },
            ed.radar.windows.map((w, i) => {
              const c = CONFIDENCE[w.confidence] ?? CONFIDENCE.baixa;
              return h(
                "li",
                { key: i, className: "tl-radar-item" },
                h(
                  "div",
                  { className: "tl-radar-head" },
                  h(
                    "span",
                    { className: "tl-radar-label" },
                    w.label,
                    w.bonus ? h("span", { className: "mono tl-radar-bonus" }, ` ${w.bonus}`) : null,
                  ),
                  h("span", { className: "mono tl-radar-window" }, w.window),
                ),
                h("span", { className: "tl-conf", style: { background: c.bg, color: c.fg } }, c.label),
                w.basis ? h("div", { className: "tl-radar-basis" }, w.basis) : null,
              );
            }),
          ),
        )
      : null,
    h(
      "section",
      null,
      h("span", { className: "tl-label" }, "Fontes"),
      h(
        "ul",
        { className: "tl-sources" },
        ed.sources.map((s, i) =>
          h("li", { key: i }, h("a", { href: s.url, rel: "nofollow noopener" }, s.label)),
        ),
      ),
    ),
    h(
      "p",
      { className: "tl-disclaimer" },
      `${ed.illustrative ? "Edição ilustrativa. Números de exemplo. " : ""}${ed.disclaimer}`,
    ),
  );
}

// ---------- Folha de estilo autocontida (tokens em :root — permitido na web) ----------

const STYLESHEET = `
:root{
  --ink:${TOKENS.ink};--paper:${TOKENS.paper};--paper-dark:${TOKENS.paperDark};
  --surface:${TOKENS.surface};--line:${TOKENS.line};--g700:${TOKENS.g700};
  --g500:${TOKENS.g500};--g400:${TOKENS.g400};--green500:${TOKENS.green500};
  --green600:${TOKENS.green600};--blue600:${TOKENS.blue600};--blue700:${TOKENS.blue700};
  --yellow500:${TOKENS.yellow500};
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:'Inter',Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.mono{font-family:'JetBrains Mono',Consolas,'Courier New',monospace}
main{padding:48px 20px}
.tl-web{max-width:720px;margin:0 auto;background:var(--surface);
  border:1px solid var(--line);border-radius:12px;padding:40px 32px}
.tl-head{border-bottom:4px double var(--ink);padding-bottom:16px;
  display:flex;flex-direction:column;gap:4px}
.tl-head-row{display:flex;justify-content:space-between;align-items:baseline;gap:16px}
.tl-brand{font-family:'Fraunces',Georgia,serif;font-weight:700;font-size:24px}
.tl-brand span{font-weight:600}
.tl-num{font-size:12px;color:var(--g500)}
.tl-meta{font-size:12px;color:var(--g400)}
.tl-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0,0,0,0);white-space:nowrap;border:0}
.tl-label{display:block;border-top:1px solid var(--line);padding-top:16px;
  margin:36px 0 12px;font-weight:600;font-size:13px;text-transform:uppercase;
  letter-spacing:0.08em;color:var(--g500)}
.tl-quote{margin:0}
.tl-signal{border-left:3px solid var(--blue600);padding-left:20px;
  font-size:19px;line-height:1.55;margin:0}
.tl-deal{border:1px solid var(--line);border-radius:8px;padding:20px}
.tl-cat{font-size:12px;text-transform:uppercase;letter-spacing:0.06em;
  color:var(--g400);margin:0}
.tl-title{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:22px;margin:8px 0 0}
.tl-context{color:var(--g500);margin:8px 0 0}
.tl-conta{background:var(--ink);color:var(--paper);border-radius:8px;
  padding:16px 20px;margin-top:20px;font-size:14px;line-height:1.9}
.tl-conta-row{display:flex;justify-content:space-between;gap:16px}
.tl-conta-key{color:var(--g400)}
.tl-conta-val{text-align:right}
.tl-conta-result{display:flex;justify-content:space-between;gap:16px;
  border-top:1px solid var(--g700);margin-top:8px;padding-top:8px;color:var(--green500)}
.tl-conta-result-val{font-weight:600}
.tl-verdict{margin-top:20px;display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.tl-badge{display:inline-flex;align-items:center;gap:8px;border-radius:9999px;
  padding:4px 12px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em}
.tl-badge-score{font-size:14px;text-transform:none;letter-spacing:0}
.tl-note{font-weight:600;font-size:14px}
.tl-source{margin:12px 0 0;font-size:14px;color:var(--g500)}
.tl-cpm{font-size:14px}
a{color:var(--blue600);text-decoration:underline;text-underline-offset:2px}
a:hover{color:var(--blue700)}
.tl-fecha{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px}
.tl-fecha-tag{display:inline-block;background:var(--yellow500);color:var(--ink);
  border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600}
.tl-radar-note{margin:0 0 12px;font-size:13px;color:var(--g500)}
.tl-radar{list-style:none;padding:0;margin:0}
.tl-radar-item{border-top:1px solid var(--line);padding:12px 0}
.tl-radar-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.tl-radar-label{font-weight:600}
.tl-radar-bonus{font-size:13px;color:var(--g500)}
.tl-radar-window{font-size:14px;white-space:nowrap}
.tl-conf{display:inline-block;margin-top:6px;border-radius:9999px;padding:2px 10px;
  font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em}
.tl-radar-basis{margin-top:6px;font-size:12px;color:var(--g400)}
.tl-sources{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;
  gap:4px 16px;font-size:14px}
.tl-shop{width:100%;border-collapse:collapse;border:1px solid var(--line);
  border-radius:8px;font-size:14px}
.tl-shop th{text-align:left;color:var(--g400);font-weight:600;padding:8px 12px}
.tl-shop td{padding:8px 12px;border-top:1px solid var(--line)}
.tl-shop-cat{color:var(--g500)}
.tl-right{text-align:right}
.tl-shop-note{font-size:13px;color:var(--g400);margin:6px 0 0}
.tl-disclaimer{border-top:1px solid var(--line);margin-top:24px;padding-top:16px;
  font-size:13px;color:var(--g400)}
:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(49,92,255,0.35);border-radius:6px}
@media (max-width:560px){.tl-web{padding:28px 20px}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap";

export function renderWebArchive(ed) {
  const body = renderToStaticMarkup(h(Article, { ed }));
  const desc = (ed.preheader ?? ed.signal).slice(0, 160);
  const escAttr = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Loyalty Nº ${ed.number} — ${escAttr(ed.subject ?? "Daily")}</title>
<meta name="description" content="${escAttr(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS_HREF}">
<style>${STYLESHEET}</style>
</head>
<body>
<main id="conteudo">${body}</main>
</body>
</html>
`;
}

function main() {
  const arg = process.argv[2];
  const files = arg ? [arg] : listEditionFiles().map((f) => `content/editions/${f}`);
  mkdirSync("out/web", { recursive: true });
  for (const path of files) {
    const ed = loadEdition(path);
    const slug = editionSlug(ed);
    writeFileSync(`out/web/${slug}.html`, renderWebArchive(ed));
    console.log(`[render-web] Nº ${ed.number} → out/web/${slug}.html`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
