import {
  getEditions,
  summarizeByProduct,
  toneForProduct,
  isPublished,
  gatesPass,
  type EditionRow,
} from "@/lib/admin-digests";
import { getDrafts } from "@/lib/admin-digest-ops";
import {
  StatCard,
  PageHeader,
  Pill,
  Legend,
  GateChips,
  Table,
  Th,
  Td,
  EmptyRow,
  toneForStatus,
  toneForScore,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const qtone = (n: number | null) => toneForScore(n);

function ProductSummary({ rows }: { rows: EditionRow[] }) {
  const summary = summarizeByProduct(rows);
  if (summary.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-2 font-display text-lg font-semibold">Cobertura por produto</h2>
      <Table>
        <thead>
          <tr>
            <Th>Produto</Th>
            <Th className="text-right">Edições</Th>
            <Th className="text-right">Gates OK</Th>
            <Th className="text-right">No Beehiiv</Th>
            <Th className="text-right">Qual. média</Th>
            <Th>Última</Th>
          </tr>
        </thead>
        <tbody>
          {summary.map((s) => (
            <tr key={s.product}>
              <Td label="Produto">
                <Pill tone={toneForProduct(s.product)}>{s.product}</Pill>
              </Td>
              <Td className="text-right font-mono tabular-nums" label="Edições">{s.total}</Td>
              <Td className="text-right font-mono tabular-nums text-gray-500" label="Gates OK">
                {s.gatesOk}/{s.total}
              </Td>
              <Td className="text-right font-mono tabular-nums text-gray-500" label="No Beehiiv">
                {s.published}/{s.total}
              </Td>
              <Td className="text-right font-mono tabular-nums" label="Qual. média">{s.avgQuality ?? "—"}</Td>
              <Td className="font-mono tabular-nums text-gray-500" label="Última">{s.lastDate ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}

function EditionRowView({ e }: { e: EditionRow }) {
  return (
    <tr>
      <Td label="Produto">
        <Pill tone={toneForProduct(e.product)}>{e.product}</Pill>
      </Td>
      <Td className="font-mono tabular-nums text-gray-500" label="Nº">
        {e.number != null ? `#${String(e.number).padStart(4, "0")}` : "—"}
      </Td>
      <Td className="font-mono tabular-nums text-gray-500" label="Data">{e.date ?? "—"}</Td>
      <Td className="max-w-[28rem]" label="Título">
        <a href={`/admin/digests/${encodeURIComponent(e.id)}`} className="text-blue-600 hover:underline">
          {e.title ?? e.id}
        </a>
      </Td>
      <Td label="Status">
        <Pill tone={isPublished(e) ? "green" : toneForStatus(e.status)}>
          {isPublished(e) ? "no beehiiv" : (e.status ?? "—")}
        </Pill>
      </Td>
      <Td label="Gates">
        <GateChips validate={e.gate_validate} audit={e.gate_audit} />
      </Td>
      <Td className="text-right font-mono tabular-nums" label="Qual.">
        <span className={qtone(e.quality_score) === "red" ? "text-red-600" : undefined}>
          {e.quality_score ?? "—"}
        </span>
      </Td>
      <Td className="text-right font-mono tabular-nums text-gray-500" label="Fontes">{e.sources_count ?? "—"}</Td>
      <Td className="text-right font-mono tabular-nums text-gray-500" label="Deals">{e.deals_count ?? "—"}</Td>
      <Td className="tl-cell-action">
        {e.beehiiv_url ? (
          <a href={e.beehiiv_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            abrir →
          </a>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </Td>
    </tr>
  );
}

export default async function DigestsPage() {
  const [editions, drafts] = await Promise.all([getEditions(), getDrafts()]);

  const total = editions.length;
  const publicadas = editions.filter(isPublished).length;
  const gatesOk = editions.filter(gatesPass).length;
  const q = editions.map((e) => e.quality_score).filter((n): n is number => n != null);
  const avgQ = q.length ? Math.round(q.reduce((a, b) => a + b, 0) / q.length) : null;
  const ultima = editions.map((e) => e.date).filter(Boolean).sort().at(-1) ?? null;

  return (
    <>
      <PageHeader
        title="Digests"
        sub="Ciclo de vida de cada edição — curadoria, gates de QA, qualidade e publicação no Beehiiv."
        actions={
          <a
            href="/admin/digests/new"
            className="inline-flex min-h-[44px] items-center rounded border border-green-600 bg-green-600 px-3 py-1.5 text-sm font-semibold text-paper hover:bg-green-700"
          >
            Curar nova edição
          </a>
        }
      />

      <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        <StatCard label="Edições" value={total} sub="no ledger" tone="gray" />
        <StatCard
          label="Gates OK"
          value={`${gatesOk}/${total || 0}`}
          sub="validate + audit"
          tone={total && gatesOk === total ? "green" : gatesOk > 0 ? "yellow" : "gray"}
        />
        <StatCard
          label="No Beehiiv"
          value={`${publicadas}/${total || 0}`}
          sub="com rascunho/post"
          tone={publicadas > 0 ? "green" : "gray"}
        />
        <StatCard label="Qualidade média" value={avgQ ?? "—"} sub="TL QA score" tone={qtone(avgQ)} />
        <StatCard label="Última edição" value={ultima ?? "—"} sub="data" tone="blue" />
      </section>

      <div className="mb-6 mt-4">
        <Legend
          items={[
            { tone: "blue", label: "daily" },
            { tone: "green", label: "weekly" },
            { tone: "yellow", label: "pro" },
            { tone: "gray", label: "lab" },
            { tone: "red", label: "special" },
          ]}
        />
      </div>

      <ProductSummary rows={editions} />

      {drafts.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 font-display text-lg font-semibold">Rascunhos em curadoria</h2>
          <Table>
            <thead>
              <tr>
                <Th>Produto</Th>
                <Th>Data</Th>
                <Th>Assunto</Th>
                <Th className="text-right">Deals</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.id}>
                  <Td label="Produto">
                    <Pill tone={toneForProduct(d.product)}>{d.product}</Pill>
                  </Td>
                  <Td className="font-mono tabular-nums text-gray-500" label="Data">{d.date}</Td>
                  <Td className="max-w-[26rem]" label="Assunto">
                    <a
                      href={`/admin/digests/drafts/${encodeURIComponent(d.id)}`}
                      className="text-blue-600 hover:underline"
                    >
                      {d.subject || d.id}
                    </a>
                  </Td>
                  <Td className="text-right font-mono tabular-nums" label="Deals">
                    {Array.isArray(d.deal_ids) ? d.deal_ids.length : 0}
                  </Td>
                  <Td label="Status">
                    <Pill tone={toneForStatus(d.status)}>{d.status}</Pill>
                  </Td>
                  <Td className="tl-cell-action">

                    <a
                      href={`/admin/digests/drafts/${encodeURIComponent(d.id)}`}
                      className="text-blue-600 hover:underline"
                    >
                      abrir →
                    </a>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-2 font-display text-lg font-semibold">Todas as edições</h2>
        <Table>
          <thead>
            <tr>
              <Th>Produto</Th>
              <Th>Nº</Th>
              <Th>Data</Th>
              <Th>Título</Th>
              <Th>Status</Th>
              <Th>Gates</Th>
              <Th className="text-right">Qual.</Th>
              <Th className="text-right">Fontes</Th>
              <Th className="text-right">Deals</Th>
              <Th>Beehiiv</Th>
            </tr>
          </thead>
          <tbody>
            {editions.length > 0 ? (
              editions.map((e) => <EditionRowView key={e.id} e={e} />)
            ) : (
              <EmptyRow cols={10} label="sem edições no ledger" />
            )}
          </tbody>
        </Table>
      </section>
    </>
  );
}
