// Pipeline editorial do The Loyal — utilidades compartilhadas.
// Os renderizadores (email/plain) sao gerados por script e usam os hex
// documentados como tokens: mesma excecao permitida ao mascote/graficos.
import { readFileSync, readdirSync } from "node:fs";
import { basename } from "node:path";
import { CANONICAL_VERDICTS } from "./taxonomy.mjs";

export const TOKENS = {
  ink: "#111111", paper: "#FAF7F0", paperDark: "#F1ECE1", surface: "#FFFFFF",
  line: "#E5E0D5", g700: "#3D3A34", g500: "#555555", g400: "#8A8578",
  green600: "#00A878", green500: "#00C48C", green700: "#007A57",
  blue600: "#315CFF", blue700: "#2547CC", yellow500: "#F2C94C",
  red600: "#D64545", green100: "#D9F4E9", blue100: "#E4EAFF",
};

// Mapa TL Score -> veredito. Derivado da fonte única (scripts/taxonomy.mjs,
// Apêndice C do RFC-001). A paleta de e-mail é atribuída por família semântica —
// email-safe, mesma cor final de antes. Alterar taxonomia: mexer em taxonomy.mjs.
const VERDICT_FAMILY_COLORS = {
  green: { bg: TOKENS.green100, fg: TOKENS.green700 },
  blue: { bg: TOKENS.blue100, fg: TOKENS.blue700 },
  gray: { bg: TOKENS.paperDark, fg: TOKENS.g500 },
  yellow: { bg: TOKENS.yellow500, fg: TOKENS.ink },
  red: { bg: TOKENS.red600, fg: TOKENS.surface },
};
export const VERDICTS = Object.fromEntries(
  CANONICAL_VERDICTS.map((v) => [v.key, {
    label: v.label, min: v.min, max: v.max, ...VERDICT_FAMILY_COLORS[v.family],
  }]),
);

// Pílulas de confiança do Radar de janelas. Fill + texto escuro (nunca verde-500
// nem amarelo como texto). Espelha o padrão dos badges de veredito.
export const CONFIDENCE = {
  alta: { label: "CONFIANÇA ALTA", bg: TOKENS.green100, fg: TOKENS.green700 },
  media: { label: "CONFIANÇA MÉDIA", bg: TOKENS.blue100, fg: TOKENS.blue700 },
  baixa: { label: "CONFIANÇA BAIXA", bg: TOKENS.paperDark, fg: TOKENS.g500 },
};

export const RADAR_NOTE_DEFAULT =
  "Projeção por recorrência do histórico do ledger. Não é veredito nem garantia — confira sempre as regras oficiais.";

// Linha honesta de monitoramento (A2, POLITICA-CANONICA-RADAR §4/§5.4). Séries
// reais sem janela confiável: o Radar diz a verdade menor em vez de sumir.
// Nunca número, nunca promessa. Fonte única usada por Daily e Weekly.
export function monitoringLine(count) {
  const n = Number(count) || 0;
  if (!n) return "";
  return n === 1
    ? "Monitorando 1 série sem janela confiável ainda."
    : `Monitorando ${n} séries sem janela confiável ainda.`;
}

export function verdictForScore(score) {
  for (const [key, v] of Object.entries(VERDICTS)) {
    if (v.min == null) continue;
    if (score >= v.min && score <= v.max) return key;
  }
  return null;
}

// Pesos do TL Score (Operating Manual 5.2) — soma 100.
export const TL_WEIGHTS = {
  valor: 25, regra: 15, vigencia: 15, friccao: 10,
  aplicabilidade: 10, liquidez: 10, estoque: 10, fontes: 5,
};

export const DISCLAIMER =
  "Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de comprar, transferir ou resgatar.";

// Emoji e pictográficos proibidos no corpo editorial. Exclui setas (→),
// travessões e reticências, que são tipografia válida.
export const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}️]/u;

// Termos de urgência artificial banidos (regra inviolável 4).
// Fronteiras Unicode (\p{L}\p{N}) em vez de \b ASCII: sem elas, um termo que
// começa com acento ("última chance") não é pego, pois \b não vê boundary antes
// de "ú". Prazos factuais ("vence quinta") continuam livres.
export const URGENCY_RE = /(?<![\p{L}\p{N}])(imperd[ií]vel|corra|corre|garanta j[áa]|[úu]ltima chance|milhas gr[áa]tis)(?![\p{L}\p{N}])/iu;

