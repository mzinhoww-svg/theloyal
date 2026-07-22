// Síntese do Clipping (Supabase Edge Function `sintese-clipping`).
//
// Para cada news_raw processada SEM summary, pede ao LLM (OpenRouter) uma síntese
// PRÓPRIA de "o que mudou", passa pelo crivo anti-cópia (_shared/anticopia.ts) e SÓ
// grava `news_raw.summary` o que passa. O que reprova grava `summary_review_reason`
// e fica para revisão — nunca publica (regra inviolável 2).
//
// POR QUE AQUI (e não no runner do Actions): a chave do OpenRouter vive só no
// ambiente das edge functions do Supabase (Deno.env) — não está no Vault SQL nem
// depende de secret do GitHub. A síntese REAL roda onde a chave está.
//
// Instrumentação (REQ-34): cada chamada real de LLM grava UMA linha em `llm_jobs`
// (estágio `sintese_clipping`) com tokens REAIS observados — nunca coagidos a 0.
// Sem OPENROUTER_API_KEY → não chama, não grava job, não inventa síntese (INV-03).
//
// FONTE DE VERDADE: a versão deployada no Supabase. Este arquivo é o espelho
// versionado — manter em sincronia ao redeployar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { montarPromptSintese, validarSintese } from "../_shared/anticopia.ts";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const OR_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const MODEL = Deno.env.get("OPENROUTER_MODEL")?.trim() || "meta-llama/llama-4-maverick:17b";
const SYNTH_SECRET = Deno.env.get("SYNTH_SECRET")?.trim() || Deno.env.get("EXTRACT_SECRET")?.trim() || "";

const DEADLINE_MS = 100_000;
const CHUNK = 40;
const CONCURRENCY = 6;

// Relevância de loyalty: o Clipping é conteúdo de fidelidade, não notícia geral.
// `news_raw` mistura blogs de loyalty com busca web (tavily) que traz esporte/
// política. Só sintetiza (gasta LLM e vira coluna) o que tem sinal forte de loyalty
// no título/conteúdo — assim só loyalty ganha `summary`, logo só loyalty entra no
// Clipping (montarClipping não re-filtra tema). PostgREST .or() de ilike.
const RELEVANCIA = [
  "title.ilike.%milh%", "title.ilike.%smiles%", "title.ilike.%livelo%",
  "title.ilike.%latam pass%", "title.ilike.%connectmiles%", "title.ilike.%esfera%",
  "title.ilike.%tudoazul%", "title.ilike.%azul fidelidade%", "title.ilike.%fidelidade%",
  "title.ilike.%cashback%", "title.ilike.%pontos%", "title.ilike.%transferência bonificada%",
  "content.ilike.%transferência bonificada%", "content.ilike.%pontos livelo%",
  "content.ilike.%milhas aéreas%", "content.ilike.%clube de pontos%",
].join(",");

async function synth(noticia: { title?: string; content?: string; source?: string }) {
  const { system, user } = montarPromptSintese(noticia);
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OR_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.2,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`OpenRouter HTTP ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  if (!j?.choices || j.choices.length === 0) throw new Error("OpenRouter sem choices");
  let content = String(j.choices[0]?.message?.content ?? "").trim();
  if (content.startsWith("```")) content = content.replace(/```json\s*/i, "").replace(/```\s*$/i, "").trim();
  let summary = "";
  try {
    const parsed = JSON.parse(content);
    summary = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
  } catch {
    // resposta fora do contrato JSON → sem síntese utilizável (não chuta)
    summary = "";
  }
  return { summary, usage: j.usage || { prompt_tokens: 0, completion_tokens: 0 } };
}

