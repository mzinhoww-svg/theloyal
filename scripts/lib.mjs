// Pipeline editorial do The Loyal — utilidades compartilhadas.
// Os renderizadores (email/plain) sao gerados por script e usam os hex
// documentados como tokens: mesma excecao permitida ao mascote/graficos.
import { readFileSync, readdirSync } from "node:fs";
import { basename } from "node:path";

export const TOKENS = {
  ink: "#111111", paper: "#FAF7F0", paperDark: "#F1ECE1", surface: "#FFFFFF",
  line: "#E5E0D5", g700: "#3D3A34", g500: "#555555", g400: "#8A8578",
  green600: "#00A878", green500: "#00C48C", green700: "#007A57",
  blue600: "#315CFF", blue700: "#2547CC", yellow500: "#F2C94C",
  red600: "#D64545", green100: "#D9F4E9", blue100: "#E4EAFF",
};

// Mapa TL Score -> veredito (DESIGN.md 1.3 / Operating Manual 5.3).
export const VERDICTS = {
  "vale-agir": { label: "VALE AGIR", min: 85, max: 100, bg: TOKENS.green100, fg: TOKENS.green700 },
  "vale-olhar": { label: "VALE OLHAR", min: 70, max: 84, bg: TOKENS.blue100, fg: TOKENS.blue700 },
  "casos-especificos": { label: "SÓ PARA CASOS ESPECÍFICOS", min: 55, max: 69, bg: TOKENS.paperDark, fg: TOKENS.g500 },
  esperaria: { label: "ESPERARIA", min: 40, max: 54, bg: TOKENS.yellow500, fg: TOKENS.ink },
  evitaria: { label: "EVITARIA", min: 0, max: 39, bg: TOKENS.red600, fg: TOKENS.surface },
  "nao-confirmado": { label: "NÃO CONFIRMADO", min: null, max: null, bg: TOKENS.paperDark, fg: TOKENS.g500 },
};

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
export const URGENCY_RE = /\b(imperd[ií]vel|corra|corre|garanta j[áa]|[úu]ltima chance|milhas gr[áa]tis)\b/iu;

// Dado interno de empresa / CMI / métrica proprietária (regra inviolável 1).
// Termos que só existiriam com acesso interno a um programa.
export const INTERNAL_RE =
  /\b(CMI|dados?\s+internos?|m[ée]trica\s+interna|base\s+interna|churn\s+interno|receita\s+interna|margem\s+de\s+contribui[çc][ãa]o\s+interna|custo\s+interno\s+do\s+programa)\b/iu;

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

export { basename };
