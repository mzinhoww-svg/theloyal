// Motor de cálculo do Radar de VPM de Shopping (Fase 2b do PROMPT MESTRE).
// Funções puras, versionadas. VPM = valor em reais por 1.000 pontos.
// Regra editorial: nunca calcular com preço/pontos ausentes; nunca misturar
// modalidades (padrão × elite × marginal híbrido). Backend, determinístico.
//   node scripts/shopping/vpm.mjs --test   → valida contra os casos do spec §9

export const CALCULATION_VERSION = "shopping_vpm_v1";

function pos(n) {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}
function round4(n) {
  return Math.round(n * 1e4) / 1e4;
}

// VPM de resgate integral: reference_price / points * 1000.
export function vpm(referencePrice, points) {
  if (!pos(referencePrice) || !pos(points)) return null;
  return round4((referencePrice / points) * 1000);
}

// Núcleo por observação. Devolve os VPMs por modalidade + comparabilidade.
// Não estima preço a partir de pontos (spec §9.5 / §12.3).
export function computeMetrics(obs) {
  const price = numOrNull(obs.reference_price ?? obs.referencePrice);
  const std = numOrNull(obs.standard_points ?? obs.standardPoints);
  const elite = numOrNull(obs.elite_points ?? obs.elitePoints);
  const club = numOrNull(obs.club_points ?? obs.clubPoints);
  const card = numOrNull(obs.card_points ?? obs.cardPoints);
  const promo = numOrNull(obs.promotional_points ?? obs.promotionalPoints);
  const hybridPts = numOrNull(obs.hybrid_points ?? obs.hybridPoints);
  const hybridCash = numOrNull(obs.hybrid_cash ?? obs.hybridCash);

  const preserved = pos(std) && pos(hybridPts) && std > hybridPts ? std - hybridPts : null;

  const m = {
    vpm_standard: vpm(price, std),
    vpm_club: vpm(price, club),
    vpm_card: vpm(price, card),
    vpm_elite: vpm(price, elite),
    vpm_promotional: vpm(price, promo),
    vpm_hybrid_marginal: pos(preserved) && pos(hybridCash) ? round4((hybridCash / preserved) * 1000) : null,
    preserved_points: preserved,
    is_comparable: false,
    comparison_reason: null,
    calculation_version: CALCULATION_VERSION,
  };

  // Comparabilidade do resgate INTEGRAL (o benchmark principal usa vpm_standard).
  if (!pos(price)) m.comparison_reason = "missing_reference_price";
  else if (!pos(std)) m.comparison_reason = "missing_standard_points";
  else if ((obs.availability ?? "unknown") === "not_listed") m.comparison_reason = "not_listed";
  else if ((obs.match_confidence ?? "low") === "low" || obs.match_confidence === "rejected")
    m.comparison_reason = "low_match_confidence";
  else if ((obs.source_url_type ?? "product") === "category") m.comparison_reason = "category_url_only";
  else m.is_comparable = true;

  return m;
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------- estatística ----------
export function median(xs) {
  return percentile(xs, 50);
}

// Percentil por interpolação linear (compatível com percentile_cont do Postgres).
export function percentile(xs, p) {
  const s = xs.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  if (s.length === 1) return round4(s[0]);
  const rank = (p / 100) * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return round4(s[lo]);
  return round4(s[lo] + (s[hi] - s[lo]) * (rank - lo));
}

// Outliers por IQR (spec §20). Marca (não exclui) fora de [Q1-1.5·IQR, Q3+1.5·IQR].
export function iqrOutliers(xs, k = 1.5) {
  const q1 = percentile(xs, 25);
  const q3 = percentile(xs, 75);
  if (q1 == null || q3 == null) return xs.map(() => false);
  const iqr = q3 - q1;
  const lo = q1 - k * iqr;
  const hi = q3 + k * iqr;
  return xs.map((v) => Number.isFinite(v) && (v < lo || v > hi));
}

// Qualidade da amostra (spec §14/§18).
export function sampleQuality(nValid) {
  if (nValid <= 0) return "no_data";
  if (nValid === 1) return "insufficient";
  if (nValid === 2) return "indicative";
  if (nValid <= 4) return "minimum";
  if (nValid <= 9) return "usable";
  return "robust";
}

// ---------- casos de teste (spec §9) ----------
function approx(a, b, tol = 0.02) {
  return a != null && Math.abs(a - b) <= tol;
}
function runTests() {
  const cases = [
    { name: "9.1 Boombox3 LATAM", in: { reference_price: 2609.91, standard_points: 186329, elite_points: 131236, hybrid_points: 114832, hybrid_cash: 1013.28 }, exp: { vpm_standard: 14.007, vpm_elite: 19.8871, preserved_points: 71497, vpm_hybrid_marginal: 14.1723 } },
    { name: "9.2 Boombox3 Smiles", in: { reference_price: 2799.0, standard_points: 201528, elite_points: 185406 }, exp: { vpm_standard: 13.8889, vpm_elite: 15.0966 } },
    { name: "9.3 PartyBox Club 120 LATAM", in: { reference_price: 1889.1, standard_points: 136498, elite_points: 94992, hybrid_points: 83118, hybrid_cash: 733.43 }, exp: { vpm_standard: 13.8398, vpm_elite: 19.8869, preserved_points: 53380, vpm_hybrid_marginal: 13.7398 } },
    { name: "9.4 PartyBox Ultimate LATAM", in: { reference_price: 7691.9, standard_points: 615295, elite_points: 386775, hybrid_points: 338428, hybrid_cash: 2986.28 }, exp: { vpm_standard: 12.5012, vpm_elite: 19.8873, preserved_points: 276867, vpm_hybrid_marginal: 10.786 } },
    { name: "9.5 sem preço", in: { reference_price: null, standard_points: 221592 }, exp: { vpm_standard: null, is_comparable: false, comparison_reason: "missing_reference_price" } },
  ];
  let pass = 0;
  for (const c of cases) {
    const m = computeMetrics(c.in);
    const checks = Object.entries(c.exp).map(([k, v]) => {
      if (v === null) return m[k] === null;
      if (typeof v === "boolean" || typeof v === "string") return m[k] === v;
      return approx(m[k], v);
    });
    const ok = checks.every(Boolean);
    if (ok) pass++;
    console.log(`${ok ? "✓" : "✗"} ${c.name}` + (ok ? "" : ` → got ${JSON.stringify(pickKeys(m, c.exp))}`));
  }
  console.log(`\n${pass}/${cases.length} casos §9 OK`);
  process.exit(pass === cases.length ? 0 : 1);
}
function pickKeys(o, exp) {
  const r = {};
  for (const k of Object.keys(exp)) r[k] = o[k];
  return r;
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes("--test")) runTests();
