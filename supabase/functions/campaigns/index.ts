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
//
// v14 — SHADOW MODE (Fase 3 do plano consolidado, migração 0009):
//   • persiste `published_at` (a v13 lia de news_raw e descartava) e `origin`
//     real (EXTRACT_ORIGIN: backfill|daily; default daily)
//   • valida ano fabricado no ingest (espelho de lib/date-review.ts
//     eventDateLooksFabricated) → flag `date_suspect`, NUNCA corrige sozinha
//   • grava `dedup_key` semântica e LOGA colisões com id divergente — o
//     upsert continua por `id` até a medição do shadow aprovar a troca (v15)
//   • segredo opcional: com EXTRACT_SECRET setado, exige x-extract-secret
//
// v15 — ÂNCORA DE ANO (prevenção na origem, PROPOSTA-ANCORA-V15 do predict):
//   • Patch 1 — a v14 só FLAGAVA a data fabricada depois; a v15 passa a data
//     de publicação ao prompt como ÂNCORA de ano, para o LLM não fabricar o
//     ano na origem (a peça de maior alavanca). É prevenção, não conserto.
//   • Patch 2 — reconcilia o flag `date_suspect`: além do padrão de ano ±65d
//     (v14), marca também gap evento→proveniência > 365d (espelho de
//     lib/temporal-plausibility.mjs, golden 20/20). Combina precisão do
//     year-shift com recall dos gaps sujos (canônico 943d antes escapava).
//   • NÃO muda makeId, chave de upsert (id) nem schema — Fase 1b (dedup por
//     identidade) fica de fora deste deploy.
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

// v14: origem real da rodada — o cron roda com default "daily"; rodadas de
// backfill setam EXTRACT_ORIGIN=backfill. Acaba o "auto" indistinguível.
const EXTRACT_ORIGIN = Deno.env.get("EXTRACT_ORIGIN")?.trim() || "daily";
// Segredo opcional (BKL-04): com EXTRACT_SECRET setado, só chamadas com o
// header correto executam. Sem env → comportamento atual (não quebra o cron).
const EXTRACT_SECRET = Deno.env.get("EXTRACT_SECRET")?.trim() || "";

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

// v15: âncora de ano — injeta a data de publicação no prompt para o LLM não
// fabricar o ano da vigência quando o texto não trouxer o ano explícito.
// Sem data válida → string vazia (não há âncora; o caminho daily não piora).
function yearAnchor(publishedAt: string | null): string {
  if (!publishedAt || !/^\d{4}-\d{2}-\d{2}/.test(publishedAt)) return "";
  return `\n\nData de publicacao desta noticia: ${publishedAt.slice(0, 10)}. `
    + `Use-a como ancora de ano: se o texto nao trouxer o ANO explicito da vigencia, `
    + `use o ano coerente com a publicacao. NUNCA gere vigencia_inicio/vigencia_fim `
    + `anterior a data de publicacao por mais de 30 dias, a menos que o texto diga `
    + `explicitamente que a campanha e antiga. Na duvida sobre o ano, use null e confianca "baixa".`;
}

async function analyze(text: string, publishedAt: string | null) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OR_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text.slice(0, 12000) + yearAnchor(publishedAt) },
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

// ---- v14 shadow: proveniência, validação de ano e dedup semântica ----

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const isoOrNull = (s: unknown): string | null => {
  if (typeof s !== "string" || !ISO_DATE.test(s)) return null;
  const d = s.slice(0, 10);
  return Number.isFinite(Date.parse(d + "T00:00:00Z")) ? d : null;
};

// ESPELHO de lib/date-review.ts eventDateLooksFabricated: gap evento→
// proveniência ≈ N anos (±65d) = padrão de ano fabricado pelo LLM.
const YEAR_TOLERANCE_DAYS = 65;
function eventDateLooksFabricated(eventDate: string, provenanceDate: string): boolean {
  const gap = Math.round(
    (Date.parse(provenanceDate + "T00:00:00Z") - Date.parse(eventDate + "T00:00:00Z")) / 864e5,
  );
  const years = Math.round(gap / 365);
  return years >= 1 && Math.abs(gap - years * 365) <= YEAR_TOLERANCE_DAYS;
}

