import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySession } from "@/lib/admin-auth";

// Protege /admin/* por cookie de sessão (hash do ADMIN_TOKEN). A página de
// login é pública; sem token válido, tudo redireciona pra ela. Roda no Edge.

const LOGIN = "/admin/login";
// Endpoints do Radar têm Basic Auth própria (lib/admin.ts); não passam pelo
// gate de cookie do painel.
const SELF_AUTH = ["/admin/sku", "/admin/collect"];

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl;

  // Login (e sua Server Action, que faz POST na mesma rota) é sempre liberado.
  if (pathname === LOGIN) return NextResponse.next();
  if (SELF_AUTH.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = process.env.ADMIN_TOKEN;
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;

  if (token && cookie) {
    // Sessão assinada com expiração (BKL-08) — o hash estático legado deixa
    // de valer; sessões antigas exigem novo login uma única vez.
    if (await verifySession(token, cookie)) return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = LOGIN;
  // Guarda o destino pra voltar depois do login (só caminhos internos).
  const dest = pathname + search;
  url.search = dest.startsWith("/admin") ? `?next=${encodeURIComponent(dest)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
