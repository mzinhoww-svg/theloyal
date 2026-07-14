// Fábrica de adapters de player. Cada player difere só no domínio público e nos
// padrões de texto onde aparecem os pontos de resgate. A leitura de dinheiro sai
// do JSON-LD (schema.org/Product), que é consistente entre catálogos.
//
// IMPORTANTE: os seletores/padrões abaixo são um ponto de partida honesto — a
// marcação real de cada portal muda com o tempo e precisa ser afinada contra a
// página ao vivo. Enquanto isso, o modo mock (basket) exercita toda a matemática.
import { fetchHtml, extractJsonLd, cashFromJsonLd, pointsFromText } from "../http.mjs";
import { tavilySearch } from "../tavily.mjs";
import { extractListing } from "../llm.mjs";

export function makeAdapter({ player, domains, pointsPatterns, channel }) {
  return {
    player,
    channel,

    // Descobre URLs públicas de listagem. Usa a URL do basket como âncora e o
    // Tavily (quando habilitado) para achar a página do mesmo produto no player.
    async discover(entry) {
      const mapped = entry.sources?.[player]?.url;
      if (mapped) return [{ url: mapped, external_id: entry.sources[player].externalId ?? null }];
      const q = `${entry.canonicalName} resgate pontos site oficial ${player}`;
      const { results } = await tavilySearch(q, { includeDomains: domains, maxResults: 3 });
      return results.map((r) => ({ url: r.url, external_id: null }));
    },

    // Extrai {points, cash, name, gtin} de uma página. JSON-LD para dinheiro/nome/
    // gtin; regex para pontos; LLM só se faltar dado estruturado.
    async parse(html, url) {
      const products = extractJsonLd(html);
      const { cash, name, gtin } = cashFromJsonLd(products);
      let points = pointsFromText(html, pointsPatterns);
      let outName = name;
      let outCash = cash;
      if ((!points || !outCash) ) {
        const llm = await extractListing(html.replace(/<[^>]+>/g, " ").slice(0, 4000));
        if (llm) {
          points = points ?? llm.points;
          outCash = outCash ?? llm.cash_brl;
          outName = outName ?? llm.name;
        }
      }
      return { points: points ?? null, cash: outCash ?? null, name: outName ?? null, gtin: gtin ?? null, url };
    },

    // Busca + parse de uma entrada do basket. Best-effort; devolve observações
    // parciais (marcadas) quando a página não entrega os dois números.
    async collect(entry) {
      const targets = await this.discover(entry);
      const observations = [];
      for (const t of targets) {
        const { ok, html, status, error } = await fetchHtml(t.url);
        if (!ok) {
          observations.push({ player, sku: entry, url: t.url, points: null, cash: null, error: error ?? `http ${status}` });
          continue;
        }
        const parsed = await this.parse(html, t.url);
        observations.push({ player, sku: entry, ...parsed });
      }
      return observations;
    },
  };
}
