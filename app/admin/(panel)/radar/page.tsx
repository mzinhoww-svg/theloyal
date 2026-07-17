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
} from "@/components/admin/radar-operations";
import { loadRadar } from "@/lib/admin-radar";
import { applyRadarFilters, RADAR_FILTER_KEYS, type RadarFilterValues } from "@/lib/radar-filters";
import { resolveRadarView } from "@/lib/radar-operations";
import { RADAR_EMPTY } from "@/lib/radar-empty";

type SearchParams = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function RadarPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sp = searchParams ?? {};
  const { view, invalid } = resolveRadarView(str(sp.view));

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
      {invalid && (
        <p role="status" className="mb-3 rounded-lg border border-yellow-500 bg-yellow-100 px-3 py-2 text-sm text-ink">
          Aba não encontrada — exibindo a <strong>Visão geral</strong>. Verifique o link.
        </p>
      )}
      <RadarTabs current={view} />

      {empty ? (
        <EmptyState label={RADAR_EMPTY.no_campaigns.title} hint={`${RADAR_EMPTY.no_campaigns.description} ${RADAR_EMPTY.no_campaigns.action}`} />
      ) : view === "geral" ? (
        <>
          <RadarOperationalSummary vm={vm} compact />
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
