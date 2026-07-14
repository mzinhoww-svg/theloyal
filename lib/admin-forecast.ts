// Analítica de calendário derivada do ledger, usada em /admin/observability.
// A PREVISÃO de janelas agora vem do motor único lib/predictions.ts
// (buildForecast) — este arquivo mantém só o calendário do mês.

export type Campaignish = {
  origem?: string | null;
  destino?: string | null;
  tipo?: string | null;
  percentual?: number | string | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  observed_at?: string | null;
};

export type CalendarBar = { label: string; s: number; e: number; md: number };

// Barras do calendário do mês (YYYY-MM). s/e em dias, md = dias no mês.
export function calendarRows(campaigns: Campaignish[], month: string): CalendarBar[] {
  const parts = month.split("-");
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const md = new Date(y, mo, 0).getDate();
  const inMonth = (d: unknown) => !!d && String(d).slice(0, 7) === month;
  return campaigns
    .filter((r) => inMonth(r.vigencia_inicio) || inMonth(r.vigencia_fim))
    .map((r) => {
      const s =
        r.vigencia_inicio && String(r.vigencia_inicio).slice(0, 7) === month
          ? Number(String(r.vigencia_inicio).slice(8, 10))
          : 1;
      const e =
        r.vigencia_fim && String(r.vigencia_fim).slice(0, 7) === month
          ? Number(String(r.vigencia_fim).slice(8, 10))
          : md;
      return {
        label: `${r.origem}→${r.destino}${r.percentual ? " " + r.percentual + "%" : ""}`,
        s,
        e: Math.max(e, s),
        md,
      };
    })
    .sort((a, b) => a.s - b.s);
}
