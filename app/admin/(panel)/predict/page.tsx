import { loadPredict, type Prediction } from "@/lib/admin-predict";
import {
  StatCard,
  PageHeader,
  Pill,
  Legend,
  Table,
  Th,
  Td,
  EmptyRow,
  type Tone,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/admin/toast";
import { snapshotAllAction } from "./actions";
import { MODEL_VERSION } from "@/lib/predict-engine";

function confTone(c: string): Tone {
  return c === "alta" ? "green" : c === "media" ? "blue" : c === "baixa" ? "yellow" : "gray";
}
const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n * 100)}%`);
const bonusLabel = (p: Prediction) =>
  p.bonusCandidates[0] ? `${p.bonusCandidates[0].value}% (${pct(p.bonusCandidates[0].probability)})` : "—";

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

function SeriesRow({ p, showHistory = false }: { p: Prediction; showHistory?: boolean }) {
  const blocked = p.blockReason != null;
  return (
    <tr className={blocked ? "bg-paper/40" : undefined}>
      <Td className="whitespace-nowrap font-medium">
        {p.origem ? `${p.origem} → ${p.destino}` : `→ ${p.destino}`}
      </Td>
      <Td className="text-right font-mono tabular-nums">{p.recordsTotal}</Td>
      <Td className="text-right font-mono tabular-nums text-gray-500">
        {p.daysSinceLast ?? "—"}
      </Td>
      <Td className="text-right font-mono tabular-nums text-gray-500">
        {p.medianIntervalAll ?? "—"}
      </Td>
      {showHistory && (
        <Td className="max-w-[260px] align-top leading-relaxed">
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
          <Td className="text-right font-mono tabular-nums">{pct(p.probabilities?.p30)}</Td>
          <Td className="text-right font-mono tabular-nums">{pct(p.probabilities?.p90)}</Td>
          <Td className="font-mono tabular-nums">{bonusLabel(p)}</Td>
          <Td>
            <Pill tone={confTone(p.confidence)}>{p.confidence}</Pill>
          </Td>
        </>
      )}
    </tr>
  );
}

function ProbBar({ label, v, tone }: { label: string; v: number; tone: Tone }) {
  const bg: Record<Tone, string> = {
    green: "bg-green-600",
    blue: "bg-blue-600",
    yellow: "bg-yellow-500",
    red: "bg-red-600",
    gray: "bg-gray-400",
  };
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 flex-none font-mono tabular-nums text-gray-500">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper-dark">
        <div className={`h-full rounded-full ${bg[tone]}`} style={{ width: `${Math.round(v * 100)}%` }} />
      </div>
      <span className="w-10 flex-none text-right font-mono tabular-nums">{pct(v)}</span>
    </div>
  );
}

function DetailCard({ p }: { p: Prediction }) {
  const t = confTone(p.confidence);
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold">
          {p.origem ? `${p.origem} → ${p.destino}` : `→ ${p.destino}`}
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

export default async function PredictPage() {
  const { result, ledgerRows, datasetComplete, containment, blockedCount } = await loadPredict();
  const series = [...result.clusters, ...result.routes];
  const ready = series.filter(isReady).length;
  const blocked = series.filter((p) => p.blockReason != null).length;
  const topReadyCluster = result.clusters.find(isReady) ?? result.clusters[0];

  return (
    <>
      <PageHeader
        title="Predict"
        sub={`Motor histórico & preditivo por série (${MODEL_VERSION}). ${ledgerRows} campanhas no ledger.`}
        actions={
          <ActionForm action={snapshotAllAction}>
            <SubmitButton variant="primary" pendingLabel="Salvando…">
              Gerar snapshot
            </SubmitButton>
          </ActionForm>
        }
      />

      {!datasetComplete && (
        <div className="mb-4 rounded border border-red-600 bg-red-100 px-3 py-2 text-sm text-red-700">
          <strong>Dataset incompleto</strong> — distribuição bloqueada (Fase C0).
        </div>
      )}

      <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <StatCard label="Séries" value={series.length} sub={`${result.clusters.length} programas · ${result.routes.length} rotas`} tone="gray" />
        <StatCard label="Com previsão" value={ready} sub="ready / ready_with_warnings" tone={ready > 0 ? "green" : "gray"} />
        <StatCard label="Bloqueadas (motor)" value={blocked} sub="histórico insuficiente" tone={blocked > 0 ? "yellow" : "green"} />
        <StatCard label="Contido C0" value={blockedCount} sub={`temporal ${containment.temporalBlocked ?? 0} · dup ${containment.probableDuplicates ?? 0} · placeholder ${containment.placeholders ?? 0}`} tone={blockedCount > 0 ? "yellow" : "green"} />
        <StatCard label="Dataset" value={datasetComplete ? "completo" : "incompleto"} sub={`${ledgerRows} linhas`} tone={datasetComplete ? "green" : "red"} />
      </section>

      <div className="mb-4 mt-4">
        <Legend
          items={[
            { tone: "green", label: "alta" },
            { tone: "blue", label: "média" },
            { tone: "yellow", label: "baixa" },
            { tone: "gray", label: "insuficiente / bloqueada" },
          ]}
        />
      </div>

      {topReadyCluster && (
        <section className="mb-8">
          <h2 className="mb-2 font-display text-lg font-semibold">Detalhe — programa com mais histórico</h2>
          <DetailCard p={topReadyCluster} />
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-1 font-display text-lg font-semibold">Programas (cluster → destino)</h2>
        <p className="mb-3 text-sm text-gray-500">
          Cada linha é uma série de transferência bonificada para o programa. <strong>Campanhas</strong> = quantas
          já ocorreram no histórico; <strong>Dias desde a última</strong> = há quanto tempo foi a mais recente;{" "}
          <strong>Cadência</strong> = intervalo mediano em dias entre elas; <strong>Prob. 30d/90d</strong> = chance
          de nova janela nesse prazo; <strong>Bônus provável</strong> = valor mais provável e sua probabilidade.
          A coluna <strong>Ondas (datas)</strong> lista as campanhas do histórico com o intervalo em dias entre
          elas — a prova da cadência. Séries com menos de 3 campanhas ficam bloqueadas — sem previsão até acumular
          histórico.
        </p>
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
            </tr>
          </thead>
          <tbody>
            {result.clusters.length ? (
              result.clusters.map((p) => <SeriesRow key={p.seriesKey} p={p} showHistory />)
            ) : (
              <EmptyRow cols={9} label="sem séries de transferência" />
            )}
          </tbody>
        </Table>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 font-display text-lg font-semibold">Rotas (origem → destino)</h2>
        <p className="mb-3 text-sm text-gray-500">
          Mesma leitura das colunas, agora por rota específica (origem → destino). <strong>Cadência</strong> em
          dias entre campanhas; <strong>Prob. 30d/90d</strong> = chance de nova janela no prazo. A coluna{" "}
          <strong>Ondas (datas)</strong> lista as campanhas que compõem o histórico, com o intervalo em dias entre
          elas — é a prova da cadência (ex.: duas ondas separadas por 943 dias). Rotas com menos de 3 campanhas
          ficam bloqueadas.
        </p>
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
            </tr>
          </thead>
          <tbody>
            {result.routes.length ? (
              result.routes.slice(0, 60).map((p) => <SeriesRow key={p.seriesKey} p={p} showHistory />)
            ) : (
              <EmptyRow cols={9} label="sem rotas" />
            )}
          </tbody>
        </Table>
      </section>
    </>
  );
}
