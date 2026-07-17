import type { ReactNode } from "react";

// UI compartilhada da Central de Controle. Server-safe (sem estado/efeito).
// Só tokens da marca — nenhum hex, nenhuma cor default do Tailwind.

export type Tone = "green" | "blue" | "yellow" | "red" | "gray";

// Pills: fill claro + texto na variante escura (contraste AA). Amarelo segue a
// regra 7 (fill yellow-500 com texto Ink, nunca texto amarelo).
const PILL: Record<Tone, string> = {
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  yellow: "bg-yellow-500 text-ink",
  red: "bg-red-100 text-red-700",
  gray: "bg-paper-dark text-gray-500 border border-line",
};
const BAR: Record<Tone, string> = {
  green: "bg-green-600",
  blue: "bg-blue-600",
  yellow: "bg-yellow-500",
  red: "bg-red-600",
  gray: "bg-gray-400",
};
const SPARK: Record<Tone, { line: string; area: string }> = {
  green: { line: "stroke-green-600", area: "fill-green-100" },
  blue: { line: "stroke-blue-600", area: "fill-blue-100" },
  yellow: { line: "stroke-yellow-500", area: "fill-yellow-100" },
  red: { line: "stroke-red-600", area: "fill-red-100" },
  gray: { line: "stroke-gray-400", area: "fill-paper-dark" },
};

const VERDICT_TONE: Record<string, Tone> = {
  "vale-agir": "green",
  "vale-olhar": "blue",
  "casos-especificos": "gray",
  esperaria: "yellow",
  evitaria: "red",
  "nao-confirmado": "gray",
};
const STATUS_TONE: Record<string, Tone> = {
  succeeded: "green",
  ok: "green",
  done: "green",
  active: "green",
  continua: "green",
  processada: "green",
  nova: "blue",
  running: "blue",
  scheduled: "blue",
  pending: "yellow",
  pendente: "yellow",
  "vence-72h": "yellow",
  warning: "yellow",
  "vence-hoje": "red",
  failed: "red",
  erro: "red",
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

// Rótulos humanos pt-BR para status crus (pg_cron/pipeline chegam em inglês).
// Mantém a operação legível sem espalhar strings de máquina pela UI.
const STATUS_LABEL: Record<string, string> = {
  succeeded: "concluído",
  ok: "concluído",
  done: "concluído",
  running: "rodando",
  scheduled: "agendado",
  pending: "pendente",
  failed: "falhou",
  error: "falhou",
  active: "ativo",
  paused: "pausado",
  inactive: "pausado",
};
export function statusLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return STATUS_LABEL[s.toLowerCase()] ?? s;
}

// Célula/inline de status: ponto semântico + rótulo humano. Vocabulário único
// em toda a Central (substitui o status cru espalhado nas tabelas).
export function StatusCell({ status }: { status: string | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <StatusDot tone={toneForStatus(status)} />
      <span>{statusLabel(status)}</span>
    </span>
  );
}

// TL Score → banda semântica (mapa do CLAUDE.md).
export function toneForScore(n: number | null | undefined): Tone {
  if (n == null) return "gray";
  if (n >= 85) return "green";
  if (n >= 70) return "blue";
  if (n >= 55) return "gray";
  if (n >= 40) return "yellow";
  return "red";
}

