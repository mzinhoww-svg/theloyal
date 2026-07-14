import {
  getMetrics,
  getRecentRuns,
  rest,
  type Campaign,
} from "@/lib/admin-db";
import {
  MetricCard,
  PageHeader,
  Pill,
  StatusDot,
  Table,
  Th,
  Td,
  EmptyRow,
  toneForStatus,
  toneForVerdict,
  fmtDate,
} from "@/components/admin/ui";

export default async function DashboardPage() {
  const [m, runs, campaigns] = await Promise.all([
    getMetrics(),
    getRecentRuns(8),
    rest<Campaign>(
      "campaigns?select=id,origem,destino,tipo,percentual,tl_score,verdict,status,origin,last_seen,vigencia_fim&order=last_seen.desc.nullslast&limit=8",
    ),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        sub="Números do dia e últimas execuções — dados ao vivo do Supabase."
      />

      <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        <MetricCard
          label="Notícias hoje"
          value={m?.news_hoje ?? "—"}
          sub={`${m?.news_total ?? 0} no total`}
        />
        <MetricCard
          label="Campanhas ativas"
          value={m?.campanhas_ativas ?? "—"}
          sub={`${m?.campanhas_total ?? 0} no ledger`}
        />
        <MetricCard
          label="Campanhas hoje"
          value={m?.campanhas_hoje ?? "—"}
          sub="novas/atualizadas"
        />
        <MetricCard
          label="Jobs ativos"
          value={m ? `${m.jobs_ativos}/${m.jobs_total}` : "—"}
          sub="crons habilitados"
        />
      </section>

      <section className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <MetricCard
          label="Notícias pendentes"
          value={m?.news_pendentes ?? "—"}
          sub="aguardando extração"
          tone={(m?.news_pendentes ?? 0) > 0 ? "yellow" : undefined}
        />
        <MetricCard
          label="Fila de backfill"
          value={m?.backfill_queue_pendente ?? "—"}
          sub={`${m?.backfill_tracker_pendente ?? 0} sitemaps pendentes`}
          tone={(m?.backfill_queue_pendente ?? 0) > 0 ? "yellow" : undefined}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-display text-lg font-semibold">
          Últimas execuções
        </h2>
        <Table>
          <thead>
            <tr>
              <Th>Job</Th>
              <Th>Status</Th>
              <Th>Início</Th>
              <Th>Retorno</Th>
            </tr>
          </thead>
          <tbody>
            {runs && runs.length > 0 ? (
              runs.map((r, i) => (
                <tr key={`${r.jobname}-${i}`}>
                  <Td className="font-mono">{r.jobname}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      <StatusDot tone={toneForStatus(r.status)} />
                      {r.status ?? "—"}
                    </span>
                  </Td>
                  <Td className="font-mono tabular-nums text-gray-500">
                    {fmtDate(r.start_time)}
                  </Td>
                  <Td className="text-gray-500">{r.return_message ?? "—"}</Td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={4} label="sem execuções registradas" />
            )}
          </tbody>
        </Table>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-display text-lg font-semibold">
          Campanhas recentes
        </h2>
        <Table>
          <thead>
            <tr>
              <Th>Rota</Th>
              <Th>Tipo</Th>
              <Th className="text-right">%</Th>
              <Th className="text-right">TL</Th>
              <Th>Veredito</Th>
              <Th>Status</Th>
              <Th>Vence</Th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length > 0 ? (
              campaigns.map((c) => (
                <tr key={c.id}>
                  <Td className="whitespace-nowrap font-medium">
                    {c.origem}
                    <span className="text-gray-400"> → </span>
                    {c.destino}
                  </Td>
                  <Td className="text-gray-500">{c.tipo}</Td>
                  <Td className="text-right font-mono tabular-nums">
                    {c.percentual ?? "—"}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {c.tl_score ?? "—"}
                  </Td>
                  <Td>
                    {c.verdict ? (
                      <Pill tone={toneForVerdict(c.verdict)}>{c.verdict}</Pill>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <Pill tone={toneForStatus(c.status)}>{c.status}</Pill>
                  </Td>
                  <Td className="font-mono tabular-nums text-gray-500">
                    {c.vigencia_fim ? String(c.vigencia_fim).slice(0, 10) : "—"}
                  </Td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={7} label="sem campanhas" />
            )}
          </tbody>
        </Table>
      </section>
    </>
  );
}
