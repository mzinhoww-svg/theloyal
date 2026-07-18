// Golden do GATE ÚNICO (M2.4). Não reimplementa checagem — prova o
// ENCADEAMENTO: ordem schema→dado→editorial, precedência de bloqueio, e a
// disciplina D-060 (camada de dado NUNCA bloqueia; flag vira fila de revisão).
// A cobertura de cada regra segue nos goldens dos módulos (delegação pura).
// node --test v2/lib/gate-unico.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { gate, CAMADAS } from './gate-unico.mjs';
import { DISCLAIMER } from '../../scripts/lib.mjs';

// Edição schema-válida mínima (REQUIRED de scripts/validate.mjs), deals:[] →
// dia fraco de primeira classe. O signal é GENÉRICO de propósito: passa o
// schema, mas tropeça na camada editorial (checkComuns exige número + código
// conhecido). Serve para provar "schema ok → chega no editorial → bloqueia lá".
const baseValida = {
  number: 9, date: '2026-07-18', weekday: 'SÁBADO', publishTime: '8H00',
  readingMinutes: 3, signal: 'Sinal genérico sem número nem código.', deals: [],
  sources: [{ label: 'Smiles', url: 'https://www.smiles.com.br' }], disclaimer: DISCLAIMER,
};

// Campanha flagável (padrão P2 — compra 375 > teto 300). Serve só para provar
// que a camada de DADO anota revisão sem bloquear.
const campanhaFlagavel = {
  id: 'smiles-compra', tipo: 'compra', percentual: 375,
  vigencia_fim_date: '2026-07-17', first_seen: '2026-07-15', estado: 'ultimos_dias',
  tl_score_bruto: 55, notes: 'Compra de pontos Smiles',
};

test('CAMADAS é a ordem cravada: schema → dado → editorial', () => {
  assert.deepEqual(CAMADAS, ['schema', 'dado', 'editorial']);
});

test('camada SCHEMA bloqueia primeiro — falta campo obrigatório → camada "schema"', () => {
  const semSignal = { ...baseValida, signal: '' };
  const r = gate(semSignal, {});
  assert.equal(r.pass, false);
  assert.equal(r.camada, 'schema');
  assert.ok(r.violacoes.every((v) => v.startsWith('schema:')));
  assert.ok(r.violacoes.length > 0);
});

test('schema válido → passa para editorial; violação editorial → camada "editorial"', () => {
  const r = gate(baseValida, { renderedHtml: '', hoje: baseValida.date });
  assert.equal(r.pass, false);
  assert.equal(r.camada, 'editorial');
  assert.ok(r.violacoes.every((v) => v.startsWith('editorial:')));
});

test('camada DADO nunca bloqueia (D-060): campanha flagável vira revisão, não falha por si', () => {
  const r = gate(baseValida, { campaignsFromDb: [campanhaFlagavel], renderedHtml: '', hoje: baseValida.date });
  // O gate ainda pode falhar no EDITORIAL (signal genérico), mas nunca na camada dado.
  assert.notEqual(r.camada, 'dado', 'dado jamais é a camada de bloqueio');
  assert.equal(r.revisao.length, 1, 'a fila de revisão carrega o item flagado');
  assert.equal(r.revisao[0].item.id, 'smiles-compra');
  assert.ok(r.revisao[0].flags.length >= 1);
});

test('dado limpo: sem campanhas flagáveis, revisão vazia', () => {
  const r = gate(baseValida, { campaignsFromDb: [{ ...campanhaFlagavel, percentual: 80 }], renderedHtml: '', hoje: baseValida.date });
  assert.equal(r.revisao.length, 0);
});

test('erro de schema tem precedência sobre erro editorial (não vaza para a próxima camada)', () => {
  // signal vazio (schema) + campanha flagável (dado): deve parar no schema.
  const r = gate({ ...baseValida, signal: '' }, { campaignsFromDb: [campanhaFlagavel] });
  assert.equal(r.camada, 'schema');
  assert.equal(r.revisao.length, 0, 'parou no schema — nem rodou a camada de dado');
});

test('warnings vêm prefixados pela camada de origem', () => {
  const r = gate(baseValida, { renderedHtml: '', hoje: baseValida.date });
  for (const w of r.warnings) {
    assert.ok(/^(schema|editorial): /.test(w), `warning sem prefixo de camada: ${w}`);
  }
});
