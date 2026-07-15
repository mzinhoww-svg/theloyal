"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { logout } from "@/app/admin/login/actions";
import { SubmitButton } from "./SubmitButton";

export type NavLink = { href: string; label: string; hint?: string };
export type NavGroup = { label: string; links: NavLink[] };

// IA da Central: seções nomeadas em vez de 11 links planos. Ordem = fluxo
// operacional (o que se roda → o que se publica → o que se prevê → sistema).
export const NAV: NavGroup[] = [
  {
    label: "Operação",
    links: [
      { href: "/admin", label: "Dashboard", hint: "Visão geral e atenção" },
      { href: "/admin/jobs", label: "Crons", hint: "Agendamentos pg_cron" },
      { href: "/admin/backfill", label: "Backfill", hint: "Fila histórica" },
      { href: "/admin/logs", label: "Logs", hint: "Execuções unificadas" },
    ],
  },
  {
    label: "Conteúdo",
    links: [
      { href: "/admin/digests", label: "Digests", hint: "Edições e publicação" },
      { href: "/admin/noticias", label: "Notícias", hint: "Coleta e extração" },
      { href: "/admin/campanhas", label: "Campanhas", hint: "Ledger e vereditos" },
    ],
  },
  {
    label: "Radar",
    links: [
      { href: "/admin/radar", label: "Visão geral", hint: "Saúde, séries e filtros" },
      { href: "/admin/radar?view=oportunidades", label: "Oportunidades", hint: "Elegíveis para pauta" },
      { href: "/admin/radar?view=revisoes", label: "Revisões", hint: "Divergência e ressalvas" },
      { href: "/admin/radar?view=bloqueios", label: "Bloqueios", hint: "Globais e por série" },
      { href: "/admin/radar?view=operacao", label: "Operação", hint: "Alertas e o que mudou" },
    ],
  },
  {
    label: "Análise técnica",
    links: [
      { href: "/admin/forecast", label: "Forecast", hint: "Recorrência · baseline/fallback" },
      { href: "/admin/predict", label: "Predict", hint: "Preditivo v2 · hazard/backtest" },
      { href: "/admin/shopping-vpm", label: "Radar VPM", hint: "Valor por milheiro" },
      { href: "/admin/observability", label: "Observabilidade", hint: "Derivados do ledger" },
    ],
  },
];

// Lista achatada para o command palette e navegações rápidas.
export const NAV_FLAT: NavLink[] = NAV.flatMap((g) => g.links);

function isActive(path: string, href: string): boolean {
  return href === "/admin" ? path === "/admin" : path.startsWith(href);
}

const itemClass = (active: boolean) =>
  `rounded px-3 py-2 text-sm font-semibold transition-colors ${
    active ? "bg-ink text-paper" : "text-gray-700 hover:bg-paper-dark"
  }`;

