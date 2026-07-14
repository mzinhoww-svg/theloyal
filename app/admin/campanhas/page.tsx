import { rest, type Campaign } from "@/lib/admin-db";
import {
  PageHeader,
  Pill,
  Table,
  Th,
  Td,
  EmptyRow,
  toneForStatus,
  toneForVerdict,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { updateCampaignAction } from "./actions";
import { VERDICTS } from "./constants";

const STATUS_OPTS = ["continua", "vence-72h", "vence-hoje", "vencida", "nova", "descartada"];
const ORIGIN_OPTS = ["daily", "auto", "backfill"];

function needsReview(c: Campaign): boolean {
  const o = c.origin ?? "";
  return (
    (o === "auto" || o === "backfill") &&
    !!c.notes &&
    /confianca:\s*baixa/i.test(c.notes)
  );
}

export default async function CampanhasPage({
  searchParams,
}: {
  searchParams: { status?: string; origin?: string; tipo?: string };
}) {
  const rows = await rest<Campaign>(
    "campaigns?select=id,origem,destino,tipo,percentual,cpm,tl_score,verdict,status,origin,vigencia_fim,last_seen,observed_at,notes&order=last_seen.desc.nullslast&limit=500",
  );

  const { status = "", origin = "", tipo = "" } = searchParams;
  const tipos = Array.from(new Set(rows.map((r) => r.tipo).filter(Boolean))).sort();

  const filtered = rows.filter(
    (c) =>
      (!status || c.status === status) &&
      (!origin || c.origin === origin) &&
      (!tipo || c.tipo === tipo),
  );
  const reviewCount = filtered.filter(needsReview).length;

  return (
    <>
      <PageHeader
        title="Campanhas"
        sub={`${filtered.length} de ${rows.length} no ledger · ${reviewCount} pedem revisão.`}
      />

      <form
        method="GET"
        className="mb-4 flex flex-wrap items-center gap-2"
        aria-label="Filtros"
      >
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
        <SubmitButton variant="default">Filtrar</SubmitButton>
      </form>

      <Table>
        <thead>
          <tr>
            <Th>Rota</Th>
            <Th>Tipo</Th>
            <Th className="text-right">%</Th>
            <Th className="text-right">Milheiro</Th>
            <Th>Origem</Th>
            <Th>Status</Th>
            <Th>Veredito · TL Score</Th>
            <Th className="text-right"> </Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length > 0 ? (
            filtered.map((c) => {
              const review = needsReview(c);
              return (
                <tr key={c.id} className={review ? "bg-yellow-100" : undefined}>
                  <Td className="whitespace-nowrap font-medium">
                    {c.origem}
                    <span className="text-gray-400"> → </span>
                    {c.destino}
                    {review && (
                      <span className="ml-2 align-middle">
                        <Pill tone="yellow">revisar</Pill>
                      </span>
                    )}
                  </Td>
                  <Td className="text-gray-500">{c.tipo}</Td>
                  <Td className="text-right font-mono tabular-nums">
                    {c.percentual ?? "—"}
                  </Td>
                  <Td className="text-right font-mono tabular-nums text-gray-500">
                    {c.cpm ?? "—"}
                  </Td>
                  <Td className="text-gray-500">{c.origin ?? "—"}</Td>
                  <Td>
                    <Pill tone={toneForStatus(c.status)}>{c.status}</Pill>
                  </Td>
                  <Td colSpan={2}>
                    <form
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
                    </form>
                  </Td>
                </tr>
              );
            })
          ) : (
            <EmptyRow cols={8} label="nenhuma campanha para este filtro" />
          )}
        </tbody>
      </Table>
    </>
  );
}
