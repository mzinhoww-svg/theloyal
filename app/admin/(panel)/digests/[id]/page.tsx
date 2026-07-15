import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getEdition, toneForProduct, isPublished, gatesPass, type EditionFull } from "@/lib/admin-digests";
import { getQaReports, getStats, getEvents } from "@/lib/admin-digest-ops";
import {
  StatCard,
  PageHeader,
  Pill,
  GateChips,
  fmtDate,
  toneForStatus,
  toneForScore,
  type Tone,
} from "@/components/admin/ui";
import { QaPanel, StatsPanel, EventsTimeline } from "@/components/admin/digest-panels";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/admin/toast";
import {
  beehiivDraftAction,
  beehiivPublishAction,
  beehiivScheduleAction,
  refreshStatsAction,
} from "../actions";

export const dynamic = "force-dynamic";

// Sinal do dia → tom (dentro dos tokens). Sem inventar: desconhecido = gray.
const SINAL_TONE: Record<string, Tone> = {
  forte: "green",
  quente: "green",
  morno: "yellow",
  fraco: "gray",
  frio: "gray",
};

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-line py-2 last:border-b-0">
      <div className="text-xs font-semibold uppercase tracking-[0.05em] text-gray-500">{label}</div>
      <div className="mt-1 text-sm text-ink">{children}</div>
    </div>
  );
}

function SlugList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((s, i) => (
        <li key={i} className="font-mono text-xs text-gray-700">
          {s}
        </li>
      ))}
    </ul>
  );
}

// Renderiza o manifesto do digest de forma defensiva: strings e listas de
// strings viram campos legíveis; objetos/estruturas caem no JSON cru embaixo.
function Manifest({ json }: { json: Record<string, unknown> }) {
  const entries = Object.entries(json);
  const simple = entries.filter(
    ([, v]) => typeof v === "string" || typeof v === "number" || isStringArray(v),
  );
  if (simple.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-2 font-display text-lg font-semibold">Manifesto da edição</h2>
      <div className="rounded-lg border border-line bg-surface p-4">
        {simple.map(([k, v]) => (
          <KeyValue key={k} label={k}>
            {k === "sinal" && typeof v === "string" ? (
              <Pill tone={SINAL_TONE[v.toLowerCase()] ?? "gray"}>{v}</Pill>
            ) : isStringArray(v) ? (
              <SlugList items={v} />
            ) : (
              <span className="font-mono text-xs text-gray-700">{String(v)}</span>
            )}
          </KeyValue>
        ))}
      </div>
    </section>
  );
}

