// Helpers server-only do painel admin. Só importados por route handlers
// (runtime nodejs), portanto nunca vão para o client.
//
// Leitura/escrita no Supabase: prefere a SERVICE key (server-only, ignora RLS)
// para o admin gerir tudo; cai na ANON key só para leitura pública. A URL/anon
// key ficam com fallback aos valores atuais para não quebrar o deploy vigente.

const FALLBACK_URL = "https://qjqnqcsdnpvvmyzkavoq.supabase.co";
const FALLBACK_ANON = "sb_publishable_P8p6JOjLfCVwr6QqgLxjqw_NbqMHKV-";

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || FALLBACK_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY?.trim() || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() || FALLBACK_ANON;
const READ_KEY = SERVICE_KEY || ANON_KEY;

export function supabaseWritable(): boolean {
  return Boolean(SERVICE_KEY);
}

// --- Basic Auth compartilhada por /admin (GET) e /admin/* (POST de escrita) ---

export function checkBasicAuth(req: Request): boolean {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) return false;
  const auth = req.headers.get("authorization") || "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const i = decoded.indexOf(":");
    return decoded.slice(0, i) === user && decoded.slice(i + 1) === pass;
  } catch {
    return false;
  }
}

export function deny(): Response {
  return new Response("Autenticacao necessaria.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="The Loyal Admin", charset="UTF-8"' },
  });
}

// --- Supabase REST ---

export async function sbSelect(path: string): Promise<any[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: READ_KEY, authorization: `Bearer ${READ_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as any[];
  } catch {
    return [];
  }
}

export async function sbInsert(table: string, rows: unknown): Promise<{ ok: boolean; status: number }> {
  if (!SERVICE_KEY) return { ok: false, status: 0 };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  return { ok: res.ok, status: res.status };
}

// Insert que retorna as linhas criadas (para pegar o id gerado e encadear FKs).
export async function sbInsertReturning(table: string, rows: unknown): Promise<{ ok: boolean; status: number; data: any[] }> {
  if (!SERVICE_KEY) return { ok: false, status: 0, data: [] };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });
  const data = res.ok ? await res.json().catch(() => []) : [];
  return { ok: res.ok, status: res.status, data };
}

export async function sbPatch(table: string, filter: string, body: unknown): Promise<{ ok: boolean; status: number }> {
  if (!SERVICE_KEY) return { ok: false, status: 0 };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}
