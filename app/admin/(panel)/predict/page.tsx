import {
  loadPredict,
  getSeriesTrends,
  type Prediction,
  type PredictSeriesView,
  type TrendPoint,
} from "@/lib/admin-predict";
import { overrideRouteKey } from "@/lib/predict-overrides";
import { p30Series, calibrationFromTrend, type Calibration } from "@/lib/predict-trends";
import {
  StatCard,
  PageHeader,
  Pill,
  Legend,
  Table,
  Th,
  Td,
  EmptyRow,
  EmptyState,
  Sparkline,
  type Tone,
} from "@/components/admin/ui";
import {
  Disclosure,
  SegmentBar,
  HorizonHeatmap,
  OpportunityCard,
  ProbBar,
  type Segment,
} from "@/components/admin/dashboard";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/admin/toast";
import { snapshotAllAction, setOverrideAction } from "./actions";
import { MODEL_VERSION, HORIZONS } from "@/lib/predict-engine";
import { QualityPanel } from "@/components/admin/QualityPanel";

function confTone(c: string): Tone {
  return c === "alta" ? "green" : c === "media" ? "blue" : c === "baixa" ? "yellow" : "gray";
}
const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n * 100)}%`);
const bonusLabel = (p: Prediction) =>
  p.bonusCandidates[0] ? `${p.bonusCandidates[0].value}% (${pct(p.bonusCandidates[0].probability)})` : "—";
const seriesLabel = (p: Prediction) => (p.origem ? `${p.origem} → ${p.destino}` : `→ ${p.destino}`);

// dd/mm/aa a partir de ISO (sem new Date, determinístico).
const shortDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

// Prova do intervalo: as datas das ondas intercaladas pelos gaps em dias.
// Para poucas ondas mostra tudo (ex.: "12/05/23 · 943d · 11/12/25"); para
// muitas, resume primeira…última mantendo a contagem.
function HistoryCell({ p }: { p: Prediction }) {
  const ev = p.events ?? [];
  if (!ev.length) return <span className="text-gray-400">—</span>;
  if (ev.length > 6) {
    return (
      <span className="font-mono text-xs text-gray-500">
        {ev.length} ondas · {shortDate(ev[0])} … {shortDate(ev[ev.length - 1])}
      </span>
    );
  }
  return (
    <span className="font-mono text-xs text-gray-500">
      {ev.map((e, i) => (
        <span key={i}>
          {i > 0 && <span className="text-gray-400"> · {p.intervals[i - 1]}d · </span>}
          {shortDate(e)}
        </span>
      ))}
    </span>
  );
}

// Fixar/silenciar direto da linha ou do card (mesma tabela de overrides do
// Forecast; remoção pela tabela de overrides de lá).
function QuickOverride({ p, action, label }: { p: Prediction; action: "pin" | "mute"; label: string }) {
  return (
    <ActionForm action={setOverrideAction}>
      <input type="hidden" name="scope" value={p.scope} />
      <input type="hidden" name="route" value={overrideRouteKey(p)} />
      <input type="hidden" name="action" value={action} />
      <SubmitButton variant="ghost" pendingLabel="…">
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

function SeriesRow({ p, showHistory = false }: { p: PredictSeriesView; showHistory?: boolean }) {
  const blocked = p.blockReason != null;
  return (
    <tr className={blocked || p.muted ? "bg-paper/40 opacity-70" : undefined}>
      <Td label="Série" className="whitespace-nowrap font-medium">
        <span className="inline-flex items-center gap-1.5">
          {p.pinned && <Pill tone="blue">fixado</Pill>}
          {p.muted && <Pill tone="gray">silenciado</Pill>}
          {seriesLabel(p)}
        </span>
      </Td>
      <Td label="Campanhas" className="text-right font-mono tabular-nums">{p.recordsTotal}</Td>
      <Td label="Dias desde a última" className="text-right font-mono tabular-nums text-gray-500">
        {p.daysSinceLast ?? "—"}
      </Td>
      <Td label="Cadência (dias)" className="text-right font-mono tabular-nums text-gray-500">
        {p.medianIntervalAll ?? "—"}
      </Td>
      {showHistory && (
        <Td label="Ondas (datas)" className="max-w-[260px] align-top leading-relaxed">
          <HistoryCell p={p} />
        </Td>
      )}
      {blocked ? (
        <Td colSpan={4} className="text-gray-400">
          <span className="inline-flex items-center gap-2">
            <Pill tone="gray">bloqueado</Pill> {p.blockReason}
          </span>
        </Td>
      ) : (
        <>
          <Td label="Prob. 30d" className="text-right font-mono tabular-nums">{pct(p.probabilities?.p30)}</Td>
          <Td label="Prob. 90d" className="text-right font-mono tabular-nums">{pct(p.probabilities?.p90)}</Td>
          <Td label="Bônus provável" className="font-mono tabular-nums">{bonusLabel(p)}</Td>
          <Td label="Confiança">
            <Pill tone={confTone(p.confidence)}>{p.confidence}</Pill>
            {p.warnings.length > 0 && (
              <span className="mt-0.5 block text-[11px] text-gray-500" title={p.warnings.join(" · ")}>
                {p.warnings.join(" · ")}
              </span>
            )}
          </Td>
        </>
      )}
      <Td className="tl-cell-action">
        <div className="flex items-center gap-1">
          <QuickOverride p={p} action="pin" label={p.pinned ? "—" : "fixar"} />
          <QuickOverride p={p} action="mute" label={p.muted ? "—" : "silenciar"} />
        </div>
      </Td>
    </tr>
  );
}

function DetailCard({ p, trend }: { p: Prediction; trend?: TrendPoint[] }) {
  const t = confTone(p.confidence);
  const spark = p30Series(trend);
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold">
          {seriesLabel(p)}
          <span className="ml-2 align-middle">
            <Pill tone={t}>{p.confidence}</Pill>
          </span>
        </h3>
        <span className="font-mono text-xs text-gray-400">
          {p.recordsTotal} campanhas · readiness {p.readiness}
        </span>
      </div>
      {p.blockReason ? (
        <p className="text-sm text-gray-500">{p.explanation}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-gray-500">
              Probabilidade de nova campanha
            </div>
            <div className="flex flex-col gap-1.5">
              {p.probabilities && (
                <>
                  <ProbBar label="7d" v={p.probabilities.p7} tone={t} />
                  <ProbBar label="15d" v={p.probabilities.p15} tone={t} />
                  <ProbBar label="30d" v={p.probabilities.p30} tone={t} />
                  <ProbBar label="60d" v={p.probabilities.p60} tone={t} />
                  <ProbBar label="90d" v={p.probabilities.p90} tone={t} />
                  <ProbBar label="180d" v={p.probabilities.p180} tone={t} />
                </>
              )}
            </div>
            <div className="mt-2 font-mono text-xs text-gray-500">
              janela {p.windowStart} … {p.windowEnd} · central {p.centralDate}
            </div>
            {spark && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-gray-500">
                  Evolução da prob. 30d (snapshots)
                </div>
                <div className="max-w-[240px]">
                  <Sparkline data={spark} tone={t} height={24} />
                </div>
              </div>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-gray-500">
              Bônus provável
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.bonusCandidates.length ? (
                p.bonusCandidates.map((b, i) => (
                  <Pill key={i} tone={i === 0 ? t : "gray"}>
                    {b.value}% · {pct(b.probability)}
                  </Pill>
                ))
              ) : (
                <span className="text-sm text-gray-400">sem percentual observado</span>
              )}
              {p.bonusOutros > 0 && <Pill tone="gray">outros · {pct(p.bonusOutros)}</Pill>}
            </div>
            {p.backtest && p.backtest.observations > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-gray-500">
                  Backtest (walk-forward)
                </div>
                <div className="font-mono text-xs tabular-nums text-gray-500">
                  {p.backtest.observations} janelas · acerto {pct(p.backtest.windowHitRate)} · erro
                  mediano {p.backtest.medianDateErrorDays}d · bônus ±5pp{" "}
                  {pct(p.backtest.bonusAccuracy5pp)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <p className="mt-3 border-t border-line pt-2 text-sm text-gray-700">{p.explanation}</p>
    </div>
  );
}

const isReady = (p: Prediction) => p.readiness === "ready" || p.readiness === "ready_with_warnings";

// Distribuição de confiança de uma lista de séries → segmentos da barra.
function confSegments(list: Prediction[]): Segment[] {
  const count = (f: (p: Prediction) => boolean) => list.filter(f).length;
  return [
    { label: "alta", value: count((p) => !p.blockReason && p.confidence === "alta"), tone: "green" },
    { label: "média", value: count((p) => !p.blockReason && p.confidence === "media"), tone: "blue" },
    { label: "baixa", value: count((p) => !p.blockReason && p.confidence === "baixa"), tone: "yellow" },
    { label: "bloqueada", value: count((p) => p.blockReason != null), tone: "gray" },
  ];
}

function SeriesTable({ rows, empty }: { rows: PredictSeriesView[]; empty: string }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Série</Th>
          <Th className="text-right">Campanhas</Th>
          <Th className="text-right">Dias desde a última</Th>
          <Th className="text-right">Cadência (dias)</Th>
          <Th>Ondas (datas)</Th>
          <Th className="text-right">Prob. 30d</Th>
          <Th className="text-right">Prob. 90d</Th>
          <Th>Bônus provável</Th>
          <Th>Confiança</Th>
          <Th>Ações</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((p) => <SeriesRow key={p.seriesKey} p={p} showHistory />)
        ) : (
          <EmptyRow cols={10} label={empty} />
        )}
      </tbody>
    </Table>
  );
}

export default async function PredictPage() {
  const { result, clusters, routes, ledgerRows, asOf, datasetComplete } = await loadPredict();
  const series = [...clusters, ...routes];
  const ready = series.filter(isReady).length;
  const blocked = series.filter((p) => p.blockReason != null).length;
  const topReadyCluster = clusters.find((p) => isReady(p) && !p.muted) ?? clusters[0];

  // Dashboard: séries prontas com probabilidade, ranqueadas pelo curto prazo.
  // Silenciadas ficam fora do ranking e do heatmap (aparecem só nas tabelas);
  // fixadas vêm primeiro.
  const ranked = series
    .filter((p) => isReady(p) && p.probabilities && !p.muted)
    .sort((a, b) =>
      a.pinned !== b.pinned
        ? a.pinned
          ? -1
          : 1
        : (b.probabilities?.p30 ?? 0) - (a.probabilities?.p30 ?? 0),
    );
  const opportunities = ranked.slice(0, 6);
  const heatRows = ranked.slice(0, 10).map((p) => {
    const pr = p.probabilities;
    return {
      label: seriesLabel(p),
      values: pr
        ? [pr.p7, pr.p15, pr.p30, pr.p60, pr.p90, pr.p180]
        : HORIZONS.map((): number | null => null),
    };
  });

  // Tendência: uma query pelos snapshots das séries em destaque (últimos 90d).
  const trendKeys = Array.from(
    new Set([
      ...ranked.slice(0, 10).map((p) => p.seriesKey),
      ...(topReadyCluster ? [topReadyCluster.seriesKey] : []),
    ]),
  );
  const trends = await getSeriesTrends(trendKeys);
  const calibrations = trendKeys
    .map((k) => ({ key: k, cal: calibrationFromTrend(trends.get(k)) }))
    .filter((c): c is { key: string; cal: Calibration } => c.cal != null);
  const labelByKey = new Map(series.map((p) => [p.seriesKey, seriesLabel(p)]));

  return (
    <>
      <PageHeader
        title="Predict"
        sub={`Motor histórico & preditivo por série (${MODEL_VERSION}). ${ledgerRows} campanhas no ledger · as of ${asOf}.`}
        actions={
          <ActionForm action={snapshotAllAction}>
            <SubmitButton variant="primary" pendingLabel="Salvando…">
              Gerar snapshot
            </SubmitButton>
          </ActionForm>
        }
      />

      {!datasetComplete && (
        <div className="mb-4 rounded-lg border border-red-600 bg-red-100 p-3 text-sm text-red-700">
          Leitura do ledger incompleta — as séries abaixo podem estar parciais. Gere o snapshot
          apenas após a carga completar.
        </div>
      )}

      <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        <StatCard label="Séries" value={series.length} sub={`${result.clusters.length} programas · ${result.routes.length} rotas`} tone="gray" />
        <StatCard label="Com previsão" value={ready} sub="ready / ready_with_warnings" tone={ready > 0 ? "green" : "gray"} />
        <StatCard label="Bloqueadas" value={blocked} sub="histórico insuficiente" tone={blocked > 0 ? "yellow" : "green"} />
        <StatCard label="As of" value={<span className="text-lg">{asOf}</span>} sub={datasetComplete ? "carga completa" : "carga PARCIAL"} tone={datasetComplete ? undefined : "red"} />
      </section>

      <div className="mb-6 mt-4">
        <Legend
          items={[
            { tone: "green", label: "alta" },
            { tone: "blue", label: "média" },
            { tone: "yellow", label: "baixa" },
            { tone: "gray", label: "insuficiente / bloqueada" },
          ]}
        />
      </div>

      <section className="mb-8">
        <h2 className="mb-1 font-display text-lg font-semibold">Oportunidades — maior chance em 30 dias</h2>
        <p className="mb-3 text-sm text-gray-500">
          Séries prontas ranqueadas pela probabilidade de nova campanha no curto prazo. Projeção
          estatística da recorrência — nunca veredito nem garantia.
        </p>
        {opportunities.length ? (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {opportunities.map((p) => (
              <OpportunityCard
                key={p.seriesKey}
                label={seriesLabel(p)}
                confidence={p.confidence}
                tone={confTone(p.confidence)}
                pinned={p.pinned}
                p30={p.probabilities?.p30 ?? 0}
                p90={p.probabilities?.p90 ?? 0}
                bonus={p.bonusCandidates[0] ? bonusLabel(p) : null}
                cadenceDays={p.medianIntervalAll}
                daysSinceLast={p.daysSinceLast}
                window={p.centralDate ? shortDate(p.centralDate) : null}
                trend={p30Series(trends.get(p.seriesKey)) ?? undefined}
                actions={
                  <>
                    <QuickOverride p={p} action="pin" label={p.pinned ? "—" : "fixar"} />
                    <QuickOverride p={p} action="mute" label="silenciar" />
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            label="nenhuma série pronta com probabilidade calculada"
            hint="Séries entram aqui quando acumulam histórico suficiente (≥3 campanhas) e passam nos gates de qualidade."
          />
        )}
      </section>

      {heatRows.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 font-display text-lg font-semibold">Mapa de probabilidade por horizonte</h2>
          <p className="mb-3 text-sm text-gray-500">
            As {heatRows.length} séries de maior probabilidade em 30d, abertas por prazo (7 a 180
            dias). Quanto mais escura a célula, maior a chance de nova campanha até aquele prazo.
          </p>
          <HorizonHeatmap horizons={[...HORIZONS]} rows={heatRows} />
        </section>
      )}

      <section className="mb-8 grid gap-3 md:grid-cols-2">
        <SegmentBar title="Confiança · programas" segments={confSegments(result.clusters)} />
        <SegmentBar title="Confiança · rotas" segments={confSegments(result.routes)} />
      </section>

      {topReadyCluster && (
        <section className="mb-8">
          <h2 className="mb-2 font-display text-lg font-semibold">Detalhe — programa com mais histórico</h2>
          <DetailCard p={topReadyCluster} trend={trends.get(topReadyCluster.seriesKey)} />
        </section>
      )}

      <Disclosure
        title="Calibração do motor"
        count={calibrations.length}
        sub="primeiro vs último snapshot por série — o backtest está melhorando?"
      >
        {calibrations.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Série</Th>
                <Th className="text-right">Snapshots</Th>
                <Th>Período</Th>
                <Th className="text-right">Prob. 30d</Th>
                <Th className="text-right">Acerto de janela</Th>
                <Th className="text-right">Erro mediano</Th>
              </tr>
            </thead>
            <tbody>
              {calibrations.map(({ key, cal }) => (
                <tr key={key}>
                  <Td label="Série" className="font-medium">{labelByKey.get(key) ?? key}</Td>
                  <Td label="Snapshots" className="text-right font-mono tabular-nums">{cal.snapshots}</Td>
                  <Td label="Período" className="font-mono text-xs tabular-nums text-gray-500">
                    {shortDate(cal.firstAsOf)} … {shortDate(cal.lastAsOf)}
                  </Td>
                  <Td label="Prob. 30d" className="text-right font-mono tabular-nums">
                    {pct(cal.p30First)} → {pct(cal.p30Last)}
                  </Td>
                  <Td label="Acerto de janela" className="text-right font-mono tabular-nums">
                    {pct(cal.hitRateFirst)} → {pct(cal.hitRateLast)}
                  </Td>
                  <Td label="Erro mediano" className="text-right font-mono tabular-nums">
                    {cal.errorFirst != null ? `${cal.errorFirst}d` : "—"} →{" "}
                    {cal.errorLast != null ? `${cal.errorLast}d` : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            label="ainda não há snapshots suficientes para medir tendência"
            hint="A tendência precisa de ≥2 snapshots por série. Gere um agora no botão acima — e o cron diário (/api/predict-snapshot) acumula o histórico automaticamente."
          />
        )}
      </Disclosure>

      <Disclosure
        title="Qualidade do ledger (C0.2)"
        count={result.quality.excluded.length}
        sub="campanhas excluídas antes da formação das séries"
      >
        <QualityPanel quality={result.quality} embedded />
      </Disclosure>

      <Disclosure
        title="Programas (cluster → destino)"
        count={result.clusters.length}
        sub="todas as séries por programa"
        open
      >
        <p className="mb-3 text-sm text-gray-500">
          Cada linha é uma série de transferência bonificada para o programa. <strong>Campanhas</strong> = quantas
          já ocorreram no histórico; <strong>Dias desde a última</strong> = há quanto tempo foi a mais recente;{" "}
          <strong>Cadência</strong> = intervalo mediano em dias entre elas; <strong>Prob. 30d/90d</strong> = chance
          de nova janela nesse prazo; <strong>Bônus provável</strong> = valor mais provável e sua probabilidade.
          A coluna <strong>Ondas (datas)</strong> lista as campanhas do histórico com o intervalo em dias entre
          elas — a prova da cadência. Séries com menos de 3 campanhas ficam bloqueadas — sem previsão até acumular
          histórico.
        </p>
        <SeriesTable rows={clusters} empty="sem séries de transferência" />
      </Disclosure>

      <Disclosure
        title="Rotas (origem → destino)"
        count={result.routes.length}
        sub="todas as séries por rota específica"
      >
        <p className="mb-3 text-sm text-gray-500">
          Mesma leitura das colunas dos programas, agora por rota específica (origem → destino).
          A coluna <strong>Ondas (datas)</strong> lista as campanhas que compõem o histórico, com o
          intervalo em dias entre elas — é a prova da cadência (ex.: duas ondas separadas por 943
          dias). Rotas com menos de 3 campanhas ficam bloqueadas.
        </p>
        <SeriesTable rows={routes.slice(0, 60)} empty="sem rotas" />
      </Disclosure>

      <p className="mt-8 border-t border-line pt-4 text-xs text-gray-400">
        Projeção estatística a partir da recorrência do histórico do ledger — nunca veredito nem
        garantia. Séries sem base suficiente ficam bloqueadas; o motor nunca chuta uma data.
      </p>
    </>
  );
}
