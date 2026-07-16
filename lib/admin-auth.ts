// Sessão do admin: cookie httpOnly com o hash SHA-256 do ADMIN_TOKEN.
// Web Crypto funciona tanto no Edge (middleware) quanto no Node (Server Actions),
// então este módulo é compartilhado pelos dois. O token cru nunca vai pro cookie.

export const ADMIN_COOKIE = "tl_admin";

export async function tokenHash(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Comparação de tempo ~constante para não vazar o hash por timing.
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---- Sessão assinada com expiração (BKL-08) ----
// Antes o cookie era o SHA-256 estático do token: sem expiração própria e sem
// rotação — vazou uma vez, valia até o token mudar. Agora o valor é
// `${exp}.${hmac(token, "tl_admin:"+exp)}`: expira sozinho, cada login emite
// um valor novo, e trocar ADMIN_TOKEN revoga todas as sessões de uma vez.

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias, renovado a cada login

async function hmacHex(token: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function issueSession(
  token: string,
  ttlSeconds = SESSION_TTL_SECONDS,
): Promise<{ value: string; maxAge: number }> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = await hmacHex(token, `${ADMIN_COOKIE}:${exp}`);
  return { value: `${exp}.${sig}`, maxAge: ttlSeconds };
}

export async function verifySession(token: string, cookieValue: string): Promise<boolean> {
  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return false;
  const expStr = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = await hmacHex(token, `${ADMIN_COOKIE}:${expStr}`);
  return safeEqual(sig, expected);
}
