// Escrita do catálogo de SKUs (aprovar/rejeitar). Basic-Auth (mesmo realm do
// /admin) + SERVICE key server-only. Recebe form-urlencoded do painel e redireciona
// de volta com uma mensagem.
import { checkBasicAuth, deny, sbPatch, supabaseWritable } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(msg: string): Response {
  return new Response(null, { status: 303, headers: { location: `/admin?msg=${encodeURIComponent(msg)}` } });
}

export async function POST(req: Request): Promise<Response> {
  if (!checkBasicAuth(req)) return deny();
  if (!supabaseWritable()) return back("Escrita desabilitada: defina SUPABASE_SERVICE_KEY.");

  const form = await req.formData();
  const id = String(form.get("id") ?? "").trim();
  const action = String(form.get("action") ?? "").trim();
  if (!id || !["approve", "reject"].includes(action)) return back("Ação inválida.");

  const status = action === "approve" ? "approved" : "rejected";
  const r = await sbPatch("sku_catalog", `id=eq.${encodeURIComponent(id)}`, { status });
  return back(r.ok ? `SKU ${status}.` : `Falha ao atualizar o SKU (HTTP ${r.status}).`);
}
