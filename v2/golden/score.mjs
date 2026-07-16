// Golden set — rotulagem + medição do portão (M1 slice 4, run dedicada).
// Lê AMOSTRA-100.json (extração atual), aplica o gabarito congelado abaixo,
// emite AMOSTRA-100-ROTULADA.json e imprime precision/recall dos campos críticos.
//   node v2/golden/score.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const amostra = JSON.parse(readFileSync(join(DIR, 'AMOSTRA-100.json'), 'utf8'));

// ── Gabarito por id (deduplicado). classe: 'campanha' | 'nao_campanha'.
// gab quando campanha: {tipo, origem, destino, publico, pct, vig, prov, flags}
// vig: 'YYYY-MM-DD' | 'indeterminada'. pct: número | null.
// flags: multi_banco | recuperavel | parceria_sem_bonus | prorrogacao |
//        borderline_perk | borderline | titleless | year_error |
//        route_hallucination | pct_nao_bonus
const N = null, SD = 'sem_destino', MC = 'multiplos_cartoes';
const C = (tipo, origem, destino, publico, pct, vig, prov, flags = []) =>
  ({ classe: 'campanha', tipo, origem, destino, publico, pct, vig, prov, flags });
const NC = (prov, flags = []) => ({ classe: 'nao_campanha', prov, flags });

