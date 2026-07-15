// Motor de disposição da régua de publicação (REGUA-PUBLICACAO-DIGESTS.md).
// Coração da política: dada uma unidade editorial (deal), decide em que FAIXA ela
// entra — A auto · B revisão leve · C assinatura de score · D rebaixa/monitora ·
// E bloqueia — a partir de INTENSIDADE DE AÇÃO × TIER DE FONTE × integridade.
//
// PURO e determinístico: sem I/O, mesma entrada → mesma saída. Condição para ser
// testável e para o motor de acurácia (Fase 3) reproduzir a decisão. Importa só
// de lib.mjs; nunca de validate.mjs (evita ciclo — validate é quem chama este).
import { VERDICTS, TL_WEIGHTS, verdictForScore, assertEditorialRules, isExpired } from "../lib.mjs";

// Verdicto → intensidade de ação. Quanto mais o item PEDE ação ao leitor, maior
// o risco — e mais para cima na régua de escrutínio (assimetria da política §2.2).
const INTENSITY = {
  "vale-agir": "acao-alta",
  "vale-olhar": "acao-media",
  "casos-especificos": "acao-baixa",
  "esperaria": "nao-acao",
  "evitaria": "nao-acao",
  "nao-confirmado": "nao-acao",
};

const ACTION_INTENSITIES = new Set(["acao-baixa", "acao-media", "acao-alta"]);
const FAIXA_ACTION = { A: "auto", B: "review-light", C: "review-sign", D: "downgrade", E: "block" };

export function intensityForVerdict(verdict) {
  return INTENSITY[verdict] ?? null;
}

// Marcadores textuais de força da fonte. O marcador FRACO vence (segurança da
// política §3.6: conteúdo forte de fonte fraca é rebaixado, não promovido — uma
// URL de home oficial não legitima um "post social" citado no corpo da fonte).
const WEAK_SOURCE = /\b(post social|rede social|f[óo]rum|grupo de whats|telegram|rumor|boato|n[íi]vel 4|sem p[áa]gina oficial|sem regulamento|n[ãa]o oficial)\b/iu;
const STRONG_SOURCE = /\b(regulamento oficial|comunicado oficial|site oficial|p[áa]gina oficial|termos e condi[çc][õo]es|regulamento|t&c)\b/iu;

// Resolve o tier de uma fonte contra o registro canônico de entidades
// (content/entities, RFC-001) estendido com sourceTier/domains (Fase 1.2).
//   entities: array de { aliases?, sourceTier?, domains?, name } | undefined
// Ordem: marcador fraco → registro (domínio, depois menção) → marcador forte →
// URL de host desconhecido (só se há registro) → null (não classificável, sem
// teto — comportamento seguro da Fase 0).
export function resolveTier(source, sourceUrl, entities) {
  const hasRegistry = Array.isArray(entities) && entities.length > 0;
  const host = hostOf(sourceUrl);
  const label = String(source ?? "").toLowerCase();

  if (WEAK_SOURCE.test(label)) return "T3";

  if (hasRegistry) {
    for (const e of entities) {
      if (!e || !e.sourceTier) continue;
      const domains = Array.isArray(e.domains) ? e.domains : [];
      if (host && domains.some((d) => host === d.toLowerCase() || host.endsWith("." + d.toLowerCase()))) return e.sourceTier;
    }
    for (const e of entities) {
      if (!e || !e.sourceTier) continue;
      const names = [e.name, ...(Array.isArray(e.aliases) ? e.aliases : [])].filter(Boolean).map((s) => String(s).toLowerCase());
      if (names.some((n) => n && label.includes(n))) return e.sourceTier;
    }
  }

  if (STRONG_SOURCE.test(label)) return "T1";
  if (hasRegistry && host) return "T0";
  return null;
}

