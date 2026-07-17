// Renderer de e-mail-safe do The Loyal Daily.
// 600px, uma coluna, CSS 100% inline, tabelas role=presentation, fontes web-safe.
// Sem :root, sem Google Fonts, sem JavaScript, sem emoji.
//
// Realinhado a content/edition.schema.json (camelCase) — SPEC-SLICE-TEMPLATE-EMAIL-DAILY.md
// §0/§7. Antes este arquivo lia um contrato snake_case divergente (`sinal_do_dia`,
// `deal_desk`, `fecha_logo` como string única etc.) que nunca bateu com o schema
// versionado — D-052(4) ratificou content/edition.schema.json como canônico e este
// arquivo como o que realinha, não o contrário.
//
// v3 (D-057, SPEC-SLICE-DIGEST-ENGINE.md v3): ordem final da edição — Sinal do dia
// (Resumo fundido) → Ofertas ativas → Deals do dia → Vence em até 72h → Cartões &
// bancos → Clipping → O que fechou nesta semana → Radar VPM → Loyalty Lab → Predict.
// `resumoDoDia` deixa de ser seção própria (fundida no Sinal do dia); `radar`
// (janelas) migrou para dentro do teaser Predict — não renderizado mais como bloco
// isolado aqui; `sinaisRapidos` fica obsoleto como bloco de render (absorvido por
// `ofertasAtivas`) — a função que o gera continua testada em dia-fraco.mjs, só não
// é mais chamada por este renderer.
import { verdict, VERDICT_FAMILY } from "./tokens.mjs";
import { formatarTeaserPredict } from "../v2/lib/digest/dia-fraco.mjs";

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
const mono = (t, size = 12, color = SOFT) =>
  `<span style="font-family:'Courier New',Courier,monospace; font-size:${size}px; color:${color};">${esc(t)}</span>`;

function chip(vk) {
  const v = verdict(vk);
  const c = VERDICT_FAMILY[v.family];
  return `<span style="display:inline-block; background-color:${c.bg}; color:${c.text}; font-family:Arial,sans-serif; font-size:11px; font-weight:bold; letter-spacing:1px; padding:4px 10px;">${esc(v.label)}</span>`;
}