export function Sidebar() {
  const path = usePathname();
  return (
    <nav aria-label="Seções do admin" className="flex flex-col gap-4">
      {NAV.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">
            {group.label}
          </span>
          {group.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              aria-current={isActive(path, l.href) ? "page" : undefined}
              className={itemClass(isActive(path, l.href))}
            >
              {l.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}

// Destinos primários da navegação inferior (thumb-reach). O resto vive no drawer.
const PRIMARY: NavLink[] = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/jobs", label: "Crons" },
  { href: "/admin/digests", label: "Digests" },
  { href: "/admin/noticias", label: "Notícias" },
];

// Navegação mobile de nível de produto: hamburger no header abre um drawer com
// as seções agrupadas, e uma bottom navigation fixa dá acesso de polegar aos
// destinos principais. Substitui a antiga barra de scroll horizontal — nenhuma
// tela do admin tem mais menu quebrando linha ou rolando de lado.
export function MobileNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    // Fecha ao trocar de rota.
    setOpen(false);
  }, [path]);

  useEffect(() => {
    // Drawer fechado sai da ordem de tabulação e do leitor de tela.
    if (panelRef.current) panelRef.current.inert = !open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add("tl-lock-scroll");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      root.classList.remove("tl-lock-scroll");
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* Gatilho hamburger — renderizado no header (linha 1). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu de navegação"
        aria-expanded={open}
        aria-controls="tl-mobile-drawer"
        className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-line bg-surface text-ink transition-colors hover:bg-paper-dark md:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path
            d="M3 5.5h14M3 10h14M3 14.5h14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Drawer + scrim. Fica no DOM sempre (para animar), mas fora da árvore
          de foco/leitura quando fechado. */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${open ? "tl-drawer-open" : "pointer-events-none"}`}
        aria-hidden={open ? undefined : true}
      >
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          aria-label="Fechar menu"
          onClick={close}
          className="tl-drawer-scrim absolute inset-0 h-full w-full bg-ink/40"
        />
        <div
          ref={panelRef}
          id="tl-mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navegação da Central de Controle"
          className="tl-drawer-panel tl-safe-bottom absolute inset-y-0 left-0 flex w-[84%] max-w-[320px] flex-col overflow-y-auto border-r border-line bg-surface"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <a href="/admin" className="flex items-center gap-2" onClick={close}>
              <span className="flex h-8 w-8 items-center justify-center rounded bg-ink font-display text-sm font-bold text-paper">
                TL
              </span>
              <span className="text-sm font-semibold leading-tight">
                Central de Controle
              </span>
            </a>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-paper-dark hover:text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
                <path
                  d="M4 4l10 10M14 4L4 14"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <nav
            aria-label="Seções do admin"
            className="flex flex-1 flex-col gap-5 px-3 py-4"
          >
            {NAV.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                  {group.label}
                </span>
                {group.links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    tabIndex={open ? 0 : -1}
                    onClick={close}
                    aria-current={isActive(path, l.href) ? "page" : undefined}
                    className={`flex min-h-[44px] flex-col justify-center rounded-lg px-3 py-2 transition-colors ${
                      isActive(path, l.href)
                        ? "bg-ink text-paper"
                        : "text-gray-700 hover:bg-paper-dark"
                    }`}
                  >
                    <span className="text-[15px] font-semibold leading-tight">
                      {l.label}
                    </span>
                    {l.hint && (
                      <span
                        className={`text-xs leading-tight ${
                          isActive(path, l.href) ? "text-paper/70" : "text-gray-400"
                        }`}
                      >
                        {l.hint}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            ))}
          </nav>

          <div className="border-t border-line px-3 py-4">
            <form action={logout}>
              <SubmitButton variant="default" pendingLabel="Saindo…">
                Sair
              </SubmitButton>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom navigation fixa — destinos principais no alcance do polegar. */}
      <nav
        aria-label="Navegação principal"
        className="tl-safe-bottom fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-line bg-surface/95 backdrop-blur md:hidden"
      >
        {PRIMARY.map((l) => {
          const active = isActive(path, l.href);
          return (
            <a
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition-colors ${
                active ? "text-ink" : "text-gray-400 hover:text-gray-700"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1 w-6 rounded-full transition-colors ${
                  active ? "bg-green-600" : "bg-transparent"
                }`}
              />
              <span className="truncate">{l.label}</span>
            </a>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu completo"
          aria-expanded={open}
          className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold text-gray-400 transition-colors hover:text-gray-700"
        >
          <span
            aria-hidden="true"
            className="flex h-1 w-6 items-center justify-center"
          >
            <svg width="16" height="4" viewBox="0 0 16 4" aria-hidden="true">
              <circle cx="2" cy="2" r="1.4" fill="currentColor" />
              <circle cx="8" cy="2" r="1.4" fill="currentColor" />
              <circle cx="14" cy="2" r="1.4" fill="currentColor" />
            </svg>
          </span>
          <span>Menu</span>
        </button>
      </nav>
    </>
  );
}
