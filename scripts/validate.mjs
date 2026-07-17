// Validação editorial: aplica as regras invioláveis e os checklists de QA do
// Operating Manual (fonte, cálculo, vigência, vocabulário) e gera um QA report.
// Uso: node scripts/validate.mjs [caminho-da-edicao.json]
import { mkdirSync, writeFileSync } from "node:fs";
import {
  VERDICTS, TL_WEIGHTS, assertEditorialRules,
  editionSlug, entityKeySet, isExpired, isValidLink, listEditionFiles,
  loadEdition, parseRouteKey, verdictForScore,
} from "./lib.mjs";

const REQUIRED = ["number", "date", "weekday", "publishTime", "readingMinutes", "signal", "deals", "sources", "disclaimer"];
// Blocos obrigatórios da estrutura editorial (não só campos escalares).
// `deals` NÃO entra aqui: dia fraco (deals:[]) é estado de primeira classe
// (D-044/D-050/D-053) — vazio é avisado (linha ~48), nunca erro de bloco ausente.
const REQUIRED_BLOCKS = ["signal", "sources", "disclaimer"];
const DEAL_REQUIRED = ["category", "title", "context", "conta", "verdict", "source"];

export function validateEdition(ed, opts = {}) {
  const errors = [];
  const warnings = [];
  const ok = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  const pass = (m) => ok.push(m);
  // Identidade canônica (Fase 0): conjunto de entity keys conhecidas. Injetável
  // em teste; por padrão lê content/entities/index.json.
  const knownEntities = opts.entityKeys ?? entityKeySet();

  // 1. Campos obrigatórios da estrutura do Daily.
  const missing = REQUIRED.filter((k) => ed[k] === undefined || ed[k] === null || ed[k] === "");
  if (missing.length) err(`Campos obrigatórios ausentes: ${missing.join(", ")}`);
  else pass("Estrutura do Daily completa (todos os campos obrigatórios presentes)");

  // 2–4b. Regras invioláveis de string (disclaimer, emoji, urgência, dado
  // interno/CMI) — fonte única em lib.mjs, partilhada com Weekly e Pro.
  const gate = assertEditorialRules(ed, { label: "corpo editorial", disclaimer: ed.disclaimer, disclaimerMode: "includes" });
  gate.errors.forEach(err);
  gate.ok.forEach(pass);

  // 4c. Blocos obrigatórios presentes e não-vazios.
  const emptyBlocks = REQUIRED_BLOCKS.filter((b) => {
    const v = ed[b];
    return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  });
  if (emptyBlocks.length) err(`Blocos obrigatórios ausentes ou vazios: ${emptyBlocks.join(", ")}`);
  else pass("Blocos obrigatórios presentes (sinal, Deal Desk, fontes, disclaimer)");

  // 5. Deal Desk: fonte, vigência, cálculo, TL Score ↔ veredito.
  const deals = Array.isArray(ed.deals) ? ed.deals : [];
  if (!deals.length) warn("Deal Desk vazio: nenhuma oportunidade na edição");
  deals.forEach((d, i) => {
    const tag = `Deal ${i + 1} (${d.title ?? "sem título"})`;

    // Estrutura do bloco: todos os campos obrigatórios do deal.
    const dealMissing = DEAL_REQUIRED.filter((k) => d[k] === undefined || d[k] === null || d[k] === "");
    if (dealMissing.length) err(`${tag}: campos obrigatórios ausentes: ${dealMissing.join(", ")}`);

    // Identidade canônica (Fase 0 — contrato de dados p/ consolidação Weekly).
    // entityKey ausente ⇒ aviso (não rastreável), não erro (edições legadas ok).
    if (d.entityKey !== undefined) {
      if (!knownEntities.has(d.entityKey)) err(`${tag}: entityKey "${d.entityKey}" não existe em content/entities`);
    } else {
      warn(`${tag}: sem entityKey — não será rastreável na consolidação Weekly`);
    }
    if (d.routeKey !== undefined) {
      const parts = parseRouteKey(d.routeKey);
      if (!parts) err(`${tag}: routeKey "${d.routeKey}" fora do formato origem->destino`);
      else {
        if (!knownEntities.has(parts.origem)) warn(`${tag}: origem "${parts.origem}" do routeKey não está em content/entities`);
        if (!knownEntities.has(parts.destino)) warn(`${tag}: destino "${parts.destino}" do routeKey não está em content/entities`);
      }
    }
    if (d.firstSeen !== undefined && Number.isNaN(Date.parse(d.firstSeen))) {
      err(`${tag}: firstSeen "${d.firstSeen}" inválido (ISO date)`);
    }

    if (!d.source) err(`${tag}: sem fonte — sem fonte confiável não entra no Deal Desk (overrule)`);
    // Integridade do Conta Block: linhas + resultado completo.
    if (!d.conta || !Array.isArray(d.conta.rows) || d.conta.rows.length === 0) err(`${tag}: Conta Block sem linhas de cálculo`);
    if (!d.conta || !d.conta.result || !d.conta.result[1]) err(`${tag}: Conta Block incompleto (falta o resultado)`);
    if (!(d.verdict in VERDICTS)) { err(`${tag}: veredito "${d.verdict}" fora do vocabulário oficial`); return; }

    // Link da fonte do deal (quando presente) deve ser http(s) válido; https recomendado.
    if (d.sourceUrl !== undefined) {
      if (!/^https?:\/\//.test(d.sourceUrl)) err(`${tag}: sourceUrl inválida (deve ser http(s) absoluta)`);
      else if (!isValidLink(d.sourceUrl)) warn(`${tag}: sourceUrl não usa https`);
    }

    const hasVigencia = Boolean(d.vigencia);

    // Overrule Operating Manual 5.4: sem vigência confirmada → Não confirmado.
    if (!hasVigencia && d.verdict !== "nao-confirmado") {
      err(`${tag}: sem vigência confirmada, o veredito final deve ser "nao-confirmado" (overrule 5.4)`);
    }

    // Vigência já vencida em relação à data da edição → o deal não está mais vivo.
    if (hasVigencia && ed.date && isExpired(d.vigencia, ed.date)) {
      err(`${tag}: vigência (${d.vigencia}) já vencida na data da edição (${ed.date})`);
    }

    if (d.verdict === "nao-confirmado") {
      pass(`${tag}: Não confirmado — consistente`);
      return;
    }

    if (typeof d.tlScore !== "number" || d.tlScore < 0 || d.tlScore > 100) {
      err(`${tag}: TL Score ausente ou fora de 0–100`);
    } else {
      const expected = verdictForScore(d.tlScore);
      if (expected !== d.verdict) err(`${tag}: TL Score ${d.tlScore} mapeia para "${expected}", mas o veredito é "${d.verdict}"`);
      else pass(`${tag}: TL Score ${d.tlScore} ↔ ${VERDICTS[d.verdict].label} coerente`);
    }

    // Se houver breakdown dos 8 critérios, a soma ponderada tem de fechar.
    if (d.scoreBreakdown) {
      const sum = Object.entries(TL_WEIGHTS).reduce((acc, [k, w]) => acc + (Number(d.scoreBreakdown[k] ?? 0) / 100) * w, 0);
      if (Math.round(sum) !== d.tlScore) err(`${tag}: soma ponderada do breakdown (${Math.round(sum)}) ≠ TL Score declarado (${d.tlScore})`);
      else pass(`${tag}: breakdown fecha com o TL Score (conta feita)`);
    }
  });

  // 6. Fontes com URL.
  const sources = Array.isArray(ed.sources) ? ed.sources : [];
  if (!sources.length) err("Nenhuma fonte listada na edição");
  sources.forEach((s, i) => {
    if (!s.label) warn(`Fonte ${i + 1}: sem rótulo`);
    if (!/^https?:\/\//.test(s.url ?? "")) err(`Fonte ${i + 1}: URL inválida ou ausente`);
    else if (!isValidLink(s.url)) warn(`Fonte ${i + 1}: URL não usa https`);
  });
  if (sources.every((s) => /^https?:\/\//.test(s.url ?? "")) && sources.length) pass("Todas as fontes têm URL válida");

  // Radar de janelas (quando presente): projeção, nunca veredito. Estrutura e
  // confiança dentro do vocabulário. Nunca pode conter "em-formacao" (regra 9:
  // sem base não vira linha de radar).
  if (ed.radar !== undefined) {
    const windows = Array.isArray(ed.radar.windows) ? ed.radar.windows : null;
    if (!windows || !windows.length) err("Radar presente mas sem janelas (windows vazio)");
    else {
      windows.forEach((w, i) => {
        const tag = `Radar ${i + 1} (${w.label ?? "sem rótulo"})`;
        if (!w.label) err(`${tag}: sem rótulo (label)`);
        if (!w.window) err(`${tag}: sem janela prevista (window)`);
        if (!["alta", "media", "baixa"].includes(w.confidence))
          err(`${tag}: confiança "${w.confidence}" fora de alta|media|baixa (em-formacao nunca vira radar)`);
      });
      if (windows.every((w) => w.label && w.window && ["alta", "media", "baixa"].includes(w.confidence)))
        pass(`Radar de janelas coerente (${windows.length} projeção(ões), sem veredito)`);
    }
  }

  // Vigência dos itens "Fecha logo" (quando presente): não pode estar vencida.
  // v4 (D-059): `url` opcional, mas quando presente deve ser http(s) absoluta.
  (Array.isArray(ed.fechaLogo) ? ed.fechaLogo : []).forEach((f, i) => {
    if (f.vigencia && ed.date && isExpired(f.vigencia, ed.date)) {
      err(`Fecha logo ${i + 1} (${f.tag ?? "sem tag"}): vigência (${f.vigencia}) já vencida na data da edição`);
    }
    if (f.url !== undefined && !/^https?:\/\//.test(f.url)) {
      err(`Fecha logo ${i + 1} (${f.tag ?? "sem tag"}): url inválida (deve ser http(s) absoluta)`);
    }
  });

  // v4 (D-059): item não confirmado nunca é citado sem fonte linkada.
  const radarSemConfirmacao = Array.isArray(ed.radarSemConfirmacao) ? ed.radarSemConfirmacao : [];
  radarSemConfirmacao.forEach((r, i) => {
    const tag = `Radar sem confirmação ${i + 1} (${r.titulo ?? "sem título"})`;
    if (!/^https?:\/\//.test(r.url ?? "")) err(`${tag}: url inválida ou ausente (obrigatória — guardrail D-059)`);
    if (!r.fonte) err(`${tag}: fonte ausente (obrigatória — guardrail D-059)`);
  });
  if (radarSemConfirmacao.length) pass(`Radar sem confirmação: ${radarSemConfirmacao.length} item(ns) com fonte exigida`);

  // v4 (D-059): Cartões e bancos por item — mesma exigência de fonte.
  const cartoesBancosItens = Array.isArray(ed.cartoesBancosItens) ? ed.cartoesBancosItens : [];
  cartoesBancosItens.forEach((c, i) => {
    const tag = `Cartões e bancos ${i + 1} (${c.nome ?? "sem nome"})`;
    if (!/^https?:\/\//.test(c.url ?? "")) err(`${tag}: url inválida ou ausente (obrigatória — guardrail D-059)`);
    if (!c.fonte) err(`${tag}: fonte ausente (obrigatória — guardrail D-059)`);
  });
  if (cartoesBancosItens.length) pass(`Cartões e bancos: ${cartoesBancosItens.length} item(ns) com fonte exigida`);

  // v4 (D-059 §3): narrativa do Predict — probabilidade no vocabulário fixo,
  // texto presente. (A recomputação exata do texto é papel do gate 5.5.)
  if (ed.predictNarrativa !== undefined) {
    const pn = ed.predictNarrativa;
    if (!["baixa", "media", "alta", "em-formacao"].includes(pn.probabilidade)) {
      err(`Predict narrativa: probabilidade "${pn.probabilidade}" fora de baixa|media|alta|em-formacao`);
    }
    if (!pn.texto) err("Predict narrativa: texto ausente");
    else pass("Predict narrativa presente com probabilidade visível");
  }

  // Shopping · VPM observado (opcional): dado público, com fonte, framing "observado".
  const shopping = Array.isArray(ed.shoppingWatch) ? ed.shoppingWatch : [];
  shopping.forEach((s, i) => {
    const tag = `Shopping ${i + 1} (${s.player ?? "sem player"})`;
    const req = ["player", "category", "vpmObservado", "source"].filter((k) => !s[k]);
    if (req.length) err(`${tag}: campos obrigatórios ausentes: ${req.join(", ")}`);
    if (s.sourceUrl !== undefined && !/^https?:\/\//.test(s.sourceUrl)) err(`${tag}: sourceUrl inválida (http(s) absoluta)`);
    else if (s.sourceUrl !== undefined && !isValidLink(s.sourceUrl)) warn(`${tag}: sourceUrl não usa https`);
  });
  if (shopping.length) pass(`Shopping · VPM observado: ${shopping.length} leitura(s) de catálogo público`);

  return { errors, warnings, ok };
}

// Contenção Fase C0 — impede que o Radar manual do Daily contradiga a fonte
// automática (content/forecast.json), repetindo a divergência Daily×Weekly já
// identificada. Determinístico e puro (recebe o artefato explicitamente).
//
// Regra: uma janela de radar é "automática" quando declara proveniência
// (source:"forecast" ou seriesKey/generatedAt). Nesse caso ela DEVE bater com o
// forecast (senão é ERRO que bloqueia). Sem proveniência, é tratada como
// "análise editorial" — nunca apresentada como previsão automática — e uma
// divergência com o arquivo vira AVISO (não bloqueia edições legadas).
const normLabel = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function validateRadarConsistency(ed, forecastArtifact) {
  const errors = [];
  const warnings = [];
  const windows = Array.isArray(ed?.radar?.windows) ? ed.radar.windows : null;
  if (!windows || !windows.length) return { errors, warnings };

  const radarDaily = Array.isArray(forecastArtifact?.digest?.radarDaily) ? forecastArtifact.digest.radarDaily : [];
  const byLabel = new Map(radarDaily.map((w) => [normLabel(w.label), w]));

  windows.forEach((w, i) => {
    const tag = `Radar ${i + 1} (${w.label ?? "sem rótulo"})`;
    const isAutomatic = w.source === "forecast" || w.seriesKey != null || w.generatedAt != null;
    const match = byLabel.get(normLabel(w.label));

    if (isAutomatic) {
      if (!match) {
        errors.push(`${tag}: marcado como automático (source:forecast) mas a série não está no forecast atual (bloqueada ou ausente) — não pode ser publicado como previsão automática`);
        return;
      }
      if (String(match.window) !== String(w.window))
        errors.push(`${tag}: janela "${w.window}" diverge do forecast automático ("${match.window}")`);
      if (w.bonus != null && match.bonus != null && String(w.bonus) !== String(match.bonus))
        errors.push(`${tag}: bônus "${w.bonus}" diverge do forecast automático ("${match.bonus}")`);
    } else if (match && String(match.window) !== String(w.window)) {
      warnings.push(`${tag}: radar editorial diverge do forecast automático (arquivo: "${match.window}") — marque como "Análise editorial" ou alinhe ao motor`);
    } else {
      warnings.push(`${tag}: radar manual sem proveniência (source/seriesKey) — tratado como análise editorial, não como previsão automática`);
    }
  });

  return { errors, warnings };
}

export function report(ed, result) {
  const slug = editionSlug(ed);
  const status = result.errors.length ? "FALHOU" : "APROVADA";
  const lines = [];
  lines.push(`# QA report — Edição Nº ${ed.number} (${ed.date})`);
  lines.push("");
  lines.push(`**Status:** ${status} · ${result.errors.length} erro(s), ${result.warnings.length} aviso(s)`);
  if (ed.illustrative) lines.push("", "> Edição ilustrativa. Números de exemplo.");
  lines.push("", "## Conformidade", "");
  result.ok.forEach((m) => lines.push(`- [x] ${m}`));
  if (result.warnings.length) {
    lines.push("", "## Avisos", "");
    result.warnings.forEach((m) => lines.push(`- [!] ${m}`));
  }
  if (result.errors.length) {
    lines.push("", "## Erros (bloqueiam a publicação)", "");
    result.errors.forEach((m) => lines.push(`- [ ] ${m}`));
  }
  lines.push("");
  const md = lines.join("\n");
  mkdirSync("out/qa", { recursive: true });
  writeFileSync(`out/qa/${slug}.md`, md);
  return md;
}

function main() {
  const arg = process.argv[2];
  const files = arg ? [arg] : listEditionFiles().map((f) => `content/editions/${f}`);
  if (!files.length) { console.error("Nenhuma edição encontrada em content/editions/."); process.exit(1); }
  let failed = false;
  for (const path of files) {
    const ed = loadEdition(path);
    const result = validateEdition(ed);
    report(ed, result);
    const status = result.errors.length ? "FALHOU" : "OK";
    console.log(`[validate] Nº ${ed.number}: ${status} — ${result.errors.length} erro(s), ${result.warnings.length} aviso(s) → out/qa/${String(ed.number).padStart(4, "0")}.md`);
    result.errors.forEach((m) => console.log(`  ✗ ${m}`));
    if (result.errors.length) failed = true;
  }
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
