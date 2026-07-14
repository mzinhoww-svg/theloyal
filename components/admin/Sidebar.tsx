"use client";

import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string }[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/jobs", label: "Crons" },
  { href: "/admin/backfill", label: "Backfill" },
  { href: "/admin/campanhas", label: "Campanhas" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/observability", label: "Observabilidade" },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <nav aria-label="Seções do admin" className="flex flex-col gap-0.5">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
        return (
          <a
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded px-3 py-2 text-sm font-semibold transition-colors ${
              active
                ? "bg-ink text-paper"
                : "text-gray-700 hover:bg-paper-dark"
            }`}
          >
            {l.label}
          </a>
        );
      })}
    </nav>
  );
}
