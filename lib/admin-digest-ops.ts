// Operações do centro de controle de digests (fases 2–7). Server-only:
// curadoria de rascunho, QA com guardrails, agenda/aprovação, métricas do
// Beehiiv e trilha de auditoria. Usa a SERVICE_ROLE_KEY (admin-db) e o
// workflow_dispatch do GitHub (mesmo padrão do coletor). Nunca no client.

import { rest, insert, patch } from "./admin-db";

// ---------- Tipos ----------

export type EditionDraft = {
  id: string;
  product: string;
  date: string;
  subject: string | null;
  sinal: string | null;
  destaque: string | null;
  deal_ids: string[];
  notes: string | null;
  status: string;
  version: number;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type QaLevel = "ok" | "warn" | "block";
export type QaFinding = { rule: string; level: QaLevel; message: string };
export type QaReport = {
  id: string;
  target_id: string;
  target_kind: string;
  passed: boolean;
  blocking: boolean;
  score: number | null;
  findings: QaFinding[];
  created_by: string | null;
  created_at: string | null;
};

export type EditionStat = {
  edition_id: string;
  beehiiv_post_id: string | null;
  recipients: number | null;
  opens: number | null;
  clicks: number | null;
  open_rate: number | null;
  click_rate: number | null;
  fetched_at: string | null;
};

export type EditionEvent = {
  id: string;
  target_id: string;
  action: string;
  actor: string | null;
  detail: Record<string, unknown> | null;
  at: string | null;
};

export type CandidateCampaign = {
  id: string;
  origem: string | null;
  destino: string | null;
  tipo: string | null;
  percentual: number | null;
  tl_score: number | null;
  verdict: string | null;
  status: string | null;
  vigencia_fim: string | null;
  observed_at: string | null;
};

// ---------- Leituras ----------

export const getDrafts = (limit = 50) =>
  rest<EditionDraft>(
    `edition_drafts?select=*&order=updated_at.desc.nullslast&limit=${limit}`,
  );

export async function getDraft(id: string): Promise<EditionDraft | null> {
  const rows = await rest<EditionDraft>(
    `edition_drafts?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  return rows[0] ?? null;
}

export const getQaReports = (targetId: string, limit = 5) =>
  rest<QaReport>(
    `edition_qa_reports?select=*&target_id=eq.${encodeURIComponent(targetId)}&order=created_at.desc&limit=${limit}`,
  );

export async function getStats(editionId: string): Promise<EditionStat | null> {
  const rows = await rest<EditionStat>(
    `edition_stats?select=*&edition_id=eq.${encodeURIComponent(editionId)}&limit=1`,
  );
  return rows[0] ?? null;
}

export const getEvents = (targetId: string, limit = 30) =>
  rest<EditionEvent>(
    `edition_events?select=*&target_id=eq.${encodeURIComponent(targetId)}&order=at.desc&limit=${limit}`,
  );

// Candidatos ao Deal Desk: campanhas vigentes, melhores primeiro (TL Score).
export const getCandidateCampaigns = (limit = 120) =>
  rest<CandidateCampaign>(
    `campaigns?select=id,origem,destino,tipo,percentual,tl_score,verdict,status,vigencia_fim,observed_at` +
      `&status=in.(continua,vence-72h,vence-hoje)&order=tl_score.desc.nullslast,observed_at.desc.nullslast&limit=${limit}`,
  );

export async function getCampaignsByIds(ids: string[]): Promise<CandidateCampaign[]> {
  if (ids.length === 0) return [];
  const list = ids.map((i) => `"${i.replace(/"/g, "")}"`).join(",");
  return rest<CandidateCampaign>(
    `campaigns?select=id,origem,destino,tipo,percentual,tl_score,verdict,status,vigencia_fim,observed_at&id=in.(${encodeURIComponent(list)})`,
  );
}

// ---------- Escritas / auditoria ----------

export async function logEvent(
  targetId: string,
  action: string,
  detail?: Record<string, unknown>,
  actor = "admin",
): Promise<void> {
  try {
    await insert("edition_events", { target_id: targetId, action, actor, detail: detail ?? null });
  } catch (e) {
    console.error("[digest] logEvent falhou", e);
  }
}

