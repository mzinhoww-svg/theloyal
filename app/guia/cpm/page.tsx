import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Nav } from "@/components/shell";
import { SubscribeForm } from "@/components/SubscribeForm";
import { ContaBlock, SectionLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Como calcular o CPM antes de comprar pontos — The Loyal",
  description:
    "O guia curto do custo por milheiro (CPM): a fórmula, três exemplos com a conta feita e como saber se a promoção vale a pena antes de gastar.",
};

export default function GuiaCpmPage() {
  return (
    <>
      <Nav />
      <main id="conteudo" className="tl-section">
        <div className="tl-container max-w-content">
          <SectionLabel>Guia · custo por milheiro</SectionLabel>
          <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">
            Como saber se pontos estão caros — antes de comprar.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-gray-500">
            Toda promoção de pontos se resume a uma pergunta: quanto custa cada mil?
            Esse número tem nome — <strong className="text-ink">CPM, custo por
            milheiro</strong> — e é o que separa oferta boa de banner bonito. Em três
            minutos você aprende a fazer essa conta sozinho.
          </p>

          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold">A fórmula</h2>
            <p className="mt-3 text-base leading-relaxed text-gray-500">
              Divida quanto você pagou pelo total de milhas que recebeu, e multiplique
              por mil. O resultado é o preço de cada milheiro.
            </p>
            <p className="mt-4 inline-block rounded-sm bg-paper-dark px-4 py-2 font-mono text-sm text-gray-700">
              CPM = R$ pago ÷ (milhas ÷ 1.000)
            </p>
          </section>

          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold">
              A mesma promoção, três contas
            </h2>
            <p className="mt-3 text-base leading-relaxed text-gray-500">
              &quot;Bônus de 110%&quot; parece uma coisa só. Mas o caminho que você escolhe
              muda o preço final. Veja a mesma transferência de 40.000 pontos por três
              rotas.
            </p>

            <div className="mt-6 space-y-6">
              <div>
                <p className="mb-2 font-mono text-xs uppercase tracking-[0.06em] text-gray-500">
                  1 · Compra direta, sem bônus
                </p>
                <ContaBlock
                  ariaLabel="Compra direta sem bônus"
                  rows={[
                    ["custo", "R$ 1.360,00"],
                    ["milhas", "40.000"],
                  ]}
                  result={["CPM", "R$ 34,00 /milheiro"]}
                />
              </div>

              <div>
                <p className="mb-2 font-mono text-xs uppercase tracking-[0.06em] text-gray-500">
                  2 · Com bônus de 110%
                </p>
                <ContaBlock
                  ariaLabel="Com bônus de 110 por cento"
                  rows={[
                    ["custo", "R$ 1.360,00"],
                    ["milhas + bônus", "84.000"],
                  ]}
                  result={["CPM", "R$ 16,19 /milheiro"]}
                />
              </div>

              <div>
                <p className="mb-2 font-mono text-xs uppercase tracking-[0.06em] text-gray-500">
                  3 · Bônus sem o clube (ativação esquecida)
                </p>
                <ContaBlock
                  ariaLabel="Bônus sem o clube"
                  rows={[
                    ["custo", "R$ 1.360,00"],
                    ["milhas + bônus menor", "71.000"],
                  ]}
                  result={["CPM", "R$ 19,15 /milheiro"]}
                />
              </div>
            </div>

            <p className="mt-6 max-w-content text-sm leading-relaxed text-gray-500">
              O banner mostrava só &quot;110%&quot;. A conta mostra que esquecer a ativação do
              clube encarece o milheiro em 18%. Números ilustrativos para ensinar a
              conta — confira sempre as regras oficiais antes de agir.
            </p>
          </section>

          <section className="mt-12">
            <h2 className="font-display text-2xl font-semibold">
              Como ler o resultado
            </h2>
            <ul className="mt-4 space-y-3 text-base leading-relaxed text-gray-500">
              <li className="border-t-2 border-ink pt-3">
                <strong className="text-ink">CPM baixo</strong> não é sinônimo de
                bom. Só vale se você <em>vai usar</em> essas milhas por algo que valha
                mais do que elas custaram.
              </li>
              <li className="border-t border-line pt-3">
                Compare o CPM com o <strong className="text-ink">valor por milheiro
                (VPM)</strong> — quanto mil milhas valem na hora de usar. Se o VPM é
                maior que o CPM, há margem. Se é menor, você pagou caro.
              </li>
              <li className="border-t border-line pt-3">
                Faltou algum dado da promoção? Então o veredito é um só:{" "}
                <strong className="text-ink">não dá pra confirmar</strong>. Não chute.
              </li>
            </ul>
          </section>

          <section className="mt-16 rounded border border-line bg-paper-dark p-6 sm:p-8">
            <h2 className="font-display text-2xl font-semibold">
              Não quer fazer essa conta todo dia?
            </h2>
            <p className="mt-2 text-base leading-relaxed text-gray-500">
              É exatamente isso que o The Loyal faz por você. Toda manhã, a promoção do
              dia chega com o CPM já calculado e o veredito pronto. De graça.
            </p>
            <div className="mt-6 max-w-xl">
              <SubscribeForm submitLabel="Quero receber grátis" source="guia-cpm" />
            </div>
          </section>

          <p className="mt-10">
            <Link
              href="/#assinar"
              className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
            >
              Voltar para a página inicial
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
