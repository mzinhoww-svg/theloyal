"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Cockpit ao vivo: revalida os Server Components a cada intervalo, mostra o
// carimbo de frescor do dado (renderedAt vem do servidor) e permite pausar.
// Só usa transform/opacity implícitos — nada de spinner girando, respeita a
// intenção de reduced-motion do resto do app.

const INTERVAL_MS = 30_000;

function hhmmss(iso: string): string {
  const d = new Date(iso);
  if (isNaN(+d)) return "—";
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function LiveRefresh({ renderedAt }: { renderedAt: string }) {
  const router = useRouter();
  const [auto, setAuto] = useState(true);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!auto) return;
    timer.current = setInterval(() => {
      startTransition(() => router.refresh());
    }, INTERVAL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [auto, router]);

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span className="font-mono tabular-nums" aria-live="polite">
        {pending ? "atualizando…" : `atualizado ${hhmmss(renderedAt)}`}
      </span>
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        className="min-h-[32px] rounded border border-line bg-surface px-2 font-semibold text-ink hover:bg-paper-dark"
      >
        Atualizar
      </button>
      <button
        type="button"
        onClick={() => setAuto((a) => !a)}
        aria-pressed={auto}
        title={auto ? "Auto-refresh ligado (30s)" : "Auto-refresh desligado"}
        className={`min-h-[32px] rounded border px-2 font-semibold ${
          auto
            ? "border-green-600 text-green-700"
            : "border-line text-gray-500 hover:bg-paper-dark"
        }`}
      >
        {auto ? "auto ●" : "auto ○"}
      </button>
    </div>
  );
}
