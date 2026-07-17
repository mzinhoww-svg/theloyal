"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NAV, NAV_FLAT } from "./Sidebar";

// Salto rápido operacional. Sem dependência: <dialog> nativo (escapa qualquer
// stacking context), filtro por texto, navegação por teclado. Só navega —
// nenhuma ação destrutiva dispara daqui.

type Cmd = { href: string; label: string; group: string; hint?: string };

// Atalhos que não são páginas inteiras: recortes que o operador pede toda hora.
const QUICK: Cmd[] = [
  { href: "/admin/digests/new", label: "Curar nova edição", group: "Ações", hint: "Abrir curadoria" },
  { href: "/admin/noticias?status=erro", label: "Notícias com erro", group: "Filtros", hint: "Falha na extração" },
  { href: "/admin/noticias?status=pendente", label: "Notícias pendentes", group: "Filtros", hint: "Fila de extração" },
  { href: "/admin/campanhas?revisao=1", label: "Campanhas em revisão", group: "Filtros", hint: "Pedem olho humano" },
  { href: "/admin/logs?status=failed", label: "Logs de falha", group: "Filtros", hint: "Execuções que falharam" },
];

const ALL: Cmd[] = [
  ...NAV.flatMap((g) => g.links.map((l) => ({ ...l, group: g.label }))),
  ...QUICK,
];

function norm(s: string): string {
  // Remove acentos (combinantes U+0300–U+036F) para busca tolerante.
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function CommandPalette() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const close = useCallback(() => {
    dialogRef.current?.close();
    setOpen(false);
    setQ("");
    setActive(0);
  }, []);

  const openPalette = useCallback(() => {
    setOpen(true);
    // showModal precisa do elemento montado; adia um tick.
    requestAnimationFrame(() => {
      dialogRef.current?.showModal();
      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open ? close() : openPalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, openPalette]);

  const results = useMemo(() => {
    const nq = norm(q.trim());
    if (!nq) return ALL;
    return ALL.filter(
      (c) => norm(c.label).includes(nq) || norm(c.hint ?? "").includes(nq) || norm(c.group).includes(nq),
    );
  }, [q]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[active];
      if (hit) go(hit.href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="inline-flex min-h-[44px] w-full items-center justify-between gap-2 rounded-full border border-line bg-paper px-4 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700 md:w-auto md:justify-start md:px-3 md:text-xs"
        aria-keyshortcuts="Meta+K Control+K"
        title="Buscar e navegar (⌘K)"
      >
        <span className="inline-flex items-center gap-2">
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            aria-hidden="true"
            focusable="false"
            className="flex-none"
          >
            <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Buscar…
        </span>
        <kbd className="hidden rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-gray-500 md:inline">
          ⌘K
        </kbd>
      </button>

      <dialog
        ref={dialogRef}
        onClose={close}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        aria-label="Buscar e navegar"
        className="mt-[12vh] w-[min(560px,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-ink shadow-sm backdrop:bg-ink/40"
      >
        {open && (
          <div className="flex flex-col" onKeyDown={onListKey}>
            <div className="border-b border-line px-4 py-3">
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ir para… ou buscar seção, filtro, ação"
                aria-label="Buscar"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-gray-400"
              />
            </div>
            <ul className="max-h-[52vh] overflow-y-auto py-2" role="listbox" aria-label="Resultados">
              {results.length > 0 ? (
                results.map((c, i) => (
                  <li key={`${c.group}-${c.href}-${c.label}`} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(c.href)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors ${
                        i === active ? "bg-paper-dark" : "hover:bg-paper"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="font-medium text-ink">{c.label}</span>
                        {c.hint && <span className="truncate text-xs text-gray-500">{c.hint}</span>}
                      </span>
                      <span className="flex-none text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                        {c.group}
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-4 py-6 text-center text-sm text-gray-500">
                  Nada encontrado para “{q}”.
                </li>
              )}
            </ul>
            <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-gray-400">
              <span>↑↓ navegar</span>
              <span>↵ abrir</span>
              <span>esc fechar</span>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
