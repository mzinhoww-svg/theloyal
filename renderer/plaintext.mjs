// Plain text fallback do The Loyal Daily.
import { verdict } from "./tokens.mjs";

const BAR = "-".repeat(60);
const s = (v) => (v == null ? "" : String(v));

function block(ed, key, title) {
  if (!ed[key]?.length) return [];
  const out = [title];
  for (const it of ed[key]) {
    if (it && typeof it === "object") out.push("- " + (it.destaque ? it.destaque + " " : "") + s(it.texto));
    else out.push("- " + s(it));
  }
  out.push("");
  return out;
}

export function renderPlaintext(ed) {
  const m = ed.meta || {};
  const L = [];
  const head = [m.numero ? `No ${m.numero}` : "", m.data_label, m.hora, m.tempo_leitura].filter(Boolean).join(" . ");
  L.push("THE LOYAL DAILY", head, "");
  if (m.preheader) L.push("Preheader: " + s(m.preheader), "");
  L.push(BAR, "");
  if (ed.abertura) L.push("ABERTURA", s(ed.abertura), "");
  if (ed.antes_da_conta) L.push("ANTES DA CONTA", s(ed.antes_da_conta), "");
  if (ed.na_edicao_de_hoje?.length) {
    L.push("NA EDICAO DE HOJE");
    for (const x of ed.na_edicao_de_hoje) L.push("- " + (x && typeof x === "object" ? (x.destaque ? x.destaque + " " : "") + s(x.texto) : s(x)));
    L.push("");
  }
  L.push(BAR, "", "SINAL DO DIA", s(ed.sinal_do_dia), "", BAR, "", "DEAL DESK");
  (ed.deal_desk || []).forEach((d, i) => {
    const label = verdict(d.veredito).label;
    L.push(`${i + 1}) ${s(d.tag)}`, `   ${s(d.titulo)}`, `   ${s(d.texto)}`,
      `   VEREDITO: ${label}` + (d.veredito_nota ? ` (${s(d.veredito_nota)})` : ""),
      d.vigencia ? `   VIGENCIA: ${s(d.vigencia)}` : "", "");
  });
  L.push(BAR, "", "CONTA FEITA");
  const cf = ed.conta_feita || {};
  for (const pair of cf.linhas || []) {
    const [k, v] = Array.isArray(pair) ? pair : [pair.k, pair.v];
    L.push(`${s(k).padEnd(10)}${s(v)}`);
  }
  if (cf.total) {
    const [tk, tv] = Array.isArray(cf.total) ? cf.total : [cf.total.k, cf.total.v];
    L.push(`${s(tk).padEnd(10)}${s(tv)}`);
  }
  if (cf.nota) L.push(s(cf.nota));
  L.push("", BAR, "");
  L.push(...block(ed, "program_watch", "PROGRAM WATCH"));
  L.push(...block(ed, "bank_cards_watch", "BANK & CARDS WATCH"));
  L.push(...block(ed, "retail_coalition", "RETAIL & COALITION"));
  if (ed.loyalty_lab) L.push(`LOYALTY LAB . ${s(ed.loyalty_lab.titulo)}`, s(ed.loyalty_lab.texto), "");
  L.push(BAR, "", "FECHA LOGO", s(ed.fecha_logo), "", "O QUE EVITARIA", s(ed.o_que_evitaria), "");
  L.push(...block(ed, "sinais_rapidos", "SINAIS RAPIDOS"));
  if (ed.sua_leitura?.length) {
    L.push("SUA LEITURA");
    for (const it of ed.sua_leitura) L.push(`- ${s(it.perfil)}: ${s(it.texto)}`);
    L.push("");
  }
  L.push(BAR, "");
  if (ed.fontes_metodologia) L.push("FONTES E METODOLOGIA", s(ed.fontes_metodologia), "");
  L.push("DISCLAIMER", s(ed.disclaimer), "", BAR, "");
  const ft = ed.footer || {}, lk = ft.links || {};
  L.push("The Loyal . " + s(ft.descricao || "Midia independente sobre pontos, milhas, cartoes, bancos, varejo e cashback."), "");
  L.push("Ler no navegador: " + s(lk.web_url || "{{web_url}}"),
    "Metodologia: " + s(lk.metodologia_url || "{{metodologia_url}}"),
    "Cancelar inscricao: " + s(lk.unsubscribe_url || "{{unsubscribe_url}}"), "");
  L.push(s(ft.assinatura_ponto || "Amanha as 8h, a conta ja vai estar feita."));
  return L.join("\n") + "\n";
}
