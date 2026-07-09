/* Web archive do The Loyal Daily em componentes React.
   Usa os tokens oficiais via Tailwind e as fontes do app (Fraunces/Inter/JetBrains Mono).
   Renderiza a mesma estrutura de 19 secoes do e-mail, em layout de pagina. */
import type { ReactNode } from "react";

export type Verdict =
  | "vale-agir" | "vale-olhar" | "depende" | "esperaria" | "nao-vale" | "evitaria" | "nao-confirmado";

export interface Deal {
  tag?: string; titulo?: string; texto?: string;
  veredito?: Verdict | string; veredito_nota?: string; vigencia?: string; vigencia_iso?: string;
}
export type RowItem = string | { destaque?: string; texto?: string };
export interface Edition {
  meta?: { numero?: number | string; data_label?: string; hora?: string; tempo_leitura?: string; preheader?: string };
  abertura?: string; antes_da_conta?: string; na_edicao_de_hoje?: RowItem[];
  sinal_do_dia: string; deal_desk: Deal[];
  conta_feita: { linhas?: string[][]; total?: string[]; nota?: string };
  program_watch?: RowItem[]; bank_cards_watch?: RowItem[]; retail_coalition?: RowItem[];
  loyalty_lab?: { titulo?: string; texto?: string };
  fecha_logo: string; o_que_evitaria: string; sinais_rapidos?: RowItem[];
  sua_leitura?: { perfil?: string; texto?: string }[];
  fontes_metodologia?: string; disclaimer: string;
  footer?: { descricao?: string; assinatura_ponto?: string; links?: Record<string, string> };
}

const VERDICT: Record<string, { label: string; cls: string }> = {
  "vale-agir": { label: "VALE AGIR", cls: "bg-green-100 text-green-700" },
  "vale-olhar": { label: "VALE OLHAR", cls: "bg-green-100 text-green-700" },
  depende: { label: "DEPENDE", cls: "bg-yellow-100 text-yellow-700" },
  esperaria: { label: "ESPERARIA", cls: "bg-yellow-100 text-yellow-700" },
  "nao-vale": { label: "NAO VALE", cls: "bg-red-100 text-red-700" },
  evitaria: { label: "EVITARIA", cls: "bg-red-100 text-red-700" },
  "nao-confirmado": { label: "NAO CONFIRMADO", cls: "bg-paper-dark text-gray-500" },
};

function VerdictChip({ verdict }: { verdict?: string }) {
  const v = VERDICT[(verdict || "").toLowerCase()] ?? { label: (verdict || "SEM VEREDITO").toUpperCase(), cls: "bg-paper-dark text-gray-500" };
  return (
    <span className={`inline-block rounded-sm px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.09em] ${v.cls}`}>
      {v.label}
    </span>
  );
}

function Eyebrow({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "red" | "muted" }) {
  const c = tone === "red" ? "text-red-700" : tone === "muted" ? "text-gray-400" : "text-green-700";
  return <div className={`font-mono text-[11px] font-bold uppercase tracking-[0.16em] ${c}`}>{children}</div>;
}

function Rows({ items }: { items: RowItem[] }) {
  return (
    <ul className="mt-2 list-none p-0">
      {items.map((it, i) => (
        <li key={i} className="border-b border-line py-1.5 last:border-0 text-[15px] leading-snug text-gray-700">
          {typeof it === "object" ? (<><strong className="text-ink">{it.destaque}</strong> {it.texto}</>) : it}
        </li>
      ))}
    </ul>
  );
}

function ContaBlock({ conta }: { conta: Edition["conta_feita"] }) {
  return (
    <div className="overflow-x-auto rounded bg-ink px-5 py-4 font-mono text-[13px] leading-[1.9] text-paper">
      {(conta.linhas || []).map(([k, v], i) => (
        <div key={i}><span className="text-gray-400">{k}&nbsp;&nbsp;</span> {v}</div>
      ))}
      {conta.total && (
        <div className="text-green-500">{conta.total[0]}&nbsp;&nbsp;{conta.total[1]}</div>
      )}
    </div>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface p-5">
      {deal.tag && <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-gray-400">{deal.tag}</div>}
      <h3 className="mt-1.5 font-display text-lg font-semibold text-ink">{deal.titulo}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-gray-500">{deal.texto}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <VerdictChip verdict={deal.veredito} />
        {deal.veredito_nota && <span className="text-sm text-gray-700">{deal.veredito_nota}</span>}
      </div>
      {deal.vigencia && <p className="mt-2 font-mono text-xs text-gray-400">vigencia: {deal.vigencia}</p>}
    </div>
  );
}

function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`border-t border-line py-6 first:border-0 ${className}`}>{children}</section>;
}

