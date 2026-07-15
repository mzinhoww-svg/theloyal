import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Nav } from "@/components/shell";
import { SectionLabel } from "@/components/ui";
import { listEditions } from "@/lib/editions";

export const metadata: Metadata = {
  title: "Edições enviadas — The Loyal",
  description:
    "Arquivo do The Loyal Daily: leia na web todas as edições já enviadas, com a conta feita e o veredito de cada oferta.",
};

export default function ArquivoPage() {
  const editions = listEditions();
  return (
    <>
      <Nav />
      <main id="conteudo" className="tl-section">
        <div className="tl-container max-w-content">
          <SectionLabel>Edições enviadas</SectionLabel>
          <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">
            Todas as edições, para consultar quando quiser.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-gray-500">
            Cada edição do Daily fica aqui, na íntegra, para você reler a conta e o
            veredito. Perdeu uma? É só abrir.
          </p>

          {editions.length === 0 ? (
            <p className="mt-10 rounded border border-dashed border-line bg-paper-dark px-5 py-8 text-center text-base text-gray-500">
              Nenhuma edição publicada ainda. A primeira chega em breve, às 8h.
            </p>
          ) : (
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
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
