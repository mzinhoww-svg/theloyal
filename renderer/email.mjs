// Renderer de e-mail-safe do The Loyal Daily.
// 600px, uma coluna, CSS 100% inline, tabelas role=presentation, fontes web-safe.
// Sem :root, sem Google Fonts, sem JavaScript, sem emoji.
import { verdict, VERDICT_FAMILY } from "./tokens.mjs";

function esc(s) {
  const t = String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return t.replace(/-&gt;/g, "&rarr;");
}
const sp = (px) => `<div style="height:${px}px; line-height:${px}px;">&nbsp;</div>`;
const E = "#007A57", MUT = "#8A8578", HAIR = "#E5E0D5", SOFT = "#3D3A34", PANEL2 = "#F1ECE1";

const eyebrow = (t, c = E) =>
  `<div style="font-family:'Courier New',Courier,monospace; font-size:11px; color:${c}; letter-spacing:1.5px; text-transform:uppercase; font-weight:bold;">${esc(t)}</div>`;
const para = (t, size = 15, color = SOFT) =>
  `<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:${size}px; line-height:1.6; color:${color};">${esc(t)}</p>`;

function chip(vk) {
  const v = verdict(vk);
  const c = VERDICT_FAMILY[v.family];
  return `<span style="display:inline-block; background-color:${c.bg}; color:${c.text}; font-family:Arial,sans-serif; font-size:11px; font-weight:bold; letter-spacing:1px; padding:4px 10px;">${esc(v.label)}</span>`;
}

