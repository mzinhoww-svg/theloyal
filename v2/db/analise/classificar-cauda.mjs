#!/usr/bin/env node
// Roda o matcher real (seed head) sobre as distribuições reais de origem/destino
// e lista o que NÃO foi coberto — para classificarmos (programa novo | bucket | ruído).
// node v2/db/analise/classificar-cauda.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { construirIndices, classificarLado } from '../../lib/identidade.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const SEED = JSON.parse(readFileSync(join(__dir, '..', 'seed-aliases.json'), 'utf8'));
const IX = construirIndices(SEED);

for (const lado of ['origem', 'destino']) {
  const dist = JSON.parse(readFileSync(join(__dir, `dist-${lado}.json`), 'utf8'));
  const tot = dist.reduce((a, x) => a + x.n, 0);
  const b = { programa: { v: 0, l: 0 }, ruido: { v: 0, l: 0 }, bucket: { v: 0, l: 0 }, vazio: { v: 0, l: 0 } };
  const tailByKind = {};
  for (const { v, n } of dist) {
    const c = classificarLado(v, IX);
    b[c.tipo].v++; b[c.tipo].l += n;
    if (c.tipo === 'bucket') {
      (tailByKind[c.kind] ??= []).push({ v, n });
    }
  }
  const pct = (x) => `${((x / tot) * 100).toFixed(1)}%`;
  console.log(`\n================= ${lado.toUpperCase()} (${dist.length} variantes, ${tot} linhas) =================`);
  console.log(`programa (head): ${b.programa.v} variantes / ${b.programa.l} linhas (${pct(b.programa.l)})`);
  console.log(`ruído:           ${b.ruido.v} variantes / ${b.ruido.l} linhas (${pct(b.ruido.l)})`);
  console.log(`bucket (CAUDA A CLASSIFICAR): ${b.bucket.v} variantes / ${b.bucket.l} linhas (${pct(b.bucket.l)})`);
  for (const [kind, items] of Object.entries(tailByKind).sort((a, c) => c[1].reduce((s, x) => s + x.n, 0) - a[1].reduce((s, x) => s + x.n, 0))) {
    const soma = items.reduce((s, x) => s + x.n, 0);
    items.sort((a, c) => c.n - a.n);
    console.log(`\n  [${kind}] ${items.length} variantes / ${soma} linhas:`);
    console.log('   ' + items.map((x) => `${x.v}(${x.n})`).join(', '));
  }
}
