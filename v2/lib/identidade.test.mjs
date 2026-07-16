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
  ruido: ['desconhecido', 'null', 'na', 'banco', 'x'],
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

test('origem ruído/vazio -> revisão', () => {
  assert.equal(resolverCampanha({ origem: 'desconhecido', destino: 'Smiles', tipo: 'transferencia' }, IX, '2026-07-16').revisao, 'origem_ruido');
  assert.equal(resolverCampanha({ origem: '', destino: 'Smiles', tipo: 'compra' }, IX, '2026-07-16').revisao, 'origem_vazio');
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
