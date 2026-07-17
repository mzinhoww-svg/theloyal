// Renderer de e-mail-safe do The Loyal Daily.
// 600px, uma coluna, CSS 100% inline, tabelas role=presentation, fontes web-safe.
// Sem :root, sem Google Fonts, sem JavaScript, sem emoji.
//
// Realinhado a content/edition.schema.json (camelCase) — SPEC-SLICE-TEMPLATE-EMAIL-DAILY.md
// §0/§7. D-052(4) ratificou content/edition.schema.json como canônico e este
// arquivo como o que realinha, não o contrário.
//
// v4 (D-059, formato aprovado pelo operador): MESMA estrutura de conteúdo do
// render-beehiiv.mjs — imagens de template full-width (<img> é permitido em
// e-mail), Sinal do dia como caixa com item confirmado (números em negrito +
// fonte oficial) + radar sem confirmação + narrativa do Predict, Ofertas
// ativas com rota legível (rotaDisplay: compra/clube exibe o próprio programa,
// nunca "sem destino") e CPM, Fecha Logo como caixa amarela (fill yellow-100,
// borda yellow-500 — amarelo nunca como texto), Cartões e bancos por item com
// fonte linkada e intro EXPLICA_SEM_NOTA, Clipping ordenado por relevância e
// SEM rótulo de tier (jargão interno não vaza, D-059), O que fechou com nomes
// legíveis. Regra-mãe intacta: seção sem dado real é omitida por inteiro.
import { verdict, VERDICT_FAMILY } from "./tokens.mjs";
import { formatarTeaserPredict } from "../v2/lib/digest/dia-fraco.mjs";
import {
  rotaDisplay, tipoLabel, ordenarClippingPorRelevancia, EXPLICA_SEM_NOTA,
  formatarDataBr, formatarDiaMes,
} from "../v2/lib/digest/editorial.mjs";
import {
  IMG_HEADER, IMG_SECAO_SINAL, IMG_SECAO_FECHA, IMG_DIVISOR_LINHA,
} from "../v2/lib/digest/render-beehiiv.mjs";

function esc(s) {
  const t = String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return t.replace(/-&gt;/g, "&rarr;");
}
const sp = (px) => `<div style="height:${px}px; line-height:${px}px;">&nbsp;</div>`;

// Tokens já nomeados no arquivo original — reusados, nunca hex solto fora daqui.
const E = "#007A57", MUT = "#8A8578", HAIR = "#E5E0D5", SOFT = "#3D3A34", PANEL2 = "#F1ECE1";
const INK = "#111111", PAPER = "#FAF7F0", SURFACE = "#FFFFFF";
const YELLOW100 = "#FCF0CE", YELLOW500 = "#F2C94C";

const eyebrow = (t, c = E) =>
  `<div style="font-family:'Courier New',Courier,monospace; font-size:11px; color:${c}; letter-spacing:1.5px; text-transform:uppercase; font-weight:bold;">${esc(t)}</div>`;
const para = (t, size = 15, color = SOFT) =>
  `<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:${size}px; line-height:1.6; color:${color};">${esc(t)}</p>`;
const paraRaw = (innerHtml, size = 15, color = SOFT) =>
  `<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:${size}px; line-height:1.6; color:${color};">${innerHtml}</p>`;
const mono = (t, size = 12, color = SOFT) =>
  `<span style="font-family:'Courier New',Courier,monospace; font-size:${size}px; color:${color};">${esc(t)}</span>`;
const templateImg = (src, alt = "") =>
  `<tr><td style="padding:0;"><img src="${esc(src)}" width="600" alt="${esc(alt)}" style="display:block; width:100%; max-width:600px; height:auto; border:0;" /></td></tr>`;
const aLink = (url, innerHtml, color = "#00A878") =>
  `<a href="${esc(url)}" style="color:${color}; text-decoration:underline;">${innerHtml}</a>`;

function chip(vk) {
  const v = verdict(vk);
  const c = VERDICT_FAMILY[v.family];
  return `<span style="display:inline-block; background-color:${c.bg}; color:${c.text}; font-family:Arial,sans-serif; font-size:11px; font-weight:bold; letter-spacing:1px; padding:4px 10px;">${esc(v.label)}</span>`;
}

// Números (R$, %, datas, contagens) em negrito — item confirmado do Sinal do
// dia (formato aprovado: números saltando à vista).
function boldNumbers(t) {
  return esc(t).replace(/(R\$\s?)?\d+(?:[.,/]\d+)*%?/g, (m) => `<strong>${m}</strong>`);
}

