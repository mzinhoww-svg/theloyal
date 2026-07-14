// Dispara a rodada do coletor (workflow_dispatch de collect.yml). O trabalho
// pesado fica no GitHub Actions — evita timeout de serverless. Basic-Auth + token
// server-only. O workflow_dispatch só funciona quando collect.yml já está na
// branch padrão (requisito do GitHub).
import { checkBasicAuth, deny } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(msg: string): Response {
  return new Response(null, { status: 303, headers: { location: `/admin?msg=${encodeURIComponent(msg)}` } });
}

export async function POST(req: Request): Promise<Response> {
  if (!checkBasicAuth(req)) return deny();

  const token = process.env.GH_DISPATCH_TOKEN?.trim();
  const repo = process.env.GH_REPO?.trim() || "mzinhoww-svg/theloyal";
  const workflow = process.env.GH_COLLECT_WORKFLOW?.trim() || "collect.yml";
  const ref = process.env.GH_COLLECT_REF?.trim() || "main";

  const form = await req.formData();
  const mock = form.get("mock") === "true";

  if (!token) return back("GH_DISPATCH_TOKEN ausente: configure para disparar a rodada.");

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "content-type": "application/json",
          "user-agent": "the-loyal-admin",
          "x-github-api-version": "2022-11-28",
        },
        body: JSON.stringify({ ref, inputs: { mock: String(mock) } }),
      },
    );
    if (res.status === 204) return back(`Rodada do coletor disparada (${mock ? "mock" : "live"}).`);
    const detail = await res.text().catch(() => "");
    console.error("[admin/collect] dispatch falhou", res.status, detail.slice(0, 300));
    return back(`Falha ao disparar (HTTP ${res.status}).`);
  } catch (err) {
    console.error("[admin/collect] erro de rede", err);
    return back("Falha de rede ao disparar a rodada.");
  }
}
