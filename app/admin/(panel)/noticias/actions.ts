"use server";

import { revalidatePath } from "next/cache";
import { patch, runNow } from "@/lib/admin-db";
import type { ActionState } from "@/components/admin/toast";

// Reprocessar uma notícia: volta pra fila (processed=false, limpa erro) e
// dispara o extrator (edge function "campaigns", que consome news_raw pendente).
export async function reprocessNewsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") || "");
  if (!id) return { ok: false, message: "id ausente" };
  try {
    await patch("news_raw", `id=eq.${encodeURIComponent(id)}`, {
      processed: false,
      error: null,
    });
    const msg = await runNow("campaigns");
    revalidatePath("/admin/noticias");
    revalidatePath("/admin");
    return { ok: true, message: msg || "notícia reenfileirada" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao reprocessar" };
  }
}

export async function runExtractAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const msg = await runNow("campaigns");
  revalidatePath("/admin/noticias");
  revalidatePath("/admin");
  revalidatePath("/admin/logs");
  return { ok: true, message: msg || "extração disparada" };
}