const G = {
  'all-qatarprivilege-statusmatch-na': C('status_match', 'all_accor', 'qatar_privilege', 'geral', N, 'indeterminada',
    'renovaram a parceria ... status match ... continua valendo em 2026'),
  'all-reward-assinatura-na': C('clube', 'all_accor', SD, 'clube', N, 'indeterminada',
    'Assine o ALL Signature ... até 1.000 pontos Reward bônus', ['borderline']),
  'allianz-desconhecido-compra-2024-10-03': NC('Seguro viagem da Allianz Travel com 70% de desconto (serviço, sem pontos)'),
  'amazon eua-desconhecido-compra-na': NC('Produtos Apple com até 47% de desconto na Amazon (varejo)'),
  'americanexpress-ifood-cartao-na': NC('Clube iFood grátis por um ano com Amex (perk sem pontos/milhas)', ['borderline_perk']),
  'azul-azul-cartao-2024-04-29': C('promocao_emissao', 'azul_fidelidade', SD, 'cartao', N, '2026-04-29',
    'Peça o cartão Azul Skyline ... 100.000 pontos bônus ... termina hoje (29/04); slug abr26', ['year_error']),
  'azul-azul-compra-2024-08-17': C('shopping', 'azul_fidelidade', SD, 'geral', N, 'indeterminada',
    'até 15 pontos por real gasto no Magalu ... até sábado (17) [15 é taxa, não %]', ['pct_nao_bonus']),
  'azul-desconhecido-estrutural-2030-12-31': NC('Azul anuncia patrocínio às Seleções (marketing/PR, não é mecânica de pontos)'),
  'banco-banco-estrutural-na': C('outro', 'btg', SD, 'geral', N, '2025-02-20',
    'Pontos dos cartões BTG ... programa próprio ... a partir de 20/02 [banco->btg]', ['recuperavel']),
  'banco-pontos-cartao-na': C('bonus_acumulo', 'btg', SD, 'geral', N, 'indeterminada',
    'Ultrablue BTG Pactual ... pontos ou cashback [banco->btg]', ['recuperavel']),
  'bancointer-desconhecido-compra-na': C('shopping', 'inter', SD, 'geral', 8, 'indeterminada',
    'Banco Inter ... 8% de cashback ... Amazon ... não informado até qual data'),
  'bradesco-desconhecido-cartao-2024-06-30': C('promocao_emissao', 'bradesco', SD, 'cartao', N, '2025-06-30',
    'anuidade grátis para sempre ... até 30/06; slug mai25', ['year_error']),
  'c6-azul-transferencia-na': C('transferencia_bonificada', MC, 'azul_fidelidade', 'cartao', 120, 'indeterminada',
    'até 120% de bônus na transferência de pontos do cartão de crédito [genérico multi-banco]', ['multi_banco']),
  'c6-desconhecido-clube-na': NC('C6 Carbon amplia salas VIP (benefício de sala VIP, sem pontos)', ['borderline_perk']),
  'c6-desconhecido-estrutural-na': NC('C6 passa a exigir gasto mínimo p/ salas VIP (benefício, sem pontos)', ['borderline_perk']),
  'caixa-caixa-cartao-na': C('bonus_acumulo', 'caixa', SD, 'geral', N, 'indeterminada',
    'aumentou a pontuação ... até 4 pontos por dólar [taxa, não %]', ['pct_nao_bonus']),
  'cartao azul-desconhecido-cartao-na': C('promocao_emissao', 'azul_fidelidade', SD, 'cartao', N, 'indeterminada',
    'Cartão Azul Skyline ... 100 mil pontos bônus [cartao azul->azul]', ['recuperavel']),
  'crypto-livelo-cartao-na': C('promocao_emissao', 'crypto_com', 'livelo', 'cartao', N, 'indeterminada',
    'solicitar o cartão Crypto.com ... até 150.000 pontos Livelo'),
  'delta-desconhecido-estrutural-2024-12-31': NC('Delta define preços com base em IA (ops de cia, não loyalty; %20 espúrio)', ['pct_nao_bonus']),
  'desconhecido-azul-status match-na': C('status_match', N, 'azul_fidelidade', 'geral', N, 'indeterminada',
    'Status Match do Azul Fidelidade ... Diamante Unique'),
  'desconhecido-desconhecido-compra-2024-09-16': NC('Aluguel de carro 45% OFF + cupom 8% (varejo/cupom)'),
  'desconhecido-latampass-clube-na': C('bonus_acumulo', N, 'latam_pass', 'geral', N, 'indeterminada',
    'cadastro no Latam Pass e ganhe 600 milhas grátis [enrollment bonus]'),
  'diners-diners-cartao-na': C('bonus_acumulo', 'diners', SD, 'geral', N, 'indeterminada',
    'acumule até 5 pontos por dólar ... Elo Diners ... últimos dias [taxa, não %]', ['pct_nao_bonus']),
  'esfera-airfranceklm-transferencia-na': C('outro', 'esfera', 'flyingblue', 'geral', N, 'indeterminada',
    'Esfera ganha mais dois parceiros ... IHG e Air France/KLM [parceria sem %]', ['parceria_sem_bonus']),
  'esfera-allaccor-transferencia-2024-09-17': C('outro', 'esfera', 'all_accor', 'geral', N, 'indeterminada',
    'Prorrogado! Transfira Esfera para o ALL Accor ... status Gold [sem %]', ['parceria_sem_bonus', 'prorrogacao']),
  'esfera-azul-transferencia-2024-05-14': C('transferencia_bonificada', 'esfera', 'azul_fidelidade', 'geral', 80, '2025-05-14',
    'até 80% de bônus ... Esfera para o Azul ... até 14/05; slug mai25', ['year_error']),
  'esfera-esfera-clube-2024-04-19': C('clube', 'esfera', SD, 'clube', N, '2026-04-19',
    'Clube Esfera ... até 90.000 pontos bônus; slug abr26', ['year_error']),
  'esfera-esfera-clube-2024-09-17': C('clube', 'esfera', SD, 'clube', N, 'indeterminada',
    'Clube Esfera ... até 100.000 pontos bônus (dia não confirmável)'),
  'esfera-ihg-transferencia-na': C('outro', 'esfera', 'ihg', 'geral', N, 'indeterminada',
    'Esfera ganha mais dois parceiros ... IHG [parceria sem %]', ['parceria_sem_bonus']),
  'inter-uber-compra-na': C('shopping', 'inter', SD, 'geral', 10, 'indeterminada',
    'Inter ... 10% de cashback na compra de créditos Uber [uber = merchant, não destino]'),
  'ita-desconhecido-status match-na': C('status_match', 'ita', SD, 'geral', N, 'indeterminada',
    'ITA Airways anuncia nova campanha de status match com diversas companhias'),
  'itau-google-clube-na': NC('Itaú oferece Google Gemini grátis (perk sem pontos)', ['borderline_perk']),
  'itau-latampass-transferencia-2024-11-14': C('transferencia_bonificada', 'itau', 'latam_pass', 'geral', 30, '2025-11-14',
    '30% de bônus ... Itaú e Credicard ... até 14/11; slug nov25', ['year_error']),
  'latampass-desconhecido-compra-2024-09-29': NC('LATAM passagens a partir de R$148 ou 2.692 milhas (tarifa, não bônus)'),
  'latampass-latampass-compra-2024-03-11': C('compra_pontos', 'latam_pass', SD, 'geral', 60, '2026-03-11',
    'Compre milhas Latam Pass ... até 60% de desconto ... (11/03); slug mar26', ['year_error']),
  'latampass-smiles-transferencia-na': C('outro', 'smiles', SD, 'geral', 30, 'indeterminada',
    'Smiles ... 30% de desconto no resgate ... Classe Executiva [desconto de resgate, não rota latam->smiles]', ['route_hallucination']),
  'livelo-azul-transferencia-2025-09-29': C('transferencia_bonificada', 'livelo', 'azul_fidelidade', 'geral', 110, '2025-09-29',
    'até 110% de bônus na transferência de pontos Livelo ... 29/09/25'),
  'livelo-latampass-transferencia-2024-08-21': C('transferencia_bonificada', 'livelo', 'latam_pass', 'geral', 35, '2025-08-21',
    'ganhe 35% de bônus ... incluindo Livelo ... até 21/08; slug ago25', ['year_error']),
  'livelo-latampass-transferencia-2025-03-24': C('transferencia_bonificada', 'livelo', 'latam_pass', 'geral', 35, '2025-03-24',
    'até 35% de bônus ... Livelo para o Latam Pass ... (24/03)'),
  'livelo-latampass-transferencia-2026-06-30': C('transferencia_bonificada', 'livelo', 'latam_pass', 'geral', 25, '2026-06-30',
    'slug: so-hoje ... latam-pass-livelo 25% bonus (trecho sem título)', ['titleless']),
  'livelo-livelo-clube-2024-07-12': C('clube', 'livelo', SD, 'clube', N, 'indeterminada',
    'Clube Livelo Top ... 380.000 pontos ... até hoje (12)'),
  'livelo-livelo-clube-2024-09-07': C('clube', 'livelo', SD, 'clube', N, 'indeterminada',
    'Clube Livelo Top ... 378 mil pontos ... apenas hoje (7)'),
  'livelo-livelo-clube-2024-10-10': C('clube', 'livelo', SD, 'clube', N, '2025-10-10',
    'Clube Livelo ... 11.000 pontos ... hoje (10/10); slug out25', ['year_error']),
  'livelo-livelo-compra-2024-05-09': C('shopping', 'livelo', SD, 'geral', N, '2025-05-09',
    'até 10 pontos Livelo por real ... Petlove ... (09/05); slug mai25 [taxa, não %]', ['year_error', 'pct_nao_bonus']),
  'livelo-livelo-compra-2025-06-17': C('shopping', 'livelo', SD, 'geral', N, '2025-06-17',
    'até 15 pontos por real ... farmácia 17/06/25 [taxa, não %]', ['pct_nao_bonus']),
  'livelo-livelo-compra-2025-11-06': C('shopping', 'livelo', SD, 'geral', N, '2025-11-06',
    '6 pontos Livelo por real ... mercado 06/11/25 [taxa, não %]', ['pct_nao_bonus']),
  'livelo-magalu-compra-na': NC('Até R$300 de desconto ... cupons ... Amazon e Magalu (cupom varejo)'),
  'livelo-smiles-transferencia-2024-09-27': C('transferencia_bonificada', 'livelo', 'smiles', 'geral', 90, '2025-05-09',
    'até 90% de bônus ... terminam hoje; slug 9mai25', ['year_error']),
  'marriott-desconhecido-hotelaria-na': C('bonus_acumulo', 'marriott', SD, 'geral', N, 'indeterminada',
    '15 mil pontos de bônus por estadia ... América Latina [15000 absoluto, não %]', ['pct_nao_bonus']),
  'mastercard-azul-compra-2024-11-26': NC('25% de desconto no Azul Viagens com cupom Mastercard (cupom varejo)'),
  'mastercard-uber-cartao-na': NC('Mastercard lança cartão de débito com Uber One grátis (lançamento, sem pontos)', ['borderline_perk']),
  'meli-disney-clube-2024-05-05': NC('Assine Meli+ ... Disney+ grátis (assinatura de streaming, sem milhas)', ['borderline_perk']),
  'mercadolivre-desconhecido-compra-2024-06-25': NC('cupom mercado livre 20 off (cupom varejo)'),
  'mercadolivre-desconhecido-compra-2024-07-13': NC('até 15% OFF ... cupom Mercado Livre (cupom varejo)'),
  'mercadolivre-desconhecido-compra-2024-08-05': NC('até R$100 de desconto ... cupom Mercado Livre (cupom varejo)'),
  'mercadolivre-desconhecido-compra-2024-09-18': NC('até R$60 de desconto ... cupom Mercado Livre (cupom varejo)'),
  'mercadolivre-desconhecido-compra-2026-07-04': NC('cupom mercado livre até 20 off (cupom varejo)', ['titleless']),
  'mercadopago-desconhecido-clube-2024-09-28': NC('Meli+ ... Disney+ ... 120% do CDI (assinatura; %120 = CDI, não bônus)', ['borderline_perk', 'pct_nao_bonus']),
  'na-na-compra-na': NC('Passagens para a Bahia a partir de R$395 (tarifa em dinheiro)'),
  'nomad-azul-cartao-2025-03-24': C('promocao_emissao', 'nomad', 'azul_fidelidade', 'cartao', N, '2025-03-24',
    'Abra a conta digital Nomad ... 12 a 21 mil pontos Azul ... 24/03/25'),
  'nubank-desconhecido-cartao-2024-05-26': C('promocao_emissao', 'nubank', SD, 'cartao', N, '2026-05-26',
    'Cartão Black anuidade grátis ... hoje (26/05) ... Nubank; slug mai26', ['year_error', 'borderline']),
  'nubank-smiles-transferencia-na': C('transferencia_bonificada', 'nubank', 'smiles', 'cartao', 70, 'indeterminada',
    'até 70% de bônus no envio de pontos do Nubank Ultravioleta'),
  'null-grandpalladiumimbassai-hotelaria-na': NC('Diárias all inclusive ... a partir de R$1.310 (pacote em dinheiro)'),
  'null-smiles-transferencia-na': C('transferencia_bonificada', MC, 'smiles', 'cartao', 70, 'indeterminada',
    'Prorrogado! Smiles ... 70% ... transferência de todos os parceiros [multi-origem]', ['multi_banco', 'prorrogacao']),
  'picpay-uber-compra-2026-03-23': C('shopping', 'picpay', SD, 'geral', 10, '2026-03-23',
    'PicPay ... 10% de cashback na compra de créditos Uber 23/03/26 [uber = merchant]'),
  'pontofrio-smiles-transferencia-2026-05-26': C('shopping', 'smiles', SD, 'geral', N, '2026-05-26',
    'slug smiles-pontofrio-9-milhas-mai26 [acúmulo em compras, não transferência; 9 milhas = taxa]', ['titleless', 'pct_nao_bonus']),
  'pontos pra voar-revolut-cartao-na': C('promocao_emissao', 'revolut', SD, 'cartao', N, 'indeterminada',
    'Abra sua conta na Revolut ... 3.000 pontos bônus ... gastar R$150 [origem->revolut]'),
  'pp-hoteis.com-compra-2026-05-31': NC('8% de desconto na Hoteis.com ... cupom (cupom parceiro do blog)'),
  'qatar-desconhecido-estrutural-na': NC('Qatar retoma voos em Doha e facilita status (ops de cia)'),
  'resortstaua-desconhecido-hotelaria-na': NC('resorts tauá com desconto diárias (pacote/diária em dinheiro)', ['titleless']),
  'revolut-lifemiles-transferencia-na': C('outro', 'revolut', 'lifemiles', 'geral', N, 'indeterminada',
    'Revolut adiciona LifeMiles ... aos programas parceiros [parceria sem %]', ['parceria_sem_bonus']),
  'santander-aadvantage-cartao-2026-03': C('promocao_emissao', 'santander', 'aa_advantage', 'cartao', N, 'indeterminada',
    'slug: cartoes-santander-aadvantage-anuidade-gratis-mar26 (trecho sem título)', ['titleless']),
  'shell-desconhecido-compra-2024-08-20': NC('Cupom Shell Box ... desconto ao abastecer (cupom combustível)'),
  'shellbox-desconhecido-compra-2026-02-25': NC('Cupom Shell Box ... R$0,10 por litro (cupom combustível)'),
  'shopee-livelo-compra-2024-08-08': C('shopping', 'livelo', SD, 'geral', N, 'indeterminada',
    '8.8 Shopee ... até 5 pontos por real na Esfera ou Livelo [acúmulo; 5 = taxa]', ['borderline', 'pct_nao_bonus']),
  'smiles-melhores destinos-compra-na': NC('Voos ... a partir de 62 mil milhas Smiles (disponibilidade de resgate/tarifa)'),
  'smiles-smiles-clube-2024-03-22': C('clube', 'smiles', SD, 'clube', N, 'indeterminada',
    'Clube Smiles ... 36 mil milhas ... até sexta (22)'),
  'smiles-smiles-clube-2026-07-20': C('clube', 'smiles', SD, 'clube', N, '2026-07-20',
    'Clube Smiles ... até 50.000 milhas na hora; slug jul26'),
  'surpreenda-stanley-compra-na': C('outro', 'surpreenda', SD, 'geral', N, 'indeterminada',
    'Troque 10 pontos Mastercard Surpreenda ... Stanley ... Pague 1 Leve 2 [resgate/promo Surpreenda]', ['borderline']),
  'tap-desconhecido-estrutural-na': C('outro', 'tap', SD, 'geral', N, 'indeterminada',
    'reajuste nos valores do Club Miles&Go ... até 15% [mudança de valuation do clube; %15 = reajuste, não bônus]', ['borderline', 'pct_nao_bonus']),
  'uber-desconhecido-hotelaria-na': NC('Uber anuncia reservas de hotéis (lançamento de produto/ops)'),
  'uber-inter-cashback-na': C('shopping', 'inter', SD, 'geral', 8, 'indeterminada',
    'slug cashback-uber-inter-8-jul25 (trecho sem título) [Inter cashback Uber]', ['titleless']),
  'udm-desconhecido-compra-na': NC('Black da UDM ... 60% OFF ... cursos (produto do blog)'),
  'unitedmileageplus-desconhecido-compra-na': C('compra_pontos', 'united', SD, 'geral', 80, 'indeterminada',
    'United MileagePlus ... até 80% de bônus na compra de milhas'),
  'vilagale-desconhecido-hotelaria-na': NC('Vila Galé ... voos + all inclusive a partir de R$3.242 (pacote em dinheiro)'),
  'xp-desconhecido-cartao-2024-04-18': C('bonus_acumulo', 'xp', SD, 'cartao', 2, 'indeterminada',
    'XP oferece investback de 2% no cartão adicional ... até amanhã (19/03) (ano não confirmável)'),
};

