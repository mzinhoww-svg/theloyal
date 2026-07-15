"use client";

import { useId, useState, type FormEvent } from "react";
import { track } from "@/lib/track";
import { getAttribution } from "@/lib/attribution";

type Status = "idle" | "loading" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function SubscribeForm({
  compact = false,
  submitLabel = "Quero receber grátis",
  source = "landing",
  onFocusChange,
  onSuccess,
}: {
  compact?: boolean;
  submitLabel?: string;
  source?: string;
  onFocusChange?: (focused: boolean) => void;
  onSuccess?: () => void;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);

    // Honeypot: humanos nao veem este campo. Bots preenchem e sao descartados em silencio.
    if (data.get("empresa")) {
      setStatus("success");
      setMessage("Inscrição registrada.");
      return;
    }

    if (!EMAIL_RE.test(email)) {
      setStatus("error");
      setMessage("Confira o e-mail. Ponto farejou um erro de digitação.");
      return;
    }

    setStatus("loading");
    setMessage("");

    // Canal de origem (twitter, linkedin, ...) capturado da URL, separado do
    // `source` (qual form da pagina). Vai junto no evento e no cadastro.
    const attribution = getAttribution();
    track("subscribe_submit", { source, ...attribution });

    // Chama a route handler no servidor (app/api/subscribe/route.ts), que fala
    // com o Beehiiv usando a chave em variavel de ambiente. A chave nunca chega
    // ao client. O honeypot "empresa" tambem vai no corpo (a rota o trata).
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          empresa: (data.get("empresa") as string) || "",
          source,
          ...attribution,
        }),
      });

      if (res.ok) {
        track("subscribe_success", { source, ...attribution });
        setStatus("success");
        setMessage(
          "Pronto. A próxima edição chega às 8h. Ponto abanou o rabo, o que é raro.",
        );
        onSuccess?.();
        return;
      }

      // A rota devolve erros tipados; traduz para a voz do Ponto sem vazar detalhe.
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      track("subscribe_error", {
        source,
        ...attribution,
        reason: payload.error ?? String(res.status),
      });
      if (res.status === 429) {
        setMessage("Muitas tentativas. Respire e tente de novo em um minuto.");
      } else if (payload.error === "invalid_email") {
        setMessage("Confira o e-mail. Ponto farejou um erro de digitação.");
      } else {
        setMessage("Algo falhou no envio. Tente de novo em instantes.");
      }
      setStatus("error");
    } catch {
      track("subscribe_error", { source, ...attribution, reason: "network" });
      setMessage("Sem conexão com o servidor. Tente de novo em instantes.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p
        role="status"
        aria-live="polite"
        className="tl-fade-in rounded border border-green-600 bg-green-100 px-4 py-3 text-sm font-medium text-green-700"
      >
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <div className={`flex w-full gap-3 ${compact ? "" : "flex-col sm:flex-row"}`}>
        <label htmlFor={`${id}-email`} className="sr-only">
          Seu melhor e-mail
        </label>
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? `${id}-erro` : undefined}
          className={`h-12 min-w-0 flex-1 rounded-sm border bg-surface px-4 text-base text-ink placeholder:text-gray-400 focus-visible:border-blue-600 ${
            status === "error" ? "border-red-600" : "border-line"
          }`}
        />
        {/* honeypot */}
        <div className="absolute left-[-9999px]" aria-hidden="true">
          <label htmlFor={`${id}-empresa`}>Não preencha este campo</label>
          <input id={`${id}-empresa`} type="text" name="empresa" tabIndex={-1} autoComplete="off" />
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="tl-press h-12 shrink-0 rounded bg-green-600 px-6 text-base font-semibold text-paper hover:bg-green-700 disabled:bg-gray-400/40 disabled:text-gray-500"
        >
          {status === "loading" ? "Enviando…" : submitLabel}
        </button>
      </div>
      <div aria-live="polite">
        {status === "error" && (
          <p id={`${id}-erro`} className="mt-2 text-sm text-red-600">
            {message}
          </p>
        )}
      </div>
      {!compact && (
        <p className="mt-3 text-sm text-gray-500">
          De graça. Sem promessa de milha grátis. Cancela quando quiser, em um clique.
        </p>
      )}
    </form>
  );
}
