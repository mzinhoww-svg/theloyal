// Camada server-only da área /admin/digests: lê a tabela `editions` (o ledger
// das edições/digests já geradas pelo pipeline) via admin-db (SERVICE_ROLE_KEY).
// Nunca importado por um Client Component.

import { rest } from "./admin-db";
import type { Tone } from "@/components/admin/ui";

export type EditionRow = {
  id: string;
  product: string;
  number: number | null;
  date: string | null;
  title: string | null;
  status: string | null;
  gate_validate: boolean | null;
  gate_audit: boolean | null;
  quality_score: number | null;
  beehiiv_post_id: string | null;
  beehiiv_url: string | null;
  sources_count: number | null;
  deals_count: number | null;
  created_at: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  curated: boolean | null;
};

export type EditionFull = EditionRow & {
  json: Record<string, unknown> | null;
};

// Colunas leves para a lista (sem o `json`, que pode ser pesado).
const LIST_COLS =
  "id,product,number,date,title,status,gate_validate,gate_audit,quality_score,beehiiv_post_id,beehiiv_url,sources_count,deals_count,created_at,scheduled_at,published_at,approved_by,approved_at,curated";

export const getEditions = (limit = 200) =>
  rest<EditionRow>(
    `editions?select=${LIST_COLS}&order=created_at.desc.nullslast&limit=${limit}`,
  );

export async function getEdition(id: string): Promise<EditionFull | null> {
  const rows = await rest<EditionFull>(
    `editions?select=${LIST_COLS},json&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  return rows[0] ?? null;
}

// Um digest está "publicado no Beehiiv" quando tem post e URL — o `status` do
// ledger fica em draft mesmo assim (o rascunho vive no Beehiiv). Distinguimos os
// dois para o operador enxergar onde cada edição parou.
export function isPublished(e: EditionRow): boolean {
  return !!e.beehiiv_post_id;
}
export function gatesPass(e: EditionRow): boolean {
  return e.gate_validate === true && e.gate_audit === true;
}

// Tom por produto — dentro dos tokens da marca, um por família de digest.
const PRODUCT_TONE: Record<string, Tone> = {
  daily: "blue",
  weekly: "green",
  pro: "yellow",
  lab: "gray",
  special: "red",
};
export function toneForProduct(p: string | null | undefined): Tone {
  return (p && PRODUCT_TONE[p.toLowerCase()]) || "gray";
}

export type ProductSummary = {
  product: string;
  total: number;
  lastDate: string | null;
  avgQuality: number | null;
  gatesOk: number;
  published: number;
};

// Agrega por produto para a visão "cobertura" — determinístico, em JS puro.
export function summarizeByProduct(rows: EditionRow[]): ProductSummary[] {
  const groups: Record<string, EditionRow[]> = {};
  for (const r of rows) {
    const k = r.product || "—";
    (groups[k] ??= []).push(r);
  }
  return Object.entries(groups)
    .map(([product, list]): ProductSummary => {
      const q = list
        .map((e) => e.quality_score)
        .filter((n): n is number => n != null);
      const dates = list
        .map((e) => e.date)
        .filter((d): d is string => !!d)
        .sort();
      return {
        product,
        total: list.length,
        lastDate: dates.length ? dates[dates.length - 1] : null,
        avgQuality: q.length ? Math.round(q.reduce((a, b) => a + b, 0) / q.length) : null,
        gatesOk: list.filter(gatesPass).length,
        published: list.filter(isPublished).length,
      };
    })
    .sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""));
}
