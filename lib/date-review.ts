// Trilha D — correção ASSISTIDA de datas fabricadas pela extração.
//
// O lineage (docs/auditoria/predict-forecast-lineage.md) prova o padrão: o
// extrator fabrica o ANO em vigencia_fim (campanha de 2025 datada 2024), o gap
// evento↔proveniência fica ≈ N anos e o C0.2 bloqueia a linha (suspect_year).
// Este módulo propõe a correção com a evidência — e SÓ propõe: aplicar é
// decisão do operador (regra-mãe: sem dado confirmado → "Não confirmado",
// nunca chutar). Puro e testável; a persistência vive em lib/admin-forecast.

import type { CampaignQualityAssessment, CampaignQualityRow } from "./campaign-quality.ts";
import { isValidISODate } from "./series-builder.ts";

const MONTHS_PT: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

export interface UrlDateHint {
  month: number | null;
  year: number; // 4 dígitos
  raw: string;
}

// Datas citadas na URL da fonte: "fev25", "set-25", "jul2026", "2025-02", "2026".
export function extractUrlDateHints(url: string | null | undefined): UrlDateHint[] {
  if (!url) return [];
  const hints: UrlDateHint[] = [];
  const s = url.toLowerCase();
  const mes = /(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[-_]?((?:20)?\d{2})(?!\d)/g;
  for (const m of Array.from(s.matchAll(mes))) {
    const yy = Number(m[2].length === 2 ? `20${m[2]}` : m[2]);
    if (yy >= 2015 && yy <= 2035) hints.push({ month: MONTHS_PT[m[1]], year: yy, raw: m[0] });
  }
  for (const m of Array.from(s.matchAll(/(?<!\d)(20\d{2})(?!\d)/g))) {
    const yy = Number(m[1]);
    if (yy >= 2015 && yy <= 2035) hints.push({ month: null, year: yy, raw: m[1] });
  }
  return hints;
}

export interface DateCorrectionProposal {
  campaignId: string;
  route: string;
  currentEventDate: string; // data (errada) que os motores usariam
  provenanceDate: string; // proveniência mínima (first_seen/observed/created)
  dayDifference: number; // proveniência − evento
  proposedDate: string; // correção: mesmo dia/mês, ano corrigido
  yearsShifted: number;
  evidence: string[]; // legível, para o operador decidir
  confidence: "alta" | "media";
}

const shiftYears = (iso: string, years: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y + years, m - 1, d));
  return target.toISOString().slice(0, 10);
};

// Tolerância do padrão "gap ≈ N anos" (o lineage mostra concentração 300–430d).
const YEAR_TOLERANCE_DAYS = 65;

// Propõe correções para campanhas EXCLUÍDAS por suspect_year cujo gap casa com
// o padrão de ano fabricado. URL que cita data conflitante com a proposta →
// proposta descartada (não confirmado). URL que confirma → confiança alta.
export function proposeDateCorrections(
  rows: CampaignQualityRow[],
  quality: CampaignQualityAssessment,
): DateCorrectionProposal[] {
  const byId = new Map(rows.map((r) => [String(r.id ?? ""), r]));
  const out: DateCorrectionProposal[] = [];

  for (const ex of quality.excluded) {
    const t = ex.temporal;
    if (!t.flags.includes("suspect_year")) continue;
    if (!t.eventDate || !t.provenanceDate || t.dayDifference == null) continue;
    if (!isValidISODate(t.eventDate) || !isValidISODate(t.provenanceDate)) continue;

    const years = Math.round(t.dayDifference / 365);
    if (years < 1) continue;
    const drift = Math.abs(t.dayDifference - years * 365);
    if (drift > YEAR_TOLERANCE_DAYS) continue; // gap não parece "ano fabricado"

    const proposed = shiftYears(t.eventDate, years);
    const evidence = [
      `gap evento→proveniência de ${t.dayDifference}d ≈ ${years} ano(s) (desvio ${drift}d)`,
      `proveniência mínima ${t.provenanceDate}`,
    ];

    let confidence: DateCorrectionProposal["confidence"] = "media";
    const row = byId.get(ex.id);
    const hints = extractUrlDateHints(row?.source_url);
    if (hints.length) {
      const proposedYear = Number(proposed.slice(0, 4));
      const confirms = hints.some((h) => h.year === proposedYear);
      const contradicts = hints.every((h) => h.year !== proposedYear);
      if (confirms) {
        confidence = "alta";
        const h = hints.find((x) => x.year === proposedYear);
        evidence.push(`URL da fonte cita "${h?.raw}"`);
      } else if (contradicts) {
        continue; // fonte contradiz a proposta → não confirmado, não propõe
      }
    }

    out.push({
      campaignId: ex.id,
      route: ex.route,
      currentEventDate: t.eventDate,
      provenanceDate: t.provenanceDate,
      dayDifference: t.dayDifference,
      proposedDate: proposed,
      yearsShifted: years,
      evidence,
      confidence,
    });
  }
  return out;
}

// Validação para o INGEST (coletores): rejeita/naifica um evento cuja data
// esteja o padrão "≈ N anos" antes da proveniência conhecida. Exportado para
// os pipelines de coleta usarem ANTES de gravar no ledger.
export function eventDateLooksFabricated(
  eventDate: string,
  provenanceDate: string,
): { fabricated: boolean; yearsOff: number } {
  if (!isValidISODate(eventDate) || !isValidISODate(provenanceDate))
    return { fabricated: false, yearsOff: 0 };
  const gap = Math.round(
    (Date.parse(provenanceDate + "T00:00:00Z") - Date.parse(eventDate + "T00:00:00Z")) / 86_400_000,
  );
  const years = Math.round(gap / 365);
  const fabricated = years >= 1 && Math.abs(gap - years * 365) <= YEAR_TOLERANCE_DAYS;
  return { fabricated, yearsOff: fabricated ? years : 0 };
}
