import {
  getBackfillProgress,
  rest,
  type BackfillQueueRow,
  type BackfillTrackerRow,
} from "@/lib/admin-db";
import {
  PageHeader,
  Pill,
  Table,
  Th,
  Td,
  EmptyRow,
  toneForStatus,
  fmtDate,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { reprocessAction, runBackfillAction } from "./actions";

function Progress({
  label,
  done,
  pending,
  error,
}: {
  label: string;
  done: number;
  pending: number;
  error: number;
}) {
  const total = done + pending + error;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.05em] text-gray-500">
          {label}
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {pct}%
        </span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-paper-dark">
        <div
          className="h-full rounded-full bg-green-600"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-gray-500">
        <span>done {done}</span>
        <span>pending {pending}</span>
        {error > 0 && <span className="text-red-600">error {error}</span>}
      </div>
    </div>
  );
}

export default async function BackfillPage({
  searchParams,
}: {
  searchParams: { status?: string; source?: string };
}) {
  const [progress, queue, tracker] = await Promise.all([
    getBackfillProgress(),
    rest<BackfillQueueRow>(
      "backfill_queue?select=id,source,url,status,title,error_msg,processed_at&order=created_at.desc&limit=500",
    ),
    rest<BackfillTrackerRow>(
      "backfill_tracker?select=id,source,sitemap_url,status,urls_found,urls_inserted,error_msg&order=id.asc&limit=500",
    ),
  ]);

  const tk = progress?.tracker ?? {};
  const qq = progress?.queue ?? {};

  const statusFilter = searchParams.status || "";
  const sourceFilter = searchParams.source || "";
  const sources = Array.from(new Set(queue.map((q) => q.source))).sort();
  const statuses = Array.from(
    new Set(queue.map((q) => q.status).filter(Boolean) as string[]),
  ).sort();

  const filteredQueue = queue.filter(
    (q) =>
      (!statusFilter || q.status === statusFilter) &&
      (!sourceFilter || q.source === sourceFilter),
  );

  return (
    <>
      <PageHeader
        title="Backfill"
        sub="Histórico via sitemaps — tracker (sub-sitemaps) e queue (URLs)."
        actions={
          <form action={runBackfillAction}>
            <SubmitButton variant="primary" pendingLabel="Disparando…">
              Rodar backfill-daily
            </SubmitButton>
          </form>
        }
      />

      <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        <Progress
          label="Sitemaps (tracker)"
          done={tk.done ?? 0}
          pending={tk.pending ?? 0}
          error={tk.error ?? 0}
        />
        <Progress
          label="URLs (queue)"
          done={qq.done ?? 0}
          pending={qq.pending ?? 0}
          error={qq.error ?? 0}
        />
      </section>

      <section className="mt-8">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Fila de URLs</h2>
          <form method="GET" className="flex flex-wrap items-center gap-2">
            <select
              name="status"
              defaultValue={statusFilter}
              className="min-h-[36px] rounded border border-line bg-surface px-2 text-sm text-ink"
            >
              <option value="">status: todos</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              name="source"
              defaultValue={sourceFilter}
              className="min-h-[36px] rounded border border-line bg-surface px-2 text-sm text-ink"
            >
              <option value="">fonte: todas</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <SubmitButton variant="default">Filtrar</SubmitButton>
          </form>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Fonte</Th>
              <Th>URL</Th>
              <Th>Status</Th>
              <Th>Processado</Th>
              <Th className="text-right">Ação</Th>
            </tr>
          </thead>
          <tbody>
            {filteredQueue.length > 0 ? (
              filteredQueue.map((q) => (
                <tr key={q.id}>
                  <Td className="whitespace-nowrap text-gray-500">{q.source}</Td>
                  <Td className="max-w-[420px]">
                    <a
                      href={q.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-blue-600 hover:underline"
                      title={q.title || q.url}
                    >
                      {q.title || q.url}
                    </a>
                    {q.error_msg && (
                      <span className="mt-0.5 block truncate text-xs text-red-600">
                        {q.error_msg}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Pill tone={toneForStatus(q.status)}>
                      {q.status ?? "—"}
                    </Pill>
                  </Td>
                  <Td className="font-mono tabular-nums text-gray-500">
                    {fmtDate(q.processed_at)}
                  </Td>
                  <Td className="text-right">
                    <form action={reprocessAction} className="flex justify-end">
                      <input type="hidden" name="id" value={q.id} />
                      <SubmitButton variant="default" pendingLabel="…">
                        Reprocessar
                      </SubmitButton>
                    </form>
                  </Td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={5} label="nenhuma URL para este filtro" />
            )}
          </tbody>
        </Table>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-display text-lg font-semibold">
          Sub-sitemaps (tracker)
        </h2>
        <Table>
          <thead>
            <tr>
              <Th>Fonte</Th>
              <Th>Sitemap</Th>
              <Th>Status</Th>
              <Th className="text-right">Encontradas</Th>
              <Th className="text-right">Inseridas</Th>
            </tr>
          </thead>
          <tbody>
            {tracker.length > 0 ? (
              tracker.slice(0, 200).map((t) => (
                <tr key={t.id}>
                  <Td className="whitespace-nowrap text-gray-500">{t.source}</Td>
                  <Td className="max-w-[420px]">
                    <span
                      className="block truncate"
                      title={t.sitemap_url}
                    >
                      {t.sitemap_url}
                    </span>
                    {t.error_msg && (
                      <span className="mt-0.5 block truncate text-xs text-red-600">
                        {t.error_msg}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Pill tone={toneForStatus(t.status)}>
                      {t.status ?? "—"}
                    </Pill>
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {t.urls_found ?? 0}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {t.urls_inserted ?? 0}
                  </Td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={5} label="sem sub-sitemaps" />
            )}
          </tbody>
        </Table>
        {tracker.length > 200 && (
          <p className="mt-2 text-xs text-gray-400">
            Exibindo 200 de {tracker.length} sub-sitemaps.
          </p>
        )}
      </section>
    </>
  );
}