// Formata rota "origem->destino" (ou só origem para lado único) — o "->" vira
// seta via esc() (mesma convenção já usada em category/tag no resto do arquivo).
function rotaLabel(origem, destino) {
  return destino ? `${origem}->${destino}` : String(origem || "");
}
function percentualLabel(percentual) {
  return percentual !== null && percentual !== undefined ? `${percentual}%` : "—";
}
function dataLabel(iso) {
  return iso ? String(iso).slice(0, 10) : "sem data";
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

// Ofertas ativas (§1.1, D-057): tabela com TODO item vivo com conta computável,
// sem corte de veredito. Leitura reusa o mesmo chip de veredito canônico.
function ofertaAtivaRow(o) {
  return `<tr>
<td style="padding:8px 6px; border-bottom:1px solid ${HAIR}; font-family:Arial,Helvetica,sans-serif; font-size:13px; color:${INK};">${esc(rotaLabel(o.origem, o.destino))}</td>
<td style="padding:8px 6px; border-bottom:1px solid ${HAIR}; font-family:Arial,Helvetica,sans-serif; font-size:12px; color:${SOFT};">${esc(String(o.tipo || "").replace(/_/g, " "))}</td>
<td style="padding:8px 6px; border-bottom:1px solid ${HAIR};">${mono(percentualLabel(o.percentual), 13, INK)}</td>
<td style="padding:8px 6px; border-bottom:1px solid ${HAIR};">${mono(dataLabel(o.prazo), 12, SOFT)}</td>
<td style="padding:8px 6px; border-bottom:1px solid ${HAIR};">${chip(o.leitura)}</td>
</tr>`;
}
function ofertasAtivasTable(itens) {
  const th = (label) => `<td style="padding:6px; font-family:Arial,sans-serif; font-size:11px; color:${MUT}; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid ${HAIR};">${esc(label)}</td>`;
  const header = `<tr>${th("Programa/rota")}${th("Tipo")}${th("Bônus/preço")}${th("Prazo")}${th("Leitura")}</tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${header}${itens.map(ofertaAtivaRow).join("")}</table>`;
}

// Deals do dia (§1.2, D-057 — antes "Deal Desk"): card por item, numerado.
// Seção inteira omitida quando deals=[] (regra-mãe, D-050/D-051 — nunca card
// vazio/placeholder). A seção é delimitada por um comentário HTML único
// (DEAL_DESK_SECTION_MARKER) — não pelo texto isolado, porque esse texto pode
// aparecer legitimamente em prosa fora da seção. O gate 5.5
// (v2/lib/digest/gate-5-5.mjs, DEAL_DESK_MARKER) procura este MESMO comentário
// no HTML final — mudar o marcador aqui exige atualizar o gate junto. O nome
// interno da constante fica como está (implementação, não rótulo visível).
export const DEAL_DESK_SECTION_MARKER = '<!--section:deal-desk-->';
function dealCard(d, index) {
  const numero = typeof index === "number" ? `${index + 1}. ` : "";
  const leituraTexto = d.leitura || d.verdictNote || "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${HAIR}; background-color:${SURFACE};"><tr><td style="padding:16px 18px;">
<div style="font-family:'Courier New',Courier,monospace; font-size:11px; color:${MUT}; letter-spacing:1px; text-transform:uppercase;">${esc(d.category || "")}</div>${sp(6)}
<div style="font-family:Georgia,serif; font-size:17px; font-weight:bold; color:${INK}; line-height:1.35;">${esc(numero)}${esc(d.title || "")}</div>${sp(8)}
<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.55; color:#555555;">${esc(d.context || "")}</p>${sp(10)}
${contaBlock(d.conta)}${sp(10)}
${d.contaProsa ? `${eyebrow("A conta", MUT)}${sp(4)}${para(d.contaProsa, 13, SOFT)}${sp(10)}` : ""}
${chip(d.verdict)}<span style="font-family:Arial,sans-serif; font-size:13px; color:${SOFT}; padding-left:8px;">${esc(d.verdictNote || "")}</span>${sp(8)}
${leituraTexto ? `${eyebrow("Leitura", MUT)}${sp(4)}${para(leituraTexto, 13, SOFT)}${sp(8)}` : ""}
<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:12px; color:${MUT};">Fonte: ${esc(d.source || "")}</p>
</td></tr></table>`;
}

// Vence em até 72h (§1.3, D-057 — renomeação de Fecha Logo, MESMO seletor/dado
// de fechaLogo[]): lista simples, não mais cards com tag colorida.
function vence72hItem(f) {
  return `<tr><td style="padding:10px 0; border-bottom:1px solid ${HAIR};">
${eyebrow(f.tag || "", "#7A5B00")}${sp(4)}
${para(f.text || "", 14)}
${f.cpm ? `<div style="margin-top:2px;">${mono(f.cpm, 13, INK)}</div>` : ""}
${f.note ? `<div style="margin-top:2px; font-family:Arial,sans-serif; font-size:11px; color:${MUT};">${esc(f.note)}</div>` : ""}
</td></tr>`;
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

// O que fechou nesta semana (§1.6, D-057): bullets de recap, sem cálculo novo.
function fechouSemanaRow(f) {
  const rota = rotaLabel(f.origem, f.destino);
  const tipoLabel = String(f.tipo || "").replace(/_/g, " ");
  const pct = percentualLabel(f.percentual);
  return `<tr><td style="padding:6px 0; border-bottom:1px solid ${HAIR}; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:1.5; color:${SOFT};">
<span style="color:${INK}; font-weight:bold;">${esc(rota)}</span> — ${esc(tipoLabel)}${pct !== "—" ? ` (${mono(pct, 12, SOFT)})` : ""}, encerrou em ${mono(dataLabel(f.encerrouEm), 12, SOFT)}
</td></tr>`;
}

// Radar VPM (shoppingWatch): player/categoria/VPM em mono.
function shoppingRow(s) {
  return `<tr><td style="padding:6px 0; border-bottom:1px solid ${HAIR}; font-family:Arial,Helvetica,sans-serif; font-size:13px; color:${SOFT};">${esc(s.player || "")} &middot; ${esc(s.category || "")}</td><td align="right" style="padding:6px 0; border-bottom:1px solid ${HAIR}; font-family:'Courier New',Courier,monospace; font-size:13px; color:${INK};">${esc(s.vpmObservado || "")}</td></tr>`;
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

  // 1. Sinal do dia — obrigatório sempre. v3 (D-057 decisão 5): resumoDoDia
  // funde aqui como 2º parágrafo, não é mais seção própria.
  P.push(`<tr><td style="padding:22px 32px; background-color:${PANEL2}; border-top:1px solid ${HAIR}; border-bottom:1px solid ${HAIR};">${eyebrow("Sinal do dia")}${sp(10)}
<p style="margin:0; font-family:Georgia,'Times New Roman',serif; font-size:21px; line-height:1.35; color:${INK}; font-weight:bold;">${esc(ed.signal || "")}</p>${ed.resumoDoDia ? `${sp(10)}${para(ed.resumoDoDia, 15)}` : ""}</td></tr>`);

  // 2. Ofertas ativas (§1.1) — tabela, TODO item vivo com conta computável.
  const ofertasAtivas = Array.isArray(ed.ofertasAtivas) ? ed.ofertasAtivas : [];
  if (ofertasAtivas.length > 0) {
    P.push(sectionRow(18, `${eyebrow("Ofertas ativas")}${sp(10)}${ofertasAtivasTable(ofertasAtivas)}`));
  }

  // 3. Deals do dia — omitido POR COMPLETO quando deals=[] (sem título, sem card).
  const deals = Array.isArray(ed.deals) ? ed.deals : [];
  if (deals.length > 0) {
    const cards = deals.slice(0, 3).map((d, i) => dealCard(d, i)).join(sp(12));
    if (deals.length > 3) {
      console.error(`[renderer/email] deals.length=${deals.length} > 3 — renderizando só os 3 primeiros (aviso, não corte silencioso, D-052/S1-D3).`);
    }
    P.push(`${DEAL_DESK_SECTION_MARKER}<tr><td style="padding:24px 32px 8px 32px;">${eyebrow("Deals do dia")}${sp(12)}${cards}</td></tr>`);
  }

  // Conta Feita — contaFeita explícito, ou fallback ao primeiro deal (D-052/S1-D1).
  const contaFeita = ed.contaFeita || (deals[0] ? deals[0].conta : null);
  if (contaFeita) {
    P.push(`<tr><td style="padding:22px 32px 8px 32px;">${eyebrow("Conta feita")}${sp(10)}${contaBlock(contaFeita)}</td></tr>`);
  }

  // 4. Vence em até 72h (renomeação de Fecha Logo, mesmo dado fechaLogo[]).
  const fechaLogo = Array.isArray(ed.fechaLogo) ? ed.fechaLogo : [];
  if (fechaLogo.length > 0) {
    P.push(sectionRow(18, `${eyebrow("Vence em até 72h")}${sp(10)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${fechaLogo.map(vence72hItem).join("")}</table>`));
  }

  // O que evitar — opcional, junto do eixo Deals do dia/Vence 72h.
  if (ed.oQueEvitar) {
    P.push(`<tr><td style="padding:6px 32px 14px 32px;">${eyebrow("O que evitar", "#B53A3A")}${sp(6)}${para(ed.oQueEvitar, 15)}</td></tr>`);
  }

  // 5. Cartões & bancos (§1.4) — prosa evergreen.
  if (ed.cartoesBancos) {
    P.push(sectionRow(18, `${eyebrow("Cartões & bancos")}${sp(8)}${para(ed.cartoesBancos, 15)}`));
  }

  // 6. Clipping — sem mudança de seleção, só de posição na ordem v3.
  if (Array.isArray(ed.clipping) && ed.clipping.length > 0) {
    const rows = ed.clipping.map(clippingItem).join("");
    P.push(sectionRow(18, `${eyebrow("Clipping")}${sp(8)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`));
  }

  // 7. O que fechou nesta semana (§1.6) — bullets de recap TIER 1.
  const oQueFechouSemana = Array.isArray(ed.oQueFechouSemana) ? ed.oQueFechouSemana : [];
  if (oQueFechouSemana.length > 0) {
    P.push(sectionRow(18, `${eyebrow("O que fechou nesta semana")}${sp(8)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${oQueFechouSemana.map(fechouSemanaRow).join("")}</table>`));
  }

  // 8. Radar VPM — lógica/seletor inalterados (selecionarRadarVpm), só mudou
  // de posição na ordem v3 (D-057 decisão 7: bloco próprio, não funde).
  const shoppingWatch = Array.isArray(ed.shoppingWatch) ? ed.shoppingWatch : [];
  if (shoppingWatch.length > 0) {
    const rows = shoppingWatch.map(shoppingRow).join("");
    P.push(sectionRow(18, `${eyebrow("Radar VPM &middot; Shopping")}${sp(8)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`));
  }

  // 9. Loyalty Lab — lógica/score de automação inalterados, só mudou de
  // posição (D-057 decisão 8: bloco próprio, corte 0,85 inalterado).
  if (ed.loyaltyLab && ed.loyaltyLab.titulo) {
    const ll = ed.loyaltyLab;
    P.push(sectionRow(18, `${eyebrow("Loyalty Lab")}${sp(8)}
<div style="font-family:Georgia,serif; font-size:17px; font-weight:bold; color:${INK};">${esc(ll.titulo)}</div>${sp(6)}${para(ll.texto || "", 14, "#555555")}`));
  }

  // 10. Predict (§1.7) — teaser, só contagem, nunca valor/janela. `radar`
  // (janelas) migrou para dentro daqui (D-057 decisão 6) — não há mais bloco
  // "Radar de janelas" próprio.
  if (ed.predict && typeof ed.predict.ativos === "number" && ed.predict.ativos > 0) {
    const teaser = formatarTeaserPredict(ed.predict.ativos);
    P.push(sectionRow(18, `${eyebrow("Predict")}${sp(8)}${para(teaser, 14, SOFT)}`));
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