function hostOf(url) {
  if (typeof url !== "string") return null;
  const m = url.match(/^https?:\/\/([^/:?#]+)/i);
  return m ? m[1].toLowerCase().replace(/^www\./, "") : null;
}

function breakdownComplete(bd) {
  if (!bd || typeof bd !== "object") return false;
  return Object.keys(TL_WEIGHTS).every((k) => typeof bd[k] === "number");
}

function breakdownSum(bd) {
  return Object.entries(TL_WEIGHTS).reduce((acc, [k, w]) => acc + (Number(bd?.[k] ?? 0) / 100) * w, 0);
}

// Célula base da matriz §9/§10: (intensidade × tier) → faixa. tier null ⇒ sem
// teto de fonte (Fase 0), tratado como T1/T2.
function baseCell(intensidade, tier) {
  const t = tier ?? "T2";
  if (t === "T0") return { faixa: "D", downgradeTo: "nao-confirmado", reason: "fonte não classificada (T0) — teto Não confirmado" };
  if (t === "T3") {
    if (intensidade === "nao-acao") return { faixa: "A", downgradeTo: "monitoramento", reason: "fonte fraca (T3) sem pedido de ação" };
    return { faixa: "D", downgradeTo: "monitoramento", reason: "fonte fraca (T3) com pedido de ação — teto monitoramento" };
  }
  // T1 / T2
  if (intensidade === "nao-acao") return { faixa: "A", downgradeTo: null, reason: "não-ação de fonte confiável" };
  if (intensidade === "acao-baixa") return { faixa: "B", downgradeTo: null, reason: "ação baixa — revisão leve" };
  return { faixa: "C", downgradeTo: null, reason: "ação média/alta — exige assinatura de score" };
}

// computeDisposition(item, ctx) -> Disposition
//   item: deal { verdict, tlScore, scoreBreakdown, vigencia, source, sourceUrl }
//   ctx:  { now?, entities?, tier?, integrity?: string[] }
export function computeDisposition(item = {}, ctx = {}) {
  const reasons = [];
  const integrity = Array.isArray(ctx.integrity) ? [...ctx.integrity] : [];
  const ruleHits = assertEditorialRules(item).map((v) => v.rule);

  const verdict = item.verdict;
  const intensidade = INTENSITY[verdict] ?? null;
  const tier = ctx.tier ?? resolveTier(item.source, item.sourceUrl, ctx.entities);

  // --- Integridade determinística (bloqueia — faixa E) ---
  if (!verdict || !(verdict in VERDICTS)) integrity.push(`veredito "${verdict}" fora do vocabulário oficial`);

  const hasVigencia = Boolean(item.vigencia);
  if (!hasVigencia && verdict && verdict !== "nao-confirmado") {
    integrity.push("sem vigência confirmada — veredito deveria ser nao-confirmado (overrule 5.4)");
  }
  if (hasVigencia && ctx.now && isExpired(item.vigencia, toIso(ctx.now))) {
    integrity.push(`vigência (${item.vigencia}) já vencida na data de referência`);
  }

  const scored = verdict && verdict !== "nao-confirmado";
  if (scored) {
    if (typeof item.tlScore !== "number" || item.tlScore < 0 || item.tlScore > 100) {
      integrity.push("TL Score ausente ou fora de 0–100");
    } else {
      const expected = verdictForScore(item.tlScore);
      if (expected !== verdict) integrity.push(`TL Score ${item.tlScore} mapeia para "${expected}", mas o veredito é "${verdict}"`);
    }
    if (item.scoreBreakdown && breakdownComplete(item.scoreBreakdown)) {
      const sum = Math.round(breakdownSum(item.scoreBreakdown));
      if (sum !== item.tlScore) integrity.push(`soma ponderada do breakdown (${sum}) ≠ TL Score declarado (${item.tlScore})`);
    }
  }

  // --- Faixa E: regra inviolável ou integridade ---
  if (ruleHits.length || integrity.length) {
    return finalize({ faixa: "E", tier, intensidade, downgradeTo: null, ruleHits, integrity, reasons: reasons.concat(integrity, ruleHits.map((r) => `regra inviolável: ${r}`)) });
  }

  // --- Célula base da matriz ---
  const cell = baseCell(intensidade, tier);
  let faixa = cell.faixa;
  let downgradeTo = cell.downgradeTo;
  reasons.push(cell.reason);

  // --- scoreBreakdown obrigatório para verdicto de ação (Fase 1.1) ---
  if (ACTION_INTENSITIES.has(intensidade) && !breakdownComplete(item.scoreBreakdown)) {
    faixa = "D";
    downgradeTo = "monitoramento";
    reasons.push("verdicto de ação sem scoreBreakdown completo — rebaixado para monitoramento");
  }

  // --- Sinal de sub-critério: conteúdo forte, fonte fraca (§3.6) ---
  if (breakdownComplete(item.scoreBreakdown) && Number(item.scoreBreakdown.fontes) < 50 && Number(item.tlScore) >= 70) {
    reasons.push("sinal: conteúdo forte com sub-critério de fontes baixo (conteúdo forte, fonte fraca)");
  }

  return finalize({ faixa, tier, intensidade, downgradeTo, ruleHits, integrity, reasons });
}

function finalize(d) {
  return {
    faixa: d.faixa,
    action: FAIXA_ACTION[d.faixa],
    tier: d.tier ?? null,
    intensidade: d.intensidade ?? null,
    downgradeTo: d.downgradeTo ?? null,
    ruleHits: d.ruleHits ?? [],
    integrity: d.integrity ?? [],
    reasons: d.reasons ?? [],
  };
}

function toIso(now) {
  if (now instanceof Date) return now.toISOString();
  return String(now);
}

// gateEdition(edition, ctx) -> { release, itemDispositions[], blocks[] }
// Percorre os deals e devolve a disposição de cada um. release = nenhum item em
// faixa E. Não faz I/O nem valida estrutura de edição (isso é do validate.mjs);
// combina-se com os checks estruturais do chamador.
export function gateEdition(edition = {}, ctx = {}) {
  const deals = Array.isArray(edition.deals) ? edition.deals : [];
  const itemDispositions = deals.map((d, i) => ({
    index: i,
    title: d.title ?? null,
    disposition: computeDisposition(d, { ...ctx, now: ctx.now ?? edition.date }),
  }));
  const blocks = itemDispositions.filter((x) => x.disposition.faixa === "E");
  return { release: blocks.length === 0, itemDispositions, blocks };
}