// v15 Patch 2 — reconciliação do flag. ESPELHO de lib/temporal-plausibility.mjs:
// evento > SUSPECT_YEAR_DAYS antes da proveniência = ano provavelmente
// atrasado/fabricado. Pega os gaps sujos que o padrão ±65d perde (o canônico
// livelo→connectmiles a 943d fica a 152d de 3×365 e escapava do ±65d).
const SUSPECT_YEAR_DAYS = 365;
function daysEventBeforeSource(eventDate: string, provenanceDate: string): number {
  return Math.round(
    (Date.parse(provenanceDate + "T00:00:00Z") - Date.parse(eventDate + "T00:00:00Z")) / 864e5,
  );
}
// date_suspect = padrão de ano (±65d de N×365, v14) OU gap grande (>365d,
// predict). Combina precisão do year-shift com recall dos gaps sujos.
function eventDateIsSuspect(eventDate: string, provenanceDate: string): boolean {
  return eventDateLooksFabricated(eventDate, provenanceDate)
    || daysEventBeforeSource(eventDate, provenanceDate) > SUSPECT_YEAR_DAYS;
}

// Data candidata do evento — MESMA prioridade do windowDate dos motores.
const eventDateOf = (c: any): string | null =>
  isoOrNull(c?.vigencia_inicio) ?? isoOrNull(c?.vigencia_fim);

// Chave semântica: rota|tipo|percentual|bucket semanal do evento. Em shadow só
// grava/loga; NÃO participa do upsert (id legado continua mandando).
function makeDedupKey(c: any): string | null {
  const ev = eventDateOf(c);
  if (!ev) return null;
  const week = Math.floor(Date.parse(ev + "T00:00:00Z") / (7 * 864e5));
  const pct = c?.percentual == null ? "na" : String(c.percentual);
  return `${deaccent(c?.origem) || "desconhecido"}|${deaccent(c?.destino) || "desconhecido"}|${c?.tipo || "na"}|${pct}|w${week}`;
}

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

    // v15: passa a proveniência ao prompt como âncora de ano (prevenção).
    const { json, usage } = await analyze(text, isoOrNull(it.published_at));
    const campaigns = Array.isArray(json?.campaigns) ? json.campaigns.filter(Boolean) : [];

    const rows = campaigns.map((c: any) => {
      const fim = c.vigencia_fim ?? "na";
      let status = "continua";
      if (fim !== "na") {
        if (fim < today) status = "vencida";
        else if (fim <= in3days) status = "vence-72h";
      }

      // v14 shadow + v15 Patch 2: valida ano contra a proveniência da notícia.
      // Só FLAGA (date_suspect) — nunca corrige/anula a data sozinha; a
      // correção é decisão do operador na fila de revisão do admin.
      const provenance = isoOrNull(it.published_at) ?? today;
      const eventDate = eventDateOf(c);
      const dateSuspect = eventDate != null && eventDateIsSuspect(eventDate, provenance);

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
        // v14: origem real da rodada (backfill|daily) em vez de "auto" fixo.
        origin: EXTRACT_ORIGIN,
        notes: `${c.resumo || ""} [confianca:${c.confianca || "baixa"}]`,
        // v14 shadow (migração 0009): proveniência + validação + dedup.
        published_at: it.published_at ?? null,
        date_suspect: dateSuspect,
        dedup_key: makeDedupKey(c),
      };
    });

    if (rows.length > 0) {
      // Shadow de dedup: loga quando a chave semântica já existe com OUTRO id
      // (na Fase 1b isso vira upsert por dedup_key — hoje só medimos o impacto).
      try {
        const keys = rows.map((r: any) => r.dedup_key).filter(Boolean);
        if (keys.length) {
          const { data: dupes } = await supa
            .from("campaigns").select("id,dedup_key").in("dedup_key", keys);
          for (const r of rows) {
            const hit = (dupes ?? []).find((d: any) => d.dedup_key === r.dedup_key && d.id !== r.id);
            if (hit) console.log(`[shadow-dedup] ${r.dedup_key}: novo id ${r.id} colide com ${hit.id} (Fase 1b atualizaria em vez de duplicar)`);
          }
        }
      } catch (e) {
        console.error("shadow-dedup falhou (não bloqueia):", e);
      }

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

Deno.serve(async (req: Request) => {
  if (EXTRACT_SECRET && req.headers.get("x-extract-secret") !== EXTRACT_SECRET) {
    return new Response(JSON.stringify({ erro: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
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
      human_note: `extract v15 ${runId}: ${processed} noticias, ${extracted} campanhas, ${restantes} pendentes${stoppedByTime ? " (parou por tempo)" : ""}`,
    });
  } catch (e) {
    console.error("Erro ao logar run:", e);
  }

  return new Response(
    JSON.stringify({ processadas: processed, campanhas: extracted, pendentes: restantes, parou_por_tempo: stoppedByTime, runId, modelo: MODEL, versao: "v15-ancora" }),
    { headers: { "Content-Type": "application/json" } },
  );
});
