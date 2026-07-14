"use server";

import { revalidatePath } from "next/cache";
import { patch, runNow } from "@/lib/admin-db";
import type { ActionState } from "@/components/admin/toast";

// Reprocessar uma URL: volta status para 'pending' e dispara backfill agora.
export async function reprocessAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") || "");
  if (!id) return { ok: false, message: "id ausente" };
  try {
    await patch("backfill_queue", `id=eq.${encodeURIComponent(id)}`, {
      status: "pending",
      error_msg: null,
      processed_at: null,
    });
    const msg = await runNow("backfill");
    revalidatePath("/admin/backfill");
    return { ok: true, message: msg || "URL reenfileirada" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao reprocessar" };
  }
}

export async function runBackfillAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const msg = await runNow("backfill-daily");
  revalidatePath("/admin/backfill");
  revalidatePath("/admin");
  return { ok: true, message: msg || "backfill-daily disparado" };
}
