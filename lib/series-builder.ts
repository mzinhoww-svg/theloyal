// Series-builder — fonte ÚNICA da formação de séries dos motores Forecast e
// Predict (ADR-SERIES-001). Concentra o que os dois faziam em dobro:
// data-real-da-janela, normalização de programa, aritmética de datas, colapso
// de ondas e o agrupamento rota/cluster. Os MODELOS continuam separados de
// propósito (mediana+janela editorial vs hazard+backtest), assim como as
// estatísticas com semânticas próprias (arredondamento/null) de cada um.
//
// Puro e determinístico — sem I/O, sem LLM. Comportamento travado por
// tests/series-characterization.test.mjs: mudou saída, quebrou teste.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TRAILING_DATE = /(\d{4}-\d{2}-\d{2})$/;
export const DAY_MS = 86_400_000;

// Linha crua da tabela `campaigns` do Supabase (campos usados pelos motores).
export interface CampaignRow {
  id?: string | null;
  tipo?: string | null;
  origem?: string | null;
  destino?: string | null;
  percentual?: number | string | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  observed_at?: string | null;
  first_seen?: string | null;
  status?: string | null;
}

export function isValidISODate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO_DATE.test(s.slice(0, 10))) return false;
  return Number.isFinite(Date.parse(s.slice(0, 10) + "T00:00:00Z"));
}

// Data REAL da janela — nunca observed_at/first_seen (artefatos de ingestão do
// backfill, que destroem a recorrência). Ordem de confiança:
//   vigencia_inicio > data no id (…-YYYY-MM-DD) > vigencia_fim válido.
export function windowDate(row: CampaignRow): string | null {
  if (isValidISODate(row.vigencia_inicio)) return String(row.vigencia_inicio).slice(0, 10);
  const idMatch = typeof row.id === "string" ? row.id.match(TRAILING_DATE) : null;
  if (idMatch && isValidISODate(idMatch[1])) return idMatch[1];
  if (isValidISODate(row.vigencia_fim)) return String(row.vigencia_fim).slice(0, 10);
  return null;
}

// bb ≠ bb-empresas (programas distintos) permanecem separados de propósito.
const PROGRAM_ALIASES: Record<string, string> = {
  "azul fidelidade": "azul",
  "latam pass": "latampass",
  "latam-pass": "latampass",
  tudoazul: "azul",
  "smiles gol": "smiles",
  "connect miles": "connectmiles",
  "life miles": "lifemiles",
  "amex mr": "amex-mr",
  "membership rewards": "amex-mr",
};

export function normProgram(s: unknown): string {
  const base = String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return PROGRAM_ALIASES[base] ?? base;
}

export function toMs(iso: string): number {
  return Date.parse(iso.slice(0, 10) + "T00:00:00Z");
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / DAY_MS);
}

export function addDays(iso: string, n: number): string {
  return new Date(toMs(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

// Colapsa datas ≤ epsilon dias entre si na mais antiga da onda ("ondas" quase
// simultâneas = mesma campanha vista por várias origens/fontes). Dedupe e
// ordena internamente — aceita entrada em qualquer ordem.
export function collapseWaves(dates: string[], epsilon: number): string[] {
  const sorted = Array.from(new Set(dates)).sort();
  const out: string[] = [];
  for (const d of sorted) {
    if (!out.length || daysBetween(out[out.length - 1], d) > epsilon) out.push(d);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Outlier de intervalo (MAD) — detecção genérica que faltava nos dois motores:
// a contenção C0.2 segura o caso extremo (>900d), mas um 629d numa série de
// cadência ~30d entrava cru na mediana/hazard. Detecta intervalos atípicos
// RELATIVOS à própria série. Só SINALIZA (warning) — não altera cálculo nem
// apaga dado; integrar ao gate/confiança é decisão H4 (fase 4 do plano).
// ---------------------------------------------------------------------------

const MAD_Z_THRESHOLD = 3.5; // limiar clássico de Iglewicz-Hoaglin
const MAD_MIN_INTERVALS = 4; // abaixo disso não há base robusta para MAD

function medianOf(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Flag por intervalo: true = atípico para a cadência da série. Séries com
// menos de 4 intervalos não têm base robusta → nenhum flag (nunca chutar).
export function intervalOutlierFlags(intervals: number[]): boolean[] {
  if (intervals.length < MAD_MIN_INTERVALS) return intervals.map(() => false);
  const med = medianOf(intervals);
  const mad = medianOf(intervals.map((x) => Math.abs(x - med)));
  if (mad === 0) {
    // Série perfeitamente regular: qualquer desvio grande é atípico.
    return intervals.map((x) => x !== med && Math.abs(x - med) > Math.max(7, med));
  }
  return intervals.map((x) => (0.6745 * Math.abs(x - med)) / mad > MAD_Z_THRESHOLD);
}

// Warning legível para o operador (vazio quando não há outlier).
export function intervalOutlierWarning(intervals: number[]): string | null {
  const flags = intervalOutlierFlags(intervals);
  const hits = intervals.filter((_, i) => flags[i]);
  if (!hits.length) return null;
  const med = Math.round(medianOf(intervals));
  return `intervalo(s) atípico(s) para a cadência da série: ${hits
    .map((d) => `${d}d`)
    .join(", ")} (mediana ${med}d) — possível erro de dado ou lacuna de cobertura`;
}

// ---------------------------------------------------------------------------
// Agrupamento rota/cluster — o particionamento que os dois motores repetiam.
// Pré-condição dos chamadores: `rows` já passou pelo gate C0.2
// (assessCampaignQuality), então não há placeholder de origem/destino nem
// linha sem data candidata. Rota exige origem+destino; cluster exige destino.
// ---------------------------------------------------------------------------

export interface SeriesGroup {
  origem: string | null; // null em cluster
  destino: string;
  rows: CampaignRow[];
}

export function groupTransferSeries(
  rows: CampaignRow[],
  normalize: (s: unknown) => string = normProgram,
): { routes: Map<string, SeriesGroup>; clusters: Map<string, SeriesGroup> } {
  const routes = new Map<string, SeriesGroup>();
  const clusters = new Map<string, SeriesGroup>();
  for (const row of rows) {
    const origem = normalize(row.origem);
    const destino = normalize(row.destino);
    if (!destino) continue;

    let cg = clusters.get(destino);
    if (!cg) clusters.set(destino, (cg = { origem: null, destino, rows: [] }));
    cg.rows.push(row);

    if (!origem) continue;
    const rk = `${origem}→${destino}`;
    let rg = routes.get(rk);
    if (!rg) routes.set(rk, (rg = { origem, destino, rows: [] }));
    rg.rows.push(row);
  }
  return { routes, clusters };
}

// Datas de onda + percentuais válidos de um grupo (visão do Forecast).
export function groupWaveInputs(
  group: SeriesGroup,
  epsilon: number,
): { waves: string[]; percents: number[] } {
  const dates: string[] = [];
  const percents: number[] = [];
  for (const row of group.rows) {
    const d = windowDate(row);
    if (!d) continue;
    dates.push(d);
    const pct = typeof row.percentual === "number" ? row.percentual : Number(row.percentual);
    if (Number.isFinite(pct) && pct > 0) percents.push(pct);
  }
  return { waves: collapseWaves(dates, epsilon), percents };
}
