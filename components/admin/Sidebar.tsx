"use client";

import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string }[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/jobs", label: "Crons" },
  { href: "/admin/backfill", label: "Backfill" },
  { href: "/admin/noticias", label: "Notícias" },
  { href: "/admin/campanhas", label: "Campanhas" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/predict", label: "Previsão" },
  { href: "/admin/shopping-vpm", label: "Radar VPM" },
  { href: "/admin/observability", label: "Observabilidade" },
];

function isActive(path: string, href: string): boolean {
  return href === "/admin" ? path === "/admin" : path.startsWith(href);
}

export function Sidebar() {
  const path = usePathname();
  return (
    <nav aria-label="Seções do admin" className="flex flex-col gap-0.5">
      {LINKS.map((l) => (
        <a
          key={l.href}
          href={l.href}
          aria-current={isActive(path, l.href) ? "page" : undefined}
          className={`rounded px-3 py-2 text-sm font-semibold transition-colors ${
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

// Nav horizontal para telas pequenas (a sidebar some no mobile).
export function MobileNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Seções do admin"
      className="-mx-5 flex gap-1 overflow-x-auto border-b border-line bg-surface px-5 py-2 md:hidden"
    >
      {LINKS.map((l) => (
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
