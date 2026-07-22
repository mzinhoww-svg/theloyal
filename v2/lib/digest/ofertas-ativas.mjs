// Ofertas ativas + Cartões & bancos (M2 · Digest Engine v3, SPEC-SLICE-DIGEST-ENGINE.md
// §1.1/§1.4, D-057). PUROS, sem I/O — recebem linhas já lidas de `campaigns`. Mesma
// disciplina de determinismo-primeiro (INV-12) e regra-mãe (seção sem dado real é
// OMITIDA, nunca vazia/parcial) dos demais seletores de v2/lib/digest.
import { passaTresPortoes, TRES_PORTOES } from './selecionar.mjs';
import { mapVeredito } from './mapear-contrato.mjs';

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
 * Ofertas ativas (§1.1): TODO item vivo com conta computável, sem o corte de
 * veredito de Deal Desk por cima — é literalmente `passaTresPortoes` (D-044)
 * aplicado a `campaigns`, sem `elegivelDealDesk`. `leitura` reusa o vocabulário
 * canônico de veredito via `mapVeredito` (D-057 decisão 1: um só vocabulário
 * para o mesmo dado, nunca um rótulo compacto paralelo) — kebab-case, mesma
 * chave do `$defs/verdict` do schema; o renderer traduz para o rótulo em
 * português. `mapVeredito` lança em rótulo desconhecido (sem fallback
 * silencioso, mesma disciplina de mapear-contrato.mjs).
 * @param {object[]} campaigns  linhas de `campaigns`
 * @returns {{itens:object[], omitido:boolean}}
 */
export function selecionarOfertasAtivas(campaigns = []) {
  const itens = (campaigns || [])
    .filter((c) => passaTresPortoes(c) && !ehClippingOnly(c)) // A8: respeita clipping-only (D-061.2)
    .map((c) => ({
      origem: c.origem_code ?? null,
      destino: c.destino_code ?? null,
      tipo: c.tipo ?? null,
      percentual: c.percentual ?? null,
      prazo: c.vigencia_fim ?? null, // null = vigência indeterminada ("sem data" no render)
      leitura: mapVeredito(c.veredito_bruto),
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
