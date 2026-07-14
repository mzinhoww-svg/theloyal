import { rest, type Campaign } from "@/lib/admin-db";
import { needsReview } from "@/lib/admin-series";
import {
  PageHeader,
  Pill,
  Legend,
  Table,
  Th,
  Td,
  EmptyRow,
  toneForStatus,
  toneForVerdict,
  toneForScore,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/admin/toast";
import { updateCampaignAction } from "./actions";
import { VERDICTS } from "./constants";

const STATUS_OPTS = ["continua", "vence-72h", "vence-hoje", "vencida", "nova", "descartada"];
const ORIGIN_OPTS = ["daily", "auto", "backfill"];

export default async function CampanhasPage({
  searchParams,
}: {
  searchParams: { status?: string; origin?: string; tipo?: string; revisao?: string };
}) {
  const rows = await rest<Campaign>(
    "campaigns?select=id,origem,destino,tipo,percentual,cpm,tl_score,verdict,status,origin,vigencia_fim,last_seen,observed_at,notes&order=last_seen.desc.nullslast&limit=500",
  );

  const { status = "", origin = "", tipo = "", revisao = "" } = searchParams;
  const onlyReview = revisao === "1";
  const tipos = Array.from(new Set(rows.map((r) => r.tipo).filter(Boolean))).sort();

  const filtered = rows
    .filter(
      (c) =>
        (!status || c.status === status) &&
        (!origin || c.origin === origin) &&
        (!tipo || c.tipo === tipo) &&
        (!onlyReview || needsReview(c)),
    )
    // Revisão em primeiro: o que pede olho humano sobe no topo.
    .sort((a, b) => Number(needsReview(b)) - Number(needsReview(a)));

  const reviewCount = rows.filter(needsReview).length;

  return (
    <>
      <PageHeader
        title="Campanhas"
        sub={`${filtered.length} de ${rows.length} no ledger · ${reviewCount} pedem revisão.`}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <form method="GET" className="flex flex-wrap items-center gap-2" aria-label="Filtros">
          <select
            name="status"
            defaultValue={status}
            className="min-h-[36px] rounded border border-line bg-surface px-2 text-sm text-ink"
          >
            <option value="">status: todos</option>
            {STATUS_OPTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            name="origin"
            defaultValue={origin}
            className="min-h-[36px] rounded border border-line bg-surface px-2 text-sm text-ink"
          >
            <option value="">origem: todas</option>
            {ORIGIN_OPTS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <select
            name="tipo"
            defaultValue={tipo}
            className="min-h-[36px] rounded border border-line bg-surface px-2 text-sm text-ink"
          >
            <option value="">tipo: todos</option>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-sm text-gray-700">
            <input
              type="checkbox"
              name="revisao"
              value="1"
              defaultChecked={onlyReview}
              className="h-4 w-4 accent-green-600"
            />
            só revisão
          </label>
          <SubmitButton variant="default">Filtrar</SubmitButton>
        </form>
      </div>

      <div className="mb-3">
        <Legend
          items={[
            { tone: "green", label: "Vale agir 85+" },
            { tone: "blue", label: "Vale olhar 70+" },
            { tone: "gray", label: "Casos específicos / Não confirmado" },
            { tone: "yellow", label: "Esperaria 40+" },
            { tone: "red", label: "Evitaria <40" },
          ]}
        />
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Rota</Th>
            <Th>Tipo</Th>
            <Th className="text-right">%</Th>
            <Th className="text-right">Milheiro</Th>
            <Th>Status</Th>
            <Th>Atual</Th>
            <Th className="text-right">Editar veredito · TL Score</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length > 0 ? (
            filtered.map((c) => {
              const review = needsReview(c);
              return (
                <tr key={c.id} className={review ? "!bg-yellow-100" : undefined}>
                  <Td className="whitespace-nowrap font-medium">
                    {c.origem}
                    <span className="text-gray-400"> → </span>
                    {c.destino}
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">{c.origin ?? "—"}</span>
                      {review && <Pill tone="yellow">revisar</Pill>}
                    </span>
                  </Td>
                  <Td className="text-gray-500">{c.tipo}</Td>
                  <Td className="text-right font-mono tabular-nums">
                    {c.percentual ?? "—"}
                  </Td>
                  <Td className="text-right font-mono tabular-nums text-gray-500">
                    {c.cpm ?? "—"}
                  </Td>
                  <Td>
                    <Pill tone={toneForStatus(c.status)}>{c.status}</Pill>
                  </Td>
                  <Td>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {c.verdict ? (
                        <Pill tone={toneForVerdict(c.verdict)}>{c.verdict}</Pill>
                      ) : (
                        <span className="text-gray-400">sem veredito</span>
                      )}
                      {c.tl_score != null && (
                        <Pill tone={toneForScore(c.tl_score)}>{c.tl_score}</Pill>
                      )}
                    </span>
                  </Td>
                  <Td>
                    <ActionForm
                      action={updateCampaignAction}
                      className="flex flex-wrap items-center justify-end gap-2"
                    >
                      <input type="hidden" name="id" value={c.id} />
                      <select
                        name="verdict"
                        defaultValue={c.verdict ?? ""}
                        aria-label="Veredito"
                        className="min-h-[36px] rounded border border-line bg-surface px-2 text-sm text-ink"
                      >
                        <option value="">—</option>
                        {VERDICTS.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        name="tl_score"
                        min={0}
                        max={100}
                        defaultValue={c.tl_score ?? ""}
                        aria-label="TL Score"
                        className="min-h-[36px] w-16 rounded border border-line bg-surface px-2 text-right font-mono text-sm tabular-nums text-ink"
                      />
                      <SubmitButton variant="primary" pendingLabel="…">
                        Salvar
                      </SubmitButton>
                    </ActionForm>
                  </Td>
                </tr>
              );
            })
          ) : (
            <EmptyRow cols={7} label="nenhuma campanha para este filtro" />
          )}
        </tbody>
      </Table>
    </>
  );
}
