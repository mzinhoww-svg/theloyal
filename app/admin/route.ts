import { buildForecast, type Forecast } from "@/lib/predictions";

export const dynamic = "force-dynamic";

import { checkBasicAuth, deny, sbSelect as sb, supabaseWritable } from "@/lib/admin";

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
const CONF: Record<string, string> = { alta: "#00A878", media: "#315CFF", baixa: "#8A8578", "em-formacao": "#8A8578" };

function pill(t: unknown, bg: string): string {
  const fg = bg === "#F2C94C" ? "#111" : "#FAF7F0";
  return `<span style="display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${bg};color:${fg}">${esc(t)}</span>`;
}

function forecastPrediction(f: Forecast): string {
  if (!f.windowStart || !f.windowEnd) return "histórico insuficiente";
  return `próxima janela ~ ${f.windowStart} a ${f.windowEnd}`;
}

function calendarRows(campaigns: any[], month: string): { label: string; s: number; e: number; md: number }[] {
  const parts = month.split("-");
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const md = new Date(y, mo, 0).getDate();
  const inMonth = (d: any) => !!d && String(d).slice(0, 7) === month;
  return campaigns
    .filter((r) => inMonth(r.vigencia_inicio) || inMonth(r.vigencia_fim))
    .map((r) => {
      const s = r.vigencia_inicio && String(r.vigencia_inicio).slice(0, 7) === month ? Number(String(r.vigencia_inicio).slice(8, 10)) : 1;
      const e = r.vigencia_fim && String(r.vigencia_fim).slice(0, 7) === month ? Number(String(r.vigencia_fim).slice(8, 10)) : md;
      return { label: `${r.origem}→${r.destino}${r.percentual ? " " + r.percentual + "%" : ""}`, s, e: Math.max(e, s), md };
    })
    .sort((a, b) => a.s - b.s);
}

