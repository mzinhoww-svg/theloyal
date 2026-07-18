// Golden do gate de revalidação de vigência do Weekly (M3.1). T1–T7 com PASS/FAIL
// explícito. O caso canônico (T2): item exibido como ativo cuja vigência no banco
// vivo já venceu na data de publicação → REPROVA. node --test v2/lib/weekly/revalidacao.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { gateRevalidacaoVigencia, chaveIdentidade } from './revalidacao.mjs';

const PUB = '2026-07-18';
const item = (o) => ({ tipo: 'transferencia', origem: 'esfera', destino: 'smiles', publico: '', ...o });
const camp = (o) => ({ tipo: 'transferencia', origem_code: 'esfera', destino_code: 'smiles', publico: '', estado: 'ativa', vigencia_fim_date: '2026-07-31', ...o });

test('chaveIdentidade: item do Weekly e linha de campaigns batem na mesma chave', () => {
  assert.equal(chaveIdentidade(item()), chaveIdentidade(camp()));
});

test('T1 — ativo com campanha viva e vigência futura → PASS', () => {
  const r = gateRevalidacaoVigencia([item()], { dataPublicacao: PUB, campaignsVivas: [camp({ vigencia_fim_date: '2026-07-31' })] });
  assert.equal(r.pass, true);
  assert.equal(r.reprovados.length, 0);
  assert.equal(r.log[0].ok, true);
});

test('T2 (canônico) — ativo cuja vigência no banco venceu antes da publicação → FAIL', () => {
  const r = gateRevalidacaoVigencia([item()], { dataPublicacao: PUB, campaignsVivas: [camp({ vigencia_fim_date: '2026-07-15' })] });
  assert.equal(r.pass, false);
  assert.equal(r.reprovados.length, 1);
  assert.match(r.reprovados[0].motivo, /vencida antes da publicação/);
});

test('T3 — ativo sem correspondência viva no banco → FAIL', () => {
  const r = gateRevalidacaoVigencia([item()], { dataPublicacao: PUB, campaignsVivas: [] });
  assert.equal(r.pass, false);
  assert.match(r.reprovados[0].motivo, /sem correspondência viva/);
});

test('T4 — ativo cuja campanha está em estado não-vivo (encerrada) → FAIL', () => {
  const r = gateRevalidacaoVigencia([item()], { dataPublicacao: PUB, campaignsVivas: [camp({ estado: 'encerrada', vigencia_fim_date: '2026-08-31' })] });
  assert.equal(r.pass, false);
  assert.match(r.reprovados[0].motivo, /estado não-vivo/);
});

test('T5 — vigência nula (indeterminada legítima) + estado vivo → PASS', () => {
  const r = gateRevalidacaoVigencia([item()], { dataPublicacao: PUB, campaignsVivas: [camp({ vigencia_fim_date: null, estado: 'detectada' })] });
  assert.equal(r.pass, true);
  assert.equal(r.log[0].ok, true);
});

test('T6 — vigência exatamente igual à data de publicação → PASS (>= publicação, não vencida)', () => {
  const r = gateRevalidacaoVigencia([item()], { dataPublicacao: PUB, campaignsVivas: [camp({ vigencia_fim_date: PUB })] });
  assert.equal(r.pass, true);
});

test('T7 — conjunto misto: reprova só os certos, log cobre todos', () => {
  const itens = [
    item({ origem: 'esfera', destino: 'smiles' }),          // viva futura → PASS
    item({ origem: 'itau', destino: 'latam_pass' }),        // vencida → FAIL
    item({ origem: 'bnb', destino: 'azul_fidelidade' }),    // sem match → FAIL
  ];
  const vivas = [
    camp({ origem_code: 'esfera', destino_code: 'smiles', vigencia_fim_date: '2026-07-31' }),
    camp({ origem_code: 'itau', destino_code: 'latam_pass', vigencia_fim_date: '2026-07-10' }),
  ];
  const r = gateRevalidacaoVigencia(itens, { dataPublicacao: PUB, campaignsVivas: vivas });
  assert.equal(r.pass, false);
  assert.equal(r.reprovados.length, 2);
  assert.equal(r.log.length, 3);
  assert.equal(r.log.filter((l) => l.ok).length, 1);
});
