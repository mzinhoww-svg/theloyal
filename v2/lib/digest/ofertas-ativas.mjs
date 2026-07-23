// Ofertas ativas + Cartões & bancos (M2 · Digest Engine v3, SPEC-SLICE-DIGEST-ENGINE.md
// §1.1/§1.4, D-057). PUROS, sem I/O — recebem linhas já lidas de `campaigns`. Mesma
// disciplina de determinismo-primeiro (INV-12) e regra-mãe (seção sem dado real é
// OMITIDA, nunca vazia/parcial) dos demais seletores de v2/lib/digest.
import { TRES_PORTOES } from './selecionar.mjs';
import { mapVeredito } from './mapear-contrato.mjs';

// Categorias de triagem (Trilha B, campanha_versoes evento=triagem_backlog_m3) que
// autorizam um item a aparecer numa TABELA DE TRANSPARÊNCIA pública (Ofertas ativas
// / vw_ofertas_vivas C3). `revisao` (bônus alto não confirmado) e não-triado ficam
// de fora — INV-03. É o MESMO critério da view pública 017.
export const TRIAGENS_TRANSPARENCIA = Object.freeze(['limpo', 'historico_confirmado']);

/**
 * O item foi TRIADO como publicável (limpo/historico_confirmado)? Diferente de
 * tem_tier1 (lastro de confirmação oficial em campanha_fontes): a triagem é o
 * crivo editorial da Trilha B; o lastro é a confirmação de fonte (D-048).
 * @param {object} campaign  linha de `campaigns` com `triagem_categoria` derivado pelo runner
 * @returns {boolean}
 */
export function triadaParaTransparencia(campaign) {
  return TRIAGENS_TRANSPARENCIA.includes(campaign?.triagem_categoria);
}

/**
 * Elegível à tabela OFERTAS ATIVAS (transparência) — DESACOPLADO do lastro de
 * tier1 (C1/D-082): o lastro gateia SÓ o Deal Desk (recomendação), NUNCA a tabela
 * de transparência. Aqui: estado vivo + conta computável + triada (limpo/
 * historico_confirmado) + não é clipping-only. Item sem lastro entra com selo
 * 'Não confirmado' (ver `leituraOfertaAtiva`), nunca some (INV-03: mostra o dado,
 * marca a incerteza).
 * @param {object} campaign
 * @returns {boolean}
 */
export function elegivelOfertaAtiva(campaign) {
  if (!campaign) return false;
  if (ehClippingOnly(campaign)) return false;
  const vivo = TRES_PORTOES.estadosVivo.includes(campaign.estado);
  const contaComputavel = campaign.tl_score_bruto !== null && campaign.tl_score_bruto !== undefined;
  return vivo && contaComputavel && triadaParaTransparencia(campaign);
}

/**
 * Leitura (selo) da oferta ativa: item COM lastro de tier1 mostra seu veredito
 * real; item SEM lastro entra como 'nao-confirmado' (INV-03 — o dado aparece na
 * transparência, mas sem carimbar recomendação que não foi confirmada por fonte).
 * @param {object} campaign
 * @returns {string}  chave kebab do $defs/verdict
 */
export function leituraOfertaAtiva(campaign) {
  if (campaign?.tem_tier1 !== true) return 'nao-confirmado';
  try { return mapVeredito(campaign.veredito_bruto); } catch { return 'nao-confirmado'; }
}

// Lista curada de `origem_code` de bancos (D-057 decisão 3) — extensível, não
// fechada. Mesmo padrão de constante nomeada/versionada de `CRAWLAVEIS`/
// `ESTADOS_VIVO` já usado no projeto (SPEC-SLICE-DIGEST-ENGINE.md v3 §1.4).
export const BANCOS_ORIGEM = [
  'itau', 'inter', 'c6', 'bradesco', 'banco_do_brasil', 'nubank',
  'caixa', 'brb', 'santander', 'btg', 'xp', 'picpay',
];

