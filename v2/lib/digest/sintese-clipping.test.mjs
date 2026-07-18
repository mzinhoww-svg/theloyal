// Golden do anti-cópia + validação da síntese do Clipping (M2.7).
// Prova: síntese própria PASSA; trecho copiado do título/conteúdo FALHA no
// anti-cópia; emoji/urgência FALHAM; e o limiar 0,35 separa paráfrase de cópia.
// Integração: com ≥5 sínteses próprias, o Clipping deixa de ser OMITIDO na
// montagem e a edição passa o gate único (dia fraco real vira dia com Clipping).
// node --test v2/lib/digest/sintese-clipping.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  overlapNgram, passaAntiCopia, validarSintese, montarPromptSintese,
  LIMIAR_ANTICOPIA, MIN_CHARS_SINTESE,
} from './sintese-clipping.mjs';
import { montarEdicaoDoDia, reconstruirConjuntoVivo, resolverNumeroEdicao } from './montar-edicao.mjs';
import { renderBeehiivHtml } from './render-beehiiv.mjs';
import { gate } from '../gate-unico.mjs';

// Notícia-fonte realista (shape de news_raw: title + content).
const NOTICIA = {
  title: 'Smiles lança bônus de 100% em transferências de pontos de bancos parceiros',
  content:
    'A Smiles anunciou nesta terça-feira um bônus de 100% na transferência de pontos para o programa a partir de bancos parceiros. ' +
    'A promoção vale até o fim da semana e cobre transferências feitas pelo aplicativo. Segundo a empresa, é a maior campanha do trimestre.',
  source: 'pontospravoar',
};

// Síntese PRÓPRIA (paráfrase, palavras próprias, estrutura diferente da fonte).
const SINTESE_PROPRIA =
  'Smiles dobrou temporariamente o incentivo para migrar pontos vindos de instituições parceiras, e a janela se encerra no domingo.';

// Trecho COPIADO literalmente do conteúdo da fonte.
const SINTESE_COPIADA =
  'um bônus de 100% na transferência de pontos para o programa a partir de bancos parceiros';

// ── overlapNgram ──
test('overlapNgram: síntese própria tem overlap baixo (redação nova)', () => {
  const o = overlapNgram(SINTESE_PROPRIA, `${NOTICIA.title}\n${NOTICIA.content}`);
  assert.ok(o < LIMIAR_ANTICOPIA, `esperado < ${LIMIAR_ANTICOPIA}, veio ${o.toFixed(3)}`);
});

test('overlapNgram: trecho copiado tem overlap alto (perto de 1,0)', () => {
  const o = overlapNgram(SINTESE_COPIADA, `${NOTICIA.title}\n${NOTICIA.content}`);
  assert.ok(o >= 0.9, `esperado ≥ 0,9 (cópia literal), veio ${o.toFixed(3)}`);
});

// ── prova do limiar: paráfrase de um lado, cópia do outro ──
test('LIMIAR_ANTICOPIA=0,35 separa paráfrase de cópia', () => {
  assert.equal(LIMIAR_ANTICOPIA, 0.35);
  const oPropria = overlapNgram(SINTESE_PROPRIA, `${NOTICIA.title}\n${NOTICIA.content}`);
  const oCopiada = overlapNgram(SINTESE_COPIADA, `${NOTICIA.title}\n${NOTICIA.content}`);
  assert.ok(oPropria < LIMIAR_ANTICOPIA, `paráfrase ${oPropria.toFixed(3)} deve ficar abaixo`);
  assert.ok(oCopiada >= LIMIAR_ANTICOPIA, `cópia ${oCopiada.toFixed(3)} deve ficar acima`);
  assert.ok(oCopiada - oPropria > 0.5, 'a separação entre cópia e paráfrase é ampla (margem do limiar)');
});

