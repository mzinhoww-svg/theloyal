// anticopia.ts — crivo anti-cópia + validação da síntese (Deno / edge functions).
//
// ESPELHO EXATO de v2/lib/digest/sintese-clipping.mjs (Node). Os DOIS lados têm
// de concordar nos limiares — o teste de drift `sintese-clipping.edge-drift.test.mjs`
// (Node) lê este arquivo e reprova o CI se as constantes divergirem. Por que existe
// em Deno: a chave do OpenRouter vive só no ambiente das edge functions (não no
// Vault SQL, não em secret do Actions), então a síntese REAL roda aqui — e o crivo
// tem de rodar junto, no mesmo lugar, antes de gravar `news_raw.summary`.
//
// Regra inviolável 2 (nunca copiar texto/título de fonte). Conservador: na dúvida,
// vai para revisão (`summary_review_reason`), nunca publica.

export const LIMIAR_ANTICOPIA = 0.35;   // fração de 4-gramas copiados que reprova
export const MAX_RUN_COPIA = 8;         // ≥8 palavras contíguas idênticas ⇒ cópia (pega a diluição)
export const MAX_PALAVRAS_SINTESE = 45; // 1-2 frases; acima disso a diluição esconde cópia
export const MIN_CHARS_SINTESE = 40;    // corpo mínimo útil

// Emoji/pictográficos proibidos (regra 5). URLs não passam por aqui (síntese é texto).
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}️]/u;
// Urgência artificial (regra 4). Fronteiras Unicode para pegar termos acentuados.
const URGENCY_RE = /(?<![\p{L}\p{N}])(imperd[ií]vel|corra|corre|garanta j[áa]|[úu]ltima chance|milhas gr[áa]tis)(?![\p{L}\p{N}])/iu;
// Dado interno / voz de empresa (regra 1).
const INTERNAL_RE = /\b(CMI|dados?\s+internos?|m[ée]trica\s+interna|base\s+interna|nossos?\s+clientes|nossa\s+base)\b/iu;

function normalizar(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shingles(tokens: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(" "));
  return out;
}

/** Fração dos 4-gramas da síntese que aparecem no texto-fonte (proporção da cópia). */
export function overlapNgram(sintese: string, textoFonte: string, n = 4): number {
  const st = normalizar(sintese).split(" ").filter(Boolean);
  const ft = normalizar(textoFonte).split(" ").filter(Boolean);
  if (st.length === 0) return 0;
  if (st.length < n) {
    const frase = st.join(" ");
    return normalizar(textoFonte).includes(frase) ? 1 : 0;
  }
  const sSh = shingles(st, n);
  const fSet = new Set(shingles(ft, n));
  let hit = 0;
  for (const sh of sSh) if (fSet.has(sh)) hit++;
  return hit / sSh.length;
}

/** Maior nº de palavras contíguas idênticas comuns (pega a cláusula levantada diluída). */
export function maiorRunContiguo(sintese: string, textoFonte: string): number {
  const a = normalizar(sintese).split(" ").filter(Boolean);
  const b = normalizar(textoFonte).split(" ").filter(Boolean);
  if (a.length === 0 || b.length === 0) return 0;
  let best = 0;
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}

/**
 * Validação completa da síntese antes de gravar. Anti-cópia (proporção + trecho
 * contíguo) + guardrails editoriais (emoji/urgência/interno) + tamanho mínimo/máximo.
 * Falha ⇒ { ok:false, motivos } — o chamador NÃO grava summary, grava o motivo em
 * summary_review_reason e a notícia fica para revisão (INV-2).
 */
export function validarSintese(
  sintese: string,
  noticia: { title?: string; content?: string } = {},
  opts: { limiar?: number; n?: number } = {},
): { ok: boolean; motivos: string[] } {
  const limiar = opts.limiar ?? LIMIAR_ANTICOPIA;
  const n = opts.n ?? 4;
  const motivos: string[] = [];
  const s = typeof sintese === "string" ? sintese.trim() : "";
  if (!s) return { ok: false, motivos: ["síntese vazia — nada a publicar"] };
  if (s.length < MIN_CHARS_SINTESE) {
    motivos.push(`síntese curta demais (${s.length} < ${MIN_CHARS_SINTESE} caracteres)`);
  }
  const nPalavras = s.split(/\s+/).filter(Boolean).length;
  if (nPalavras > MAX_PALAVRAS_SINTESE) {
    motivos.push(`síntese longa demais (${nPalavras} > ${MAX_PALAVRAS_SINTESE} palavras) — diluição esconde cópia`);
  }
  const textoFonte = `${noticia?.title ?? ""}\n${noticia?.content ?? ""}`;
  const overlap = overlapNgram(s, textoFonte, n);
  if (overlap >= limiar) {
    motivos.push(`anti-cópia (proporção): overlap ${overlap.toFixed(2)} ≥ ${limiar} (trecho copiado — inviolável 2)`);
  }
  const run = maiorRunContiguo(s, textoFonte);
  if (run >= MAX_RUN_COPIA) {
    motivos.push(`anti-cópia (trecho contíguo): ${run} palavras seguidas idênticas à fonte (≥ ${MAX_RUN_COPIA}) — cláusula levantada`);
  }
  if (EMOJI_RE.test(s)) motivos.push("emoji proibido na síntese");
  if (URGENCY_RE.test(s)) motivos.push("urgência artificial proibida na síntese");
  if (INTERNAL_RE.test(s)) motivos.push("dado interno / voz de empresa proibido na síntese");
  return { ok: motivos.length === 0, motivos };
}

/** Prompt Sage para o LLM escrever a síntese PRÓPRIA (1-2 frases, sem cópia). */
export function montarPromptSintese(
  noticia: { title?: string; content?: string; source?: string } = {},
): { system: string; user: string } {
  const titulo = String(noticia?.title ?? "").slice(0, 300);
  const conteudo = String(noticia?.content ?? "").slice(0, 2000);
  const fonte = String(noticia?.source ?? "");
  const system = [
    "Você é editor da The Loyal, mídia independente e analítica sobre loyalty, pontos, milhas, cartões e varejo. Arquétipo Sage: direto, sóbrio, terceira pessoa — autoridade vem do método, não do tom.",
    'Tarefa: escreva uma SÍNTESE PRÓPRIA de 1 a 2 frases sobre "o que mudou" nesta notícia, com SUAS palavras.',
    "Proibições rígidas: NÃO copie o título nem trechos/cláusulas da fonte (reestruture a frase, troque as palavras, nunca 8 palavras seguidas iguais); NÃO use emoji; NÃO use urgência artificial (imperdível, corra, garanta já, última chance); NÃO prometa ganho; NÃO invente número que não esteja na fonte; NÃO use \"nossos clientes\" nem voz de empresa.",
    'Responda SOMENTE em JSON: {"summary":"<sua síntese própria em 1-2 frases>"}.',
  ].join(" ");
  const user = `Fonte: ${fonte}\nTítulo: ${titulo}\nConteúdo: ${conteudo}`;
  return { system, user };
}
