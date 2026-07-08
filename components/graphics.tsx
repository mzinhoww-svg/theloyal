/* TL Graphics: sistema de imagem proprio do The Loyal (TL-GRAPHICS.md).
   Regra-mae: a imagem e dado. SVG inline, tokens oficiais, zero request externo.
   Excecao permitida ao "sem hex em componente": geometria SVG dos graficos usa as constantes documentadas. */

const T = {
  ink: "#111111",
  paper: "#FAF7F0",
  paperDark: "#F1ECE1",
  surface: "#FFFFFF",
  line: "#E5E0D5",
  g500: "#555555",
  g400: "#8A8578",
  g700: "#3D3A34",
  green: "#00A878",
  greenBright: "#00C48C",
  blue: "#315CFF",
  yellow: "#F2C94C",
  caramel: "#D9A15B",
  caramelDark: "#B8813F",
  cream: "#F3E3C3",
};
const MONO = "var(--font-mono), Consolas, monospace";
const DISPLAY = "var(--font-display), Georgia, serif";
const SANS = "var(--font-sans), Arial, sans-serif";

/* ============ Familia 1 — Data-art: a mesma promocao, tres contas ============ */
export function CompareBanner() {
  const bars: { label: string; value: string; w: number; best?: boolean }[] = [
    { label: "compra direta", value: "R$ 34,00", w: 340 },
    { label: "com bônus 110%", value: "R$ 24,20", w: 242 },
    { label: "bônus + clube", value: "R$ 16,60", w: 166, best: true },
  ];
  return (
    <svg
      viewBox="0 0 720 300"
      role="img"
      aria-label="Gráfico de barras: a mesma promoção gera três custos por milheiro. Compra direta R$ 34, com bônus R$ 24,20, bônus mais clube R$ 16,60."
      className="h-auto w-full rounded border border-line bg-surface"
    >
      <text x="36" y="52" fontFamily={SANS} fontSize="13" fontWeight="600" letterSpacing="1.2" fill={T.g500}>
        A MESMA PROMOÇÃO, TRÊS CONTAS
      </text>
      <text x="684" y="52" textAnchor="end" fontFamily={MONO} fontSize="12" fill={T.g400}>
        CPM /milheiro
      </text>
      {bars.map((b, i) => {
        const y = 84 + i * 58;
        return (
          <g key={b.label}>
            <rect x="36" y={y} width={b.w} height="30" rx="4" fill={b.best ? T.green : T.paperDark} stroke={b.best ? T.green : T.line} />
            <text x="46" y={y + 20} fontFamily={SANS} fontSize="13" fontWeight="500" fill={b.best ? T.paper : T.g500}>
              {b.label}
            </text>
            <text x={36 + b.w + 12} y={y + 20} fontFamily={MONO} fontSize="15" fontWeight={b.best ? 600 : 400} fill={b.best ? T.green : T.ink}>
              {b.value}
            </text>
          </g>
        );
      })}
      <line x1="36" y1="262" x2="684" y2="262" stroke={T.line} />
      <text x="36" y="284" fontFamily={DISPLAY} fontSize="16" fontWeight="600" fill={T.ink}>
        O banner mostra o bônus. A conta mostra o milheiro.
      </text>
    </svg>
  );
}

