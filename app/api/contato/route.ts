import { NextResponse, type NextRequest } from "next/server";

// Contato B2B (pagina /anuncie). Valida, aplica honeypot e rate-limit basico e
// registra o lead nos Vercel Logs. Sem provedor de e-mail plugado, opera em modo
// log (a mensagem fica visivel em Logs para triagem manual). Trocar por envio
// real (Resend/SMTP) quando houver credencial, sem mudar o front.
export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
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

  let body: {
    nome?: string;
    email?: string;
    empresa_nome?: string;
    mensagem?: string;
    empresa?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Honeypot silencioso.
  if (body.empresa) return NextResponse.json({ ok: true });

  const email = (body.email ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  console.log(
    "[contato]",
    JSON.stringify({
      nome: (body.nome ?? "").slice(0, 120),
      email,
      empresa_nome: (body.empresa_nome ?? "").slice(0, 120),
      mensagem: (body.mensagem ?? "").slice(0, 1000),
      at: new Date().toISOString(),
    }),
  );

  return NextResponse.json({ ok: true });
}
