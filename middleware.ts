import { NextResponse, type NextRequest } from "next/server";

// Protege toda a Central de Controle (/admin/*) com Basic Auth, reaproveitando
// ADMIN_USER/ADMIN_PASSWORD ja usados no admin anterior. Roda no Edge, entao
// usa atob (Buffer nao existe aqui). As RPCs com SERVICE_ROLE_KEY continuam
// so no servidor (Server Components/Actions), nunca no browser.

function unauthorized(): NextResponse {
  return new NextResponse("Autenticacao necessaria.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="The Loyal Admin", charset="UTF-8"',
    },
  });
}

export function middleware(req: NextRequest): NextResponse {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  // Sem credenciais configuradas: nega tudo (nao expor o painel por engano).
  if (!user || !pass) return unauthorized();

  const auth = req.headers.get("authorization") || "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    try {
      const decoded = atob(encoded);
      const i = decoded.indexOf(":");
      const u = decoded.slice(0, i);
      const p = decoded.slice(i + 1);
      if (u === user && p === pass) return NextResponse.next();
    } catch {
      // cai no unauthorized
    }
  }
  return unauthorized();
}

export const config = {
  matcher: ["/admin/:path*"],
};
