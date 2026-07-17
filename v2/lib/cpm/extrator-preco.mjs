// Extrator de preço de milheiro para campanhas de COMPRA de pontos/milhas (M2 · CPM).
// PURO, sem I/O. Em compra de pontos o preço anunciado ("R$X/milheiro") É o CPM
// diretamente: você paga R$X por 1.000 pontos.
//
// INV-16 / INV-03: só afirma um preço quando há evidência textual que o amarra a
// "milheiro" (ou quando o texto é literalmente só o número, i.e. o preço já veio
// isolado). Na dúvida → null. NUNCA chuta um preço. "a partir de" é PISO (piso da
// faixa, não o preço exato de toda ela) e é marcado como tal. "de R$X para R$Y"
// tem o preço final em Y (X é o valor de tabela, descartado).
//
// Fronteira: este módulo PRODUZ cpm_value (R$/milheiro). Quem consome é
// derivacao.mjs (derivarEficiencia). Este arquivo não toca a derivação.

// Janela de proximidade (chars) entre o token "milheiro" e o valor em R$ para
// considerá-los amarrados. Calibrada nos formatos reais do banco (ver .test).
const JANELA = 40;
const JANELA_DEPARA = 60;
const MILHEIRO = 'milheiro';

// Valor em R$: aceita "~" (aproximado), separador de milhar "." e decimal ",".
// Captura só o miolo numérico (não termina em separador).
const MONEY_G = /r\$\s*(~)?\s*(\d[\d.,]*\d|\d)/g;
// "de R$X para R$Y" — queda de preço; o preço vigente é Y.
const DEPARA = /de\s+r\$\s*~?\s*[\d.,]+\s+para\s+r\$\s*(~)?\s*(\d[\d.,]*\d|\d)/;
// Texto que é SÓ o preço já isolado (ex.: campo cpm = "16.84" ou "R$35").
const SO_NUMERO = /^\s*(?:r\$\s*)?~?\s*(\d[\d.,]*\d|\d)\s*(?:\/?\s*milheiro)?\s*$/;
const PARTIR = /a partir d/; // "a partir de/do" → piso

/**
 * Converte um número em grafia BR para Number.
 *  - "30,10"     → 30.10   (vírgula decimal)
 *  - "1.234,56"  → 1234.56 (ponto milhar + vírgula decimal)
 *  - "16.84"     → 16.84   (ponto decimal, forma já-parseada do banco)
 *  - "1.234"     → 1234    (ponto milhar sem decimal: exatamente 3 casas)
 * @param {string} raw
 * @returns {number} NaN se não parseável
 */
export function parsePrecoBR(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim();
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.'); // '.' é milhar, ',' é decimal
  } else if (/^\d+\.\d{3}$/.test(s)) {
    s = s.replace(/\./g, ''); // ex.: "1.234" = milhar, não decimal
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

// Distância (chars) do valor [ini,fim) ao token "milheiro" mais próximo em `t`.
// null se não houver "milheiro" no texto.
function distanciaMilheiro(t, ini, fim) {
  let best = null;
  let i = t.indexOf(MILHEIRO);
  while (i !== -1) {
    const d = i >= fim ? i - fim : ini - (i + MILHEIRO.length);
    const dist = d < 0 ? 0 : d; // sobreposição/adjacência conta como 0
    if (best === null || dist < best) best = dist;
    i = t.indexOf(MILHEIRO, i + 1);
  }
  return best;
}

function resultado(valor, evidencia, extra = {}) {
  if (!Number.isFinite(valor) || valor <= 0) return null;
  // 2 casas: preço de milheiro é sempre em centavos; estabiliza golden.
  const cpm_value = Math.round(valor * 100) / 100;
  return { cpm_value, evidencia: evidencia.trim(), ...extra };
}

/**
 * Extrai o preço do milheiro (= CPM) do texto de uma campanha de compra.
 * @param {string} texto  título/trecho/notes/valor_leitura da campanha
 * @returns {{cpm_value:number, evidencia:string, piso?:boolean, aproximado?:boolean} | null}
 */
export function extrairPrecoMilheiro(texto) {
  if (texto == null) return null;
  const original = String(texto);
  const t = original.toLowerCase(); // dígitos/índices preservados (sem strip de acento)
  if (!t.trim()) return null;

  const temMilheiro = t.includes(MILHEIRO);

  // 1) "de R$X para R$Y" (+ milheiro): o preço vigente é Y. X é tabela → descarta.
  if (temMilheiro) {
    const dp = DEPARA.exec(t);
    if (dp) {
      const ini = dp.index, fim = dp.index + dp[0].length;
      const dist = distanciaMilheiro(t, ini, fim);
      if (dist !== null && dist <= JANELA_DEPARA) {
        const r = resultado(parsePrecoBR(dp[2]), original.slice(ini, fim), dp[1] ? { aproximado: true } : {});
        if (r) return r;
      }
    }
  }

  // 2) primeiro valor em R$ amarrado a "milheiro" (por posição no texto).
  if (temMilheiro) {
    for (const m of t.matchAll(MONEY_G)) {
      const ini = m.index, fim = m.index + m[0].length;
      const dist = distanciaMilheiro(t, ini, fim);
      if (dist === null || dist > JANELA) continue;
      const antes = t.slice(Math.max(0, ini - 32), ini);
      const piso = PARTIR.test(antes);
      const extra = {};
      if (piso) extra.piso = true;
      if (m[1]) extra.aproximado = true;
      // evidência: do início da âncora textual ("a partir de"/"milheiro") até o valor.
      const r = resultado(parsePrecoBR(m[2]), original.slice(Math.max(0, ini - 24), fim), extra);
      if (r) return r;
    }
    return null; // tem "milheiro" mas nenhum R$ amarrado → não inventa
  }

  // 3) texto é SÓ o número (preço já isolado, ex.: campo cpm "16.84" / "R$35").
  //    Contexto de compra é do chamador; o número está literalmente no texto.
  const sn = SO_NUMERO.exec(t);
  if (sn) return resultado(parsePrecoBR(sn[1]), original, {});

  // 4) sem âncora de milheiro e não é número isolado → null (INV-16).
  return null;
}
