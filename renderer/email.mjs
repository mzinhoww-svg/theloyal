// Renderer de e-mail-safe do The Loyal Daily.
// 600px, uma coluna, CSS 100% inline, tabelas role=presentation, fontes web-safe.
// Sem :root, sem Google Fonts, sem JavaScript, sem emoji.
//
// Realinhado a content/edition.schema.json (camelCase) — SPEC-SLICE-TEMPLATE-EMAIL-DAILY.md
// §0/§7. Antes este arquivo lia um contrato snake_case divergente (`sinal_do_dia`,
// `deal_desk`, `fecha_logo` como string única etc.) que nunca bateu com o schema
// versionado — D-052(4) ratificou content/edition.schema.json como canônico e este
// arquivo como o que realinha, não o contrário.
import { verdict, VERDICT_FAMILY } from "./tokens.mjs";

function esc(s) {
  const t = String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return t.replace(/-&gt;/g, "&rarr;");
}
const sp = (px) => `<div style="height:${px}px; line-height:${px}px;">&nbsp;</div>`;

// Tokens já nomeados no arquivo original — reusados, nunca hex solto fora daqui.
const E = "#007A57", MUT = "#8A8578", HAIR = "#E5E0D5", SOFT = "#3D3A34", PANEL2 = "#F1ECE1";
// Novos tokens precisos ao CLAUDE.md, ainda não nomeados neste arquivo.
const INK = "#111111", PAPER = "#FAF7F0", SURFACE = "#FFFFFF";

const eyebrow = (t, c = E) =>
  `<div style="font-family:'Courier New',Courier,monospace; font-size:11px; color:${c}; letter-spacing:1.5px; text-transform:uppercase; font-weight:bold;">${esc(t)}</div>`;
const para = (t, size = 15, color = SOFT) =>
  `<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:${size}px; line-height:1.6; color:${color};">${esc(t)}</p>`;

function chip(vk) {
  const v = verdict(vk);
  const c = VERDICT_FAMILY[v.family];
  return `<span style="display:inline-block; background-color:${c.bg}; color:${c.text}; font-family:Arial,sans-serif; font-size:11px; font-weight:bold; letter-spacing:1px; padding:4px 10px;">${esc(v.label)}</span>`;
}

// Conta Feita: bloco Ink fixo (CLAUDE.md ContaBlock — não muda em dark), mono
// Paper, resultado em green-500 (permitido: texto sobre Ink, regra 8).
function contaBlock(conta) {
  if (!conta) return "";
  let body = "";
  for (const [k, v] of conta.rows || []) {
    body += `<span style="color:${MUT};">${esc(k)}&nbsp;&nbsp;</span> ${esc(v)}<br />`;
  }
  if (conta.result) {
    const [tk, tv] = conta.result;
    body += `<span style="color:#00C48C;">${esc(tk)}&nbsp;&nbsp;${esc(tv)}</span>`;
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${INK};"><tr><td style="padding:16px 18px; font-family:'Courier New',Courier,monospace; font-size:13px; line-height:1.9; color:${PAPER};">${body}</td></tr></table>`;
}

// Deal Desk: card por item. Seção inteira omitida quando deals=[] (regra-mãe,
// D-050/D-051 — nunca card vazio/placeholder). A seção é delimitada por um
// comentário HTML único (DEAL_DESK_SECTION_MARKER) — não pelo texto "Deal Desk"
// isolado, porque esse texto pode aparecer legitimamente em prosa fora da seção
// (ex.: sinaisRapidos explicando "abaixo do corte de Deal Desk"). O gate 5.5
// (v2/lib/digest/gate-5-5.mjs, DEAL_DESK_MARKER) procura este MESMO comentário
// no HTML final — mudar o marcador aqui exige atualizar o gate junto.
export const DEAL_DESK_SECTION_MARKER = '<!--section:deal-desk-->';
function dealCard(d) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${HAIR}; background-color:${SURFACE};"><tr><td style="padding:16px 18px;">
<div style="font-family:'Courier New',Courier,monospace; font-size:11px; color:${MUT}; letter-spacing:1px; text-transform:uppercase;">${esc(d.category || "")}</div>${sp(6)}
<div style="font-family:Georgia,serif; font-size:17px; font-weight:bold; color:${INK}; line-height:1.35;">${esc(d.title || "")}</div>${sp(8)}
<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.55; color:#555555;">${esc(d.context || "")}</p>${sp(10)}
${contaBlock(d.conta)}${sp(10)}
${chip(d.verdict)}<span style="font-family:Arial,sans-serif; font-size:13px; color:${SOFT}; padding-left:8px;">${esc(d.verdictNote || "")}</span>${sp(8)}
<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:12px; color:${MUT};">Fonte: ${esc(d.source || "")}</p>
</td></tr></table>`;
}

// Fecha Logo: array de itens (tag/text/cpm/note) — não mais string única.
function fechaItem(f) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:4px solid #F2C94C; background-color:#FCF0CE;"><tr><td style="padding:14px 16px;">
${eyebrow(f.tag || "", "#7A5B00")}${sp(6)}${para(f.text || "", 15)}${f.cpm ? `<p style="margin:4px 0 0; font-family:'Courier New',Courier,monospace; font-size:13px; color:${INK};">${esc(f.cpm)}</p>` : ""}${f.note ? `<p style="margin:4px 0 0; font-family:Arial,sans-serif; font-size:12px; color:${MUT};">${esc(f.note)}</p>` : ""}
</td></tr></table>`;
}

