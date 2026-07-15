import { getRecentRuns, rest, type PipelineRun } from "@/lib/admin-db";
import {
  PageHeader,
  StatusCell,
  Table,
  Th,
  Td,
  EmptyRow,
  statusLabel,
  fmtDate,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

type LogRow = {
  when: string | null;
  source: "cron" | "pipeline";
  label: string;
  status: string | null;
  message: string;
};

export default async function LogsPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  const [cronRuns, pipeline] = await Promise.all([
    getRecentRuns(100),
    rest<PipelineRun>(
      "runs?select=id,product,kind,status,started_at,finished_at,campaigns_found,gate_validate,gate_audit,human_note&order=started_at.desc&limit=100",
    ),
  ]);

  const rows: LogRow[] = [
    ...(cronRuns ?? []).map((r) => ({
      when: r.start_time,
      source: "cron" as const,
      label: r.jobname,
      status: r.status,
      message: r.return_message ?? "",
    })),
    ...pipeline.map((p) => ({
      when: p.started_at,
      source: "pipeline" as const,
      label: `${p.product}${p.kind ? ` · ${p.kind}` : ""}`,
      status: p.status,
      message:
        p.human_note ??
        [
          p.campaigns_found != null ? `${p.campaigns_found} campanhas` : "",
          p.gate_validate != null ? `validate ${p.gate_validate ? "✓" : "✗"}` : "",
          p.gate_audit != null ? `audit ${p.gate_audit ? "✓" : "✗"}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
    })),
  ].sort((a, b) => +new Date(b.when ?? 0) - +new Date(a.when ?? 0));

  const { status = "", q = "" } = searchParams;
  const statuses = Array.from(
    new Set(rows.map((r) => r.status).filter(Boolean) as string[]),
  ).sort();
  const query = q.trim().toLowerCase();

  const filtered = rows.filter(
    (r) =>
      (!status || r.status === status) &&
      (!query ||
        r.message.toLowerCase().includes(query) ||
        r.label.toLowerCase().includes(query)),
  );

  return (
    <>
      <PageHeader
        title="Logs"
        sub="Execuções do pg_cron e do pipeline editorial, unificadas por data."
      />

      <form
        method="GET"
        className="mb-4 flex flex-wrap items-center gap-2"
        aria-label="Filtros de log"
      >
        <select
          name="status"
          defaultValue={status}
          className="min-h-[44px] rounded border border-line bg-surface px-2 text-sm text-ink"
        >
          <option value="">status: todos</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="buscar na mensagem…"
          className="min-h-[44px] min-w-[220px] flex-1 rounded border border-line bg-surface px-3 text-sm text-ink"
        />
        <SubmitButton variant="default">Buscar</SubmitButton>
      </form>

      <Table>
        <thead>
          <tr>
            <Th>Data/hora</Th>
            <Th>Origem</Th>
            <Th>Job / Produto</Th>
            <Th>Status</Th>
            <Th>Mensagem</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length > 0 ? (
            filtered.map((r, i) => (
              <tr key={`${r.source}-${r.label}-${i}`}>
                <Td className="whitespace-nowrap font-mono tabular-nums text-gray-500">
                  {fmtDate(r.when)}
                </Td>
                <Td className="text-gray-500">{r.source}</Td>
                <Td className="font-mono">{r.label}</Td>
                <Td>
                  <StatusCell status={r.status} />
                </Td>
                <Td className="text-gray-500">{r.message || "—"}</Td>
              </tr>
            ))
          ) : (
            <EmptyRow cols={5} label="nenhum log para este filtro" />
          )}
        </tbody>
      </Table>
      <p className="mt-2 text-xs text-gray-500">
        Exibindo {filtered.length} de {rows.length} registros recentes.
      </p>
    </>
  );
}