export async function saveDraft(
  d: Partial<EditionDraft> & { id: string; date: string },
  actor = "admin",
): Promise<void> {
  const row = {
    id: d.id,
    product: d.product ?? "daily",
    date: d.date,
    subject: d.subject ?? null,
    sinal: d.sinal ?? null,
    destaque: d.destaque ?? null,
    deal_ids: d.deal_ids ?? [],
    notes: d.notes ?? null,
    status: d.status ?? "draft",
    version: d.version ?? 1,
    created_by: actor,
    updated_at: new Date().toISOString(),
  };
  await insert("edition_drafts", row, { onConflict: "id" });
}

// ---------- Fase 4: QA com guardrails (regras invioláveis do CLAUDE.md) ----------

const URGENCIA = [
  "imperdível", "imperdivel", "corra", "garanta já", "garanta ja",
  "última chance", "ultima chance", "não perca", "nao perca", "aproveite agora",
  "últimas horas", "ultimas horas", "acaba hoje",
];
const PROMESSA = ["garantido", "lucro certo", "ganho certo", "sem risco", "dinheiro garantido"];
// Emoji sem depender da flag `u` (target do projeto): símbolos/dingbats BMP,
// seletor de variação e os três blocos de emoji no plano astral (surrogates).
const EMOJI = /[\u2600-\u27BF]|\uFE0F|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF]/;

// QA determinístico sobre o texto autoral do operador (subject/destaque/notes)
// + completude do rascunho. Não inventa: sinaliza o que fere as regras.
export function runQa(d: EditionDraft): { passed: boolean; blocking: boolean; score: number; findings: QaFinding[] } {
  const findings: QaFinding[] = [];
  const text = [d.subject, d.destaque, d.notes].filter(Boolean).join(" ").toLowerCase();

  const urg = URGENCIA.filter((w) => text.includes(w));
  if (urg.length) findings.push({ rule: "urgencia-artificial", level: "block", message: `urgência artificial: ${urg.join(", ")}` });

  const prom = PROMESSA.filter((w) => text.includes(w));
  if (prom.length) findings.push({ rule: "promessa-de-ganho", level: "block", message: `promessa de ganho: ${prom.join(", ")}` });

  if (EMOJI.test([d.subject, d.destaque, d.notes].filter(Boolean).join(" ")))
    findings.push({ rule: "emoji", level: "block", message: "emoji no corpo editorial" });

  if (!d.subject || !d.subject.trim())
    findings.push({ rule: "assunto", level: "warn", message: "assunto vazio" });
  if (!d.deal_ids || d.deal_ids.length === 0)
    findings.push({ rule: "deal-desk", level: "warn", message: "nenhuma campanha no Deal Desk" });
  if (!d.sinal)
    findings.push({ rule: "sinal", level: "warn", message: "Sinal do dia não definido" });

  const blocking = findings.some((f) => f.level === "block");
  const warns = findings.filter((f) => f.level === "warn").length;
  const passed = !blocking && !!d.subject?.trim() && (d.deal_ids?.length ?? 0) > 0;
  const score = Math.max(0, 100 - (blocking ? 100 : 0) - warns * 15);
  if (findings.length === 0) findings.push({ rule: "ok", level: "ok", message: "sem apontamentos" });
  return { passed, blocking, score, findings };
}

export async function saveQaReport(
  targetId: string,
  targetKind: "draft" | "edition",
  r: { passed: boolean; blocking: boolean; score: number; findings: QaFinding[] },
  actor = "admin",
): Promise<void> {
  await insert("edition_qa_reports", {
    target_id: targetId,
    target_kind: targetKind,
    passed: r.passed,
    blocking: r.blocking,
    score: r.score,
    findings: r.findings,
    created_by: actor,
  });
}

// ---------- Fase 2/5: dispatch do workflow beehiiv.yml (draft/publish/schedule) ----------

export type BeehiivAction = "draft" | "publish" | "schedule";

