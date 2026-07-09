// Validador da edicao do The Loyal Daily.
// Retorna { errors, warnings, stats }. errors bloqueiam o render (salvo lenient p/ limites).
import { VERDICT } from "./tokens.mjs";

const MAX_DEAL = 3;
const MAX_SECONDARY = 5;
const SECONDARY = ["program_watch", "bank_cards_watch", "retail_coalition", "sinais_rapidos"];
const REQUIRED_FIELDS = ["sinal_do_dia", "fecha_logo", "o_que_evitaria", "disclaimer"];
const REQUIRED_BLOCKS = ["deal_desk", "conta_feita", "footer"];
// Ponto (mascote) proibido em blocos analiticos.
const PONTO_FORBIDDEN = ["deal_desk", "conta_feita", "sua_leitura", "program_watch", "bank_cards_watch", "retail_coalition", "sinais_rapidos"];

// Emoji (inclui aviao U+2708). Nao inclui setas (U+2190..21FF) usadas como "->".
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;
// Marcadores de conteudo interno / CMI que nao podem vazar.
// (evita 'dado interno' isolado: a metodologia legitimamente promete "sem dado interno")
const INTERNAL = /\b(cmi|uso interno|confidencial|nao publicar|rascunho interno|todo:|fixme)\b/i;
const URLISH = /^(https?:\/\/|\/|\{\{[\w.]+\}\})/;

function* strings(obj, path = "") {
  if (obj == null) return;
  if (typeof obj === "string") { yield [path, obj]; return; }
  if (Array.isArray(obj)) { for (let i = 0; i < obj.length; i++) yield* strings(obj[i], `${path}[${i}]`); return; }
  if (typeof obj === "object") { for (const k of Object.keys(obj)) yield* strings(obj[k], path ? `${path}.${k}` : k); }
}

function nonEmpty(v) {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

export function validateEdition(ed, opts = {}) {
  const lenient = !!opts.lenient;
  const now = opts.now ? new Date(opts.now) : null; // data de referencia p/ vigencia
  const errors = [];
  const warnings = [];

  if (typeof ed !== "object" || ed == null || Array.isArray(ed)) {
    return { errors: ["JSON raiz precisa ser um objeto da edicao"], warnings: [], stats: {} };
  }

  // campos obrigatorios
  for (const f of REQUIRED_FIELDS) if (!nonEmpty(ed[f])) errors.push(`campo obrigatorio ausente ou vazio: '${f}'`);
  // blocos obrigatorios
  for (const b of REQUIRED_BLOCKS) if (!nonEmpty(ed[b])) errors.push(`bloco obrigatorio ausente ou vazio: '${b}'`);

  // deal desk: 1..3
  const dd = Array.isArray(ed.deal_desk) ? ed.deal_desk : [];
  if (dd.length > MAX_DEAL) {
    (lenient ? warnings : errors).push(`deal_desk tem ${dd.length} itens (max ${MAX_DEAL})`);
    if (lenient) ed.deal_desk = dd.slice(0, MAX_DEAL);
  }
  (lenient ? ed.deal_desk : dd).forEach((d, i) => {
    if (!nonEmpty(d?.titulo)) errors.push(`deal_desk[${i}] sem 'titulo'`);
    if (!nonEmpty(d?.texto)) errors.push(`deal_desk[${i}] sem 'texto'`);
    const vk = String(d?.veredito || "").toLowerCase();
    if (!vk) errors.push(`deal_desk[${i}] sem 'veredito'`);
    else if (!VERDICT[vk]) warnings.push(`deal_desk[${i}] veredito desconhecido '${vk}' (chip cinza)`);
    // vigencia: cada deal deve indicar validade
    if (!nonEmpty(d?.vigencia) && !nonEmpty(d?.vigencia_iso)) {
      warnings.push(`deal_desk[${i}] sem vigencia declarada (oferta sem validade nao vira recomendacao)`);
    }
    if (nonEmpty(d?.vigencia_iso)) {
      const dt = new Date(d.vigencia_iso);
      if (isNaN(dt)) warnings.push(`deal_desk[${i}] vigencia_iso invalida: '${d.vigencia_iso}'`);
      else if (now && dt < now) errors.push(`deal_desk[${i}] vigencia expirada (${d.vigencia_iso} < referencia)`);
    }
  });

  // secoes secundarias: max 5
  for (const k of SECONDARY) {
    const arr = Array.isArray(ed[k]) ? ed[k] : [];
    if (arr.length > MAX_SECONDARY) {
      (lenient ? warnings : errors).push(`${k} tem ${arr.length} itens (max ${MAX_SECONDARY})`);
      if (lenient) ed[k] = arr.slice(0, MAX_SECONDARY);
    }
  }

  // conta feita: formula em mono (linhas ou total)
  const cf = ed.conta_feita || {};
  if (!nonEmpty(cf.linhas) && !nonEmpty(cf.total)) {
    errors.push("conta_feita precisa de 'linhas' e/ou 'total' (formula em mono)");
  }

  // disclaimer minimo
  if (nonEmpty(ed.disclaimer) && String(ed.disclaimer).trim().length < 30) {
    warnings.push("disclaimer muito curto; confirme se cobre 'confira no site oficial' e 'nao e recomendacao individual'");
  }

  // footer + links
  const links = ed.footer?.links || {};
  if (!nonEmpty(links.unsubscribe_url)) errors.push("footer.links.unsubscribe_url ausente (obrigatorio para e-mail)");
  for (const [k, v] of Object.entries(links)) {
    if (nonEmpty(v) && !URLISH.test(String(v).trim())) warnings.push(`footer.links.${k} nao parece URL nem placeholder: '${v}'`);
  }

  // Ponto (mascote) fora de blocos analiticos
  for (const k of PONTO_FORBIDDEN) {
    for (const [, s] of strings(ed[k])) {
      if (/\bPonto\b/.test(s)) { errors.push(`mascote 'Ponto' aparece em '${k}' (proibido em blocos analiticos)`); break; }
    }
  }

  // emoji + CMI/interno em qualquer campo
  let emojiHit = false, internalHit = false;
  for (const [path, s] of strings(ed)) {
    if (!emojiHit && EMOJI.test(s)) { errors.push(`emoji encontrado em '${path}' (proibido)`); emojiHit = true; }
    if (!internalHit && INTERNAL.test(s)) { errors.push(`possivel dado interno/CMI em '${path}': '${s.slice(0, 40)}...'`); internalHit = true; }
  }

  const stats = {
    deals: (ed.deal_desk || []).length,
    program_watch: (ed.program_watch || []).length,
    bank_cards_watch: (ed.bank_cards_watch || []).length,
    retail_coalition: (ed.retail_coalition || []).length,
    sinais_rapidos: (ed.sinais_rapidos || []).length,
    tem_conta: nonEmpty(cf.linhas) || nonEmpty(cf.total),
    tem_disclaimer: nonEmpty(ed.disclaimer),
  };

  return { errors, warnings, stats };
}
