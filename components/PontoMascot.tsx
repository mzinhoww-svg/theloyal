"use client";

import { useEffect, useRef } from "react";

/* Ponto, o vira-lata caramelo cetico (PONTO-MASCOTE-GUIA.md). Geometria oficial.
   Poses: padrao | lupa. tilt: cabeca inclina (foco no form). celebrate: orelhas em pe + cauda.
   interactive: pupilas seguem o cursor, focinho fareja no hover, tag balanca no clique.
   Excecao permitida ao "sem hex em componente": geometria SVG do mascote usa as constantes do guia.
   Tudo transform-only, listener ativo so com o SVG visivel, desligado em reduced motion. */

const C = {
  caramel: "#D9A15B",
  dark: "#B8813F",
  cream: "#F3E3C3",
  ink: "#111111",
  green: "#00C48C",
  paper: "#FAF7F0",
};

export function PontoMascot({
  pose = "padrao",
  tilt = false,
  celebrate = false,
  interactive = false,
  className = "",
  label = "Ponto, o mascote do The Loyalty, um vira-lata caramelo com coleira verde e tag TL",
}: {
  pose?: "padrao" | "lupa";
  tilt?: boolean;
  celebrate?: boolean;
  interactive?: boolean;
  className?: string;
  label?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg || !interactive) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const pupils = svg.querySelectorAll<SVGElement>(".p-pupil");
    let raf: number | null = null;
    let active = false;

    const onMove = (e: MouseEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const r = svg.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height * 0.32;
        pupils.forEach((p) => {
          const max = p.classList.contains("p-pupil-lens") ? 6 : 3.5;
          const dx = Math.max(-max, Math.min(max, (e.clientX - cx) / 45));
          const dy = Math.max(-max, Math.min(max, (e.clientY - cy) / 45));
          p.style.transform = `translate(${dx}px,${dy}px)`;
        });
      });
    };

    // Escuta mousemove so com o mascote visivel: custo zero fora da dobra.
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting && !active) {
          document.addEventListener("mousemove", onMove);
          active = true;
        } else if (!en.isIntersecting && active) {
          document.removeEventListener("mousemove", onMove);
          active = false;
        }
      });
    });
    io.observe(svg);

    let busy = false;
    const onEnter = () => {
      const nose = svg.querySelector<SVGElement>(".p-nose");
      if (busy || !nose || svg.classList.contains("celebrate")) return;
      busy = true;
      nose.classList.add("sniff");
      nose.addEventListener(
        "animationend",
        () => {
          nose.classList.remove("sniff");
          busy = false;
        },
        { once: true },
      );
    };
    const onClick = () => {
      const tag = svg.querySelector<SVGElement>(".ponto-tag");
      if (!tag || tag.classList.contains("wiggle")) return;
      tag.classList.add("wiggle");
      tag.addEventListener("animationend", () => tag.classList.remove("wiggle"), {
        once: true,
      });
    };
    svg.addEventListener("mouseenter", onEnter);
    svg.addEventListener("click", onClick);

    return () => {
      io.disconnect();
      if (active) document.removeEventListener("mousemove", onMove);
      svg.removeEventListener("mouseenter", onEnter);
      svg.removeEventListener("click", onClick);
    };
  }, [interactive]);

  return (
    <svg
      ref={ref}
      viewBox="0 0 400 460"
      role="img"
      aria-label={label}
      className={`${className} ${celebrate ? "celebrate" : ""}`}
    >
      {/* cauda */}
      <g className={celebrate ? "ponto-tail-wag" : undefined}>
        <path
          d="M 95 355 Q 45 340 50 290 Q 52 272 66 268 Q 60 305 105 322 Z"
          fill={C.dark}
          stroke={C.ink}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>

      <g className="ponto-body">
        {/* corpo sentado */}
        <path
          d="M 128 240 Q 92 300 92 370 Q 92 412 132 412 L 268 412 Q 308 412 308 370 Q 308 300 272 240 Z"
          fill={C.caramel}
          stroke={C.ink}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M 200 250 Q 158 262 152 330 Q 148 396 200 400 Q 252 396 248 330 Q 242 262 200 250 Z"
          fill={C.cream}
        />
        <rect x="152" y="330" width="34" height="82" rx="16" fill={C.caramel} stroke={C.ink} strokeWidth="3" />
        <rect x="214" y="330" width="34" height="82" rx="16" fill={C.caramel} stroke={C.ink} strokeWidth="3" />
      </g>

      <g className={`ponto-head ${tilt ? "is-tilt" : ""}`}>
        {celebrate ? (
          <>
            {/* orelhas em pe: exclusivo do Vale agir (sucesso do form) */}
            <path d="M 138 96 Q 120 30 152 28 Q 174 28 170 88 Z" fill={C.dark} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" />
            <path d="M 262 96 Q 280 30 248 28 Q 226 28 230 88 Z" fill={C.dark} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <g className="ponto-ear-l">
              <path d="M 132 92 Q 104 78 96 116 Q 90 152 108 178 Q 122 194 140 184 Q 128 140 142 104 Z" fill={C.dark} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" />
            </g>
            <path d="M 268 92 Q 296 78 304 116 Q 310 152 292 178 Q 278 194 260 184 Q 272 140 258 104 Z" fill={C.dark} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" />
          </>
        )}

        <circle cx="200" cy="146" r="76" fill={C.caramel} stroke={C.ink} strokeWidth="3" />
        <path d="M 148 108 Q 172 96 190 110 Q 178 128 156 132 Q 146 122 148 108 Z" fill={C.dark} />
        <ellipse cx="200" cy="182" rx="44" ry="32" fill={C.cream} />
        <path className="p-nose" d="M 188 168 Q 200 162 212 168 Q 212 180 200 186 Q 188 180 188 168 Z" fill={C.ink} />

        {celebrate ? (
          <path d="M 186 190 Q 200 202 214 190" fill="none" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
        ) : (
          <path d="M 200 186 L 200 196 Q 208 206 220 200" fill="none" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
        )}

        {pose === "lupa" ? (
          <>
            {/* olho esquerdo apertado + lupa no direito: pose Nao confirmado */}
            <path d="M 164 138 L 182 138" stroke={C.ink} strokeWidth="4" strokeLinecap="round" />
            <path d="M 158 124 Q 172 120 186 124" fill="none" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="230" cy="140" r="30" fill={C.paper} fillOpacity="0.55" stroke={C.ink} strokeWidth="5" />
            <circle className="p-pupil p-pupil-lens" cx="230" cy="140" r="11" fill={C.ink} />
            <line x1="252" y1="162" x2="276" y2="188" stroke={C.ink} strokeWidth="8" strokeLinecap="round" />
          </>
        ) : (
          <>
            <g className="ponto-eyes">
              <circle className="p-pupil" cx="172" cy="140" r="7" fill={C.ink} />
              <circle className="p-pupil" cx="228" cy="140" r="7" fill={C.ink} />
              {celebrate && (
                <>
                  <circle cx="175" cy="137" r="2.5" fill={C.paper} />
                  <circle cx="231" cy="137" r="2.5" fill={C.paper} />
                </>
              )}
            </g>
            <path d="M 160 124 Q 172 120 184 124" fill="none" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" />
            {/* sobrancelha direita levantada: marca do ceticismo */}
            <path d="M 214 112 Q 228 106 242 114" fill="none" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" />
          </>
        )}

        {/* coleira verde + tag TL: elementos fixos do personagem */}
        <path
          d="M 142 216 Q 200 244 258 216 L 258 234 Q 200 262 142 234 Z"
          fill={C.green}
          stroke={C.ink}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <g className="ponto-tag">
          <circle cx="200" cy="266" r="23" fill={C.ink} />
          <text
            x="200"
            y="274"
            textAnchor="middle"
            fontSize="18"
            fontWeight="700"
            fill={C.paper}
            style={{ fontFamily: "var(--font-mono), Consolas, monospace" }}
          >
            TL
          </text>
        </g>
      </g>
    </svg>
  );
}