// ── passaAntiCopia ──
test('passaAntiCopia: própria passa, copiada não passa', () => {
  const fonte = `${NOTICIA.title}\n${NOTICIA.content}`;
  assert.equal(passaAntiCopia(SINTESE_PROPRIA, fonte), true);
  assert.equal(passaAntiCopia(SINTESE_COPIADA, fonte), false);
});

// ── validarSintese ──
test('validarSintese: síntese própria PASSA (ok, sem motivos)', () => {
  const r = validarSintese(SINTESE_PROPRIA, NOTICIA);
  assert.equal(r.ok, true, `motivos inesperados: ${r.motivos.join(' | ')}`);
  assert.deepEqual(r.motivos, []);
});

test('validarSintese: trecho copiado FALHA no anti-cópia (vai para revisão)', () => {
  const r = validarSintese(SINTESE_COPIADA, NOTICIA);
  assert.equal(r.ok, false);
  assert.ok(r.motivos.some((m) => /anti-c[óo]pia/.test(m)), `motivos: ${r.motivos.join(' | ')}`);
});

test('validarSintese: síntese com emoji FALHA', () => {
  const r = validarSintese('Smiles dobrou o incentivo para migrar pontos de parceiros esta semana 🚀', NOTICIA);
  assert.equal(r.ok, false);
  assert.ok(r.motivos.some((m) => /[Ee]moji/.test(m)), `motivos: ${r.motivos.join(' | ')}`);
});

test('validarSintese: síntese com urgência artificial FALHA', () => {
  const r = validarSintese('Corra: Smiles dobrou o incentivo para migrar pontos de parceiros nesta semana.', NOTICIA);
  assert.equal(r.ok, false);
  assert.ok(r.motivos.some((m) => /[Uu]rg[êe]ncia/.test(m)), `motivos: ${r.motivos.join(' | ')}`);
});

test('validarSintese: síntese vazia ou curta demais FALHA', () => {
  assert.equal(validarSintese('', NOTICIA).ok, false);
  assert.equal(validarSintese('   ', NOTICIA).ok, false);
  const curta = validarSintese('Smiles bonificou.', NOTICIA);
  assert.equal(curta.ok, false);
  assert.ok(curta.motivos.some((m) => /curta demais/.test(m)));
  assert.ok('Smiles bonificou.'.length < MIN_CHARS_SINTESE);
});

// ── montarPromptSintese ──
test('montarPromptSintese: instrui redação própria, sem emoji/urgência/promessa, em JSON', () => {
  const { system, user } = montarPromptSintese(NOTICIA);
  assert.match(system, /S[ÍI]NTESE PR[ÓO]PRIA/i);
  assert.match(system, /N[ÃA]O copie/i);
  assert.match(system, /emoji/i);
  assert.match(system, /urg[êe]ncia/i);
  assert.match(system, /"summary"/);
  assert.match(user, /Smiles/); // título/conteúdo da notícia entram no user
});

// ── INTEGRAÇÃO: Clipping deixa de ser omitido com ≥5 sínteses próprias ──
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAW = JSON.parse(readFileSync(join(AQUI, 'fixtures', 'campanhas-historico.json'), 'utf8')).campaigns;

