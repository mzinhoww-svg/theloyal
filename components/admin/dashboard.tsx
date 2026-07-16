import type { ReactNode } from "react";
import { Pill, Sparkline, type Tone } from "./ui";

// Blocos de dashboard das áreas Forecast/Predict — server-safe, só tokens da
// marca. A camada de leitura rápida fica no topo da página; o detalhe pesado
// (tabelas, parâmetros, qualidade) recolhe em <Disclosure>.

// Seção recolhível nativa (details/summary): zero JS, funciona em server
// component. `count` dá o tamanho do conteúdo sem precisar abrir.
export function Disclosure({
  title,
  sub,
  count,
  open = false,
  children,
}: {
  title: string;
  sub?: ReactNode;
  count?: number;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={open} className="group mb-4 rounded-lg border border-line bg-surface">
      <summary className="flex min-h-[44px] cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="inline-block w-3 flex-none self-center text-xs text-gray-400 transition-transform ease-standard group-open:rotate-90"
        >
          ▸
        </span>
        <span className="font-display text-lg font-semibold text-ink">{title}</span>
        {count != null && (
          <span className="rounded-full bg-paper-dark px-2 py-0.5 font-mono text-xs tabular-nums text-gray-500">
            {count}
          </span>
        )}
        {sub != null && <span className="text-sm text-gray-500">{sub}</span>}
      </summary>
      <div className="border-t border-line px-4 pb-4 pt-4">{children}</div>
    </details>
  );
}

const BAR: Record<Tone, string> = {
  green: "bg-green-600",
  blue: "bg-blue-600",
  yellow: "bg-yellow-500",
  red: "bg-red-600",
  gray: "bg-gray-400",
};

// ---- Filtros por URL (searchParams) — links e form GET, zero JS ----

export type FilterParams = Record<string, string>;

// Monta o href preservando os demais parâmetros; trocar filtro volta à pág. 1.
function filterHref(path: string, params: FilterParams, overrides: Record<string, string | null>): string {
  const next: Record<string, string | null> = { ...params, ...overrides, pagina: null };
  if (overrides.pagina != null) next.pagina = overrides.pagina;
  const qs = Object.entries(next)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join("&");
  return qs ? `${path}?${qs}` : path;
}

export type ChipOption = { label: string; value: string };

