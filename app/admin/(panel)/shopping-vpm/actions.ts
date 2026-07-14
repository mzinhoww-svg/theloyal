"use server";

import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/admin-db";
import type { ActionState } from "@/components/admin/toast";

// Recalcula métricas + comparações + benchmarks (backend, RPC shopping_recompute).
export async function recomputeShoppingAction(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  try {
    const res = (await rpc<Record<string, unknown>>("shopping_recompute", {})) as { comparisons?: number; benchmarks?: number } | null;
    if (res == null) return { ok: false, message: "sem conexão com o Supabase (SERVICE key ausente?)" };
    revalidatePath("/admin/shopping-vpm");
    return { ok: true, message: `recalculado — ${res.comparisons ?? 0} comparações, ${res.benchmarks ?? 0} benchmarks` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao recalcular" };
  }
}

// Dispara a coleta headless no GitHub Actions (workflow shopping-collect.yml).
// O trabalho pesado (Playwright) roda lá, não em serverless. Sem token → erro claro.
export async function collectShoppingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const token = process.env.GH_DISPATCH_TOKEN?.trim();
  const repo = process.env.GH_REPO?.trim() || "mzinhoww-svg/theloyal";
  const ref = process.env.GH_COLLECT_REF?.trim() || "claude/loyalty-landing-page-v1-7vbjq7";
  const mock = String(fd.get("mock") || "") === "1";
  if (!token) return { ok: false, message: "GH_DISPATCH_TOKEN ausente — configure para disparar a coleta" };
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/shopping-collect.yml/dispatches`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json" },
      body: JSON.stringify({ ref, inputs: { mock: mock ? "true" : "false" } }),
    });
    if (res.status !== 204) {
      const detail = await res.text().catch(() => "");
      return { ok: false, message: `dispatch falhou (${res.status}) ${detail.slice(0, 160)}` };
    }
    return { ok: true, message: `coleta disparada no Actions (${mock ? "mock" : "live"}) — acompanhe em Execuções` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao disparar coleta" };
  }
}
