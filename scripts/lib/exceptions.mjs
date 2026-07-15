// Ledger de exceções (Fase 2.2 / backlog P2.9). Trilha append-only das decisões
// humanas que fogem do default da régua (aprovações, rebaixes manuais, exceções a
// regra NÃO-inviolável). Insumo do motor de acurácia (Fase 3.2): onde o humano
// discorda da régua é onde a régua aprende.
//
// Regra dura: uma regra INVIOLÁVEL nunca é registrável como exceção — ela bloqueia
// antes, não vira exceção documentada (espelha CLAUDE.md §5.4 da política).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const LEDGER = "content/exceptions-log.json";

// Regras invioláveis (não-registráveis). Cobre as chaves de assertEditorialRules
// e os nomes usados nas regras 1–10 do CLAUDE.md.
const INVIOLABLE = new Set([
  "emoji", "urgencia", "urgência", "interno", "dado-interno", "cmi",
  "disclaimer", "promessa-de-ganho", "copia-de-fonte", "vigencia-sem-confirmacao",
]);

export function isRegistrableException(rule) {
  return !INVIOLABLE.has(String(rule ?? "").trim().toLowerCase());
}

export function loadExceptions(path = LEDGER) {
  if (!existsSync(path)) return { schemaVersion: 1, entries: [] };
  try {
    const j = JSON.parse(readFileSync(path, "utf8"));
    return { schemaVersion: j.schemaVersion ?? 1, entries: Array.isArray(j.entries) ? j.entries : [] };
  } catch {
    return { schemaVersion: 1, entries: [] };
  }
}

const REQUIRED = ["edition", "item", "rule", "reviewer", "justification", "finalDisposition"];

// Registra uma exceção. Append-only (nunca sobrescreve entradas anteriores).
//   entry: { edition, item, rule, reviewer, justification, finalDisposition }
//   opts:  { path?, at?, dryRun? }  — 'at' explícito mantém a função determinística
//          em teste; ausente ⇒ timestamp atual.
export function recordException(entry, opts = {}) {
  const path = opts.path ?? LEDGER;
  const missing = REQUIRED.filter((k) => entry?.[k] == null || entry[k] === "");
  if (missing.length) throw new Error(`exceção incompleta: faltam ${missing.join(", ")}`);
  if (!isRegistrableException(entry.rule)) {
    throw new Error(`regra inviolável "${entry.rule}" não pode ser registrada como exceção — ela bloqueia, não se documenta`);
  }
  const ledger = loadExceptions(path);
  const record = {
    edition: entry.edition,
    item: entry.item,
    rule: entry.rule,
    reviewer: entry.reviewer,
    justification: entry.justification,
    finalDisposition: entry.finalDisposition,
    at: opts.at ?? new Date().toISOString(),
  };
  ledger.entries.push(record);
  if (!opts.dryRun) writeFileSync(path, JSON.stringify(ledger, null, 2) + "\n");
  return record;
}
