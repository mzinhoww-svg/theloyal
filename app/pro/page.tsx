import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Nav } from "@/components/shell";
import { SectionLabel } from "@/components/ui";
import { listProReports } from "@/lib/pro";

export const metadata: Metadata = {
  title: "The Loyal Pro — Relatórios executivos",
  description: "Benchmark, radar e matriz competitiva do mercado de loyalty.",
};

export default function ProIndex() {
  const reports = listProReports();
  return (
    <>
      <Nav />
      <main id="conteudo" className="tl-section">
        <div className="tl-container max-w-content">
          <SectionLabel>The Loyal Pro</SectionLabel>
          <h1 className="font-display text-3xl font-semibold leading-tight md:text-4xl">
            Relatórios executivos do mercado de loyalty
          </h1>
          <p className="mt-3 text-lg text-gray-500">
            Benchmark, movimentos por player, matriz competitiva e alertas. Material analítico,
            não editorial.
          </p>
          <ul className="mt-10 divide-y divide-line border-t border-line">
            {reports.map((r) => (
              <li key={r.periodId}>
                <Link
                  href={`/pro/${r.periodId}`}
                  className="flex min-h-11 flex-col gap-1 py-4 hover:bg-paper-dark/60 sm:flex-row sm:items-baseline sm:justify-between"
                >
                  <span className="font-display text-lg font-semibold">{r.title}</span>
                  <span className="font-mono text-xs text-gray-500">
                    {r.period} · TL {r.tlScorePeriod.average}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <Footer />
    </>
  );
}
