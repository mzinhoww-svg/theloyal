// Persistência da revisão assistida de datas (Trilha D). Server-only.
// Aplicar = corrigir vigencia_inicio da campanha (prioridade máxima do
// windowDate — o id com a data errada fica intacto e auditável) + gravar a
// decisão em campaign_date_reviews. Rejeitar = só gravar a decisão (a proposta
// some da fila, a campanha continua bloqueada pelo C0.2).

import { restResult, insert, patch } from "./admin-db";
import type { DateCorrectionProposal } from "./date-review";

export type DateReviewRow = {
  id: string;
  campaign_id: string;
  route: string | null;
  old_event_date: string | null;
  proposed_date: string;
  action: "applied" | "rejected";
  decided_by: string | null;
  created_at: string | null;
};

export const getDateReviewsResult = (limit = 200) =>
  restResult<DateReviewRow>(
    `campaign_date_reviews?select=id,campaign_id,route,old_event_date,proposed_date,action,decided_by,created_at&order=created_at.desc&limit=${limit}`,
  );
export const getDateReviews = async (limit = 200) => (await getDateReviewsResult(limit)).rows;

async function recordReview(
  p: DateCorrectionProposal,
  action: "applied" | "rejected",
  by: string,
): Promise<void> {
  await insert("campaign_date_reviews", {
    campaign_id: p.campaignId,
    route: p.route,
    old_event_date: p.currentEventDate,
    proposed_date: p.proposedDate,
    action,
    evidence: p.evidence,
    decided_by: by,
  });
}

export async function applyDateCorrection(p: DateCorrectionProposal, by: string): Promise<void> {
  await patch("campaigns", `id=eq.${encodeURIComponent(p.campaignId)}`, {
    vigencia_inicio: p.proposedDate,
  });
  await recordReview(p, "applied", by);
}

export async function rejectDateCorrection(p: DateCorrectionProposal, by: string): Promise<void> {
  await recordReview(p, "rejected", by);
}