async function logLlmJob(fields: {
  status: "ok" | "erro";
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  latenciaMs?: number;
  erro?: string;
  jobRef?: string;
}) {
  try {
    await supa.from("llm_jobs").insert({
      estagio: "sintese_clipping",
      provider: "openrouter",
      modelo: MODEL,
      tokens_in: fields.usage?.prompt_tokens ?? null,
      tokens_out: fields.usage?.completion_tokens ?? null,
      custo_usd: null,
      latencia_ms: fields.latenciaMs ?? null,
      status: fields.status,
      erro: fields.erro ? String(fields.erro).slice(0, 500) : null,
      job_ref: fields.jobRef ?? null,
    });
  } catch (e) {
    console.error("Erro ao gravar llm_jobs (nao bloqueia sintese):", e);
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = idx++;
        if (i >= items.length) break;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

type Stat = "sintetizada" | "revisao" | "sem_sintese" | "erro";

async function processItem(it: any): Promise<Stat> {
  const started = Date.now();
  try {
    const r = await synth({ title: it.title, content: it.content, source: it.source });
    await logLlmJob({ status: "ok", usage: r.usage, latenciaMs: Date.now() - started, jobRef: it.id });
    if (!r.summary) {
      // sem síntese utilizável — não grava, não é revisão (não houve texto a reprovar)
      return "sem_sintese";
    }
    const v = validarSintese(r.summary, { title: it.title, content: it.content });
    if (v.ok) {
      await supa.from("news_raw").update({
        summary: r.summary,
        summary_model: MODEL,
        summary_tokens_in: r.usage?.prompt_tokens ?? null,
        summary_tokens_out: r.usage?.completion_tokens ?? null,
        summary_job_ref: it.id,
        summary_review_reason: null,
      }).eq("id", it.id);
      return "sintetizada";
    }
    // reprovou o crivo: NÃO grava summary; registra o motivo p/ revisão (inviolável 2)
    await supa.from("news_raw").update({
      summary: null,
      summary_review_reason: v.motivos.join("; ").slice(0, 500),
    }).eq("id", it.id);
    return "revisao";
  } catch (e: any) {
    const msg = String(e).slice(0, 500);
    console.error(`Erro no item ${it.id}:`, msg);
    await logLlmJob({ status: "erro", latenciaMs: Date.now() - started, erro: msg, jobRef: it.id });
    return "erro";
  }
}

Deno.serve(async (req: Request) => {
  if (SYNTH_SECRET && req.headers.get("x-synth-secret") !== SYNTH_SECRET && req.headers.get("x-extract-secret") !== SYNTH_SECRET) {
    return new Response(JSON.stringify({ erro: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  if (!OR_KEY) {
    return new Response(
      JSON.stringify({ modo: "mock", motivo: "sem OPENROUTER_API_KEY no ambiente — 0 sínteses, 0 jobs (INV-03)", sintetizadas: 0 }),
      { headers: { "Content-Type": "application/json" } },
    );
  }
  // parâmetro opcional ?limit=N (default CHUNK), ?published_at=YYYY-MM-DD
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || CHUNK, 200);
  const dia = url.searchParams.get("published_at");
  const deadline = Date.now() + DEADLINE_MS;

  const tally = { total: 0, sintetizada: 0, revisao: 0, sem_sintese: 0, erro: 0 };
  while (Date.now() < deadline) {
    let q = supa.from("news_raw").select("id,source,title,url,content,published_at")
      .eq("processed", true).is("summary", null).is("summary_review_reason", null)
      .not("content", "is", null).or(RELEVANCIA)
      .limit(Math.min(limit - tally.total, CHUNK));
    if (dia) q = q.eq("published_at", dia);
    const { data: items, error } = await q;
    if (error) return new Response(JSON.stringify({ erro: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    if (!items || items.length === 0) break;

    const results = await mapLimit(items, CONCURRENCY, processItem);
    for (const s of results) { tally.total++; tally[s]++; }
    if (tally.total >= limit) break;
  }

  return new Response(
    JSON.stringify({ modelo: MODEL, versao: "v2-inv25", limiar: 0.35, run_max: 8, ...tally }),
    { headers: { "Content-Type": "application/json" } },
  );
});
