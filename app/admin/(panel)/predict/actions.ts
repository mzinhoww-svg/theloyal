"use server";

import { revalidatePath } from "next/cache";
import { loadPredict, saveSnapshot } from "@/lib/admin-predict";
import type { ActionState } from "@/components/admin/toast";

// Persiste o snapshot observável de TODAS as séries do dia (upsert idempotente
// por série + as_of_date). Inclui bloqueadas — o registro documenta o gate.
export async function snapshotAllAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    const { result } = await loadPredict();
    const all = [...result.clusters, ...result.routes];
    for (const p of all) await saveSnapshot(p);
    revalidatePath("/admin/predict");
    return { ok: true, message: `${all.length} séries snapshotadas (as_of ${result.asOf})` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao snapshotar" };
  }
}
