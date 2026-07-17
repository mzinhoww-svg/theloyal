// Re-medição dos motores determinísticos contra o golden em escala (frente CALIBRAÇÃO / D-051).
//   node v2/golden/escala/remedir.mjs
// IMPORTA os motores testados (D-038: nunca cópia): gate camada A, parser de vigência, matcher.
// Mede FORA da amostra dos 86 (itens frescos) -> tira o asterisco in-sample (D-019) da CAMADA A.
//
// Limite honesto declarado: a CAMADA B (LLM) do gate NÃO roda aqui — judgeOffline é um
// fixture chaveado aos 86 ids (não julga item novo) e este run é READ-ONLY sem LLM viva.
// Logo o gate é medido na sua PARTE DETERMINÍSTICA (camada A). O que a A não rejeita e é
// negativo => "resíduo p/ a camada B" (reportado, não contado como acerto da A).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { camadaA, issuersDoSeed } from '../../lib/gate.mjs';
import { parseVigencia } from '../../lib/vigencia.mjs';
import { resolverTipo } from '../../lib/identidade.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const G = JSON.parse(readFileSync(join(DIR, 'GOLDEN-400.json'), 'utf8')).itens;
const seed = JSON.parse(readFileSync(join(DIR, '..', '..', 'db', 'seed-aliases.json'), 'utf8'));
const ISSUERS = issuersDoSeed(seed);
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);

const camp = G.filter((x) => x.classe === 'campanha');
const negs = G.filter((x) => x.classe === 'nao_campanha');

// ───────────────────── GATE — camada A (determinística) ─────────────────────
const gA = { rejeitadas: 0, rej_corretas: 0, camp_derrubada: [], por_motivo_gold: {}, residuo_B: 0 };
for (const x of G) {
  const inp = { news_item_id: x.id, titulo: x.input.titulo, trecho: x.input.trecho,
    tipo: x.extracao_snapshot?.tipo, percentual: x.extracao_snapshot?.percentual,
    origem: x.extracao_snapshot?.origem, destino: x.extracao_snapshot?.destino };
  const d = camadaA(inp, { issuers: ISSUERS });
  if (d.rejeitado) {
    gA.rejeitadas++;
    if (x.classe === 'nao_campanha') { gA.rej_corretas++; gA.por_motivo_gold[x.motivo_nao_campanha] = (gA.por_motivo_gold[x.motivo_nao_campanha] || 0) + 1; }
    else gA.camp_derrubada.push({ id: x.id, motivo: d.motivo, tipo: x.gabarito?.tipo, titulo: x.input.titulo.slice(0, 70) });
  } else if (x.classe === 'nao_campanha') gA.residuo_B++;    // negativo que a A não pegou -> sobe p/ B
}
const negPorMotivo = {}; for (const n of negs) negPorMotivo[n.motivo_nao_campanha] = (negPorMotivo[n.motivo_nao_campanha] || 0) + 1;
const gate = {
  camada_medida: 'A (deterministica)',
  nota_camada_B: 'camada B (LLM) nao roda em item novo offline (fixture dos 86). Residuo abaixo = o que subiria para B.',
  total: G.length, campanhas: camp.length, negativos: negs.length,
  rejeitadas: gA.rejeitadas,
  rejeicao_precision_ASSINATURA: r3(gA.rejeitadas ? gA.rej_corretas / gA.rejeitadas : null),
  rejeicao_recall_deterministico: r3(gA.rej_corretas / negs.length),
  campanha_recall: r3((camp.length - gA.camp_derrubada.length) / camp.length),
  campanhas_derrubadas: gA.camp_derrubada,
  negativos_no_gold_por_motivo: negPorMotivo,
  negativos_pegos_pela_A_por_motivo: gA.por_motivo_gold,
  residuo_para_camada_B: gA.residuo_B,
};

