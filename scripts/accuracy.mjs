#!/usr/bin/env node
// Motor de acurácia da régua (Fase 3.2 / backlog P1.6, P1.7). READ-ONLY e
// SEPARADO do publisher (premissa 4): cruza o log de publicação
// (content/beehiiv-status.json, com a Disposition por item gravada na Fase 2.3),
// o ledger de exceções (content/exceptions-log.json) e a vigência real das
// edições — e mede como a régua se comportou. NÃO publica nada, NÃO altera dados.
//
// Uso: node scripts/accuracy.mjs [--write]   (--write grava content/accuracy.json)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { listEditionFiles, loadEdition, isExpired } from "./lib.mjs";

const LEDGER_PATH = "content/beehiiv-status.json";
const EXCEPTIONS_PATH = "content/exceptions-log.json";
const OUT_PATH = "content/accuracy.json";

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}

// PURO: recebe os dados carregados e devolve as métricas. O 'now' entra explícito
// (determinismo em teste).
export function computeAccuracy({ ledger = {}, exceptions = {}, editions = [], now = null } = {}) {
  const posts = Object.values(ledger.posts ?? {});
  const dispatched = posts.filter((p) => p.status === "published" || p.status === "scheduled");

  const byFaixa = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let itemsWithDisposition = 0;
  for (const p of dispatched) {
    for (const d of Array.isArray(p.dispositions) ? p.dispositions : []) {
      if (d.faixa in byFaixa) byFaixa[d.faixa] += 1;
      itemsWithDisposition += 1;
    }
  }

  // Coerência da régua: nada em faixa E deveria ter sido despachado; ação (C) só
  // deveria sair com assinatura registrada (exceção/aprovação no ledger).
  const publishedBlocked = byFaixa.E; // > 0 é violação da régua
  const downgradeRate = itemsWithDisposition ? byFaixa.D / itemsWithDisposition : null;

  const entries = Array.isArray(exceptions.entries) ? exceptions.entries : [];
  const exceptionsByRule = {};
  for (const e of entries) exceptionsByRule[e.rule] = (exceptionsByRule[e.rule] ?? 0) + 1;

  // Vigência: quantos deals de ação já venceram (base para "o que recomendamos
  // ainda estava vivo?"). Sem outcome real, é o proxy disponível hoje.
  let actionDeals = 0;
  let actionExpired = 0;
  for (const ed of editions) {
    for (const deal of Array.isArray(ed.deals) ? ed.deals : []) {
      const isAction = deal.verdict && !["nao-confirmado", "evitaria", "esperaria"].includes(deal.verdict);
      if (!isAction) continue;
      actionDeals += 1;
      if (now && deal.vigencia && isExpired(deal.vigencia, now)) actionExpired += 1;
    }
  }

  return {
    generatedFrom: { posts: posts.length, dispatched: dispatched.length, editions: editions.length },
    dispositions: { byFaixa, itemsWithDisposition, downgradeRate, publishedBlocked },
    exceptions: { total: entries.length, byRule: exceptionsByRule },
    vigencia: { actionDeals, actionExpired },
    coverageNote:
      "Acurácia de confirmação real (ex.: bônus prometido efetivamente pago) exige " +
      "outcome tracking ainda não coletado; hoje mede coerência da régua, taxa de " +
      "rebaixe, exceções e vigência. Integra o backtest do Predict v2 quando o " +
      "outcome estiver disponível.",
  };
}

function main() {
  const write = process.argv.includes("--write");
  const now = new Date().toISOString();
  const ledger = readJson(LEDGER_PATH, { posts: {} });
  const exceptions = readJson(EXCEPTIONS_PATH, { entries: [] });
  const editions = listEditionFiles().map((f) => loadEdition(`content/editions/${f}`));
  const report = computeAccuracy({ ledger, exceptions, editions, now });

  console.log("== Acurácia da régua ==");
  console.log(JSON.stringify(report, null, 2));
  if (report.dispositions.publishedBlocked > 0) {
    console.error(`\n[acurácia] ALERTA: ${report.dispositions.publishedBlocked} item(ns) em faixa E foram despachados — violação da régua.`);
  }
  if (write) {
    writeFileSync(OUT_PATH, JSON.stringify({ ...report, generatedAt: now }, null, 2) + "\n");
    console.log(`\n[acurácia] Relatório salvo em ${OUT_PATH}.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
