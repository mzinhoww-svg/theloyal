// Adapters de extração do Radar de VPM. Recebem uma página Playwright já
// renderizada e devolvem o contrato comum. Ponto de partida honesto: JSON-LD
// para preço + heurística de texto para pontos. PRECISA de afinação contra a
// página ao vivo de cada programa (SPA/login) — daí source_status/validation.
// Enquanto não confirmado, retorna nulls (o backend trata como lacuna).

function parseNum(s) {
  if (s == null) return null;
  const t = String(s).replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function priceFromJsonLd(page) {
  const blocks = await page
    .$$eval('script[type="application/ld+json"]', (els) => els.map((e) => e.textContent || ""))
    .catch(() => []);
  for (const b of blocks) {
    try {
      const j = JSON.parse(b);
      const arr = Array.isArray(j) ? j : [j];
      for (const node of arr) {
        const offers = node.offers ? (Array.isArray(node.offers) ? node.offers : [node.offers]) : [];
        for (const o of offers) if (o && o.price) return Number(o.price);
        if (node["@type"] === "Product" && node.price) return Number(node.price);
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

// Metatags de preço comuns em e-commerce (OpenGraph/Schema.org microdata).
async function priceFromMeta(page) {
  const raw = await page
    .evaluate(() => {
      const pick = (sel, attr) => {
        const el = document.querySelector(sel);
        return el ? el.getAttribute(attr) || el.textContent : null;
      };
      return (
        pick('meta[property="product:price:amount"]', "content") ||
        pick('meta[itemprop="price"]', "content") ||
        pick('[itemprop="price"]', "content") ||
        pick('[itemprop="price"]', "data-price") ||
        pick("[data-price]", "data-price") ||
        null
      );
    })
    .catch(() => null);
  return parseNum(raw);
}

// SPAs de resgate normalmente embutem o estado (Next/Nuxt/Apollo) num <script>.
// Varre esses blobs por chaves de preço numéricas plausíveis.
async function priceFromState(page) {
  const blobs = await page
    .$$eval(
      'script#__NEXT_DATA__, script[type="application/json"], script:not([src])',
      (els) => els.map((e) => e.textContent || "").filter((t) => t.length > 40 && t.length < 500000),
    )
    .catch(() => []);
  const re = /"(?:price|preco|valor|amount|cashPrice|price_brl|referencePrice)"\s*:\s*"?(\d{1,7}(?:[.,]\d{2})?)"?/gi;
  for (const b of blobs) {
    if (!/price|preco|valor|amount/i.test(b)) continue;
    let m;
    while ((m = re.exec(b))) {
      const n = parseNum(m[1]);
      if (n && n >= 1 && n < 1000000) return n;
    }
  }
  return null;
}

// Fallback de texto: primeiro "R$ X" próximo de contexto de preço no corpo.
function priceFromText(body) {
  const m = body.match(/R\$\s*([\d.]{1,3}(?:[.,]\d{2,3})*)/);
  return m ? parseNum(m[1]) : null;
}

// Cascata de estratégias — para na primeira que resolver. JSON-LD é o mais
// confiável; texto é o último recurso.
async function priceFromPage(page, body) {
  return (
    (await priceFromJsonLd(page)) ??
    (await priceFromMeta(page)) ??
    (await priceFromState(page)) ??
    priceFromText(body)
  );
}

// Extração genérica (mesma base para os 3 programas; difere só por afinação).
async function extractGeneric(page, program) {
  const title = await page.title().catch(() => null);
  const body = await page.evaluate(() => document.body.innerText).catch(() => "");
  const rawPrice = await priceFromPage(page, body);

  // Pontos padrão: primeiro número grande junto de "pontos"/"milhas".
  const std = matchPoints(body, /([\d.]{4,})\s*(?:pontos|milhas)/i);

  // Sanidade: preço minúsculo (< R$10) num produto resgatável por pontos (≥ 1k)
  // é quase certo um falso positivo — rating (ex.: 4.17), parcela ou centavos
  // capturados pelo fallback. Nenhum item real de resgate custa < R$10. Melhor
  // lacuna que número errado (regra "nunca chutar").
  const price = rawPrice != null && rawPrice < 10 && (std ?? 0) >= 1000 ? null : rawPrice;
  // Pontos elite/clube: contexto "clube", "elite", "a partir de".
  const elite = matchPoints(body, /(?:clube|elite|a partir de)[^\d]{0,20}([\d.]{4,})\s*(?:pontos|milhas)/i);
  // Híbrido: "N pontos + R$ X".
  const hyMatch = body.match(/([\d.]{4,})\s*(?:pontos|milhas)\s*\+\s*R\$\s*([\d.,]+)/i);

  const availability = /indispon[ií]vel|esgotad|fora de estoque|sem estoque/i.test(body)
    ? "out_of_stock"
    : price || std
      ? "in_stock"
      : "unknown";

  return {
    program,
    observed_title: title,
    reference_price: price,
    standard_points: std,
    elite_points: elite && elite !== std ? elite : null,
    hybrid_points: hyMatch ? parseNum(hyMatch[1]) : null,
    hybrid_cash: hyMatch ? parseNum(hyMatch[2]) : null,
    availability,
    extraction_confidence: price && std ? "medium" : "low",
  };
}

function matchPoints(text, re) {
  const m = text.match(re);
  return m ? parseNum(m[1]) : null;
}

export const ADAPTERS = {
  latam_pass: (page) => extractGeneric(page, "latam_pass"),
  azul_fidelidade: (page) => extractGeneric(page, "azul_fidelidade"),
  smiles: (page) => extractGeneric(page, "smiles"),
};

export const ADAPTER_VERSION = "headless_v4";

// Coleta de diagnóstico: além do resultado do adapter, devolve os "candidatos"
// que a página renderizada expõe, para afinar os seletores por portal. Não
// escreve nada — só evidência (o coletor salva HTML + screenshot ao lado).
export async function diagnose(page, program) {
  const extraction = await extractGeneric(page, program).catch((e) => ({
    error: e instanceof Error ? e.message : String(e),
  }));

  const jsonLd = await page
    .$$eval('script[type="application/ld+json"]', (els) =>
      els.map((e) => (e.textContent || "").slice(0, 2000)),
    )
    .catch(() => []);

  const meta = await page
    .evaluate(() => {
      const pick = (sel, attr) => {
        const el = document.querySelector(sel);
        return el ? el.getAttribute(attr) || el.textContent : null;
      };
      return {
        ogPriceAmount: pick('meta[property="product:price:amount"]', "content"),
        itempropPriceMeta: pick('meta[itemprop="price"]', "content"),
        itempropPriceEl: pick('[itemprop="price"]', "content"),
        dataPrice: pick("[data-price]", "data-price"),
      };
    })
    .catch(() => ({}));

  const body = await page.evaluate(() => document.body.innerText).catch(() => "");
  const uniq = (arr, n) => [...new Set(arr)].slice(0, n);
  const priceCandidates = uniq(
    (body.match(/R\$\s*[\d.]{1,3}(?:[.,]\d{2,3})*/g) || []).map((s) => s.trim()),
    20,
  );
  const pointsCandidates = uniq(
    (body.match(/[\d.]{3,}\s*(?:pontos|milhas)/gi) || []).map((s) => s.trim()),
    20,
  );

  return {
    extraction,
    debug: {
      jsonLdCount: jsonLd.length,
      jsonLd,
      meta,
      priceCandidates,
      pointsCandidates,
      bodyChars: body.length,
    },
  };
}
