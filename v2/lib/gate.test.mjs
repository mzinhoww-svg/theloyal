// Não-regressão da camada A do gate (D-017). node --test v2/lib/gate.test.mjs
// Invariantes: (1) regra que classifica hoje classifica igual amanhã;
//              (2) camada A NUNCA rejeita campanha real (precision 1,0 é invariante).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { camadaA, issuersDoSeed } from './gate.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const rot = JSON.parse(readFileSync(join(DIR, '..', 'golden', 'AMOSTRA-100-ROTULADA.json'), 'utf8'));
const seed = JSON.parse(readFileSync(join(DIR, '..', 'db', 'seed-aliases.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(DIR, '..', 'golden', 'GATE-A-LOCK.json'), 'utf8'));
const ISSUERS = issuersDoSeed(seed);
const toInput = (r) => ({
  news_item_id: r.id, titulo: r.input?.titulo || '', trecho: r.input?.trecho || '',
  tipo: r.extracao_atual?.tipo, percentual: r.extracao_atual?.percentual,
  origem: r.extracao_atual?.origem, destino: r.extracao_atual?.destino,
});
const A = (r) => camadaA(toInput(r), { issuers: ISSUERS });
const byId = new Map(rot.map((r) => [r.id, r]));

test('invariante D-017: camada A NUNCA rejeita campanha real', () => {
  const falsos = rot.filter((r) => r.classe === 'campanha' && A(r).rejeitado)
    .map((r) => `${r.id} -> ${A(r).motivo}`);
  assert.deepEqual(falsos, [], `camada A derrubou campanha(s) real(is): ${falsos.join('; ')}`);
});

test('lock: cada rejeição determinística mantém id+motivo congelados', () => {
  for (const { id, motivo } of lock) {
    const r = byId.get(id);
    assert.ok(r, `id do lock sumiu do golden: ${id}`);
    const d = A(r);
    assert.equal(d.rejeitado, true, `deixou de rejeitar: ${id}`);
    assert.equal(d.motivo, motivo, `motivo mudou p/ ${id}: ${d.motivo} != ${motivo}`);
    assert.ok(d.evidencia && d.evidencia.length > 0, `sem evidência: ${id}`);
  }
});

test('lock: conjunto de rejeições determinísticas é exatamente o congelado (sem drift)', () => {
  const atual = rot.filter((r) => A(r).rejeitado).map((r) => r.id).sort();
  const travado = lock.map((x) => x.id).sort();
  assert.deepEqual(atual, travado, 'a camada A driftou (novas ou perdidas rejeições vs GATE-A-LOCK.json)');
});

test('guard de emissor: promo de programa não vira cupom (Smiles desconto no resgate)', () => {
  const r = byId.get('latampass-smiles-transferencia-na');
  assert.equal(A(r).rejeitado ?? false, false, 'camada A não pode rejeitar promo de programa emissor');
});
