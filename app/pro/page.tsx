import type { Metadata } from "next";
import Link from "next/link";
import { ProWaitlist } from "@/components/ProWaitlist";
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

          <section className="mt-20 border-t border-line pt-12">
            <SectionLabel>Grátis e Pro</SectionLabel>
            <h2 className="font-display text-2xl font-semibold leading-tight md:text-3xl">
              O diário continua de graça. O Pro é a profundidade.
            </h2>
            <p className="mt-3 max-w-content text-base leading-relaxed text-gray-500">
              A leitura de todo dia às 8h não muda e não some atrás de paywall. O Pro
              não trava o que já é seu — ele abre o que hoje você não vê: o histórico,
              o mercado inteiro e a comparação.
            </p>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded border border-line bg-surface p-6">
                <h3 className="font-display text-xl font-semibold">Sempre grátis</h3>
                <ul className="mt-3 space-y-2 text-base leading-relaxed text-gray-500">
                  <li className="border-t border-line pt-2">O sinal do dia</li>
                  <li className="border-t border-line pt-2">Uma oferta analisada com a conta feita</li>
                  <li className="border-t border-line pt-2">O veredito e o TL Score</li>
                </ul>
              </div>
              <div className="rounded border border-ink bg-surface p-6">
                <h3 className="font-display text-xl font-semibold">No Pro</h3>
                <ul className="mt-3 space-y-2 text-base leading-relaxed text-gray-500">
                  <li className="border-t border-line pt-2">Histórico de custo por milheiro por categoria</li>
                  <li className="border-t border-line pt-2">Radar de todas as ofertas vigentes, ranqueadas</li>
                  <li className="border-t border-line pt-2">Benchmarks e alertas por perfil</li>
                </ul>
              </div>
            </div>

            <div className="mt-10 max-w-content rounded border border-line bg-paper-dark p-6 sm:p-8">
              <h3 className="font-display text-xl font-semibold">
                Entre na lista do Pro
              </h3>
              <p className="mt-2 text-base leading-relaxed text-gray-500">
                O Pro está em beta fechado. Diga o seu perfil e avisamos quando abrir a
                vaga certa para você.
              </p>
              <div className="mt-6">
                <ProWaitlist />
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
