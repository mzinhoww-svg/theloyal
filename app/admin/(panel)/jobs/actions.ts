"use server";

import { revalidatePath } from "next/cache";
import {
  getJobs,
  runNow,
  toggleJob,
  RUN_TARGETS,
  type RunTarget,
} from "@/lib/admin-db";
import type { ActionState } from "@/components/admin/toast";

function isRunTarget(v: string): v is RunTarget {
  return (RUN_TARGETS as readonly string[]).includes(v);
}

export async function toggleJobAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const jobname = String(formData.get("jobname") || "");
  const active = String(formData.get("active")) === "true";
  if (!jobname) return { ok: false, message: "job ausente" };
  const msg = await toggleJob(jobname, active);
  revalidatePath("/admin/jobs");
  revalidatePath("/admin");
  return { ok: true, message: msg || `${jobname} → ${active ? "ativo" : "pausado"}` };
}

export async function runNowAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const fn = String(formData.get("fn") || "");
  if (!isRunTarget(fn)) return { ok: false, message: `alvo inválido: ${fn}` };
  const msg = await runNow(fn);
  revalidatePath("/admin/jobs");
  revalidatePath("/admin");
  revalidatePath("/admin/logs");
  return { ok: true, message: msg || `disparado ${fn}` };
}

// Pausar/ativar TODOS os crons de um grupo de uma vez.
export async function bulkToggleGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const grupo = String(formData.get("grupo") || "");
  const active = String(formData.get("active")) === "true";
  if (!grupo) return { ok: false, message: "grupo ausente" };
  const jobs = (await getJobs()) ?? [];
  const alvo = jobs.filter((j) => j.grupo === grupo);
  await Promise.all(alvo.map((j) => toggleJob(j.jobname, active)));
  revalidatePath("/admin/jobs");
  revalidatePath("/admin");
  return {
    ok: true,
    message: `${alvo.length} crons de ${grupo} → ${active ? "ativos" : "pausados"}`,
  };
}
