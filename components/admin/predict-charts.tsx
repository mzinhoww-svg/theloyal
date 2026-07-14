import type { ReactNode } from "react";
import type { Tone } from "./ui";

// Gráficos da área de predict — SVG/flex puro, server-safe, só tokens da marca.

const SEG: Record<string, string> = {
  alta: "bg-green-600",
  media: "bg-blue-600",
  baixa: "bg-gray-400",
  "em-formacao": "bg-paper-dark",
};
const SEG_LABEL: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  "em-formacao": "Em formação",
};

// Barra empilhada da distribuição de confiança.
export function DistributionBar({
  title,
  dist,
}: {
  title: string;
  dist: Record<string, number>;
}) {
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const order = ["alta", "media", "baixa", "em-formacao"];
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-gray-500">
        {title}
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-paper-dark" role="img" aria-label={title}>
        {order.map((k) =>
          dist[k] ? (
            <div
              key={k}
              className={SEG[k]}
              style={{ width: `${(dist[k] / total) * 100}%` }}
              title={`${SEG_LABEL[k]}: ${dist[k]}`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        {order.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${SEG[k]}`} aria-hidden="true" />
            {SEG_LABEL[k]} <span className="font-mono tabular-nums text-ink">{dist[k] ?? 0}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Timeline: janelas previstas ao longo dos próximos `horizon` dias a partir de
// `from` (ISO). Cada barra = uma janela [start,end]. Linha vertical = hoje (dia 0).
export function WindowTimeline({
  from,
  horizon,
  items,
}: {
  from: string;
  horizon: number;
  items: { label: string; start: string; end: string; tone: Tone }[];
}) {
  const day0 = Date.parse(from + "T00:00:00Z");
  const span = horizon || 1;
  const pos = (iso: string) => {
    const d = (Date.parse(iso + "T00:00:00Z") - day0) / 86_400_000;
    return Math.max(0, Math.min(100, (d / span) * 100));
  };
  const BAR: Record<Tone, string> = {
    green: "bg-green-600",
    blue: "bg-blue-600",
    yellow: "bg-yellow-500",
    red: "bg-red-600",
    gray: "bg-gray-400",
  };
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
        <span>hoje</span>
        <span className="font-mono">+{horizon}d</span>
      </div>
      <div className="space-y-1.5">
        {items.length === 0 && (
          <p className="text-sm text-gray-400">nenhuma janela prevista dentro do horizonte</p>
        )}
        {items.map((it, i) => {
          const left = pos(it.start);
          const w = Math.max(2, pos(it.end) - left);
          return (
            <div key={i} className="flex items-center gap-3 text-xs">
              <div className="w-40 flex-none truncate text-gray-700">{it.label}</div>
              <div className="relative h-4 flex-1 rounded bg-paper-dark">
                <span className="absolute left-0 top-0 h-4 w-px bg-red-600" aria-hidden="true" />
                <div
                  className={`absolute h-4 rounded ${BAR[it.tone]}`}
                  style={{ left: `${left}%`, width: `${w}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      {children}
      {hint && <span className="text-[11px] leading-snug text-gray-400">{hint}</span>}
    </label>
  );
}
