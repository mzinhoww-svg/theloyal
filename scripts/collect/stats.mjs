// Estatística determinística do VPM observado. Zero dependência.
// A conta NUNCA passa pelo LLM — só por aqui, para ser pública e auditável.
//
//   VPM (R$/milheiro) = cash_brl / (points / 1000)
//
// A banda por player/categoria usa MEDIANA (não média) e rejeita outliers por
// MAD (modified z-score), para que um SKU fora da curva — ou promocionado que
// escapou do filtro — não "suje" o indicador, como pediu o Deivid.

// R$/milheiro a partir de preço em dinheiro e pontos.
export function vpm(cashBrl, points) {
  const c = Number(cashBrl);
  const p = Number(points);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p <= 0) return null;
  return c / (p / 1000);
}

export function median(values) {
  const arr = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (!arr.length) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

// Modified z-score (Iglewicz–Hoaglin). Descarta |z| > threshold.
// z = 0.6745 * (x - mediana) / escala, escala = MAD = mediana(|x - mediana|).
//
// Piso na escala: quando a maioria dos pontos é idêntica, o MAD colapsa a ~0 e
// qualquer ruído de ponto flutuante viraria "outlier". Ancoramos a escala em, no
// mínimo, 0,1% da mediana — assim ruído numérico nunca derruba um ponto legítimo,
// mas um outlier real (ex.: 28 vs 12 R$/milheiro) continua sendo descartado.
export function rejectOutliers(values, threshold = 3.5) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length < 3) return { kept: nums.slice(), dropped: [] };
  const med = median(nums);
  const mad = median(nums.map((v) => Math.abs(v - med)));
  const scale = Math.max(mad, 1e-3 * Math.abs(med));
  if (!scale) return { kept: nums.slice(), dropped: [] }; // mediana 0 e sem dispersão
  const kept = [];
  const dropped = [];
  for (const v of nums) {
    const z = (0.6745 * Math.abs(v - med)) / scale;
    (z > threshold ? dropped : kept).push(v);
  }
  return { kept, dropped };
}

// Confiança pela robustez da amostra (após limpar promo e outliers).
export function confidenceForSample(n) {
  if (n >= 8) return "alta";
  if (n >= 5) return "media";
  if (n >= 3) return "baixa";
  return "em-formacao";
}

// Banda observada de uma coleção de VPMs (já filtrados de promo).
// Retorna piso/mediana/teto sobre a amostra limpa + metadados.
export function band(vpms, { minSample = 3 } = {}) {
  const clean = vpms.filter((v) => Number.isFinite(v));
  const { kept, dropped } = rejectOutliers(clean);
  const n = kept.length;
  const med = median(kept);
  const sorted = kept.slice().sort((a, b) => a - b);
  return {
    piso: sorted.length ? sorted[0] : null,
    mediana: med,
    teto: sorted.length ? sorted[sorted.length - 1] : null,
    sample_n: n,
    outliers_dropped: dropped.length,
    confidence: confidenceForSample(n),
    // Abaixo do mínimo → downstream trata como "n/c" (não confirmado).
    confirmed: n >= minSample,
  };
}

// Formata R$/milheiro em pt-BR (JetBrains Mono no render).
export function fmtBRL(v) {
  if (!Number.isFinite(v)) return "n/c";
  return "R$ " + v.toFixed(2).replace(".", ",") + " /milheiro";
}
