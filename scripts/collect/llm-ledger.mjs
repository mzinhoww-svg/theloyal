// Instrumentação de custo do radar (M2.5 · REQ-34). Grava UMA linha em
// `llm_jobs` por chamada real a um backend de LLM (openrouter/ollama). Só
// telemetria do OBSERVADO — tokens/latência/status; custo_usd fica null (o
// painel calcula com o preço do model_registry, INV-12). Mock-safe: sem
// SUPABASE_* configurado, `insert` não toca a rede.
import { insert } from "./supabase.mjs";

// Extrai tokens do shape de usage de cada backend (formatos diferentes).
export function tokensFromUsage(provider, usage) {
  if (!usage) return { tokens_in: null, tokens_out: null };
  if (provider === "openrouter") {
    return {
      tokens_in: Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : null,
      tokens_out: Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : null,
    };
  }
  if (provider === "ollama") {
    // Ollama devolve prompt_eval_count / eval_count no corpo da resposta.
    return {
      tokens_in: Number.isFinite(usage.prompt_eval_count) ? usage.prompt_eval_count : null,
      tokens_out: Number.isFinite(usage.eval_count) ? usage.eval_count : null,
    };
  }
  return { tokens_in: null, tokens_out: null };
}

// Grava o job. Nunca deixa a telemetria derrubar a coleta: erro no ledger é
// logado, não propagado.
export async function recordLlmJob(job) {
  try {
    await insert("llm_jobs", [{
      estagio: job.estagio,
      provider: job.provider,
      modelo: job.modelo,
      tokens_in: job.tokens_in ?? null,
      tokens_out: job.tokens_out ?? null,
      custo_usd: null,                 // derivado no painel (tokens × preço), INV-12
      latencia_ms: job.latencia_ms ?? null,
      status: job.status,
      fallback_de: job.fallback_de ?? null,
      erro: job.erro ? String(job.erro).slice(0, 500) : null,
      job_ref: job.job_ref ?? null,
    }]);
  } catch (e) {
    console.error("[llm-ledger] falha ao gravar llm_jobs (não bloqueia coleta):", String(e).slice(0, 200));
  }
}
