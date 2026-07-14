import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Nav } from "@/components/shell";
import { SectionLabel } from "@/components/ui";
import { listEditions } from "@/lib/editions";

export const metadata: Metadata = {
  title: "Arquivo — The Loyal",
  description: "Edições do The Loyal Daily.",
};

export default function ArquivoPage() {
  const editions = listEditions();
  return (
    <>
      <Nav />
      <main id="conteudo" className="tl-section">
        <div className="tl-container max-w-content">
          <SectionLabel>Arquivo</SectionLabel>
          <h1 className="font-display text-3xl font-semibold leading-tight md:text-4xl">
            Edições do The Loyal Daily
          </h1>
          <ul className="mt-10 divide-y divide-line border-t border-line">
            {editions.map((e) => (
              <li key={e.number}>
                <Link
                  href={`/edicao/${e.number}`}
                  className="flex min-h-11 flex-col gap-1 py-4 hover:bg-paper-dark/60 sm:flex-row sm:items-baseline sm:justify-between"
                >
                  <span className="font-display text-lg font-semibold">
                    Nº {e.number} — {e.subject ?? "Edição do Daily"}
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {e.weekday} · {e.date}
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
