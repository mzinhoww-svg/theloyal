import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Nav } from "@/components/shell";
import { SectionLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sobre — The Loyal",
  description:
    "The Loyal é uma mídia independente sobre loyalty, pontos, milhas, cartões, bancos, varejo e cashback. Autoridade pelo método, não pelo tom.",
};

export default function SobrePage() {
  return (
    <>
      <Nav />
      <main id="conteudo" className="tl-section">
        <div className="tl-container max-w-content">
          <SectionLabel>Sobre</SectionLabel>
          <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">
            Uma mídia independente sobre o mercado de loyalty.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-gray-500">
            The Loyal cobre pontos, milhas, cartões, bancos, varejo, cashback e o
            comportamento de consumo por trás deles. Não é blog de cupom, não é
            comunicação oficial de programa, não é vitrine de banco. É análise —
            com a conta aberta.
          </p>

          <div className="mt-12 space-y-10">
            <section>
              <h2 className="font-display text-2xl font-semibold">O que fazemos</h2>
              <p className="mt-3 text-base leading-relaxed text-gray-500">
                Todo dia útil, às 8h, lemos as regras da promoção que importa,
                confirmamos se ela ainda está no ar e calculamos o custo real em
                reais. Você recebe o sinal do dia, a conta feita e um veredito claro:
                vale agir, vale olhar, esperaria ou evitaria — e para qual perfil.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl font-semibold">
                Como somos independentes
              </h2>
              <ul className="mt-3 space-y-3 text-base leading-relaxed text-gray-500">
                <li className="border-t-2 border-ink pt-3">
                  Nenhum banco ou programa paga pela opinião. Ninguém revisa o texto
                  antes de você.
                </li>
                <li className="border-t border-line pt-3">
                  Não usamos dado interno de empresa nem métrica proprietária de
                  programa. Só fonte pública, com o cálculo à mostra.
                </li>
                <li className="border-t border-line pt-3">
                  Quando houver publicidade, ela vem sinalizada antes do conteúdo.
                  Sem exceção.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl font-semibold">
                Por que confiar no método
              </h2>
              <p className="mt-3 text-base leading-relaxed text-gray-500">
                Nossa autoridade vem do método, não do tom. Cada oferta recebe uma
                nota de 0 a 100 (o TL Score), com critérios e pesos declarados. Se
                falta dado para a conta, o veredito é um só: não confirmado. A
                metodologia completa está{" "}
                <Link
                  href="/#como-analisamos"
                  className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
                >
                  na página inicial
                </Link>
                .
              </p>
            </section>
          </div>

          <p className="mt-12 max-w-content border-l-[3px] border-gray-400 bg-paper-dark py-3 pl-5 pr-4 text-sm leading-relaxed text-gray-500">
            Promoções podem mudar sem aviso. Confira sempre as regras no site oficial
            antes de comprar, transferir ou resgatar. O The Loyal não faz recomendação
            financeira personalizada: a decisão final é sempre sua.
          </p>

          <p className="mt-10">
            <Link
              href="/#assinar"
              className="inline-flex min-h-11 items-center rounded bg-green-600 px-4 text-base font-semibold text-paper transition-colors duration-150 hover:bg-green-700"
            >
              Receber grátis, todo dia às 8h
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