function percentualLabel(percentual) {
  return percentual !== null && percentual !== undefined ? `${percentual}%` : "—";
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

// Ofertas ativas (v4): rota legível + sublinha (tipo/público/nota/prazo), %,
// CPM ("por milheiro") e leitura com o chip canônico.
function ofertaAtivaRow(o) {
  const sub = [
    `${tipoLabel(o.tipo)}${o.publico ? ` (${o.publico})` : ""}`,
    o.nota !== null && o.nota !== undefined ? `TL ${o.nota}` : null,
    o.prazo ? `vence ${formatarDiaMes(o.prazo)}` : null,
  ].filter(Boolean).join(" &middot; ");
  const cpmCell = o.cpm
    ? `${mono(o.cpm, 13, INK)} <span style="font-family:Arial,sans-serif; font-size:10px; color:${MUT};">por milheiro</span>`
    : mono("—", 13, MUT);
  return `<tr>
<td style="padding:8px 6px; border-bottom:1px solid ${HAIR}; font-family:Arial,Helvetica,sans-serif; font-size:13px; color:${INK}; width:34%;"><strong>${esc(rotaDisplay(o))}</strong><br /><span style="font-size:11px; color:${MUT};">${sub}</span></td>
<td style="padding:8px 6px; border-bottom:1px solid ${HAIR}; width:14%;">${mono(percentualLabel(o.percentual), 13, INK)}</td>
<td style="padding:8px 6px; border-bottom:1px solid ${HAIR}; width:22%;">${cpmCell}</td>
<td style="padding:8px 6px; border-bottom:1px solid ${HAIR}; width:30%;">${chip(o.leitura)}</td>
</tr>`;
}
function ofertasAtivasTable(itens) {
  const th = (label) => `<td style="padding:6px; font-family:Arial,sans-serif; font-size:11px; color:${MUT}; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid ${HAIR};">${esc(label)}</td>`;
  const header = `<tr>${th("Programa/rota")}${th("Bônus")}${th("Milheiro")}${th("Leitura")}</tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${header}${itens.map(ofertaAtivaRow).join("")}</table>`;
}

// Deals do dia (§1.2, D-057): card por item, numerado. Seção inteira omitida
// quando deals=[] (regra-mãe, D-050/D-051). Delimitada por comentário HTML
// único — o gate 5.5 (DEAL_DESK_MARKER) procura este MESMO comentário.
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

// Radar sem confirmação (v4): item dentro da caixa do Sinal do dia.
function radarSemConfirmacaoItem(r) {
  const partes = [
    `${aLink(r.url, `<strong>${esc(r.titulo)}</strong>`, INK)} — ${esc(r.detalhe)}`,
    r.nota !== null && r.nota !== undefined ? mono(`TL ${r.nota}`, 12, SOFT) : null,
    r.vence ? `<span style="font-size:12px; color:${MUT};">vence ${esc(formatarDiaMes(r.vence))}</span>` : null,
    `<span style="font-size:12px; color:${MUT};">(${esc(r.fonte)})</span>`,
  ].filter(Boolean);
  return `${paraRaw(partes.join(" &middot; "), 13, SOFT)}${sp(6)}`;
}

// Fecha Logo (v4): item da caixa amarela — lead em negrito + corpo + fonte.
function fechaLogoItem(f) {
  const partes = [
    `<strong>${esc(f.tag || "")}</strong> — ${esc(f.text || "")}`,
    f.cpm ? mono(f.cpm, 12, SOFT) : null,
    f.url ? `<span style="font-size:12px; color:${MUT};">(${aLink(f.url, "fonte", "#00A878")})</span>` : null,
  ].filter(Boolean);
  return `${paraRaw(partes.join(" "), 14, INK)}${sp(8)}`;
}

// Clipping (v4): sem rótulo de tier — taxonomia interna não vaza (D-059).
function clippingItem(it) {
  return `<tr><td style="padding:8px 0; border-bottom:1px solid ${HAIR};">
${paraRaw(`${aLink(it.url || "", `<strong>${esc(it.title || "")}</strong>`, INK)} <span style="font-size:12px; color:${MUT};">(${esc(it.source || "")})</span> — ${esc(it.summary || "")}`, 13, SOFT)}
</td></tr>`;
}

// O que fechou nesta semana (v4): nomes legíveis + dd/mm, sem cálculo novo.
function fechouSemanaRow(f) {
  const pct = f.percentual !== null && f.percentual !== undefined ? ` a ${mono(`${f.percentual}%`, 12, SOFT)}` : "";
  return `<tr><td style="padding:6px 0; border-bottom:1px solid ${HAIR}; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:1.5; color:${SOFT};">
<span style="color:${INK}; font-weight:bold;">${esc(rotaDisplay(f))}</span> — ${esc(tipoLabel(f.tipo))}${pct}, encerrou em ${mono(formatarDiaMes(f.encerrouEm), 12, SOFT)}
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

  // 1. Header de marca (imagem) + linha meta:
  //    Nº {number} · {WEEKDAY} · {dd/mm/yyyy} · leitura de {readingMinutes} min
  P.push(templateImg(IMG_HEADER, "The Loyal — Daily"));
  const metaLine = [
    ed.number ? `Nº ${ed.number}` : "", ed.weekday || "",
    ed.date ? formatarDataBr(ed.date) : "",
    ed.readingMinutes ? `leitura de ${ed.readingMinutes} min` : "",
  ].filter(Boolean).map(esc).join(" &middot; ");
  P.push(`<tr><td style="padding:14px 32px 12px 32px;">
<div style="font-family:'Courier New',Courier,monospace; font-size:11px; color:${MUT}; letter-spacing:1px; text-transform:uppercase;">${metaLine}</div>
${ed.illustrative ? `<div style="font-family:Arial,sans-serif; font-size:12px; color:${MUT}; margin-top:4px;">Edição ilustrativa. Números de exemplo.</div>` : ""}
</td></tr>`);

  // 2. Sinal do dia — divisor de seção (imagem) + caixa: manchete, item
  // confirmado (números em negrito + fonte oficial), radar sem confirmação e
  // narrativa do Predict. Sub-blocos sem dado ficam ausentes (regra-mãe).
  P.push(templateImg(IMG_SECAO_SINAL, "Sinal do dia"));
  const sinalPartes = [
    `<p style="margin:0; font-family:Georgia,'Times New Roman',serif; font-size:21px; line-height:1.35; color:${INK}; font-weight:bold;">${esc(ed.signal || "")}</p>`,
  ];
  if (ed.resumoDoDia) {
    const fonteOficial = Array.isArray(ed.sources) && ed.sources[0]
      ? ` (${aLink(ed.sources[0].url, "fonte oficial")})`
      : "";
    sinalPartes.push(`${sp(10)}${paraRaw(`${boldNumbers(ed.resumoDoDia)}${fonteOficial}`, 15, SOFT)}`);
  }
  const radarSemConfirmacao = Array.isArray(ed.radarSemConfirmacao) ? ed.radarSemConfirmacao : [];
  if (radarSemConfirmacao.length > 0) {
    sinalPartes.push(`${sp(12)}${paraRaw(`<strong>No radar, ainda sem confirmação oficial:</strong>`, 14, INK)}${sp(6)}`);
    sinalPartes.push(radarSemConfirmacao.map(radarSemConfirmacaoItem).join(""));
  }
  if (ed.predictNarrativa && ed.predictNarrativa.texto) {
    sinalPartes.push(`${sp(6)}${para(ed.predictNarrativa.texto, 14, SOFT)}`);
  }
  P.push(`<tr><td style="padding:22px 32px; background-color:${PANEL2}; border-bottom:1px solid ${HAIR};">${sinalPartes.join("")}</td></tr>`);

  // 3. Ofertas ativas (§1.1) — TODO item vivo com conta feita.
  const ofertasAtivas = Array.isArray(ed.ofertasAtivas) ? ed.ofertasAtivas : [];
  if (ofertasAtivas.length > 0) {
    P.push(sectionRow(18, `${eyebrow("Ofertas ativas")}${sp(6)}${para("O que está valendo hoje, com a conta feita e a leitura TL:", 13, MUT)}${sp(8)}${ofertasAtivasTable(ofertasAtivas)}`));
  }

  // 4. Deals do dia — omitido POR COMPLETO quando deals=[] (sem título, sem card).
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

  // 5. Fecha Logo — divisor (imagem) + caixa amarela (fill yellow-100, borda
  // esquerda yellow-500; texto Ink — amarelo nunca como texto, regra 7).
  const fechaLogo = Array.isArray(ed.fechaLogo) ? ed.fechaLogo : [];
  if (fechaLogo.length > 0) {
    P.push(templateImg(IMG_SECAO_FECHA, "Fecha logo"));
    P.push(`<tr><td style="padding:12px 32px 8px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${YELLOW100}; border-left:4px solid ${YELLOW500};"><tr><td style="padding:14px 18px 6px 18px;">${fechaLogo.map(fechaLogoItem).join("")}</td></tr></table>
</td></tr>`);
  }

  // O que evitar — opcional, junto do eixo Deals do dia/Fecha Logo.
  if (ed.oQueEvitar) {
    P.push(`<tr><td style="padding:6px 32px 14px 32px;">${eyebrow("O que evitar", "#B53A3A")}${sp(6)}${para(ed.oQueEvitar, 15)}</td></tr>`);
  }

  // 6. Cartões e bancos (v4): título em TEXTO português (a arte "Bank & Cards
  // Watch" em inglês não entra), intro fixa EXPLICA_SEM_NOTA + itens com fonte
  // linkada. Fallback: prosa única legada (campo DEPRECADO).
  const cartoesItens = Array.isArray(ed.cartoesBancosItens) ? ed.cartoesBancosItens : [];
  if (cartoesItens.length > 0) {
    const lis = cartoesItens.map((c) => {
      const status = c.status ? ` ${esc(c.status)}.` : "";
      return `<li style="margin:0 0 8px 0;">${paraRaw(`<strong>${esc(c.nome)}</strong> — ${esc(c.descricao)} (${aLink(c.url, esc(c.fonte))}).${status}`, 13, SOFT)}</li>`;
    }).join("");
    P.push(sectionRow(18, `${eyebrow("Cartões e bancos")}${sp(8)}${para(EXPLICA_SEM_NOTA, 13, MUT)}${sp(8)}<ul style="margin:0; padding-left:18px;">${lis}</ul>`));
  } else if (ed.cartoesBancos) {
    P.push(sectionRow(18, `${eyebrow("Cartões e bancos")}${sp(8)}${para(ed.cartoesBancos, 15)}`));
  }

  // 7. Clipping — ordenado por relevância editorial (determinístico, v4).
  if (Array.isArray(ed.clipping) && ed.clipping.length > 0) {
    const rows = ordenarClippingPorRelevancia(ed.clipping).map(clippingItem).join("");
    P.push(sectionRow(18, `${eyebrow("Clipping")}${sp(8)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`));
  }

  // 8. O que fechou nesta semana (§1.6) — recap TIER 1 com nomes legíveis.
  const oQueFechouSemana = Array.isArray(ed.oQueFechouSemana) ? ed.oQueFechouSemana : [];
  if (oQueFechouSemana.length > 0) {
    P.push(sectionRow(18, `${eyebrow("O que fechou nesta semana")}${sp(8)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${oQueFechouSemana.map(fechouSemanaRow).join("")}</table>`));
  }

  // 9. Radar VPM — lógica/seletor inalterados (selecionarRadarVpm, D-057 decisão 7).
  const shoppingWatch = Array.isArray(ed.shoppingWatch) ? ed.shoppingWatch : [];
  if (shoppingWatch.length > 0) {
    const rows = shoppingWatch.map(shoppingRow).join("");
    P.push(sectionRow(18, `${eyebrow("Radar VPM &middot; Shopping")}${sp(8)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`));
  }

  // 10. Loyalty Lab — lógica/score de automação inalterados (D-057 decisão 8).
  if (ed.loyaltyLab && ed.loyaltyLab.titulo) {
    const ll = ed.loyaltyLab;
    P.push(sectionRow(18, `${eyebrow("Loyalty Lab")}${sp(8)}
<div style="font-family:Georgia,serif; font-size:17px; font-weight:bold; color:${INK};">${esc(ll.titulo)}</div>${sp(6)}${para(ll.texto || "", 14, "#555555")}`));
  }

  // 11. Predict formal (§1.7) — teaser, só contagem, nunca valor/janela.
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

  // Fecho — divisor de linha (imagem) + disclaimer (sempre).
  P.push(templateImg(IMG_DIVISOR_LINHA, ""));
  P.push(`<tr><td style="padding:12px 32px 18px 32px;"><p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.6; color:${MUT};">${esc(ed.disclaimer || "")}</p></td></tr>`);

  // Footer — conteúdo de marca estático (não faz parte do contrato editorial
  // por edição). Merge tags resolvidos no envio (Beehiiv/ESP).
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
