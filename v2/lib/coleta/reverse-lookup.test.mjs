// Tests do reverse-lookup (Frente B). Núcleo puro + fetch injetado. node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirIndices } from '../identidade.mjs';
import {
  adapterDeCode, programasAlvo, pareiaComViva, candidatosSitemap,
  classificarDesfecho, reverseLookupLote,
} from './reverse-lookup.mjs';

// Seed mínimo com os programas do lote (aliases em forma normalizada).
const SEED = {
  programas: [
    { code: 'livelo', name: 'Livelo', kind: 'bancario', aliases: ['livelo'] },
    { code: 'esfera', name: 'Esfera', kind: 'bancario', aliases: ['esfera'] },
    { code: 'smiles', name: 'Smiles', kind: 'aereo', aliases: ['smiles', 'pagol'] },
    { code: 'tap_milesgo', name: 'TAP Miles&Go', kind: 'aereo', aliases: ['tap', 'milesgo'] },
    { code: 'hilton', name: 'Hilton Honors', kind: 'hotel', aliases: ['hilton', 'hilton honors'] },
    { code: 'accor', name: 'Accor', kind: 'hotel', aliases: ['accor', 'all accor', 'all'] },
    { code: 'bradesco', name: 'Bradesco', kind: 'bancario', aliases: ['bradesco'] },
    { code: 'banco_do_brasil', name: 'Banco do Brasil', kind: 'bancario', aliases: ['bb', 'banco do brasil'] },
  ],
  buckets: { default: 'outro', hotel: 'hotel_outro', bancario: 'banco_outro', aereo: 'aerea_outra' },
};
const IX = construirIndices(SEED);
const REF = '2026-07-17';

const URL_HILTON = 'https://www.livelo.com.br/livelo-para-parceiros/hilton-honors/HILTransfer';
const URL_ACCOR = 'https://www.livelo.com.br/livelo-para-parceiros/accor/ALLTransfer';
const HTML_HILTON = 'Transfira seus pontos. Valido das 10h do dia 01/07 ate as 23h59 do dia 31/07/2026. 50% de bonus para todos os participantes creditados em ate 48h.';
const HTML_EVERGREEN = '<title>Compra de Pontos</title> Compre pontos. Aplique seu cupom de desconto. Parcelamento em ate 12x.';

const vivaHilton = { id: 'livelo-hilton-hotelaria-2026-07-31', tipo: 'hotelaria', origem_code: 'livelo', destino_code: 'hilton', publico: 'geral', percentual: '50', tl_score_bruto: 65, veredito_bruto: 'So para casos especificos', estado: 'detectada' };
const vivaBradescoLivelo = { id: 'bradesco-livelo-transferencia-2026-08-31', tipo: 'transferencia', origem_code: 'bradesco', destino_code: 'livelo', publico: 'geral', percentual: null, tl_score_bruto: 91, veredito_bruto: 'Vale agir', estado: 'detectada' };
const vivaLiveloCompra = { id: 'livelo-livelo-compra-2026-07-24', tipo: 'compra', origem_code: 'livelo', destino_code: 'livelo', publico: 'geral', percentual: '55', tl_score_bruto: 51, veredito_bruto: 'Esperaria', estado: 'detectada' };

// ── adapterDeCode / programasAlvo ──────────────────────────────────────────
test('adapterDeCode: mapeia code do programa ao adapter', () => {
  assert.equal(adapterDeCode('livelo').programa, 'livelo');
  assert.equal(adapterDeCode('tap_milesgo').programa, 'tap_milesgo');
  assert.equal(adapterDeCode('bradesco'), null); // banco nao tem adapter
});

test('programasAlvo: so o lado com adapter entra (bradesco->livelo -> [livelo])', () => {
  assert.deepEqual(programasAlvo(vivaBradescoLivelo), ['livelo']);
  assert.deepEqual(programasAlvo(vivaHilton), ['livelo']);
  assert.deepEqual(programasAlvo({ origem_code: 'bradesco', destino_code: 'itau' }), []);
});

// ── pareiaComViva ──────────────────────────────────────────────────────────
test('pareiaComViva: casa par origem+destino; sem_destino equivalente a null', () => {
  assert.equal(pareiaComViva({ origem_code: 'livelo', destino_code: 'hilton' }, vivaHilton), true);
  assert.equal(pareiaComViva({ origem_code: 'livelo', destino_code: 'accor' }, vivaHilton), false);
  assert.equal(pareiaComViva({ origem_code: 'esfera', destino_code: null }, { origem_code: 'esfera', destino_code: 'sem_destino' }), true);
});

