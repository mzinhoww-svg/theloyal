// Analitica derivada do ledger de campanhas, portada do admin anterior para a
// pagina /admin/observability. Funcoes puras (sem I/O) — testaveis e usadas em
// Server Components.

export type Campaignish = {
  origem: string;
  destino: string;
  tipo: string;
  percentual?: number | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  observed_at?: string | null;
};

export type Forecast = {
  rota: string;
  conf: string;
  prediction: string;
  basis: string;
};

export type CalendarBar = { label: string; s: number; e: number; md: number };

function daysBetween(a: string, b: string): number {
  return Math.round((+new Date(b) - +new Date(a)) / 86400000);
}

function addDays(d: string, n: number): string {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
}

// Previsao de janelas de transferencia por recorrencia do historico.
export function forecastRows(campaigns: Campaignish[]): Forecast[] {
  const g = new Map<string, string[]>();
  for (const r of campaigns) {
    if (r.tipo !== "transferencia") continue;
    const key = `${r.origem}→${r.destino}`;
    const d = r.vigencia_inicio || r.observed_at;
    if (!d) continue;
    const arr = g.get(key) || [];
    arr.push(String(d).slice(0, 10));
    g.set(key, arr);
  }
  const out: Forecast[] = [];
  for (const [rota, ds] of Array.from(g.entries())) {
    const dates = Array.from(new Set(ds)).sort();
    if (dates.length < 3) {
      out.push({
        rota,
        conf: "em-formacao",
        prediction: "histórico insuficiente",
        basis: `${dates.length} janela(s)`,
      });
      continue;
    }
    const iv: number[] = [];
    for (let i = 1; i < dates.length; i++)
      iv.push(daysBetween(dates[i - 1], dates[i]));
    const avg = Math.round(iv.reduce((a, b) => a + b, 0) / iv.length);
    const last = dates[dates.length - 1];
    const next = addDays(last, avg);
    const conf = dates.length >= 6 ? "alta" : dates.length >= 4 ? "media" : "baixa";
    out.push({
      rota,
      conf,
      prediction: `próxima janela ~ ${addDays(next, -3)} a ${addDays(next, 3)}`,
      basis: `${dates.length} janelas; recorrência ~${avg} dias; última ${last}`,
    });
  }
  return out.sort(
    (a, b) =>
      (a.conf === "em-formacao" ? 1 : 0) - (b.conf === "em-formacao" ? 1 : 0) ||
      a.rota.localeCompare(b.rota),
  );
}

// Barras do calendario do mes (YYYY-MM). s/e em dias, md = dias no mes.
export function calendarRows(
  campaigns: Campaignish[],
  month: string,
): CalendarBar[] {
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