// ── Normalização de códigos da extração -> canônico (para comparar com o gabarito).
const ALIAS = {
  azul: 'azul_fidelidade', latampass: 'latam_pass', all: 'all_accor', allaccor: 'all_accor',
  qatarprivilege: 'qatar_privilege', airfranceklm: 'flyingblue', aadvantage: 'aa_advantage',
  unitedmileageplus: 'united', bancointer: 'inter', crypto: 'crypto_com', 'cartao azul': 'azul_fidelidade',
};
const NO_CODE = new Set(['desconhecido', 'null', 'na', '', 'pontos', 'melhores destinos']);
const norm = (c) => { if (c == null) return ''; const k = String(c).trim().toLowerCase(); return ALIAS[k] || k; };
const isNoCode = (c) => NO_CODE.has(String(c ?? '').trim().toLowerCase());

// ── Comparadores de campo. Retornam {ok, kind}.
function cmpOrigem(extr, gab) {
  const e = norm(extr);
  if (gab === null) return isNoCode(extr) ? { ok: true, kind: 'match' } : { ok: false, kind: 'spurious' };
  if (gab === MC) return e === MC ? { ok: true, kind: 'match' } : { ok: false, kind: 'multi_banco_miss' };
  if (isNoCode(extr)) return { ok: false, kind: 'missed' };
  return e === gab ? { ok: true, kind: 'match' } : { ok: false, kind: 'wrong' };
}
function cmpDestino(extr, gab) {
  if (gab === SD) return isNoCode(extr) ? { ok: true, kind: 'match' } : { ok: false, kind: 'spurious' };
  if (gab === null) return isNoCode(extr) ? { ok: true, kind: 'match' } : { ok: false, kind: 'spurious' };
  if (isNoCode(extr)) return { ok: false, kind: 'missed' };
  return norm(extr) === gab ? { ok: true, kind: 'match' } : { ok: false, kind: 'wrong' };
}
function cmpPct(extr, gab) {
  const e = extr == null ? null : Number(extr);
  if (gab === null && e === null) return { ok: true, kind: 'match_null' };
  if (gab === null && e !== null) return { ok: false, kind: 'spurious' };       // extração inventou %
  if (gab !== null && e === null) return { ok: false, kind: 'missed' };
  return e === gab ? { ok: true, kind: 'match' } : { ok: false, kind: 'wrong' };
}
function cmpVig(extr, gab) {
  const e = (extr == null || extr === 'na') ? 'indeterminada' : extr;
  if (gab === 'indeterminada' && e === 'indeterminada') return { ok: true, kind: 'match_indet' };
  if (gab === 'indeterminada' && e !== 'indeterminada') return { ok: false, kind: 'overprecision' };
  if (gab !== 'indeterminada' && e === 'indeterminada') return { ok: false, kind: 'missed' };
  if (e === gab) return { ok: true, kind: 'match' };
  const [ey, em, ed] = e.split('-'), [gy, gm, gd] = gab.split('-');
  if (em === gm && ed === gd && ey !== gy) return { ok: false, kind: 'year_error' };
  return { ok: false, kind: 'wrong' };
}

