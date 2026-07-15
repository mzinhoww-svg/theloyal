import { getCandidateCampaigns } from "@/lib/admin-digest-ops";
import { PageHeader, Pill, toneForVerdict } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/admin/toast";
import { createDraftAction } from "../actions";

export const dynamic = "force-dynamic";

const FIELD =
  "w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-gray-400 focus:border-blue-600 focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold uppercase tracking-[0.05em] text-gray-500";

// Data de hoje (America/Sao_Paulo aproximada por UTC-3) para default do campo.
function todayISO(): string {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

export default async function NewDigestPage() {
  const candidates = await getCandidateCampaigns();

  return (
    <>
      <div className="mb-4">
        <a href="/admin/digests" className="text-sm font-semibold text-blue-600 hover:underline">
          ← Digests
        </a>
      </div>
      <PageHeader
        title="Curar nova edição"
        sub="Monte o digest: escolha as campanhas do Deal Desk, o Sinal do dia, o destaque e o assunto. Salva como rascunho editável."
      />

      <ActionForm action={createDraftAction}>
        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="product">Produto</label>
            <select id="product" name="product" className={FIELD} defaultValue="daily">
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="special">special</option>
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="date">Data</label>
            <input id="date" name="date" type="date" defaultValue={todayISO()} className={FIELD} required />
          </div>
          <div>
            <label className={LABEL} htmlFor="sinal">Sinal do dia</label>
            <select id="sinal" name="sinal" className={FIELD} defaultValue="">
              <option value="">— (defina)</option>
              <option value="forte">forte</option>
              <option value="morno">morno</option>
              <option value="fraco">fraco</option>
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="destaque">Destaque</label>
            <input id="destaque" name="destaque" type="text" placeholder="tese central da edição" className={FIELD} />
          </div>
          <div className="md:col-span-2">
            <label className={LABEL} htmlFor="subject">Assunto (título do e-mail)</label>
            <input id="subject" name="subject" type="text" placeholder="ex.: LATAM Pass 20% pelos bancos abre a semana" className={FIELD} />
          </div>
          <div className="md:col-span-2">
            <label className={LABEL} htmlFor="notes">Notas internas</label>
            <textarea id="notes" name="notes" rows={2} className={FIELD} placeholder="observações do editor (não vão pro e-mail)" />
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold">Deal Desk — escolha as campanhas</h2>
            <span className="font-mono text-xs text-gray-500">{candidates.length} candidatas vigentes</span>
          </div>
          <div className="max-h-[26rem] overflow-y-auto rounded-lg border border-line bg-surface">
            {candidates.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400">sem campanhas vigentes no ledger</p>
            ) : (
              <ul className="divide-y divide-line">
                {candidates.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-paper-dark/50">
                      <input type="checkbox" name="deal_ids" value={c.id} className="h-4 w-4 flex-none accent-green-600" />
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
            )}
          </div>
        </section>

        <div className="mt-6 flex items-center gap-3">
          <SubmitButton variant="primary" pendingLabel="Criando…">Criar rascunho</SubmitButton>
          <span className="text-xs text-gray-500">
            depois você roda o QA, aprova e publica no Beehiiv a partir do rascunho.
          </span>
        </div>
      </ActionForm>
    </>
  );
}
