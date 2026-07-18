// Golden do wire da pré-superfície no pipeline vivo (D-060/D-061, A1).
// O caso central: um item flagável real (padrão BNB — vigência 2024 numa
// matéria de 2026) é MARCADO e carrega trilha, NUNCA sumido nem reclassificado.
// node --test v2/lib/verificacao/integrar.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { anotarRevisao, trilhaDeRevisao, EVENTO_FLAG_REVISAO } from './integrar.mjs';
import { FLAGS } from './pre-superficie.mjs';

// Padrão BNB reintroduzido: vigência terminou em 2024, mas o item foi visto pela
// primeira vez em 2026 — bug de ano na extração. É promoção real; some se o FSM
// enterrar como "historica". A pré-superfície tem de MARCAR, não enterrar.
const BNB = {
  id: 'bnb-azul-2026', identidade_id: 'ident-bnb', tipo: 'transferencia',
  percentual: 110, paridade: null, vigencia_fim_date: '2024-07-17',
  first_seen: '2026-07-15', estado: 'historica', tl_score_bruto: null,
  notes: 'Transferencia bonificada de ate 110% [confianca:baixa]',
};
const LIMPO = {
  id: 'itau-azul', identidade_id: 'ident-itau', tipo: 'transferencia',
  percentual: 115, paridade: null, vigencia_fim_date: '2026-07-20',
  first_seen: '2026-07-10', estado: 'ativa', tl_score_bruto: 55,
  notes: 'Transferencia bonificada de 115% [confianca:alta]',
};

test('BNB flagável é MARCADO (vai para paraRevisao), nunca some', () => {
  const { aprovados, paraRevisao } = anotarRevisao([BNB, LIMPO], { hoje: '2026-07-17' });
  assert.equal(aprovados.length + paraRevisao.length, 2, 'nada some — soma bate a entrada');
  const bnb = paraRevisao.find((r) => r.item.id === 'bnb-azul-2026');
  assert.ok(bnb, 'BNB está na fila de revisão');
  assert.ok(bnb.flags.some((f) => f.flag === FLAGS.VIGENCIA_BUG_ANO), 'flag de bug de ano presente');
  assert.deepEqual(aprovados.map((i) => i.id), ['itau-azul'], 'item limpo passa direto');
});

test('o item flagado continua ÍNTEGRO — não é reclassificado nem tem estado mudado', () => {
  const { paraRevisao } = anotarRevisao([BNB], { hoje: '2026-07-17' });
  const bnb = paraRevisao[0].item;
  assert.equal(bnb.estado, 'historica', 'estado intacto — flag não reclassifica');
  assert.equal(bnb.percentual, 110, 'percentual intacto');
  assert.deepEqual(bnb, BNB, 'item devolvido byte-a-byte igual à entrada');
});

test('trilha de revisão: payload_antes null (não mudou nada), payload_depois carrega os flags', () => {
  const { trilhas } = anotarRevisao([BNB], { hoje: '2026-07-17' });
  assert.equal(trilhas.length, 1, 'uma trilha por item flagado');
  const t = trilhas[0];
  assert.equal(t.evento, EVENTO_FLAG_REVISAO);
  assert.equal(t.campaign_id, 'bnb-azul-2026');
  assert.equal(t.identidade_id, 'ident-bnb');
  assert.equal(t.payload_antes, null, 'nada mudou no item — antes é null');
  assert.ok(t.payload_depois.revisao === true);
  assert.ok(t.payload_depois.flags.includes(FLAGS.VIGENCIA_BUG_ANO));
  assert.ok(t.payload_depois.motivos[0].length > 0);
});

test('item sem identidade_id ainda gera trilha (campaign_id basta)', () => {
  const semIdent = { ...BNB, identidade_id: undefined };
  const t = trilhaDeRevisao(semIdent, [{ flag: FLAGS.VIGENCIA_BUG_ANO, motivo: 'x' }], { hoje: '2026-07-17' });
  assert.equal(t.identidade_id, null);
  assert.equal(t.campaign_id, 'bnb-azul-2026');
});

test('resumo por flag agrega para o relatório do operador', () => {
  const { resumo } = anotarRevisao([BNB, LIMPO], { hoje: '2026-07-17' });
  assert.equal(resumo.total, 2);
  assert.equal(resumo.aprovados, 1);
  assert.equal(resumo.para_revisao, 1);
  assert.equal(resumo.por_flag[FLAGS.VIGENCIA_BUG_ANO], 1);
});

test('dia limpo: todos aprovados, zero trilha', () => {
  const { aprovados, paraRevisao, trilhas } = anotarRevisao([LIMPO], { hoje: '2026-07-17' });
  assert.equal(aprovados.length, 1);
  assert.equal(paraRevisao.length, 0);
  assert.equal(trilhas.length, 0);
});
