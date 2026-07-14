// Fetch + extração estruturada de listagens públicas. Zero dependência.
// Prefere JSON-LD embutido (application/ld+json → schema.org/Product), que dá
// nome, gtin e preço em dinheiro de forma confiável. Regex é o fallback para
// pontos (que raramente vêm em JSON-LD nos catálogos de resgate).

const UA =
  "Mozilla/5.0 (compatible; TheLoyalRadar/1.0; +https://theloyal)"; // identifica o bot

export async function fetchHtml(url, { timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, status: res.status, html: "" };
    return { ok: true, status: res.status, html: await res.text() };
  } catch (err) {
    return { ok: false, status: 0, html: "", error: String(err?.message || err) };
  } finally {
    clearTimeout(t);
  }
}

// Extrai todos os blocos application/ld+json e devolve os objetos Product.
export function extractJsonLd(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (node && (node["@type"] === "Product" || node["@type"] === "Offer")) out.push(node);
        // @graph
        if (node && Array.isArray(node["@graph"])) {
          for (const g of node["@graph"]) if (g && g["@type"] === "Product") out.push(g);
        }
      }
    } catch {
      /* bloco malformado — ignora */
    }
  }
  return out;
}

// pt-BR "R$ 1.399,00" / "45.000" → number
export function parseNumber(str) {
  if (str == null) return null;
  const m = String(str).replace(/[^\d.,]/g, "");
  if (!m) return null;
  const n = parseFloat(m.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Preço em dinheiro a partir do primeiro Product/Offer com offers.price.
export function cashFromJsonLd(products) {
  for (const p of products) {
    const offer = p.offers && (Array.isArray(p.offers) ? p.offers[0] : p.offers);
    const price = offer?.price ?? offer?.lowPrice ?? p.price;
    const cash = parseNumber(price);
    if (cash) return { cash, name: p.name ?? null, gtin: p.gtin13 ?? p.gtin ?? p.gtin14 ?? null };
  }
  return { cash: null, name: null, gtin: null };
}

// Pontos/milhas do resgate a partir de padrões de texto. Cada adapter passa os
// seus (a marcação varia por player). Ex.: "por 45.000 pontos", "45.000 milhas".
export function pointsFromText(html, patterns) {
  const text = html.replace(/<[^>]+>/g, " ");
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = parseNumber(m[1] ?? m[0]);
      if (n && n >= 100) return n; // pontos de resgate são milhares, não centavos
    }
  }
  return null;
}
