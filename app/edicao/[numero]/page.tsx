import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditionArticle } from "@/components/EditionArticle";
import { Footer, Nav } from "@/components/shell";
import { getEdition, listEditions } from "@/lib/editions";

export function generateStaticParams() {
  return listEditions().map((e) => ({ numero: String(e.number) }));
}

export function generateMetadata({
  params,
}: {
  params: { numero: string };
}): Metadata {
  const ed = getEdition(Number(params.numero));
  if (!ed) return { title: "Edição não encontrada — The Loyal" };
  return {
    title: `The Loyal Nº ${ed.number} — ${ed.subject ?? "Daily"}`,
    description: ed.preheader ?? ed.signal.slice(0, 150),
  };
}

export default function EdicaoPage({ params }: { params: { numero: string } }) {
  const ed = getEdition(Number(params.numero));
  if (!ed) notFound();
  return (
    <>
      <Nav />
      <main id="conteudo" className="tl-section">
        <div className="tl-container">
          <EditionArticle edition={ed} />
        </div>
      </main>
      <Footer />
    </>
  );
}
