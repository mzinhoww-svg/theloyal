import { EdicaoMock } from "@/components/EdicaoMock";
import {
  CTAFinal,
  ComoAnalisamos,
  Metodo,
  ParaQuem,
  Problema,
  Recebe,
} from "@/components/sections";
import { Footer, Hero, Nav } from "@/components/shell";
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
          </div>
        </section>
        <ParaQuem />
        <ComoAnalisamos />
        <CTAFinal />
      </main>
      <Footer />
    </>
  );
}
