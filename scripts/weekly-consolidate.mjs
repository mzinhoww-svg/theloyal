// The Loyal — Motor de consolidação Weekly ← Daily (Fase 1).
//
// Lê as edições da Daily de uma semana e produz um RASCUNHO da Weekly
// (content/weekly/AAAA-Wnn.draft.json), consolidando por FIO (thread ancorado
// na identidade canônica entityKey/routeKey — ver docs/design/
// weekly-daily-consolidation.md §3). Deriva movements (integral), candidatos de
// highlights, ordem de ranking e watch, sempre com lineage {edition, deal} até
// a edição de origem.
//
// READ-ONLY nas edições. Separado do render (premissa 4: quem publica ≠ quem
// mede). Determinístico: mesma entrada → mesma saída. A tese, as notas de
// highlight e a aprovação do ranking são preenchidas por humano na curadoria.
//
// Uso: node scripts/weekly-consolidate.mjs --start 2026-07-07 --end 2026-07-13 \
//        [--number 28] [--prev content/weekly/2026-W27.json] [--out content/weekly]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { DISCLAIMER, VERDICTS, entityKeySet, isExpired, loadEntities } from "./lib.mjs";

const EDITIONS_DIR = "content/editions";
const WEEKLY_DIR = "content/weekly";
const FORECAST_PATH = "content/forecast.json";
const DAY_MS = 86_400_000;

// ---------- Identidade do Fio ----------
// Chave estável de agrupamento: rota > entidade > slug da categoria. O deal é
// evidência; o Fio é a unidade de exibição da Weekly.
export function fioKey(deal) {
  if (deal.routeKey) return deal.routeKey;
  if (deal.entityKey) return deal.entityKey;
  return `cat:${slugify(deal.category ?? deal.title ?? "sem-categoria")}`;
}