function rows(items) {
  const n = items.length;
  const cells = items.map((it, i) => {
    const border = i === n - 1 ? "" : "border-bottom:1px solid #E5E0D5;";
    let cell;
    if (it && typeof it === "object") {
      cell = it.destaque ? `<strong style="color:#111;">${esc(it.destaque)}</strong> ${esc(it.texto || "")}` : esc(it.texto || "");
    } else cell = esc(it);
    return `<tr><td style="padding:5px 0; ${border}">${cell}</td></tr>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.55; color:#3D3A34;">${cells}</table>`;
}

export function renderEmail(ed) {
  const m = ed.meta || {};
  const P = [];
  P.push(`<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" /><meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>The Loyal Daily</title>
<!--[if mso]><style>table,td,th{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}</style><![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#EDE8DD; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#EDE8DD; opacity:0;">${esc(m.preheader || "")}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EDE8DD;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#FAF7F0;">`);

  const metaLine = [
    m.numero ? `No ${m.numero}` : "", m.data_label || "", m.hora || "", m.tempo_leitura || "",
  ].filter(Boolean).map(esc).join(" &middot; ");
  P.push(`<tr><td style="padding:28px 32px 18px 32px; border-top:4px solid #111111;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="left" style="font-family:Georgia,'Times New Roman',serif; font-size:26px; color:#111111; line-height:1;"><span style="font-weight:normal;">The </span><span style="font-weight:bold;">Loyal</span></td>
<td align="right" style="font-family:'Courier New',Courier,monospace; font-size:11px; color:#8A8578; letter-spacing:1px;">DAILY</td>
</tr></table>${sp(8)}
<div style="font-family:'Courier New',Courier,monospace; font-size:11px; color:#8A8578; letter-spacing:1px; text-transform:uppercase;">${metaLine}</div>
</td></tr>`);

  if (ed.abertura) P.push(`<tr><td style="padding:22px 32px 8px 32px; border-top:1px solid ${HAIR};">${para(ed.abertura, 16)}</td></tr>`);
  if (ed.antes_da_conta) P.push(`<tr><td style="padding:14px 32px 8px 32px;">${eyebrow("Antes da conta")}${sp(6)}${para(ed.antes_da_conta, 15, MUT)}</td></tr>`);
  if (ed.na_edicao_de_hoje?.length) P.push(`<tr><td style="padding:14px 32px 10px 32px;">${eyebrow("Na edicao de hoje")}${sp(8)}${rows(ed.na_edicao_de_hoje)}</td></tr>`);

  P.push(`<tr><td style="padding:22px 32px; background-color:${PANEL2}; border-top:1px solid ${HAIR}; border-bottom:1px solid ${HAIR};">${eyebrow("Sinal do dia")}${sp(10)}
<p style="margin:0; font-family:Georgia,'Times New Roman',serif; font-size:21px; line-height:1.35; color:#111111; font-weight:bold;">${esc(ed.sinal_do_dia)}</p></td></tr>`);

  const deals = (ed.deal_desk || []).map((d) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E0D5; background-color:#FFFFFF;"><tr><td style="padding:16px 18px;">
<div style="font-family:'Courier New',Courier,monospace; font-size:11px; color:#8A8578; letter-spacing:1px; text-transform:uppercase;">${esc(d.tag || "")}</div>${sp(6)}
<div style="font-family:Georgia,serif; font-size:17px; font-weight:bold; color:#111111; line-height:1.35;">${esc(d.titulo || "")}</div>${sp(8)}
<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.55; color:#555555;">${esc(d.texto || "")}</p>${sp(10)}
${chip(d.veredito)}<span style="font-family:Arial,sans-serif; font-size:13px; color:#3D3A34; padding-left:8px;">${esc(d.veredito_nota || "")}</span>
</td></tr></table>`).join(sp(12));
  P.push(`<tr><td style="padding:24px 32px 8px 32px;">${eyebrow("Deal Desk")}${sp(12)}${deals}</td></tr>`);

  const cf = ed.conta_feita || {};
  let contaBody = "";
  for (const pair of cf.linhas || []) {
    const [k, v] = Array.isArray(pair) ? pair : [pair.k, pair.v];
    contaBody += `<span style="color:#8A8578;">${esc(k)}&nbsp;&nbsp;</span> ${esc(v)}<br />`;
  }
  if (cf.total) {
    const [tk, tv] = Array.isArray(cf.total) ? cf.total : [cf.total.k, cf.total.v];
    contaBody += `<span style="color:#00C48C;">${esc(tk)}&nbsp;&nbsp;${esc(tv)}</span>`;
  }
  P.push(`<tr><td style="padding:22px 32px 8px 32px;">${eyebrow("Conta feita")}${sp(10)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111;"><tr><td style="padding:16px 18px; font-family:'Courier New',Courier,monospace; font-size:13px; line-height:1.9; color:#FAF7F0;">${contaBody}</td></tr></table>${cf.nota ? sp(8) + para(cf.nota, 13, MUT) : ""}</td></tr>`);

  const watches = [["program_watch", "Program Watch"], ["bank_cards_watch", "Bank & Cards Watch"], ["retail_coalition", "Retail & Coalition"]];
  let first = true;
  for (const [key, title] of watches) {
    if (ed[key]?.length) {
      const top = first ? "border-top:1px solid #E5E0D5;" : "";
      P.push(`<tr><td style="padding:${first ? "20" : "16"}px 32px 4px 32px; ${top}">${eyebrow(title)}${sp(8)}${rows(ed[key])}</td></tr>`);
      first = false;
    }
  }
  if (ed.loyalty_lab) {
    const ll = ed.loyalty_lab;
    P.push(`<tr><td style="padding:18px 32px 8px 32px; border-top:1px solid ${HAIR};">${eyebrow("Loyal Lab")}${sp(8)}
<div style="font-family:Georgia,serif; font-size:17px; font-weight:bold; color:#111111;">${esc(ll.titulo || "")}</div>${sp(6)}${para(ll.texto || "", 14, "#555555")}</td></tr>`);
  }
  P.push(`<tr><td style="padding:18px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:4px solid #F2C94C; background-color:#FCF0CE;"><tr><td style="padding:14px 16px;">
${eyebrow("Fecha logo", "#7A5B00")}${sp(6)}${para(ed.fecha_logo, 15)}</td></tr></table></td></tr>`);
  P.push(`<tr><td style="padding:6px 32px 14px 32px;">${eyebrow("O que evitaria", "#B53A3A")}${sp(6)}${para(ed.o_que_evitaria, 15)}</td></tr>`);
  if (ed.sinais_rapidos?.length) P.push(`<tr><td style="padding:12px 32px 4px 32px; border-top:1px solid ${HAIR};">${eyebrow("Sinais rapidos")}${sp(8)}${rows(ed.sinais_rapidos)}</td></tr>`);
  if (ed.sua_leitura?.length) {
    const sl = ed.sua_leitura.map((it) => `<tr><td style="padding:5px 0;"><strong style="color:#111;">${esc(it.perfil || "")}:</strong> ${esc(it.texto || "")}</td></tr>`).join("");
    P.push(`<tr><td style="padding:18px 32px; background-color:${PANEL2}; border-top:1px solid ${HAIR};">${eyebrow("Sua leitura")}${sp(8)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.55; color:#3D3A34;">${sl}</table></td></tr>`);
  }
  if (ed.fontes_metodologia) P.push(`<tr><td style="padding:18px 32px 4px 32px;">${eyebrow("Fontes e metodologia", MUT)}${sp(6)}${para(ed.fontes_metodologia, 13, "#555555")}</td></tr>`);
  P.push(`<tr><td style="padding:12px 32px 18px 32px;"><p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.6; color:#8A8578;">${esc(ed.disclaimer)}</p></td></tr>`);

  const ft = ed.footer || {}; const lk = ft.links || {};
  P.push(`<tr><td style="padding:22px 32px 30px 32px; background-color:#111111;">
<div style="font-family:Georgia,'Times New Roman',serif; font-size:20px; color:#FAF7F0;"><span style="font-weight:normal;">The </span><span style="font-weight:bold;">Loyal</span></div>${sp(10)}
<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.6; color:#B7B2A6;">${esc(ft.descricao || "Midia independente sobre pontos, milhas, cartoes, bancos, varejo e cashback.")}</p>${sp(12)}
<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.7; color:#B7B2A6;">
<a href="${esc(lk.web_url || "{{web_url}}")}" style="color:#00C48C; text-decoration:underline;">Ler no navegador</a> &nbsp;&middot;&nbsp;
<a href="${esc(lk.metodologia_url || "{{metodologia_url}}")}" style="color:#00C48C; text-decoration:underline;">Metodologia</a> &nbsp;&middot;&nbsp;
<a href="${esc(lk.unsubscribe_url || "{{unsubscribe_url}}")}" style="color:#00C48C; text-decoration:underline;">Cancelar inscricao</a></p>${sp(12)}
<p style="margin:0; font-family:'Courier New',Courier,monospace; font-size:11px; color:#8A8578;">${esc(ft.assinatura_ponto || "Ponto leu ate aqui. Amanha as 8h, a conta ja vai estar feita.")}</p>
</td></tr>`);

  P.push(`</table></td></tr></table></body></html>`);
  return P.join("\n");
}
