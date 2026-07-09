// Sistema de QA do The Loyal Daily.
// Audita o JSON editorial e o HTML de e-mail renderizado em todas as dimensoes.
// Retorna { approved, blocks, warnings, fixes, dimensions } para o relatorio.
import { validateEdition } from "./validate.mjs";
import { renderEmail } from "./email.mjs";
import { APPROVED_HEX, SAFE_FONTS, WEBFONTS, URGENCY } from "./tokens.mjs";
import { checkContrast } from "./contrast.mjs";

function classify(msg) {
  const m = msg.toLowerCase();
  if (m.includes("vigencia")) return "vigencia";
  if (m.includes("emoji")) return "emoji";
  if (m.includes("ponto")) return "Ponto em bloco analitico";
  if (m.includes("cmi") || m.includes("interno")) return "dado interno / CMI";
  if (m.includes("link") || m.includes("unsubscribe")) return "links";
  if (m.includes("disclaimer")) return "disclaimer";
  if (m.includes("veredito")) return "integridade JSON";
  return "integridade JSON";
}

// parse pt-BR "R$ 1.394,00" / "40.000" / "17,42" -> number
function num(str) {
  const m = String(str).replace(/[^\d.,]/g, "");
  if (!m) return NaN;
  return parseFloat(m.replace(/\./g, "").replace(",", "."));
}

function checkCalculo(ed) {
  const cf = ed.conta_feita || {};
  const linhas = cf.linhas || [];
  const flat = linhas.map((p) => (Array.isArray(p) ? p : [p.k, p.v]));
  const findVal = (re) => { const row = flat.find(([k]) => re.test(String(k))); return row ? row[1] : null; };
  const custo = num(findVal(/custo|preco|valor/i));
  // milhas finais: procura "N milhas" em qualquer valor, ou linha 'milhas'
  let milhas = NaN;
  const milhasRow = findVal(/milhas|finais/i);
  if (milhasRow) milhas = num(milhasRow);
  if (isNaN(milhas)) {
    for (const [, v] of flat) { const mm = String(v).match(/([\d.]+)\s*milhas/i); if (mm) { milhas = num(mm[1]); break; } }
  }
  const totalV = Array.isArray(cf.total) ? cf.total[1] : cf.total?.v;
  const cpmStated = num(totalV);
  if (isNaN(custo) || isNaN(milhas) || isNaN(cpmStated) || milhas === 0) {
    return { ok: null, msg: "calculo nao verificavel automaticamente (campos numericos nao reconhecidos)" };
  }
  const cpmCalc = custo / (milhas / 1000);
  const diff = Math.abs(cpmCalc - cpmStated) / cpmCalc;
  if (diff <= 0.02) return { ok: true, msg: `CPM confere: informado ${cpmStated.toFixed(2)}, calculado ${cpmCalc.toFixed(2)}` };
  return { ok: false, msg: `CPM inconsistente: informado ${cpmStated.toFixed(2)}, calculado ${cpmCalc.toFixed(2)} (custo ${custo} / ${milhas} milhas)` };
}

function* allStrings(obj) {
  if (obj == null) return;
  if (typeof obj === "string") { yield obj; return; }
  if (Array.isArray(obj)) { for (const v of obj) yield* allStrings(v); return; }
  if (typeof obj === "object") { for (const v of Object.values(obj)) yield* allStrings(v); }
}

