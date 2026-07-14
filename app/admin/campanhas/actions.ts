"use server";

import { revalidatePath } from "next/cache";
import { patch } from "@/lib/admin-db";
import { VERDICTS } from "./constants";

// Edição inline do veredito e do TL Score de uma campanha.
export async function updateCampaignAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") || "");
  if (!id) return;

  const verdictRaw = String(formData.get("verdict") || "");
  const scoreRaw = String(formData.get("tl_score") || "").trim();

  const body: Record<string, unknown> = {};
  if ((VERDICTS as readonly string[]).includes(verdictRaw)) {
    body.verdict = verdictRaw;
  } else if (verdictRaw === "") {
    body.verdict = null;
  }

  if (scoreRaw === "") {
    body.tl_score = null;
  } else {
    const n = Number(scoreRaw);
    if (Number.isFinite(n)) body.tl_score = Math.max(0, Math.min(100, Math.round(n)));
  }

  if (Object.keys(body).length > 0) {
    await patch("campaigns", `id=eq.${encodeURIComponent(id)}`, body);
  }
  revalidatePath("/admin/campanhas");
  revalidatePath("/admin");
}