// ── Dedup por id (mantém 1ª ocorrência) + join com gabarito.
const seen = new Set();
const rows = [];
for (const r of amostra) {
  if (seen.has(r.id)) continue;
  seen.add(r.id);
  const g = G[r.id];
  if (!g) { console.error('SEM GABARITO:', r.id); continue; }
  rows.push({ ...r, ...g });
}

// ── Métricas.
const campanhas = rows.filter((r) => r.classe === 'campanha');
const negativos = rows.filter((r) => r.classe === 'nao_campanha');

// Detecção (a extração transformou TODAS as 86 em campanha).
const detected = rows.length;                 // tudo virou campanha na base
const realCamp = campanhas.length;
const detPrecision = realCamp / detected;     // % do que a base publica que é campanha real
const fpNegatives = negativos.length;         // negativos publicados como campanha
const borderlinePerk = negativos.filter((r) => r.flags?.includes('borderline_perk')).length;

// Campos críticos sobre as campanhas reais.
const field = { origem: {}, destino: {}, pct: {}, vig: {} };
const tally = (bag, kind) => { bag[kind] = (bag[kind] || 0) + 1; };
const labeled = rows.map((r) => {
  const base = {
    id: r.id, fonte: r.fonte, url: r.url, input: r.input,
    classe: r.classe, flags: r.flags || [], extracao_atual: r.extracao_atual,
  };
  if (r.classe === 'nao_campanha') return { ...base, gabarito: null, proveniencia: r.prov };
  const co = cmpOrigem(r.extracao_atual.origem, r.origem);
  const cd = cmpDestino(r.extracao_atual.destino, r.destino);
  const cp = cmpPct(r.extracao_atual.percentual, r.pct);
  const cv = cmpVig(r.extracao_atual.vigencia_fim, r.vig);
  tally(field.origem, co.kind); tally(field.destino, cd.kind);
  tally(field.pct, cp.kind); tally(field.vig, cv.kind);
  return {
    ...base,
    gabarito: { tipo: r.tipo, origem_programa: r.origem, destino_programa: r.destino, publico: r.publico, percentual: r.pct, vigencia_fim: r.vig },
    proveniencia: r.prov,
    match: { origem: co, destino: cd, percentual: cp, vigencia: cv },
  };
});

