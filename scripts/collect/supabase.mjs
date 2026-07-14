// Cliente Supabase REST mínimo (zero dependência). Usa a SERVICE key (server-only)
// para escrever observações/valuations e registrar a rodada. Sem SUPABASE_URL/
// SUPABASE_SERVICE_KEY → modo mock (não chama API; o coletor grava em out/collect/).

export function supabaseEnabled() {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_KEY?.trim());
}

function headers() {
  const key = process.env.SUPABASE_SERVICE_KEY.trim();
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    prefer: "return=representation",
  };
}

function base() {
  return process.env.SUPABASE_URL.trim().replace(/\/$/, "") + "/rest/v1";
}

export async function insert(table, rows) {
  if (!supabaseEnabled()) return { mock: true, rows };
  const res = await fetch(`${base()}/${table}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`supabase insert ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { rows: await res.json() };
}

export async function patch(table, filter, patchBody) {
  if (!supabaseEnabled()) return { mock: true };
  const res = await fetch(`${base()}/${table}?${filter}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(patchBody),
  });
  if (!res.ok) throw new Error(`supabase patch ${table} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { rows: await res.json() };
}