function slugify(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Sanity-check de data (Passo 4). A ingestão grava vigencia_fim cru do LLM e
// ~77% das transferências têm erro de ~1 ano (docs/auditoria/predict-forecast-
// lineage.md). A Weekly herda esse erro em silêncio. Marca como implausível uma
// data > 1 ano antes do início da janela ou > 2 anos após o fim. Retorna motivo
// ou null. Determinístico (compara strings ISO; não usa relógio).
export function implausibleDate(iso, { windowStart, windowEnd }) {
  const d = String(iso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null; // não-data não é problema deste check
  const yStart = Number(windowStart.slice(0, 4));
  const yEnd = Number(windowEnd.slice(0, 4));
  const y = Number(d.slice(0, 4));
  if (y < yStart - 1) return `data ${d} anterior à janela em mais de 1 ano (erro de ano provável)`;
  if (y > yEnd + 2) return `data ${d} mais de 2 anos após a janela (erro de extração provável)`;
  return null;
}

// R$ de um resultado de conta ("CPM final" / "R$ 12,00 /milheiro") → número.
export function parseBRL(text) {
  const m = String(text ?? "").match(/([\d.]+),(\d{2})/);
  if (!m) return null;
  return Number(`${m[1].replace(/\./g, "")}.${m[2]}`);
}

// ---------- Estado semanal do Fio ----------
// NOVO (abriu) · REABRIU · SEGUE (permanece) · ENCERROU (venceu) · VIROU (mudou
// de status para pior). Deriva de firstSeen (continuidade), vigência e da Weekly
// anterior (para distinguir REABRIU de NOVO).
export function weeklyState(fio, { windowStart, windowEnd, priorKeys = null }) {
  const latest = fio.latestDeal;
  const expired = latest.vigencia ? isExpired(latest.vigencia, `${windowEnd}T23:59:59`) : false;
  const turnedBad = fio.verdictStart && fio.verdictEnd
    && fio.verdictStart !== "evitaria" && fio.verdictEnd === "evitaria";

  if (expired || turnedBad) return turnedBad && !expired ? "VIROU" : "ENCERROU";

  const presentBefore = fio.firstSeen && fio.firstSeen < windowStart;
  const inPrior = priorKeys ? priorKeys.has(fio.key) : null;

  if (!presentBefore) {
    // Não estava antes da semana: NOVO — salvo se a Weekly anterior já o listava
    // (então é SEGUE, mesmo sem firstSeen).
    return inPrior ? "SEGUE" : "NOVO";
  }
  // Já existia antes: SEGUE, ou REABRIU se sumiu na semana anterior.
  if (inPrior === false) return "REABRIU";
  return "SEGUE";
}

// ---------- Agrupamento de deals em Fios ----------
export function buildFios(editions) {
  const map = new Map();
  // Ordena por data para que "latest" seja o último no tempo.
  const sorted = [...editions].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  for (const ed of sorted) {
    (ed.deals ?? []).forEach((deal, i) => {
      const key = fioKey(deal);
      if (!map.has(key)) {
        map.set(key, { key, deals: [], lineage: [] });
      }
      const fio = map.get(key);
      fio.deals.push({ deal, edition: ed.number, date: ed.date, index: i });
      fio.lineage.push({ edition: ed.number, deal: i });
    });
  }
  // Enriquече cada Fio com agregados determinísticos.
  for (const fio of map.values()) {
    const chron = fio.deals; // já cronológico
    const first = chron[0].deal;
    const last = chron[chron.length - 1].deal;
    fio.latestDeal = last;
    fio.latestLineage = { edition: chron[chron.length - 1].edition, deal: chron[chron.length - 1].index };
    fio.category = last.category ?? first.category;
    fio.verdictStart = first.verdict;
    fio.verdictEnd = last.verdict;
    fio.firstSeen = chron.map((d) => d.deal.firstSeen).filter(Boolean).sort()[0] ?? null;
    fio.anchor = last.conta?.result ? last.conta.result.join(" ") : null;
    fio.anchorValue = last.conta?.result ? parseBRL(last.conta.result[1]) : null;
    fio.tlScore = typeof last.tlScore === "number" ? last.tlScore : null;
    fio.tlScoreStart = typeof first.tlScore === "number" ? first.tlScore : null;
    fio.tlScoreEnd = typeof last.tlScore === "number" ? last.tlScore : null;
    fio.tlScoreJump = (typeof last.tlScore === "number" && typeof first.tlScore === "number")
      ? last.tlScore - first.tlScore : 0;
    fio.appearances = chron.length;
    fio.datesSeen = chron.map((d) => d.date);
  }
  // Ordena os Fios por chave para saída estável.
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// ---------- Rótulo humano factual (sem urgência, sem emoji, redação própria) ----------
function labelOf(fio, entityNames) {
  return fio.category ?? entityNames.get(fio.key) ?? fio.key;
}

function isoDate(iso) {
  return String(iso ?? "").slice(0, 10);
}

// Chaves de Fio presentes na Weekly anterior — para distinguir NOVO de REABRIU.
// Funciona tanto no rascunho (`_meta.fios`) quanto no FINAL curado (que perde o
// `_meta`): nesse caso deriva dos blocos (movements/ranking/highlights), onde os
// `fio` continuam presentes. Sem sinal ⇒ null (cai no critério por firstSeen).
export function priorFioKeys(prevWeekly) {
  if (!prevWeekly) return null;
  if (Array.isArray(prevWeekly._meta?.fios) && prevWeekly._meta.fios.length) {
    return new Set(prevWeekly._meta.fios.map((f) => f.key));
  }
  const keys = new Set();
  const mov = prevWeekly.movements ?? {};
  for (const k of ["novas", "seguem", "venceram"]) {
    for (const it of mov[k] ?? []) if (it && typeof it === "object" && it.fio) keys.add(it.fio);
  }
  for (const r of prevWeekly.ranking ?? []) if (r.fio) keys.add(r.fio);
  for (const h of prevWeekly.highlights ?? []) if (h.fio) keys.add(h.fio);
  return keys.size ? keys : null;
}

// ---------- Consolidação (pura) ----------
export function consolidate({ editions, windowStart, windowEnd, number, prevWeekly = null, forecast = null, entityReg = null }) {
  const reg = entityReg ?? loadEntities();
  const entityNames = new Map((reg.entities ?? []).map((e) => [e.key, e.name]));
  const priorKeys = priorFioKeys(prevWeekly);

  const fios = buildFios(editions);
  for (const fio of fios) fio.state = weeklyState(fio, { windowStart, windowEnd, priorKeys });

  // Sanity-check de data (Passo 4): avisa datas implausíveis herdadas da
  // ingestão, por Fio. Não bloqueia (curadoria decide), mas não passa em silêncio.
  const dateWarnings = [];
  for (const fio of fios) {
    for (const [field, iso] of [["firstSeen", fio.firstSeen], ["vigencia", fio.latestDeal.vigencia]]) {
      const why = implausibleDate(iso, { windowStart, windowEnd });
      if (why) dateWarnings.push(`Fio ${fio.key} · ${field}: ${why}`);
    }
  }

  // highlights (candidatos) — SÓ Fios que mudaram de fato (transição de veredito
  // ou salto de score). "Ter âncora" não qualifica: senão todo Fio vira destaque.
  const highlightScore = (fio) => {
    let s = 0;
    if (fio.verdictStart !== fio.verdictEnd) s += 100; // transição pesa mais
    s += Math.abs(fio.tlScoreJump);
    return s;
  };
  const highlights = fios
    .filter((f) => f.verdictEnd !== "nao-confirmado")
    .map((f) => ({ f, s: highlightScore(f) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.f.key.localeCompare(b.f.key))
    .slice(0, 3)
    .map(({ f }) => ({
      fio: f.key,
      title: `(rascunho) ${labelOf(f, entityNames)}`,
      note: f.verdictStart !== f.verdictEnd
        ? `(rascunho) veredito passou de ${VERDICTS[f.verdictStart]?.label ?? f.verdictStart} para ${VERDICTS[f.verdictEnd]?.label ?? f.verdictEnd} na semana. Escrever o porquê.`
        : `(rascunho) o que mudou nesse Fio na semana. Escrever o porquê.`,
      verdict: f.verdictEnd,
      ...(typeof f.tlScore === "number" ? { score: f.tlScore } : {}),
      ...(f.verdictStart !== f.verdictEnd ? { transition: { from: f.verdictStart, to: f.verdictEnd } } : {}),
      lineage: f.latestLineage,
    }));
  const highlightFios = new Set(highlights.map((h) => h.fio));

  // ranking — só Fios elegíveis: vigência não vencida + conta.result numérico +
  // veredito confirmado. Precedência: Fios já em highlights saem do ranking
  // (um Fio, um bloco). Ordena por TL Score desc (chave auditável enquanto o
  // score é digitado), desempate por valor-âncora e por chave.
  const eligible = fios.filter((f) =>
    !highlightFios.has(f.key)
    && f.verdictEnd !== "nao-confirmado"
    && f.latestDeal.vigencia && !isExpired(f.latestDeal.vigencia, `${windowEnd}T23:59:59`)
    && f.anchorValue != null
    && typeof f.tlScore === "number");
  const ranking = eligible
    .sort((a, b) => b.tlScore - a.tlScore || a.anchorValue - b.anchorValue || a.key.localeCompare(b.key))
    .map((f, i) => ({
      rank: i + 1,
      fio: f.key,
      label: labelOf(f, entityNames),
      anchor: f.anchor,
      verdict: f.verdictEnd,
      score: f.tlScore,
      lineage: f.latestLineage,
    }));
  const rankingFios = new Set(ranking.map((r) => r.fio));

  // movements — integral, determinístico. Fios não-confirmados (rumores) ficam
  // só no watch (§10). Precedência: Fios já em highlights/ranking saem de
  // movements (um Fio, um bloco — §4.2). Legado por string não é afetado.
  const movements = { novas: [], seguem: [], venceram: [] };
  for (const fio of fios) {
    if (fio.verdictEnd === "nao-confirmado") continue;
    if (highlightFios.has(fio.key) || rankingFios.has(fio.key)) continue;
    const label = labelOf(fio, entityNames);
    const item = { fio: fio.key, lineage: fio.latestLineage };
    if (fio.state === "NOVO") movements.novas.push({ ...item, text: `${label} — abriu ${isoDate(fio.firstSeen) || "na semana"}.` });
    else if (fio.state === "REABRIU") movements.novas.push({ ...item, text: `${label} — reapareceu após ausência.` });
    else if (fio.state === "SEGUE") movements.seguem.push({ ...item, text: `${label} — segue vigente.` });
    else if (fio.state === "ENCERROU") movements.venceram.push({ ...item, text: `${label} — encerrou (vigência ${isoDate(fio.latestDeal.vigencia)}).` });
    else if (fio.state === "VIROU") movements.venceram.push({ ...item, text: `${label} — mudou de status para Evitaria na semana.` });
  }

  // watch — (a) radar do forecast (confiança >= baixa); (b) rumores em aberto
  // (nao-confirmado); (c) vigências que caem na próxima semana.
  const watch = [];
  const nextWeekEnd = new Date(Date.parse(`${windowEnd}T00:00:00Z`) + 7 * DAY_MS).toISOString().slice(0, 10);
  for (const fio of fios) {
    if (fio.verdictEnd === "nao-confirmado") {
      watch.push(`Confirmar regulamento de ${labelOf(fio, entityNames)} — segue não confirmado.`);
    } else if (fio.latestDeal.vigencia) {
      const v = isoDate(fio.latestDeal.vigencia);
      if (v > windowEnd && v <= nextWeekEnd) watch.push(`Vigência de ${labelOf(fio, entityNames)} encerra em ${v}.`);
    }
  }
  const radarWeekly = Array.isArray(forecast?.digest?.radarWeekly) ? forecast.digest.radarWeekly : [];
  for (const w of radarWeekly) {
    if (["alta", "media", "baixa"].includes(w.confidence)) {
      watch.push(`Radar: janela prevista para ${w.label} (${w.window}) — ${w.confidence}.`);
    }
  }
  if (!watch.length) watch.push("(rascunho) definir o que monitorar na próxima semana.");

  // Fontes: união das fontes das edições, dedup por URL.
  const srcMap = new Map();
  for (const ed of editions) for (const s of ed.sources ?? []) if (s.url && !srcMap.has(s.url)) srcMap.set(s.url, s);
  const sources = [...srcMap.values()];

  // Tema dominante (para rascunho da tese): categoria mais frequente.
  const themeCount = new Map();
  for (const f of fios) {
    const theme = (f.category ?? "").split("·")[0].trim() || f.key;
    themeCount.set(theme, (themeCount.get(theme) ?? 0) + f.appearances);
  }
  const dominantTheme = [...themeCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";

  const isoWeek = isoWeekLabel(windowEnd);
  return {
    number: number ?? 0,
    period: periodPtBr(windowStart, windowEnd),
    dateStart: windowStart,
    dateEnd: windowEnd,
    publishTime: "9H00",
    readingMinutes: 6,
    illustrative: editions.some((e) => e.illustrative),
    slug: `weekly-${isoWeek.toLowerCase()}`,
    signal: `(rascunho) tese da semana — tema dominante: ${dominantTheme}. Escrever a tese.`,
    movements,
    highlights,
    ranking,
    watch,
    sources,
    disclaimer: DISCLAIMER,
    _meta: {
      generatedFrom: editions.map((e) => e.number).sort((a, b) => a - b),
      note: "Rascunho automático (weekly-consolidate). Curadoria: escrever tese, notas de highlight, aprovar ranking, confirmar watch. Remover _meta ao finalizar.",
      ...(dateWarnings.length ? { warnings: dateWarnings } : {}),
      isoWeek,
      fios: fios.map((f) => ({
        key: f.key, state: f.state, verdict: f.verdictEnd,
        ...(typeof f.tlScore === "number" ? { tlScore: f.tlScore } : {}),
        appearances: f.appearances, lineage: f.lineage,
      })),
    },
  };
}

// ---------- Costura de acurácia (Fase 5) ----------
// Exporta, por Fio, a transição verdictStart→verdictEnd da semana + lineage.
// É a ENTRADA FUTURA do motor de medição de acurácia — puro, determinístico e
// SEPARADO do render/publicação (premissa 4: quem publica não é quem mede).
// Nada aqui é importado pelo caminho de publicação (beehiiv-publish/render).
export function weeklySignals({ editions, windowStart, windowEnd, prevWeekly = null }) {
  const priorKeys = priorFioKeys(prevWeekly);
  const fios = buildFios(editions);
  for (const f of fios) f.state = weeklyState(f, { windowStart, windowEnd, priorKeys });
  return {
    isoWeek: isoWeekLabel(windowEnd),
    window: { start: windowStart, end: windowEnd },
    generatedFrom: editions.map((e) => e.number).sort((a, b) => a - b),
    note: "Sinais de acurácia por Fio (verdictStart→verdictEnd). Entrada futura do motor de medição — separado da publicação. Não é veredito.",
    signals: fios.map((f) => ({
      fio: f.key,
      state: f.state,
      verdictStart: f.verdictStart,
      verdictEnd: f.verdictEnd,
      transitioned: f.verdictStart !== f.verdictEnd,
      ...(f.tlScoreStart != null ? { tlScoreStart: f.tlScoreStart } : {}),
      ...(f.tlScoreEnd != null ? { tlScoreEnd: f.tlScoreEnd } : {}),
      vigenciaEnd: f.latestDeal.vigencia ? isoDate(f.latestDeal.vigencia) : null,
      appearances: f.appearances,
      datesSeen: f.datesSeen,
      lineage: f.lineage,
    })),
  };
}

// ---------- Utilidades de data (pt-BR / ISO week) ----------
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function periodPtBr(start, end) {
  const s = new Date(`${start}T00:00:00Z`), e = new Date(`${end}T00:00:00Z`);
  const dS = s.getUTCDate(), dE = e.getUTCDate();
  const mS = MESES[s.getUTCMonth()], mE = MESES[e.getUTCMonth()];
  const y = e.getUTCFullYear();
  if (mS === mE) return `Semana de ${dS} a ${dE} de ${mE} de ${y}`;
  return `Semana de ${dS} de ${mS} a ${dE} de ${mE} de ${y}`;
}
export function isoWeekLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // seg=0
  d.setUTCDate(d.getUTCDate() - day + 3); // quinta da semana ISO
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const ftDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ftDay + 3);
  const week = 1 + Math.round((d - firstThursday) / (7 * DAY_MS));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------- CLI ----------
function loadEditionsInWindow(start, end, dir = EDITIONS_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")))
    .filter((ed) => ed.date >= start && ed.date <= end)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) args[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.start || !args.end) {
    console.error("Uso: node scripts/weekly-consolidate.mjs --start AAAA-MM-DD --end AAAA-MM-DD [--number N] [--prev caminho] [--out dir]");
    process.exit(1);
  }
  const editions = loadEditionsInWindow(args.start, args.end);
  if (!editions.length) { console.error(`[weekly-consolidate] Nenhuma edição em ${args.start}..${args.end}.`); process.exit(1); }
  const prevWeekly = args.prev && existsSync(args.prev) ? JSON.parse(readFileSync(args.prev, "utf8")) : null;
  const forecast = existsSync(FORECAST_PATH) ? safeJson(FORECAST_PATH) : null;
  const draft = consolidate({
    editions,
    windowStart: args.start,
    windowEnd: args.end,
    number: args.number ? Number(args.number) : undefined,
    prevWeekly,
    forecast,
    entityReg: loadEntities(),
  });
  // Sanidade: registro de entidades acessível (aviso, não bloqueia).
  const known = entityKeySet();
  const unknownFios = (draft._meta.fios ?? []).filter((f) => !f.key.startsWith("cat:") && !fioKeyKnown(f.key, known));
  if (unknownFios.length) console.error(`[weekly-consolidate] Aviso: Fios sem entidade no registro: ${unknownFios.map((f) => f.key).join(", ")}`);

  const outDir = args.out || WEEKLY_DIR;
  mkdirSync(outDir, { recursive: true });
  const path = `${outDir}/${draft._meta.isoWeek}.draft.json`;
  writeFileSync(path, JSON.stringify(draft, null, 2) + "\n");
  console.log(`[weekly-consolidate] ${draft._meta.isoWeek}: ${draft._meta.fios.length} Fio(s) de ${editions.length} edição(ões) → ${path}`);
  console.log(`  movements: ${draft.movements.novas.length} novas · ${draft.movements.seguem.length} seguem · ${draft.movements.venceram.length} venceram`);
  console.log(`  highlights(cand.): ${draft.highlights.length} · ranking: ${draft.ranking.length} · watch: ${draft.watch.length}`);
  if (draft._meta.warnings?.length) {
    console.error(`  ⚠ ${draft._meta.warnings.length} aviso(s) de data implausível (erro de ano da ingestão):`);
    draft._meta.warnings.forEach((w) => console.error(`    - ${w}`));
  }

  // Costura de acurácia (Fase 5): sinais por Fio em out/weekly-signals — separado
  // da publicação, entrada futura do motor de medição.
  const signals = weeklySignals({ editions, windowStart: args.start, windowEnd: args.end, prevWeekly });
  const sigDir = "out/weekly-signals";
  mkdirSync(sigDir, { recursive: true });
  const sigPath = `${sigDir}/${signals.isoWeek}.json`;
  writeFileSync(sigPath, JSON.stringify(signals, null, 2) + "\n");
  console.log(`  sinais de acurácia: ${signals.signals.length} Fio(s) → ${sigPath}`);
}

function fioKeyKnown(key, known) {
  if (known.has(key)) return true;
  const parts = key.split("->");
  return parts.every((p) => known.has(p));
}

function safeJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
