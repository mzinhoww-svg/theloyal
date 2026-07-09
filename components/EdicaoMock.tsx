import { ContaBlock, SectionLabel, TLBadge } from "./ui";

/* Moldura de e-mail com uma edicao exemplo. Masthead editorial com regua dupla.
   Prova de produto no lugar de screenshot/stock. Conteudo ilustrativo, marcado como tal.
   Regra do guia: o Ponto nunca aparece dentro do Deal Desk. */
export function EdicaoMock() {
  return (
    <div className="mx-auto max-w-[600px] rounded-lg border border-line bg-surface shadow-sm">
      <div className="border-b-4 border-double border-ink px-6 py-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-display text-2xl">
            <span className="font-semibold">The </span>
            <span className="font-bold">Loyal</span>
          </span>
          <span className="font-mono text-xs text-gray-500">Nº 27</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-4 font-mono text-xs text-gray-400">
          <span>TERÇA-FEIRA · 8H00</span>
          <span>LEITURA DE 5 MIN</span>
        </div>
      </div>

      <div className="space-y-10 px-6 py-8">
        <div>
          <SectionLabel>O sinal do dia</SectionLabel>
          <blockquote className="border-l-[3px] border-blue-600 pl-5">
            <p className="text-lg leading-relaxed">
              Três programas mudaram regra de transferência no mesmo mês. Quando o
              mercado inteiro aperta na mesma direção, o recado não é promoção. É
              margem.
            </p>
          </blockquote>
        </div>

        <div>
          <SectionLabel>Deal Desk</SectionLabel>
          <div className="rounded border border-line p-5">
            <p className="font-mono text-xs uppercase tracking-[0.06em] text-gray-400">
              Transferência bonificada · Livelo → Smiles
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold">
              110% de bônus, mas a conta muda com o clube
            </h3>
            <p className="mt-2 text-base leading-relaxed text-gray-500">
              Vigência até quinta, 23h59. O bônus exige ativação prévia. Sem o
              clube, o milheiro final sobe 18%.
            </p>
            <div className="mt-5">
              <ContaBlock
                ariaLabel="Cálculo do CPM final da transferência"
                rows={[
                  ["custo origem", "R$ 1.394,00"],
                  ["pontos", "40.000"],
                  ["bônus", "110%"],
                  ["milhas finais", "84.000"],
                ]}
                result={["CPM final", "R$ 16,60 /milheiro"]}
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <TLBadge verdict="vale-olhar" score={76} />
              <span className="text-sm font-semibold">
                Bom para emissão planejada. Caro para estoque.
              </span>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Fonte: regulamento oficial · vigência confirmada hoje, 6h40
            </p>
          </div>
        </div>

        <div>
          <SectionLabel>Fecha logo</SectionLabel>
          <p className="text-base leading-relaxed">
            <span className="mr-2 inline-block rounded-sm bg-yellow-500 px-2 py-0.5 text-xs font-semibold text-ink">
              VENCE EM 48H
            </span>
            Compra de pontos com 40% de desconto termina quinta.{" "}
            <span className="font-mono text-sm">CPM R$ 24,90</span> para
            assinantes do clube.
          </p>
        </div>

        <p className="border-t border-line pt-4 text-xs leading-relaxed text-gray-400">
          Edição ilustrativa. Números de exemplo. Promoções podem mudar sem aviso:
          confira sempre as regras no site oficial.
        </p>
      </div>
    </div>
  );
}
