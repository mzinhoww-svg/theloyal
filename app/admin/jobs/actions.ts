"use server";

import { revalidatePath } from "next/cache";
import {
  getJobs,
  runNow,
  toggleJob,
  RUN_TARGETS,
  type RunTarget,
} from "@/lib/admin-db";

function isRunTarget(v: string): v is RunTarget {
  return (RUN_TARGETS as readonly string[]).includes(v);
}

export async function toggleJobAction(formData: FormData): Promise<void> {
  const jobname = String(formData.get("jobname") || "");
  const active = String(formData.get("active")) === "true";
  if (jobname) await toggleJob(jobname, active);
  revalidatePath("/admin/jobs");
  revalidatePath("/admin");
}

export async function runNowAction(formData: FormData): Promise<void> {
  const fn = String(formData.get("fn") || "");
  if (isRunTarget(fn)) await runNow(fn);
  revalidatePath("/admin/jobs");
  revalidatePath("/admin");
  revalidatePath("/admin/logs");
}

// Pausar/ativar TODOS os crons de um grupo de uma vez.
export async function bulkToggleGroupAction(formData: FormData): Promise<void> {
  const grupo = String(formData.get("grupo") || "");
  const active = String(formData.get("active")) === "true";
  if (!grupo) return;
  const jobs = (await getJobs()) ?? [];
  await Promise.all(
    jobs
      .filter((j) => j.grupo === grupo)
      .map((j) => toggleJob(j.jobname, active)),
  );
  revalidatePath("/admin/jobs");
  revalidatePath("/admin");
}
