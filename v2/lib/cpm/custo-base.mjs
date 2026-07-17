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
// 1:1). Quando != 1 (ex.: Livelo->ConnectMiles, ver PROPOSTA §4) o custo-base
// SOZINHO subestima o CPM: por isso `ratio` e explicito e default 1 e uma
// SUPOSICAO, nao um fato. Se a razao real for desconhecida -> null (nao chuta,
// INV-03), o chamador trata como "CPM nao reconstruivel".
//
// Este modulo NAO le banco e NAO toca a derivacao (derivarEficiencia consome o
// CPM ja pronto). So converte custo-base -> CPM.

/**
 * CPM (R$/milheiro) do destino de uma transferencia, a partir do custo-base
 * da moeda de origem e do bonus da campanha.
 *
 * @param {number} custoMilheiroOrigem  R$/milheiro da moeda de ORIGEM (custo de fabrica).
 * @param {number} bonusPct             bonus da transferencia em % (ex.: 100 = 1:2). >= 0.
 * @param {number} [ratioBase=1]        razao base origem:destino ANTES do bonus (milhas/ponto).
 * @returns {number|null}  CPM em R$/milheiro, arredondado a 2 casas; null se
 *   qualquer entrada for invalida (custo/ratio nao-finito ou <= 0, bonus < 0 ou
 *   nao-finito). null = "nao reconstruivel", nunca um numero chutado (INV-03).
 */
export function cpmDeCustoBase(custoMilheiroOrigem, bonusPct, ratioBase = 1) {
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
