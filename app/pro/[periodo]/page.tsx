import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProReport } from "@/components/ProReport";
import { Footer, Nav } from "@/components/shell";
import { getProReport, listProReports } from "@/lib/pro";

export function generateStaticParams() {
  return listProReports().map((r) => ({ periodo: r.periodId }));
}

export function generateMetadata({ params }: { params: { periodo: string } }): Metadata {
  const r = getProReport(params.periodo);
  if (!r) return { title: "Relatório não encontrado — The Loyal Pro" };
  return {
    title: `The Loyal Pro — ${r.period}`,
    description: r.title,
  };
}

export default function ProPage({ params }: { params: { periodo: string } }) {
  const report = getProReport(params.periodo);
  if (!report) notFound();
  return (
    <>
      <div className="tl-noprint">
        <Nav />
      </div>
      <main id="conteudo" className="tl-section">
        <div className="tl-container">
          <ProReport report={report} />
        </div>
      </main>
      <div className="tl-noprint">
        <Footer />
      </div>
    </>
  );
}
