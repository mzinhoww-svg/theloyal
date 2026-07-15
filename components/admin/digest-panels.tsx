import type { QaReport, EditionEvent, EditionStat } from "@/lib/admin-digest-ops";
import { Pill, StatCard, fmtDate, type Tone } from "@/components/admin/ui";

const LEVEL_TONE: Record<string, Tone> = { block: "red", warn: "yellow", ok: "green" };

// Fase 4 — relatório de QA com achados por regra.
export function QaPanel({ report }: { report: QaReport | null }) {
  if (!report) {
    return (
      <div className="rounded-lg border border-line bg-surface p-4 text-sm text-gray-500">
        QA ainda não rodado.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pill tone={report.blocking ? "red" : report.passed ? "green" : "yellow"}>
          {report.blocking ? "bloqueado" : report.passed ? "aprovado" : "com avisos"}
        </Pill>
        <span className="font-mono text-sm tabular-nums">score {report.score ?? "—"}</span>
        <span className="text-xs text-gray-400">{fmtDate(report.created_at)}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {report.findings.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Pill tone={LEVEL_TONE[f.level] ?? "gray"}>{f.level}</Pill>
            <span className="text-gray-700">
              <span className="font-mono text-xs text-gray-500">{f.rule}</span> — {f.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Fase 6 — desempenho da edição no Beehiiv.
export function StatsPanel({ stat }: { stat: EditionStat | null }) {
  if (!stat) {
    return (
      <div className="rounded-lg border border-line bg-surface p-4 text-sm text-gray-500">
        Sem métricas ainda — atualize após o envio.
      </div>
    );
  }
  const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);
  return (
    <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
      <StatCard label="Destinatários" value={stat.recipients ?? "—"} tone="gray" />
      <StatCard label="Aberturas" value={stat.opens ?? "—"} sub={pct(stat.open_rate)} tone="blue" />
      <StatCard label="Cliques" value={stat.clicks ?? "—"} sub={pct(stat.click_rate)} tone="green" />
      <StatCard label="Atualizado" value={fmtDate(stat.fetched_at)} tone="gray" />
    </section>
  );
}

// Fase 7 — trilha de auditoria.
const ACTION_TONE: Record<string, Tone> = {
  generated: "blue",
  curated: "gray",
  qa: "yellow",
  approved: "green",
  scheduled: "blue",
  published: "green",
  stats: "gray",
  "approve-blocked": "red",
  "beehiiv-draft": "gray",
};
export function EventsTimeline({ events }: { events: EditionEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-400">sem eventos registrados.</p>;
  }
  return (
    <ol className="flex flex-col gap-2">
      {events.map((e) => (
        <li key={e.id} className="flex items-center gap-3 text-sm">
          <span className="w-32 flex-none font-mono text-xs tabular-nums text-gray-500">
            {fmtDate(e.at)}
          </span>
          <Pill tone={ACTION_TONE[e.action] ?? "gray"}>{e.action}</Pill>
          <span className="truncate text-gray-500">{e.actor ?? "—"}</span>
        </li>
      ))}
    </ol>
  );
}
