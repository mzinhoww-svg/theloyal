"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { LedgerTexture } from "./graphics";
import { PontoMascot } from "./PontoMascot";
import { SubscribeForm } from "./SubscribeForm";

export function Nav() {
  return (
    <header className="sticky top-0 z-[100] border-b border-line bg-paper/95 backdrop-blur">
      <div className="tl-container flex h-16 items-center justify-between">
        <a href="/" className="inline-flex min-h-11 items-center font-display text-xl text-ink">
          <span className="font-semibold">The </span>
          <span className="font-bold">Loyal</span>
        </a>
        <nav aria-label="Principal" className="flex items-center gap-2 sm:gap-4">
          <a href="/#metodo" className="hidden min-h-11 items-center px-2 text-sm font-medium text-ink hover:text-green-700 md:inline-flex">
            Método
          </a>
          <a href="/promocoes" className="hidden min-h-11 items-center px-2 text-sm font-medium text-ink hover:text-green-700 md:inline-flex">
            Promoções
          </a>
          <a href="/edicao" className="hidden min-h-11 items-center px-2 text-sm font-medium text-ink hover:text-green-700 md:inline-flex">
            Edições
          </a>
          <a href="/#como-analisamos" className="hidden min-h-11 items-center px-2 text-sm font-medium text-ink hover:text-green-700 md:inline-flex">
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
            <span className="tl-label !text-ink">Newsletter grátis de pontos e milhas</span>
            <span className="font-mono text-xs text-gray-500">Seg a sex, 8h · 5 min de leitura</span>
          </div>
          <h1 className="font-display text-[40px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[56px] lg:text-[64px]">
            Pontos e milhas sem pegadinha: a gente faz a conta pra você.
          </h1>
          <p className="mt-6 max-w-content text-lg leading-relaxed text-gray-500">
            Todo dia útil, às 8h, você recebe um e-mail de 5 minutos. Ele mostra, em
            reais, se a promoção do dia vale a pena. E avisa quando é só banner bonito.
          </p>
          <div className="mt-10 max-w-xl">
            <SubscribeForm submitLabel="Quero receber grátis" source="hero" onFocusChange={setTilt} onSuccess={() => setCelebrate(true)} />
          </div>
          <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs text-gray-500">
            <li>Fonte oficial</li>
            <li aria-hidden="true" className="text-line">·</li>
            <li>Vigência confirmada</li>
            <li aria-hidden="true" className="text-line">·</li>
            <li>Cancela em 1 clique</li>
          </ul>
          <a
            href="#como-analisamos"
            className="mt-5 inline-flex min-h-11 items-center text-base font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
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

export function StickyCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Aparece depois de passar da primeira dobra; some ao chegar no CTA final
    // (que ja tem form). So no mobile. Sem animacao dependente de motion.
    const onScroll = () => setShow(window.scrollY > 640);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
      <a
        href="#assinar"
        onClick={() => track("cta_click", { source: "sticky" })}
        className="flex min-h-11 w-full items-center justify-center rounded bg-green-600 px-4 text-base font-semibold text-paper transition-colors duration-150 hover:bg-green-700"
      >
        Receber grátis, todo dia às 8h
      </a>
    </div>
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
              ["Sobre", "/sobre"],
              ["Metodologia", "/#como-analisamos"],
              ["Anuncie", "/anuncie"],
              ["Privacidade", "/privacidade"],
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
