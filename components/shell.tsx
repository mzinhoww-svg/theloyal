"use client";

import { useEffect, useState } from "react";
import { LedgerTexture } from "./graphics";
import { PontoMascot } from "./PontoMascot";
import { SubscribeForm } from "./SubscribeForm";

export function Nav() {
  return (
    <header className="sticky top-0 z-[100] border-b border-line bg-paper/90 backdrop-blur">
      <div className="tl-container flex h-14 items-center justify-between">
        <a href="/" className="inline-flex min-h-11 items-center font-display text-lg text-ink lg:text-xl">
          <span className="font-semibold">The </span>
          <span className="font-bold">Loyal</span>
        </a>
        {/* No mobile o header carrega so marca + navegacao; a acao persistente e o StickyCTA. */}
        <nav aria-label="Principal" className="flex items-center gap-2 sm:gap-4">
          <a href="/#metodo" className="hidden min-h-11 items-center px-2 text-sm font-medium text-ink hover:text-green-700 md:inline-flex">
            Método
          </a>
          <a href="/edicao" className="hidden min-h-11 items-center px-2 text-sm font-medium text-ink hover:text-green-700 md:inline-flex">
            Edições
          </a>
          <a href="/#como-analisamos" className="hidden min-h-11 items-center px-2 text-sm font-medium text-ink hover:text-green-700 md:inline-flex">
            Como analisamos
          </a>
          <a
            href="#assinar"
            className="tl-press hidden min-h-11 items-center rounded bg-green-600 px-4 text-sm font-semibold text-paper hover:bg-green-700 md:inline-flex"
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

  const pontoLegenda = celebrate
    ? "Ponto abanou o rabo. Isso quase nunca acontece."
    : "Ponto só abana o rabo com vigência confirmada.";

  return (
    <section
      id="assinar"
      className="relative overflow-hidden border-b border-line py-10 md:py-20 lg:py-24"
    >
      <LedgerTexture />
      <div className="tl-container relative lg:grid lg:grid-cols-12 lg:items-center lg:gap-12">
        <div className="lg:col-span-7">
          {/* Mobile: Ponto cetico como narrador da tese, ao lado do rotulo. */}
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <PontoMascot
              tilt={tilt}
              celebrate={celebrate}
              className="h-auto w-[76px] shrink-0"
              label="Ponto, o mascote cético do The Loyal"
            />
            <div className="min-w-0">
              <span className="tl-label !text-ink">Newsletter grátis de pontos e milhas</span>
              <p className="mt-1 text-sm leading-snug text-gray-500" aria-live="polite">
                {pontoLegenda}
              </p>
            </div>
          </div>

          {/* Desktop: regua editorial classica. */}
          <div className="mb-8 hidden items-baseline justify-between gap-4 border-t-2 border-ink pt-3 lg:flex">
            <span className="tl-label !text-ink">Newsletter grátis de pontos e milhas</span>
            <span className="font-mono text-xs text-gray-500">Seg a sex, 8h · 5 min de leitura</span>
          </div>

          <h1 className="font-display text-[38px] font-bold leading-[1.03] tracking-[-0.02em] sm:text-[44px] md:text-[56px] lg:text-[64px]">
            Pontos e milhas sem pegadinha: a gente faz a conta pra você.
          </h1>
          <p className="mt-4 max-w-content text-lg leading-relaxed text-gray-500 md:mt-6">
            Todo dia útil, às 8h, você recebe um e-mail de 5 minutos. Ele mostra, em
            reais, se a promoção do dia vale a pena. E avisa quando é só banner bonito.
          </p>
          <p className="mt-4 font-mono text-xs text-gray-500 lg:hidden">
            Seg a sex, 8h · 5 min de leitura
          </p>

          <div className="mt-6 max-w-xl md:mt-8">
            <SubscribeForm submitLabel="Quero receber grátis" onFocusChange={setTilt} onSuccess={() => setCelebrate(true)} />
          </div>
          <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-gray-500">
            <li>Fonte oficial</li>
            <li aria-hidden="true" className="text-line">·</li>
            <li>Vigência confirmada</li>
            <li aria-hidden="true" className="text-line">·</li>
            <li>Cancela em 1 clique</li>
          </ul>
          {/* Ancora do StickyCTA: uma vez que sai da viewport, a barra inferior aparece. */}
          <span id="hero-cta-anchor" aria-hidden="true" className="block h-0" />
          <a
            href="#como-analisamos"
            className="mt-4 inline-flex min-h-11 items-center text-base font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
          >
            Ver como analisamos
          </a>
        </div>

        {/* Desktop: Ponto grande, cena de abertura. Escondido no mobile (narrador acima). */}
        <div className="mt-0 hidden lg:col-span-5 lg:block">
          <div className="mx-auto w-72 lg:w-80">
            <PontoMascot interactive tilt={tilt} celebrate={celebrate} className="h-auto w-full" />
            <p className="mt-4 text-center text-sm text-gray-500" aria-live="polite">
              {pontoLegenda}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StickyCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Estado por geometria (rAF, passivo): robusto para scroll lento, rapido,
    // salto ao topo e resize. Aparece quando o form do hero passa por cima e
    // some do CTA final ate o fim da pagina, sem reaparecer sobre o rodape.
    const anchor = document.getElementById("hero-cta-anchor");
    const final = document.getElementById("cta-final");
    let raf = 0;
    const compute = () => {
      raf = 0;
      const heroPassed = anchor
        ? anchor.getBoundingClientRect().bottom < 0
        : window.scrollY > 600;
      const finalReached = final
        ? final.getBoundingClientRect().top < window.innerHeight * 0.9
        : false;
      setShow(heroPassed && !finalReached);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    // Reserva espaco no fim do documento enquanto a barra esta ativa, para
    // que nenhum conteudo fique coberto (respeitando a safe area do iPhone).
    document.body.style.paddingBottom = show
      ? "calc(4.5rem + env(safe-area-inset-bottom))"
      : "";
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [show]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[90] border-t border-line bg-paper/95 px-4 pt-3 backdrop-blur transition-[transform,opacity] duration-200 ease-standard lg:hidden ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      aria-hidden={!show}
    >
      <a
        href="#assinar"
        tabIndex={show ? undefined : -1}
        className="flex min-h-12 w-full items-center justify-center rounded bg-green-600 px-4 text-base font-semibold text-paper transition-colors duration-150 hover:bg-green-700"
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
