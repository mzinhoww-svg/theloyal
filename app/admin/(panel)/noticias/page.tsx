import { getNews, getMetrics, type NewsRow } from "@/lib/admin-db";
import {
  StatCard,
  PageHeader,
  Pill,
  Table,
  Th,
  Td,
  EmptyRow,
  fmtDate,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/admin/toast";
import { reprocessNewsAction, runExtractAction } from "./actions";

type Status = "processada" | "pendente" | "erro";
function statusOf(n: NewsRow): Status {
  if (n.error) return "erro";
  return n.processed ? "processada" : "pendente";
}

export default async function NoticiasPage({
  searchParams,
}: {
  searchParams: { status?: string; source?: string };
}) {
  // Contagens REAIS vêm do RPC admin_metrics (count(*) exato no banco). A lista
  // abaixo carrega só as 500 mais recentes — é uma amostra para inspeção, não a
  // fonte dos totais. Fallback para a amostra se o RPC estiver indisponível.
  const [news, m] = await Promise.all([getNews(500), getMetrics()]);

  const total = m?.news_total ?? news.length;
  const processadas =
    m?.news_processadas ?? news.filter((n) => statusOf(n) === "processada").length;
  const pendentes = m?.news_pendentes ?? news.filter((n) => statusOf(n) === "pendente").length;
  const erros = m?.news_erro ?? news.filter((n) => statusOf(n) === "erro").length;

  const statusFilter = searchParams.status || "";
  const sourceFilter = searchParams.source || "";
  const sources = Array.from(new Set(news.map((n) => n.source))).sort();

  const filtered = news.filter(
    (n) =>
      (!statusFilter || statusOf(n) === statusFilter) &&
      (!sourceFilter || n.source === sourceFilter),
  );

  return (
    <>
      <PageHeader
        title="Notícias · Pipeline"
        sub="Coleta (ingest) → extração (campaigns). Visibilidade do que virou campanha."
        actions={
          <ActionForm action={runExtractAction}>
            <SubmitButton variant="primary" pendingLabel="Disparando…">
              Rodar extração
            </SubmitButton>
          </ActionForm>
        }
      />

      <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        <StatCard label="Total" value={total} sub={`${sources.length} fontes · ${news.length} recentes carregadas`} tone="gray" />
        <StatCard label="Processadas" value={processadas} sub="extração concluída" tone="green" />
        <StatCard
          label="Pendentes"
          value={pendentes}
          sub="aguardando extração"
          tone={pendentes > 0 ? "yellow" : "green"}
        />
        <StatCard
          label="Com erro"
          value={erros}
          sub="falha na extração"
          tone={erros > 0 ? "red" : "green"}
        />
      </section>

      <section className="mt-8">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Coletadas</h2>
          <form method="GET" className="flex flex-wrap items-center gap-2">
            <select
              name="status"
              defaultValue={statusFilter}
              className="min-h-[36px] rounded border border-line bg-surface px-2 text-sm text-ink"
            >
              <option value="">status: todos</option>
              <option value="processada">processada</option>
              <option value="pendente">pendente</option>
              <option value="erro">erro</option>
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
              <Th>Título</Th>
              <Th>Coletada</Th>
              <Th className="text-right">Camp.</Th>
              <Th>Modelo</Th>
              <Th>Status</Th>
              <Th className="text-right">Ação</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.slice(0, 200).map((n) => {
                const st = statusOf(n);
                return (
                  <tr key={n.id}>
                    <Td className="whitespace-nowrap text-gray-500">{n.source}</Td>
                    <Td className="max-w-[380px]">
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-blue-600 hover:underline"
                        title={n.title || n.url}
                      >
                        {n.title || n.url}
                      </a>
                      {n.error && (
                        <span className="mt-0.5 block truncate text-xs text-red-600">
                          {n.error}
                        </span>
                      )}
                    </Td>
                    <Td className="font-mono tabular-nums text-gray-500">
                      {fmtDate(n.fetched_at)}
                    </Td>
                    <Td className="text-right font-mono tabular-nums">
                      {n.campaigns_extracted ?? 0}
                    </Td>
                    <Td className="text-gray-500">{n.model_used ?? "—"}</Td>
                    <Td>
                      <Pill
                        tone={st === "erro" ? "red" : st === "pendente" ? "yellow" : "green"}
                      >
                        {st}
                      </Pill>
                    </Td>
                    <Td className="text-right">
                      <ActionForm
                        action={reprocessNewsAction}
                        className="flex justify-end"
                      >
                        <input type="hidden" name="id" value={n.id} />
                        <SubmitButton variant="default" pendingLabel="…">
                          Reprocessar
                        </SubmitButton>
                      </ActionForm>
                    </Td>
                  </tr>
                );
              })
            ) : (
              <EmptyRow cols={7} label="nenhuma notícia para este filtro" />
            )}
          </tbody>
        </Table>
        <p className="mt-2 text-xs text-gray-400">
          Lista: {Math.min(filtered.length, 200)} de {filtered.length} (amostra das 500 mais recentes).
          No banco: {total.toLocaleString("pt-BR")} no total · {processadas.toLocaleString("pt-BR")} lidas ·{" "}
          {pendentes.toLocaleString("pt-BR")} na fila · {erros.toLocaleString("pt-BR")} com erro.
        </p>
      </section>
    </>
  );
}