// 5 notícias com síntese PRÓPRIA já validada (o que o passo de ingest gravaria em
// news_raw.summary depois de passar o anti-cópia).
function newsComSintese() {
  const base = [
    { id: 'n1', source: 'pontospravoar', url: 'https://pontospravoar.com/livelo-bonus-aereas', title: 'Livelo abre bônus para transferências a companhias aéreas', content: 'A Livelo liberou bônus em transferências para parceiros aéreos nesta semana.', summary: 'A Livelo passou a oferecer bônus extra em migrações para programas aéreos parceiros, válido por poucos dias.' },
    { id: 'n2', source: 'melhorescartoes', url: 'https://melhorescartoes.com.br/acumulo-internacional', title: 'Cartão amplia acúmulo em compras internacionais', content: 'Emissor anunciou acúmulo maior no exterior.', summary: 'Um emissor elevou o ritmo de pontuação em gastos fora do país, mudança que afeta quem viaja com frequência.' },
    { id: 'n3', source: 'melhoresdestinos', url: 'https://melhoresdestinos.com.br/hotel-resgates', title: 'Programa de hotel revisa tabela de resgates', content: 'Rede hoteleira ajustou o custo em pontos de diárias.', summary: 'Uma rede de hotéis reprecificou diárias em pontos, encarecendo algumas categorias e barateando outras.' },
    { id: 'n4', source: 'pontospravoar', url: 'https://pontospravoar.com/compra-pontos-desconto', title: 'Compra de pontos ganha desconto por tempo limitado', content: 'Programa ofereceu desconto na compra de pontos.', summary: 'Um programa reduziu o preço da compra direta de pontos por alguns dias, sinalizando estoque a girar.' },
    { id: 'n5', source: 'passageirodeprimeira', url: 'https://passageirodeprimeira.com/clube-pontos-banco', title: 'Banco lança clube de pontos com mensalidade', content: 'Novo clube cobra mensalidade e credita pontos fixos.', summary: 'Um banco estruturou um clube pago que credita pontos fixos por mês, formato que só compensa acima de certo gasto.' },
  ];
  // Confirma que cada síntese passa o próprio crivo (o ingest só grava as que passam).
  for (const n of base) {
    const v = validarSintese(n.summary, n);
    assert.equal(v.ok, true, `síntese de ${n.id} deveria passar: ${v.motivos.join(' | ')}`);
  }
  return base.map((n) => ({ ...n, processed: true, published_at: '2026-07-15' }));
}

test('INTEGRAÇÃO: dia fraco real + 5 sínteses próprias → Clipping surfaceliza e gate VERDE', () => {
  const asOf = '2026-07-15';
  const camps = reconstruirConjuntoVivo(RAW, asOf);
  const { number } = resolverNumeroEdicao(asOf, [{ number: 1, date: '2026-07-17' }]);

  // Sem summaries: Clipping omitido (o buraco que a slice fecha).
  const semSintese = montarEdicaoDoDia({ asOf, campaigns: camps, newsRaw: [], forecast: null, number });
  assert.equal(semSintese.clipping, undefined, 'sem síntese, Clipping é omitido (regra-mãe)');

  // Com 5 sínteses próprias: Clipping presente, ≥5 itens, cada um com fonte.
  const comSintese = montarEdicaoDoDia({ asOf, campaigns: camps, newsRaw: newsComSintese(), forecast: null, number });
  assert.ok(Array.isArray(comSintese.clipping), 'com síntese, Clipping aparece');
  assert.ok(comSintese.clipping.length >= 5, `esperado ≥5 itens, veio ${comSintese.clipping?.length}`);
  for (const item of comSintese.clipping) {
    assert.ok(item.summary && item.summary.trim(), 'cada item carrega síntese');
    assert.ok(item.source && item.url && item.title, 'cada item carrega fonte + url + título');
  }

  // Gate único VERDE sobre a edição com Clipping.
  const veredito = gate(comSintese, { campaignsFromDb: camps, renderedHtml: renderBeehiivHtml(comSintese), now: asOf, hoje: asOf });
  assert.equal(veredito.pass, true, `gate deveria passar; violações: ${(veredito.violacoes || []).join(' | ')}`);
});

// Piso RÍGIDO preservado: 4 sínteses próprias não enchem o Clipping.
test('INTEGRAÇÃO: piso rígido — 4 sínteses próprias mantêm o Clipping omitido', () => {
  const asOf = '2026-07-15';
  const camps = reconstruirConjuntoVivo(RAW, asOf);
  const { number } = resolverNumeroEdicao(asOf, [{ number: 1, date: '2026-07-17' }]);
  const quatro = newsComSintese().slice(0, 4);
  const ed = montarEdicaoDoDia({ asOf, campaigns: camps, newsRaw: quatro, forecast: null, number });
  assert.equal(ed.clipping, undefined, '4 < piso de 5 → omitido, nunca preenche com menos');
});
