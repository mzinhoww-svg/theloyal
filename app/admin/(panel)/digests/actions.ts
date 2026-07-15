"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/admin/toast";
import { getEdition, gatesPass } from "@/lib/admin-digests";
import {
  saveDraft,
  getDraft,
  runQa,
  saveQaReport,
  materializeDraft,
  markDraft,
  markEdition,
  logEvent,
  dispatchBeehiiv,
  fetchBeehiivStats,
  type BeehiivAction,
} from "@/lib/admin-digest-ops";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || null;
const draftId = (product: string, date: string) => `${product}-${date}`;

// ---------- Fase 3: curadoria ----------

export async function createDraftAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const product = str(fd, "product") ?? "daily";
  const date = str(fd, "date");
  if (!date) return { ok: false, message: "informe a data da edição" };
  const id = draftId(product, date);
  const deal_ids = fd.getAll("deal_ids").map(String).filter(Boolean);
  try {
    await saveDraft({
      id,
      product,
      date,
      subject: str(fd, "subject"),
      sinal: str(fd, "sinal"),
      destaque: str(fd, "destaque"),
      notes: str(fd, "notes"),
      deal_ids,
      status: "draft",
    });
    await logEvent(id, "curated", { deals: deal_ids.length });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao criar rascunho" };
  }
  redirect(`/admin/digests/drafts/${encodeURIComponent(id)}`);
}

export async function saveDraftAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const date = str(fd, "date");
  const product = str(fd, "product") ?? "daily";
  if (!id || !date) return { ok: false, message: "rascunho inválido" };
  const deal_ids = fd.getAll("deal_ids").map(String).filter(Boolean);
  try {
    await saveDraft({
      id,
      product,
      date,
      subject: str(fd, "subject"),
      sinal: str(fd, "sinal"),
      destaque: str(fd, "destaque"),
      notes: str(fd, "notes"),
      deal_ids,
      status: "draft",
    });
    await logEvent(id, "curated", { deals: deal_ids.length });
    revalidatePath(`/admin/digests/drafts/${id}`);
    return { ok: true, message: `rascunho salvo — ${deal_ids.length} campanhas no Deal Desk` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao salvar" };
  }
}

export async function runQaDraftAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  if (!id) return { ok: false, message: "rascunho inválido" };
  try {
    const d = await getDraft(id);
    if (!d) return { ok: false, message: "rascunho não encontrado" };
    const r = runQa(d);
    await saveQaReport(id, "draft", r);
    await logEvent(id, "qa", { passed: r.passed, blocking: r.blocking, score: r.score });
    revalidatePath(`/admin/digests/drafts/${id}`);
    const head = r.blocking ? "BLOQUEADO" : r.passed ? "aprovado" : "com avisos";
    return { ok: !r.blocking, message: `QA ${head} — score ${r.score}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha no QA" };
  }
}

// Materializa o rascunho no ledger de edições (vira uma edição curada).
export async function materializeDraftAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  if (!id) return { ok: false, message: "rascunho inválido" };
  try {
    const d = await getDraft(id);
    if (!d) return { ok: false, message: "rascunho não encontrado" };
    await materializeDraft(d);
    revalidatePath(`/admin/digests/drafts/${id}`);
    revalidatePath("/admin/digests");
    return { ok: true, message: `edição ${id} materializada no ledger` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao materializar" };
  }
}

// ---------- Fase 5: aprovação (guardada por QA) ----------

export async function approveDraftAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  if (!id) return { ok: false, message: "rascunho inválido" };
  try {
    const d = await getDraft(id);
    if (!d) return { ok: false, message: "rascunho não encontrado" };
    const r = runQa(d);
    await saveQaReport(id, "draft", r);
    if (r.blocking) {
      await logEvent(id, "approve-blocked", { findings: r.findings });
      return { ok: false, message: `bloqueado pelo QA — ${r.findings.find((f) => f.level === "block")?.message}` };
    }
    if (!r.passed) return { ok: false, message: "rascunho incompleto (assunto + ≥1 campanha)" };
    await markDraft(id, { status: "approved" });
    await materializeDraft(d);
    await markEdition(id, { approved_by: "admin", approved_at: new Date().toISOString() });
    await logEvent(id, "approved", { score: r.score });
    revalidatePath(`/admin/digests/drafts/${id}`);
    revalidatePath("/admin/digests");
    return { ok: true, message: `aprovado e materializado — score ${r.score}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao aprovar" };
  }
}

// ---------- Fase 2/5: dispatch Beehiiv (com guardrail) ----------

async function dispatchGuarded(fd: FormData, action: BeehiivAction): Promise<ActionState> {
  const editionId = str(fd, "edition_id");
  const editionPath = str(fd, "edition_path"); // caminho content/ opcional
  const scheduleAt = str(fd, "schedule_at") ?? undefined;

  if (action !== "draft" && editionId) {
    const e = await getEdition(editionId);
    if (e && !gatesPass(e)) {
      return { ok: false, message: "gates não passaram — rode o QA/validate antes de publicar" };
    }
  }
  const res = await dispatchBeehiiv(action, { edition: editionPath ?? undefined, scheduleAt });
  if (editionId) {
    await logEvent(editionId, action === "draft" ? "beehiiv-draft" : action === "publish" ? "published" : "scheduled", {
      ok: res.ok,
      scheduleAt,
    });
    if (res.ok && action === "schedule" && scheduleAt) await markEdition(editionId, { scheduled_at: scheduleAt });
    if (res.ok && action === "publish") await markEdition(editionId, { published_at: new Date().toISOString() });
    revalidatePath(`/admin/digests/${editionId}`);
  }
  return res;
}

export const beehiivDraftAction = (_p: ActionState, fd: FormData) => dispatchGuarded(fd, "draft");
export const beehiivPublishAction = (_p: ActionState, fd: FormData) => dispatchGuarded(fd, "publish");
export const beehiivScheduleAction = (_p: ActionState, fd: FormData) => dispatchGuarded(fd, "schedule");

// ---------- Fase 6: métricas ----------

export async function refreshStatsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const editionId = str(fd, "edition_id");
  const postId = str(fd, "post_id");
  if (!editionId || !postId) return { ok: false, message: "edição sem post no Beehiiv" };
  try {
    const res = await fetchBeehiivStats(editionId, postId);
    await logEvent(editionId, "stats", { ok: res.ok });
    revalidatePath(`/admin/digests/${editionId}`);
    return res;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao buscar métricas" };
  }
}
