import type { Metadata } from "next";
import { Footer, Nav } from "@/components/shell";
import { SectionLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacidade — The Loyal",
  description:
    "Como o The Loyal coleta, usa e protege seu e-mail. Consentimento, finalidade e seus direitos sob a LGPD.",
};

const ATUALIZADO = "15 de julho de 2026";

export default function PrivacidadePage() {
  return (
    <>
      <Nav />
      <main id="conteudo" className="tl-section">
        <div className="tl-container max-w-content">
          <SectionLabel>Privacidade</SectionLabel>
          <h1 className="font-display text-3xl font-semibold leading-tight md:text-4xl">
            O que fazemos com o seu e-mail.
          </h1>
          <p className="mt-3 font-mono text-xs text-gray-500">
            Última atualização: {ATUALIZADO}
          </p>

          <div className="mt-10 space-y-10">
            <section>
              <h2 className="font-display text-xl font-semibold">Em uma frase</h2>
              <p className="mt-2 text-base leading-relaxed text-gray-500">
                Coletamos o seu e-mail com um único propósito: enviar a newsletter
                do The Loyal. Não vendemos, não alugamos e não repassamos sua lista
                para terceiros de marketing. Você cancela quando quiser, em um clique.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold">
                Que dados coletamos
              </h2>
              <ul className="mt-3 space-y-2 text-base leading-relaxed text-gray-500">
                <li className="border-t-2 border-ink pt-3">
                  <strong className="text-ink">E-mail.</strong> Fornecido por você
                  ao se inscrever.
                </li>
                <li className="border-t border-line pt-3">
                  <strong className="text-ink">Métricas de envio.</strong> Aberturas
                  e cliques da newsletter, agregados pela plataforma de e-mail, para
                  medir o que é útil ao leitor.
                </li>
                <li className="border-t border-line pt-3">
                  <strong className="text-ink">Uso do site.</strong> Eventos anônimos
                  de navegação (por exemplo, se um cadastro foi concluído), sem
                  cookie de rastreamento de terceiros e sem perfilamento individual.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold">
                Base legal e finalidade
              </h2>
              <p className="mt-2 text-base leading-relaxed text-gray-500">
                O tratamento se apoia no seu <strong className="text-ink">consentimento</strong>{" "}
                (art. 7º, I, da LGPD), dado no momento da inscrição. A finalidade é
                única: entregar o conteúdo que você pediu. Se um dia houver outra
                finalidade, ela será informada antes, e você poderá recusar.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold">
                Com quem compartilhamos
              </h2>
              <p className="mt-2 text-base leading-relaxed text-gray-500">
                Usamos a plataforma <strong className="text-ink">Beehiiv</strong>{" "}
                como operadora de e-mail: ela armazena e envia as edições em nosso
                nome. Não compartilhamos sua lista com anunciantes. Quando houver
                publicidade, ela vem dentro da própria edição, sinalizada, sem expor
                seus dados ao anunciante.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold">Seus direitos</h2>
              <p className="mt-2 text-base leading-relaxed text-gray-500">
                Você pode, a qualquer momento, confirmar quais dados temos, corrigir,
                exportar ou pedir a exclusão. O cancelamento da assinatura remove seu
                e-mail dos envios — o link está no rodapé de toda edição, a um clique.
                Para os demais pedidos, use o contato abaixo.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold">Retenção</h2>
              <p className="mt-2 text-base leading-relaxed text-gray-500">
                Mantemos seu e-mail enquanto você for assinante. Ao cancelar, o
                registro é removido da base ativa de envios.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold">Contato</h2>
              <p className="mt-2 text-base leading-relaxed text-gray-500">
                Dúvidas ou solicitações sobre seus dados:{" "}
                <a
                  href="mailto:privacidade@theloyal.com.br"
                  className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
                >
                  privacidade@theloyal.com.br
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
