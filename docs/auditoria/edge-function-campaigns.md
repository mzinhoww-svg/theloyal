# Edge function `campaigns` — transcrição e análise (evidência)

> Recuperada do Supabase implantado (`qjqnqcsdnpvvmyzkavoq`, projeto the-loyalty) via
> MCP `get_edge_function`, **slug `campaigns`, versão 13, status ACTIVE**, em
> 2026-07-15. É a função que **extrai as datas, gera o `id`, faz o upsert e define
> `first_seen`/`observed_at`/`origin`** — a origem definitiva do erro temporal.
> **Sem secrets:** o código referencia `Deno.env.get(...)` mas não contém valores.

## Análise obrigatória (o que a função faz de fato)

| Item | Achado (confirmado no código implantado) |
|---|---|
| **Modelo/LLM** | `meta-llama/llama-4-maverick:17b` via OpenRouter, `temperature 0.1`, texto truncado em 12.000 chars. |
| **Prompt** | Pede JSON com `origem, destino, tipo, percentual, paridade, vigencia_inicio, vigencia_fim, tier, regulamento_url, resumo, confianca`. Instruções: *"NAO invente datas nem percentuais. Se a noticia nao disser, use null e confianca 'baixa'"*; `vigencia_fim: YYYY-MM-DD` ou `"na"` se permanente. **Não pede** data de anúncio/publicação, mercado, segmento nem mecânica. |
| **Schema de saída** | Os campos acima. **Sem** `data_anuncio`, mercado, segmento, mecânica. |
| **Validação das datas** | **NENHUMA.** `vigencia_inicio`/`vigencia_fim` são gravados como o LLM devolveu. O único uso da data é derivar `status` (`fim<today→vencida`, `fim<=in3days→vence-72h`). **Não há** checagem de plausibilidade, de ano, nem comparação com a data de publicação da notícia. |
| **Função que gera o `id`** | `makeId(c) = ${deaccent(origem)||'desconhecido'}-${deaccent(destino)||'desconhecido'}-${tipo||'na'}-${vigencia_fim||'na'}`. **Confirma: o `id` embute `vigencia_fim`** (ou `na`), e usa `desconhecido` quando origem/destino vêm vazios. |
| **`on conflict`** | `supa.from("campaigns").upsert(rows, { onConflict: "id" })`. Atualiza **apenas as colunas presentes no payload**. |
| **Campos preservados** | `verdict`, `tl_score`, `used_in` **não estão no payload** → **são preservados** no conflito (não sobrescritos). *(Responde o item §4.9 da auditoria forense, antes "não confirmado": os campos editoriais sobrevivem ao upsert.)* |
| **Campos sobrescritos** | Os do payload: `origem, destino, tipo, percentual, paridade, vigencia_inicio, vigencia_fim, status, discard_reason, tier, source_*, first_seen, last_seen, observed_at, origin, notes` — sobrescritos a cada reextração do **mesmo `id`**. |
| **`first_seen`** | `it.published_at || today` → **é a data de publicação da notícia** (proveniência), com fallback para a data da rodada. **Não é** a data do evento comercial. |
| **`observed_at` / `last_seen`** | `today` (data da rodada de extração). |
| **`origin`** | Hardcoded `"auto"` em toda extração. **Confirma: não existe `origin='backfill'`;** backfill e coleta recente entram ambos como `auto`. |
| **`published_at`** | A função **lê** `news_raw.published_at` (para popular `first_seen`), mas **não grava** coluna `published_at` em `campaigns` (que não a possui). |
| **Comportamento em reprocessamento** | O loop pega `news_raw where processed=false`, extrai e marca `processed=true`. Reprocessar (admin seta `processed=false`) → reextrai → upsert por `id`. Se a nova extração produzir **`vigencia_fim` diferente**, o `id` muda → **cria linha nova (duplicata), não atualiza**. Se produzir o mesmo `id`, sobrescreve os campos do payload. |

### Consequência direta (mecanismo do erro temporal e da duplicidade)
1. O LLM extrai `vigencia_fim` do texto **sem validação**; pode fabricar ano/mês (ex.:
   "até hoje (12)" → `2023-12-12`).
2. Esse `vigencia_fim` entra no **`id`** → a mesma campanha, lida em duas rodadas ou de
   dois artigos ("último dia" / "prorrogado") com `vigencia_fim` diferente, gera **ids
   diferentes** e **não deduplica**.
3. `first_seen` guarda a data de publicação (proveniência) — que **revelaria** o erro
   (data do evento << data de publicação) — mas **nenhum código a usa para validar** e
   os motores a **ignoram** de propósito.

## Transcrição do código implantado (`index.ts`, v13)

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MODEL = "meta-llama/llama-4-maverick:17b";
const OR_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

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

// analyze(text): POST OpenRouter chat/completions; parse JSON (tolera cerca ```); retorna {json, usage}.

const deaccent = (s) => (s == null ? "" : String(s)).normalize("NFD").replace(/<combining-marks>/g, "").toLowerCase().trim();
const makeId = (c) =>
  `${deaccent(c?.origem) || "desconhecido"}-${deaccent(c?.destino) || "desconhecido"}-${c?.tipo || "na"}-${c?.vigencia_fim || "na"}`;

// processItem(it, runId, today, in3days):
//   text = it.content||it.title; se vazio → news_raw.processed=true, error="Conteudo vazio".
//   {json,usage} = analyze(text); campaigns = json.campaigns.filter(Boolean).
//   rows = campaigns.map(c => {
//     const fim = c.vigencia_fim ?? "na";
//     let status = "continua";
//     if (fim !== "na") { if (fim < today) status="vencida"; else if (fim <= in3days) status="vence-72h"; }
//     return {
//       id: makeId(c), module: c.tipo, origem: deaccent(c.origem)||"desconhecido",
//       destino: deaccent(c.destino)||"desconhecido", tipo: c.tipo, percentual: c.percentual,
//       paridade: c.paridade, vigencia_inicio: c.vigencia_inicio, vigencia_fim: fim, status,
//       discard_reason: (fim!=="na" && fim<today) ? `vigencia encerrada em ${fim}` : null,
//       tier: c.tier||2, source_name: it.source, source_url: it.url, regulamento_url: c.regulamento_url,
//       first_seen: it.published_at || today, last_seen: today, observed_at: today,
//       origin: "auto", notes: `${c.resumo||""} [confianca:${c.confianca||"baixa"}]`,
//     };
//   });
//   if (rows.length) supa.from("campaigns").upsert(rows, { onConflict: "id" });
//   supa.from("news_raw").update({ processed:true, process_run:runId, model_used:MODEL,
//     tokens_in, tokens_out, campaigns_extracted: rows.length, extraction_json: json, error:null }).eq("id", it.id);
//   catch → news_raw.update({ processed:true, error: msg }).

// Deno.serve(): loop enquanto Date.now()<deadline: busca news_raw where processed=false limit CHUNK,
//   mapLimit(CONCURRENCY, processItem); ao esvaziar/estourar tempo, insere runs{product:'extract',...}.
```

> Nota: `<combining-marks>` acima substitui o range de combinantes Unicode U+0300–U+036F
> literal do código, para o bloco não corromper a renderização deste documento. A
> transcrição do miolo (`processItem`) está em comentário fiel, sem alterar a lógica.
