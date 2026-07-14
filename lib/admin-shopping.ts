// Camada de leitura da área Radar de VPM (/admin/shopping-vpm). Server-only
// (usa admin-db → service key). Monta os view models das visões do §25.
import { rest } from "./admin-db";

export const PROGRAMS = ["latam_pass", "azul_fidelidade", "smiles"] as const;
export type Program = (typeof PROGRAMS)[number];
export const PROGRAM_LABEL: Record<string, string> = {
  latam_pass: "LATAM Pass",
  azul_fidelidade: "Azul Fidelidade",
  smiles: "Smiles",
};

export type Benchmark = {
  category_code: string; program_code: string; reference_date: string;
  valid_products: number; total_products: number; coverage_rate: number | null;
  vpm_standard_p25: number | null; vpm_standard_median: number | null; vpm_standard_p75: number | null;
  vpm_elite_median: number | null; sample_quality: string;
};
export type Comparison = {
  product_id: string; reference_date: string; programs_available: number; valid_observations: number;
  best_standard_program: string | null; best_standard_vpm: number | null;
  best_elite_program: string | null; best_elite_vpm: number | null;
  comparison_status: string; quality_status: string;
  shopping_products: { normalized_name: string; category_code: string; expected_program_coverage: number | null } | null;
};
export type SkuLatest = {
  product_id: string; canonical_key: string; normalized_name: string; category_code: string;
  program_code: string; captured_at: string; reference_price: number | null;
  standard_points: number | null; elite_points: number | null; availability: string;
  match_confidence: string; source_url: string | null;
  vpm_standard: number | null; vpm_elite: number | null; is_comparable: boolean; comparison_reason: string | null;
};
export type ProductRow = {
  id: string; canonical_key: string; normalized_name: string; brand: string; category_code: string;
  status: string; approved: boolean; match_confidence: string; expected_program_coverage: number | null;
};
export type SourceRow = {
  product_id: string; program_code: string; source_url_type: string; source_status: string;
  product_url: string | null; extraction_method: string;
};
export type Run = {
  id: string; trigger_type: string; status: string; started_at: string | null; completed_at: string | null;
  selected_sources: number; successful_sources: number; failed_sources: number; observations_created: number; created_at: string;
};

function median(xs: number[]): number | null {
  const s = xs.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));

export type ProgramSummary = {
  program: string; medianStandard: number | null; medianElite: number | null;
  validSkus: number; inStock: number; coverage: number | null; categories: number;
};
export type SkuComparisonRow = {
  productId: string; name: string; category: string;
  cells: Record<string, { vpmStandard: number | null; vpmElite: number | null; price: number | null; availability: string; reason: string | null } | undefined>;
  bestStandardProgram: string | null; bestStandardVpm: number | null; status: string; quality: string;
};
export type CatalogRow = {
  id: string; name: string; category: string; status: string; matchConfidence: string;
  sources: number; productUrls: number; programs: string[];
};
export type Gap = { name: string; program: string; issue: string };

export type ShoppingData = {
  refDate: string | null;
  programs: ProgramSummary[];
  skuRows: SkuComparisonRow[];
  categories: Benchmark[];
  catalog: CatalogRow[];
  gaps: Gap[];
  runs: Run[];
  counts: { products: number; sources: number; observations: number; comparable: number };
};

