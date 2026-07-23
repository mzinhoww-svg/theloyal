// /promocoes — placar de janelas (track record) por rota + banco por programa +
// ofertas vivas. M3/D-059 (benchmark milhasbot, adaptado à marca). Server
// Component: lê o banco vivo via lib/admin-db (server-only, service key,
// degrada para lista vazia). Camada de dado = views vw_placar_rota /
// vw_banco_programa (Trilha B: historico_confirmado + limpo). Predict degrada
// gracioso ("sem previsão ainda") — nunca número inventado (INV-03/INV-25).
import type { Metadata } from "next";
import { Footer, Nav } from "@/components/shell";
import { SectionLabel } from "@/components/ui";
import { rest } from "@/lib/admin-db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Promoções — The Loyal",
  description:
    "O placar de bônus por rota: quantas janelas já ocorreram, a faixa típica e o teto histórico. Dado do ledger, com a conta feita.",
};

type PlacarRota = {
  origem_code: string;
  destino_code: string;
  n_janelas: number;
  pct_min: number | null;
  pct_max: number | null;
  pct_mediana: number | null;
  teto_historico: number | null;
  teto_datado_ate: string | null;
};

type BancoPrograma = {
  programa: string;
  n_campanhas: number;
  n_vivas: number;
  pct_max: number | null;
  pct_mediana: number | null;
  proxima_vigencia: string | null;
};

type Oferta = {
  id: string;
  origem_code: string | null;
  destino_code: string | null;
  tipo: string;
  percentual: number | null;
  vigencia_fim_date: string | null;
  estado: string;
};

const nomePrograma = (code: string | null): string => {
  if (!code || code === "sem_destino") return "—";
  return code
    .split("_")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
};

const rota = (o: { origem_code: string | null; destino_code: string | null; tipo?: string }): string => {
  const origem = nomePrograma(o.origem_code);
  // compra/clube e lado-único exibem o próprio programa (nunca "sem destino").
  const destino =
    !o.destino_code || o.destino_code === "sem_destino" ? origem : nomePrograma(o.destino_code);
  return `${origem} → ${destino}`;
};

const pct = (n: number | null): string => (n === null || n === undefined ? "—" : `${n}%`);
const faixa = (lo: number | null, hi: number | null): string =>
  lo === null || hi === null ? "—" : lo === hi ? `${lo}%` : `${lo}–${hi}%`;
const diaMes = (iso: string | null): string => {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
};

const DISCLAIMER =
  "Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de comprar, transferir ou resgatar.";

