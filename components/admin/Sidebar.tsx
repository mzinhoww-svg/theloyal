"use client";

import { usePathname } from "next/navigation";

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
    label: "Inteligência",
    links: [
      { href: "/admin/forecast", label: "Forecast", hint: "Janelas previstas" },
      { href: "/admin/predict", label: "Predict", hint: "Motor de recorrência" },
      { href: "/admin/shopping-vpm", label: "Radar VPM", hint: "Valor por milheiro" },
    ],
  },
  {
    label: "Sistema",
    links: [
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

// Nav horizontal para telas pequenas (a sidebar some no mobile). Achatada,
// mas mantém a ordem por grupo do fluxo operacional.
export function MobileNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Seções do admin"
      className="-mx-5 flex gap-1 overflow-x-auto border-b border-line bg-surface px-5 py-2 md:hidden"
    >
      {NAV_FLAT.map((l) => (
        <a
          key={l.href}
          href={l.href}
          aria-current={isActive(path, l.href) ? "page" : undefined}
          className={`whitespace-nowrap rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
            isActive(path, l.href)
              ? "bg-ink text-paper"
              : "text-gray-700 hover:bg-paper-dark"
          }`}
        >
          {l.label}
        </a>
      ))}
    </nav>
  );
}
