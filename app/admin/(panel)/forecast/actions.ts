"use server";

import { revalidatePath } from "next/cache";
import { patch, insert, del } from "@/lib/admin-db";
import { loadForecast } from "@/lib/admin-forecast";
import type { ActionState } from "@/components/admin/toast";

const who = () => process.env.ADMIN_USER?.trim() || "admin";

function num(fd: FormData, key: string, min: number, max: number): number | null {
  const raw = String(fd.get(key) ?? "").trim().replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

// Salva os parâmetros do motor (forecast_config, linha singleton id=1).
export async function saveConfigAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: who() };
  const map: [string, string, number, number][] = [
    ["wave_epsilon_days", "wave_epsilon_days", 0, 14],
    ["min_samples", "min_samples", 2, 10],
    ["samples_media", "samples_media", 2, 12],
    ["samples_alta", "samples_alta", 2, 15],
    ["cv_media", "cv_media", 0, 3],
    ["cv_alta", "cv_alta", 0, 3],
    ["horizon_daily", "horizon_daily", 1, 60],
    ["horizon_weekly", "horizon_weekly", 1, 120],
  ];
  for (const [col, key, lo, hi] of map) {
    const v = num(fd, key, lo, hi);
    if (v != null) body[col] = col.startsWith("cv_") ? v : Math.round(v);
  }
  if (Object.keys(body).length <= 2) return { ok: false, message: "nada para salvar" };
  try {
    await patch("forecast_config", "id=eq.1", body);
    revalidatePath("/admin/forecast");
    revalidatePath("/admin/observability");
    return { ok: true, message: "parâmetros do motor salvos" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao salvar config" };
  }
}

// Cria/atualiza um override por rota ou programa (pin | mute | confidence).
export async function setOverrideAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const scope = String(fd.get("scope") || "");
  const route = String(fd.get("route") || "").trim();
  const action = String(fd.get("action") || "");
  const confidence = String(fd.get("confidence") || "").trim();
  const note = String(fd.get("note") || "").trim();

  if (!["route", "cluster"].includes(scope)) return { ok: false, message: "escopo inválido" };
  if (!route) return { ok: false, message: "rota ausente" };
  if (!["pin", "mute", "confidence"].includes(action)) return { ok: false, message: "ação inválida" };
  if (action === "confidence" && !["alta", "media", "baixa"].includes(confidence))
    return { ok: false, message: "confiança inválida para override de confiança" };

  const rowData = {
    scope,
    route,
    action,
    confidence: action === "confidence" ? confidence : null,
    note: note || null,
    created_at: new Date().toISOString(),
    created_by: who(),
  };
  try {
    await insert("forecast_overrides", rowData, { onConflict: "scope,route" });
    revalidatePath("/admin/forecast");
    return { ok: true, message: `override ${action} salvo para ${route}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao salvar override" };
  }
}

export async function removeOverrideAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const id = String(fd.get("id") || "");
  if (!id) return { ok: false, message: "id ausente" };
  try {
    await del("forecast_overrides", `id=eq.${encodeURIComponent(id)}`);
    revalidatePath("/admin/forecast");
    return { ok: true, message: "override removido" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao remover" };
  }
}

// Recalcula a previsão agora e grava um snapshot histórico (config + payload).
export async function recalcSnapshotAction(
  _prev: ActionState,
  _fd: FormData,
): Promise<ActionState> {
  try {
    const data = await loadForecast();
    await insert("forecast_snapshots", {
      generated_for: data.generatedFor,
      routes_tracked: data.result.routesTracked,
      clusters_tracked: data.result.clustersTracked,
      with_prediction: data.result.withPrediction,
      config: data.config,
      payload: { routes: data.result.routes, clusters: data.result.clusters },
      created_by: who(),
    });
    revalidatePath("/admin/forecast");
    return {
      ok: true,
      message: `snapshot salvo — ${data.result.withPrediction} séries com previsão em ${data.generatedFor}`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao salvar snapshot" };
  }
}
