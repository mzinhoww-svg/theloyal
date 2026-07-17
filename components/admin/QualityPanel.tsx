// Painel de qualidade do ledger (Fase C0.2) — resumo + campanhas excluídas por
// qualidade temporal ou duplicidade provável. Server component, sem estado.
// Usado igual em /admin/forecast e /admin/predict (mesma avaliação, mesmo set).
import type { CampaignQualityAssessment, Severity } from "@/lib/campaign-quality";
import { StatCard, Pill, Table, Th, Td, EmptyRow, type Tone } from "@/components/admin/ui";

const SEV_TONE: Record<Severity, Tone> = { ok: "green", warning: "yellow", critical: "red" };
const DUP_TONE = (s: string): Tone => (s === "probable_duplicate" ? "red" : s === "possible_duplicate" ? "yellow" : "gray");

// `embedded` omite o cabeçalho próprio — usado quando o painel vive dentro de
// um <Disclosure> que já dá título e contexto à seção.
export function QualityPanel({
  quality,
  embedded = false,
}: {
  quality: CampaignQualityAssessment;
  embedded?: boolean;
}) {
  const c = quality.counters;
  const excluded = quality.excluded;
  return (
    <section className={embedded ? undefined : "mb-8"}>
      {!embedded && (
        <h2 className="mb-1 font-display text-lg font-semibold">Qualidade do ledger (C0.2)</h2>
      )}
      <p className="mb-3 text-sm text-gray-500">
        Validação temporal + duplicidade provável aplicadas <strong>antes</strong> da formação das
        séries. Só campanhas elegíveis entram no Forecast e no Predict. Nenhum dado é alterado.
      </p>
      <div className="mb-4 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
        <StatCard label="Recebidas" value={c.totalReceived} sub="transferências" tone="gray" />
        <StatCard label="Elegíveis" value={c.totalEligible} sub="entram na série" tone={c.totalEligible > 0 ? "green" : "gray"} />
        <StatCard label="Sem data" value={c.blockedMissingDate} sub="bloqueadas" tone={c.blockedMissingDate > 0 ? "yellow" : "gray"} />
        <StatCard label="Temporais" value={c.blockedTemporal} sub="bloqueadas (data suspeita)" tone={c.blockedTemporal > 0 ? "red" : "gray"} />
        <StatCard label="Duplicidade" value={c.blockedDuplicate} sub="membro crítico bloqueado" tone={c.blockedDuplicate > 0 ? "red" : "gray"} />
        <StatCard label="Placeholder" value={c.blockedPlaceholder} sub="programa inválido" tone={c.blockedPlaceholder > 0 ? "yellow" : "gray"} />
        <StatCard label="Dup. prováveis" value={c.probableDuplicateGroups} sub={`${c.possibleDuplicateGroups} possíveis`} tone={c.probableDuplicateGroups > 0 ? "red" : "gray"} />
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Campanha</Th>
            <Th>Rota</Th>
            <Th>Data candidata</Th>
            <Th>Proveniência</Th>
            <Th className="text-right">Δ dias</Th>
            <Th>Flags</Th>
            <Th>Severidade</Th>
            <Th>Duplicidade</Th>
            <Th>Relacionadas</Th>
            <Th>Na previsão?</Th>
          </tr>
        </thead>
        <tbody>
          {excluded.length ? (
            excluded.map((e) => (
              <tr key={e.id}>
                <Td label="Campanha" className="font-mono text-xs text-gray-500"><span className="block max-w-[220px] truncate" title={e.id}>{e.id}</span></Td>
                <Td label="Rota" className="font-medium">{e.route}</Td>
                <Td label="Data candidata" className="font-mono text-xs tabular-nums">{e.temporal.eventDate ?? "—"}</Td>
                <Td label="Proveniência" className="font-mono text-xs tabular-nums text-gray-500">{e.temporal.provenanceDate ?? "—"}</Td>
                <Td label="Δ dias" className="text-right font-mono tabular-nums">{e.temporal.dayDifference ?? "—"}</Td>
                <Td label="Flags" className="text-xs text-gray-500">{e.temporal.flags.join(", ")}</Td>
                <Td label="Severidade"><Pill tone={SEV_TONE[e.temporal.severity]}>{e.temporal.severity}</Pill></Td>
                <Td label="Duplicidade">
                  {e.duplicate.status === "unique" ? (
                    <span className="text-xs text-gray-400">—</span>
                  ) : (
                    <Pill tone={DUP_TONE(e.duplicate.status)}>{e.duplicate.status === "probable_duplicate" ? "provável" : "possível"}</Pill>
                  )}
                </Td>
                <Td label="Relacionadas" className="font-mono text-[11px] text-gray-400">
                  <span className="block max-w-[200px] truncate" title={e.duplicate.relatedCampaignIds.join(" · ")}>
                    {e.duplicate.relatedCampaignIds.join(" · ") || "—"}
                  </span>
                </Td>
                <Td label="Na previsão?"><Pill tone="red">não · {e.reason}</Pill></Td>
              </tr>
            ))
          ) : (
            <EmptyRow cols={10} label="nenhuma campanha excluída por qualidade" />
          )}
        </tbody>
      </Table>
    </section>
  );
}