/**
 * A8 (D-061.2): decisão editorial do operador de que um item só pode aparecer no
 * CLIPPING (ex.: cashback de IOF da Caixa — tarifa, não bônus). O campo `used_in`
 * marca isso, mas ninguém o lia → a montagem automática reverteria a decisão. Aqui
 * está o único leitor determinístico. NORMALIZA a forma (o campo aparece como
 * array `['clipping_only']` OU objeto `{pro,daily,weekly,clipping_only}`):
 *   - array  → inclui a string 'clipping_only';
 *   - objeto → chave `clipping_only` truthy.
 * Qualquer outra forma/ausência → false (default: não é clipping-only).
 * @param {object} campaign  linha de `campaigns` (com `used_in`)
 * @returns {boolean}
 */
export function ehClippingOnly(campaign) {
  const u = campaign?.used_in;
  if (!u) return false;
  if (Array.isArray(u)) return u.includes('clipping_only');
  if (typeof u === 'object') return Boolean(u.clipping_only);
  return false;
}

/**
 * Ofertas ativas (§1.1) — TABELA DE TRANSPARÊNCIA, não recomendação. TODO item
 * vivo, com conta computável e TRIADO (limpo/historico_confirmado), DESACOPLADO do
 * lastro de tier1 (EPSILON/D-086): o lastro gateia SÓ o Deal Desk. Item sem lastro
 * entra com selo 'nao-confirmado' (INV-03: mostra o dado, marca a incerteza) — via
 * `leituraOfertaAtiva`. `leitura` reusa o vocabulário canônico kebab do
 * `$defs/verdict` (D-057 decisão 1); o renderer traduz para o rótulo em português.
 * @param {object[]} campaigns  linhas de `campaigns` (com `triagem_categoria` e `tem_tier1` derivados pelo runner)
 * @returns {{itens:object[], omitido:boolean}}
 */
export function selecionarOfertasAtivas(campaigns = []) {
  const itens = (campaigns || [])
    .filter(elegivelOfertaAtiva) // triagem (não lastro-tier1) + vivo + conta; A8 clipping-only já excluído
    .map((c) => ({
      origem: c.origem_code ?? null,
      destino: c.destino_code ?? null,
      tipo: c.tipo ?? null,
      percentual: c.percentual ?? null,
      prazo: c.vigencia_fim ?? null, // null = vigência indeterminada ("sem data" no render)
      leitura: leituraOfertaAtiva(c), // selo 'nao-confirmado' quando sem lastro de tier1 (INV-03)
    }));
  return { itens, omitido: itens.length === 0 };
}

/**
 * Cartões & bancos (§1.4): fonte de dado para a prosa evergreen redigida a
 * jusante (mesma disciplina de `resumoDoDia` — este módulo só seleciona os
 * itens que embasam o texto, não escreve o texto). Filtro (D-057 decisão 2):
 * estado vivo AND (`tipo==='cartao'` OR (`tipo==='transferencia'` AND
 * `origem_code` ∈ `BANCOS_ORIGEM`)) — SEM exigir TIER 1 nem corte de veredito
 * (panorama editorial, não recomendação; mesmo tratamento TIER2 de
 * Clipping/Resumo do dia, D-053 item 4).
 * @param {object[]} campaigns
 * @param {{bancosOrigem?:string[]}} opts
 * @returns {{itens:object[], omitido:boolean}}
 */
export function selecionarCartoesBancos(campaigns = [], { bancosOrigem = BANCOS_ORIGEM } = {}) {
  const bancos = new Set(bancosOrigem);
  const itens = (campaigns || [])
    .filter((c) => {
      if (!c) return false;
      if (ehClippingOnly(c)) return false; // A8: decisão do operador — só Clipping (D-061.2)
      const vivo = TRES_PORTOES.estadosVivo.includes(c.estado);
      if (!vivo) return false;
      if (c.tipo === 'cartao') return true;
      return c.tipo === 'transferencia' && bancos.has(c.origem_code);
    })
    .map((c) => ({
      origem: c.origem_code ?? null,
      destino: c.destino_code ?? null,
      tipo: c.tipo ?? null,
      percentual: c.percentual ?? null,
    }));
  return { itens, omitido: itens.length === 0 };
}
