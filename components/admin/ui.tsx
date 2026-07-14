import type { ReactNode } from "react";

// UI compartilhada da Central de Controle. Server-safe (sem estado/efeito).
// So tokens da marca — nada de hex nem cor default do Tailwind.

type Tone = "green" | "blue" | "yellow" | "red" | "gray";

// text usa a variante escura (700/ink) para contraste AA sobre o fill claro.
// Amarelo segue a regra 7: fill yellow-500 com texto Ink (nunca texto amarelo).
const TONE: Record<Tone, string> = {
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  yellow: "bg-yellow-500 text-ink",
  red: "bg-red-100 text-red-700",
  gray: "bg-paper-dark text-gray-500 border border-line",
};

const VERDICT_TONE: Record<string, Tone> = {
  "vale-agir": "green",
  "vale-olhar": "blue",
  "casos-especificos": "gray",
  esperaria: "yellow",
  evitaria: "red",
  "nao-confirmado": "gray",
};

// status de cron/run/campanha → tom semantico
const STATUS_TONE: Record<string, Tone> = {
  succeeded: "green",
  ok: "green",
  done: "green",
  active: "green",
  continua: "green",
  nova: "blue",
  running: "blue",
  scheduled: "blue",
  pending: "yellow",
  "vence-72h": "yellow",
  warning: "yellow",
  "vence-hoje": "red",
  failed: "red",
  error: "red",
  vencida: "gray",
  descartada: "gray",
  paused: "gray",
  inactive: "gray",
};

export function toneForVerdict(v: string | null | undefined): Tone {
  return (v && VERDICT_TONE[v]) || "gray";
}
export function toneForStatus(s: string | null | undefined): Tone {
  return (s && STATUS_TONE[s.toLowerCase()]) || "gray";
}

export function Pill({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = "gray" }: { tone?: Tone }) {
  const bg: Record<Tone, string> = {
    green: "bg-green-600",
    blue: "bg-blue-600",
    yellow: "bg-yellow-500",
    red: "bg-red-600",
    gray: "bg-gray-400",
  };
  return (
    <span
      className={`inline-block h-2 w-2 flex-none rounded-full ${bg[tone]}`}
      aria-hidden="true"
    />
  );
}

export function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.05em] text-gray-500">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
          tone === "red"
            ? "text-red-600"
            : tone === "yellow"
              ? "text-gray-700"
              : "text-ink"
        }`}
      >
        {value}
      </div>
      {sub != null && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        {sub != null && <p className="mt-1 text-sm text-gray-500">{sub}</p>}
      </div>
      {actions != null && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

// Wrapper de tabela: rola horizontalmente sem estourar o body.
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`border-b border-line px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.05em] text-gray-500 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-line px-3 py-2 align-top text-ink ${className}`}
    >
      {children}
    </td>
  );
}

export function EmptyRow({ cols, label }: { cols: number; label: string }) {
  return (
    <tr>
      <Td className="text-gray-400" >
        <span className="block py-2">{label}</span>
      </Td>
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <Td key={i}> </Td>
      ))}
    </tr>
  );
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const s = String(d);
  // timestamptz/ISO → dd/mm HH:MM; date-only → dd/mm/yyyy
  const dt = new Date(s);
  if (isNaN(+dt)) return s.slice(0, 16);
  if (s.length <= 10) return dt.toLocaleDateString("pt-BR");
  return dt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