export default async function PromocoesPage() {
  const [placar, banco, ofertas] = await Promise.all([
    rest<PlacarRota>("vw_placar_rota?order=n_janelas.desc&limit=24"),
    rest<BancoPrograma>("vw_banco_programa?n_vivas=gt.0&order=n_vivas.desc,n_campanhas.desc&limit=40"),
    // Ofertas vivas TRIADAS (vw_ofertas_vivas): só limpo/historico_confirmado. NUNCA
    // campaigns direto — isso surfacializaria revisao/não-triado (não confirmado) no
    // topo público, violando INV-03 (C3). A view já filtra estado+percentual+triagem.
    rest<Oferta>(
      "vw_ofertas_vivas?select=id,origem_code,destino_code,tipo,percentual,vigencia_fim_date,estado&order=percentual.desc&limit=20",
    ),
  ]);

  const semDados = placar.length === 0 && banco.length === 0 && ofertas.length === 0;

  return (
    <>
      <Nav />
      <main id="conteudo" className="tl-section">
        <div className="tl-container max-w-content">
          <SectionLabel>Promoções</SectionLabel>
          <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">
            O placar das janelas de bônus.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-500">
            Quantas vezes cada rota já bonificou, a faixa típica e o teto histórico —
            do ledger, não de palpite. Onde há previsão, ela vem em banda de
            probabilidade; onde não há base, dizemos que não há.
          </p>

          {semDados && (
            <p className="mt-10 border-t-2 border-line pt-4 text-base text-gray-500">
              Dados do placar indisponíveis no momento.
            </p>
          )}

          {/* 1. Ofertas ativas */}
          {ofertas.length > 0 && (
            <section className="mt-14" aria-labelledby="ativas">
              <h2 id="ativas" className="font-display text-2xl font-semibold">
                Ofertas ativas
              </h2>
              <p className="mt-2 text-base text-gray-500">
                O que está no ar agora, por bônus. A confirmação e a conta TL saem por
                oferta na análise.
              </p>
              <ul className="mt-6 divide-y divide-line border-t border-line">
                {ofertas.map((o) => (
                  <li key={o.id} className="flex items-baseline justify-between gap-4 py-3">
                    <span className="text-base text-ink">{rota(o)}</span>
                    <span className="shrink-0 font-mono text-sm text-ink">{pct(o.percentual)}</span>
                    <span className="hidden shrink-0 font-mono text-xs text-gray-500 sm:inline">
                      vence {diaMes(o.vigencia_fim_date)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 2. Placar histórico por rota */}
          {placar.length > 0 && (
            <section className="mt-14" aria-labelledby="placar">
              <h2 id="placar" className="font-display text-2xl font-semibold">
                Placar histórico por rota
              </h2>
              <p className="mt-2 text-base text-gray-500">
                Cada rota, com quantas janelas já registramos, a faixa típica de bônus e
                o teto histórico datado.
              </p>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[36rem] border-t border-line text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-[0.08em] text-gray-500">
                      <th className="py-2 font-semibold">Rota</th>
                      <th className="py-2 text-right font-semibold">Janelas</th>
                      <th className="py-2 text-right font-semibold">Mediana</th>
                      <th className="py-2 text-right font-semibold">Faixa</th>
                      <th className="py-2 text-right font-semibold">Teto histórico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placar.map((r) => (
                      <tr key={`${r.origem_code}-${r.destino_code}`} className="border-t border-line">
                        <td className="py-3 pr-4 text-sm text-ink">{rota(r)}</td>
                        <td className="py-3 text-right font-mono text-sm text-ink">{r.n_janelas}</td>
                        <td className="py-3 text-right font-mono text-sm text-ink">{pct(r.pct_mediana)}</td>
                        <td className="py-3 text-right font-mono text-sm text-gray-500">
                          {faixa(r.pct_min, r.pct_max)}
                        </td>
                        <td className="py-3 text-right font-mono text-sm text-ink">
                          {pct(r.teto_historico)}
                          {r.teto_datado_ate && (
                            <span className="ml-1 text-xs text-gray-500">({diaMes(r.teto_datado_ate)})</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 3. Banco por programa */}
          {banco.length > 0 && (
            <section className="mt-14" aria-labelledby="banco">
              <h2 id="banco" className="font-display text-2xl font-semibold">
                Banco por programa
              </h2>
              <p className="mt-2 text-base text-gray-500">
                Cada programa, com o histórico conhecido e o que segue vivo hoje.
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {banco.map((b) => (
                  <li key={b.programa} className="rounded-lg border border-line bg-surface px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-base font-semibold text-ink">{nomePrograma(b.programa)}</span>
                      <span className="font-mono text-xs text-gray-500">
                        <span className="text-green-700">{b.n_vivas}</span> viva(s) · {b.n_campanhas} no total
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-xs text-gray-500">
                      mediana {pct(b.pct_mediana)} · teto {pct(b.pct_max)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Predict — degradação graciosa (sem contrato de janelas alta hoje). */}
          <section className="mt-14" aria-labelledby="predict">
            <h2 id="predict" className="font-display text-2xl font-semibold">
              Predict
            </h2>
            <p className="mt-2 max-w-2xl text-base text-gray-500">
              Quando há base histórica suficiente, o Predict indica a probabilidade de
              uma nova janela — baixa, média ou alta. Sem base, não há previsão: nenhuma
              rota tem janela de alta confiança em aberto no momento.
            </p>
          </section>

          <p className="mt-16 border-t border-line pt-6 text-sm leading-relaxed text-gray-500">
            {DISCLAIMER}
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