// Grupo de chips de um parâmetro. Clicar no chip ativo remove o filtro.
export function FilterChips({
  path,
  params,
  param,
  label,
  options,
}: {
  path: string;
  params: FilterParams;
  param: string;
  label: string;
  options: ChipOption[];
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.05em] text-gray-500">{label}</span>
      {options.map((o) => {
        const active = (params[param] ?? "") === o.value;
        return (
          <a
            key={o.value}
            href={filterHref(path, params, { [param]: active ? null : o.value })}
            aria-pressed={active}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-ink text-paper"
                : "border border-line bg-surface text-gray-700 hover:border-gray-400"
            }`}
          >
            {o.label}
          </a>
        );
      })}
    </span>
  );
}

// Busca textual via form GET nativo — preserva os demais filtros em hidden.
export function SearchForm({
  path,
  params,
  param = "q",
  placeholder,
}: {
  path: string;
  params: FilterParams;
  param?: string;
  placeholder: string;
}) {
  return (
    <form action={path} method="get" className="inline-flex items-center gap-2">
      {Object.entries(params)
        .filter(([k, v]) => k !== param && k !== "pagina" && v)
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <input
        name={param}
        defaultValue={params[param] ?? ""}
        placeholder={placeholder}
        autoComplete="off"
        className="rounded border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-gray-400"
      />
      <button
        type="submit"
        className="rounded border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-gray-400"
      >
        filtrar
      </button>
    </form>
  );
}

// Link "limpar filtros" — só aparece quando algum filtro está ativo.
export function ClearFilters({ path, active }: { path: string; active: boolean }) {
  if (!active) return null;
  return (
    <a href={path} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
      limpar filtros
    </a>
  );
}

// Paginação por link (anterior/próxima + posição em mono).
export function Pagination({
  path,
  params,
  page,
  pageCount,
}: {
  path: string;
  params: FilterParams;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const link = (p: number, label: string, enabled: boolean) =>
    enabled ? (
      <a
        href={filterHref(path, params, { pagina: String(p) })}
        className="rounded border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-gray-400"
      >
        {label}
      </a>
    ) : (
      <span className="rounded border border-line bg-paper-dark px-3 py-1.5 text-xs font-semibold text-gray-400">
        {label}
      </span>
    );
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      {link(page - 1, "← anterior", page > 1)}
      <span className="font-mono text-xs tabular-nums text-gray-500">
        pág. {page} / {pageCount}
      </span>
      {link(page + 1, "próxima →", page < pageCount)}
    </div>
  );
}

export type Segment = { label: string; value: number; tone: Tone };

// Barra empilhada genérica (identidade por rótulo + valor no legend, nunca só
// cor). Substitui a DistributionBar hardcoded quando as chaves variam.
export function SegmentBar({ title, segments }: { title: string; segments: Segment[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-gray-500">{title}</div>
      <div className="flex h-3 w-full gap-px overflow-hidden rounded-full bg-paper-dark" role="img" aria-label={title}>
        {segments.map((s) =>
          s.value ? (
            <div
              key={s.label}
              className={BAR[s.tone]}
              style={{ width: `${(s.value / total) * 100}%` }}
              title={`${s.label}: ${s.value}`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${BAR[s.tone]}`} aria-hidden="true" />
            {s.label} <span className="font-mono tabular-nums text-ink">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Barra de probabilidade rotulada (usada nos cards e no detalhe do Predict).
export function ProbBar({ label, v, tone }: { label: string; v: number; tone: Tone }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 flex-none font-mono tabular-nums text-gray-500">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper-dark">
        <div className={`h-full rounded-full ${BAR[tone]}`} style={{ width: `${Math.round(v * 100)}%` }} />
      </div>
      <span className="w-10 flex-none text-right font-mono tabular-nums text-ink">{Math.round(v * 100)}%</span>
    </div>
  );
}

// Sequencial de UMA matiz (verde claro→escuro) com o número sempre visível na
// célula — identidade nunca fica só na cor. Todos os pares passam AA:
// green-100/ink, green-500/ink, green-700/paper.
function heatCell(v: number | null): { cls: string; text: string } {
  if (v == null) return { cls: "text-gray-400", text: "—" };
  const pct = `${Math.round(v * 100)}%`;
  if (v < 0.15) return { cls: "bg-paper-dark text-gray-500", text: pct };
  if (v < 0.4) return { cls: "bg-green-100 text-ink", text: pct };
  if (v < 0.7) return { cls: "bg-green-500 text-ink", text: pct };
  return { cls: "bg-green-700 text-paper", text: pct };
}

export type HeatmapRow = { label: string; values: (number | null)[] };

// Matriz série × horizonte: probabilidade de nova janela em cada prazo.
export function HorizonHeatmap({ horizons, rows }: { horizons: number[]; rows: HeatmapRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-line px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.05em] text-gray-500">
              Série
            </th>
            {horizons.map((h) => (
              <th
                key={h}
                className="border-b border-line px-2 py-2 text-right font-mono text-xs font-semibold text-gray-500"
              >
                {h}d
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="max-w-[220px] truncate border-b border-line px-3 py-1.5 font-medium text-ink" title={r.label}>
                {r.label}
              </td>
              {r.values.map((v, i) => {
                const c = heatCell(v);
                return (
                  <td key={i} className="border-b border-line p-0.5 text-right">
                    <span
                      className={`block rounded-sm px-2 py-1 font-mono text-xs tabular-nums ${c.cls}`}
                      title={`${r.label} · ${horizons[i]}d`}
                    >
                      {c.text}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-paper-dark" aria-hidden="true" /> &lt;15%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-green-100" aria-hidden="true" /> 15–39%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-green-500" aria-hidden="true" /> 40–69%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-green-700" aria-hidden="true" /> ≥70%
        </span>
      </div>
    </div>
  );
}

// Card de oportunidade do Predict: a resposta de 5s — qual série, quanta
// chance no curto prazo, qual bônus esperar e a prova (cadência × recência).
export function OpportunityCard({
  label,
  confidence,
  tone,
  pinned = false,
  p30,
  p90,
  bonus,
  cadenceDays,
  daysSinceLast,
  window,
  trend,
  actions,
}: {
  label: string;
  confidence: string;
  tone: Tone;
  pinned?: boolean;
  p30: number;
  p90: number;
  bonus: string | null;
  cadenceDays: number | null;
  daysSinceLast: number | null;
  window: string | null;
  trend?: number[];
  actions?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-line bg-surface p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="min-w-0 truncate font-medium text-ink" title={label}>
          {label}
        </span>
        <span className="flex flex-none items-center gap-1">
          {pinned && <Pill tone="blue">fixado</Pill>}
          <Pill tone={tone}>{confidence}</Pill>
        </span>
      </div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold tabular-nums text-ink">{Math.round(p30 * 100)}%</span>
        <span className="text-xs text-gray-500">prob. de nova campanha em 30d</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <ProbBar label="30d" v={p30} tone={tone} />
        <ProbBar label="90d" v={p90} tone={tone} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line pt-2 text-xs">
        <div>
          <dt className="text-gray-500">Bônus provável</dt>
          <dd className="font-mono tabular-nums text-ink">{bonus ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Cadência</dt>
          <dd className="font-mono tabular-nums text-ink">{cadenceDays != null ? `~${cadenceDays}d` : "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Última campanha</dt>
          <dd className="font-mono tabular-nums text-ink">
            {daysSinceLast != null ? `há ${daysSinceLast}d` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Janela central</dt>
          <dd className="font-mono tabular-nums text-ink">{window ?? "—"}</dd>
        </div>
      </dl>
      {trend && trend.length >= 2 && (
        <div className="mt-2 border-t border-line pt-2">
          <div className="mb-1 text-xs text-gray-500">prob. 30d ao longo dos snapshots</div>
          <Sparkline data={trend} tone={tone} height={20} />
        </div>
      )}
      {actions != null && (
        <div className="mt-2 flex items-center gap-1 border-t border-line pt-2">{actions}</div>
      )}
    </div>
  );
}

// Card de janela prevista do Forecast: quando abre (ou quanto falta para
// fechar), com que confiança e com que base histórica.
export function NextWindowCard({
  label,
  confidenceLabel,
  tone,
  daysToOpen,
  daysToClose,
  window,
  typicalPercent,
  basis,
}: {
  label: string;
  confidenceLabel: string;
  tone: Tone;
  daysToOpen: number;
  daysToClose: number | null;
  window: string;
  typicalPercent: number | null;
  basis: string;
}) {
  const status =
    daysToOpen > 0
      ? { text: `abre em ${daysToOpen}d`, cls: "text-blue-600" }
      : daysToClose != null && daysToClose >= 0
        ? { text: `aberta · fecha em ${daysToClose}d`, cls: "text-green-600" }
        : { text: "janela encerrando", cls: "text-gray-500" };
  return (
    <div className="flex h-full flex-col rounded-lg border border-line bg-surface p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="min-w-0 truncate font-medium text-ink" title={label}>
          {label}
        </span>
        <Pill tone={tone}>{confidenceLabel}</Pill>
      </div>
      <div className={`font-mono text-lg font-semibold tabular-nums ${status.cls}`}>{status.text}</div>
      <div className="mt-1 font-mono text-xs tabular-nums text-gray-500">{window}</div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2 text-xs text-gray-500">
        <span className="truncate" title={basis}>
          {basis}
        </span>
        {typicalPercent != null && (
          <span className="flex-none font-mono tabular-nums text-ink">bônus ~{typicalPercent}%</span>
        )}
      </div>
    </div>
  );
}
