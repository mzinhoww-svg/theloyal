// Golden tests da verificação pré-publicação (D-060) — os 5 casos reais que
// motivaram cada check, mais os limites. O caso BB Ourocard (número ausente da
// fonte) está documentado no módulo como NÃO automatizável aqui (dono: D-045).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLAGS, confiancaDe, checkSanidadeVigencia, checkTipoOferta,
  checkConfiancaDestaque, verificarPreSuperficie,
} from './pre-superficie.mjs';

// ── casos reais (estado ANTES das correções D-060) ──────────────────────────
const BNB = {
  id: 'bnb-azul', tipo: 'transferencia', percentual: '110', paridade: null,
  vigencia_fim_date: '2024-07-17', first_seen: '2026-07-15', estado: 'historica',
  tl_score_bruto: null, notes: 'Transferencia bonificada de ate 110% [confianca:baixa]',
};
const FLYING_BLUE = {
  id: 'flyingblue-flyingblue', tipo: 'compra', percentual: '45', paridade: null,
  vigencia_fim_date: null, first_seen: '2026-07-16', estado: 'indeterminada',
  tl_score_bruto: 65, notes: 'Compra de milhas com até 45% de desconto [confianca:baixa]',
};
const ALIEXPRESS = {
  id: 'livelo-aliexpress', tipo: 'compra', percentual: '25', paridade: 'pontos por dolar',
  vigencia_fim_date: '2026-07-23', first_seen: '2026-07-16', estado: 'detectada',
  tl_score_bruto: 60, notes: '25 pontos Livelo por dolar gasto no AliExpress [confianca:baixa]',
};
const BRADESCO = {
  id: 'bradesco-livelo', tipo: 'transferencia', percentual: null, paridade: null,
  vigencia_fim_date: '2026-08-31', first_seen: '2026-07-16', estado: 'detectada',
  tl_score_bruto: null, notes: 'Sorteio de pontos Livelo [confianca:baixa]',
};
const CAIXA = {
  id: 'caixa-cartao', tipo: 'cartao', percentual: '100', paridade: null,
  vigencia_fim_date: '2027-12-31', first_seen: '2026-07-16', estado: 'detectada',
  tl_score_bruto: 50, notes: '100% de cashback no IOF em compras internacionais [confianca:baixa]',
};
const LIMPA = {
  id: 'smiles-compra', tipo: 'compra', percentual: '375', paridade: null,
  vigencia_fim_date: '2026-07-17', first_seen: '2026-07-15', estado: 'ultimos_dias',
  tl_score_bruto: 55, notes: 'Compra de pontos Smiles',
};

test('confiancaDe: extrai o rótulo de notes; ausente vira null', () => {
  assert.equal(confiancaDe('foo [confianca:baixa]'), 'baixa');
  assert.equal(confiancaDe('bar [confianca:ALTA]'), 'alta');
  assert.equal(confiancaDe('sem tag'), null);
  assert.equal(confiancaDe(null), null);
});

test('BNB: vigência 2024 com first_seen 2026 flagra bug de ano — nunca descarta', () => {
  const flags = checkSanidadeVigencia(BNB);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].flag, FLAGS.VIGENCIA_BUG_ANO);
});

test('Flying Blue: valor sem data flagra (promo real invisível como indeterminada)', () => {
  const flags = checkSanidadeVigencia(FLYING_BLUE);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].flag, FLAGS.VALOR_SEM_DATA);
});

test('indeterminada SEM valor não flagra (não é o padrão Flying Blue)', () => {
  const flags = checkSanidadeVigencia({ ...FLYING_BLUE, tl_score_bruto: null });
  assert.equal(flags.length, 0);
});

test('vigência pouco antes do first_seen (fim de campanha) NÃO flagra bug de ano', () => {
  const ok = { ...BNB, vigencia_fim_date: '2026-07-10', estado: 'encerrada' };
  assert.equal(checkSanidadeVigencia(ok).length, 0);
});

test('AliExpress: paridade "pontos por dolar" com tipo compra flagra acúmulo', () => {
  const flags = checkTipoOferta(ALIEXPRESS);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].flag, FLAGS.TIPO_ACUMULO);
});

test('Bradesco: notes de sorteio com tipo transferencia flagra', () => {
  const flags = checkTipoOferta(BRADESCO);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].flag, FLAGS.TIPO_SORTEIO);
});

test('Caixa: IOF com percentual preenchido flagra benefício de tarifa', () => {
  const flags = checkTipoOferta(CAIXA);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].flag, FLAGS.TIPO_TARIFA);
});

test('tipo já corrigido não flagra (sorteio como sorteio, shopping com paridade)', () => {
  assert.equal(checkTipoOferta({ ...BRADESCO, tipo: 'sorteio' }).length, 0);
  assert.equal(checkTipoOferta({ ...ALIEXPRESS, tipo: 'shopping' }).length, 0);
});

test('confiança baixa + nota de destaque flagra; nota baixa ou confiança alta não', () => {
  assert.equal(checkConfiancaDestaque(FLYING_BLUE).length, 1);
  assert.equal(checkConfiancaDestaque(FLYING_BLUE)[0].flag, FLAGS.CONFIANCA_BAIXA_DESTAQUE);
  assert.equal(checkConfiancaDestaque(CAIXA).length, 0); // 50 < 60
  assert.equal(checkConfiancaDestaque({ ...FLYING_BLUE, notes: 'x [confianca:alta]' }).length, 0);
});

test('verificarPreSuperficie: nada some — flagados vão para revisão COM o item, limpos passam', () => {
  const itens = [BNB, FLYING_BLUE, ALIEXPRESS, BRADESCO, CAIXA, LIMPA];
  const { aprovados, paraRevisao } = verificarPreSuperficie(itens);
  assert.equal(aprovados.length + paraRevisao.length, itens.length);
  assert.deepEqual(aprovados.map((i) => i.id), ['smiles-compra']);
  assert.equal(paraRevisao.length, 5);
  for (const r of paraRevisao) {
    assert.ok(r.item && r.flags.length >= 1, 'item flagado carrega o item e ao menos 1 flag');
  }
});
