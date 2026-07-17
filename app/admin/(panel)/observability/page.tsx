import { rest, fetchAllRows } from "@/lib/admin-db";
import { calendarRows, type Campaignish } from "@/lib/admin-calendar";
import { getConfig } from "@/lib/admin-forecast";
import { buildForecast, formatWindow, type CampaignRow } from "@/lib/forecast";
import {
  PageHeader,
  Pill,
  GateChips,
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
  const [{ config }, loaded, valuations, editions] = await Promise.all([
    getConfig(),
    // Leitura completa e paginada — sem o limite silencioso de 2000. Fase C0.
    fetchAllRows<CampaignRow>(
      "campaigns",
      "id,origem,destino,tipo,percentual,vigencia_inicio,vigencia_fim,observed_at",
    ),
    rest<Valuation>(
      "valuations?select=program,piso,teto,confidence&is_current=eq.true&order=piso.desc",
    ),
    rest<EditionRow>(
      "editions?select=product,title,date,gate_validate,gate_audit,quality_score,beehiiv_url&order=date.desc&limit=50",
    ),
  ]);

  const campaigns = loaded.rows;
  const datasetComplete = loaded.complete;

  // Previsão pelo motor único (mesma config da área de predict). Programas +
  // rotas, mapeados para o shape compacto desta tabela.
  const fc = buildForecast(campaigns, { config });
  const forecast = [...fc.clusters, ...fc.routes].map((f) => ({
    rota: f.route,
    conf: f.confidence,
    prediction: f.windowStart ? `próxima janela ~ ${formatWindow(f.windowStart, f.windowEnd)}` : "histórico insuficiente",
    basis: f.basis,
  }));
  const calendar = calendarRows(campaigns as Campaignish[], month);

  // Marcador de "hoje" no calendário (só se o mês exibido é o corrente).
  const todayIso = new Date().toISOString().slice(0, 10);
  const isCurrentMonth = todayIso.slice(0, 7) === month;
  const daysInMonth =
    calendar[0]?.md ??
    new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const todayLeft = isCurrentMonth
    ? ((Number(todayIso.slice(8, 10)) - 0.5) / daysInMonth) * 100
    : null;

  // Só quem tem histórico real na tabela; "em formação" vira uma nota discreta.
  const confident = forecast.filter((f) => f.conf !== "em-formacao");
  const forming = forecast.filter((f) => f.conf === "em-formacao");

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
          Cada barra é uma campanha ao longo do mês. A linha vertical marca hoje.
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
                    {todayLeft != null && (
                      <span
                        className="absolute top-0 h-4 w-px bg-red-600"
                        style={{ left: `${todayLeft}%` }}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-500">Sem campanhas com vigência neste mês.</p>
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
            {confident.length > 0 ? (
              confident.slice(0, 20).map((f, i) => (
                <tr key={i}>
                  <Td className="font-medium" label="Rota">{f.rota}</Td>
                  <Td label="Confiança">
                    <Pill tone={CONF_TONE(f.conf)}>{f.conf}</Pill>
                  </Td>
                  <Td label="Previsão">{f.prediction}</Td>
                  <Td className="text-gray-500" label="Base">{f.basis}</Td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={4} label="nenhuma rota com histórico suficiente ainda" />
            )}
          </tbody>
        </Table>
        {forming.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            + {forming.length} rotas ainda em formação (menos de {config.minSamples} janela
            {config.minSamples === 1 ? "" : "s"} observada
            {config.minSamples === 1 ? "" : "s"}) — sem previsão até acumular histórico.
          </p>
        )}
        {!datasetComplete && (
          <p className="mt-2 text-xs text-red-600">
            Leitura do ledger incompleta — a previsão acima pode estar parcial. Recarregue.
          </p>
        )}
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
                  <Td className="font-medium" label="Programa">{v.program}</Td>
                  <Td className="text-right font-mono tabular-nums" label="Piso">
                    {v.piso ?? "—"}
                  </Td>
                  <Td className="text-right font-mono tabular-nums" label="Teto">
                    {v.teto ?? "—"}
                  </Td>
                  <Td className="text-gray-500" label="Confiança">{v.confidence ?? "—"}</Td>
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
                  <Td label="Produto">
                    <Pill tone={toneForStatus(e.product)}>{e.product}</Pill>
                  </Td>
                  <Td label="Título">{e.title ?? "—"}</Td>
                  <Td className="font-mono tabular-nums text-gray-500" label="Data">
                    {e.date ?? "—"}
                  </Td>
                  <Td label="Gates">
                    <GateChips validate={e.gate_validate} audit={e.gate_audit} />
                  </Td>
                  <Td className="text-right font-mono tabular-nums" label="Qual.">
                    {e.quality_score ?? "—"}
                  </Td>
                  <Td className="tl-cell-action">
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
