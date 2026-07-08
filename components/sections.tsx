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
              Quase tudo parece bom no título.
            </h2>
            <div className="space-y-5 text-lg leading-relaxed text-gray-500 lg:col-span-7">
              <p>
                Bônus de 110%. Desconto de 40%. Milheiro &quot;imperdível&quot;. O
                custo real depende de clube, cartão, taxa de conversão, prazo de
                crédito e validade. Sem esses insumos, a manchete não é
                informação. É banner.
              </p>
              <p className="border-l-[3px] border-ink pl-5 font-display text-xl font-semibold leading-snug text-ink">
                O The Loyalty faz a parte chata: lê o regulamento, confirma a
                vigência e calcula o milheiro final antes de você agir.
              </p>
            </div>
          </div>
        </Reveal>
        <Reveal className="mt-12">
          <CompareBanner />
        </Reveal>
      </div>
    </section>
  );
}

const METODO = [
  {
    titulo: "Sinal",
    texto:
      "O que mudou de verdade no mercado hoje, filtrado do ruído de reposts e comunicados requentados.",
  },
  {
    titulo: "Conta",
    texto:
      "CPM efetivo, valor por milheiro, preço implícito e spread. Números públicos, fórmula aberta, resultado auditável.",
    formula: "CPM = R$ / (milhas ÷ 1.000)",
  },
  {
    titulo: "Contexto",
    texto:
      "Por que a empresa fez esse movimento, quem mais fez igual e qual comportamento ela quer induzir.",
  },
  {
    titulo: "Ação",
    texto:
      "Vale agir, Vale olhar, Esperaria ou Evitaria. Um veredito claro, com o TL Score e para quem ele vale.",
  },
] as { titulo: string; texto: string; formula?: string }[];

export function Metodo() {
  return (
    <section id="metodo" className="tl-section border-b border-line">
      <div className="tl-container">
        <Reveal>
          <SectionLabel>A promessa</SectionLabel>
          <h2 className="max-w-content font-display text-3xl font-semibold leading-tight md:text-4xl">
            Sinal, conta, contexto e ação. Nessa ordem, todos os dias.
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
    nome: "The Loyalty Daily",
    kind: "daily",
    freq: "Segunda a sexta · 8h",
    desc: "Leitura de 5 minutos: sinal do dia, Deal Desk com conta feita, bancos e cartões, programas, varejo e o que vence hoje.",
    status: "Incluído",
  },
  {
    nome: "The Loyalty Weekly",
    kind: "weekly",
    freq: "Fim de semana",
    desc: "A tese da semana, ranking de oportunidades ainda vigentes e estratégia por perfil para os próximos 7 dias.",
    status: "Incluído",
  },
  {
    nome: "The Loyalty Lab",
    kind: "lab",
    freq: "2 a 4 por mês",
    desc: "Biblioteca evergreen: como funciona CPM, transferência bonificada, pontos + dinheiro e as mecânicas do mercado.",
    status: "Incluído",
  },
  {
    nome: "The Loyalty Pro",
    kind: "pro",
    freq: "Em breve",
    desc: "Base histórica, benchmarks de custo por categoria e radar de mercado para profissionais de loyalty, bancos e varejo.",
    status: "Beta fechado",
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
  ["Consumidor inteligente", "Quer saber se pontos, milhas e cashback valem a pena antes de mudar de hábito."],
  ["Heavy user", "Acompanha bônus e milheiro. Quer conta, timing, vigência e risco de estoque."],
  ["Alta renda", "Precisa decidir cartão, anuidade, sala VIP e benefício sem depender do gerente."],
  ["Profissional de loyalty", "Lê os movimentos dos programas como sinal de estratégia, não como promoção."],
  ["Bancos e cartões", "Observa como pontos e benefícios afetam aquisição, ativação e gasto."],
  ["Varejo e CRM", "Acompanha coalizões, cashback e dados como alavanca de retenção."],
] as const;

export function ParaQuem() {
  return (
    <section id="para-quem" className="tl-section border-b border-line">
      <div className="tl-container">
        <Reveal>
          <SectionLabel>Para quem é</SectionLabel>
          <h2 className="max-w-content font-display text-3xl font-semibold leading-tight md:text-4xl">
            Uma edição, três leituras: decidir, otimizar e construir.
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
  ["Fontes públicas", "Blogs e portais descobrem sinais. Regulamentos e páginas oficiais confirmam regras. A análise é nossa."],
  ["Vigência confirmada", "Oferta sem data e regra clara não vira recomendação. Vira, no máximo, radar de monitoramento."],
  ["Conta aberta", "CPM, VPM, preço implícito e spread com fórmula pública. Se falta dado, o item é Não confirmado."],
  ["TL Score", "Oito critérios com pesos declarados: valor, clareza, vigência, fricção, aplicabilidade, liquidez, risco e fontes."],
  ["Independência", "Nenhum dado interno, nenhuma métrica proprietária, nenhum texto pautado por programa ou banco."],
  ["Conteúdo patrocinado sinalizado", "Quando existir, virá identificado antes do conteúdo. Sem exceção."],
] as const;

export function ComoAnalisamos() {
  return (
    <section id="como-analisamos" className="tl-section border-b border-line">
      <div className="tl-container">
        <Reveal>
          <SectionLabel>Como analisamos</SectionLabel>
          <h2 className="max-w-content font-display text-3xl font-semibold leading-tight md:text-4xl">
            Confiança não se pede. Se demonstra com método.
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
            oficial antes de comprar, transferir ou resgatar. O The Loyalty não faz
            recomendação financeira personalizada.
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
              Amanhã às 8h, a conta já vai estar feita.
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Leitura de 5 minutos. Cancelamento em um clique. Ceticismo incluso.
            </p>
            <div className="mx-auto mt-8 max-w-xl text-left">
              <SubscribeForm onSuccess={() => setCelebrate(true)} />
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
