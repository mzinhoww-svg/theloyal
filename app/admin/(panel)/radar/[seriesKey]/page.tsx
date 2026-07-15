// Detalhe da série do Radar (Fase P1-B). Rota dedicada `/admin/radar/[seriesKey]`
// (link direto, refresh, compartilhamento interno). Reusa o MESMO loadRadar do
// P1-A — nenhuma segunda leitura do ledger, nenhuma segunda fonte de verdade.
import { EmptyState } from "@/components/admin/ui";
import { loadRadar } from "@/lib/admin-radar";
import { findRadarSeries } from "@/lib/radar-detail";
import {
  RadarSeriesDetailHeader,
  RadarSeriesSummary,
  RadarPredictionMain,
  RadarEngineComparison,
  RadarForecastSection,
  RadarPredictSection,
  RadarQualitySummary,
  RadarCampaignsUsed,
  RadarCampaignsExcluded,
  RadarWarningsBlocks,
  RadarTimeline,
  RadarTechLinks,
} from "@/components/admin/radar-detail";

export default async function RadarSeriesPage({
  params,
}: {
  params: { seriesKey: string };
}) {
  const vm = await loadRadar();
  const raw = params.seriesKey;
  let series = findRadarSeries(vm, raw);
  if (!series) {
    try {
      series = findRadarSeries(vm, decodeURIComponent(raw));
    } catch {
      /* chave inválida → trata como inexistente */
    }
  }

  if (!series) {
    return (
      <EmptyState
        label="Série não encontrada."
        hint="A chave pode ter mudado após um recálculo (o Radar é derivado em runtime). Volte ao Radar e abra a série novamente."
        action={<a href="/admin/radar" className="font-semibold text-blue-600 hover:underline">← Voltar ao Radar</a>}
      />
    );
  }

  return (
    <>
      <RadarSeriesDetailHeader series={series} vm={vm} />
      <RadarSeriesSummary series={series} />
      <RadarPredictionMain series={series} />
      <RadarEngineComparison series={series} />
      <RadarForecastSection series={series} />
      <RadarPredictSection series={series} />
      <RadarQualitySummary series={series} vm={vm} />
      <RadarCampaignsUsed series={series} />
      <RadarCampaignsExcluded series={series} />
      <RadarWarningsBlocks series={series} />
      <RadarTimeline series={series} />
      <RadarTechLinks />
    </>
  );
}
