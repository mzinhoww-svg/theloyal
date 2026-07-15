import type { Metadata } from "next";
import { AnuncieForm } from "@/components/AnuncieForm";
import { Footer, Nav } from "@/components/shell";
import { SectionLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Anuncie no The Loyal",
  description:
    "Alcance leitores que decidem sobre pontos, milhas, cartões e cashback. Patrocínio sempre sinalizado, dentro de uma mídia independente de loyalty.",
};

const PERFIS = [
  ["Consumidor que decide", "Avalia cartão, cashback e programa antes de mudar de hábito."],
  ["Heavy user de pontos", "Acompanha bônus, milheiro, timing e vigência de perto."],
  ["Alta renda", "Decide anuidade, sala VIP e benefício sem depender do gerente."],
  ["Profissional de loyalty", "Bancos, companhias e varejo lendo o mercado como estratégia."],
] as const;

const FORMATOS = [
  ["Patrocínio da edição", "Uma marca por edição, sinalizada antes do conteúdo. Sem publieditorial disfarçado."],
  ["Presença no Lab", "Associação a um guia evergreen, que segue sendo lido depois da veiculação."],
  ["Ações sob medida", "Estudos, pesquisas e recortes de mercado — sempre com a independência editorial preservada."],
] as const;

export default function AnunciePage() {
  return (
    <>
      <Nav />
      <main id="conteudo" className="tl-section">
        <div className="tl-container">
          <div className="max-w-content">
            <SectionLabel>Anuncie</SectionLabel>
            <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">
              Fale com quem decide sobre pontos e milhas.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-gray-500">
              O The Loyal é lido por gente que compara, calcula e decide onde colocar
              o próprio dinheiro em loyalty. Se a sua marca quer estar perto dessa
              decisão, é aqui — dentro de uma mídia independente, com o patrocínio
              sempre marcado.
            </p>
          </div>

          <section className="mt-16">
            <h2 className="font-display text-2xl font-semibold">Quem lê</h2>
            <div className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {PERFIS.map(([nome, desc]) => (
                <div key={nome} className="border-t-2 border-ink pt-4">
                  <h3 className="text-base font-semibold">{nome}</h3>
                  <p className="mt-2 text-base leading-relaxed text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <h2 className="font-display text-2xl font-semibold">Formatos</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {FORMATOS.map(([nome, desc]) => (
                <div key={nome} className="flex h-full flex-col rounded border border-line bg-surface p-6">
                  <h3 className="font-display text-xl font-semibold">{nome}</h3>
                  <p className="mt-3 text-base leading-relaxed text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <h2 className="font-display text-2xl font-semibold">
              Nossa regra de independência
            </h2>
            <p className="mt-3 max-w-content text-base leading-relaxed text-gray-500">
              Publicidade nunca se disfarça de análise. Todo patrocínio vem
              identificado antes do conteúdo, e nenhum anunciante revisa, aprova ou
              influencia o que escrevemos. É o que dá valor ao espaço: o leitor confia
              porque sabe separar uma coisa da outra.
            </p>
          </section>

          <section className="mt-16 max-w-content rounded border border-line bg-paper-dark p-6 sm:p-8">
            <h2 className="font-display text-2xl font-semibold">
              Peça o media kit
            </h2>
            <p className="mt-2 text-base leading-relaxed text-gray-500">
              Deixe seu contato e o objetivo da campanha. Retornamos com audiência,
              formatos e valores.
            </p>
            <div className="mt-6">
              <AnuncieForm />
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
