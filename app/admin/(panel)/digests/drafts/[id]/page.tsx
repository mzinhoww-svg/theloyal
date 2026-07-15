import { notFound } from "next/navigation";
import {
  getDraft,
  getQaReports,
  getEvents,
  getCandidateCampaigns,
  getCampaignsByIds,
  type CandidateCampaign,
} from "@/lib/admin-digest-ops";
import { PageHeader, Pill, toneForVerdict, toneForStatus } from "@/components/admin/ui";
import { QaPanel, EventsTimeline } from "@/components/admin/digest-panels";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/admin/toast";
import {
  saveDraftAction,
  runQaDraftAction,
  approveDraftAction,
  materializeDraftAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const FIELD =
  "w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-gray-400 focus:border-blue-600 focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-gray-500";

function mergeCandidates(candidates: CandidateCampaign[], selected: CandidateCampaign[]): CandidateCampaign[] {
  const seen = new Set(candidates.map((c) => c.id));
  return [...selected.filter((c) => !seen.has(c.id)), ...candidates];
}

export default async function DraftDetailPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const draft = await getDraft(id);
  if (!draft) notFound();

  const [candidates, selectedCampaigns, reports, events] = await Promise.all([
    getCandidateCampaigns(),
    getCampaignsByIds(draft.deal_ids ?? []),
    getQaReports(id),
    getEvents(id),
  ]);
  const list = mergeCandidates(candidates, selectedCampaigns);
  const selected = new Set(draft.deal_ids ?? []);
  const latest = reports[0] ?? null;

  return (
    <>
      <div className="mb-4">
        <a href="/admin/digests" className="text-sm font-semibold text-blue-600 hover:underline">
          ← Digests
        </a>
      </div>
      <PageHeader
        title={draft.subject || draft.id}
        sub={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Pill tone="gray">{draft.product}</Pill>
            <span className="font-mono text-xs text-gray-500">{draft.date}</span>
            <Pill tone={toneForStatus(draft.status)}>{draft.status}</Pill>
            <span className="text-xs text-gray-400">rascunho v{draft.version}</span>
          </span>
        }
      />

      {/* Ações (fora do form de edição — HTML não aninha forms). */}
      <section className="mb-6 flex flex-wrap items-center gap-2">
        <ActionForm action={runQaDraftAction}>
          <input type="hidden" name="id" value={draft.id} />
          <SubmitButton variant="default" pendingLabel="Rodando…">Rodar QA</SubmitButton>
        </ActionForm>
        <ActionForm action={approveDraftAction}>
          <input type="hidden" name="id" value={draft.id} />
          <SubmitButton variant="primary" pendingLabel="Aprovando…">Aprovar</SubmitButton>
        </ActionForm>
        <ActionForm action={materializeDraftAction}>
          <input type="hidden" name="id" value={draft.id} />
          <SubmitButton variant="default" pendingLabel="Materializando…">Materializar no ledger</SubmitButton>
        </ActionForm>
        <a
          href={`/admin/digests/${encodeURIComponent(draft.id)}`}
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          ver edição no ledger →
        </a>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 font-display text-lg font-semibold">QA (guardrails de marca)</h2>
        <QaPanel report={latest} />
      </section>

      <ActionForm action={saveDraftAction}>
        <input type="hidden" name="id" value={draft.id} />
        <input type="hidden" name="product" value={draft.product} />
        <input type="hidden" name="date" value={draft.date} />
        <h2 className="mb-2 font-display text-lg font-semibold">Edição</h2>
        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="sinal">Sinal do dia</label>
            <select id="sinal" name="sinal" className={FIELD} defaultValue={draft.sinal ?? ""}>
              <option value="">— (defina)</option>
              <option value="forte">forte</option>
              <option value="morno">morno</option>
              <option value="fraco">fraco</option>
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="destaque">Destaque</label>
            <input id="destaque" name="destaque" type="text" defaultValue={draft.destaque ?? ""} className={FIELD} />
          </div>
          <div className="md:col-span-2">
            <label className={LABEL} htmlFor="subject">Assunto</label>
            <input id="subject" name="subject" type="text" defaultValue={draft.subject ?? ""} className={FIELD} />
          </div>
          <div className="md:col-span-2">
            <label className={LABEL} htmlFor="notes">Notas internas</label>
            <textarea id="notes" name="notes" rows={2} defaultValue={draft.notes ?? ""} className={FIELD} />
          </div>
        </section>

        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-display text-base font-semibold">Deal Desk</h3>
            <span className="font-mono text-xs text-gray-500">
              {selected.size} selecionadas · {list.length} candidatas
            </span>
          </div>
          <div className="max-h-[24rem] overflow-y-auto rounded-lg border border-line bg-surface">
            <ul className="divide-y divide-line">
              {list.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-paper-dark/50">
                    <input
                      type="checkbox"
                      name="deal_ids"
                      value={c.id}
                      defaultChecked={selected.has(c.id)}
                      className="h-4 w-4 flex-none accent-green-600"
                    />
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-sm text-ink">
                        {c.origem ?? "?"} → {c.destino ?? "?"}
                      </span>
                      <span className="font-mono text-xs text-gray-500">{c.tipo}</span>
                      {c.percentual != null && (
                        <span className="font-mono text-xs text-gray-500">{c.percentual}%</span>
                      )}
                    </span>
                    {c.verdict && <Pill tone={toneForVerdict(c.verdict)}>{c.verdict}</Pill>}
                    <span className="w-10 flex-none text-right font-mono text-xs tabular-nums">
                      {c.tl_score ?? "—"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4">
          <SubmitButton variant="default" pendingLabel="Salvando…">Salvar rascunho</SubmitButton>
        </div>
      </ActionForm>

      <section className="mb-8 mt-8">
        <h2 className="mb-2 font-display text-lg font-semibold">Trilha de auditoria</h2>
        <EventsTimeline events={events} />
      </section>
    </>
  );
}
