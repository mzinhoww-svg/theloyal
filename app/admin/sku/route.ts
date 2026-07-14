// Escrita do catálogo de SKUs (aprovar/rejeitar). Basic-Auth (mesmo realm do
// /admin) + SERVICE key server-only. Recebe form-urlencoded do painel e redireciona
// de volta com uma mensagem.
import { checkBasicAuth, deny, sbPatch, sbInsert, sbInsertReturning, supabaseWritable } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAYERS = ["azul", "smiles", "latam", "livelo", "esfera"];
const CATEGORIES = ["smartphone", "tv", "notebook", "audio", "eletroportatil", "outros"];

function back(msg: string): Response {
  return new Response(null, { status: 303, headers: { location: `/admin?msg=${encodeURIComponent(msg)}` } });
}

export async function POST(req: Request): Promise<Response> {
  if (!checkBasicAuth(req)) return deny();
  if (!supabaseWritable()) return back("Escrita desabilitada: defina SUPABASE_SERVICE_KEY.");

  const form = await req.formData();
  const action = String(form.get("action") ?? "").trim();

  // Criar SKU novo (+ mapear URLs de player). É o "semear catálogo" em produção.
  if (action === "create") {
    const canonical_name = String(form.get("canonical_name") ?? "").trim();
    const category = String(form.get("category") ?? "outros").trim();
    if (!canonical_name) return back("Nome do produto é obrigatório.");
    if (!CATEGORIES.includes(category)) return back("Categoria inválida.");
    const row = {
      canonical_name,
      brand: String(form.get("brand") ?? "").trim() || null,
      model: String(form.get("model") ?? "").trim() || null,
      category,
      gtin: String(form.get("gtin") ?? "").trim() || null,
      status: "approved",
    };
    const ins = await sbInsertReturning("sku_catalog", [row]);
    if (!ins.ok || !ins.data[0]?.id) return back(`Falha ao criar o SKU (HTTP ${ins.status}).`);
    const skuId = ins.data[0].id;

    const sources = PLAYERS
      .map((p) => ({ player: p, url: String(form.get(`url_${p}`) ?? "").trim() }))
      .filter((s) => /^https?:\/\//.test(s.url))
      .map((s) => ({ sku_id: skuId, player: s.player, channel: "Shopping", url: s.url, active: true }));
    if (sources.length) await sbInsert("sku_sources", sources);
    return back(`SKU "${canonical_name}" criado com ${sources.length} fonte(s).`);
  }

  const id = String(form.get("id") ?? "").trim();
  if (!id || !["approve", "reject"].includes(action)) return back("Ação inválida.");
  const status = action === "approve" ? "approved" : "rejected";
  const r = await sbPatch("sku_catalog", `id=eq.${encodeURIComponent(id)}`, { status });
  return back(r.ok ? `SKU ${status}.` : `Falha ao atualizar o SKU (HTTP ${r.status}).`);
}
