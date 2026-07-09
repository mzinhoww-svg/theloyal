import { NextResponse, type NextRequest } from "next/server";

// Route handler da inscricao. A chave do Beehiiv fica so no servidor (process.env),
// nunca no client. Runtime Node para acesso a env e fetch de saida.
export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Rate limit simples por IP, em memoria. Best-effort: em serverless o estado nao
// e compartilhado entre instancias e zera no cold start. Freia abuso trivial;
// producao de verdade usaria um store externo (Vercel KV / Redis).
const WINDOW_MS = 60_000;
const MAX_HITS = 5;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_HITS;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { email?: string; empresa?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Honeypot server-side: bots preenchem "empresa". Descarta em silencio
  // simulando sucesso, sem tocar no provedor.
  if (body.empresa) {
    return NextResponse.json({ ok: true });
  }

  const email = (body.email ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // trim(): um \n ou espaco colado junto do valor da env var quebra o header
  // de auth e o path da publicacao. Causa comum de 401/404.
  const apiKey = process.env.BEEHIIV_API_KEY?.trim();
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID?.trim();

  // Sem credenciais (dev / preview): modo mock para a demo nao quebrar.
  // Com credenciais (producao): chamada real a API do Beehiiv.
  if (!apiKey || !publicationId) {
    console.warn(
      "[subscribe] BEEHIIV_API_KEY/BEEHIIV_PUBLICATION_ID ausentes: modo mock.",
    );
    return NextResponse.json({ ok: true, mock: true });
  }

  // O Beehiiv exige o ID no formato pub_<uuid>. Tolera o UUID cru adicionando
  // o prefixo se faltar.
  const pubId = publicationId.startsWith("pub_")
    ? publicationId
    : `pub_${publicationId}`;

  try {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          reactivate_existing: false,
          send_welcome_email: true,
          utm_source: "landing",
        }),
      },
    );
    if (!res.ok) {
      // Loga o motivo do provedor no server (visivel em Vercel Logs) sem
      // devolver detalhe ao client.
      const upstream = await res.text().catch(() => "");
      console.error("[subscribe] Beehiiv respondeu", res.status, upstream.slice(0, 500));
      return NextResponse.json({ error: "provider_error" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[subscribe] falha ao chamar Beehiiv", err);
    return NextResponse.json({ error: "provider_error" }, { status: 502 });
  }
}