export function auditEdition(ed, opts = {}) {
  const blocks = [], warnings = [];
  const dims = new Set();
  const B = (dimensao, msg, correcao) => { blocks.push({ dimensao, msg, correcao }); dims.add(dimensao); };
  const W = (dimensao, msg, correcao) => { warnings.push({ dimensao, msg, correcao }); dims.add(dimensao); };

  // --- 1. Conteudo (estrutura, campos/blocos, vigencia, links, disclaimer, emoji, CMI, Ponto) ---
  const v = validateEdition(JSON.parse(JSON.stringify(ed)), { now: opts.now, lenient: false });
  for (const e of v.errors) B(classify(e), e, "Corrija o campo indicado no JSON antes de publicar.");
  for (const w of v.warnings) W(classify(w), w, "Reveja o campo; nao bloqueia, mas pode enfraquecer a edicao.");

  // --- render do e-mail para auditar o HTML ---
  let html = "";
  try { html = opts.email || renderEmail(ed); }
  catch (err) { B("integridade JSON", "falha ao renderizar o e-mail: " + err.message, "Verifique se os campos obrigatorios existem."); }

  if (html) {
    // --- 2. E-mail-safe ---
    if (/<script/i.test(html)) B("e-mail-safe", "tag <script> no e-mail", "Remova todo JavaScript do e-mail.");
    if (/:root/.test(html)) B("e-mail-safe", ":root/custom properties no e-mail", "Use hex inline; e-mail nao suporta :root.");
    if (/@import|<link[^>]+stylesheet/i.test(html)) B("e-mail-safe", "CSS externo (@import/<link>)", "Inline todo o CSS.");
    if (/fonts\.(googleapis|gstatic)/i.test(html)) B("e-mail-safe", "Google Fonts no e-mail", "Use apenas fontes web-safe (Georgia/Arial/Courier).");
    if (/<img\b/i.test(html)) B("ausencia de stock photo", "tag <img> no e-mail", "O Daily nao usa imagem rasterizada (nem stock nem aviao). Remova.");
    if (!/max-width:\s*600px|width="600"/i.test(html)) W("e-mail-safe", "largura 600px nao detectada", "Fixe o container em 600px.");

    // --- 3. Mobile ---
    if (!/name="viewport"/i.test(html)) W("mobile", "meta viewport ausente", "Inclua meta viewport para escala no mobile.");
    if (!/max-width:\s*600px/i.test(html)) W("mobile", "sem max-width no container (pode nao encolher)", "Use max-width:600px para uma coluna fluida.");

    // --- 4. Tokens de marca ---
    const hexes = [...new Set((html.match(/#[0-9A-Fa-f]{6}/g) || []).map((h) => h.toUpperCase()))];
    const foreign = hexes.filter((h) => !APPROVED_HEX.has(h));
    if (foreign.length) W("tokens de marca", `cores fora da paleta: ${foreign.join(", ")}`, "Substitua por um token oficial (ver renderer/tokens.mjs).");
    if (/The Loyalty\b/.test(html)) W("tokens de marca", "'The Loyalty' no HTML (marca antiga)", "Use 'The Loyal'.");

    // --- 5. Tipografia ---
    const fams = [...new Set((html.match(/font-family:[^;"']+/gi) || []).map((f) => f.toLowerCase()))].join(" | ");
    for (const wf of WEBFONTS) if (fams.includes(wf)) B("tipografia", `webfont '${wf}' no e-mail`, "No e-mail use so fontes web-safe; webfonts caem em fallback silencioso.");
    const declaredFonts = (fams.match(/[a-z][a-z ]+/g) || []).map((s) => s.trim());
    const unknown = declaredFonts.filter((f) => f && !SAFE_FONTS.includes(f) && !f.startsWith("font-family"));
    // (nao bloqueia por nomes genericos; so informa se sobrar algo suspeito)
  }

  // --- 6. Contraste ---
  const contrast = checkContrast();
  for (const c of contrast) {
    if (!c.pass) W("contraste", `${c.role}: ${c.ratio}:1 (< ${c.min}:1)`, `Escureca o texto (ex.: usar #555555 no lugar de tons claros) para atingir ${c.min}:1.`);
  }

  // --- 7. Fontes (metodologia) ---
  if (!ed.fontes_metodologia || String(ed.fontes_metodologia).trim().length < 15) {
    W("fontes", "secao 'Fontes e metodologia' ausente ou muito curta", "Declare as fontes oficiais e como o calculo foi feito.");
  }

  // --- 8. Calculo ---
  const calc = checkCalculo(ed);
  if (calc.ok === false) B("calculo", calc.msg, "Refaca a conta: CPM = custo / (milhas / 1000).");
  else if (calc.ok === null) W("calculo", calc.msg, "Padronize a conta com linhas 'custo', 'milhas' e total em R$/milheiro para verificacao automatica.");

  // --- 9. Urgencia artificial ---
  for (const s of allStrings(ed)) {
    for (const re of URGENCY) {
      if (re.test(s)) { W("urgencia artificial", `expressao de urgencia: "${s.slice(0, 60)}"`, "Troque hype por prazo factual (ex.: 'vence quinta, 23h59')."); break; }
    }
  }

  const approved = blocks.length === 0;
  return { approved, blocks, warnings, dimensions: [...dims], contrast, calculo: calc };
}
