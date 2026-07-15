import type { Metadata } from "next";
import { listPublishedEditions } from "@/lib/beehiiv-editions";
import { Footer, Nav } from "@/components/shell";
import { SectionLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Edições enviadas — The Loyal",
  description:
    "Arquivo do The Loyal Daily: leia na web todas as edições já enviadas, com a conta feita e o veredito de cada oferta.",
};

// ISR: a lista é buscada no Beehiiv e revalidada de hora em hora.
export const revalidate = 3600;

function formatarData(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export default async function ArquivoPage() {
  const editions = await listPublishedEditions();
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
            Cada edição do Daily fica registrada aqui. Perdeu uma? É só abrir e ler
            na íntegra, com a conta e o veredito.
          </p>

          {editions.length === 0 ? (
            <p className="mt-10 rounded border border-dashed border-line bg-paper-dark px-5 py-8 text-center text-base text-gray-500">
              As edições aparecem aqui assim que são publicadas. Se você já publicou
              e nada aparece, confirme as credenciais do Beehiiv no ambiente.
            </p>
          ) : (
            <ul className="mt-10 divide-y divide-line border-t border-line">
              {editions.map((e) => (
                <li key={e.id}>
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 flex-col gap-1 py-4 hover:bg-paper-dark/60"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                      <span className="font-display text-lg font-semibold">
                        {e.title}
                      </span>
                      {e.date && (
                        <span className="shrink-0 font-mono text-xs text-gray-500">
                          {formatarData(e.date)}
                        </span>
                      )}
                    </div>
                    {e.subtitle && (
                      <span className="text-base leading-relaxed text-gray-500">
                        {e.subtitle}
                      </span>
                    )}
                  </a>
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
