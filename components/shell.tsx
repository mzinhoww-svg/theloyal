"use client";

import { useState } from "react";
import { LedgerTexture } from "./graphics";
import { PontoMascot } from "./PontoMascot";
import { SubscribeForm } from "./SubscribeForm";

export function Nav() {
  return (
    <header className="sticky top-0 z-[100] border-b border-line bg-paper/95 backdrop-blur">
      <div className="tl-container flex h-16 items-center justify-between">
        <a href="#" className="inline-flex min-h-11 items-center font-display text-xl text-ink">
          <span className="font-semibold">The </span>
          <span className="font-bold">Loyal</span>
        </a>
        <nav aria-label="Principal" className="flex items-center gap-2 sm:gap-4">
          <a href="#metodo" className="hidden min-h-11 items-center px-2 text-sm font-medium text-ink hover:text-green-700 md:inline-flex">
            Método
          </a>
          <a href="#edicao" className="hidden min-h-11 items-center px-2 text-sm font-medium text-ink hover:text-green-700 md:inline-flex">
            A edição
          </a>
          <a href="#como-analisamos" className="hidden min-h-11 items-center px-2 text-sm font-medium text-ink hover:text-green-700 md:inline-flex">
            Como analisamos
          </a>
          <a
            href="#assinar"
            className="inline-flex min-h-11 items-center rounded bg-green-600 px-4 text-sm font-semibold text-paper transition-colors duration-150 ease-standard hover:bg-green-700"
          >
            Assinar
          </a>
        </nav>
      </div>
    </header>
  );
}

export function Hero() {
  const [tilt, setTilt] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  return (
    <section id="assinar" className="tl-section relative overflow-hidden border-b border-line">
      <LedgerTexture />
      <div className="tl-container relative grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="mb-8 flex items-baseline justify-between gap-4 border-t-2 border-ink pt-3">
            <span className="tl-label !text-ink">Mídia independente de loyalty</span>
            <span className="font-mono text-xs text-gray-500">SEG–SEX · 8H · 5 MIN</span>
          </div>
          <h1 className="font-display text-[40px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[56px] lg:text-[64px]">
            O mercado de loyalty explicado com conta feita.
          </h1>
          <p className="mt-6 max-w-content text-lg leading-relaxed text-gray-500">
            Pontos, milhas, cartões, bancos, varejo e cashback. Todos os dias, uma
            leitura clara sobre onde existe valor real e onde só existe banner bonito.
          </p>
          <div className="mt-10 max-w-xl">
            <SubscribeForm onFocusChange={setTilt} onSuccess={() => setCelebrate(true)} />
          </div>
          <a
            href="#como-analisamos"
            className="mt-6 inline-flex min-h-11 items-center text-base font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
          >
            Ver como analisamos
          </a>
        </div>
        <div className="mx-auto w-56 md:w-64 lg:col-span-5 lg:w-80">
          <PontoMascot interactive tilt={tilt} celebrate={celebrate} className="h-auto w-full" />
          <p className="mt-4 text-center text-sm text-gray-500">
            {celebrate
              ? "Ponto abanou o rabo. Isso quase nunca acontece."
              : "Ponto só abana o rabo com vigência confirmada."}
          </p>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-ink text-paper">
      <div className="tl-container py-16">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-sm bg-paper font-mono text-sm font-bold text-ink"
              >
                TL
              </span>
              <span className="font-display text-xl">
                <span className="font-semibold">The </span>
                <span className="font-bold">Loyal</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-400">
              Mídia independente sobre loyalty, pontos, milhas, cartões, bancos,
              varejo, cashback e comportamento de consumo.
            </p>
          </div>
          <nav aria-label="Rodapé" className="grid grid-cols-2 gap-x-8 gap-y-1 md:col-span-7 md:grid-cols-4">
            {[
              ["Sobre", "#"],
              ["Metodologia", "#como-analisamos"],
              ["Anuncie", "#"],
              ["Privacidade", "#"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="inline-flex min-h-11 items-center text-sm font-medium text-paper hover:text-green-500"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-12 border-t border-gray-700 pt-6">
          <p className="text-xs leading-relaxed text-gray-400">
            Promoções podem mudar sem aviso. Confira sempre as regras no site
            oficial antes de comprar, transferir ou resgatar. O The Loyal não é
            recomendação financeira personalizada, não usa dados internos de
            empresas e não é comunicação oficial de nenhum programa de fidelidade.
          </p>
          <p className="mt-3 font-mono text-xs text-gray-400">
            © {new Date().getFullYear()} The Loyal · Ponto leu até aqui.
          </p>
        </div>
      </div>
    </footer>
  );
}
