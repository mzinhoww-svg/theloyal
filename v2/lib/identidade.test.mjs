// Golden tests do matcher de identidade. node --test v2/lib/identidade.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizar, construirIndices, construirAliasMap, resolverPrograma, resolverTipo,
  resolverPublico, identityKey, parseVigenciaFim, derivarEstado, resolverCampanha,
  classificarLado, TIPOS_CANONICOS, SEM_DESTINO,
} from './identidade.mjs';

const SEED = {
  programas: [
    { code: 'smiles', name: 'Smiles', kind: 'aereo', aliases: ['smiles', 'gol'] },
    { code: 'latam_pass', name: 'LATAM Pass', kind: 'aereo', aliases: ['latampass', 'latam'] },
    { code: 'azul_fidelidade', name: 'Azul Fidelidade', kind: 'aereo', aliases: ['azul'] },
    { code: 'livelo', name: 'Livelo', kind: 'bancario', aliases: ['livelo'] },
    { code: 'esfera', name: 'Esfera', kind: 'bancario', aliases: ['esfera'] },
  ],
  ruido: ['desconhecido', 'null', 'na', 'x', 'fgts'],
  generico_recuperavel: ['banco', 'bancos', 'cartao', 'cartoes'],
  buckets: { aereo: 'aerea_outra', hotel: 'hotel_outro', varejo: 'varejo_outro', default: 'outro' },
};
const IX = construirIndices(SEED);

test('normalizar', () => {
  assert.equal(normalizar('  LATAM   Pass '), 'latam pass');
  assert.equal(normalizar('Itaú'), 'itau');
  assert.equal(normalizar(null), '');
});

test('resolverPrograma: exato, leftmost, desconhecido -> null', () => {
  assert.equal(resolverPrograma('LATAM Pass', IX.aliasMap), 'latam_pass');
  assert.equal(resolverPrograma('Transferência Livelo para Smiles', IX.aliasMap), 'livelo');
  assert.equal(resolverPrograma('XPTO', IX.aliasMap), null);
});

test('resolverTipo: colapsa duplicatas', () => {
  assert.equal(resolverTipo('transferencia'), 'transferencia_bonificada');
  assert.equal(resolverTipo('statusmatch'), 'status_match');
  assert.equal(resolverTipo('status match'), 'status_match');
  assert.equal(resolverTipo('cartao'), 'bonus_acumulo');
  assert.equal(resolverTipo('hotelaria'), 'outro');
  assert.equal(resolverTipo('xyz'), null);
});

test('classificarLado: programa | bucket | ruido | vazio', () => {
  assert.deepEqual(classificarLado('Livelo', IX).tipo, 'programa');
  assert.deepEqual(classificarLado('desconhecido', IX).tipo, 'ruido');
  assert.deepEqual(classificarLado('', IX).tipo, 'vazio');
  const b = classificarLado('Hotel Fasano Resort', IX);
  assert.equal(b.tipo, 'bucket');
  assert.equal(b.code, 'hotel_outro');
  const aer = classificarLado('Garuda Airlines', IX);
  assert.equal(aer.code, 'aerea_outra');
  assert.equal(classificarLado('Marca Nova Qualquer', IX).code, 'outro'); // fallback
});

test('parseVigenciaFim', () => {
  assert.deepEqual(parseVigenciaFim('na'), { date: null, confiavel: false });
  assert.deepEqual(parseVigenciaFim('2026-08-31'), { date: '2026-08-31', confiavel: true });
  assert.deepEqual(parseVigenciaFim('2026-13-40'), { date: null, confiavel: false });
});

test('derivarEstado FSM', () => {
  const ref = '2026-07-16';
  assert.equal(derivarEstado({ vigenciaFimDate: null, vigenciaConfiavel: false, ref }), 'indeterminada');
  assert.equal(derivarEstado({ vigenciaFimDate: '2026-07-18', vigenciaConfiavel: true, ref }), 'ultimos_dias');
  assert.equal(derivarEstado({ vigenciaFimDate: '2026-07-10', vigenciaConfiavel: true, ref }), 'encerrada');
  assert.equal(derivarEstado({ vigenciaFimDate: '2026-05-01', vigenciaConfiavel: true, ref }), 'historica');
  assert.equal(derivarEstado({ vigenciaFimDate: '2026-09-01', vigenciaConfiavel: true, temTier1: true, ref }), 'ativa');
});

test('resolverCampanha: rota normal (head)', () => {
  const r = resolverCampanha({ origem: 'Livelo', destino: 'Smiles', tipo: 'transferencia', vigencia_fim: '2026-09-01', tier: 1 }, IX, '2026-07-16');
  assert.equal(r.resolvido, true);
  assert.equal(r.identity_key, 'transferencia_bonificada|livelo|smiles|geral');
  assert.equal(r.lado_unico, false);
  assert.equal(r.estado, 'ativa');
});

test('regra por tipo: transferência SEM destino -> revisão', () => {
  const r = resolverCampanha({ origem: 'Livelo', destino: 'desconhecido', tipo: 'transferencia', vigencia_fim: '2026-09-01' }, IX, '2026-07-16');
  assert.equal(r.resolvido, false);
  assert.equal(r.revisao, 'transferencia_sem_destino');
});

