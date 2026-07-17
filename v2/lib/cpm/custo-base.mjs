// CPM de transferencia a partir do CUSTO-BASE da moeda de origem (M2, D-032).
// PURA, sem I/O, sem LLM. Determinismo-primeiro (INV-12).
//
// Achado (PROPOSTA-VETOR-DERIVACAO §0): `cpm_value` existe em so 10/3.621
// campanhas. Para `transferencia`, o CPM (R$/milheiro) do DESTINO se reconstroi
// a partir do custo de fabrica do milheiro da moeda de ORIGEM (tabela
// custo_base_moeda, migration 011) + o bonus da campanha:
//
//   1000 pts origem  --(bonus B%)-->  1000 * (1 + B/100) * ratio  milhas destino
//
// Custo dos pts de origem = custo_milheiro(origem)  (R$ por 1000 pts origem).
// Logo o CPM do destino:
//
//   CPM_destino = custo_milheiro(origem) / ((1 + B/100) * ratio)
//
// `ratio` = razao de conversao BASE origem:destino (milhas destino por ponto de
// origem ANTES do bonus). 1 na maioria dos hubs (Livelo/Esfera -> cia aerea
// 1:1), mas NAO em todos: Livelo->ConnectMiles converte 3:1 (ratio=0,3333, ver
// PROPOSTA-RATIOS §4) — com ratio=1 o CPM erraria 2,8x. Por isso `ratio` e
// OBRIGATORIO, SEM DEFAULT (D-039 / decisao 3 do vetor de ratios): par ausente
// ou ratio desconhecido => CPM null (nao reconstruivel), NUNCA 1:1 implicito. O
// chamador so passa o ratio lido da tabela custo_base_ratio (migration 012)
// quando ele NAO e nulo; ratio omitido/NULL/NaN/<=0 aqui -> null (nao chuta,
// INV-03), o consumidor trata como "CPM nao reconstruivel".
//
// Este modulo NAO le banco e NAO toca a derivacao (derivarEficiencia consome o
// CPM ja pronto). So converte custo-base -> CPM.

/**
 * CPM (R$/milheiro) do destino de uma transferencia, a partir do custo-base
 * da moeda de origem e do bonus da campanha.
 *
 * @param {number} custoMilheiroOrigem  R$/milheiro da moeda de ORIGEM (custo de fabrica).
 * @param {number} bonusPct             bonus da transferencia em % (ex.: 100 = 1:2). >= 0.
 * @param {number} ratioBase            razao base origem:destino ANTES do bonus (milhas/ponto).
 *   OBRIGATORIO, sem default (D-039): omitido/NULL/NaN/<=0 => retorno null.
 * @returns {number|null}  CPM em R$/milheiro, arredondado a 2 casas; null se
 *   qualquer entrada for invalida (custo/ratio nao-finito ou <= 0, bonus < 0 ou
 *   nao-finito) OU se `ratioBase` for omitido. null = "nao reconstruivel", nunca
 *   um numero chutado (INV-03); em especial, ratio ausente NUNCA vira 1:1.
 */
export function cpmDeCustoBase(custoMilheiroOrigem, bonusPct, ratioBase) {
  const custo = Number(custoMilheiroOrigem);
  const bonus = Number(bonusPct);
  const ratio = Number(ratioBase);
  if (!Number.isFinite(custo) || custo <= 0) return null;
  if (!Number.isFinite(bonus) || bonus < 0) return null;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  const multiplicador = (1 + bonus / 100) * ratio;
  const cpm = custo / multiplicador;
  return Math.round(cpm * 100) / 100; // 2 casas (R$)
}
