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
