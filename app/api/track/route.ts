import { NextResponse, type NextRequest } from "next/server";

// Endpoint de telemetria de conversao. Recebe eventos do client (lib/track.ts)
// e os registra em JSON estruturado nos Vercel Logs — sem dependencia externa,
// sem cookie. Para agregacao real, plugar um drain de logs ou um provedor
// depois; os call sites nao mudam.
export const runtime = "nodejs";

const ALLOWED = new Set([
  "subscribe_submit",
  "subscribe_success",
  "subscribe_error",
  "waitlist_submit",
  "waitlist_success",
  "anuncie_submit",
  "cta_click",
]);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const event = typeof body.event === "string" ? body.event : "";
  if (!ALLOWED.has(event)) {
    // Evento desconhecido: descarta em silencio, sem 4xx (telemetria best-effort).
    return new NextResponse(null, { status: 204 });
  }

  const ref = req.headers.get("referer") ?? "";
  console.log(
    "[track]",
    JSON.stringify({
      event,
      path: typeof body.path === "string" ? body.path : "",
      perfil: typeof body.perfil === "string" ? body.perfil : undefined,
      source: typeof body.source === "string" ? body.source : undefined,
      ref: ref.slice(0, 120),
      at: new Date().toISOString(),
    }),
  );

  return new NextResponse(null, { status: 204 });
}
