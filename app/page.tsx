import { EdicaoMock } from "@/components/EdicaoMock";
import {
  CTAFinal,
  ComoAnalisamos,
  Metodo,
  ParaQuem,
  Problema,
  Recebe,
} from "@/components/sections";
import Link from "next/link";
import { Footer, Hero, Nav, StickyCTA } from "@/components/shell";
import { Reveal, SectionLabel } from "@/components/ui";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="conteudo">
        <Hero />
        <Problema />
        <Metodo />
        <Recebe />
        <section id="edicao" className="tl-section border-b border-line bg-paper-dark">
          <div className="tl-container">
            <Reveal>
              <SectionLabel>Uma edição por dentro</SectionLabel>
              <h2 className="max-w-content font-display text-3xl font-semibold leading-tight md:text-4xl">
                Assim chega na sua caixa de entrada.
              </h2>
              <p className="mt-3 max-w-content text-lg text-gray-500">
                Sinal do dia, Deal Desk com a conta aberta e o veredito do TL Score.
                Sem rodeio, sem caça-clique.
              </p>
            </Reveal>
            <Reveal className="mt-10">
              <EdicaoMock />
            </Reveal>
            <Reveal className="mt-6">
              <Link
                href="/edicao"
                className="inline-flex min-h-11 items-center text-base font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
              >
                Ver edições reais no arquivo
              </Link>
            </Reveal>
          </div>
        </section>
        <ParaQuem />
        <ComoAnalisamos />
        <CTAFinal />
        <section id="glossario" className="tl-section border-t border-line">
          <div className="tl-container">
            <Reveal>
              <SectionLabel>Se aparecer um termo técnico, ele está explicado aqui</SectionLabel>
              <h2 className="max-w-content font-display text-3xl font-semibold leading-tight md:text-4xl">
                Mini-glossário
              </h2>
            </Reveal>
            <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {[
                ["Milheiro", "Mil pontos ou mil milhas. É a unidade usada pra comparar preços."],
                ["CPM (custo por milheiro)", "Quanto você paga, em reais, por cada mil pontos, já com todas as taxas."],
                ["Transferência com bônus", "Mover pontos de um programa pra outro ganhando um extra. Ex.: transferiu 10 mil, recebeu 21 mil (bônus de 110%)."],
                ["Acumular (fazer estoque)", "Juntar pontos pra usar no futuro, sem uma viagem marcada."],
                ["Nota (score)", "De 0 a 100. Quanto maior, mais a oferta vale a pena na nossa análise."],
              ].map(([termo, def]) => (
                <Reveal key={termo}>
                  <div className="border-t-2 border-ink pt-4">
                    <dt className="text-base font-semibold">{termo}</dt>
                    <dd className="mt-2 text-base leading-relaxed text-gray-500">{def}</dd>
                  </div>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <Footer />
      <StickyCTA />
    </>
  );
}
