// Golden do upsert da tabela de cadência (modo C). node --test scripts/cadencia.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { upsertLinhaCadencia } from './cadencia.mjs';

const BASE = [
  '# ledger',
  '',
  '<!-- CADENCIA:START -->',
  '| Data (BRT) | Nº | Gate | Render (revisão) | Revisão do operador |',
  '|------------|----|------|------------------|---------------------|',
  '<!-- CADENCIA:END -->',
  '',
  '**Progresso:** 0/5',
].join('\n');

test('insere linha nova (verde) como pendente', () => {
  const out = upsertLinhaCadencia(BASE, { date: '2026-07-22', weekday: 'qua', number: 29, gatePass: true, renderLink: '/revisao/29' });
  assert.match(out, /\| 2026-07-22 \(qua\) \| 29 \| 🟢 VERDE \| \[\/revisao\/29\]\(\/revisao\/29\) \| pendente \|/);
  // marcadores e cauda preservados
  assert.match(out, /<!-- CADENCIA:START -->/);
  assert.match(out, /<!-- CADENCIA:END -->/);
  assert.match(out, /\*\*Progresso:\*\* 0\/5/);
});

test('gate RED sem render entra com traço', () => {
  const out = upsertLinhaCadencia(BASE, { date: '2026-07-23', weekday: 'qui', number: 30, gatePass: false, renderLink: null });
  assert.match(out, /\| 2026-07-23 \(qui\) \| 30 \| 🔴 RED \| — \| pendente \|/);
});

test('re-run PRESERVA a marca de revisão do operador', () => {
  let md = upsertLinhaCadencia(BASE, { date: '2026-07-22', weekday: 'qua', number: 29, gatePass: true, renderLink: '/revisao/29' });
  // operador marca ok
  md = md.replace('| pendente |', '| ✅ ok (2026-07-22) |');
  // runner re-roda o mesmo dia
  const out = upsertLinhaCadencia(md, { date: '2026-07-22', weekday: 'qua', number: 29, gatePass: true, renderLink: '/revisao/29' });
  assert.match(out, /\| 29 \| 🟢 VERDE \| \[\/revisao\/29\]\(\/revisao\/29\) \| ✅ ok \(2026-07-22\) \|/);
  assert.doesNotMatch(out, /pendente/);
});

test('ordena por data asc e não duplica o mesmo dia', () => {
  let md = upsertLinhaCadencia(BASE, { date: '2026-07-23', weekday: 'qui', number: 30, gatePass: true, renderLink: '/revisao/30' });
  md = upsertLinhaCadencia(md, { date: '2026-07-22', weekday: 'qua', number: 29, gatePass: true, renderLink: '/revisao/29' });
  md = upsertLinhaCadencia(md, { date: '2026-07-22', weekday: 'qua', number: 29, gatePass: true, renderLink: '/revisao/29' }); // idempotente
  const linhas = md.split('\n').filter((l) => /^\| 2026-/.test(l));
  assert.equal(linhas.length, 2, 'duas datas, sem duplicar');
  assert.ok(linhas[0].includes('2026-07-22'), 'ordem asc: 22 antes de 23');
  assert.ok(linhas[1].includes('2026-07-23'));
});

test('idempotência total: mesma entrada → markdown idêntico', () => {
  const a = upsertLinhaCadencia(BASE, { date: '2026-07-22', weekday: 'qua', number: 29, gatePass: true, renderLink: '/revisao/29' });
  const b = upsertLinhaCadencia(a, { date: '2026-07-22', weekday: 'qua', number: 29, gatePass: true, renderLink: '/revisao/29' });
  assert.equal(a, b);
});

test('marcadores ausentes → erro explícito', () => {
  assert.throws(() => upsertLinhaCadencia('# sem marcadores', { date: '2026-07-22', number: 1, gatePass: true }), /marcadores CADENCIA/);
});
