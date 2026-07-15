// Tokens oficiais do The Loyal. Fonte de verdade unica (espelha tailwind.config.ts).
// Usados pelo renderer de e-mail (hex inline) e pelo QA. O web archive React usa os
// mesmos tokens via Tailwind.
export const TOKENS = {
  ink: "#111111",
  paper: "#FAF7F0",
  paperDark: "#F1ECE1",
  surface: "#FFFFFF",
  line: "#E5E0D5",
  gray700: "#3D3A34",
  gray500: "#555555",
  gray400: "#8A8578",
  green700: "#007A57",
  green600: "#00A878",
  green500: "#00C48C",
  green100: "#D9F4E9",
  yellow500: "#F2C94C",
  yellow100: "#FCF0CE",
  yellowText: "#7A5B00",
  red600: "#B53A3A",
  red100: "#F9E2E2",
  emailBg: "#EDE8DD",
};

// Taxonomia de veredito: rotulo + familia de cor. O rotulo SEMPRE aparece no chip
// (nunca sinalizado so por cor). Derivada da fonte unica scripts/taxonomy.mjs
// (Apendice C do RFC-001). Divergencia com o Pipeline A e barrada por
// tests/taxonomy.test.mjs. `depende`/`nao-vale` seguem como aliases DEPRECADOS
// (janela de compatibilidade, RFC-001 §12.2) para nao quebrar conteudo antigo.
import { CANONICAL_VERDICTS, DEPRECATED_VERDICT_ALIASES, resolveVerdictKey } from "../scripts/taxonomy.mjs";

export const VERDICT = Object.fromEntries([
  ...CANONICAL_VERDICTS.map((v) => [v.key, { label: v.label.toUpperCase(), family: v.family }]),
  // Aliases legados (deprecados): herdam rotulo/familia do alvo canonico.
  ...Object.entries(DEPRECATED_VERDICT_ALIASES).map(([legacy, target]) => {
    const t = CANONICAL_VERDICTS.find((v) => v.key === target);
    return [legacy, { label: t.label.toUpperCase(), family: t.family, deprecated: true }];
  }),
]);

export const VERDICT_FAMILY = {
  green: { bg: "#D9F4E9", text: "#007A57" },
  blue: { bg: "#E4EAFF", text: "#2547CC" },
  yellow: { bg: "#FCF0CE", text: "#7A5B00" },
  red: { bg: "#F9E2E2", text: "#B53A3A" },
  gray: { bg: "#EDE8DD", text: "#555555" },
};

export function verdict(key) {
  const k = resolveVerdictKey(key);
  return VERDICT[k] || VERDICT[String(key || "").toLowerCase()] ||
    { label: (String(key || "").toUpperCase() || "SEM VEREDITO"), family: "gray" };
}

// Paleta aprovada para auditoria de tokens (tokens oficiais + tons de e-mail documentados).
// Qualquer hex fora desta lista no HTML renderizado e sinalizado pelo QA.
export const APPROVED_HEX = new Set([
  "#111111", "#FAF7F0", "#F1ECE1", "#FFFFFF", "#E5E0D5",
  "#3D3A34", "#555555", "#8A8578", "#B7B2A6",
  "#007A57", "#00A878", "#00C48C", "#D9F4E9",
  "#E4EAFF", "#2547CC",
  "#F2C94C", "#FCF0CE", "#7A5B00",
  "#B53A3A", "#F9E2E2", "#EDE8DD",
]);

// Fontes seguras para e-mail (nada de webfont/Google Fonts).
export const SAFE_FONTS = ["georgia", "times new roman", "serif", "arial", "helvetica", "sans-serif", "courier new", "courier", "monospace"];
export const WEBFONTS = ["fraunces", "inter", "jetbrains", "roboto", "open sans", "lato", "montserrat"];

// Lexico de urgencia artificial (nao inclui prazos factuais como "vence quinta").
export const URGENCY = [
  /\bimperdiv/i, /\bultim[ao]s?\s+(chance|horas|vagas|unidades)/i, /\bultima chance\b/i,
  /\bso hoje\b/i, /\bagora ou nunca\b/i, /\bnao perc/i, /\bnao fique de fora\b/i,
  /\bgaranta ja\b/i, /\burgente\b/i, /\bacaba (hoje|agora)\b/i, /\bcorre que\b/i, /!{2,}/,
];