// precision/recall por campo (sobre campanhas reais).
function pr(bag, { retrievedKinds, relevantKinds, correctKinds }) {
  const sum = (ks) => ks.reduce((a, k) => a + (bag[k] || 0), 0);
  const correct = sum(correctKinds), retrieved = sum(retrievedKinds), relevant = sum(relevantKinds);
  return { correct, retrieved, relevant, precision: retrieved ? correct / retrieved : null, recall: relevant ? correct / relevant : null };
}
// programa (origem+destino combinados): "asserção" = extração deu um code (match|wrong|spurious); "relevante" = gabarito tinha code (match|wrong|missed|multi_banco_miss).
const progBag = {};
for (const k of Object.keys(field.origem)) progBag[k] = (progBag[k] || 0) + field.origem[k];
for (const k of Object.keys(field.destino)) progBag[k] = (progBag[k] || 0) + field.destino[k];
const progPR = pr(progBag, {
  correctKinds: ['match'],
  retrievedKinds: ['match', 'wrong', 'spurious'],
  relevantKinds: ['match', 'wrong', 'missed', 'multi_banco_miss'],
});
const pctPR = pr(field.pct, {
  correctKinds: ['match'],
  retrievedKinds: ['match', 'wrong', 'spurious'],
  relevantKinds: ['match', 'wrong', 'missed'],
});
const vigPR = pr(field.vig, {
  correctKinds: ['match'],
  retrievedKinds: ['match', 'wrong', 'year_error', 'overprecision'],
  relevantKinds: ['match', 'wrong', 'year_error', 'missed'],
});

