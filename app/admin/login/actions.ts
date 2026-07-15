"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, tokenHash, safeEqual, issueSession } from "@/lib/admin-auth";

export type LoginState = { error: string | null };

// Valida a senha contra ADMIN_TOKEN e grava o cookie de sessão (hash).
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return { error: "ADMIN_TOKEN não configurado no servidor." };

  const senha = String(formData.get("senha") || "");
  // BKL-08: comparação em tempo constante (hash dos dois lados iguala o
  // comprimento e o safeEqual não vaza por timing).
  const ok = safeEqual(await tokenHash(senha), await tokenHash(token));
  if (!ok) return { error: "Senha incorreta." };

  const next = String(formData.get("next") || "/admin");
  const dest = next.startsWith("/admin") ? next : "/admin";

  // Sessão assinada com expiração — rotacionada a cada login (BKL-08).
  const session = await issueSession(token);
  cookies().set(ADMIN_COOKIE, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
  });
  redirect(dest);
}

export async function logout(): Promise<void> {
  cookies().delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
