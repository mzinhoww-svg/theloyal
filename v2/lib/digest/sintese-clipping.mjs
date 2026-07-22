// sintese-clipping.mjs — anti-cópia + validação da SÍNTESE do Clipping (M2.7).
// PURO, sem I/O, sem LLM. O LLM narra a jusante (scripts/collect/sintese-clipping.mjs);
// aqui só se DECIDE se uma síntese é publicável: redação própria (não cópia da
// fonte), sem emoji/urgência/dado interno, e com corpo mínimo útil.
//
// Por que este módulo existe: `montarClipping` (montar-edicao.mjs) só surfaceliza
// news_raw que JÁ tenham `summary`. O contrato do schema (INV-04) exige que esse
// summary seja síntese PRÓPRIA — "nunca reprodução do texto/título original". Sem
// um crivo determinístico, o LLM poderia devolver um trecho copiado e ele entraria
// como se fosse redação nova (viola a regra inviolável 2). Este crivo roda no
// INGEST, ANTES de o summary ser gravado: síntese que falha nunca vira coluna, logo
// nunca chega ao render nem ao gate. É mais forte que checar no gate.
import { assertEditorialRules } from '../../../scripts/lib.mjs';

// Normalização para comparação de n-gramas: minúsculas, sem acento, pontuação →
// espaço, espaços colapsados. Mesma disciplina do heuristicSame de llm.mjs, para
// que "Bônus" e "bonus" contem como o mesmo token.
function normalizar(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Shingles (n-gramas contíguos de palavras) de uma lista de tokens.
function shingles(tokens, n) {
  const out = [];
  for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(' '));
  return out;
}

/**
 * Fração dos n-gramas (shingles) da SÍNTESE que aparecem no TEXTO-FONTE
 * (título + conteúdo). 1.0 = todos os n-gramas da síntese são cópia literal;
 * ~0 = redação própria. Normalizado (lowercase, sem acento/pontuação).
 *
 * n=4 (default): quatro palavras contíguas idênticas já são forte evidência de
 * cópia. Unigramas/bigramas são dominados por palavras comuns ("de pontos",
 * "na transferência") e disparariam falso-positivo em paráfrase honesta; 4-gramas
 * só coincidem quando há um TRECHO levantado da fonte.
 *
 * @param {string} sintese
 * @param {string} textoFonte  título + conteúdo da notícia
 * @param {{n?:number}} opts
 * @returns {number}  fração ∈ [0,1]
 */
export function overlapNgram(sintese, textoFonte, { n = 4 } = {}) {
  const st = normalizar(sintese).split(' ').filter(Boolean);
  const ft = normalizar(textoFonte).split(' ').filter(Boolean);
  if (st.length === 0) return 0;
  // Síntese curta demais para formar um n-grama: cai para verificação de frase
  // inteira (uma síntese de 3 palavras copiada da fonte ainda é cópia).
  if (st.length < n) {
    const frase = st.join(' ');
    return normalizar(textoFonte).includes(frase) ? 1 : 0;
  }
  const sShingles = shingles(st, n);
  const fSet = new Set(shingles(ft, n));
  let hit = 0;
  for (const sh of sShingles) if (fSet.has(sh)) hit++;
  return hit / sShingles.length;
}

// Limiar do anti-cópia (fração de 4-gramas). Abaixo dele = redação própria; igual
// ou acima = trecho copiado. 0,35 com 4-gramas: paráfrase legítima só compartilha
// 4-gramas em nomes próprios/termos técnicos inevitáveis (fica bem abaixo de 0,35);
// um resumo majoritariamente levantado dispara para perto de 1,0.
//
// FRAQUEZA CONHECIDA (falso-negativo por DILUIÇÃO) — por isso o run contíguo abaixo:
// a FRAÇÃO cai quando a cópia é cercada de texto próprio. 15 palavras copiadas num
// resumo de 62 → só ~12 4-gramas coincidem de ~59 → fração 0,20 < 0,35 → passaria.
// Mas 15 palavras contíguas idênticas à fonte É cópia (inviolável 2). A fração mede
// PROPORÇÃO; o run mede o MAIOR TRECHO literal. Os dois juntos: proporção alta (copiou
// muito) OU um trecho longo (levantou uma cláusula) já reprova. Conservador por design.
export const LIMIAR_ANTICOPIA = 0.35;

// Maior sequência de palavras CONTÍGUAS idênticas entre síntese e fonte que ainda
// conta como cópia. ≥ 8 palavras seguidas iguais = cláusula levantada literalmente —
// reprova mesmo que a fração de 4-gramas fique baixa (o caso da diluição). 8 é o
// piso: paráfrase honesta raramente repete 8 palavras seguidas da fonte sem reescrever.
export const MAX_RUN_COPIA = 8;

// Teto de tamanho: síntese é 1-2 frases ("o que mudou"). Acima de ~45 palavras deixou
// de ser síntese e virou paráfrase longa (onde a diluição esconde cópia) — vira revisão.
export const MAX_PALAVRAS_SINTESE = 45;

// Corpo mínimo útil: uma síntese real de "o que mudou" tem pelo menos uma frase.
// Abaixo disso não informa nada — vira revisão (nunca preenche o Clipping com casca).
export const MIN_CHARS_SINTESE = 40;

/**
 * Maior nº de palavras CONTÍGUAS idênticas compartilhadas entre a síntese e o
 * texto-fonte (substring comum máxima em nível de palavra, normalizada). Pega a
 * cláusula levantada que a fração de 4-gramas dilui. O(|síntese|·|fonte|) — barato
 * porque a síntese é curta (≤ ~45 palavras).
 * @param {string} sintese
 * @param {string} textoFonte
 * @returns {number} tamanho do maior trecho literal comum, em palavras
 */
