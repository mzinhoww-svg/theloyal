import { loadShopping, PROGRAMS, PROGRAM_LABEL } from "@/lib/admin-shopping";
import {
  PageHeader, StatCard, Pill, Table, Th, Td, EmptyRow, fmtDate, type Tone,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/admin/toast";
import { recomputeShoppingAction, collectShoppingAction } from "./actions";

function fmtVpm(n: number | null | undefined): string {
  if (n == null) return "—";
  return "R$ " + Number(n).toFixed(2).replace(".", ",");
}
const QUALITY_TONE: Record<string, Tone> = {
  robust: "green", usable: "green", minimum: "blue", indicative: "yellow", insufficient: "yellow", no_data: "gray",
};
const AVAIL_TONE: Record<string, Tone> = {
  in_stock: "green", low_stock: "yellow", out_of_stock: "red", unavailable: "gray", not_listed: "gray", blocked: "red", unknown: "gray",
};

export default async function ShoppingVpmPage() {
  const d = await loadShopping();

  return (
    <>
      <PageHeader
        title="Radar de VPM · Shopping"
        sub={`Valor por 1.000 pontos em resgates de produtos por programa. Referência ${d.refDate ?? "—"}. Projeção econômica; nunca CPM de aquisição.`}
        actions={
          <>
            <ActionForm action={recomputeShoppingAction}>
              <SubmitButton variant="default" pendingLabel="Recalculando…">Recalcular</SubmitButton>
            </ActionForm>
            <ActionForm action={collectShoppingAction}>
              <input type="hidden" name="mock" value="0" />
              <SubmitButton variant="primary" pendingLabel="Disparando…">Coletar agora</SubmitButton>
            </ActionForm>
          </>
        }
      />

      {/* Resumo por programa */}
      <section className="mb-8">
        <h2 className="mb-2 font-display text-lg font-semibold">Resumo por programa</h2>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {d.programs.map((p) => (
            <StatCard
              key={p.program}
              label={PROGRAM_LABEL[p.program]}
              value={<span className="text-xl">{fmtVpm(p.medianStandard)}</span>}
              sub={`mediana VPM padrão · ${p.validSkus} SKU válidos · ${p.inStock} em estoque`}
              tone={p.validSkus > 0 ? "green" : "gray"}
            />
          ))}
          <StatCard label="Catálogo" value={d.counts.products} sub={`${d.counts.sources} fontes · ${d.counts.comparable}/${d.counts.observations} observações comparáveis`} tone="blue" />
        </div>
      </section>

      {/* Comparativo por SKU */}
      <section className="mb-8">
        <h2 className="mb-1 font-display text-lg font-semibold">Comparativo por SKU</h2>
        <p className="mb-3 text-sm text-gray-500">VPM padrão (R$/milheiro) por programa. Verde = melhor programa do SKU. Célula vazia = sem dado válido.</p>
        <Table>
          <thead>
            <tr>
              <Th>Produto</Th>
              <Th>Categoria</Th>
              {PROGRAMS.map((p) => <Th key={p} className="text-right">{PROGRAM_LABEL[p]}</Th>)}
              <Th>Melhor</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {d.skuRows.length ? d.skuRows.map((r) => (
              <tr key={r.productId}>
                <Td className="font-medium">{r.name}</Td>
                <Td className="text-gray-500">{r.category}</Td>
                {PROGRAMS.map((p) => {
                  const c = r.cells[p];
                  const best = r.bestStandardProgram === p;
                  return (
                    <Td key={p} className="text-right font-mono tabular-nums">
                      {c?.vpmStandard != null ? (
                        <span className={best ? "font-semibold text-green-700" : ""}>{fmtVpm(c.vpmStandard)}</span>
                      ) : (
                        <span className="text-gray-400" title={c?.reason ?? "sem observação"}>—</span>
                      )}
                    </Td>
                  );
                })}
                <Td>{r.bestStandardProgram ? <Pill tone="green">{PROGRAM_LABEL[r.bestStandardProgram]}</Pill> : "—"}</Td>
                <Td><Pill tone={r.status === "complete" ? "green" : "yellow"}>{r.status}</Pill></Td>
              </tr>
            )) : <EmptyRow cols={PROGRAMS.length + 4} label="sem comparações — rode Recalcular após coletar" />}
          </tbody>
        </Table>
      </section>

      {/* Categorias */}
      <section className="mb-8">
        <h2 className="mb-1 font-display text-lg font-semibold">Categorias</h2>
        <p className="mb-3 text-sm text-gray-500">Mediana e percentis do VPM padrão por categoria e programa. Amostra &lt; 3 SKUs = insuficiente.</p>
        <Table>
          <thead>
            <tr>
              <Th>Categoria</Th><Th>Programa</Th><Th className="text-right">Válidos</Th><Th className="text-right">Cobertura</Th>
              <Th className="text-right">P25</Th><Th className="text-right">Mediana</Th><Th className="text-right">P75</Th><Th>Amostra</Th>
            </tr>
          </thead>
          <tbody>
            {d.categories.length ? d.categories.map((b, i) => (
              <tr key={i}>
                <Td className="font-medium">{b.category_code}</Td>
                <Td>{PROGRAM_LABEL[b.program_code] ?? b.program_code}</Td>
                <Td className="text-right font-mono tabular-nums">{b.valid_products}/{b.total_products}</Td>
                <Td className="text-right font-mono tabular-nums">{b.coverage_rate != null ? Math.round(Number(b.coverage_rate) * 100) + "%" : "—"}</Td>
                <Td className="text-right font-mono tabular-nums">{fmtVpm(b.vpm_standard_p25)}</Td>
                <Td className="text-right font-mono tabular-nums font-semibold">{fmtVpm(b.vpm_standard_median)}</Td>
                <Td className="text-right font-mono tabular-nums">{fmtVpm(b.vpm_standard_p75)}</Td>
                <Td><Pill tone={QUALITY_TONE[b.sample_quality] ?? "gray"}>{b.sample_quality}</Pill></Td>
              </tr>
            )) : <EmptyRow cols={8} label="sem benchmarks" />}
          </tbody>
        </Table>
      </section>

      {/* Catálogo */}
      <section className="mb-8">
        <h2 className="mb-1 font-display text-lg font-semibold">Catálogo</h2>
        <p className="mb-3 text-sm text-gray-500">Produtos aprovados e cobertura de fontes por programa.</p>
        <Table>
          <thead>
            <tr><Th>Produto</Th><Th>Categoria</Th><Th className="text-right">Fontes</Th><Th className="text-right">URLs de produto</Th><Th>Programas</Th><Th>Status</Th></tr>
          </thead>
          <tbody>
            {d.catalog.map((c) => (
              <tr key={c.id}>
                <Td className="font-medium">{c.name}</Td>
                <Td className="text-gray-500">{c.category}</Td>
                <Td className="text-right font-mono tabular-nums">{c.sources}</Td>
                <Td className="text-right font-mono tabular-nums">{c.productUrls}</Td>
                <Td className="text-gray-500">{c.programs.map((p) => PROGRAM_LABEL[p] ?? p).join(", ") || "—"}</Td>
                <Td><Pill tone={c.status === "active" ? "green" : "gray"}>{c.status}</Pill></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      {/* Lacunas */}
      <section className="mb-8">
        <h2 className="mb-1 font-display text-lg font-semibold">Lacunas</h2>
        <p className="mb-3 text-sm text-gray-500">O que impede um SKU de entrar no comparativo. {d.gaps.length} pendência(s).</p>
        <Table>
          <thead><tr><Th>Produto</Th><Th>Programa</Th><Th>Lacuna</Th></tr></thead>
          <tbody>
            {d.gaps.length ? d.gaps.slice(0, 60).map((g, i) => (
              <tr key={i}><Td className="font-medium">{g.name}</Td><Td className="text-gray-500">{g.program}</Td><Td><Pill tone="yellow">{g.issue}</Pill></Td></tr>
            )) : <EmptyRow cols={3} label="sem lacunas" />}
          </tbody>
        </Table>
      </section>

      {/* Execuções */}
      <section className="mb-8">
        <h2 className="mb-1 font-display text-lg font-semibold">Execuções</h2>
        <p className="mb-3 text-sm text-gray-500">Rodadas de coleta (headless via GitHub Actions).</p>
        <Table>
          <thead><tr><Th>Início</Th><Th>Gatilho</Th><Th>Status</Th><Th className="text-right">Fontes</Th><Th className="text-right">OK</Th><Th className="text-right">Falhas</Th><Th className="text-right">Observações</Th></tr></thead>
          <tbody>
            {d.runs.length ? d.runs.map((r) => (
              <tr key={r.id}>
                <Td className="font-mono text-xs text-gray-500">{fmtDate(r.started_at ?? r.created_at)}</Td>
                <Td>{r.trigger_type}</Td>
                <Td><Pill tone={r.status === "success" ? "green" : r.status === "failed" ? "red" : r.status === "partial" ? "yellow" : "gray"}>{r.status}</Pill></Td>
                <Td className="text-right font-mono tabular-nums">{r.selected_sources}</Td>
                <Td className="text-right font-mono tabular-nums">{r.successful_sources}</Td>
                <Td className="text-right font-mono tabular-nums">{r.failed_sources}</Td>
                <Td className="text-right font-mono tabular-nums">{r.observations_created}</Td>
              </tr>
            )) : <EmptyRow cols={7} label="nenhuma rodada de coleta ainda (dados atuais = seed histórico validado)" />}
          </tbody>
        </Table>
      </section>

      <p className="mt-8 border-t border-line pt-4 text-xs text-gray-400">
        VPM padrão = preço de referência ÷ pontos padrão × 1.000. Nunca compara resgate integral com marginal híbrido, padrão com elite,
        nem produtos/variantes diferentes. Sem preço ou pontos → não calcula (vira lacuna). Dados atuais incluem seed histórico validado de 14/07/2026.
      </p>
    </>
  );
}
