// Golden do PASSO DE SÍNTESE no ingest (M2.7). Prova, sem key e sem banco:
//   - síntese própria → GRAVA (com tokens REAIS de proveniência, nunca 0);
//   - trecho copiado → REVISÃO (não grava summary);
//   - mock (sintetizador → null) → sem síntese, sem job (INV-03);
//   - o caminho de instrumentação (recordLlmJob estágio `sintese_clipping` +
//     tokensFromUsage com tokens reais) roda sem coagir token a 0.
// node --test scripts/collect/sintese-clipping.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { sintetizarLote } from "./sintese-clipping.mjs";
import { recordLlmJob, tokensFromUsage } from "./llm-ledger.mjs";

const NOTICIA = {
  id: "n1",
  source: "pontospravoar",
  url: "https://pontospravoar.com/smiles-bonus",
  title: "Smiles lança bônus de 100% em transferências de pontos de bancos parceiros",
  content:
    "A Smiles anunciou nesta terça-feira um bônus de 100% na transferência de pontos para o programa a partir de bancos parceiros. " +
    "A promoção vale até o fim da semana e cobre transferências feitas pelo aplicativo.",
};

const PROPRIA = "Smiles dobrou temporariamente o incentivo para migrar pontos vindos de instituições parceiras, e a janela se encerra no domingo.";
const COPIADA = "um bônus de 100% na transferência de pontos para o programa a partir de bancos parceiros";

function coletor() {
  const escritas = [];
  const revisoes = [];
  return {
    escritas, revisoes,
    escrever: async (row, r) => { escritas.push({ id: row.id, r }); },
    marcarRevisao: async (row, motivos) => { revisoes.push({ id: row.id, motivos }); },
  };
}

test("síntese própria → grava, com tokens reais de proveniência", async () => {
  const c = coletor();
  // Sintetizador FAKE no lugar do LLM: devolve síntese própria + tokens reais
  // observados (como o backend real devolveria). Prova o caminho sem key.
  const sintetizador = async () => ({ summary: PROPRIA, model: "openai/gpt-4o-mini", tokens_in: 812, tokens_out: 47 });
  const stats = await sintetizarLote([NOTICIA], { ...c, sintetizador });
  assert.deepEqual(stats, { total: 1, sintetizadas: 1, revisao: 0, semLlm: 0 });
  assert.equal(c.escritas.length, 1);
  assert.equal(c.escritas[0].r.summary, PROPRIA);
  // Tokens REAIS carregados para a proveniência — nunca coagidos a 0 (INV-03).
  assert.equal(c.escritas[0].r.tokens_in, 812);
  assert.equal(c.escritas[0].r.tokens_out, 47);
  assert.ok(c.escritas[0].r.tokens_in > 0 && c.escritas[0].r.tokens_out > 0);
});

test("trecho copiado → revisão, não grava summary", async () => {
  const c = coletor();
  const sintetizador = async () => ({ summary: COPIADA, model: "openai/gpt-4o-mini", tokens_in: 800, tokens_out: 30 });
  const stats = await sintetizarLote([NOTICIA], { ...c, sintetizador });
  assert.deepEqual(stats, { total: 1, sintetizadas: 0, revisao: 1, semLlm: 0 });
  assert.equal(c.escritas.length, 0, "cópia NUNCA é gravada");
  assert.equal(c.revisoes.length, 1);
  assert.ok(c.revisoes[0].motivos.some((m) => /anti-c[óo]pia/.test(m)), `motivos: ${c.revisoes[0].motivos.join(" | ")}`);
});

test("mock (sintetizador → null) → sem síntese, sem job, sem token falso (INV-03)", async () => {
  const c = coletor();
  const sintetizador = async () => null; // é o que sintetizarNoticia devolve em modo mock
  const stats = await sintetizarLote([NOTICIA], { ...c, sintetizador });
  assert.deepEqual(stats, { total: 1, sintetizadas: 0, revisao: 0, semLlm: 1 });
  assert.equal(c.escritas.length, 0);
  assert.equal(c.revisoes.length, 0, "sem texto não há o que reprovar — não é revisão");
});

test("lote misto: própria + copiada + mock, cada uma no seu destino", async () => {
  const c = coletor();
  const rows = [
    { ...NOTICIA, id: "ok" },
    { ...NOTICIA, id: "copia" },
    { ...NOTICIA, id: "vazio" },
  ];
  const respostas = {
    ok: { summary: PROPRIA, model: "m", tokens_in: 100, tokens_out: 10 },
    copia: { summary: COPIADA, model: "m", tokens_in: 100, tokens_out: 10 },
    vazio: null,
  };
  const sintetizador = async (row) => respostas[row.id];
  const stats = await sintetizarLote(rows, { ...c, sintetizador });
  assert.deepEqual(stats, { total: 3, sintetizadas: 1, revisao: 1, semLlm: 1 });
  assert.deepEqual(c.escritas.map((e) => e.id), ["ok"]);
  assert.deepEqual(c.revisoes.map((r) => r.id), ["copia"]);
});

// ── Instrumentação: o ledger aceita o estágio novo e os tokens reais fluem ──
test("recordLlmJob aceita estágio `sintese_clipping` em mock (sem rede, sem throw)", async () => {
  // Sem SUPABASE_* o insert é no-op; o objetivo é provar que o caminho de
  // gravação do job para o estágio novo não quebra (a migration 016 estende o
  // CHECK do banco; aqui prova-se o emissor).
  await assert.doesNotReject(() =>
    recordLlmJob({ estagio: "sintese_clipping", provider: "mock", modelo: "mock", tokens_in: 812, tokens_out: 47, status: "ok", job_ref: "n1" }),
  );
});

test("tokensFromUsage extrai tokens REAIS (openrouter/ollama), nunca 0 forçado", () => {
  assert.deepEqual(
    tokensFromUsage("openrouter", { prompt_tokens: 812, completion_tokens: 47 }),
    { tokens_in: 812, tokens_out: 47 },
  );
  assert.deepEqual(
    tokensFromUsage("ollama", { prompt_eval_count: 640, eval_count: 33 }),
    { tokens_in: 640, tokens_out: 33 },
  );
  // Mock não tem usage → null (não é 0: 0 mentiria que a chamada foi de graça).
  assert.deepEqual(tokensFromUsage("mock", null), { tokens_in: null, tokens_out: null });
});
