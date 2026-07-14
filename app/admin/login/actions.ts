"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, tokenHash } from "@/lib/admin-auth";

export type LoginState = { error: string | null };

// Valida a senha contra ADMIN_TOKEN e grava o cookie de sessão (hash).
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return { error: "ADMIN_TOKEN não configurado no servidor." };

  const senha = String(formData.get("senha") || "");
  if (senha !== token) return { error: "Senha incorreta." };

  const next = String(formData.get("next") || "/admin");
  const dest = next.startsWith("/admin") ? next : "/admin";

  cookies().set(ADMIN_COOKIE, await tokenHash(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(dest);
}

export async function logout(): Promise<void> {
  cookies().delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
