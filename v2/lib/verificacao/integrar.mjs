// integrar.mjs — ponte entre a verificação PURA (pre-superficie.mjs, D-060/D-061)
// e o pipeline vivo (ingest + montagem do Daily). PURO, sem I/O: recebe linhas
// de `campaigns`, devolve o split {aprovados, paraRevisao} JÁ com as linhas de
// TRILHA (`campanha_versoes`) prontas para o runner inserir.
//
// Disciplina cravada (D-060 + D-044):
//   1. FLAG NUNCA DESCARTA nem reclassifica: item flagado continua no fluxo,
//      só ganha uma anotação de revisão (trilha) e entra na fila do operador.
//   2. Não muta `campaigns.estado` — mudar estado seria reclassificar. A marca
//      de "revisar" vive em `campanha_versoes` (trilha aditiva), como no D-060.
//   3. Recomputa no momento (nunca confia em flag gravado antes) — o mesmo
//      princípio dos três portões (D-044). Por isso a montagem chama esta
//      passada DE NOVO, em vez de ler um flag persistido.
import { verificarPreSuperficie } from './pre-superficie.mjs';

// Evento único da trilha — a fila de revisão (M2.7) e qualquer auditoria
// filtram por ele. Aditivo, sem CHECK constraint no banco (confirmado no M1).
export const EVENTO_FLAG_REVISAO = 'flag_pre_superficie';

/**
 * Monta a linha de `campanha_versoes` que registra o flag como ANOTAÇÃO de
 * revisão (não uma mudança de estado): payload_antes null (nada mudou no item),
 * payload_depois carrega os flags + motivos para o operador ler na fila.
 * @param {object} item   linha de campaigns (precisa de id; identidade_id opcional)
 * @param {Array<{flag:string,motivo:string}>} flags
 * @param {{hoje:string, origem?:string}} ctx
 * @returns {object} linha pronta para insert em campanha_versoes
 */
export function trilhaDeRevisao(item, flags, { hoje, origem = 'pre-superficie (D-060/D-061)' } = {}) {
  return {
    identidade_id: item.identidade_id ?? null,
    campaign_id: item.id,
    evento: EVENTO_FLAG_REVISAO,
    payload_antes: null,
    payload_depois: {
      flags: flags.map((f) => f.flag),
      motivos: flags.map((f) => f.motivo),
      revisao: true,
      hoje,
    },
    origem,
    em: hoje,
  };
}

/**
 * Passada de superfície com trilha. Envolve verificarPreSuperficie e, para cada
 * item flagado, já produz a linha de trilha. NADA some: `aprovados` e
 * `paraRevisao` juntos = todos os itens de entrada; `paraRevisao[i].item` é o
 * item íntegro (publicável), só marcado para o olho humano.
 * @param {object[]} itens  linhas de campaigns
 * @param {{hoje?:string, origem?:string, limiarDestaque?:number}} opts
 * @returns {{aprovados:object[], paraRevisao:Array<{item:object,flags:object[]}>, trilhas:object[], resumo:object}}
 */
export function anotarRevisao(itens = [], opts = {}) {
  const hoje = opts.hoje ?? new Date().toISOString().slice(0, 10);
  const { aprovados, paraRevisao } = verificarPreSuperficie(itens, opts);
  const trilhas = paraRevisao.map(({ item, flags }) => trilhaDeRevisao(item, flags, { hoje, origem: opts.origem }));

  // Resumo por flag — o que o runner imprime e o operador vê no relatório.
  const porFlag = {};
  for (const { flags } of paraRevisao) {
    for (const f of flags) porFlag[f.flag] = (porFlag[f.flag] || 0) + 1;
  }
  const resumo = {
    total: itens.length,
    aprovados: aprovados.length,
    para_revisao: paraRevisao.length,
    por_flag: porFlag,
  };
  return { aprovados, paraRevisao, trilhas, resumo };
}
