// Blocos alternativos do "dia fraco" (M2 · Digest Engine, SPEC-SLICE-DIGEST-ENGINE.md
// §2). PUROS, sem I/O, sem chamada de LLM — a autoria de prosa acontece a jusante
// (fora deste módulo); aqui só se decide SE um bloco tem dado real suficiente para
// existir e QUAL dado o alimenta (regra-mãe §2.1: seção sem dado real é OMITIDA,
// nunca parcial/vazia).
import { passaTresPortoes, elegivelDealDesk } from './selecionar.mjs';

// Ordem cravada pelo operador (D-053): Resumo do dia → Clipping → Radar →
// Radar VPM → Sinais rápidos → Loyalty Lab.
export const ordemBlocosDiaFraco = ['resumoDoDia', 'clipping', 'radar', 'radarVpm', 'sinaisRapidos', 'loyaltyLab'];

/**
 * Clipping (§2.3 item 1): piso RÍGIDO de 5 itens — nunca preenche com menos.
 * Filtro de relevância determinístico mínimo: `processed === true` (a
 * deduplicação/relevância real — fetched_at=hoje, dedup por content_hash — é
 * responsabilidade de quem monta `newsRawRows`; este módulo só aplica o piso).
 * @param {object[]} newsRawRows  linhas de `news_raw`
 * @param {{minimo?:number}} opts
 * @returns {{itens:object[], omitido:boolean}}
 */
export function selecionarClipping(newsRawRows = [], { minimo = 5 } = {}) {
  const elegiveis = (newsRawRows || []).filter((r) => r && r.processed === true);
  if (elegiveis.length < minimo) return { itens: [], omitido: true };
  return { itens: elegiveis, omitido: false };
}

/**
 * Radar (`predicoes[]`/`radar.windows[]`, §2.3 item 2): só entram janelas com
 * `confidence` e `basis` reais (nunca "em-formacao" nem projeção sem lastro).
 * @param {object[]} predicoesOuJanelas
 * @returns {{itens:object[], omitido:boolean}}
 */
export function selecionarRadar(predicoesOuJanelas = []) {
  const itens = (predicoesOuJanelas || []).filter((w) => w && w.confidence != null && w.basis != null);
  return { itens, omitido: itens.length === 0 };
}

/**
 * Radar VPM (`shoppingWatch[]`, §2.3 item 3): sem amostra suficiente
 * (`vpmObservado === 'n/c'` ou `sampleN` ausente), o item específico some —
 * não aparece com "n/c" vazio.
 * @param {object[]} shoppingWatchRows
 * @returns {{itens:object[], omitido:boolean}}
 */
export function selecionarRadarVpm(shoppingWatchRows = []) {
  const itens = (shoppingWatchRows || []).filter(
    (s) => s && s.vpmObservado !== 'n/c' && s.sampleN !== undefined && s.sampleN !== null,
  );
  return { itens, omitido: itens.length === 0 };
}

/**
 * Sinais rápidos (§2.3 item 4): passam os 3 portões mas NÃO o corte de Deal
 * Desk — reusa `passaTresPortoes`/`elegivelDealDesk` de selecionar.mjs (não
 * reforquear). O shape de saída NUNCA carrega chip de veredito de Deal Desk
 * (evita o leitor confundir sinal fraco com recomendação, §2.3 item 4).
 * @param {object[]} campaigns
 * @returns {{itens:object[], omitido:boolean}}
 */
export function selecionarSinaisRapidos(campaigns = []) {
  const itens = (campaigns || [])
    .filter((c) => passaTresPortoes(c) && !elegivelDealDesk(c))
    .map((c) => ({
      origem: c.origem_code ?? null,
      destino: c.destino_code ?? null,
      tipo: c.tipo ?? null,
      brutoScore: c.tl_score_bruto,
      motivoNaoQualifica: `veredito bruto "${c.veredito_bruto}" abaixo do corte de Deal Desk (vale-agir/vale-olhar)`,
      // sem campo `veredito`/`verdict`: propositalmente ausente (nunca chip de Deal Desk aqui)
    }));
  return { itens, omitido: itens.length === 0 };
}

// ---------------------------------------------------------------------------
// Loyalty Lab — score de automação (§2.4)
// ---------------------------------------------------------------------------

// Corte de automação (D-053, a decisão nomeada ratificada com a proposta
// default — mais conservador que o 0,75 do gate TIER1/D-048, porque texto
// livre carrega mais risco de soar promessa não verificada que classificação
// objetiva).
export const CORTE_AUTOMACAO_LOYALTY_LAB = 0.85;

/**
 * Score de automação do Loyalty Lab (§2.4). Composição: `ancoragem` (quantas
 * âncoras de dado real o texto cita — contagem, nunca julgamento) + `trackRecord`
 * (fração de resoluções positivas do MESMO tipo de padrão já fechadas no Ledger —
 * §2.4.1; SEM Ledger este componente é sempre 0).
 *
 * Prova algébrica de que `trackRecord=0` NUNCA cruza o corte 0,85, para
 * qualquer `ancoragem` ≥ 0 (mesmo o argumento testado em loop no golden):
 *   score = min(0.5, ancoragem·0.1)·0.3 + trackRecord·0.7
 *   com trackRecord=0 → score = min(0.5, ancoragem·0.1)·0.3
 *   o termo min(...) satura em 0.5 (a partir de ancoragem=5) → score_max = 0.5·0.3 = 0.15
 *   0.15 < 0.85 = CORTE_AUTOMACAO_LOYALTY_LAB, para QUALQUER ancoragem.
 * Isso expressa "sempre humano sem Ledger" como caso-limite da fórmula (D-053
 * §2.4.1), não como exceção hard-coded separada. Quando o Predict Ledger
 * (M4.3) existir e acumular volume, `trackRecord` deixa de ser sempre 0 e o
 * corte passa a ser cruzável (score_max com trackRecord=1 e ancoragem≥5 é
 * exatamente 0,85 — cruza o corte só com track record perfeito E âncoras
 * suficientes).
 * @param {{ancoragem:number, trackRecord?:number}} args
 * @returns {number}  score ∈ [0, 0.85] (dado o cap acima; nunca > 0.85 por construção,
 *   já que os dois termos somados saturam em 0.15+0.7=0.85)
 */
export function scoreAutomacaoLoyaltyLab({ ancoragem, trackRecord = 0 } = {}) {
  const a = Number.isFinite(ancoragem) && ancoragem > 0 ? ancoragem : 0;
  const t = Number.isFinite(trackRecord) ? Math.max(0, Math.min(1, trackRecord)) : 0;
  const termoAncoragem = Math.min(0.5, a * 0.1) * 0.3;
  const termoTrackRecord = t * 0.7;
  return termoAncoragem + termoTrackRecord;
}

/**
 * @param {number} score
 * @returns {boolean}  true ⇒ exige flag de revisão humana registrada (§2.4/§3.3)
 */
export function precisaRevisaoHumana(score) {
  return !(Number.isFinite(score) && score >= CORTE_AUTOMACAO_LOYALTY_LAB);
}
