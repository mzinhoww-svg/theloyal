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
// (nunca sinalizado so por cor).
export const VERDICT = {
  "vale-agir": { label: "VALE AGIR", family: "green" },
  "vale-olhar": { label: "VALE OLHAR", family: "green" },
  depende: { label: "DEPENDE", family: "yellow" },
  esperaria: { label: "ESPERARIA", family: "yellow" },
  "nao-vale": { label: "NAO VALE", family: "red" },
  evitaria: { label: "EVITARIA", family: "red" },
  "nao-confirmado": { label: "NAO CONFIRMADO", family: "gray" },
};

export const VERDICT_FAMILY = {
  green: { bg: "#D9F4E9", text: "#007A57" },
  yellow: { bg: "#FCF0CE", text: "#7A5B00" },
  red: { bg: "#F9E2E2", text: "#B53A3A" },
  gray: { bg: "#EDE8DD", text: "#555555" },
};

export function verdict(key) {
  const k = String(key || "").toLowerCase();
  return VERDICT[k] || { label: (String(key || "").toUpperCase() || "SEM VEREDITO"), family: "gray" };
}
