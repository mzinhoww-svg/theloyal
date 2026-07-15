// Configuração canônica da Política do Radar (docs/POLITICA-CANONICA-RADAR.md).
//
// FONTE ÚNICA e versionável dos limiares de PRODUTO — lida pela reconciliação
// (radar-view-model) e pelo pipeline (scripts/forecast.mjs). NÃO recalcula gate
// de motor (isso é forecast/predict); parametriza a NOTA DE CORTE e as faixas de
// divergência. Mudar a política = mudar este arquivo, num lugar só.

export type MinConfidence = "media" | "alta";

export interface RadarPolicyConfig {
  // --- Nota de corte de publicação ao leitor (§7.4) ---
  minReaderConfidence: MinConfidence; // confiança mínima do motor canônico
  backtestMinObservations: number; // ≥N obs de backtest → exige acerto de janela
  minWindowHitRate: number; // acerto de janela mínimo quando o backtest conta

  // --- Faixas de divergência entre motores (§2.6, dias sobre a data central) ---
  divergenceCompatibleDays: number; // ≤ → compatível
  divergenceWarningDays: number; // ≤ → warning (publica com ressalva)
  divergenceReviewDays: number; // ≤ → review; acima → block

  // --- Horizontes por superfície (§3.1) ---
  horizonDailyDays: number; // janela "iminente" do Daily
  horizonWeeklyDays: number; // janela do Weekly

  // --- TTLs (frescor/aprovação — conceituais até a persistência, F3) ---
  ttlCalcHours: number; // idade máxima do cálculo (frescor)
  ttlApprovalDailyHours: number; // validade da aprovação para o Daily
  ttlApprovalWeeklyHours: number; // validade da aprovação para o Weekly
}

// Defaults aprovados (APROVACAO-MVP-RADAR.md §3; ADR-RADAR-004/008).
export const RADAR_POLICY: RadarPolicyConfig = {
  minReaderConfidence: "media",
  backtestMinObservations: 3,
  minWindowHitRate: 0.5,
  divergenceCompatibleDays: 14,
  divergenceWarningDays: 30,
  divergenceReviewDays: 60,
  horizonDailyDays: 30,
  horizonWeeklyDays: 90,
  ttlCalcHours: 24,
  ttlApprovalDailyHours: 24,
  ttlApprovalWeeklyHours: 168,
};

// Confiança do motor (alta/media/baixa/insuficiente/em-formacao) atende ao mínimo?
export function confidenceMeets(confidence: string | null | undefined, min: MinConfidence): boolean {
  if (min === "alta") return confidence === "alta";
  return confidence === "alta" || confidence === "media";
}
