// Tracking de conversao dependency-free. Envia eventos via sendBeacon (ou fetch
// keepalive como fallback) para /api/track, que loga em JSON nos Vercel Logs.
// Zero dependencia, zero cookie de terceiro. Pode ser trocado depois por um
// provedor (Vercel Analytics / Plausible) sem mudar os call sites.

export type TrackEvent =
  | "subscribe_submit"
  | "subscribe_success"
  | "subscribe_error"
  | "waitlist_submit"
  | "waitlist_success"
  | "anuncie_submit"
  | "cta_click";

export function track(
  event: TrackEvent,
  data?: Record<string, string | undefined>,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({
      event,
      path: window.location.pathname,
      ...data,
    });
    const url = "/api/track";
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Telemetria nunca pode quebrar o fluxo do usuario.
  }
}
