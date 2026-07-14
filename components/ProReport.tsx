import type { ProReport } from "@/lib/pro";
import { SectionLabel, TLBadge, type Verdict } from "./ui";

// Deck executivo do The Loyal Pro: capa Ink, miolo Paper, tabelas comparativas
// com números em mono, alertas com cor semântica. Tokens da marca, sem hex.
const VERDICT_LABEL: Record<Verdict, string> = {
  "vale-agir": "Vale agir",
  "vale-olhar": "Vale olhar",
  "casos-especificos": "Só casos específicos",
  esperaria: "Esperaria",
  evitaria: "Evitaria",
  "nao-confirmado": "Não confirmado",
};

const SIGNAL_STYLE: Record<ProReport["players"][number]["signal"], string> = {
  abertura: "bg-green-100 text-green-700",
  aperto: "bg-red-100 text-red-700",
  "estável": "bg-paper-dark text-gray-500",
};

const ALERT_STYLE: Record<ProReport["alerts"][number]["level"], string> = {
  insight: "border-blue-600",
  warning: "border-yellow-500",
  danger: "border-red-600",
};

function num(n: string) {
  return <span className="font-mono text-sm tabular-nums">{n}</span>;
}

export function ProReport({ report: r }: { report: ProReport }) {
  return (
    <article className="mx-auto max-w-page">
      {/* Capa Ink com wordmark Paper */}
      <header className="rounded-lg bg-ink px-6 py-10 text-paper md:px-10 md:py-14">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-display text-xl">
            <span className="font-semibold">The </span>
            <span className="font-bold">Loyal</span>
            <span className="ml-2 rounded-sm bg-green-500 px-2 py-0.5 align-middle font-sans text-xs font-bold uppercase tracking-[0.08em] text-ink">
              Pro
            </span>
          </span>
          <span className="font-mono text-xs text-gray-400">{r.period}</span>
        </div>
        <h1 className="mt-6 max-w-content font-display text-3xl font-bold leading-tight md:text-4xl">
          {r.title}
        </h1>
        <p className="mt-4 font-mono text-xs text-gray-400">
          Material analítico executivo · TL Score médio {r.tlScorePeriod.average} · {r.tlScorePeriod.sampled} oportunidades
        </p>
      </header>

      <div className="mt-12 space-y-14">
        {/* 1. Sumário executivo */}
        <section>
          <SectionLabel>Sumário executivo</SectionLabel>
          <ul className="space-y-3">
            {r.summary.map((s, i) => (
              <li key={i} className="border-l-2 border-ink pl-4 text-lg leading-snug">
                {s}
              </li>
            ))}
          </ul>
        </section>

        {/* 2. TL Score do período */}
        <section>
          <SectionLabel>TL Score do período</SectionLabel>
          <div className="flex flex-wrap items-end gap-8">
            <div>
              <div className="font-mono text-5xl font-semibold tabular-nums">{r.tlScorePeriod.average}</div>
              <div className="mt-1 text-sm text-gray-500">média · {r.tlScorePeriod.sampled} avaliadas</div>
            </div>
            <ul className="flex flex-1 flex-wrap gap-x-6 gap-y-2">
              {r.tlScorePeriod.distribution.map((d) => (
                <li key={d.verdict} className="flex items-center gap-2">
                  {d.verdict === "nao-confirmado" ? (
                    <TLBadge verdict="nao-confirmado" />
                  ) : (
                    <span className="text-sm text-gray-500">{VERDICT_LABEL[d.verdict]}</span>
                  )}
                  <span className="font-mono text-sm tabular-nums">×{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
          {r.tlScorePeriod.note && <p className="mt-4 text-sm text-gray-500">{r.tlScorePeriod.note}</p>}
        </section>

        {/* 3. Benchmarks */}
        <section>
          <SectionLabel>Benchmarks</SectionLabel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.06em] text-gray-500">
                  <th className="py-2 pr-4 font-semibold">Categoria</th>
                  <th className="py-2 pr-4 font-semibold">Métrica</th>
                  <th className="py-2 pr-4 text-right font-semibold">Baixo</th>
                  <th className="py-2 pr-4 text-right font-semibold">Normal</th>
                  <th className="py-2 text-right font-semibold">Alto</th>
                </tr>
              </thead>
              <tbody>
                {r.benchmarks.map((b, i) => (
                  <tr key={i} className="border-b border-line align-top odd:bg-paper-dark/40">
                    <td className="py-3 pr-4">
                      {b.category}
                      {b.note && <span className="mt-1 block text-xs text-gray-400">{b.note}</span>}
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-500">
                      {b.metric}
                      <span className="block font-mono text-xs text-gray-400">{b.unit}</span>
                    </td>
                    <td className="py-3 pr-4 text-right text-green-600">{num(b.low)}</td>
                    <td className="py-3 pr-4 text-right">{num(b.normal)}</td>
                    <td className="py-3 text-right text-red-600">{num(b.high)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Movimentos por player */}
        <section>
          <SectionLabel>Movimentos por player</SectionLabel>
          <ul className="divide-y divide-line border-y border-line">
            {r.players.map((p, i) => (
              <li key={i} className="grid gap-2 py-4 md:grid-cols-[10rem_1fr]">
                <div className="flex items-start gap-2">
                  <span className="font-semibold">{p.player}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.06em] ${SIGNAL_STYLE[p.signal]}`}>
                    {p.signal}
                  </span>
                </div>
                <div>
                  <p className="text-base">{p.move}</p>
                  <p className="mt-1 text-sm text-gray-500">{p.reading}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 5. Matriz competitiva */}
        <section>
          <SectionLabel>Matriz competitiva</SectionLabel>
          <p className="mb-3 font-mono text-xs text-gray-400">
            X: {r.matrix.x} · Y: {r.matrix.y}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.06em] text-gray-500">
                  <th className="py-2 pr-4 font-semibold">Player</th>
                  <th className="py-2 pr-4 font-semibold">{r.matrix.x}</th>
                  <th className="py-2 pr-4 font-semibold">{r.matrix.y}</th>
                  <th className="py-2 font-semibold">Leitura</th>
                </tr>
              </thead>
              <tbody>
                {r.matrix.rows.map((row, i) => (
                  <tr key={i} className="border-b border-line odd:bg-paper-dark/40">
                    <td className="py-3 pr-4 font-semibold">{row.player}</td>
                    <td className="py-3 pr-4 font-mono text-sm">{row.x}</td>
                    <td className="py-3 pr-4 font-mono text-sm">{row.y}</td>
                    <td className="py-3 text-sm text-gray-500">{row.quadrant}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 6. Implicações para mercado */}
        <section>
          <SectionLabel>Implicações para o mercado</SectionLabel>
          <ul className="list-inside list-decimal space-y-2 text-base leading-relaxed">
            {r.implications.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>

        {/* 7. Alertas */}
        <section>
          <SectionLabel>Alertas</SectionLabel>
          <ul className="space-y-3">
            {r.alerts.map((a, i) => (
              <li key={i} className={`border-l-[3px] bg-paper-dark/40 py-2 pl-4 pr-3 text-base ${ALERT_STYLE[a.level]}`}>
                <span className="mr-2 font-mono text-xs uppercase tracking-[0.06em] text-gray-500">{a.level}</span>
                {a.text}
              </li>
            ))}
          </ul>
        </section>

        {/* 8. O que monitorar */}
        <section>
          <SectionLabel>O que monitorar</SectionLabel>
          <ul className="list-inside list-disc space-y-2 text-base leading-relaxed">
            {r.watch.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>

        {/* 9. Fontes */}
        <section>
          <SectionLabel>Fontes</SectionLabel>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            {r.sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} rel="nofollow noopener" className="text-blue-600 underline underline-offset-2 hover:text-blue-700">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* 10. Disclaimer */}
        <p className="border-t border-line pt-4 text-xs leading-relaxed text-gray-400">
          {r.illustrative && "Relatório ilustrativo. Números de exemplo. "}
          {r.disclaimer} O The Loyal Pro não usa dados internos de empresas nem CMI, e não é
          recomendação financeira personalizada.
        </p>
      </div>
    </article>
  );
}