// tipo (secundário): acerto exato após colapso conhecido.
const TIPO_MAP = { statusmatch: 'status_match', 'status match': 'status_match', cartao: 'bonus_acumulo', compra: 'compra_pontos', transferencia: 'transferencia_bonificada', clube: 'clube', assinatura: 'clube', estrutural: 'outro', hotelaria: 'outro', cashback: 'shopping' };
let tipoOk = 0;
for (const r of campanhas) { const et = TIPO_MAP[r.extracao_atual.tipo] || r.extracao_atual.tipo; if (et === r.tipo) tipoOk++; }

const out = {
  gerado_em: '2026-07-16',
  total_itens_unicos: rows.length,
  deteccao: {
    itens_extraidos_como_campanha: detected,
    campanhas_reais: realCamp,
    negativos_publicados_como_campanha: fpNegatives,
    precision_deteccao: +detPrecision.toFixed(4),
    recall_deteccao_campanhas: 1.0,
    nao_campanha_rejeitadas_pela_base: 0,
    nao_campanha_precision_da_base: 0.0,
    borderline_perk_sem_pontos: borderlinePerk,
    precision_deteccao_se_perks_forem_campanha: +((realCamp + borderlinePerk) / detected).toFixed(4),
  },
  campos_criticos_sobre_campanhas_reais: {
    n_campanhas: realCamp,
    programa: progPR, percentual: pctPR, vigencia: vigPR,
    detalhe_origem: field.origem, detalhe_destino: field.destino, detalhe_percentual: field.pct, detalhe_vigencia: field.vig,
  },
  tipo_secundario: { acertos: tipoOk, total: realCamp, acuracia: +(tipoOk / realCamp).toFixed(4) },
};

writeFileSync(join(DIR, 'AMOSTRA-100-ROTULADA.json'), JSON.stringify(labeled, null, 1));
writeFileSync(join(DIR, 'METRICAS.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