export function Pill({ children, tone = "gray" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${PILL[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = "gray" }: { tone?: Tone }) {
  return (
    <span
      className={`inline-block h-2 w-2 flex-none rounded-full ${BAR[tone]}`}
      aria-hidden="true"
    />
  );
}

// Sparkline de série única: linha 2px + área clara, sem eixo, um destaque só.
// Coordenadas calculadas em JS; cor vem de classe (stroke/fill do tema).
export function Sparkline({
  data,
  tone = "green",
  height = 30,
  className = "",
}: {
  data: number[];
  tone?: Tone;
  height?: number;
  className?: string;
}) {
  const W = 100;
  const H = 30;
  const pad = 3;
  const n = data.length;
  if (n < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const area = `M0,${H} L${pts.join(" L")} L${W},${H} Z`;
  const c = SPARK[tone];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      height={height}
      className={`w-full ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d={area} className={`${c.area} opacity-40`} stroke="none" />
      <polyline
        points={pts.join(" ")}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className={c.line}
      />
    </svg>
  );
}

// Painel base: borda completa (nunca side-stripe), Surface, radius de card.
// Bloco genérico para conteúdo que não é métrica pura.
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`h-full rounded-lg border border-line bg-surface p-4 ${className}`}>
      {children}
    </div>
  );
}

// Rótulo de card: CAPS discreto, com ponto semântico opcional no lugar da
// antiga faixa lateral colorida (side-stripe é ban do impeccable + regra da marca).
export function CardLabel({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.05em] text-gray-500">
      {tone && <StatusDot tone={tone} />}
      {children}
    </div>
  );
}

// Card de métrica: valor mono grande, contexto, acento semântico via ponto no
// rótulo + cor da sparkline (uma cor por card) — sem faixa lateral.
export function StatCard({
  label,
  value,
  sub,
  tone,
  spark,
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  spark?: number[];
  href?: string;
}) {
  const inner = (
    <div className="flex h-full flex-col rounded-lg border border-line bg-surface p-4 transition-colors group-hover:border-gray-400">
      <CardLabel tone={tone}>{label}</CardLabel>
      <div
        className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
          tone === "red" ? "text-red-600" : "text-ink"
        }`}
      >
        {value}
      </div>
      {sub != null && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
      {spark && spark.length > 1 && (
        <div className="mt-auto pt-3">
          <Sparkline data={spark} tone={tone ?? "green"} />
        </div>
      )}
    </div>
  );
  if (href) {
    return (
      <a href={href} className="group block h-full">
        {inner}
      </a>
    );
  }
  return inner;
}

export type Alert = { tone: Tone; text: string; href: string; cta?: string };

// Faixa "Atenção agora": só o que é acionável. Vazia = tudo em dia (verde calmo).
export function AttentionStrip({ items }: { items: Alert[] }) {
  if (items.length === 0) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
        <StatusDot tone="green" />
        <span className="text-gray-700">Tudo em dia — nada pedindo ação agora.</span>
      </div>
    );
  }
  return (
    <div className="mb-6 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
      {items.map((a, i) => (
        <a
          key={i}
          href={a.href}
          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm transition-colors hover:border-gray-400"
        >
          <span className="flex min-w-0 items-center gap-2">
            <StatusDot tone={a.tone} />
            <span className="truncate text-gray-700">{a.text}</span>
          </span>
          <span className="flex-none font-semibold text-blue-600">
            {a.cta ?? "ver"} →
          </span>
        </a>
      ))}
    </div>
  );
}

// Gates rotulados (substitui o "✕ ✕" ambíguo do admin antigo).
export function GateChips({
  validate,
  audit,
}: {
  validate: boolean | null;
  audit: boolean | null;
}) {
  const chip = (label: string, ok: boolean | null) => (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${
        ok === true
          ? "bg-green-100 text-green-700"
          : ok === false
            ? "bg-red-100 text-red-700"
            : "bg-paper-dark text-gray-500"
      }`}
    >
      {label} {ok === true ? "✓" : ok === false ? "✗" : "—"}
    </span>
  );
  return (
    <span className="inline-flex gap-1.5">
      {chip("validate", validate)}
      {chip("audit", audit)}
    </span>
  );
}

export function Legend({ items }: { items: { tone: Tone; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <StatusDot tone={it.tone} />
          {it.label}
        </span>
      ))}
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

// Tabela responsiva: no mobile (<768px) cada linha vira um card com campos
// rotulados (ver .tl-datatable em globals.css) — zero scroll horizontal. Acima
// de md volta ao formato de tabela com header sticky e zebra sutil.
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="tl-datatable md:overflow-x-auto md:rounded-lg md:border md:border-line md:bg-surface">
      <table className="w-full border-collapse text-sm [&_tbody_tr:nth-child(even)]:bg-paper/40 [&_tbody_tr:hover]:bg-paper-dark/50">
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`sticky top-0 z-10 border-b border-line bg-surface px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.05em] text-gray-500 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  colSpan,
  label,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
  // Rótulo do campo no modo card (mobile). Espelha o texto do <Th> da coluna.
  label?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      data-label={label}
      className={`border-b border-line px-3 py-2 align-top text-ink ${className}`}
    >
      {children}
    </td>
  );
}

// Vazio de tabela que ensina: rótulo em contraste AA + dica opcional do que
// preenche a tabela (product.md: empty state ensina a interface, não "nada aqui").
export function EmptyRow({
  cols,
  label,
  hint,
}: {
  cols: number;
  label: string;
  hint?: ReactNode;
}) {
  return (
    <tr>
      <Td colSpan={cols} className="tl-cell-full">
        <div className="flex flex-col gap-1 py-6 text-center">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {hint != null && (
            <span className="mx-auto max-w-md text-xs text-gray-500">{hint}</span>
          )}
        </div>
      </Td>
    </tr>
  );
}

// Vazio fora de tabela (seções, painéis): mesmo tom didático.
export function EmptyState({
  label,
  hint,
  action,
}: {
  label: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-surface px-4 py-8 text-center">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {hint != null && (
        <span className="max-w-md text-xs text-gray-500">{hint}</span>
      )}
      {action != null && <div className="mt-1">{action}</div>}
    </div>
  );
}

// Skeleton de carregamento: pulso sutil (opacity, neutraliza em reduced-motion
// pelo reset global). Substitui spinner no meio do conteúdo (product.md).
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-paper-dark ${className}`}
      aria-hidden="true"
    />
  );
}

// Placeholder de página inteira: header + grade de métricas + tabela. Casa com
// o ritmo real das telas para não haver salto de layout na troca de rota.
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="mb-6 border-b border-line pb-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="mt-8 overflow-hidden rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-3 py-2.5">
          <Skeleton className="h-3 w-32" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-3 py-3">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const s = String(d);
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
