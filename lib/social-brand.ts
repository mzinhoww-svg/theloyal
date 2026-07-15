// Constantes de marca para os cards sociais gerados via next/og. Asset visual —
// como graphics.tsx e opengraph-image.tsx, usa os hex documentados da marca
// diretamente (exceção prevista no CLAUDE.md), não classes do tema, porque o
// runtime do satori/next-og não resolve Tailwind.

import { CANONICAL_VERDICTS } from "../scripts/taxonomy.mjs";

export const HEX = {
  paper: "#FAF7F0",
  paperDark: "#F1ECE1",
  surface: "#FFFFFF",
  ink: "#111111",
  line: "#E5E0D5",
  gray700: "#3D3A34",
  gray500: "#555555",
  gray400: "#8A8578",
  green100: "#D9F4E9",
  green500: "#00C48C",
  green600: "#00A878",
  green700: "#007A57",
  blue100: "#E4EAFF",
  blue600: "#315CFF",
  blue700: "#2547CC",
  yellow500: "#F2C94C",
  red600: "#D64545",
  surfaceOnRed: "#FFFFFF",
} as const;

export type Verdict =
  | "vale-agir"
  | "vale-olhar"
  | "casos-especificos"
  | "esperaria"
  | "evitaria"
  | "nao-confirmado";

// Paleta social do veredito (hex; o card não tem Tailwind). Mantém a regra 8:
// green de texto é green-700; amarelo é fill com texto Ink; vermelho é fill com
// texto surface; não confirmado é borda tracejada. Só ESTILO — os RÓTULOS vêm da
// taxonomia canônica (scripts/taxonomy.mjs), não são mais copiados aqui
// (DEBT-004): assim o rótulo do social nunca diverge do Daily/Weekly/Pro.
const STYLE: Record<Verdict, { bg: string; fg: string; dashed?: boolean }> = {
  "vale-agir": { bg: HEX.green100, fg: HEX.green700 },
  "vale-olhar": { bg: HEX.blue100, fg: HEX.blue700 },
  "casos-especificos": { bg: HEX.paperDark, fg: HEX.gray500 },
  esperaria: { bg: HEX.yellow500, fg: HEX.ink },
  evitaria: { bg: HEX.red600, fg: HEX.surfaceOnRed },
  "nao-confirmado": { bg: HEX.paper, fg: HEX.gray500, dashed: true },
};

export const VERDICT: Record<
  Verdict,
  { label: string; bg: string; fg: string; dashed?: boolean }
> = Object.fromEntries(
  CANONICAL_VERDICTS.map((v: { key: string; label: string }) => [
    v.key,
    { label: v.label, ...STYLE[v.key as Verdict] },
  ]),
) as Record<Verdict, { label: string; bg: string; fg: string; dashed?: boolean }>;

export function isVerdict(v: string | null | undefined): v is Verdict {
  return !!v && Object.prototype.hasOwnProperty.call(VERDICT, v);
}

// Presets de dimensão por destino social.
export const SIZES = {
  square: { width: 1080, height: 1080 }, // feed X e LinkedIn
  wide: { width: 1200, height: 675 }, // X 16:9
  portrait: { width: 1080, height: 1350 }, // carrossel e conta feita
} as const;

export type SizeKey = keyof typeof SIZES;

export function pickSize(v: string | null | undefined, fallback: SizeKey): {
  width: number;
  height: number;
} {
  return v && v in SIZES ? SIZES[v as SizeKey] : SIZES[fallback];
}
