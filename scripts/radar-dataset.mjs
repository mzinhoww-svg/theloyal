// Fase C0 — carregamento COMPLETO do dataset de campanhas, sem limite silencioso
// de 2.000. Paginação PostgREST + ordenação determinística + detecção de página
// incompleta. `fetchPage` é injetável (testável sem Supabase).
//
// Uso: loadCampaignsPaged({ fetchPage }) onde
//   fetchPage(offset, limit) => Promise<row[]>
// Ordenação determinística deve ser aplicada por quem monta a query (ex.:
// order=id.asc), para paginação estável.

export const DEFAULT_PAGE_SIZE = 1000;
export const DEFAULT_MAX_PAGES = 200; // teto de segurança (200k linhas)

export async function loadCampaignsPaged({ fetchPage, pageSize = DEFAULT_PAGE_SIZE, maxPages = DEFAULT_MAX_PAGES } = {}) {
  if (typeof fetchPage !== "function") throw new Error("loadCampaignsPaged requer fetchPage(offset, limit)");
  const rows = [];
  let pagesRead = 0;
  let datasetComplete = false;
  for (let page = 0; page < maxPages; page++) {
    const offset = page * pageSize;
    const batch = await fetchPage(offset, pageSize);
    pagesRead++;
    if (!Array.isArray(batch)) throw new Error("fetchPage deve retornar um array");
    rows.push(...batch);
    if (batch.length < pageSize) {
      datasetComplete = true; // página curta = fim do dataset
      break;
    }
  }
  // Se saiu do laço por bater maxPages sem página curta, o dataset está incompleto.
  return { rows, totalRows: rows.length, datasetComplete, pagesRead };
}

// Fetcher PostgREST para o CLI (forecast.mjs). Ordenação determinística por id.
export function makeSupabasePageFetcher({ baseUrl, apikey, select = "*" }) {
  const root = String(baseUrl).replace(/\/+$/, "");
  return async (offset, limit) => {
    const url = `${root}/rest/v1/campaigns?select=${select}&order=id.asc&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, { headers: { apikey, authorization: `Bearer ${apikey}` } });
    if (!res.ok) throw new Error(`Supabase ${res.status} ${res.statusText}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error("Resposta inesperada do Supabase");
    return json;
  };
}
