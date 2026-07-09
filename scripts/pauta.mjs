// Rotina de pauta do The Loyalty.
// Le as fontes publicas (content/sources.json), coleta itens recentes e gera
// dois arquivos em content/pauta/AAAA-MM-DD.{md,json}:
//   - .md  checklist para uma pessoa SELECIONAR o que entra e APURAR a fonte de cada secao
//   - .json  espelho estruturado (registro / passo seguinte)
// Nao publica nada. Capta LINK + manchete da fonte apenas como referencia:
// a regra de marca exige texto proprio, entao a manchete vem marcada "nao copiar".
// Uso: node scripts/pauta.mjs [--date AAAA-MM-DD] [--days N]
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";

const SECTION_LABELS = {
  sinal: "Sinal do dia",
  "deal-desk": "Deal Desk",
  "program-watch": "Program Watch",
  "bank-cards": "Bank & Cards Watch",
  "retail-coalition": "Retail & Coalition",
  "loyalty-lab": "Loyalty Lab",
  "fecha-logo": "Fecha logo",
  "a-classificar": "A classificar",
};

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

function decode(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#3?9;|&apos;/g, "'")
    .replace(/\s+/g, " ").trim();
}
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

function parseFeed(xml) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  return blocks.map((b) => {
    let link = tag(b, "link");
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); if (m) link = m[1]; }
    return {
      title: tag(b, "title"),
      link,
      date: tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date"),
    };
  }).filter((it) => it.title || it.link);
}

async function fetchFeed(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, xml: await res.text() };
  } catch (e) {
    return { ok: false, error: e.name === "AbortError" ? "timeout" : e.message };
  } finally { clearTimeout(t); }
}

function previousLinks(dir) {
  // dedup contra a pauta mais recente ja gerada
  if (!existsSync(dir)) return new Set();
  const jsons = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  if (!jsons.length) return new Set();
  try {
    const prev = JSON.parse(readFileSync(`${dir}/${jsons[jsons.length - 1]}`, "utf8"));
    return new Set((prev.items || []).map((i) => i.link).filter(Boolean));
  } catch { return new Set(); }
}

function mdEscape(s) { return String(s).replace(/\|/g, "\\|"); }

function buildMarkdown(date, grouped, meta, cfg, generatedAt) {
  const L = [];
  L.push(`# Pauta — ${date}`, "");
  L.push("> Referencia interna de curadoria. NAO publicar verbatim: cada item vira texto proprio (regra de marca 2).");
  L.push("> Marque `[x]` o que entra, confirme a Secao e APURE a fonte oficial (P0) de cada item antes de virar edicao.");
  L.push(`> Consulta: ${generatedAt}. Regra 6: item P1/P2 nao gera \"Vale Agir\" sem confirmacao oficial P0.`, "");
  for (const key of Object.keys(SECTION_LABELS)) {
    const items = grouped[key];
    if (!items || !items.length) continue;
    L.push(`## ${SECTION_LABELS[key]}`, "");
    for (const it of items) {
      const tier = it.tier || "P?";
      L.push(`- [ ] **${mdEscape(it.title) || "(sem titulo)"}**  _(${tier} · manchete da fonte, nao copiar)_`);
      if (it.link) L.push(`      - Link: ${it.link}`);
      L.push(`      - Fonte: ${mdEscape(it.source)} (${tier}${it.category ? "/" + it.category : ""})${it.date ? ` · ${mdEscape(it.date)}` : ""}`);
      L.push(`      - Secao: ${key}`);
      L.push(`      - Vigencia: ______`);
      L.push(`      - Nivel de confianca: ______  (alto / medio / baixo)`);
      L.push(`      - Fonte apurada (P0 oficial): ______  (URL do regulamento/pagina + data/hora)`);
      L.push(`      - Nota propria: ______`);
      if (tier !== "P0") L.push(`      - > ${tier}: descoberta/rumor. Confirmar em fonte oficial P0 antes de recomendar (regra 6).`);
      L.push("");
    }
  }

  // Apendice: fontes oficiais (P0) para apuracao, por categoria.
  const p0 = (cfg.feeds || []).filter((f) => f.tier === "P0");
  if (p0.length) {
    L.push("---", "", "## Fontes oficiais (P0) para apuracao", "");
    const byCat = {};
    for (const f of p0) (byCat[f.category || "outros"] ??= []).push(f);
    for (const cat of Object.keys(byCat)) {
      L.push(`**${cat}**`);
      for (const f of byCat[cat]) {
        const urls = [f.url, ...(f.pages || [])].filter(Boolean).join(" · ");
        L.push(`- ${mdEscape(f.name)}: ${urls}`);
      }
      L.push("");
    }
  }

  L.push("---", "");
  L.push(`Fontes lidas: ${meta.read} · com itens: ${meta.withItems} · com erro: ${meta.errors.length} · itens: ${meta.total} (novos: ${meta.fresh})`);
  if (meta.errors.length) {
    L.push("", "Feeds com erro (ajustar 'feed' em content/sources.json):");
    for (const e of meta.errors) L.push(`- ${e.name} (${e.tier}): ${e.error}`);
  }
  if (!meta.total) {
    L.push("", "Nenhum item coletado dos feeds. Ajuste os 'feed' habilitados em content/sources.json.");
  }
  return L.join("\n") + "\n";
}

async function main() {
  const cfgPath = "content/sources.json";
  if (!existsSync(cfgPath)) { console.error("content/sources.json ausente."); process.exit(1); }
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  const days = Number(arg("--days", cfg.lookbackDays ?? 2));
  const date = arg("--date", new Date().toISOString().slice(0, 10));
  const cutoff = Date.now() - days * 864e5;
  const dir = "content/pauta";
  const seen = previousLinks(dir);

  const feeds = (cfg.feeds || []).filter((f) => f.enabled && f.feed);
  const generatedAt = new Date().toISOString();
  const meta = { read: feeds.length, withItems: 0, errors: [], total: 0, fresh: 0 };
  const grouped = {};
  const flat = [];
  const dedupRun = new Set();

  for (const f of feeds) {
    const r = await fetchFeed(f.feed);
    if (!r.ok) { meta.errors.push({ name: f.name, tier: f.tier, error: r.error }); continue; }
    const items = parseFeed(r.xml);
    if (items.length) meta.withItems++;
    for (const it of items) {
      const key = it.link || it.title;
      if (dedupRun.has(key)) continue;
      dedupRun.add(key);
      if (it.date) { const ts = Date.parse(it.date); if (!Number.isNaN(ts) && ts < cutoff) continue; }
      const fresh = !(it.link && seen.has(it.link));
      const rec = { section: f.section || "a-classificar", tier: f.tier, category: f.category, source: f.name, title: it.title, link: it.link, date: it.date, fresh, consultedAt: generatedAt };
      meta.total++; if (fresh) meta.fresh++;
      (grouped[rec.section] ??= []).push(rec);
      flat.push(rec);
    }
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${date}.json`, JSON.stringify({ date, generatedAt, meta: { ...meta }, items: flat }, null, 2) + "\n");
  writeFileSync(`${dir}/${date}.md`, buildMarkdown(date, grouped, meta, cfg, generatedAt));
  console.log(`[pauta] ${date}: ${meta.total} item(ns) de ${meta.withItems}/${meta.read} fonte(s) → content/pauta/${date}.md`);
  if (meta.errors.length) meta.errors.forEach((e) => console.log(`  ! ${e.name}: ${e.error}`));
  if (!feeds.length) console.log("  ! nenhuma fonte habilitada — edite content/sources.json (enabled:true + url real).");
}

main();
