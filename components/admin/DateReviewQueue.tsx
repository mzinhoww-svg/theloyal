// Fila de revisão assistida de datas (Trilha D). O motor NUNCA aplica a
// correção sozinho — cada linha traz a evidência e o operador decide. Campanha
// decidida (aplicada ou rejeitada) sai da fila; a auditoria fica em
// campaign_date_reviews.
import type { DateCorrectionProposal } from "@/lib/date-review";
import { Pill, Table, Th, Td, EmptyState } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, type ActionState } from "@/components/admin/toast";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function DateReviewQueue({
  proposals,
  applyAction,
  rejectAction,
}: {
  proposals: DateCorrectionProposal[];
  applyAction: Action;
  rejectAction: Action;
}) {
  if (!proposals.length) {
    return (
      <EmptyState
        label="nenhuma correção de data pendente"
        hint="Propostas aparecem quando uma campanha bloqueada por suspect_year casa com o padrão de ano fabricado (gap ≈ N anos) e a fonte não contradiz a correção."
      />
    );
  }
  return (
    <Table>
      <thead>
        <tr>
          <Th>Rota</Th>
          <Th>Campanha</Th>
          <Th>Data atual</Th>
          <Th>Proposta</Th>
          <Th>Evidência</Th>
          <Th>Confiança</Th>
          <Th>Decisão</Th>
        </tr>
      </thead>
      <tbody>
        {proposals.map((p) => {
          const payload = JSON.stringify(p);
          return (
            <tr key={p.campaignId}>
              <Td label="Rota" className="font-medium">{p.route}</Td>
              <Td label="Campanha" className="font-mono text-xs text-gray-500">
                <span className="block max-w-[200px] truncate" title={p.campaignId}>
                  {p.campaignId}
                </span>
              </Td>
              <Td label="Data atual" className="font-mono tabular-nums text-red-600">
                {p.currentEventDate}
              </Td>
              <Td label="Proposta" className="font-mono tabular-nums text-ink">
                {p.proposedDate}
                <span className="block text-xs text-gray-500">+{p.yearsShifted} ano(s)</span>
              </Td>
              <Td label="Evidência" className="max-w-[280px] text-xs text-gray-500">
                {p.evidence.join(" · ")}
              </Td>
              <Td label="Confiança">
                <Pill tone={p.confidence === "alta" ? "green" : "blue"}>{p.confidence}</Pill>
              </Td>
              <Td className="tl-cell-action">
                <div className="flex items-center gap-3">
                  <ActionForm action={applyAction}>
                    <input type="hidden" name="proposal" value={payload} />
                    <SubmitButton variant="primary" pendingLabel="…" confirm="confirmar correção?">
                      aplicar
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={rejectAction}>
                    <input type="hidden" name="proposal" value={payload} />
                    <SubmitButton variant="danger" pendingLabel="…" confirm="confirmar rejeição?">
                      rejeitar
                    </SubmitButton>
                  </ActionForm>
                </div>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