/* ============ Familia 2 — Cena do Ponto: lendo o regulamento na mesa ============ */
export function PontoReadingScene({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 380"
      role="img"
      aria-label="Ponto, o mascote, atrás de uma mesa, examinando um regulamento com uma lupa"
      className={className}
    >
      {/* torso atras da mesa e braco ate a pata */}
      <path d="M 268 240 Q 246 276 244 304 L 420 304 Q 418 272 398 238 Q 330 274 268 240 Z" fill={T.caramel} stroke={T.ink} strokeWidth="3" strokeLinejoin="round" />
      <path d="M 300 258 Q 276 268 272 288 L 292 296 Q 300 276 312 268 Z" fill={T.caramel} stroke={T.ink} strokeWidth="3" strokeLinejoin="round" />

      {/* cabeca inclinada para o documento */}
      <g transform="rotate(-8 330 170)">
        <path d="M 262 92 Q 234 78 226 116 Q 220 152 238 178 Q 252 194 270 184 Q 258 140 272 104 Z" fill={T.caramelDark} stroke={T.ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M 398 92 Q 426 78 434 116 Q 440 152 422 178 Q 408 194 390 184 Q 402 140 388 104 Z" fill={T.caramelDark} stroke={T.ink} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="330" cy="146" r="76" fill={T.caramel} stroke={T.ink} strokeWidth="3" />
        <path d="M 278 108 Q 302 96 320 110 Q 308 128 286 132 Q 276 122 278 108 Z" fill={T.caramelDark} />
        <ellipse cx="330" cy="182" rx="44" ry="32" fill={T.cream} />
        <path d="M 318 168 Q 330 162 342 168 Q 342 180 330 186 Q 318 180 318 168 Z" fill={T.ink} />
        <path d="M 330 186 L 330 196 Q 322 204 312 200" fill="none" stroke={T.ink} strokeWidth="3" strokeLinecap="round" />
        {/* olho esquerdo apertado, direito na lupa */}
        <path d="M 294 138 L 312 138" stroke={T.ink} strokeWidth="4" strokeLinecap="round" />
        <path d="M 288 124 Q 302 120 316 124" fill="none" stroke={T.ink} strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="360" cy="140" r="28" fill={T.paper} fillOpacity="0.55" stroke={T.ink} strokeWidth="5" />
        <circle cx="360" cy="140" r="10" fill={T.ink} />
        {/* coleira + tag */}
        <path d="M 272 216 Q 330 244 388 216 L 388 234 Q 330 262 272 234 Z" fill={T.greenBright} stroke={T.ink} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="330" cy="264" r="21" fill={T.ink} />
        <text x="330" y="271" textAnchor="middle" fontSize="16" fontWeight="700" fill={T.paper} fontFamily={MONO}>TL</text>
      </g>

      {/* cabo da lupa apontando para o documento */}
      <line x1="342" y1="176" x2="300" y2="238" stroke={T.ink} strokeWidth="8" strokeLinecap="round" transform="rotate(-8 330 170)" />

      {/* pata sobre a mesa */}
      <ellipse cx="272" cy="292" rx="24" ry="14" fill={T.caramel} stroke={T.ink} strokeWidth="3" />

      {/* documento: regulamento com a linha de vigencia destacada em verde */}
      <g transform="rotate(-3 150 250)">
        <rect x="70" y="206" width="164" height="102" rx="4" fill={T.surface} stroke={T.ink} strokeWidth="3" />
        <text x="84" y="228" fontFamily={MONO} fontSize="10" fontWeight="600" letterSpacing="1" fill={T.g500}>REGULAMENTO</text>
        <line x1="84" y1="242" x2="220" y2="242" stroke={T.line} strokeWidth="4" strokeLinecap="round" />
        <line x1="84" y1="256" x2="204" y2="256" stroke={T.line} strokeWidth="4" strokeLinecap="round" />
        <line x1="84" y1="270" x2="214" y2="270" stroke={T.line} strokeWidth="4" strokeLinecap="round" />
        <line x1="84" y1="284" x2="164" y2="284" stroke={T.green} strokeWidth="5" strokeLinecap="round" />
        <text x="172" y="288" fontFamily={MONO} fontSize="9" fill={T.green}>vigência ok</text>
      </g>

      {/* mesa */}
      <rect x="28" y="304" width="464" height="10" rx="3" fill={T.paperDark} stroke={T.ink} strokeWidth="3" />
      <line x1="70" y1="314" x2="70" y2="360" stroke={T.ink} strokeWidth="3" strokeLinecap="round" />
      <line x1="450" y1="314" x2="450" y2="360" stroke={T.ink} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ============ Sparklines mono para os cards de produto (uma metafora por produto) ============ */
export function Sparkline({ kind }: { kind: "daily" | "weekly" | "lab" | "pro" }) {
  const common = { className: "h-7 w-auto", role: "img" as const };
  if (kind === "daily")
    return (
      <svg viewBox="0 0 120 28" {...common} aria-label="Cinco barras, uma por dia útil">
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={8 + i * 24} y={6 + (i % 2) * 3} width="10" height={16 - (i % 2) * 3} rx="2" fill={i === 4 ? T.green : T.g400} opacity={i === 4 ? 1 : 0.55} />
        ))}
      </svg>
    );
  if (kind === "weekly")
    return (
      <svg viewBox="0 0 120 28" {...common} aria-label="Linha consolidando a semana">
        <polyline points="6,20 30,16 54,18 78,10 102,12 114,6" fill="none" stroke={T.g400} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="114" cy="6" r="3.5" fill={T.green} />
      </svg>
    );
  if (kind === "lab")
    return (
      <svg viewBox="0 0 120 28" {...common} aria-label="Curva evergreen crescendo devagar">
        <path d="M6 22 Q 50 22 80 14 T 114 6" fill="none" stroke={T.g400} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="6" y1="24" x2="114" y2="24" stroke={T.line} strokeWidth="1.5" />
      </svg>
    );
  return (
    <svg viewBox="0 0 120 28" {...common} aria-label="Grade de base histórica">
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3, 4, 5].map((c) => (
          <rect key={`${r}${c}`} x={8 + c * 19} y={4 + r * 8} width="12" height="5" rx="1.5" fill={r === 0 && c > 3 ? T.green : T.g400} opacity={r === 0 && c > 3 ? 1 : 0.35} />
        )),
      )}
    </svg>
  );
}

/* ============ Textura ledger do hero (decorativa, aria-hidden) ============ */
export function LedgerTexture() {
  const rows = Array.from({ length: 9 }, (_, i) => 40 + i * 44);
  const figs = ["+110%", "R$ 16,60", "84.000", "CPM", "40.000", "1:1,2", "R$ 24,20", "TL 76"];
  return (
    <svg
      viewBox="0 0 600 420"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
      preserveAspectRatio="xMidYMid slice"
    >
      <g opacity="0.05">
        {rows.map((y) => (
          <line key={y} x1="0" y1={y} x2="600" y2={y} stroke={T.ink} strokeWidth="1" />
        ))}
        {figs.map((f, i) => (
          <text
            key={f}
            x={(i % 3) * 210 + 30}
            y={rows[(i * 2 + 1) % rows.length] - 10}
            fontFamily={MONO}
            fontSize="14"
            fill={T.ink}
          >
            {f}
          </text>
        ))}
      </g>
    </svg>
  );
}
