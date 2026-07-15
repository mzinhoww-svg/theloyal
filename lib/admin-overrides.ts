// Persistência compartilhada dos overrides de série (forecast_overrides) —
// usada pelas actions do Forecast e do Predict. Server-only (admin-db).
// A validação é pura para ser testável; o insert é upsert por scope+route.

import { insert, del } from "./admin-db";

export type OverrideResult = { ok: boolean; message: string };

export interface OverridePayload {
  scope: string;
  route: string;
  action: string;
  confidence: string;
  note: string;
}

export function readOverridePayload(fd: FormData): OverridePayload {
  return {
    scope: String(fd.get("scope") || ""),
    route: String(fd.get("route") || "").trim(),
    action: String(fd.get("action") || ""),
    confidence: String(fd.get("confidence") || "").trim(),
    note: String(fd.get("note") || "").trim(),
  };
}

// Valida o payload; `allowedActions` restringe por área (Predict só pin/mute).
export function validateOverride(
  p: OverridePayload,
  allowedActions: string[] = ["pin", "mute", "confidence"],
): string | null {
  if (!["route", "cluster"].includes(p.scope)) return "escopo inválido";
  if (!p.route) return "rota ausente";
  if (!allowedActions.includes(p.action)) return "ação inválida";
  if (p.action === "confidence" && !["alta", "media", "baixa"].includes(p.confidence))
    return "confiança inválida para override de confiança";
  return null;
}

export async function saveOverride(
  p: OverridePayload,
  by: string,
  allowedActions?: string[],
): Promise<OverrideResult> {
  const invalid = validateOverride(p, allowedActions);
  if (invalid) return { ok: false, message: invalid };
  try {
    await insert(
      "forecast_overrides",
      {
        scope: p.scope,
        route: p.route,
        action: p.action,
        confidence: p.action === "confidence" ? p.confidence : null,
        note: p.note || null,
        created_at: new Date().toISOString(),
        created_by: by,
      },
      { onConflict: "scope,route" },
    );
    return { ok: true, message: `override ${p.action} salvo para ${p.route}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao salvar override" };
  }
}

export async function removeOverrideById(id: string): Promise<OverrideResult> {
  if (!id) return { ok: false, message: "id ausente" };
  try {
    await del("forecast_overrides", `id=eq.${encodeURIComponent(id)}`);
    return { ok: true, message: "override removido" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao remover" };
  }
}
