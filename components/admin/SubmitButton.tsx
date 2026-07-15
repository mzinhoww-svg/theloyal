"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

// Botao de Server Action com estado pendente. Client Component minimo —
// nenhuma chave/segredo trafega aqui; so dispara o form para o servidor.

type Variant = "primary" | "default" | "danger" | "ghost";

const VARIANT: Record<Variant, string> = {
  primary: "bg-green-600 text-paper hover:bg-green-700 border border-green-600",
  default: "bg-surface text-ink border border-line hover:bg-paper-dark",
  danger: "bg-surface text-red-600 border border-line hover:bg-red-100",
  ghost: "bg-transparent text-blue-600 border border-transparent hover:underline",
};

export function SubmitButton({
  children,
  pendingLabel,
  variant = "default",
  title,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: Variant;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      className={`tl-press inline-flex min-h-[36px] items-center justify-center gap-1 rounded px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT[variant]}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
