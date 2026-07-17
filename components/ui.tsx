"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* Entrada de secao no scroll: uma vez, respeita reduced motion via CSS */
export function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`tl-reveal ${inView ? "is-in" : ""} ${className}`}>
      {children}
    </div>
  );
}

/* Label canonico de secao: linha 1px + CAPS (DESIGN.md Section Divider) */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 border-t border-line pt-4">
      <span className="tl-label">{children}</span>
    </div>
  );
}

/* Badge TL Score: mapa semantico DESIGN.md / LLM System */
export type Verdict =
  | "vale-agir"
  | "vale-olhar"
  | "casos-especificos"
  | "esperaria"
  | "evitaria"
  | "nao-confirmado";

const VERDICT_STYLE: Record<Verdict, { label: string; cls: string }> = {
  "vale-agir": { label: "VALE AGIR", cls: "bg-green-100 text-green-700" },
  "vale-olhar": { label: "VALE OLHAR", cls: "bg-blue-100 text-blue-700" },
  "casos-especificos": {
    label: "SÓ PARA CASOS ESPECÍFICOS",
    cls: "bg-paper-dark text-gray-500",
  },
  esperaria: { label: "ESPERARIA", cls: "bg-yellow-500 text-ink" },
  evitaria: { label: "EVITARIA", cls: "bg-red-600 text-surface" },
  "nao-confirmado": {
    label: "NÃO CONFIRMADO",
    cls: "border border-dashed border-gray-400 text-gray-500",
  },
};

// Score obrigatorio em todo veredito, exceto "nao-confirmado" (DESIGN.md: sem dado, sem numero).
type TLBadgeProps =
  | { verdict: Exclude<Verdict, "nao-confirmado">; score: number }
  | { verdict: "nao-confirmado"; score?: number };

export function TLBadge({ verdict, score }: TLBadgeProps) {
  const v = VERDICT_STYLE[verdict];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.06em] ${v.cls}`}
    >
      {v.label}
      {typeof score === "number" && (
        <span className="font-mono text-sm font-semibold normal-case tracking-normal">
          {score}
        </span>
      )}
    </span>
  );
}

/* Conta Block: ritual da marca "conta feita". Fundo Ink fixo, numeros em mono (DESIGN.md) */
export function ContaBlock({
  rows,
  result,
  ariaLabel,
}: {
  rows: [string, string][];
  result: [string, string];
  ariaLabel?: string;
}) {
  return (
    <div
      role="figure"
      aria-label={ariaLabel ?? "Bloco de cálculo"}
      className="rounded bg-ink px-5 py-4 font-mono text-[13px] leading-7 text-paper sm:px-6 sm:py-5 sm:text-sm"
    >
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4">
          <span className="text-gray-400">{k}</span>
          <span className="text-right">{v}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between gap-4 border-t border-gray-700 pt-2 text-green-500">
        <span>{result[0]}</span>
        <span className="text-right font-semibold">{result[1]}</span>
      </div>
    </div>
  );
}