test('regra por tipo: compra SEM destino -> lado único', () => {
  const r = resolverCampanha({ origem: 'Smiles', destino: 'desconhecido', tipo: 'compra', vigencia_fim: '2026-09-01' }, IX, '2026-07-16');
  assert.equal(r.resolvido, true);
  assert.equal(r.lado_unico, true);
  assert.equal(r.destinoCode, SEM_DESTINO);
  assert.equal(r.identity_key, `compra_pontos|smiles|${SEM_DESTINO}|geral`);
});

test('origem ruído/vazio -> revisão com flag origem_nao_resolvida', () => {
  const r1 = resolverCampanha({ origem: 'desconhecido', destino: 'Smiles', tipo: 'transferencia' }, IX, '2026-07-16');
  assert.equal(r1.revisao, 'origem_nao_resolvida');
  assert.equal(r1.origem_ruido_tipo, 'ruido');
  const r2 = resolverCampanha({ origem: '', destino: 'Smiles', tipo: 'compra' }, IX, '2026-07-16');
  assert.equal(r2.revisao, 'origem_nao_resolvida');
  assert.equal(r2.origem_ruido_tipo, 'vazio');
});

test('origem genérica recuperável -> sub-motivo distinto do lixo', () => {
  // genérico NÃO-transferência (cartão sem destino real) -> recuperável (banco específico perdido)
  const g = resolverCampanha({ origem: 'cartao', destino: 'desconhecido', tipo: 'cartao' }, IX, '2026-07-16');
  assert.equal(g.revisao, 'origem_generica_recuperavel');
  const j = resolverCampanha({ origem: 'fgts', destino: 'Smiles', tipo: 'transferencia' }, IX, '2026-07-16');
  assert.equal(j.revisao, 'origem_nao_resolvida');
});

test('guard self-loop (D-041): transferência origem==destino -> revisão, mapa intacto', () => {
  // 'gol' é alias de smiles (como PagoGol na base real): smiles->gol resolve
  // smiles->smiles = self-loop. Não emite identidade pontuável; vai p/ revisão.
  const s = resolverCampanha({ origem: 'Smiles', destino: 'gol', tipo: 'transferencia', vigencia_fim: '2026-09-01' }, IX, '2026-07-16');
  assert.equal(s.resolvido, false);
  assert.equal(s.revisao, 'transferencia_self_loop');
  assert.equal(s.origemCode, 'smiles');
  // rota legítima (origem != destino) segue resolvendo normal — guard não vaza.
  const ok = resolverCampanha({ origem: 'Livelo', destino: 'Smiles', tipo: 'transferencia', vigencia_fim: '2026-09-01' }, IX, '2026-07-16');
  assert.equal(ok.resolvido, true);
  // self-loop só vale p/ transferência: compra origem==destino não é barrada aqui.
  const c = resolverCampanha({ origem: 'Smiles', destino: 'gol', tipo: 'compra', vigencia_fim: '2026-09-01' }, IX, '2026-07-16');
  assert.equal(c.resolvido, true);
});

test('multi-banco: origem genérica + transferência + destino real -> multiplos_cartoes', () => {
  // "até 90% na transferência do cartão de crédito -> Smiles" (genérico legítimo)
  const m = resolverCampanha({ origem: 'cartoes', destino: 'Smiles', tipo: 'transferencia', vigencia_fim: '2026-09-01' }, IX, '2026-07-16');
  assert.equal(m.resolvido, true);
  assert.equal(m.origemCode, 'multiplos_cartoes');
  assert.equal(m.publico, 'cartao');
  assert.equal(m.multi_banco, true);
  assert.equal(m.identity_key, 'transferencia_bonificada|multiplos_cartoes|smiles|cartao');
  // genérico NÃO-transferência (ex.: cartão sem destino real) -> continua recuperável
  const r = resolverCampanha({ origem: 'cartao', destino: 'desconhecido', tipo: 'cartao' }, IX, '2026-07-16');
  assert.equal(r.resolvido, false);
  assert.equal(r.revisao, 'origem_generica_recuperavel');
});

test('cauda -> bucket, marcado bucketed', () => {
  const r = resolverCampanha({ origem: 'Livelo', destino: 'Hotel Bourbon Resort', tipo: 'transferencia', vigencia_fim: '2026-09-01' }, IX, '2026-07-16');
  assert.equal(r.resolvido, true);
  assert.equal(r.destinoCode, 'hotel_outro');
  assert.equal(r.bucketed, true);
});

test('tipo indefinido -> revisão', () => {
  assert.equal(resolverCampanha({ origem: 'Livelo', destino: 'Smiles', tipo: 'xyz' }, IX, '2026-07-16').revisao, 'tipo_indefinido');
});

test('idempotência: mesma entrada -> mesma identity_key', () => {
  const c = { origem: 'LATAM', destino: 'Azul', tipo: 'compra', vigencia_fim: '2026-08-01' };
  assert.equal(resolverCampanha(c, IX, '2026-07-16').identity_key, resolverCampanha(c, IX, '2026-07-16').identity_key);
});

test('construirAliasMap compat', () => {
  const am = construirAliasMap(SEED.programas);
  assert.equal(resolverPrograma('gol', am), 'smiles');
});
