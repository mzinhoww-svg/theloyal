"use client";

import { useFormState } from "react-dom";
import { login, type LoginState } from "./actions";
import { SubmitButton } from "@/components/admin/SubmitButton";

const initial: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useFormState(login, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-gray-700">Senha do painel</span>
        <input
          type="password"
          name="senha"
          autoComplete="current-password"
          required
          autoFocus
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-erro" : undefined}
          className="min-h-[44px] rounded border border-line bg-surface px-3 text-ink"
        />
      </label>
      {state.error && (
        <p id="login-erro" role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton variant="primary" pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}
