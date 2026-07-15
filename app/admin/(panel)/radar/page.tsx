// Radar unificado (Fase P1-A + operação P1-C). Uma entrada `/admin/radar` com
// abas (?view=): Visão geral · Oportunidades · Revisões · Bloqueios · Operação.
// Tudo derivado em runtime do MESMO loadRadar — sem segunda leitura, sem cálculo
// novo, sem persistência. Forecast/Predict/Observability seguem intactas.
import { PageHeader, EmptyState } from "@/components/admin/ui";
import {
  RadarHealthSummary,
  RadarKpis,
  RadarFilters,
  RadarSeriesTable,
} from "@/components/admin/radar";
import {
  RadarTabs,
  RadarOperationalSummary,
  RadarAlertsPanel,
  RadarQueuesView,
  RadarBlocksView,
  RadarChanges,
  type RadarView,
} from "@/components/admin/radar-operations";
import { loadRadar } from "@/lib/admin-radar";
import { applyRadarFilters, RADAR_FILTER_KEYS, type RadarFilterValues } from "@/lib/radar-filters";

type SearchParams = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

const VIEWS: RadarView[] = ["geral", "oportunidades", "revisoes", "bloqueios", "operacao"];

export default async function RadarPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sp = searchParams ?? {};
  const viewRaw = str(sp.view);
  const view: RadarView = (VIEWS as string[]).includes(viewRaw) ? (viewRaw as RadarView) : "geral";

  const current: Record<string, string> = {};
  for (const k of RADAR_FILTER_KEYS) current[k] = str(sp[k]);

  const vm = await loadRadar();
  const filtered = applyRadarFilters(vm.series, current as RadarFilterValues);

  const empty = vm.health.campaignsTotal === 0;

  return (
    <>
      <PageHeader
        title="Radar"
        sub="Visão unificada de campanhas — Forecast e Predict como motores internos de uma única leitura do ledger. Alertas e bloqueios acima de qualquer número."
      />
      <RadarTabs current={view} />

      {empty ? (
        <EmptyState
          label="Sem campanhas no ledger."
          hint="Assim que a coleta e a extração popularem o ledger de transferências, as séries aparecem aqui."
        />
      ) : view === "geral" ? (
        <>
          <RadarOperationalSummary vm={vm} />
          <RadarHealthSummary vm={vm} />
          <RadarKpis vm={vm} />
          <RadarFilters vm={vm} current={current} />
          <p className="mb-2 text-xs text-gray-500">
            {filtered.length} de {vm.series.length} séries · Forecast (baseline/fallback) e
            Predict (principal quando pronto) reconciliados em runtime — recomendação não
            persistida (a reconciliação canônica é fase futura).
          </p>
          <RadarSeriesTable series={filtered} />
        </>
      ) : view === "oportunidades" ? (
        <RadarQueuesView vm={vm} keys={["opportunities"]} />
      ) : view === "revisoes" ? (
        <RadarQueuesView vm={vm} keys={["review"]} />
      ) : view === "bloqueios" ? (
        <RadarBlocksView vm={vm} />
      ) : (
        <>
          <RadarOperationalSummary vm={vm} />
          <RadarAlertsPanel vm={vm} />
          <RadarQueuesView vm={vm} keys={["suspects", "duplicates", "insufficient", "stale", "no_prediction"]} />
          <RadarChanges vm={vm} />
        </>
      )}
    </>
  );
}
