// Contraste WCAG 2.1. Usado pela auditoria de QA.
function toRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function lin(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function luminance(hex) {
  const [r, g, b] = toRgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function ratio(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
export function round2(n) { return Math.round(n * 100) / 100; }

// Pares foreground/background que o e-mail usa, com o minimo exigido (AA).
export const EMAIL_PAIRS = [
  { fg: "#3D3A34", bg: "#FAF7F0", role: "corpo (gray700 sobre Paper)", min: 4.5 },
  { fg: "#555555", bg: "#FAF7F0", role: "secundario (gray500 sobre Paper)", min: 4.5 },
  { fg: "#8A8578", bg: "#FAF7F0", role: "labels/meta pequenos (gray400 sobre Paper)", min: 4.5 },
  { fg: "#007A57", bg: "#FAF7F0", role: "eyebrow verde sobre Paper", min: 4.5 },
  { fg: "#B53A3A", bg: "#FAF7F0", role: "eyebrow vermelho sobre Paper", min: 4.5 },
  { fg: "#7A5B00", bg: "#FCF0CE", role: "texto Fecha logo (amber sobre yellow-100)", min: 4.5 },
  { fg: "#007A57", bg: "#D9F4E9", role: "chip VALE (green700 sobre green-100)", min: 4.5 },
  { fg: "#B53A3A", bg: "#F9E2E2", role: "chip NAO VALE (red sobre red-100)", min: 4.5 },
  { fg: "#FAF7F0", bg: "#111111", role: "footer/conta texto (Paper sobre Ink)", min: 4.5 },
  { fg: "#B7B2A6", bg: "#111111", role: "footer descricao sobre Ink", min: 4.5 },
  { fg: "#8A8578", bg: "#111111", role: "footer assinatura sobre Ink", min: 4.5 },
  { fg: "#00C48C", bg: "#111111", role: "conta total (green500 sobre Ink)", min: 4.5 },
];

export function checkContrast(pairs = EMAIL_PAIRS) {
  return pairs.map((p) => {
    const r = round2(ratio(p.fg, p.bg));
    return { ...p, ratio: r, pass: r >= p.min };
  });
}