export default async function DigestDetailPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const e: EditionFull | null = await getEdition(id);
  if (!e) notFound();

  const qt = toneForScore(e.quality_score);
  const [reports, stat, events] = await Promise.all([
    getQaReports(id),
    getStats(id),
    getEvents(id),
  ]);
  const canPublish = gatesPass(e);

  return (
    <>
      <div className="mb-4">
        <a href="/admin/digests" className="text-sm font-semibold text-blue-600 hover:underline">
          ← Digests
        </a>
      </div>

      <PageHeader
        title={e.title ?? e.id}
        sub={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Pill tone={toneForProduct(e.product)}>{e.product}</Pill>
            {e.number != null && (
              <span className="font-mono text-xs text-gray-500">
                #{String(e.number).padStart(4, "0")}
              </span>
            )}
            <span className="font-mono text-xs text-gray-500">{e.date ?? "—"}</span>
            <span className="text-xs text-gray-400">criada {fmtDate(e.created_at)}</span>
          </span>
        }
        actions={
          e.beehiiv_url ? (
            <a
              href={e.beehiiv_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[36px] items-center rounded border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-paper-dark"
            >
              Abrir no Beehiiv →
            </a>
          ) : undefined
        }
      />

      <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <StatCard
          label="Status"
          value={isPublished(e) ? "no beehiiv" : (e.status ?? "—")}
          sub={e.beehiiv_post_id ? e.beehiiv_post_id : "sem post"}
          tone={isPublished(e) ? "green" : toneForStatus(e.status)}
        />
        <StatCard label="Qualidade" value={e.quality_score ?? "—"} sub="TL QA score" tone={qt} />
        <StatCard label="Fontes" value={e.sources_count ?? "—"} sub="usadas na edição" tone="gray" />
        <StatCard label="Deals" value={e.deals_count ?? "—"} sub="no Deal Desk" tone="gray" />
      </section>

      <section className="mb-8 mt-4">
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.05em] text-gray-500">
            Gates de QA
          </span>
          <GateChips validate={e.gate_validate} audit={e.gate_audit} />
          <span className="text-xs text-gray-500">
            {e.gate_validate === true && e.gate_audit === true
              ? "aprovada nos dois gates"
              : "atenção: algum gate não passou"}
          </span>
        </div>
      </section>

      {/* Fase 2/5 — operar no Beehiiv (dispara o workflow beehiiv.yml). */}
      <section className="mb-8">
        <h2 className="mb-2 font-display text-lg font-semibold">Operar</h2>
        <div className="rounded-lg border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <ActionForm action={beehiivDraftAction}>
              <input type="hidden" name="edition_id" value={e.id} />
              <SubmitButton variant="default" pendingLabel="Disparando…">Gerar rascunho no Beehiiv</SubmitButton>
            </ActionForm>
            <ActionForm action={beehiivPublishAction}>
              <input type="hidden" name="edition_id" value={e.id} />
              <SubmitButton
                variant={canPublish ? "primary" : "default"}
                pendingLabel="Publicando…"
                title={canPublish ? undefined : "gates não passaram"}
              >
                Publicar agora
              </SubmitButton>
            </ActionForm>
            <ActionForm action={beehiivScheduleAction} className="flex items-center gap-2">
              <input type="hidden" name="edition_id" value={e.id} />
              <input
                type="datetime-local"
                name="schedule_at"
                className="rounded border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-blue-600 focus:outline-none"
              />
              <SubmitButton variant="default" pendingLabel="Agendando…">Agendar</SubmitButton>
            </ActionForm>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            {canPublish
              ? "Publicar/agendar exige a trava do workflow (confirm=PUBLICAR, já aplicada). Sem GH_DISPATCH_TOKEN, o disparo retorna erro claro."
              : "Publicar/agendar bloqueado: os gates de QA não passaram nesta edição."}
            {e.scheduled_at && <> · agendada para <span className="font-mono">{fmtDate(e.scheduled_at)}</span></>}
            {e.published_at && <> · publicada em <span className="font-mono">{fmtDate(e.published_at)}</span></>}
          </p>
        </div>
      </section>

      {/* Fase 4 — QA (compartilha id com o rascunho materializado). */}
      {reports.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 font-display text-lg font-semibold">QA (guardrails de marca)</h2>
          <QaPanel report={reports[0]} />
        </section>
      )}

      {/* Fase 6 — desempenho no Beehiiv. */}
      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Desempenho</h2>
          {e.beehiiv_post_id && (
            <ActionForm action={refreshStatsAction}>
              <input type="hidden" name="edition_id" value={e.id} />
              <input type="hidden" name="post_id" value={e.beehiiv_post_id} />
              <SubmitButton variant="ghost" pendingLabel="Buscando…">Atualizar métricas</SubmitButton>
            </ActionForm>
          )}
        </div>
        <StatsPanel stat={stat} />
      </section>

      {e.json && <Manifest json={e.json} />}

      <section className="mb-8">
        <details className="rounded-lg border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
            JSON completo da edição
          </summary>
          <pre className="overflow-x-auto border-t border-line px-4 py-3 font-mono text-xs text-gray-700">
            {e.json ? JSON.stringify(e.json, null, 2) : "—"}
          </pre>
        </details>
      </section>

      {/* Fase 7 — trilha de auditoria. */}
      <section className="mb-8">
        <h2 className="mb-2 font-display text-lg font-semibold">Trilha de auditoria</h2>
        <EventsTimeline events={events} />
      </section>
    </>
  );
}
