// Constantes de marca para os cards sociais gerados via next/og. Asset visual —
// como graphics.tsx e opengraph-image.tsx, usa os hex documentados da marca
// diretamente (exceção prevista no CLAUDE.md), não classes do tema, porque o
// runtime do satori/next-og não resolve Tailwind.

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

// Espelha VERDICT_STYLE de components/ui.tsx, mas com hex (o card não tem
// Tailwind). Mantém a regra 8: green de texto é green-700; amarelo é fill com
// texto Ink; vermelho é fill com texto surface; não confirmado é borda tracejada.
export const VERDICT: Record<
  Verdict,
  { label: string; bg: string; fg: string; dashed?: boolean }
> = {
  "vale-agir": { label: "VALE AGIR", bg: HEX.green100, fg: HEX.green700 },
  "vale-olhar": { label: "VALE OLHAR", bg: HEX.blue100, fg: HEX.blue700 },
  "casos-especificos": {
    label: "SÓ PARA CASOS ESPECÍFICOS",
    bg: HEX.paperDark,
    fg: HEX.gray500,
  },
  esperaria: { label: "ESPERARIA", bg: HEX.yellow500, fg: HEX.ink },
  evitaria: { label: "EVITARIA", bg: HEX.red600, fg: HEX.surfaceOnRed },
  "nao-confirmado": {
    label: "NÃO CONFIRMADO",
    bg: HEX.paper,
    fg: HEX.gray500,
    dashed: true,
  },
};

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
