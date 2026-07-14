// Cliente Tavily — descoberta de URLs públicas de listagem por player.
// Só recebe termos públicos (nome/modelo de produto). Sem chave → modo mock
// (devolve vazio; o coletor cai nas URLs do basket).

const ENDPOINT = "https://api.tavily.com/search";

export function tavilyEnabled() {
  return Boolean(process.env.TAVILY_API_KEY?.trim());
}

export async function tavilySearch(query, { maxResults = 5, includeDomains = [] } = {}) {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return { mock: true, results: [] };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: maxResults,
        include_domains: includeDomains,
        search_depth: "basic",
      }),
    });
    if (!res.ok) return { error: res.status, results: [] };
    const data = await res.json();
    return { results: (data.results ?? []).map((r) => ({ url: r.url, title: r.title })) };
  } catch (err) {
    return { error: String(err?.message || err), results: [] };
  }
}
