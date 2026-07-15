// Consolidação Weekly ← Daily (Fase 2.1 / backlog P2.14). PURO e determinístico.
// Dado o período do weekly (dateStart..dateEnd) e as edições do Daily, agrega os
// deals num conjunto de itens RASTREÁVEIS: cada item referencia as edições de
// origem (sourceEditions) e herda a disposição MAIS RESTRITIVA da régua entre as
// ocorrências. Regra dura: a Weekly NUNCA sobe a régua — um item rebaixado no
// Daily (monitoramento/nao-confirmado) não vira verdicto de ação na Weekly.
import { computeDisposition } from "./disposition.mjs";

const FAIXA_RANK = { A: 0, B: 1, C: 2, D: 3, E: 4 };
const DAY_MS = 86400000;
const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function inPeriod(editions, start, end) {
  const s = Date.parse(start);
  const e = Date.parse(end);
  return (Array.isArray(editions) ? editions : [])
    .filter((ed) => {
      const d = Date.parse(ed?.date);
      if (Number.isNaN(d)) return false;
      if (!Number.isNaN(s) && d < s) return false;
      if (!Number.isNaN(e) && d > e + DAY_MS - 1) return false; // fim do dia inclusive
      return true;
    })
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}

export function consolidateWeekly(weekly = {}, editions = [], opts = {}) {
  const eds = inPeriod(editions, weekly.dateStart, weekly.dateEnd);
  const byTitle = new Map();

  for (const ed of eds) {
    for (const deal of Array.isArray(ed.deals) ? ed.deals : []) {
      const disp = computeDisposition(deal, { now: ed.date, entities: opts.entities });
      const key = norm(deal.title);
      const item = byTitle.get(key) ?? {
        title: deal.title ?? null,
        verdict: deal.verdict ?? null,
        tlScore: typeof deal.tlScore === "number" ? deal.tlScore : null,
        faixa: disp.faixa,
        downgradeTo: disp.downgradeTo,
        sourceEditions: [],
      };
      // herda a disposição mais restritiva entre as ocorrências
      if (FAIXA_RANK[disp.faixa] >= FAIXA_RANK[item.faixa]) {
        item.faixa = disp.faixa;
        item.downgradeTo = disp.downgradeTo;
      }
      if (!item.sourceEditions.includes(ed.number)) item.sourceEditions.push(ed.number);
      byTitle.set(key, item);
    }
  }

  const items = [...byTitle.values()].map((it) => ({
    title: it.title,
    // Weekly não sobe a régua: item rebaixado/bloqueado no Daily vira nao-confirmado.
    verdict: it.downgradeTo || it.faixa === "E" ? "nao-confirmado" : it.verdict,
    tlScore: it.tlScore,
    faixa: it.faixa,
    sourceEditions: it.sourceEditions,
  }));

  return { sourceEditions: eds.map((e) => e.number), items };
}

// Deriva highlights do weekly (formato do schema) a partir da consolidação.
export function consolidatedHighlights(weekly, editions, opts = {}) {
  const { items } = consolidateWeekly(weekly, editions, opts);
  return items.map((it) => ({
    title: it.title ?? "Sem título",
    note: `Consolidado do Daily (edições ${it.sourceEditions.join(", ")}).`,
    ...(it.verdict ? { verdict: it.verdict } : {}),
    ...(typeof it.tlScore === "number" ? { score: it.tlScore } : {}),
    sourceEditions: it.sourceEditions,
  }));
}