// ── candidatosSitemap (a varredura reversa) ────────────────────────────────
test('candidatosSitemap: acha a URL do par no sitemap oficial (livelo->hilton)', () => {
  const { candidatos, sitemaps_varridos } = candidatosSitemap({
    viva: vivaHilton, discovered: { livelo: [URL_HILTON, URL_ACCOR] }, indices: IX, ref: REF,
  });
  assert.equal(candidatos.length, 1);
  assert.equal(candidatos[0].url, URL_HILTON);
  assert.equal(sitemaps_varridos[0].programa, 'livelo');
  assert.equal(sitemaps_varridos[0].n_urls, 2);
});

test('candidatosSitemap: par sem pagina no sitemap -> zero candidatas (fila manual)', () => {
  // bradesco->livelo: varre sitemap livelo, mas livelo hospeda livelo->parceiro,
  // nao banco->livelo. Nenhuma URL casa o par -> vazio.
  const { candidatos } = candidatosSitemap({
    viva: vivaBradescoLivelo, discovered: { livelo: [URL_HILTON, URL_ACCOR] }, indices: IX, ref: REF,
  });
  assert.equal(candidatos.length, 0);
});

test('candidatosSitemap: nunca casa o par errado (accor url nao vira candidata de hilton)', () => {
  const { candidatos } = candidatosSitemap({
    viva: vivaHilton, discovered: { livelo: [URL_ACCOR] }, indices: IX, ref: REF,
  });
  assert.equal(candidatos.length, 0);
});

// ── classificarDesfecho (o corte que o operador quer) ──────────────────────
test('classificarDesfecho: sem candidata -> fila_manual', () => {
  assert.equal(classificarDesfecho(null).fila, 'fila_manual');
});
test('classificarDesfecho: corrobora_limpo -> resolvido_tier1', () => {
  assert.equal(classificarDesfecho({ resultado: 'corrobora_limpo', status_coleta: 'campanha' }).fila, 'resolvido_tier1');
});
test('classificarDesfecho: corrobora_com_ajuste -> resolvido_tier1 (separar publico)', () => {
  const d = classificarDesfecho({ resultado: 'corrobora_com_ajuste', status_coleta: 'campanha' });
  assert.equal(d.fila, 'resolvido_tier1');
  assert.match(d.rotulo, /separar por p/);
});
test('classificarDesfecho: evergreen -> candidata_nao_confirma', () => {
  assert.equal(classificarDesfecho({ resultado: 'nao_verificavel', status_coleta: 'evergreen' }).fila, 'candidata_nao_confirma');
});
test('classificarDesfecho: refuta -> candidata_nao_confirma (remove/rebaixa)', () => {
  assert.equal(classificarDesfecho({ resultado: 'refuta', status_coleta: 'campanha' }).fila, 'candidata_nao_confirma');
});

// ── reverseLookupLote (fetch injetado, dry-run) ────────────────────────────
test('reverseLookupLote: hilton resolve TIER 1; compra sem pagina -> manual', async () => {
  const vivas = [vivaHilton, vivaLiveloCompra];
  const discovered = { livelo: [URL_HILTON, URL_ACCOR] };
  const fetchImpl = async (url) => {
    if (url === URL_HILTON) return { status: 200, location: '', html: HTML_HILTON };
    return { status: 200, location: '', html: HTML_EVERGREEN };
  };
  const rel = await reverseLookupLote({ vivas, discovered, indices: IX, fetchImpl, ref: REF });

  assert.equal(rel.contagens.total, 2);
  assert.equal(rel.contagens.resolvido_tier1, 1);
  assert.equal(rel.contagens.resolvido_limpo, 1);
  assert.equal(rel.contagens.fila_manual, 1);

  const it = rel.itens.find((x) => x.id === vivaHilton.id);
  assert.equal(it.desfecho.fila, 'resolvido_tier1');
  assert.equal(it.melhor.resultado, 'corrobora_limpo');
  assert.equal(it.melhor.url_oficial, URL_HILTON);
  assert.ok(it.melhor.confianca >= 0.75);

  const man = rel.itens.find((x) => x.id === vivaLiveloCompra.id);
  assert.equal(man.desfecho.fila, 'fila_manual');
  assert.equal(man.candidatos.length, 0);
});

test('reverseLookupLote: NAO grava nada — só computa (dry-run)', async () => {
  const rel = await reverseLookupLote({ vivas: [vivaBradescoLivelo], discovered: { livelo: [URL_HILTON] }, indices: IX, fetchImpl: async () => ({ status: 200, location: '', html: HTML_HILTON }), ref: REF });
  // bradesco->livelo nao casa par no sitemap livelo -> manual, sem fetch de confirmacao.
  assert.equal(rel.itens[0].desfecho.fila, 'fila_manual');
  assert.equal(rel.contagens.resolvido_tier1, 0);
});
