import {
  getMetrics,
  getRecentRuns,
  getNews,
  rest,
  type Campaign,
  type PipelineRun,
} from "@/lib/admin-db";
import { bucketByDay, deriveAttention, needsReview } from "@/lib/admin-series";
import {
  StatCard,
  AttentionStrip,
  GateChips,
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
  const [m, runs, pipeline, campaigns, news] = await Promise.all([
    getMetrics(),
    getRecentRuns(100),
    rest<PipelineRun>(
      "runs?select=status,started_at,gate_validate,gate_audit,campaigns_found,product&order=started_at.desc&limit=1",
    ),
    rest<Campaign & { first_seen: string | null }>(
      "campaigns?select=id,origem,destino,tipo,percentual,tl_score,verdict,status,origin,last_seen,vigencia_fim,first_seen,notes&order=last_seen.desc.nullslast&limit=500",
    ),
    getNews(500),
  ]);

  const runList = runs ?? [];
  const last = pipeline[0];

  const newsErro = m?.news_erro ?? news.filter((n) => n.error).length;
  const newsPendentes =
    m?.news_pendentes ?? news.filter((n) => !n.processed && !n.error).length;
  const venceHoje = campaigns.filter((c) => c.status === "vence-hoje").length;
  const vence72 = campaigns.filter((c) => c.status === "vence-72h").length;
  const reviewCount = campaigns.filter(needsReview).length;
  const jobsPausados = m ? m.jobs_total - m.jobs_ativos : 0;
  const runFailed =
    runList.find((r) => (r.status ?? "").toLowerCase() === "failed")?.jobname ??
    null;

  const attention = deriveAttention({
    newsPendentes,
    newsErro,
    venceHoje,
    vence72,
    reviewCount,
    jobsPausados,
    runFailed,
  });

  const runsPerDay = bucketByDay(runList.map((r) => r.start_time));
  const newsPerDay = bucketByDay(news.map((n) => n.fetched_at));
  const campNovasPerDay = bucketByDay(campaigns.map((c) => c.first_seen));

  const recentCampaigns = campaigns.slice(0, 8);

  return (
    <>
      <PageHeader
        title="Dashboard"
        sub="O que precisa de atenção agora, tendência e últimas execuções."
      />

      <AttentionStrip items={attention} />

      <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <StatCard
          label="Notícias hoje"
          value={m?.news_hoje ?? "—"}
          sub={`${m?.news_total ?? 0} no total · ${newsErro} com erro`}
          tone="blue"
          spark={newsPerDay}
          href="/admin/noticias"
        />
        <StatCard
          label="Campanhas ativas"
          value={m?.campanhas_ativas ?? "—"}
          sub={`${m?.campanhas_total ?? 0} no ledger · ${m?.campanhas_hoje ?? 0} hoje`}
          tone="green"
          spark={campNovasPerDay}
          href="/admin/campanhas"
        />
        <StatCard
          label="Execuções · 14d"
          value={runsPerDay.reduce((a, b) => a + b, 0)}
          sub={`última ${fmtDate(runList[0]?.start_time)}`}
          tone="gray"
          spark={runsPerDay}
          href="/admin/logs"
        />
        <StatCard
          label="Jobs ativos"
          value={m ? `${m.jobs_ativos}/${m.jobs_total}` : "—"}
          sub={jobsPausados > 0 ? `${jobsPausados} pausados` : "todos habilitados"}
          tone={jobsPausados > 0 ? "yellow" : "green"}
          href="/admin/jobs"
        />
      </section>

      <section className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        <div className="relative h-full overflow-hidden rounded-lg border border-line bg-surface p-4">
          <span
            className="absolute left-0 top-0 h-full w-1 bg-line"
            aria-hidden="true"
          />
          <div className="text-xs font-semibold uppercase tracking-[0.05em] text-gray-500">
            Última rodada editorial
          </div>
          {last ? (
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Pill tone={toneForStatus(last.status)}>
                  {last.status ?? "—"}
                </Pill>
                <span className="font-mono text-xs tabular-nums text-gray-500">
                  {fmtDate(last.started_at)}
                </span>
              </div>
              <GateChips
                validate={last.gate_validate}
                audit={last.gate_audit}
              />
            </div>
          ) : (
            <div className="mt-2 text-sm text-gray-400">sem rodadas</div>
          )}
        </div>
        <StatCard
          label="Notícias com erro"
          value={newsErro}
          sub="falha na extração"
          tone={newsErro > 0 ? "red" : "green"}
          href="/admin/noticias?status=erro"
        />
        <StatCard
          label="Fila de backfill"
          value={m?.backfill_queue_pendente ?? "—"}
          sub={`${m?.backfill_tracker_pendente ?? 0} sitemaps pendentes`}
          tone={(m?.backfill_queue_pendente ?? 0) > 0 ? "yellow" : "green"}
          href="/admin/backfill"
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
            {runList.length > 0 ? (
              runList.slice(0, 8).map((r, i) => (
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
            {recentCampaigns.length > 0 ? (
              recentCampaigns.map((c) => (
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
