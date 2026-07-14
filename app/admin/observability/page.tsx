import { rest } from "@/lib/admin-db";
import {
  forecastRows,
  calendarRows,
  type Campaignish,
} from "@/lib/admin-forecast";
import {
  PageHeader,
  Pill,
  Table,
  Th,
  Td,
  EmptyRow,
  toneForStatus,
} from "@/components/admin/ui";

type Valuation = {
  program: string;
  piso: number | null;
  teto: number | null;
  confidence: string | null;
};
type EditionRow = {
  product: string;
  title: string | null;
  date: string | null;
  gate_validate: boolean | null;
  gate_audit: boolean | null;
  quality_score: number | null;
  beehiiv_url: string | null;
};

const CONF_TONE = (c: string): "green" | "blue" | "gray" =>
  c === "alta" ? "green" : c === "media" ? "blue" : "gray";

export default async function ObservabilityPage() {
  const month = new Date().toISOString().slice(0, 7);
  const [campaigns, valuations, editions] = await Promise.all([
    rest<Campaignish>(
      "campaigns?select=origem,destino,tipo,percentual,vigencia_inicio,vigencia_fim,observed_at&limit=500",
    ),
    rest<Valuation>(
      "valuations?select=program,piso,teto,confidence&is_current=eq.true&order=piso.desc",
    ),
    rest<EditionRow>(
      "editions?select=product,title,date,gate_validate,gate_audit,quality_score,beehiiv_url&order=date.desc&limit=50",
    ),
  ]);

  const forecast = forecastRows(campaigns);
  const calendar = calendarRows(campaigns, month);

  return (
    <>
      <PageHeader
        title="Observabilidade"
        sub="Calendário, previsão de janelas, régua de valor e edições — derivados do ledger."
      />

      <section className="mb-8">
        <h2 className="mb-1 font-display text-lg font-semibold">
          Calendário de promoções · {month}
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          Cada barra é uma campanha ao longo do mês.
        </p>
        <div className="rounded-lg border border-line bg-surface p-4">
          {calendar.length > 0 ? (
            calendar.slice(0, 24).map((c, i) => {
              const left = ((c.s - 1) / c.md) * 100;
              const w = Math.max(3, ((c.e - c.s + 1) / c.md) * 100);
              return (
                <div key={i} className="my-1 flex items-center gap-3 text-xs">
                  <div className="w-48 flex-none truncate text-gray-700">
                    {c.label}
                  </div>
                  <div className="relative h-4 flex-1 rounded bg-paper-dark">
                    <div
                      className="absolute h-4 rounded bg-blue-600"
                      style={{ left: `${left}%`, width: `${w}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-400">sem campanhas no mês</p>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 font-display text-lg font-semibold">
          Previsão de janelas
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          Por recorrência do histórico do ledger (transferências).
        </p>
        <Table>
          <thead>
            <tr>
              <Th>Rota</Th>
              <Th>Confiança</Th>
              <Th>Previsão</Th>
              <Th>Base</Th>
            </tr>
          </thead>
          <tbody>
            {forecast.length > 0 ? (
              forecast.slice(0, 20).map((f, i) => (
                <tr key={i}>
                  <Td className="font-medium">{f.rota}</Td>
                  <Td>
                    <Pill tone={CONF_TONE(f.conf)}>{f.conf}</Pill>
                  </Td>
                  <Td>{f.prediction}</Td>
                  <Td className="text-gray-500">{f.basis}</Td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={4} label="histórico insuficiente" />
            )}
          </tbody>
        </Table>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 font-display text-lg font-semibold">
          Régua de valor (valuations)
        </h2>
        <Table>
          <thead>
            <tr>
              <Th>Programa</Th>
              <Th className="text-right">Piso</Th>
              <Th className="text-right">Teto</Th>
              <Th>Confiança</Th>
            </tr>
          </thead>
          <tbody>
            {valuations.length > 0 ? (
              valuations.map((v, i) => (
                <tr key={i}>
                  <Td className="font-medium">{v.program}</Td>
                  <Td className="text-right font-mono tabular-nums">
                    {v.piso ?? "—"}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {v.teto ?? "—"}
                  </Td>
                  <Td className="text-gray-500">{v.confidence ?? "—"}</Td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={4} label="sem valuations" />
            )}
          </tbody>
        </Table>
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg font-semibold">Edições</h2>
        <Table>
          <thead>
            <tr>
              <Th>Produto</Th>
              <Th>Título</Th>
              <Th>Data</Th>
              <Th>Gates</Th>
              <Th className="text-right">Qual.</Th>
              <Th>Beehiiv</Th>
            </tr>
          </thead>
          <tbody>
            {editions.length > 0 ? (
              editions.map((e, i) => (
                <tr key={i}>
                  <Td>
                    <Pill tone={toneForStatus(e.product)}>{e.product}</Pill>
                  </Td>
                  <Td>{e.title ?? "—"}</Td>
                  <Td className="font-mono tabular-nums text-gray-500">
                    {e.date ?? "—"}
                  </Td>
                  <Td className="font-mono">
                    {e.gate_validate ? "✓" : "✗"} {e.gate_audit ? "✓" : "✗"}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {e.quality_score ?? "—"}
                  </Td>
                  <Td>
                    {e.beehiiv_url ? (
                      <a
                        href={e.beehiiv_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        abrir →
                      </a>
                    ) : (
                      "—"
                    )}
                  </Td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={6} label="sem edições" />
            )}
          </tbody>
        </Table>
      </section>
    </>
  );
}
