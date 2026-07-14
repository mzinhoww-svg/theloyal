"use server";

import { revalidatePath } from "next/cache";
import { patch, runNow } from "@/lib/admin-db";

// Reprocessar uma URL: volta status para 'pending' e dispara backfill agora.
export async function reprocessAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await patch("backfill_queue", `id=eq.${encodeURIComponent(id)}`, {
    status: "pending",
    error_msg: null,
    processed_at: null,
  });
  await runNow("backfill");
  revalidatePath("/admin/backfill");
}

export async function runBackfillAction(): Promise<void> {
  await runNow("backfill-daily");
  revalidatePath("/admin/backfill");
  revalidatePath("/admin");
}
