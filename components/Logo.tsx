// Logo oficial The Loyal. Tokens do tema apenas — nenhum hex hardcodado.
// Wordmark: Fraunces (var --font-display) "The" 600 + "Loyal" 700.
// Monograma: quadrado (bg token) + letras (currentColor) construidas em geometria fixa.

type WordmarkProps = {
  /** "ink" = texto Ink (fundo claro/Paper). "paper" = texto Paper (fundo Ink/escuro). */
  tone?: "ink" | "paper";
  withTagline?: boolean;
  className?: string;
};

export function Wordmark({ tone = "ink", withTagline = false, className = "" }: WordmarkProps) {
  const text = tone === "paper" ? "text-paper" : "text-ink";
  return (
    <span className={`inline-flex flex-col leading-none ${className}`}>
      <span className={`font-display ${text}`} style={{ letterSpacing: "-0.01em" }}>
        <span style={{ fontWeight: 600 }}>The </span>
        <span style={{ fontWeight: 700 }}>Loyal</span>
      </span>
      {withTagline && (
        <span className="mt-1 font-sans text-[0.72em] font-normal text-gray-500">
          Fidelidade com conta feita
        </span>
      )}
    </span>
  );
}

type MonogramProps = {
  size?: number;
  /** "default" quadrado Ink + letras Paper · "green" quadrado Verde + letras Ink · "inverted" quadrado Paper + letras Ink */
  variant?: "default" | "green" | "inverted";
  className?: string;
  title?: string;
};

export function Monogram({ size = 48, variant = "default", className = "", title = "The Loyal" }: MonogramProps) {
  const square =
    variant === "green" ? "bg-green-600" : variant === "inverted" ? "bg-paper" : "bg-ink";
  const letters = variant === "default" ? "text-paper" : "text-ink";
  return (
    <span
      className={`inline-flex items-center justify-center ${square} ${className}`}
      style={{ width: size, height: size, borderRadius: 0 }}
    >
      <svg viewBox="0 0 120 120" width={size} height={size} className={letters} fill="currentColor" role="img" aria-label={title}>
        <rect x="23" y="23" width="36" height="12" />
        <rect x="35" y="23" width="12" height="73" />
        <rect x="63" y="23" width="12" height="73" />
        <rect x="63" y="84" width="34" height="12" />
      </svg>
    </span>
  );
}
