"use server";

import { revalidatePath } from "next/cache";
import { snapshotAll } from "@/lib/admin-predict";
import { readOverridePayload, saveOverride, removeOverrideById } from "@/lib/admin-overrides";
import type { ActionState } from "@/components/admin/toast";

const who = () => process.env.ADMIN_USER?.trim() || "admin";

// Fixar/silenciar uma série a partir do Predict. Mesma tabela do Forecast
// (o efeito vale nas duas áreas); override de confiança NÃO é permitido aqui —
// a confiança do Predict nasce de CV + backtest.
export async function setOverrideAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const res = await saveOverride(readOverridePayload(fd), who(), ["pin", "mute"]);
  if (res.ok) {
    revalidatePath("/admin/predict");
    revalidatePath("/admin/forecast");
  }
  return res;
}

export async function removeOverrideAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const res = await removeOverrideById(String(fd.get("id") || ""));
  if (res.ok) {
    revalidatePath("/admin/predict");
    revalidatePath("/admin/forecast");
  }
  return res;
}

// Persiste o snapshot observável de TODAS as séries do dia (upsert idempotente
// por série + as_of_date). Inclui bloqueadas — o registro documenta o gate.
export async function snapshotAllAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    const { count, asOf } = await snapshotAll(who());
    revalidatePath("/admin/predict");
    return { ok: true, message: `${count} séries snapshotadas (as_of ${asOf})` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao snapshotar" };
  }
}
