#!/usr/bin/env node
// sintese-clipping.mjs — PASSO DE SÍNTESE no ingest (M2.7). Para cada news_raw
// relevante (processada, sem summary), pede ao LLM uma síntese PRÓPRIA de "o que
// mudou", valida contra o anti-cópia + guardrails editoriais, e SÓ grava em
// news_raw.summary o que passa. O que falha vira REVISÃO (nunca publica).
//
// Determinismo (INV-12): o LLM só NARRA. A SELEÇÃO do que entra no Clipping
// continua determinística (selecionarClipping/piso 5, em montar-edicao). Este
// passo não decide o que é notícia nem o que é oferta — só encorpa o dia fraco
// com uma frase própria por item.
//
// Instrumentação (REQ-34): cada chamada real ao LLM grava UMA linha em `llm_jobs`
// (estágio `sintese_clipping`) via recordLlmJob — dentro de `sintetizarNoticia`,
// com tokens REAIS (nunca coagidos a 0). A proveniência por item (modelo, tokens,
// job_ref) também vai para news_raw (migration 016).
//
// Mock-safe (INV-03): sem OPENROUTER_API_KEY/OLLAMA_BASE_URL, `sintetizarNoticia`
// devolve null — não chama API, não grava job, não inventa token nem síntese. O
// Clipping do dia simplesmente omite (regra-mãe). Sem SUPABASE_* a leitura/escrita
// também é mock (não toca a rede).
import { select, patch, supabaseEnabled } from "./supabase.mjs";
import { sintetizarNoticia, llmBackend } from "./llm.mjs";
import { validarSintese, LIMIAR_ANTICOPIA } from "../../v2/lib/digest/sintese-clipping.mjs";
import { hojeSaoPaulo } from "../lib.mjs";

/**
 * Núcleo TESTÁVEL do lote: independe de rede. Recebe as linhas e as funções de
 * efeito (injetáveis) — assim o caminho de instrumentação/decisão é provado
 * offline, sem key nem banco.
 *
 * @param {object[]} rows  linhas de news_raw ({id,title,content,url,source,...})
 * @param {object} deps
 * @param {(noticia:object, jobRef:string|null)=>Promise<null|{summary:string,model?:string,tokens_in?:number,tokens_out?:number}>} deps.sintetizador
 * @param {(row:object, r:object)=>Promise<void>} deps.escrever      grava o summary + proveniência
 * @param {(row:object, motivos:string[])=>Promise<void>} deps.marcarRevisao  marca a notícia p/ revisão
 * @param {number} [deps.limiar]
 * @returns {Promise<{total:number, sintetizadas:number, revisao:number, semLlm:number}>}
 */
export async function sintetizarLote(rows = [], { sintetizador, escrever, marcarRevisao, limiar = LIMIAR_ANTICOPIA } = {}) {
  const stats = { total: rows.length, sintetizadas: 0, revisao: 0, semLlm: 0 };
  for (const row of rows) {
    const r = await sintetizador(row, row?.id ?? null);
    if (!r || !r.summary) {
      // mock, erro ou resposta vazia — sem síntese, sem token falso. Não é
      // revisão (não houve texto a reprovar); o item só não ganha summary hoje.
      stats.semLlm++;
      continue;
    }
    const v = validarSintese(r.summary, row, { limiar });
    if (v.ok) {
      await escrever(row, r);
      stats.sintetizadas++;
    } else {
      await marcarRevisao(row, v.motivos);
      stats.revisao++;
    }
  }
  return stats;
}

// ---------------------------------------------------------------------------
// CLI: lê news_raw do banco, roda o lote, grava. Mock-safe em todas as pontas.
// ---------------------------------------------------------------------------

function parse(argv) {
  const o = { now: null, limit: 200 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--now") o.now = argv[++i];
    else if (a === "--limit") o.limit = Number(argv[++i]) || o.limit;
  }
  return o;
}

// Notícias candidatas: processadas, ainda SEM síntese. Quando `hoje` é dado,
// restringe ao dia (lote do ingest matinal). A RELEVÂNCIA determinística mínima é
// `processed=true` — a mesma barra de selecionarClipping (dia-fraco.mjs).
async function carregarCandidatas({ hoje, limit }) {
  const cols = "id,source,title,url,content,summary,processed,published_at";
  const janela = hoje ? `&published_at=eq.${hoje}` : "";
  const query = `select=${cols}&processed=eq.true&summary=is.null${janela}&limit=${limit}`;
  const { rows } = await select("news_raw", query);
  return rows || [];
}

async function main() {
  const opts = parse(process.argv.slice(2));
  const hoje = opts.now || hojeSaoPaulo(); // dia BRT — casa com o boundary do Daily (M9)
  const backend = llmBackend();

  if (backend === "mock") {
    console.log(`[sintese] modo MOCK (sem OPENROUTER_API_KEY/OLLAMA_BASE_URL): 0 sínteses, 0 jobs — INV-03 (nenhum token inventado). Clipping do dia ${hoje} omite se não houver summary pré-existente.`);
    return;
  }
  if (!supabaseEnabled()) {
    console.log("[sintese] sem SUPABASE_* — leitura/escrita em mock; nada gravado.");
  }

  const rows = await carregarCandidatas({ hoje, limit: opts.limit });
  console.log(`[sintese] ${rows.length} notícia(s) processada(s) sem síntese (dia ${hoje}). Backend: ${backend}.`);

  const stats = await sintetizarLote(rows, {
    sintetizador: sintetizarNoticia,
    escrever: async (row, r) => {
      await patch("news_raw", `id=eq.${encodeURIComponent(row.id)}`, {
        summary: r.summary,
        summary_model: r.model ?? null,
        summary_tokens_in: r.tokens_in ?? null,
        summary_tokens_out: r.tokens_out ?? null,
        summary_job_ref: row.id, // correlaciona com llm_jobs.job_ref
        summary_review_reason: null,
      });
    },
    marcarRevisao: async (row, motivos) => {
      // Falhou anti-cópia/guardrail: NÃO grava summary; registra o motivo p/ o
      // operador. A notícia fica sem síntese (não entra no Clipping) até revisão.
      await patch("news_raw", `id=eq.${encodeURIComponent(row.id)}`, {
        summary: null,
        summary_review_reason: motivos.join("; ").slice(0, 500),
      });
    },
  });

  console.log(`[sintese] FIM. sintetizadas=${stats.sintetizadas}, revisão=${stats.revisao}, sem-síntese=${stats.semLlm} (de ${stats.total}). Limiar anti-cópia=${LIMIAR_ANTICOPIA}.`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error("[sintese] ERRO:", e.stack || e.message); process.exit(1); });
}