export function DailyEdition({ edition }: { edition: Edition }) {
  const m = edition.meta || {};
  const metaLine = [m.numero ? `No ${m.numero}` : "", m.data_label, m.hora, m.tempo_leitura].filter(Boolean).join(" . ");
  return (
    <article className="mx-auto max-w-[680px] px-5 pb-24 font-sans text-gray-700">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-t-4 border-ink py-5">
        <span className="font-display text-2xl text-ink"><span className="font-semibold">The </span><span className="font-bold">Loyal</span></span>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-gray-400">Daily . {metaLine}</span>
      </header>

      {edition.abertura && <Section><p className="text-lg leading-relaxed text-gray-700">{edition.abertura}</p></Section>}
      {edition.antes_da_conta && <Section><Eyebrow>Antes da conta</Eyebrow><p className="mt-2 leading-relaxed text-gray-500">{edition.antes_da_conta}</p></Section>}
      {edition.na_edicao_de_hoje?.length ? <Section><Eyebrow>Na edicao de hoje</Eyebrow><Rows items={edition.na_edicao_de_hoje} /></Section> : null}

      <Section>
        <div className="rounded-lg border border-line bg-paper-dark p-6">
          <Eyebrow>Sinal do dia</Eyebrow>
          <h2 className="mt-2.5 font-display text-2xl font-semibold leading-tight text-ink">{edition.sinal_do_dia}</h2>
        </div>
      </Section>

      <Section>
        <Eyebrow>Deal Desk</Eyebrow>
        {edition.deal_desk.map((d, i) => <DealCard key={i} deal={d} />)}
      </Section>

      <Section>
        <Eyebrow>Conta feita</Eyebrow>
        <div className="mt-2.5"><ContaBlock conta={edition.conta_feita} /></div>
        {edition.conta_feita.nota && <p className="mt-2 text-sm text-gray-400">{edition.conta_feita.nota}</p>}
      </Section>

      {edition.program_watch?.length ? <Section><Eyebrow>Program Watch</Eyebrow><Rows items={edition.program_watch} /></Section> : null}
      {edition.bank_cards_watch?.length ? <Section><Eyebrow>Bank &amp; Cards Watch</Eyebrow><Rows items={edition.bank_cards_watch} /></Section> : null}
      {edition.retail_coalition?.length ? <Section><Eyebrow>Retail &amp; Coalition</Eyebrow><Rows items={edition.retail_coalition} /></Section> : null}

      {edition.loyalty_lab && (
        <Section><Eyebrow>Loyalty Lab</Eyebrow>
          <h3 className="mt-2 font-display text-lg font-semibold text-ink">{edition.loyalty_lab.titulo}</h3>
          <p className="mt-1 leading-relaxed text-gray-500">{edition.loyalty_lab.texto}</p>
        </Section>
      )}

      <Section>
        <div className="rounded-r border-l-4 border-yellow-500 bg-yellow-100 p-4">
          <Eyebrow tone="muted"><span className="text-yellow-700">Fecha logo</span></Eyebrow>
          <p className="mt-1.5 text-gray-700">{edition.fecha_logo}</p>
        </div>
      </Section>

      <Section><Eyebrow tone="red">O que evitaria</Eyebrow><p className="mt-1.5 text-gray-700">{edition.o_que_evitaria}</p></Section>

      {edition.sinais_rapidos?.length ? <Section><Eyebrow>Sinais rapidos</Eyebrow><Rows items={edition.sinais_rapidos} /></Section> : null}

      {edition.sua_leitura?.length ? (
        <Section>
          <div className="rounded-lg border border-line bg-paper-dark p-5">
            <Eyebrow>Sua leitura</Eyebrow>
            <ul className="mt-2 list-none p-0">
              {edition.sua_leitura.map((it, i) => (
                <li key={i} className="py-1.5 text-[15px] leading-snug text-gray-700"><strong className="text-ink">{it.perfil}:</strong> {it.texto}</li>
              ))}
            </ul>
          </div>
        </Section>
      ) : null}

      {edition.fontes_metodologia && <Section><Eyebrow tone="muted">Fontes e metodologia</Eyebrow><p className="mt-1.5 text-sm leading-relaxed text-gray-500">{edition.fontes_metodologia}</p></Section>}

      <Section><p className="text-sm leading-relaxed text-gray-400">{edition.disclaimer}</p></Section>

      <footer className="mt-6 rounded-xl bg-ink p-6 text-gray-400">
        <span className="font-display text-xl text-paper"><span className="font-semibold">The </span><span className="font-bold">Loyal</span></span>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-400">{edition.footer?.descricao || "Midia independente sobre pontos, milhas, cartoes, bancos, varejo e cashback."}</p>
        <p className="mt-3 font-mono text-xs text-gray-500">{edition.footer?.assinatura_ponto || "Ponto leu ate aqui. Amanha as 8h, a conta ja vai estar feita."}</p>
      </footer>
    </article>
  );
}
