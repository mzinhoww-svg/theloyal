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
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "TheLoyalty-Pauta/1.0" } });
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

function buildMarkdown(date, grouped, meta) {
  const L = [];
  L.push(`# Pauta — ${date}`, "");
  L.push("> Referencia interna de curadoria. NAO publicar verbatim: cada item vira texto proprio (regra de marca 2).");
  L.push("> Marque `[x]` o que entra, confirme a Secao e preencha a Fonte apurada (URL oficial + vigencia) antes de virar edicao.", "");
  for (const key of Object.keys(SECTION_LABELS)) {
    const items = grouped[key];
    if (!items || !items.length) continue;
    L.push(`## ${SECTION_LABELS[key]}`, "");
    for (const it of items) {
      L.push(`- [ ] **${mdEscape(it.title) || "(sem titulo)"}**  _(manchete da fonte, nao copiar)_`);
      if (it.link) L.push(`      - Link: ${it.link}`);
      L.push(`      - Fonte: ${mdEscape(it.source)}${it.date ? ` · ${mdEscape(it.date)}` : ""}`);
      L.push(`      - Secao: ${key}`);
      L.push(`      - Fonte apurada: ______  (regulamento/pagina oficial + vigencia confirmada)`);
      L.push(`      - Nota propria: ______`);
      L.push("");
    }
  }
  L.push("---", "");
  L.push(`Fontes lidas: ${meta.read} · com itens: ${meta.withItems} · com erro: ${meta.errors.length} · itens: ${meta.total} (novos: ${meta.fresh})`);
  if (meta.errors.length) {
    L.push("", "Fontes com erro (verificar URL/feed em content/sources.json):");
    for (const e of meta.errors) L.push(`- ${e.name}: ${e.error}`);
  }
  if (!meta.total) {
    L.push("", "Nenhum item coletado. Habilite fontes reais em content/sources.json (enabled: true, url do feed RSS).");
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

  const feeds = (cfg.feeds || []).filter((f) => f.enabled && f.url);
  const meta = { read: feeds.length, withItems: 0, errors: [], total: 0, fresh: 0 };
  const grouped = {};
  const flat = [];
  const dedupRun = new Set();

  for (const f of feeds) {
    const r = await fetchFeed(f.url);
    if (!r.ok) { meta.errors.push({ name: f.name, error: r.error }); continue; }
    const items = parseFeed(r.xml);
    if (items.length) meta.withItems++;
    for (const it of items) {
      const key = it.link || it.title;
      if (dedupRun.has(key)) continue;
      dedupRun.add(key);
      if (it.date) { const ts = Date.parse(it.date); if (!Number.isNaN(ts) && ts < cutoff) continue; }
      const fresh = !(it.link && seen.has(it.link));
      const rec = { section: f.section || "a-classificar", source: f.name, title: it.title, link: it.link, date: it.date, fresh };
      meta.total++; if (fresh) meta.fresh++;
      (grouped[rec.section] ??= []).push(rec);
      flat.push(rec);
    }
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${date}.json`, JSON.stringify({ date, generatedAt: new Date().toISOString(), meta: { ...meta }, items: flat }, null, 2) + "\n");
  writeFileSync(`${dir}/${date}.md`, buildMarkdown(date, grouped, meta));
  console.log(`[pauta] ${date}: ${meta.total} item(ns) de ${meta.withItems}/${meta.read} fonte(s) → content/pauta/${date}.md`);
  if (meta.errors.length) meta.errors.forEach((e) => console.log(`  ! ${e.name}: ${e.error}`));
  if (!feeds.length) console.log("  ! nenhuma fonte habilitada — edite content/sources.json (enabled:true + url real).");
}

main();
