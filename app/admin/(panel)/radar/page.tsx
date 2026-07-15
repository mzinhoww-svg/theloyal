// Radar unificado (Fase P1-A) — visão única de editor, analista e operador.
// Forecast e Predict aparecem como motores internos de uma só leitura do ledger.
// Sem persistência nova, sem alterar motores/gates. As telas /admin/forecast,
// /admin/predict e /admin/observability seguem intactas durante a migração.
import { PageHeader, EmptyState } from "@/components/admin/ui";
import {
  RadarHealthSummary,
  RadarKpis,
  RadarFilters,
  RadarSeriesTable,
} from "@/components/admin/radar";
import { loadRadar } from "@/lib/admin-radar";
import { applyRadarFilters, RADAR_FILTER_KEYS, type RadarFilterValues } from "@/lib/radar-filters";

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
  // Estado dos filtros vindo dos query params (preservado na URL ao recarregar).
  const current: Record<string, string> = {};
  for (const k of RADAR_FILTER_KEYS) current[k] = str(sp[k]);

  const vm = await loadRadar();
  const filtered = applyRadarFilters(vm.series, current as RadarFilterValues);

  return (
    <>
      <PageHeader
        title="Radar"
        sub="Visão unificada de campanhas — Forecast e Predict como motores internos de uma única leitura do ledger. Alertas e bloqueios acima de qualquer número."
      />

      {vm.health.campaignsTotal === 0 ? (
        <EmptyState
          label="Sem campanhas no ledger."
          hint="Assim que a coleta e a extração popularem o ledger de transferências, as séries aparecem aqui."
        />
      ) : (
        <>
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
      )}
    </>
  );
}
