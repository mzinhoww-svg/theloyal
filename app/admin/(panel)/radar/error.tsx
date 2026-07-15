"use client";

// Boundary de erro do Radar (B1): qualquer falha real em `loadRadar`/composição
// (na visão geral ou no detalhe) cai aqui e mostra um estado PADRONIZADO —
// título, impacto, ação e link de diagnóstico —, sem stack trace na UI e sem
// mascarar o erro como "sem dados". `reset` refaz a requisição.
import { resolveRadarLoadError } from "@/lib/radar-empty";

export default function RadarError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const e = resolveRadarLoadError();
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-600 bg-red-100 p-6 text-sm text-ink"
    >
      <h2 className="mb-1 font-display text-lg font-semibold text-red-700">{e.title}</h2>
      <p className="text-gray-700">{e.description} {e.impact}</p>
      <p className="mt-2 text-gray-700">Ação: {e.action}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-[44px] rounded bg-ink px-4 py-2 font-semibold text-paper"
        >
          Tentar novamente
        </button>
        {e.diagnosticHref && (
          <a href={e.diagnosticHref} className="min-h-[44px] rounded border border-line px-4 py-2 font-semibold text-blue-600 hover:bg-paper-dark">
            Diagnosticar nos logs →
          </a>
        )}
        <a href="/admin/radar" className="min-h-[44px] rounded border border-line px-4 py-2 font-semibold text-gray-700 hover:bg-paper-dark">
          Voltar ao Radar
        </a>
      </div>
    </div>
  );
}