export async function loadShopping(): Promise<ShoppingData> {
  const [benchmarks, comparisons, latest, products, sources, runs] = await Promise.all([
    rest<Benchmark>("shopping_category_benchmarks?select=*&order=reference_date.desc"),
    rest<Comparison>("shopping_sku_comparisons?select=*,shopping_products(normalized_name,category_code,expected_program_coverage)&order=reference_date.desc"),
    rest<SkuLatest>("shopping_sku_latest_v?select=*"),
    rest<ProductRow>("shopping_products?select=id,canonical_key,normalized_name,brand,category_code,status,approved,match_confidence,expected_program_coverage&order=normalized_name.asc"),
    rest<SourceRow>("shopping_product_sources?select=product_id,program_code,source_url_type,source_status,product_url,extraction_method"),
    rest<Run>("shopping_collection_runs?select=*&order=created_at.desc&limit=20"),
  ]);

  const refDate = benchmarks[0]?.reference_date ?? comparisons[0]?.reference_date ?? null;
  const benchNow = benchmarks.filter((b) => b.reference_date === refDate);
  const compNow = comparisons.filter((c) => c.reference_date === refDate);

  // Resumo por programa
  const programs: ProgramSummary[] = PROGRAMS.map((prog) => {
    const b = benchNow.filter((x) => x.program_code === prog);
    const lat = latest.filter((x) => x.program_code === prog);
    return {
      program: prog,
      medianStandard: median(b.map((x) => num(x.vpm_standard_median)).filter((n): n is number => n != null)),
      medianElite: median(b.map((x) => num(x.vpm_elite_median)).filter((n): n is number => n != null)),
      validSkus: lat.filter((x) => x.is_comparable).length,
      inStock: lat.filter((x) => x.availability === "in_stock").length,
      coverage: b.length ? b.reduce((a, x) => a + (num(x.coverage_rate) ?? 0), 0) / b.length : null,
      categories: new Set(b.map((x) => x.category_code)).size,
    };
  });

  // Comparativo por SKU
  const byProduct = new Map<string, SkuComparisonRow>();
  for (const c of compNow) {
    byProduct.set(c.product_id, {
      productId: c.product_id,
      name: c.shopping_products?.normalized_name ?? c.product_id.slice(0, 8),
      category: c.shopping_products?.category_code ?? "—",
      cells: {},
      bestStandardProgram: c.best_standard_program,
      bestStandardVpm: num(c.best_standard_vpm),
      status: c.comparison_status,
      quality: c.quality_status,
    });
  }
  for (const l of latest) {
    const row = byProduct.get(l.product_id);
    if (!row) continue;
    row.cells[l.program_code] = {
      vpmStandard: num(l.vpm_standard), vpmElite: num(l.vpm_elite), price: num(l.reference_price),
      availability: l.availability, reason: l.comparison_reason,
    };
  }
  const skuRows = Array.from(byProduct.values()).sort((a, b) => (b.bestStandardVpm ?? 0) - (a.bestStandardVpm ?? 0));

  // Catálogo
  const srcByProduct = new Map<string, SourceRow[]>();
  for (const s of sources) {
    const arr = srcByProduct.get(s.product_id) ?? [];
    arr.push(s);
    srcByProduct.set(s.product_id, arr);
  }
  const catalog: CatalogRow[] = products.map((p) => {
    const ss = srcByProduct.get(p.id) ?? [];
    return {
      id: p.id, name: p.normalized_name, category: p.category_code, status: p.status, matchConfidence: p.match_confidence,
      sources: ss.length, productUrls: ss.filter((s) => s.source_url_type === "product").length,
      programs: Array.from(new Set(ss.map((s) => s.program_code))),
    };
  });

  // Lacunas
  const gaps: Gap[] = [];
  const latestByPP = new Map<string, SkuLatest>();
  for (const l of latest) latestByPP.set(`${l.product_id}:${l.program_code}`, l);
  for (const p of products) {
    const ss = srcByProduct.get(p.id) ?? [];
    if (!ss.length) { gaps.push({ name: p.normalized_name, program: "—", issue: "sem fonte cadastrada" }); continue; }
    for (const prog of PROGRAMS) {
      const s = ss.find((x) => x.program_code === prog);
      if (!s) { gaps.push({ name: p.normalized_name, program: PROGRAM_LABEL[prog], issue: "programa ausente" }); continue; }
      if (s.source_url_type === "category") { gaps.push({ name: p.normalized_name, program: PROGRAM_LABEL[prog], issue: "só URL de categoria (não valida SKU)" }); continue; }
      const l = latestByPP.get(`${p.id}:${prog}`);
      if (!l) { gaps.push({ name: p.normalized_name, program: PROGRAM_LABEL[prog], issue: "sem observação" }); continue; }
      if (l.reference_price == null) gaps.push({ name: p.normalized_name, program: PROGRAM_LABEL[prog], issue: "preço ausente" });
      else if (l.standard_points == null) gaps.push({ name: p.normalized_name, program: PROGRAM_LABEL[prog], issue: "pontos ausentes" });
    }
  }

  return {
    refDate, programs, skuRows, categories: benchNow, catalog, gaps, runs,
    counts: {
      products: products.length, sources: sources.length,
      observations: latest.length, comparable: latest.filter((x) => x.is_comparable).length,
    },
  };
}
