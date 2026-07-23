import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

// Rota de REVISÃO (modo C): serve os bytes EXATOS do render diário que o runner
// persistiu em content/renders/NNNN.html — o mesmo e-mail (schema v4 inteiro), não
// um re-render. O operador VÊ a edição do dia sem rodar nada.
//
// NÃO é superfície pública: retorna 404 em produção (só existe em preview/dev) e
// vai com X-Robots-Tag: noindex. Pré-renderizada no build (force-static) a partir
// dos arquivos versionados — nada de leitura de disco em runtime.

const DIR = path.join(process.cwd(), "content", "renders");
const IS_PROD = process.env.VERCEL_ENV === "production";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { numero: string }[] {
  if (IS_PROD || !existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => /^\d+\.html$/.test(f))
    .map((f) => ({ numero: String(Number(f.replace(/\.html$/, ""))) }));
}

export function GET(
  _req: Request,
  { params }: { params: { numero: string } },
): Response {
  if (IS_PROD) return new Response("Not found", { status: 404 });
  const n = String(Number(params.numero)).padStart(4, "0");
  const arquivo = path.join(DIR, `${n}.html`);
  if (!/^\d+$/.test(String(Number(params.numero))) || !existsSync(arquivo)) {
    return new Response("Not found", { status: 404 });
  }
  const html = readFileSync(arquivo, "utf8");
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "no-store",
    },
  });
}