// Clipping: lista de itens TIER 2 (title/summary/link/source+tier).
function clippingItem(it) {
  const tierLabel = it.tier ? `TIER ${it.tier}` : "";
  return `<tr><td style="padding:8px 0; border-bottom:1px solid ${HAIR};">
<a href="${esc(it.url || "")}" style="font-family:Arial,Helvetica,sans-serif; font-size:14px; font-weight:bold; color:${INK}; text-decoration:underline;">${esc(it.title || "")}</a>${sp(4)}
<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:1.5; color:${SOFT};">${esc(it.summary || "")}</p>
<p style="margin:4px 0 0; font-family:'Courier New',Courier,monospace; font-size:11px; color:${MUT}; text-transform:uppercase;">${esc(it.source || "")}${tierLabel ? ` &middot; ${tierLabel}` : ""}</p>
</td></tr>`;
}

// Radar de janelas — confiança via família de veredito já disponível (evita
// hex novo: alta=green, media=blue, baixa=gray).
const RADAR_CONFIDENCE = {
  alta: { ...VERDICT_FAMILY.green, label: "CONFIANÇA ALTA" },
  media: { ...VERDICT_FAMILY.blue, label: "CONFIANÇA MÉDIA" },
  baixa: { ...VERDICT_FAMILY.gray, label: "CONFIANÇA BAIXA" },
};
function radarRow(w) {
  const c = RADAR_CONFIDENCE[w.confidence] || RADAR_CONFIDENCE.baixa;
  return `<tr><td style="padding:8px 0; border-bottom:1px solid ${HAIR};">
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; font-weight:bold; color:${INK};">${esc(w.label || "")}${w.bonus ? ` <span style="font-family:'Courier New',Courier,monospace; font-size:13px; font-weight:normal; color:${SOFT};">${esc(w.bonus)}</span>` : ""}</div>
<div style="font-family:'Courier New',Courier,monospace; font-size:13px; color:${SOFT};">${esc(w.window || "")}</div>
<span style="display:inline-block; margin-top:4px; background-color:${c.bg}; color:${c.text}; font-family:Arial,sans-serif; font-size:10px; font-weight:bold; letter-spacing:1px; padding:2px 8px;">${c.label}</span>
${w.basis ? `<div style="margin-top:4px; font-family:Arial,sans-serif; font-size:12px; color:${MUT};">${esc(w.basis)}</div>` : ""}
</td></tr>`;
}

// Radar VPM (shoppingWatch): player/categoria/VPM em mono.
function shoppingRow(s) {
  return `<tr><td style="padding:6px 0; border-bottom:1px solid ${HAIR}; font-family:Arial,Helvetica,sans-serif; font-size:13px; color:${SOFT};">${esc(s.player || "")} &middot; ${esc(s.category || "")}</td><td align="right" style="padding:6px 0; border-bottom:1px solid ${HAIR}; font-family:'Courier New',Courier,monospace; font-size:13px; color:${INK};">${esc(s.vpmObservado || "")}</td></tr>`;
}

// Sinais rápidos: distinto visualmente de um card de Deal Desk — sem chip,
// sem borda de card, só linha com o motivo. NUNCA renderiza s.verdict/s.veredito
// (o shape do schema já não tem esse campo — reforço defensivo aqui também).
function sinalRapidoRow(s) {
  const rota = [s.origem, s.destino].filter(Boolean).join(" &rarr; ");
  return `<tr><td style="padding:6px 0; border-bottom:1px solid ${HAIR};">
<span style="font-family:Arial,Helvetica,sans-serif; font-size:13px; color:${SOFT};">${esc(rota)}</span>
${typeof s.brutoScore === "number" ? ` <span style="font-family:'Courier New',Courier,monospace; font-size:12px; color:${MUT};">bruto ${s.brutoScore}</span>` : ""}
<div style="font-family:Arial,Helvetica,sans-serif; font-size:12px; color:${MUT};">${esc(s.motivoNaoQualifica || "")}</div>
</td></tr>`;
}

