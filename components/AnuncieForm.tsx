"use client";

import { useId, useState, type FormEvent } from "react";
import { track } from "@/lib/track";

type Status = "idle" | "loading" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function AnuncieForm() {
  const id = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);

    if (data.get("empresa")) {
      setStatus("success");
      setMessage("Recebido. Retornamos em breve.");
      return;
    }

    const email = String(data.get("email") ?? "").trim();
    if (!EMAIL_RE.test(email)) {
      setStatus("error");
      setMessage("Confira o e-mail informado.");
      return;
    }

    setStatus("loading");
    setMessage("");
    track("anuncie_submit");
    try {
      const res = await fetch("/api/contato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: String(data.get("nome") ?? ""),
          email,
          empresa_nome: String(data.get("empresa_nome") ?? ""),
          mensagem: String(data.get("mensagem") ?? ""),
          empresa: String(data.get("empresa") ?? ""),
        }),
      });
      if (res.ok) {
        setStatus("success");
        setMessage("Recebido. Retornamos com o media kit e as opções de patrocínio.");
        return;
      }
      if (res.status === 429) {
        setStatus("error");
        setMessage("Muitas tentativas. Tente de novo em um minuto.");
        return;
      }
      setStatus("error");
      setMessage("Algo falhou no envio. Tente de novo em instantes.");
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

  const field =
    "h-12 w-full rounded-sm border border-line bg-surface px-4 text-base text-ink placeholder:text-gray-400 focus-visible:border-blue-600";

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-nome`} className="sr-only">
            Seu nome
          </label>
          <input id={`${id}-nome`} name="nome" type="text" autoComplete="name" placeholder="Seu nome" className={field} />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className="sr-only">
            E-mail corporativo
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="E-mail corporativo"
            aria-invalid={status === "error"}
            className={field}
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-empresa-nome`} className="sr-only">
          Empresa
        </label>
        <input id={`${id}-empresa-nome`} name="empresa_nome" type="text" autoComplete="organization" placeholder="Empresa" className={field} />
      </div>
      <div>
        <label htmlFor={`${id}-mensagem`} className="sr-only">
          Sobre a campanha
        </label>
        <textarea
          id={`${id}-mensagem`}
          name="mensagem"
          rows={4}
          placeholder="Conte, em uma linha, o que você quer alcançar."
          className="w-full rounded-sm border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-gray-400 focus-visible:border-blue-600"
        />
      </div>
      {/* honeypot */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor={`${id}-empresa`}>Não preencha este campo</label>
        <input id={`${id}-empresa`} name="empresa" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="h-12 rounded bg-green-600 px-6 text-base font-semibold text-paper transition-colors duration-150 hover:bg-green-700 active:translate-y-px disabled:bg-gray-400/40 disabled:text-gray-500"
      >
        {status === "loading" ? "Enviando…" : "Falar sobre patrocínio"}
      </button>
      <div aria-live="polite">
        {status === "error" && <p className="text-sm text-red-600">{message}</p>}
      </div>
    </form>
  );
}
