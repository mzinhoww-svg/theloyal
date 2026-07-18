// Painel de custo LLM (M2.5 · REQ-34/35). Puro, sem I/O.
// LÊ linhas de `llm_jobs` + preços de `model_registry` e SOMA por dia × estágio.
//
// INV-03/INV-12: o custo NÃO é inventado nem coagido. Preço ausente no
// model_registry (ou tokens ausentes na chamada) ⇒ custo = null ("Não
// confirmado"), NUNCA 0 — 0 mentiria que a chamada foi de graça. O ledger só
// guarda o observado (tokens/latência/status); a conta (tokens × preço) é
// determinística e vive AQUI, não no emissor.

// Custo em USD de UMA chamada, a partir dos tokens observados e do preço do
// estágio (linha de model_registry). Sem preço OU sem tokens completos → null.
export function custoUsd(job, preco) {
  if (!preco) return null;
  const pin = preco.preco_input_por_1k_usd;
  const pout = preco.preco_output_por_1k_usd;
  if (pin == null || pout == null) return null;              // preço "a confirmar" → null, nunca 0
  const ti = job?.tokens_in;
  const to = job?.tokens_out;
  if (!Number.isFinite(ti) || !Number.isFinite(to)) return null; // token faltando → não fabrica parcial
  return (ti / 1000) * Number(pin) + (to / 1000) * Number(pout);
}

// percentile_cont (interpolação linear, igual ao Postgres) sobre latências
// definidas. Array vazio → null.
export function percentileCont(values, p) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  if (xs.length === 1) return xs[0];
  const rank = p * (xs.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return xs[lo] + (xs[hi] - xs[lo]) * (rank - lo);
}

// Data (YYYY-MM-DD) de um job a partir de criado_em (timestamptz ou Date).
function diaDe(job) {
  const raw = job?.criado_em;
  if (raw == null) return null;
  const s = typeof raw === "string" ? raw : new Date(raw).toISOString();
  return s.slice(0, 10);
}

// Índice estagio → linha de model_registry.
export function registryMap(rows = []) {
  const m = new Map();
  for (const r of rows) m.set(r.estagio, r);
  return m;
}

// Soma o ledger por (dia, estágio). Espelho da consulta §4 da spec, em JS puro
// e testável. `registry` é um Map (registryMap) ou array de model_registry.
// custo_usd_total é null quando NENHUM job do grupo tem custo mensurável
// (preço/tokens ausentes) — nunca 0 coagido.
export function agregarPorDiaEstagio(jobs = [], registry = new Map()) {
  const reg = registry instanceof Map ? registry : registryMap(registry);
  const grupos = new Map();

  for (const job of jobs) {
    const dia = diaDe(job);
    const estagio = job?.estagio;
    if (dia == null || estagio == null) continue;
    const key = `${dia}::${estagio}`;
    if (!grupos.has(key)) {
      grupos.set(key, {
        dia,
        estagio,
        chamadas: 0,
        tokens_in_total: 0,
        tokens_out_total: 0,
        custo_usd_total: null,      // permanece null até haver ao menos 1 custo definido
        _custos: 0,                 // contador de custos definidos, p/ decidir null vs soma
        _latencias: [],
        erros: 0,
        fallbacks: 0,
      });
    }
    const g = grupos.get(key);
    g.chamadas += 1;
    if (Number.isFinite(job.tokens_in)) g.tokens_in_total += job.tokens_in;
    if (Number.isFinite(job.tokens_out)) g.tokens_out_total += job.tokens_out;
    const c = custoUsd(job, reg.get(estagio));
    if (c != null) {
      g.custo_usd_total = (g.custo_usd_total ?? 0) + c;
      g._custos += 1;
    }
    if (Number.isFinite(job.latencia_ms)) g._latencias.push(job.latencia_ms);
    if (job.status === "erro") g.erros += 1;
    if (job.status === "fallback") g.fallbacks += 1;
  }

  const out = [];
  for (const g of grupos.values()) {
    out.push({
      dia: g.dia,
      estagio: g.estagio,
      chamadas: g.chamadas,
      tokens_in_total: g.tokens_in_total,
      tokens_out_total: g.tokens_out_total,
      custo_usd_total: g.custo_usd_total,          // null = "Não confirmado" (sem preço/tokens)
      custo_confirmado: g._custos === g.chamadas && g.chamadas > 0,
      latencia_p50_ms: percentileCont(g._latencias, 0.5),
      latencia_p95_ms: percentileCont(g._latencias, 0.95),
      erros: g.erros,
      fallbacks: g.fallbacks,
    });
  }
  // dia desc, estágio asc (igual ao ORDER BY 1 desc, 2 da spec §4).
  out.sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : a.estagio.localeCompare(b.estagio)));
  return out;
}

// Total do dia contra o teto (LLM_DAILY_BUDGET_USD): só VISIBILIDADE (spec §3),
// não enforcement. Retorna custo agregado do dia e quanto falta para o teto —
// custo null quando nenhum estágio do dia tem preço (não afirma "R$0 gasto").
export function consumoDoDia(agregado, dia, tetoUsd = null) {
  const linhas = agregado.filter((l) => l.dia === dia);
  let custo = null;
  for (const l of linhas) {
    if (l.custo_usd_total != null) custo = (custo ?? 0) + l.custo_usd_total;
  }
  return {
    dia,
    custo_usd: custo,
    teto_usd: tetoUsd,
    resta_usd: custo != null && tetoUsd != null ? tetoUsd - custo : null,
    chamadas: linhas.reduce((s, l) => s + l.chamadas, 0),
  };
}