export async function GET(req: Request): Promise<Response> {
  if (!checkBasicAuth(req)) return deny();

  const month = new Date().toISOString().slice(0, 7);
  const [campaigns, editions, valuations, runs, retail, skuObs, skuCatalog] = await Promise.all([
    sb("campaigns?select=*&order=observed_at.desc&limit=400"),
    sb("editions?select=*&order=date.desc"),
    sb("valuations?select=*&is_current=eq.true&order=piso.desc"),
    sb("runs?select=*&order=started_at.desc&limit=10"),
    sb("retail_valuations?select=*&is_current=eq.true&order=player.asc"),
    sb("sku_observations?select=*&order=captured_at.desc&limit=120"),
    sb("sku_catalog?select=*&order=created_at.desc&limit=200"),
  ]);

  const active = campaigns.filter((c) => ["vence-hoje", "vence-72h", "continua", "nova"].includes(c.status));
  const venceHoje = campaigns.filter((c) => c.status === "vence-hoje");
  const last: any = runs[0];
  const avgQ = editions.length
    ? Math.round(editions.reduce((a: number, e: any) => a + (e.quality_score || 0), 0) / editions.length)
    : 0;
  const forecast = buildForecast(campaigns, { now: new Date().toISOString().slice(0, 10) });
  const cal = calendarRows(campaigns, month);

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

  const fRow = (f: Forecast) =>
    `<tr><td>${esc(f.route)}${f.typicalPercent ? ` <span class="m" style="color:#8A8578">${esc(f.typicalPercent)}%</span>` : ""}</td>` +
    `<td>${pill(f.confidence, CONF[f.confidence] || "#8A8578")}</td>` +
    `<td>${esc(forecastPrediction(f))}</td><td style="color:#555">${esc(f.basis)}</td></tr>`;
  const rowsFClusters = forecast.clusters.slice(0, 10).map(fRow).join("");
  const rowsFRoutes = forecast.routes.slice(0, 18).map(fRow).join("");

  const barsCal = cal.slice(0, 18).map((c) => {
    const left = ((c.s - 1) / c.md) * 100;
    const w = Math.max(3, ((c.e - c.s + 1) / c.md) * 100);
    return `<div class="bar-row"><div class="bar-label">${esc(c.label)}</div><div class="bar-track"><div class="bar-fill" style="left:${left}%;width:${w}%"></div></div></div>`;
  }).join("");

  // --- Radar de VPM não-aéreo (Shopping) ---
  const fmtVpm = (v: unknown): string =>
    v == null || v === "" ? "n/c" : "R$ " + Number(v).toFixed(2).replace(".", ",");
  const writable = supabaseWritable();
  const lastCollect: any = runs.find((r: any) => r.kind === "skus");

  const rowsRetail = retail.map((v: any) =>
    `<tr><td>${esc(v.player)}</td><td style="color:#555">${esc(v.category)}</td>` +
    `<td class="m">${fmtVpm(v.piso)}</td><td class="m">${fmtVpm(v.mediana)}</td><td class="m">${fmtVpm(v.teto)}</td>` +
    `<td class="m">${esc(v.sample_n ?? "—")}</td><td>${pill(v.confidence, CONF[v.confidence] || "#8A8578")}</td></tr>`
  ).join("");

  const skuActions = (id: string): string =>
    !writable ? '<span class="note">read-only</span>' :
    `<form method="post" action="/admin/sku" style="display:inline-flex;gap:6px;margin:0">` +
    `<input type="hidden" name="id" value="${esc(id)}">` +
    `<button class="btn ok" name="action" value="approve">aprovar</button>` +
    `<button class="btn no" name="action" value="reject">rejeitar</button></form>`;

  const rowsSku = skuCatalog.map((s: any) =>
    `<tr><td>${esc(s.canonical_name)}</td><td style="color:#555">${esc(s.category)}</td><td class="m">${esc(s.gtin ?? "—")}</td>` +
    `<td>${pill(s.status, s.status === "approved" ? "#00A878" : s.status === "rejected" ? "#D64545" : "#8A8578")}</td>` +
    `<td>${skuActions(s.id)}</td></tr>`
  ).join("");

  const rowsObs = skuObs.slice(0, 40).map((o: any) =>
    `<tr><td style="color:#555">${esc(o.player)}</td><td>${esc(o.raw?.canonical ?? o.raw?.name ?? "—")}</td>` +
    `<td class="m">${esc(o.points ?? "—")}</td><td class="m">${o.cash_brl != null ? "R$ " + esc(o.cash_brl) : "—"}</td>` +
    `<td class="m">${fmtVpm(o.vpm)}</td><td>${o.is_promo ? pill("promo", "#8A5A1F") : pill("base", "#00A878")}</td>` +
    `<td class="m">${esc(String(o.captured_at ?? "").slice(0, 10))}</td></tr>`
  ).join("");

  const msg = new URL(req.url).searchParams.get("msg");
  const banner = msg
    ? `<div class="banner">${esc(msg)}</div>`
    : "";
  const collectForm = writable
    ? `<form method="post" action="/admin/collect" style="display:flex;gap:10px;align-items:center;margin-bottom:10px">` +
      `<button class="btn ok">disparar rodada do coletor</button>` +
      `<label class="note"><input type="checkbox" name="mock" value="true"> mock (não chama API)</label></form>`
    : `<div class="note" style="margin-bottom:10px">Escrita desabilitada: defina SUPABASE_SERVICE_KEY para gerir e disparar rodadas.</div>`;

  const catField = (name: string, ph: string, req = false) =>
    `<input name="${name}" placeholder="${ph}"${req ? " required" : ""} class="in">`;
  const addSkuForm = writable
    ? `<form method="post" action="/admin/sku" class="skuform">
        <input type="hidden" name="action" value="create">
        ${catField("canonical_name", "Nome canônico (ex: Samsung Galaxy S24 128GB)", true)}
        ${catField("brand", "Marca")}${catField("model", "Modelo")}
        <select name="category" class="in">${["smartphone", "tv", "notebook", "audio", "eletroportatil", "outros"].map((c) => `<option value="${c}">${c}</option>`).join("")}</select>
        ${catField("gtin", "GTIN/EAN")}
        ${catField("url_azul", "URL Azul")}${catField("url_smiles", "URL Smiles")}${catField("url_latam", "URL LATAM Pass")}
        <button class="btn ok">adicionar SKU</button>
      </form>`
    : "";

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>The Loyal · Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--ink:#111;--paper:#FAF7F0;--surface:#fff;--muted:#555;--border:#E5E0D5;--primary:#00A878;--insight:#315CFF}
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
.bar-row{display:flex;align-items:center;gap:10px;margin:4px 0;font-size:12px}
.bar-label{width:200px;flex:none}
.bar-track{flex:1;height:16px;background:#f0ece3;border-radius:4px;position:relative}
.bar-fill{position:absolute;height:16px;background:var(--insight);border-radius:4px}
.note{font-size:12px;color:var(--muted)}
.btn{font:inherit;font-size:12px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--ink);cursor:pointer}
.btn.ok{background:var(--primary);color:var(--paper);border-color:var(--primary)}
.btn.no{color:#B53A3A}
.banner{background:#D9F4E9;border:1px solid var(--primary);color:#007A57;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px}
.skuform{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;align-items:center}
.in{font:inherit;font-size:13px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);min-width:150px}
</style></head><body><div class="wrap">
<div class="top"><div class="badge">TL</div><div><h1 style="font-size:24px"><span style="font-weight:600">The</span> Loyal · Admin</h1>
<div class="note">Observabilidade do motor editorial · dados ao vivo do Supabase</div></div></div>
${banner}
<div class="cards">
<div class="card"><div class="k">Última rodada</div><div class="v">${last ? esc(last.status === "ok" ? "OK" : last.status) : "—"}</div><div class="s">${last ? esc(new Date(last.started_at).toLocaleString("pt-BR")) : "sem rodadas"}</div></div>
<div class="card"><div class="k">Campanhas no ledger</div><div class="v m">${campaigns.length}</div><div class="s">${active.length} ativas · ${venceHoje.length} vencem hoje</div></div>
<div class="card"><div class="k">Gates da última</div><div class="v">${last ? `${last.gate_validate ? "✓" : "✗"} ${last.gate_audit ? "✓" : "✗"}` : "—"}</div><div class="s">${last ? esc((last.searches_count ?? 0) + " buscas") : ""}</div></div>
<div class="card"><div class="k">Qualidade média</div><div class="v m">${avgQ}</div><div class="s">${editions.length} edições</div></div>
</div>
<div class="sec"><h2>Edições</h2><table><thead><tr><th>Produto</th><th>Título</th><th>Data</th><th>Gates</th><th>Qual.</th><th>Beehiiv</th></tr></thead><tbody>${rowsE || '<tr><td class="note" colspan="6">sem edições</td></tr>'}</tbody></table></div>
<div class="sec"><h2>Calendário de promoções · ${month}</h2><div class="note" style="margin-bottom:8px">Cada barra é uma campanha ao longo do mês.</div>${barsCal || '<div class="note">sem campanhas no mês</div>'}</div>
<div class="sec"><h2>Previsão de janelas</h2><div class="note" style="margin-bottom:8px">Projeção estatística por recorrência do ledger (transferências) — não é veredito nem garantia. ${forecast.withPrediction} de ${forecast.routesTracked + forecast.clustersTracked} séries com base suficiente · ondas simultâneas colapsadas · janela rolada para o futuro.</div>
<div class="note" style="text-transform:uppercase;letter-spacing:.06em;margin:6px 0 4px">Por programa (destino)</div><table><thead><tr><th>Programa</th><th>Confiança</th><th>Previsão</th><th>Base</th></tr></thead><tbody>${rowsFClusters || '<tr><td class="note" colspan="4">histórico insuficiente</td></tr>'}</tbody></table>
<div class="note" style="text-transform:uppercase;letter-spacing:.06em;margin:16px 0 4px">Por rota (origem → destino)</div><table><thead><tr><th>Rota</th><th>Confiança</th><th>Previsão</th><th>Base</th></tr></thead><tbody>${rowsFRoutes || '<tr><td class="note" colspan="4">histórico insuficiente</td></tr>'}</tbody></table></div>
<div class="sec"><h2>Ledger de campanhas</h2><table><thead><tr><th>Rota</th><th>Tipo</th><th>%</th><th>Milheiro</th><th>TL</th><th>Veredito</th><th>Status</th><th>Vence</th></tr></thead><tbody>${rowsC || '<tr><td class="note" colspan="8">sem campanhas</td></tr>'}</tbody></table></div>
<div class="sec"><h2>Valuations</h2><table><thead><tr><th>Programa</th><th>Piso</th><th>Teto</th><th>Confiança</th></tr></thead><tbody>${rowsV || '<tr><td class="note" colspan="4">sem valuations</td></tr>'}</tbody></table></div>

<div class="sec"><h2>Shopping · VPM observado por player</h2>
<div class="note" style="margin-bottom:8px">Custo de fabricação de resgate não-aéreo derivado de preço público de catálogo (R$/milheiro). Mediana com outliers descartados (MAD) e promo fora da banda. ${lastCollect ? "Última rodada: " + esc(new Date(lastCollect.started_at).toLocaleString("pt-BR")) + " · " + esc((lastCollect.skus_observed ?? 0) + " SKUs") : "sem rodada de coleta ainda"}.</div>
${collectForm}
<table><thead><tr><th>Player</th><th>Categoria</th><th>Piso</th><th>Mediana</th><th>Teto</th><th>Amostra</th><th>Confiança</th></tr></thead><tbody>${rowsRetail || '<tr><td class="note" colspan="7">sem banda observada</td></tr>'}</tbody></table></div>

<div class="sec"><h2>Catálogo de SKUs</h2><div class="note" style="margin-bottom:8px">Curadoria do que entra na banda. Adicione um SKU e mapeie a URL pública de cada player; aprovar/rejeitar controla o que a coleta considera.</div>
${addSkuForm}
<table><thead><tr><th>Produto</th><th>Categoria</th><th>GTIN</th><th>Status</th><th>Ação</th></tr></thead><tbody>${rowsSku || '<tr><td class="note" colspan="5">sem SKUs no catálogo</td></tr>'}</tbody></table></div>

<div class="sec"><h2>Observações recentes</h2><table><thead><tr><th>Player</th><th>Produto</th><th>Pontos</th><th>Preço</th><th>VPM</th><th>Tipo</th><th>Data</th></tr></thead><tbody>${rowsObs || '<tr><td class="note" colspan="7">sem observações</td></tr>'}</tbody></table></div>

<div class="sec note">The Loyal · admin · guardrail factual ativo · sem dado interno/CMI · conferência humana no Beehiiv.</div>
</div></body></html>`;

  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