export function maiorRunContiguo(sintese, textoFonte) {
  const a = normalizar(sintese).split(' ').filter(Boolean);
  const b = normalizar(textoFonte).split(' ').filter(Boolean);
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
 * true ⇒ a síntese é redação própria (overlap ABAIXO do limiar). Overlap alto =
 * trecho copiado ⇒ false (não passa).
 * @param {string} sintese
 * @param {string} textoFonte
 * @param {{limiar?:number, n?:number}} opts
 * @returns {boolean}
 */
export function passaAntiCopia(sintese, textoFonte, { limiar = LIMIAR_ANTICOPIA, n = 4 } = {}) {
  return overlapNgram(sintese, textoFonte, { n }) < limiar;
}

/**
 * Validação completa da síntese antes de gravar. Reúne: anti-cópia (inviolável 2)
 * + guardrails editoriais reusando `assertEditorialRules` (emoji/urgência/interno,
 * regras 1/4/5) + corpo mínimo. Falha ⇒ `ok:false` com os motivos; o chamador NÃO
 * grava o summary e manda a notícia para revisão (nunca publica).
 *
 * @param {string} sintese
 * @param {{title?:string, content?:string}} noticia  fonte (título + conteúdo)
 * @param {{limiar?:number, n?:number}} opts
 * @returns {{ok:boolean, motivos:string[]}}
 */
export function validarSintese(sintese, noticia = {}, { limiar = LIMIAR_ANTICOPIA, n = 4 } = {}) {
  const motivos = [];
  const s = typeof sintese === 'string' ? sintese.trim() : '';
  if (!s) return { ok: false, motivos: ['síntese vazia — nada a publicar'] };
  if (s.length < MIN_CHARS_SINTESE) {
    motivos.push(`síntese curta demais (${s.length} < ${MIN_CHARS_SINTESE} caracteres) — não informa "o que mudou"`);
  }

  const nPalavras = s.split(/\s+/).filter(Boolean).length;
  if (nPalavras > MAX_PALAVRAS_SINTESE) {
    motivos.push(`síntese longa demais (${nPalavras} > ${MAX_PALAVRAS_SINTESE} palavras) — 1-2 frases; acima disso deixa de ser síntese e a diluição esconde cópia`);
  }

  const textoFonte = `${noticia?.title ?? ''}\n${noticia?.content ?? ''}`;
  const overlap = overlapNgram(s, textoFonte, { n });
  if (overlap >= limiar) {
    motivos.push(`anti-cópia (proporção): overlap de ${overlap.toFixed(2)} ≥ ${limiar} (trecho copiado da fonte — viola a regra inviolável 2, redação sempre própria)`);
  }
  // Backstop contra o falso-negativo por diluição: um trecho longo levantado
  // literalmente é cópia mesmo com fração baixa.
  const run = maiorRunContiguo(s, textoFonte);
  if (run >= MAX_RUN_COPIA) {
    motivos.push(`anti-cópia (trecho contíguo): ${run} palavras seguidas idênticas à fonte (≥ ${MAX_RUN_COPIA}) — cláusula levantada, mesmo diluída num texto próprio (inviolável 2)`);
  }

  // Guardrails de string reusados da fonte única (não reforquear regex). Sem
  // `disclaimer` no options → o check de disclaimer é pulado (síntese de Clipping
  // não carrega disclaimer; ele vive no rodapé da edição).
  const { errors } = assertEditorialRules(s, { label: 'síntese do Clipping' });
  for (const e of errors) motivos.push(e);

  return { ok: motivos.length === 0, motivos };
}

/**
 * Prompt que instrui o LLM a escrever a síntese PRÓPRIA. Determinístico e puro
 * (o não-determinismo vive no backend). Devolve { system, user } no formato que
 * `chatJson` (llm.mjs) consome. O LLM só NARRA "o que mudou" — não calcula número,
 * não decide o que é oferta, não classifica veredito (INV-12: seleção é
 * determinística; o LLM sintetiza).
 *
 * @param {{title?:string, content?:string, source?:string}} noticia
 * @returns {{system:string, user:string}}
 */
export function montarPromptSintese(noticia = {}) {
  const titulo = String(noticia?.title ?? '').slice(0, 300);
  const conteudo = String(noticia?.content ?? '').slice(0, 2000);
  const fonte = String(noticia?.source ?? '');
  const system = [
    'Você é editor da The Loyal, mídia independente e analítica sobre loyalty, pontos, milhas, cartões e varejo. Arquétipo Sage: direto, sóbrio, terceira pessoa — autoridade vem do método, não do tom.',
    'Tarefa: escreva uma SÍNTESE PRÓPRIA de 1 a 2 frases sobre "o que mudou" nesta notícia, com SUAS palavras.',
    'Proibições rígidas: NÃO copie o título nem trechos/cláusulas da fonte (reestruture a frase, troque as palavras); NÃO use emoji; NÃO use urgência artificial (imperdível, corra, garanta já, última chance); NÃO prometa ganho; NÃO invente número que não esteja na fonte; NÃO use "nossos clientes" nem voz de empresa.',
    'Responda SOMENTE em JSON: {"summary":"<sua síntese própria em 1-2 frases>"}.',
  ].join(' ');
  const user = `Fonte: ${fonte}\nTítulo: ${titulo}\nConteúdo: ${conteudo}`;
  return { system, user };
}
