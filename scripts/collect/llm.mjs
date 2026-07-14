// Cliente LLM com backend trocável: OpenRouter em produção (decisão do usuário),
// Ollama local opcional em dev (mesma interface). Sem chave → modo mock (heurística
// determinística, sem chamar API).
//
// O LLM SÓ toca dado público (nome de produto, texto de página, preço). Ele faz
// três coisas — matching de SKU, promo vs base e extração estruturada — e NUNCA
// faz a conta do VPM (isso é `stats.mjs`). Cifra interna/CMI jamais é enviada.

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export function llmBackend() {
  if (process.env.OPENROUTER_API_KEY?.trim()) return "openrouter";
  if (process.env.OLLAMA_BASE_URL?.trim()) return "ollama";
  return "mock";
}

async function chatJson(system, user) {
  const backend = llmBackend();
  if (backend === "openrouter") {
    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY.trim()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`openrouter ${res.status}`);
    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  }
  if (backend === "ollama") {
    const base = process.env.OLLAMA_BASE_URL.trim().replace(/\/$/, "");
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL?.trim() || "llama3.1",
        format: "json",
        stream: false,
        options: { temperature: 0 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}`);
    const data = await res.json();
    return JSON.parse(data.message?.content ?? "{}");
  }
  return null; // mock
}

// (a) MATCH canônico: dois títulos são o mesmo produto físico?
export async function sameProduct(titleA, titleB) {
  const backend = llmBackend();
  if (backend === "mock") return { same: heuristicSame(titleA, titleB), reason: "heurística (mock)" };
  try {
    const r = await chatJson(
      "Você compara títulos de produtos de e-commerce. Responda JSON {\"same\":bool,\"reason\":string}. 'same' é true só se forem o MESMO modelo físico (mesma marca, modelo, capacidade/tamanho). Cor pode variar.",
      `A: ${titleA}\nB: ${titleB}`,
    );
    return { same: Boolean(r.same), reason: String(r.reason ?? "") };
  } catch {
    return { same: heuristicSame(titleA, titleB), reason: "heurística (fallback)" };
  }
}

// (b) PROMO vs base: o preço é promocional (não representa o patamar normal)?
export async function classifyPromo(title, priceText, pageSnippet = "") {
  const backend = llmBackend();
  if (backend === "mock") {
    const isPromo = /oferta|promo|desconto|black|off\b|relâmpago|liquida/i.test(`${priceText} ${pageSnippet}`);
    return { is_promo: isPromo, reason: isPromo ? "termo promocional no texto" : "sem sinal de promoção" };
  }
  try {
    const r = await chatJson(
      "Você classifica se um preço de e-commerce é PROMOCIONAL (temporário, não representa o patamar normal). Responda JSON {\"is_promo\":bool,\"reason\":string}.",
      `Produto: ${title}\nPreço: ${priceText}\nTrecho da página: ${pageSnippet.slice(0, 500)}`,
    );
    return { is_promo: Boolean(r.is_promo), reason: String(r.reason ?? "") };
  } catch {
    const isPromo = /oferta|promo|desconto|black|off\b/i.test(`${priceText} ${pageSnippet}`);
    return { is_promo: isPromo, reason: "heurística (fallback)" };
  }
}

// (c) EXTRAÇÃO estruturada quando não há JSON-LD utilizável.
export async function extractListing(textSnippet) {
  const backend = llmBackend();
  if (backend === "mock") return null; // sem LLM não inventa número
  try {
    const r = await chatJson(
      "Extraia de uma página de resgate: nome do produto, preço em dinheiro (R$) e quantidade de pontos/milhas. Responda JSON {\"name\":string|null,\"cash_brl\":number|null,\"points\":number|null}. Não invente: use null se não estiver explícito.",
      textSnippet.slice(0, 2000),
    );
    return {
      name: r.name ?? null,
      cash_brl: Number.isFinite(r.cash_brl) ? r.cash_brl : null,
      points: Number.isFinite(r.points) ? r.points : null,
    };
  } catch {
    return null;
  }
}

// Heurística de match sem LLM: normaliza e compara tokens fortes (marca+modelo+nº).
function heuristicSame(a, b) {
  const norm = (s) =>
    String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !["de", "com", "sem", "para", "gb", "polegadas"].includes(w));
  const ta = new Set(norm(a));
  const tb = new Set(norm(b));
  if (!ta.size || !tb.size) return false;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const jaccard = inter / (ta.size + tb.size - inter);
  return jaccard >= 0.6;
}
