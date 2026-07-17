// Extrator de campanhas (Supabase Edge Function `campaigns`).
//
// Consome news_raw pendente (processed=false), manda o texto ao LLM (OpenRouter)
// e faz upsert das campanhas extraídas em `campaigns`. Roda a cada 5 min pelo
// cron `extract-2h` e sob demanda pelo botão "Rodar extração" do admin.
//
// FONTE DE VERDADE: a versão deployada no Supabase (mcp/deploy). Este arquivo é
// o espelho versionado — mantenha-o em sincronia ao redeployar.
//
// Robustez já embutida (histórico): guard de `choices` (evita o crash
// "Cannot read properties of undefined (reading '0')" quando o OpenRouter
// devolve um shape sem choices) e `deaccent` null-safe (evita `.normalize` em
// null). Erros por item são capturados e gravados em news_raw.error.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MODEL = "meta-llama/llama-4-maverick:17b";
const OR_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

// Orcamento de tempo por rodada (abaixo do limite da Edge Function).
// Otimizacao: processa cada bloco de CHUNK em PARALELO com concorrencia
// limitada (evita rate-limit do LLM) ate esvaziar a fila OU bater o tempo.
const DEADLINE_MS = 100_000;
const CHUNK = 24;
const CONCURRENCY = 6;

const SYSTEM = `Voce e um analista de programas de fidelidade brasileiros. Responda APENAS um JSON valido. NUNCA use markdown, comentarios, texto fora do JSON ou blocos de codigo.

Formato obrigatorio:
{"campaigns":[{"origem":"livelo","destino":"latampass","tipo":"transferencia","percentual":30,"paridade":null,"vigencia_inicio":"2026-07-13","vigencia_fim":"2026-07-20","tier":1,"regulamento_url":null,"resumo":"Transferencia bonificada de 30% da Livelo para LATAM Pass","confianca":"alta"}]}

Regras:
- origem e destino: minusculas, sem acento (ex: livelo, smiles, latampass, connectmiles, esfera, c6, nubank, itau).
- tipo: transferencia | compra | clube | cartao | hotelaria | estrutural.
- percentual: so o numero do bonus/desconto. Se nao houver, null.
- vigencia_fim: YYYY-MM-DD. Se permanente/estrutural, use "na".
- NAO invente datas nem percentuais. Se a noticia nao disser, use null e confianca "baixa".
- Se a noticia NAO for sobre campanha promocional (opiniao, tutorial, viagem), retorne {"campaigns":[]}.`;

async function analyze(text: string) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OR_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text.slice(0, 12000) },
      ],
      temperature: 0.1,
    }),
  });

  const j = await r.json();
  if (!r.ok) throw new Error(`OpenRouter HTTP ${r.status}: ${JSON.stringify(j)}`);
  if (!j?.choices || j.choices.length === 0) throw new Error(`OpenRouter sem choices: ${JSON.stringify(j)}`);
  const content = j.choices[0]?.message?.content;
  if (!content) throw new Error(`OpenRouter sem content: ${JSON.stringify(j)}`);

  let clean = content.trim();
  if (clean.startsWith("```")) clean = clean.replace(/```json\s*/i, "").replace(/```\s*$/i, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (e: any) {
    throw new Error(`JSON invalido: ${clean.slice(0, 200)}... Erro: ${e.message}`);
  }
  return { json: parsed, usage: j.usage || { prompt_tokens: 0, completion_tokens: 0 } };
}

// Null-safe: aceita null/undefined/nao-string sem quebrar (.normalize em null crashava).
const deaccent = (s: unknown) =>
  (s == null ? "" : String(s)).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const makeId = (c: any) =>
  `${deaccent(c?.origem) || "desconhecido"}-${deaccent(c?.destino) || "desconhecido"}-${c?.tipo || "na"}-${c?.vigencia_fim || "na"}`;

// Concurrency-limited map.
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