// Dado interno de empresa / CMI / métrica proprietária (regra inviolável 1).
// Termos que só existiriam com acesso interno a um programa. Fonte ÚNICA — antes
// o Pro carregava uma cópia mais fraca (só CMI/dado interno/nossa base); este
// regex é superset das duas versões, para Daily/Weekly/Pro aplicarem o mesmo rigor.
export const INTERNAL_RE =
  /\b(CMI|dados?\s+internos?|m[ée]trica\s+interna|base\s+interna|churn\s+interno|receita\s+interna|margem\s+de\s+contribui[çc][ãa]o\s+interna|custo\s+interno\s+do\s+programa|nossos\s+clientes|nossa\s+base)\b/iu;

// Todo link editorial deve ser https absoluto (nada de http:// ou relativo).
export function isValidLink(url) {
  return typeof url === "string" && /^https:\/\/[^\s]+$/.test(url);
}

// Vigência (ISO) já vencida em relação a uma data de referência?
export function isExpired(vigenciaIso, refIso) {
  const v = Date.parse(vigenciaIso);
  const ref = Date.parse(refIso);
  if (Number.isNaN(v) || Number.isNaN(ref)) return false;
  return v < ref;
}

export function loadEdition(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function listEditionFiles(dir = "content/editions") {
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
}

// Registro canônico de entidades (content/entities) — fonte dos tiers de fonte da
// régua de publicação. Best-effort: ausência/parsing inválido ⇒ [] (sem teto).
export function loadEntities(path = "content/entities/index.json") {
  try {
    const reg = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(reg.entities) ? reg.entities : [];
  } catch {
    return [];
  }
}

// Config de limiares adaptativos da régua (content/ruler-config.json). Best-effort:
// ausência ⇒ {} (o motor de disposição usa os defaults embutidos).
export function loadRulerConfig(path = "content/ruler-config.json") {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

export function pad(n) {
  return String(n).padStart(4, "0");
}

// Coleta recursiva de todas as strings de um objeto (para varrer emoji/urgência).
export function collectStrings(node, out = []) {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => collectStrings(n, out));
  else if (node && typeof node === "object") Object.values(node).forEach((n) => collectStrings(n, out));
  return out;
}

export function editionSlug(edition) {
  return pad(edition.number);
}

// Fonte ÚNICA das regras invioláveis de texto (backlog P1.4). Varre todas as
// strings do nó e devolve as violações — Daily, Weekly e Pro chamam esta função
// em vez de reimplementar as varreduras (fim do INTERNAL_RE mais fraco no Pro).
// Retorna [] quando limpo. Pura: sem I/O, mesma entrada → mesma saída.
export function assertEditorialRules(node, opts = {}) {
  const strings = collectStrings(node);
  const violations = [];
  const hit = (rule, re) => {
    const samples = strings.filter((s) => re.test(s));
    if (samples.length) violations.push({ rule, samples: samples.slice(0, 2) });
  };
  hit("emoji", EMOJI_RE);
  hit("urgencia", URGENCY_RE);
  hit("interno", INTERNAL_RE);
  if (opts.requireDisclaimer) {
    const ok = typeof node?.disclaimer === "string" && node.disclaimer.includes(DISCLAIMER);
    if (!ok) violations.push({ rule: "disclaimer", samples: [] });
  }
  return violations;
}

// Mensagem legível por violação — para os relatórios de gate.
export function editorialRuleMessage(v) {
  const preview = v.samples.map((s) => JSON.stringify(String(s).slice(0, 50))).join(", ");
  switch (v.rule) {
    case "emoji": return `Emoji proibido no corpo editorial: ${preview}`;
    case "urgencia": return `Urgência artificial proibida: ${preview}`;
    case "interno": return `Dado interno/CMI proibido no corpo editorial: ${preview}`;
    case "disclaimer": return "Disclaimer ausente ou alterado — deve conter a frase oficial completa";
    default: return `Violação de regra inviolável (${v.rule})`;
  }
}

export { basename };
