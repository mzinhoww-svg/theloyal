import type { Edition } from "@/lib/editions";
import { ContaBlock, SectionLabel, TLBadge } from "./ui";

// Página web da edição a partir do mesmo JSON do e-mail/plain. Usa os tokens
// e componentes canônicos da marca (nada de hex em componente).
export function EditionArticle({ edition: ed }: { edition: Edition }) {
  return (
    <article className="mx-auto max-w-content">
      <header className="border-b-4 border-double border-ink pb-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-display text-2xl">
            <span className="font-semibold">The </span>
            <span className="font-bold">Loyal</span>
          </span>
          <span className="font-mono text-xs text-gray-500">Nº {ed.number}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-4 font-mono text-xs text-gray-400">
          <span>
            {ed.weekday} · {ed.publishTime}
          </span>
          <span>LEITURA DE {ed.readingMinutes} MIN</span>
        </div>
      </header>

      <h1 className="sr-only">
        The Loyal Nº {ed.number} — {ed.subject ?? "Edição do Daily"}
      </h1>

      <div className="mt-8 space-y-10">
        <section aria-labelledby="sinal">
          <SectionLabel>O sinal do dia</SectionLabel>
          <blockquote className="border-l-[3px] border-blue-600 pl-5">
            <p id="sinal" className="text-lg leading-relaxed">
              {ed.signal}
            </p>
          </blockquote>
        </section>

        {ed.deals.map((d, i) => (
          <section key={i}>
            <SectionLabel>Deal Desk</SectionLabel>
            <div className="rounded border border-line p-5">
              <p className="font-mono text-xs uppercase tracking-[0.06em] text-gray-400">
                {d.category}
              </p>
              <h2 className="mt-2 font-display text-xl font-semibold">{d.title}</h2>
              <p className="mt-2 text-base leading-relaxed text-gray-500">{d.context}</p>
              <div className="mt-5">
                <ContaBlock
                  ariaLabel={`Conta feita: ${d.title}`}
                  rows={d.conta.rows}
                  result={d.conta.result}
                />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {d.verdict === "nao-confirmado" ? (
                  <TLBadge verdict="nao-confirmado" />
                ) : (
                  <TLBadge verdict={d.verdict} score={d.tlScore ?? 0} />
                )}
                {d.verdictNote && (
                  <span className="text-sm font-semibold">{d.verdictNote}</span>
                )}
              </div>
              <p className="mt-3 text-sm text-gray-500">
                Fonte:{" "}
                {d.sourceUrl ? (
                  <a
                    href={d.sourceUrl}
                    className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
                    rel="nofollow noopener"
                  >
                    {d.source}
                  </a>
                ) : (
                  d.source
                )}
              </p>
            </div>
          </section>
        ))}

        {ed.fechaLogo && ed.fechaLogo.length > 0 && (
          <section>
            <SectionLabel>Fecha logo</SectionLabel>
            <ul className="space-y-3">
              {ed.fechaLogo.map((f, i) => (
                <li key={i} className="text-base leading-relaxed">
                  <span className="mr-2 inline-block rounded-sm bg-yellow-500 px-2 py-0.5 text-xs font-semibold text-ink">
                    {f.tag}
                  </span>
                  {f.text}{" "}
                  {f.cpm && <span className="font-mono text-sm">{f.cpm}</span>} {f.note}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <SectionLabel>Fontes</SectionLabel>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            {ed.sources.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
                  rel="nofollow noopener"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <p className="border-t border-line pt-4 text-xs leading-relaxed text-gray-400">
          {ed.illustrative && "Edição ilustrativa. Números de exemplo. "}
          {ed.disclaimer}
        </p>
      </div>
    </article>
  );
}
