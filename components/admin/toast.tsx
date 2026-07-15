"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFormState } from "react-dom";

// Resultado padrão de uma Server Action de mutação: ok + mensagem (o texto que
// as RPCs admin_* retornam, ex.: "disparado ingest (request_id=…)").
export type ActionState = { ok: boolean | null; message: string };
export const IDLE: ActionState = { ok: null, message: "" };

type Toast = { id: number; message: string; ok: boolean | null; leaving?: boolean };
type Ctx = { push: (message: string, ok: boolean | null) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast fora do ToastProvider");
  return c;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((message: string, ok: boolean | null) => {
    if (!message) return;
    const id = ++seq.current;
    setToasts((t) => [...t, { id, message, ok }]);
    setTimeout(() => {
      // Marca saída (transição) e só então remove — entrada/saída interrompíveis.
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 160);
    }, 6000);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[300] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            data-leaving={t.leaving ? "" : undefined}
            className={`tl-toast pointer-events-auto rounded-lg border bg-surface px-4 py-3 text-sm shadow-sm ${
              t.ok === false
                ? "border-red-600 text-red-700"
                : t.ok === true
                  ? "border-green-600 text-ink"
                  : "border-line text-ink"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// Form de mutação que fala com uma Server Action (prev, formData) => ActionState
// e joga o retorno num toast. Mantém o SubmitButton (estado pendente) por dentro.
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useFormState(action, IDLE);
  const { push } = useToast();
  const last = useRef<ActionState>(IDLE);

  useEffect(() => {
    if (state !== last.current && state.message) {
      push(state.message, state.ok);
      last.current = state;
    }
  }, [state, push]);

  return (
    <form action={formAction} className={className}>
      {children}
    </form>
  );
}