function sectionRow(padTop, content) {
  return `<tr><td style="padding:${padTop}px 32px 8px 32px; border-top:1px solid ${HAIR};">${content}</td></tr>`;
}

export function renderEmail(ed) {
  const P = [];
  P.push(`<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" /><meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light" /><meta name="supported-color-schemes" content="light" />
<title>The Loyal Daily</title>
<!--[if mso]><style>table,td,th{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}</style><![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#EDE8DD; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#EDE8DD; opacity:0;">${esc(ed.preheader || "")}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EDE8DD;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:${PAPER};">`);

  // Cabeçalho — número/dia/hora/tempo de leitura (top-level no schema, não mais ed.meta).
  const metaLine = [
    ed.number ? `No ${ed.number}` : "", ed.weekday || "", ed.publishTime || "",
    ed.readingMinutes ? `${ed.readingMinutes} min de leitura` : "",
  ].filter(Boolean).map(esc).join(" &middot; ");
  P.push(`<tr><td style="padding:28px 32px 18px 32px; border-top:4px solid ${INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="left" style="font-family:Georgia,'Times New Roman',serif; font-size:26px; color:${INK}; line-height:1;"><span style="font-weight:normal;">The </span><span style="font-weight:bold;">Loyal</span></td>
<td align="right" style="font-family:'Courier New',Courier,monospace; font-size:11px; color:${MUT}; letter-spacing:1px;">DAILY</td>
</tr></table>${sp(8)}
<div style="font-family:'Courier New',Courier,monospace; font-size:11px; color:${MUT}; letter-spacing:1px; text-transform:uppercase;">${metaLine}</div>
${ed.illustrative ? `<div style="font-family:Arial,sans-serif; font-size:12px; color:${MUT}; margin-top:4px;">Edição ilustrativa. Números de exemplo.</div>` : ""}
</td></tr>`);

  // Sinal do dia — obrigatório sempre.
  P.push(`<tr><td style="padding:22px 32px; background-color:${PANEL2}; border-top:1px solid ${HAIR}; border-bottom:1px solid ${HAIR};">${eyebrow("Sinal do dia")}${sp(10)}
<p style="margin:0; font-family:Georgia,'Times New Roman',serif; font-size:21px; line-height:1.35; color:${INK}; font-weight:bold;">${esc(ed.signal || "")}</p></td></tr>`);

  // Deal Desk — omitido POR COMPLETO quando deals=[] (sem título, sem card).
  const deals = Array.isArray(ed.deals) ? ed.deals : [];
  if (deals.length > 0) {
    const cards = deals.slice(0, 3).map(dealCard).join(sp(12));
    if (deals.length > 3) {
      console.error(`[renderer/email] deals.length=${deals.length} > 3 — renderizando só os 3 primeiros (aviso, não corte silencioso, D-052/S1-D3).`);
    }
    P.push(`${DEAL_DESK_SECTION_MARKER}<tr><td style="padding:24px 32px 8px 32px;">${eyebrow("Deal Desk")}${sp(12)}${cards}</td></tr>`);
  }

  // Conta Feita — contaFeita explícito, ou fallback ao primeiro deal (D-052/S1-D1).
  const contaFeita = ed.contaFeita || (deals[0] ? deals[0].conta : null);
  if (contaFeita) {
    P.push(`<tr><td style="padding:22px 32px 8px 32px;">${eyebrow("Conta feita")}${sp(10)}${contaBlock(contaFeita)}</td></tr>`);
  }

  // Fecha Logo — array de itens, eixo independente de Deal Desk.
  const fechaLogo = Array.isArray(ed.fechaLogo) ? ed.fechaLogo : [];
  if (fechaLogo.length > 0) {
    P.push(`<tr><td style="padding:18px 32px;">${eyebrow("Fecha logo")}${sp(10)}${fechaLogo.map(fechaItem).join(sp(10))}</td></tr>`);
  }

  // O que evitar — opcional.
  if (ed.oQueEvitar) {
    P.push(`<tr><td style="padding:6px 32px 14px 32px;">${eyebrow("O que evitar", "#B53A3A")}${sp(6)}${para(ed.oQueEvitar, 15)}</td></tr>`);
  }

  // Ordem cravada (D-053): Resumo do dia → Clipping → Radar → Radar VPM →
  // Sinais rápidos → Loyalty Lab. Cada bloco só entra se tiver dado real
  // (regra-mãe §2.1/§2.3) — a decisão de omitir já foi tomada por quem monta
  // `ed` (v2/lib/digest/dia-fraco.mjs); este renderer só reflete presença/ausência.
  if (ed.resumoDoDia) {
    P.push(sectionRow(18, `${eyebrow("Resumo do dia")}${sp(8)}${para(ed.resumoDoDia, 15)}`));
  }

  if (Array.isArray(ed.clipping) && ed.clipping.length > 0) {
    const rows = ed.clipping.map(clippingItem).join("");
    P.push(sectionRow(18, `${eyebrow("Clipping")}${sp(8)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`));
  }

  const radarWindows = ed.radar && Array.isArray(ed.radar.windows) ? ed.radar.windows : [];
  if (radarWindows.length > 0) {
    const rows = radarWindows.map(radarRow).join("");
    P.push(sectionRow(18, `${eyebrow("Radar de janelas")}${sp(6)}${ed.radar.note ? para(ed.radar.note, 12, MUT) + sp(6) : ""}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`));
  }

  const shoppingWatch = Array.isArray(ed.shoppingWatch) ? ed.shoppingWatch : [];
  if (shoppingWatch.length > 0) {
    const rows = shoppingWatch.map(shoppingRow).join("");
    P.push(sectionRow(18, `${eyebrow("Radar VPM &middot; Shopping")}${sp(8)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`));
  }

  const sinaisRapidos = Array.isArray(ed.sinaisRapidos) ? ed.sinaisRapidos : [];
  if (sinaisRapidos.length > 0) {
    const rows = sinaisRapidos.map(sinalRapidoRow).join("");
    P.push(sectionRow(18, `${eyebrow("Sinais rápidos")}${sp(8)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`));
  }

  if (ed.loyaltyLab && ed.loyaltyLab.titulo) {
    const ll = ed.loyaltyLab;
    P.push(sectionRow(18, `${eyebrow("Loyalty Lab")}${sp(8)}
<div style="font-family:Georgia,serif; font-size:17px; font-weight:bold; color:${INK};">${esc(ll.titulo)}</div>${sp(6)}${para(ll.texto || "", 14, "#555555")}`));
  }

  // Fontes — obrigatório.
  const sources = Array.isArray(ed.sources) ? ed.sources : [];
  if (sources.length > 0) {
    const links = sources.map((s) => `<a href="${esc(s.url)}" style="color:#00A878; text-decoration:underline;">${esc(s.label)}</a>`).join(" &middot; ");
    P.push(sectionRow(18, `${eyebrow("Fontes", MUT)}${sp(6)}<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:1.7; color:${SOFT};">${links}</p>`));
  }

  // Disclaimer — sempre.
  P.push(`<tr><td style="padding:12px 32px 18px 32px;"><p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.6; color:${MUT};">${esc(ed.disclaimer || "")}</p></td></tr>`);

  // Footer — conteúdo de marca estático (não faz parte do contrato editorial
  // por edição; content/edition.schema.json não define `footer`). Merge tags
  // resolvidos no envio (Beehiiv/ESP).
  P.push(`<tr><td style="padding:22px 32px 30px 32px; background-color:${INK};">
<div style="font-family:Georgia,'Times New Roman',serif; font-size:20px; color:${PAPER};"><span style="font-weight:normal;">The </span><span style="font-weight:bold;">Loyal</span></div>${sp(10)}
<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.6; color:#B7B2A6;">Mídia independente sobre pontos, milhas, cartões, bancos, varejo e cashback.</p>${sp(12)}
<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.7; color:#B7B2A6;">
<a href="{{web_url}}" style="color:#00C48C; text-decoration:underline;">Ler no navegador</a> &nbsp;&middot;&nbsp;
<a href="{{metodologia_url}}" style="color:#00C48C; text-decoration:underline;">Metodologia</a> &nbsp;&middot;&nbsp;
<a href="{{unsubscribe_url}}" style="color:#00C48C; text-decoration:underline;">Cancelar inscrição</a></p>${sp(12)}
<p style="margin:0; font-family:'Courier New',Courier,monospace; font-size:11px; color:${MUT};">Ponto leu até aqui. Amanhã às 8h, a conta já vai estar feita.</p>
</td></tr>`);

  P.push(`</table></td></tr></table></body></html>`);
  return P.join("\n");
}
