export const dynamic = "force-dynamic";

const SUPABASE_URL = "https://qjqnqcsdnpvvmyzkavoq.supabase.co";
const SUPABASE_ANON = "sb_publishable_P8p6JOjLfCVwr6QqgLxjqw_NbqMHKV-";

async function sb(path: string): Promise<any[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_ANON, authorization: `Bearer ${SUPABASE_ANON}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as any[];
  } catch {
    return [];
  }
}

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"]/g, (c) => {
    const m: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
    return m[c];
  });
}

const VERDICT: Record<string, string> = {
  "vale-agir": "#00A878", "vale-olhar": "#315CFF", "casos-especificos": "#8A8578",
  esperaria: "#F2C94C", evitaria: "#D64545", "nao-confirmado": "#8A8578",
};
const STATUS: Record<string, string> = {
  "vence-hoje": "#D64545", "vence-72h": "#8A5A1F", continua: "#00A878",
  vencida: "#8A8578", nova: "#315CFF", descartada: "#8A8578",
};

function pill(t: unknown, bg: string): string {
  const fg = bg === "#F2C94C" ? "#111" : "#FAF7F0";
  return `<span style="display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${bg};color:${fg}">${esc(t)}</span>`;
}

function deny(): Response {
  return new Response("Autenticacao necessaria.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="The Loyal Admin", charset="UTF-8"' },
  });
}

export async function GET(req: Request): Promise<Response> {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) return deny();

  const auth = req.headers.get("authorization") || "";
  const [scheme, encoded] = auth.split(" ");
  let ok = false;
  if (scheme === "Basic" && encoded) {
    try {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      const i = decoded.indexOf(":");
      ok = decoded.slice(0, i) === user && decoded.slice(i + 1) === pass;
    } catch {
      ok = false;
    }
  }
  if (!ok) return deny();

  const [campaigns, editions, valuations, runs] = await Promise.all([
    sb("campaigns?select=*&order=observed_at.desc&limit=400"),
    sb("editions?select=*&order=date.desc"),
    sb("valuations?select=*&is_current=eq.true&order=piso.desc"),
    sb("runs?select=*&order=started_at.desc&limit=10"),
  ]);

  const active = campaigns.filter((c) => ["vence-hoje", "vence-72h", "continua", "nova"].includes(c.status));
  const venceHoje = campaigns.filter((c) => c.status === "vence-hoje");
  const last: any = runs[0];
  const avgQ = editions.length
    ? Math.round(editions.reduce((a: number, e: any) => a + (e.quality_score || 0), 0) / editions.length)
    : 0;

  const rowsC = campaigns.slice(0, 60).map((c) =>
    `<tr><td>${esc(c.origem)}→${esc(c.destino)}</td><td style="color:#555">${esc(c.tipo)}</td>` +
    `<td class="m">${esc(c.percentual ?? "—")}</td><td class="m">${esc(c.cpm ?? "—")}</td>` +
    `<td class="m">${esc(c.tl_score ?? "—")}</td><td>${c.verdict ? pill(c.verdict, VERDICT[c.verdict] || "#8A8578") : "—"}</td>` +
    `<td>${pill(c.status, STATUS[c.status] || "#8A8578")}</td><td class="m">${esc(String(c.vigencia_fim ?? "—").slice(0, 10))}</td></tr>`
  ).join("");

  const rowsE = editions.map((e: any) =>
    `<tr><td>${pill(e.product, "#111")}</td><td>${esc(e.title)}</td><td class="m">${esc(e.date)}</td>` +
    `<td>${e.gate_validate ? "✓" : "✗"} ${e.gate_audit ? "✓" : "✗"}</td><td class="m">${esc(e.quality_score ?? "—")}</td>` +
    `<td>${e.beehiiv_url ? `<a href="${esc(e.beehiiv_url)}" target="_blank">abrir →</a>` : "—"}</td></tr>`
  ).join("");

  const rowsV = valuations.map((v: any) =>
    `<tr><td>${esc(v.program)}</td><td class="m">${esc(v.piso)}</td><td class="m">${esc(v.teto)}</td><td style="color:#555">${esc(v.confidence)}</td></tr>`
  ).join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>The Loyal · Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--ink:#111;--paper:#FAF7F0;--surface:#fff;--muted:#555;--border:#E5E0D5;--primary:#00A878}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:'Inter',system-ui,Arial,sans-serif;font-size:15px}
h1,h2{font-family:'Fraunces',Georgia,serif;margin:0}a{color:var(--primary);text-decoration:none}
.m{font-family:'JetBrains Mono',ui-monospace,Consolas,monospace}
.wrap{max-width:1160px;margin:0 auto;padding:24px 20px 64px}
.top{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);padding-bottom:14px;margin-bottom:20px}
.badge{width:34px;height:34px;background:var(--ink);color:var(--paper);border-radius:3px;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-weight:700}
.cards{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px}
.k{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}.v{font-size:26px;font-weight:700;margin-top:4px}.s{font-size:12px;color:var(--muted);margin-top:2px}
.sec{margin-top:30px}.sec h2{font-size:19px;margin-bottom:8px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;text-transform:uppercase;font-size:11px;letter-spacing:.06em;color:var(--muted);border-bottom:1px solid var(--border);padding:8px 10px 8px 0}
td{padding:8px 10px 8px 0;border-bottom:1px solid var(--border);vertical-align:top}
.note{font-size:12px;color:var(--muted)}
</style></head><body><div class="wrap">
<div class="top"><div class="badge">TL</div><div><h1 style="font-size:24px"><span style="font-weight:600">The</span> Loyal · Admin</h1>
<div class="note">Observabilidade do motor editorial · dados ao vivo do Supabase</div></div></div>
<div class="cards">
<div class="card"><div class="k">Última rodada</div><div class="v">${last ? esc(last.status === "ok" ? "OK" : last.status) : "—"}</div><div class="s">${last ? esc(new Date(last.started_at).toLocaleString("pt-BR")) : "sem rodadas"}</div></div>
<div class="card"><div class="k">Campanhas no ledger</div><div class="v m">${campaigns.length}</div><div class="s">${active.length} ativas · ${venceHoje.length} vencem hoje</div></div>
<div class="card"><div class="k">Gates da última</div><div class="v">${last ? `${last.gate_validate ? "✓" : "✗"} ${last.gate_audit ? "✓" : "✗"}` : "—"}</div><div class="s">${last ? esc((last.searches_count ?? 0) + " buscas") : ""}</div></div>
<div class="card"><div class="k">Qualidade média</div><div class="v m">${avgQ}</div><div class="s">${editions.length} edições</div></div>
</div>
<div class="sec"><h2>Edições</h2><table><thead><tr><th>Produto</th><th>Título</th><th>Data</th><th>Gates</th><th>Qual.</th><th>Beehiiv</th></tr></thead><tbody>${rowsE || '<tr><td class="note" colspan="6">sem edições</td></tr>'}</tbody></table></div>
<div class="sec"><h2>Ledger de campanhas</h2><table><thead><tr><th>Rota</th><th>Tipo</th><th>%</th><th>Milheiro</th><th>TL</th><th>Veredito</th><th>Status</th><th>Vence</th></tr></thead><tbody>${rowsC || '<tr><td class="note" colspan="8">sem campanhas</td></tr>'}</tbody></table></div>
<div class="sec"><h2>Valuations</h2><table><thead><tr><th>Programa</th><th>Piso</th><th>Teto</th><th>Confiança</th></tr></thead><tbody>${rowsV || '<tr><td class="note" colspan="4">sem valuations</td></tr>'}</tbody></table></div>
<div class="sec note">The Loyal · admin · guardrail factual ativo · conferência humana no Beehiiv.</div>
</div></body></html>`;

  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