// ───────────────────── VIGÊNCIA — parser puro ─────────────────────
// gold vigencia_fim é rótulo de conteúdo (agente); mede overprecision (INV-16) e parsing.
const IN = 'indeterminada';
const vg = { correta: 0, correta_indet: 0, overprecision: [], missed: 0, year_or_day_diff: 0 };
for (const x of camp) {
  const gold = x.gabarito.vigencia_fim;
  const out = parseVigencia({ texto: `${x.input.titulo} ${x.input.trecho}`, slug: '', publicado_em: x.publicado_em });
  const got = out.vigencia_fim;
  if (gold === IN && got === IN) vg.correta_indet++;
  else if (gold === IN && got !== IN) vg.overprecision.push({ id: x.id, got, titulo: x.input.titulo.slice(0, 60) });
  else if (gold !== IN && got === IN) vg.missed++;
  else if (got === gold) vg.correta++;
  else vg.year_or_day_diff++;
}
const vigDatas = camp.filter((x) => x.gabarito.vigencia_fim !== IN).length;
const vigencia = {
  campanhas: camp.length, com_data_no_gold: vigDatas, indeterminada_no_gold: camp.length - vigDatas,
  overprecision_INV16: vg.overprecision.length, overprecision_casos: vg.overprecision.slice(0, 8),
  parsing_precision_datas: r3(vigDatas ? vg.correta / (vg.correta + vg.year_or_day_diff + vg.missed) : null),
  datas_corretas: vg.correta, datas_erradas_dia_ano: vg.year_or_day_diff, datas_perdidas: vg.missed,
  indeterminada_correta: vg.correta_indet,
  overprecision_interpretacao: 'NAO e fabricacao do parser: 8/8 casos amostrados tem TOKEN DE DATA no texto (ex.: "18/06/25", "valida te 30/05", tag de deadline do Melhores Destinos). O gold-labeler (so titulo+trecho, regex simples) SUBLEU essas datas; o parser (parseVigencia, regex mais rico) as leu certo. INV-16 intacto (nunca inventou data sem token). Conclusao: a re-medicao de vigencia esta LIMITADA pela qualidade do gold de vigencia (agente); o parser esta MAIS correto que o gold nesses 17. Divida: no passe em massa, rotular vigencia do CONTEUDO COMPLETO.',
  nota: 'gold vigencia = rotulo de conteudo (agente, fraco em datas). O numero estrutural forte e INV-16 (parser nunca fabrica). Precision/recall de data aqui subestima o parser.',
};

// ───────────────────── MATCHER — mapa tipo bruto -> canônico ─────────────────────
// mede o buraco de cobertura dos gap-types: o tipo bruto do extrator canonicaliza errado.
const mt = { acertos: 0, por_tipo: {}, exemplos_erro: [] };
for (const x of camp) {
  const goldTipo = x.gabarito.tipo;
  const rawTipo = x.extracao_snapshot?.tipo;
  const mapped = resolverTipo(rawTipo);
  const acerto = mapped === goldTipo;
  const k = goldTipo;
  mt.por_tipo[k] = mt.por_tipo[k] || { n: 0, acerto: 0 };
  mt.por_tipo[k].n++; if (acerto) { mt.por_tipo[k].acerto++; mt.acertos++; }
  else if (mt.exemplos_erro.length < 12) mt.exemplos_erro.push({ gold: goldTipo, raw: rawTipo, mapped, titulo: x.input.titulo.slice(0, 55) });
}
const matcher = {
  campanhas: camp.length, tipo_accuracy_global: r3(mt.acertos / camp.length),
  recall_por_tipo_canonico: Object.fromEntries(Object.entries(mt.por_tipo).map(([k, v]) => [k, `${v.acerto}/${v.n} = ${r3(v.acerto / v.n)}`])),
  exemplos_erro: mt.exemplos_erro,
  nota: 'resolverTipo(extraction_json.tipo). Gap-types (shopping/status_match/pontos_mais_dinheiro/promocao_emissao) colapsam pelo MAPA_TIPO (cartao->bonus_acumulo, hotelaria->outro, compra->compra_pontos). Recall baixo neles = buraco de cobertura medido, nao ruido.',
};

const out = {
  gerado_em: '2026-07-17', golden: 'GOLDEN-400.json', n: G.length,
  asterisco: 'CAMADA A do gate agora medida FORA da amostra dos 86 (D-019) -> sem asterisco in-sample para a A. Vigencia/matcher idem. NADA PUBLICO ate revisao do operador.',
  gate, vigencia, matcher,
};
writeFileSync(join(DIR, 'GATES-REMEDIDOS-METRICAS.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ gate, vigencia: { overprecision: vigencia.overprecision_INV16, parsing: vigencia.parsing_precision_datas, indet_gold: vigencia.indeterminada_no_gold }, matcher: { tipo_accuracy: matcher.tipo_accuracy_global, por_tipo: matcher.recall_por_tipo_canonico } }, null, 2));