async function processItem(it: any, runId: string, today: string, in3days: string): Promise<{ processed: number; extracted: number }> {
  try {
    const text = (it.content || it.title || "").trim();
    if (!text) {
      await supa.from("news_raw").update({ processed: true, process_run: runId, error: "Conteudo vazio" }).eq("id", it.id);
      return { processed: 1, extracted: 0 };
    }

    const { json, usage } = await analyze(text);
    const campaigns = Array.isArray(json?.campaigns) ? json.campaigns.filter(Boolean) : [];

    const rows = campaigns.map((c: any) => {
      const fim = c.vigencia_fim ?? "na";
      let status = "continua";
      if (fim !== "na") {
        if (fim < today) status = "vencida";
        else if (fim <= in3days) status = "vence-72h";
      }
      return {
        id: makeId(c),
        module: c.tipo,
        origem: deaccent(c.origem) || "desconhecido",
        destino: deaccent(c.destino) || "desconhecido",
        tipo: c.tipo,
        percentual: c.percentual,
        paridade: c.paridade,
        vigencia_inicio: c.vigencia_inicio,
        vigencia_fim: fim,
        status,
        discard_reason: fim !== "na" && fim < today ? `vigencia encerrada em ${fim}` : null,
        tier: c.tier || 2,
        source_name: it.source,
        source_url: it.url,
        regulamento_url: c.regulamento_url,
        first_seen: it.published_at || today,
        last_seen: today,
        observed_at: today,
        origin: "auto",
        notes: `${c.resumo || ""} [confianca:${c.confianca || "baixa"}]`,
      };
    });

    if (rows.length > 0) {
      const { error: upsertErr } = await supa.from("campaigns").upsert(rows, { onConflict: "id" });
      if (upsertErr) console.error("Erro upsert campaigns:", upsertErr);
    }

    const { error: updErr } = await supa.from("news_raw").update({
      processed: true,
      process_run: runId,
      model_used: MODEL,
      tokens_in: usage?.prompt_tokens,
      tokens_out: usage?.completion_tokens,
      campaigns_extracted: rows.length,
      extraction_json: json,
      error: null,
    }).eq("id", it.id);
    if (updErr) console.error("Erro update news_raw:", updErr);

    return { processed: 1, extracted: rows.length };
  } catch (e: any) {
    const msg = String(e).slice(0, 500);
    console.error(`Erro no item ${it.id}:`, msg);
    await supa.from("news_raw").update({ processed: true, process_run: runId, error: msg }).eq("id", it.id);
    return { processed: 1, extracted: 0 };
  }
}

Deno.serve(async () => {
  const runId = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  const in3days = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const deadline = Date.now() + DEADLINE_MS;

  let processed = 0;
  let extracted = 0;
  let stoppedByTime = false;

  while (true) {
    if (Date.now() >= deadline) { stoppedByTime = true; break; }

    const { data: items, error: fetchError } = await supa
      .from("news_raw").select("*").eq("processed", false).limit(CHUNK);

    if (fetchError) {
      return new Response(JSON.stringify({ erro: `Erro ao buscar news_raw: ${fetchError.message}` }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    if (!items || items.length === 0) break;

    const results = await mapLimit(items, CONCURRENCY, (it) => processItem(it, runId, today, in3days));
    for (const r of results) { processed += r.processed; extracted += r.extracted; }
  }

  let restantes = 0;
  try {
    const c = await supa.from("news_raw").select("id", { count: "exact", head: true }).eq("processed", false);
    restantes = (c as any)?.count || 0;
  } catch { restantes = -1; }

  try {
    await supa.from("runs").insert({
      product: "extract",
      kind: "scheduled",
      status: "ok",
      campaigns_found: extracted,
      human_note: `extract ${runId}: ${processed} noticias, ${extracted} campanhas, ${restantes} pendentes${stoppedByTime ? " (parou por tempo)" : ""}`,
    });
  } catch (e) {
    console.error("Erro ao logar run:", e);
  }

  return new Response(
    JSON.stringify({ processadas: processed, campanhas: extracted, pendentes: restantes, parou_por_tempo: stoppedByTime, runId, modelo: MODEL }),
    { headers: { "Content-Type": "application/json" } },
  );
});
