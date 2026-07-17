"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";

// Botao de Server Action com estado pendente. Client Component minimo —
// nenhuma chave/segredo trafega aqui; so dispara o form para o servidor.

type Variant = "primary" | "default" | "danger" | "ghost";

const VARIANT: Record<Variant, string> = {
  primary: "bg-green-600 text-paper hover:bg-green-700 border border-green-600",
  default: "bg-surface text-ink border border-line hover:bg-paper-dark",
  danger: "bg-surface text-red-600 border border-line hover:bg-red-100",
  ghost: "bg-transparent text-blue-600 border border-transparent hover:underline",
};

// Alvo de toque ≥44px (gate de a11y da marca) + feedback tátil no press
// (active:scale, transform apenas — reduced-motion global neutraliza).
const BASE =
  "inline-flex min-h-[44px] items-center justify-center gap-1 rounded px-3 py-1.5 text-sm font-semibold transition-[colors,transform] duration-150 ease-standard active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "default",
  title,
  confirm,
  disabled = false,
  ariaDescribedBy,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: Variant;
  title?: string;
  // Quando setado, exige um segundo clique inline antes de submeter (ações
  // destrutivas). Sem modal — o próprio botão vira "Confirmar?".
  confirm?: string;
  // Desabilita externamente (ex.: ação que não faz sentido com dado parcial).
  disabled?: boolean;
  // Liga o botão a um texto visível/sr-only que explica por que está desabilitado.
  ariaDescribedBy?: string;
}) {
  const { pending } = useFormStatus();
  const [armed, setArmed] = useState(false);

  // Auto-desarme em 4s: no touch (iOS) não há blur nem Escape — sem isso o
  // botão ficaria armado em silêncio e o gate de segurança falharia lá.
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  const label = pending && pendingLabel ? pendingLabel : children;

  if (confirm && !armed) {
    return (
      <button
        type="button"
        title={title}
        disabled={disabled}
        aria-describedby={ariaDescribedBy}
        onClick={() => setArmed(true)}
        className={`${BASE} ${VARIANT[variant]}`}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      title={title}
      aria-describedby={ariaDescribedBy}
      onBlur={() => armed && setArmed(false)}
      // Escape desarma a confirmação pendente (convenção padrão de cancelar).
      onKeyDown={(e) => {
        if (e.key === "Escape" && armed) setArmed(false);
      }}
      aria-live="polite"
      className={`${BASE} ${confirm ? VARIANT.danger : VARIANT[variant]}`}
    >
      {confirm && !pending ? confirm : label}
    </button>
  );
}
