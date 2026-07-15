"use client";

import { useId, useState, type FormEvent } from "react";
import { track } from "@/lib/track";

type Status = "idle" | "loading" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const PERFIS = [
  { value: "consumidor", label: "Uso pontos de vez em quando" },
  { value: "heavy-user", label: "Já acumulo bastante" },
  { value: "profissional", label: "Trabalho com o assunto" },
] as const;

export function ProWaitlist() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState<string>("consumidor");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (data.get("empresa")) {
      setStatus("success");
      setMessage("Você está na lista.");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setStatus("error");
      setMessage("Confira o e-mail. Ponto farejou um erro de digitação.");
      return;
    }
    setStatus("loading");
    setMessage("");
    track("waitlist_submit", { source: "pro-waitlist", perfil });
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          empresa: String(data.get("empresa") ?? ""),
          source: "pro-waitlist",
          perfil,
        }),
      });
      if (res.ok) {
        track("waitlist_success", { source: "pro-waitlist", perfil });
        setStatus("success");
        setMessage("Você está na lista. Avisamos quando o Pro abrir para o seu perfil.");
        return;
      }
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setStatus("error");
      setMessage(
        res.status === 429
          ? "Muitas tentativas. Tente de novo em um minuto."
          : payload.error === "invalid_email"
            ? "Confira o e-mail. Ponto farejou um erro de digitação."
            : "Algo falhou no envio. Tente de novo em instantes.",
      );
    } catch {
      setStatus("error");
      setMessage("Sem conexão com o servidor. Tente de novo em instantes.");
    }
  }

  if (status === "success") {
    return (
      <p
        role="status"
        aria-live="polite"
        className="rounded border border-green-600 bg-green-100 px-4 py-3 text-sm font-medium text-green-700"
      >
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <fieldset className="mb-4">
        <legend className="mb-2 text-sm font-semibold text-ink">Seu perfil</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PERFIS.map((p) => (
            <label
              key={p.value}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-sm ${
                perfil === p.value ? "border-blue-600 bg-blue-100 text-ink" : "border-line bg-surface text-gray-500"
              }`}
            >
              <input
                type="radio"
                name="perfil"
                value={p.value}
                checked={perfil === p.value}
                onChange={() => setPerfil(p.value)}
                className="accent-blue-600"
              />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">
          Seu melhor e-mail
        </label>
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          aria-invalid={status === "error"}
          className={`h-12 min-w-0 flex-1 rounded-sm border bg-surface px-4 text-base text-ink placeholder:text-gray-400 focus-visible:border-blue-600 ${
            status === "error" ? "border-red-600" : "border-line"
          }`}
        />
        <div className="absolute left-[-9999px]" aria-hidden="true">
          <label htmlFor={`${id}-empresa`}>Não preencha este campo</label>
          <input id={`${id}-empresa`} name="empresa" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="h-12 shrink-0 rounded bg-green-600 px-6 text-base font-semibold text-paper transition-colors duration-150 hover:bg-green-700 active:translate-y-px disabled:bg-gray-400/40 disabled:text-gray-500"
        >
          {status === "loading" ? "Enviando…" : "Entrar na lista"}
        </button>
      </div>
      <div aria-live="polite">
        {status === "error" && <p className="mt-2 text-sm text-red-600">{message}</p>}
      </div>
      <p className="mt-3 text-sm text-gray-500">
        Sem promessa de retorno financeiro. Avisamos quando abrir, e você decide.
      </p>
    </form>
  );
}
