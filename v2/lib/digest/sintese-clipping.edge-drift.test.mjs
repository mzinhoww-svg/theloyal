// Drift-guard: o crivo anti-cópia existe em DOIS lugares — o módulo Node
// (v2/lib/digest/sintese-clipping.mjs, autoridade dos testes + montagem) e o
// espelho Deno (supabase/functions/_shared/anticopia.ts, onde a síntese REAL roda,
// porque a chave do OpenRouter vive só no ambiente das edge functions). Se os
// limiares divergirem, um lado publica o que o outro reprova. Este teste lê o TS do
// edge e reprova o CI se qualquer constante do crivo sair de sincronia com o Node.
// node --test v2/lib/digest/sintese-clipping.edge-drift.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  LIMIAR_ANTICOPIA, MAX_RUN_COPIA, MAX_PALAVRAS_SINTESE, MIN_CHARS_SINTESE,
} from './sintese-clipping.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const EDGE = readFileSync(join(AQUI, '..', '..', '..', 'supabase', 'functions', '_shared', 'anticopia.ts'), 'utf8');

function constDoEdge(nome) {
  const m = new RegExp(`export const ${nome}\\s*=\\s*([0-9.]+)`).exec(EDGE);
  assert.ok(m, `constante ${nome} não encontrada no edge anticopia.ts`);
  return Number(m[1]);
}

test('limiares do crivo Deno == Node (sem drift)', () => {
  assert.equal(constDoEdge('LIMIAR_ANTICOPIA'), LIMIAR_ANTICOPIA);
  assert.equal(constDoEdge('MAX_RUN_COPIA'), MAX_RUN_COPIA);
  assert.equal(constDoEdge('MAX_PALAVRAS_SINTESE'), MAX_PALAVRAS_SINTESE);
  assert.equal(constDoEdge('MIN_CHARS_SINTESE'), MIN_CHARS_SINTESE);
});

test('o edge exporta as funções do crivo usadas pela síntese', () => {
  for (const fn of ['overlapNgram', 'maiorRunContiguo', 'validarSintese', 'montarPromptSintese']) {
    assert.ok(new RegExp(`export function ${fn}\\b`).test(EDGE), `edge deve exportar ${fn}`);
  }
});