export async function dispatchBeehiiv(
  action: BeehiivAction,
  opts: { edition?: string; scheduleAt?: string } = {},
): Promise<{ ok: boolean; message: string }> {
  const token = process.env.GH_DISPATCH_TOKEN?.trim();
  const repo = process.env.GH_REPO?.trim() || "mzinhoww-svg/theloyal";
  const ref = process.env.GH_COLLECT_REF?.trim() || "claude/loyalty-landing-page-v1-7vbjq7";
  if (!token) return { ok: false, message: "GH_DISPATCH_TOKEN ausente — configure para disparar o Beehiiv" };
  if (action === "schedule" && !opts.scheduleAt)
    return { ok: false, message: "agendamento exige data/hora (ISO 8601)" };

  const inputs: Record<string, string> = {
    action,
    edition: opts.edition ?? "",
    schedule_at: opts.scheduleAt ?? "",
    // A trava humana do workflow: só publish/schedule exigem, draft ignora.
    confirm: action === "draft" ? "" : "PUBLICAR",
    dry_run: "false",
  };
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/beehiiv.yml/dispatches`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json" },
      body: JSON.stringify({ ref, inputs }),
    });
    if (res.status !== 204) {
      const detail = await res.text().catch(() => "");
      return { ok: false, message: `dispatch falhou (${res.status}) ${detail.slice(0, 160)}` };
    }
    const label = action === "schedule" ? `agendado ${opts.scheduleAt}` : action;
    return { ok: true, message: `Beehiiv ${label} disparado no Actions — acompanhe em Execuções` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao disparar Beehiiv" };
  }
}

// ---------- Fase 6: métricas do Beehiiv por edição ----------

export async function fetchBeehiivStats(
  editionId: string,
  postId: string,
): Promise<{ ok: boolean; message: string }> {
  const key = process.env.BEEHIIV_API_KEY?.trim();
  const pub = process.env.BEEHIIV_PUBLICATION_ID?.trim();
  if (!key || !pub) return { ok: false, message: "BEEHIIV_API_KEY/PUBLICATION_ID ausentes — sem métricas ao vivo" };
  try {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${pub}/posts/${postId}?expand[]=stats`,
      { headers: { authorization: `Bearer ${key}`, accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, message: `Beehiiv HTTP ${res.status} ${detail.slice(0, 120)}` };
    }
    const j = (await res.json()) as { data?: { stats?: { email?: Record<string, number> } } };
    const s = j?.data?.stats?.email ?? {};
    const recipients = s.recipients ?? null;
    const opens = s.unique_opens ?? s.opens ?? null;
    const clicks = s.unique_clicks ?? s.clicks ?? null;
    await insert(
      "edition_stats",
      {
        edition_id: editionId,
        beehiiv_post_id: postId,
        recipients,
        opens,
        clicks,
        open_rate: s.open_rate ?? null,
        click_rate: s.click_rate ?? null,
        raw: j?.data?.stats ?? null,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "edition_id" },
    );
    return { ok: true, message: `métricas atualizadas — ${opens ?? "—"} aberturas, ${clicks ?? "—"} cliques` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "falha ao buscar métricas" };
  }
}

// Aprova/agenda no ledger (patch em editions).
export async function markEdition(
  editionId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await patch("editions", `id=eq.${encodeURIComponent(editionId)}`, fields);
}

// Fase 3→ledger: materializa o rascunho curado numa edição real (upsert em
// `editions`), montando um manifesto compacto a partir das campanhas escolhidas.
// É o plano do operador virando registro — o e-mail renderizado ainda sai do
// pipeline (workflow), mas o ledger passa a refletir a curadoria.
export async function materializeDraft(d: EditionDraft, actor = "admin"): Promise<string> {
  const deals = await getCampaignsByIds(d.deal_ids ?? []);
  const json = {
    curated: true,
    subject: d.subject ?? null,
    sinal: d.sinal ?? null,
    destaque: d.destaque ?? null,
    date: d.date,
    deals: deals.map((c) => ({
      id: c.id,
      origem: c.origem,
      destino: c.destino,
      tipo: c.tipo,
      percentual: c.percentual,
      tl_score: c.tl_score,
      verdict: c.verdict,
      vigencia_fim: c.vigencia_fim,
    })),
  };
  const qa = runQa(d);
  await insert(
    "editions",
    {
      id: d.id,
      product: d.product,
      date: d.date,
      title: d.subject ?? `${d.product} ${d.date}`,
      status: "draft",
      curated: true,
      gate_validate: qa.passed,
      gate_audit: !qa.blocking,
      quality_score: qa.score,
      sources_count: null,
      deals_count: deals.length,
      json,
    },
    { onConflict: "id" },
  );
  await logEvent(d.id, "generated", { deals: deals.length, score: qa.score }, actor);
  return d.id;
}

export async function markDraft(
  draftId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await patch("edition_drafts", `id=eq.${encodeURIComponent(draftId)}`, {
    ...fields,
    updated_at: new Date().toISOString(),
  });
}
