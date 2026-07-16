// Golden tests do matcher de identidade. node --test v2/lib/identidade.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizar, construirAliasMap, resolverPrograma, resolverTipo, resolverPublico,
  identityKey, parseVigenciaFim, derivarEstado, resolverCampanha, TIPOS_CANONICOS,
} from './identidade.mjs';

const PROGRAMAS = [
  { code: 'smiles', name: 'Smiles', aliases: ['smiles', 'gol smiles', 'gol'] },
  { code: 'latam_pass', name: 'LATAM Pass', aliases: ['latam pass', 'latampass', 'latam'] },
  { code: 'azul_fidelidade', name: 'Azul Fidelidade', aliases: ['azul', 'tudoazul'] },
  { code: 'livelo', name: 'Livelo', aliases: ['livelo'] },
  { code: 'esfera', name: 'Esfera', aliases: ['esfera'] },
];
const AM = construirAliasMap(PROGRAMAS);

test('normalizar: minúsculas, sem acento, espaços colapsados', () => {
  assert.equal(normalizar('  LATAM   Pass '), 'latam pass');
  assert.equal(normalizar('Fidelidade Azul'), 'fidelidade azul');
  assert.equal(normalizar('Itaú'), 'itau');
  assert.equal(normalizar('Miles&Go'), 'miles&go');
  assert.equal(normalizar(null), '');
});

test('resolverPrograma: exato e por token inteiro; desconhecido -> null', () => {
  assert.equal(resolverPrograma('LATAM Pass', AM), 'latam_pass');
  assert.equal(resolverPrograma('latampass', AM), 'latam_pass');
  assert.equal(resolverPrograma('Livelo', AM), 'livelo');
  assert.equal(resolverPrograma('Transferência Livelo para Smiles', AM), 'livelo'); // primeiro match
  assert.equal(resolverPrograma('Programa Desconhecido XPTO', AM), null);
  assert.equal(resolverPrograma('', AM), null);
});

test('resolverTipo: colapsa duplicatas nos 9 canônicos', () => {
  assert.equal(resolverTipo('transferencia'), 'transferencia_bonificada');
  assert.equal(resolverTipo('compra'), 'compra_pontos');
  assert.equal(resolverTipo('status match'), 'status_match');
  assert.equal(resolverTipo('statusmatch'), 'status_match');
  assert.equal(resolverTipo('cartao'), 'bonus_acumulo');
  assert.equal(resolverTipo('hotelaria'), 'outro');
  assert.equal(resolverTipo('estrutural'), 'outro');
  assert.equal(resolverTipo('xyz-desconhecido'), null);
  for (const t of ['transferencia', 'compra', 'clube']) {
    assert.ok(TIPOS_CANONICOS.includes(resolverTipo(t)));
  }
});

test('resolverPublico: default geral; sinais claros classificam', () => {
  assert.equal(resolverPublico({}), 'geral');
  assert.equal(resolverPublico({ notes: 'exclusivo do clube Livelo' }), 'clube');
  assert.equal(resolverPublico({ notes: 'para clientes selecionados' }), 'selecionados');
  assert.equal(resolverPublico({ valor_leitura: 'no cartão de crédito' }), 'cartao');
});

test('identityKey estável e sem vigência', () => {
  assert.equal(identityKey('transferencia_bonificada', 'livelo', 'smiles', 'geral'),
    'transferencia_bonificada|livelo|smiles|geral');
});

test('parseVigenciaFim: "na"/sujeira -> indeterminada; datas válidas -> confiável', () => {
  assert.deepEqual(parseVigenciaFim('na'), { date: null, confiavel: false });
  assert.deepEqual(parseVigenciaFim(''), { date: null, confiavel: false });
  assert.deepEqual(parseVigenciaFim('indeterminado'), { date: null, confiavel: false });
  assert.deepEqual(parseVigenciaFim(null), { date: null, confiavel: false });
  assert.deepEqual(parseVigenciaFim('2026-08-31'), { date: '2026-08-31', confiavel: true });
  assert.deepEqual(parseVigenciaFim('31/08/2026'), { date: '2026-08-31', confiavel: true });
  assert.deepEqual(parseVigenciaFim('2026-13-40'), { date: null, confiavel: false }); // inválida
});

test('derivarEstado: FSM determinística', () => {
  const ref = '2026-07-16';
  assert.equal(derivarEstado({ vigenciaFimDate: null, vigenciaConfiavel: false, ref }), 'indeterminada');
  assert.equal(derivarEstado({ vigenciaFimDate: '2026-07-18', vigenciaConfiavel: true, ref }), 'ultimos_dias'); // <=72h
  assert.equal(derivarEstado({ vigenciaFimDate: '2026-07-10', vigenciaConfiavel: true, ref }), 'encerrada');
  assert.equal(derivarEstado({ vigenciaFimDate: '2026-05-01', vigenciaConfiavel: true, ref }), 'historica'); // >30d
  assert.equal(derivarEstado({ vigenciaFimDate: '2026-09-01', vigenciaConfiavel: true, temTier1: true, ref }), 'ativa');
  assert.equal(derivarEstado({ vigenciaFimDate: '2026-09-01', vigenciaConfiavel: true, temTier1: false, ref }), 'detectada');
});

test('resolverCampanha: caminho feliz e revisão', () => {
  const ref = '2026-07-16';
  const ok = resolverCampanha(
    { origem: 'Livelo', destino: 'Smiles', tipo: 'transferencia', vigencia_fim: '2026-09-01', tier: 1 }, AM, ref);
  assert.equal(ok.resolvido, true);
  assert.equal(ok.identity_key, 'transferencia_bonificada|livelo|smiles|geral');
  assert.equal(ok.estado, 'ativa');

  const rev = resolverCampanha(
    { origem: 'Programa XPTO', destino: 'Smiles', tipo: 'transferencia', vigencia_fim: 'na' }, AM, ref);
  assert.equal(rev.resolvido, false);
  assert.match(rev.revisao, /nao_resolvido:origem/);
  assert.equal(rev.estado, 'indeterminada'); // vigência "na"
});

test('idempotência: mesma entrada -> mesma identity_key', () => {
  const c = { origem: 'LATAM Pass', destino: 'Azul', tipo: 'compra', vigencia_fim: '2026-08-01' };
  const a = resolverCampanha(c, AM, '2026-07-16');
  const b = resolverCampanha(c, AM, '2026-07-16');
  assert.equal(a.identity_key, b.identity_key);
});
