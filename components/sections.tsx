"use client";

import { useState } from "react";
import { PontoMascot } from "./PontoMascot";
import { SubscribeForm } from "./SubscribeForm";
import { CompareBanner, PontoReadingScene, Sparkline } from "./graphics";
import { Reveal, SectionLabel } from "./ui";

export function Problema() {
  return (
    <section className="tl-section border-b border-line">
      <div className="tl-container">
        <Reveal>
          <SectionLabel>O problema</SectionLabel>
          <div className="grid gap-10 lg:grid-cols-12">
            <h2 className="font-display text-3xl font-semibold leading-tight md:text-4xl lg:col-span-5">
              No título, toda promoção parece ótima.
            </h2>
            <div className="space-y-5 text-lg leading-relaxed text-gray-500 lg:col-span-7">
              <p>
                &quot;Bônus de 110%&quot;. &quot;40% de desconto&quot;. &quot;Pontos
                pela metade do preço&quot;. O anúncio mostra o número bonito. O que
                ele esconde são as regras que mudam o preço final: se você precisa
                assinar o clube de pontos, qual cartão entra na promoção, até quando
                vale e o que acontece se os pontos vencerem.
              </p>
              <p className="border-l-[3px] border-ink pl-5 font-display text-xl font-semibold leading-snug text-ink">
                O The Loyal faz a parte chata: lê as regras, confere se a oferta
                ainda está no ar e calcula o custo real. Tudo antes de você gastar.
              </p>
            </div>
          </div>
        </Reveal>
        <Reveal className="mt-12">
          <CompareBanner />
          <p className="mt-4 max-w-content text-sm leading-relaxed text-gray-500">
            Exemplo real: a mesma promoção pode sair por R$ 34, R$ 24 ou R$ 16 a cada
            mil pontos. Depende só do caminho que você escolhe. O banner não conta isso.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

const METODO = [
  {
    titulo: "O que mudou hoje.",
    texto: "A novidade que importa, sem requentar notícia.",
  },
  {
    titulo: "A conta.",
    texto:
      "Quanto custa de verdade, em reais. Mostramos o cálculo pra você conferir.",
    formula: "CPM = R$ / (milhas ÷ 1.000)",
  },
  {
    titulo: "O porquê.",
    texto:
      "O que a empresa ganha com a promoção e o que ela espera que você faça.",
  },
  {
    titulo: "O veredito.",
    texto:
      "Uma resposta direta: vale a pena, dá pra considerar, melhor esperar ou evite. E pra qual perfil vale.",
  },
] as { titulo: string; texto: string; formula?: string }[];

export function Metodo() {
  return (
    <section id="metodo" className="tl-section border-b border-line">
      <div className="tl-container">
        <Reveal>
          <SectionLabel>Como funciona cada edição</SectionLabel>
          <h2 className="max-w-content font-display text-3xl font-semibold leading-tight md:text-4xl">
            Quatro passos. Todo dia. Na mesma ordem.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {METODO.map((m, i) => (
            <Reveal key={m.titulo}>
              <div className="h-full border-t-2 border-ink pt-5">
                <span className="font-mono text-sm text-gray-400">0{i + 1}</span>
                <h3 className="mt-2 font-display text-2xl font-semibold">{m.titulo}</h3>
                <p className="mt-3 text-base leading-relaxed text-gray-500">{m.texto}</p>
                {m.formula && (
                  <p className="mt-4 inline-block rounded-sm bg-paper-dark px-3 py-1.5 font-mono text-[13px] text-gray-700">
                    {m.formula}
                  </p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const PRODUTOS: {
  nome: string;
  freq: string;
  desc: string;
  status: string;
  kind: "daily" | "weekly" | "lab" | "pro";
}[] = [
  {
    nome: "De segunda a sexta, às 8h",
    kind: "daily",
    freq: "Segunda a sexta · 8h",
    desc: "A novidade do dia, a promoção analisada com a conta pronta e os prazos que vencem hoje.",
    status: "Incluído",
  },
  {
    nome: "No fim de semana",
    kind: "weekly",
    freq: "Fim de semana",
    desc: "O resumo da semana, as ofertas que ainda estão no ar e o que fazer nos próximos 7 dias.",
    status: "Incluído",
  },
  {
    nome: "Guias que não vencem",
    kind: "lab",
    freq: "2 a 4 por mês",
    desc: "Explicações simples de como pontos, milhas e transferências funcionam. Pra você nunca mais decidir no achismo.",
    status: "Incluído",
  },
  {
    nome: "Versão Pro",
    kind: "pro",
    freq: "Em breve",
    desc: "Para quem trabalha com pontos, bancos ou varejo: histórico de preços, comparativos e monitoramento do mercado.",
    status: "Em breve",
  },
];

export function Recebe() {
  return (
    <section className="tl-section border-b border-line">
      <div className="tl-container">
        <Reveal>
          <SectionLabel>O que você recebe</SectionLabel>
        </Reveal>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {PRODUTOS.map((p) => (
            <Reveal key={p.nome}>
              <div className="flex h-full flex-col rounded border border-line bg-surface p-6">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-display text-xl font-semibold">{p.nome}</h3>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.06em] ${
                      p.status === "Incluído"
                        ? "bg-green-100 text-green-700"
                        : "bg-paper-dark text-gray-500"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <p className="font-mono text-sm text-gray-400">{p.freq}</p>
                  <Sparkline kind={p.kind} />
                </div>
                <p className="mt-3 text-base leading-relaxed text-gray-500">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const PERFIS = [
  ["Você usa pontos de vez em quando.", "Quer saber se vale mudar de cartão ou assinar um cashback antes de gastar à toa."],
  ["Você já acumula bastante.", "Quer o preço certo, a hora certa de transferir e os prazos de cada oferta em um só lugar."],
  ["Você tem cartão premium, ou pensa em ter.", "Precisa decidir se a anuidade compensa, sem depender do gerente do banco."],
  ["Você trabalha com o assunto.", "Acompanha bancos, companhias aéreas e varejo, e quer ler os movimentos do mercado antes dos outros."],
] as const;

export function ParaQuem() {
  return (
    <section id="para-quem" className="tl-section border-b border-line">
      <div className="tl-container">
        <Reveal>
          <SectionLabel>Para quem é</SectionLabel>
          <h2 className="max-w-content font-display text-3xl font-semibold leading-tight md:text-4xl">
            Feito pra quatro tipos de leitor. Veja se você é um deles.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {PERFIS.map(([nome, desc]) => (
            <Reveal key={nome}>
              <div className="border-t-2 border-ink pt-4">
                <h3 className="text-base font-semibold">{nome}</h3>
                <p className="mt-2 text-base leading-relaxed text-gray-500">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const PRINCIPIOS = [
  ["Fontes oficiais.", "Toda análise parte das regras publicadas pela própria empresa."],
  ["Só o que está valendo.", "Oferta sem data ou sem regra clara não vira recomendação."],
  ["Conta à mostra.", "Mostramos como chegamos no número. Se falta informação, a gente avisa."],
  ["Nota de 0 a 100.", "Cada oferta recebe uma nota, com os critérios explicados."],
  ["Ninguém paga pela opinião.", "Nenhum banco ou programa influencia o que escrevemos."],
  ["Publicidade sempre marcada.", "Se um dia tiver anúncio, ele vem sinalizado."],
] as const;

export function ComoAnalisamos() {
  return (
    <section id="como-analisamos" className="tl-section border-b border-line">
      <div className="tl-container">
        <Reveal>
          <SectionLabel>Por que confiar</SectionLabel>
          <h2 className="max-w-content font-display text-3xl font-semibold leading-tight md:text-4xl">
            A conta é aberta. As fontes são públicas.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-12 lg:grid-cols-12">
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:col-span-8">
            {PRINCIPIOS.map(([titulo, texto]) => (
              <Reveal key={titulo}>
                <div>
                  <h3 className="text-base font-semibold">{titulo}</h3>
                  <p className="mt-2 text-base leading-relaxed text-gray-500">{texto}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="lg:col-span-4">
            <div className="flex h-full flex-col items-center justify-center rounded border border-line bg-paper-dark p-8 text-center">
              <PontoReadingScene className="w-full max-w-[320px]" />
              <p className="mt-4 text-sm leading-relaxed text-gray-500">
                Ponto confere o regulamento antes de abanar o rabo. Quando falta
                fonte, o veredito é um só: Não confirmado.
              </p>
            </div>
          </Reveal>
        </div>
        <Reveal>
          <div className="mt-12 rounded bg-ink px-5 py-4 font-mono text-[13px] leading-7 text-paper sm:px-6 sm:text-sm">
            <span className="text-gray-400">TL Score = </span>
            25·valor + 15·regra + 15·vigência + 10·fricção + 10·aplicabilidade +
            10·liquidez + 10·estoque + 5·fontes
            <span className="block text-green-500">
              sem vigência confirmada → Não confirmado, sempre
            </span>
          </div>
        </Reveal>
        <Reveal>
          <p className="mt-8 max-w-content border-l-[3px] border-gray-400 bg-paper-dark py-3 pl-5 pr-4 text-sm leading-relaxed text-gray-500">
            Promoções podem mudar sem aviso. Confira sempre as regras no site
            oficial antes de comprar, transferir ou resgatar. O The Loyal não faz
            recomendação financeira individual: a decisão final é sempre sua.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function CTAFinal() {
  const [celebrate, setCelebrate] = useState(false);
  return (
    <section className="tl-section">
      <div className="tl-container">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold leading-tight md:text-5xl">
              Amanhã, às 8h, a conta chega pronta na sua caixa de entrada.
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              5 minutos de leitura. De graça. Cancela em um clique.
            </p>
            <div className="mx-auto mt-8 max-w-xl text-left">
              <SubscribeForm submitLabel="Quero receber por e-mail" onSuccess={() => setCelebrate(true)} />
            </div>
            {celebrate && (
              <div className="mx-auto mt-6 w-28">
                <PontoMascot celebrate className="w-full" label="Ponto comemorando com as orelhas em pé" />
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
