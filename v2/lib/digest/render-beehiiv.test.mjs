// Golden do render Beehiiv (dialeto Tiptap) no formato v4 (D-059) — usa a
// EDIÇÃO CANÔNICA nº 1 (content/editions/0001.json) como fixture de verdade:
// é exatamente o ponto do backport — rascunho aprovado e engine nunca mais
// divergem. node --test v2/lib/digest/render-beehiiv.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  renderBeehiivHtml, IMG_HEADER, IMG_SECAO_SINAL, IMG_SECAO_FECHA, IMG_DIVISOR_LINHA, IMG_FOOTER,
} from './render-beehiiv.mjs';
import { lintJargao, EXPLICA_SEM_NOTA } from './editorial.mjs';
import { DISCLAIMER } from '../../../scripts/lib.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const ed0001 = JSON.parse(readFileSync(join(DIR, '..', '..', '..', 'content', 'editions', '0001.json'), 'utf8'));

test('0001: nunca <table> (limitação Tiptap) e imagens do template na ordem certa', () => {
  const html = renderBeehiivHtml(ed0001);
  assert.ok(!html.includes('<table'), 'Tiptap descarta estilo de tabela — nunca <table>');
  const iHeader = html.indexOf(IMG_HEADER);
  const iSinal = html.indexOf(IMG_SECAO_SINAL);
  const iFecha = html.indexOf('<h2>Vence em até 72h</h2>');
  const iDivisor = html.indexOf(IMG_DIVISOR_LINHA);
  const iFooter = html.indexOf(IMG_FOOTER);
  assert.ok(!html.includes(IMG_SECAO_FECHA), 'arte com o nome antigo (FECHA LOGO) não entra');
  assert.ok(html.startsWith(`<img src="${IMG_HEADER}"`), 'o documento abre com o header de marca');
  assert.ok(iHeader >= 0 && iSinal > iHeader && iFecha > iSinal && iDivisor > iFecha && iFooter > iDivisor,
    `ordem inesperada: header=${iHeader} sinal=${iSinal} venceEm72h=${iFecha} divisor=${iDivisor} footer=${iFooter}`);
});

test('0001: linha meta — Nº 1 · SEXTA-FEIRA · 17/07/2026 · leitura de 4 min', () => {
  const html = renderBeehiivHtml(ed0001);
  assert.ok(html.includes('Nº 1 · SEXTA-FEIRA · 17/07/2026 · leitura de 4 min'));
});

test('0001: Sinal do dia — h3 com a manchete + item confirmado com números em negrito e fonte oficial', () => {
  const html = renderBeehiivHtml(ed0001);
  assert.ok(html.includes(`<h3>${ed0001.signal}</h3>`));
  assert.ok(html.includes('<strong>375%</strong>'), 'números do item confirmado em negrito');
  assert.ok(html.includes('<strong>R$ 16,84</strong>'));
  assert.ok(html.includes('>fonte oficial</a>'));
  assert.ok(html.includes('data-background-color="#F1ECE1"'), 'caixa do sinal em paper-dark');
});

test('0001: radar sem confirmação dentro do Sinal — 4 itens linkados, TL só quando há nota', () => {
  const html = renderBeehiivHtml(ed0001);
  assert.ok(html.includes('No radar, ainda sem confirmação oficial:'));
  for (const r of ed0001.radarSemConfirmacao) {
    assert.ok(html.includes(`href="${r.url}"`), `item "${r.titulo}" linkado à fonte`);
  }
  assert.ok(html.includes('TL 65'), 'nota presente é exibida');
  assert.ok(html.includes('vence 17/07'));
});

test('0001: narrativa do Predict no Sinal — probabilidade visível, sem seção formal Predict', () => {
  const html = renderBeehiivHtml(ed0001);
  assert.ok(html.includes(ed0001.predictNarrativa.texto));
  assert.ok(!html.includes('>PREDICT<'), 'sem janela alta-confiança não há teaser formal');
});

test('0001: Ofertas ativas — rota própria (Smiles → Smiles), CPM por milheiro, leitura em caps', () => {
  const html = renderBeehiivHtml(ed0001);
  assert.ok(html.includes('<h2>Ofertas ativas</h2>'));
  assert.ok(html.includes('Smiles → Smiles'), 'compra exibe o próprio programa — regra do operador');
  assert.ok(!html.includes('sem_destino'));
  assert.ok(!/→\s*sem destino/i.test(html));
  assert.ok(html.includes('375%'));
  assert.ok(html.includes('R$ 16,84'));
  assert.ok(html.includes('por milheiro'));
  assert.ok(html.includes('Compra de pontos (Clube)'));
  assert.ok(html.includes('SÓ PARA CASOS ESPECÍFICOS'));
});

test('0001: deals=[] → seção Deals do dia e Conta feita ausentes (regra-mãe)', () => {
  const html = renderBeehiivHtml(ed0001);
  assert.ok(!html.includes('Deals do dia'));
  assert.ok(!html.includes('CONTA FEITA'));
});

test('0001: Fecha Logo — caixa amarela (fill yellow-100, borda yellow-500) com 3 itens e fonte', () => {
  const html = renderBeehiivHtml(ed0001);
  assert.ok(html.includes('data-background-color="#FCF0CE"'));
  assert.ok(html.includes('data-border-color="#F2C94C"'));
  assert.equal((html.match(/VENCE HOJE/g) || []).length, 3);
  assert.ok(html.includes('>fonte</a>'));
});

test('0001: Cartões e bancos — H2 em TEXTO português (nunca a arte em inglês), intro canônica, 5 itens', () => {
  const html = renderBeehiivHtml(ed0001);
  assert.ok(html.includes('<h2>Cartões e bancos</h2>'));
  assert.ok(!/bank.*cards|cards.*watch/i.test(html), 'a arte "Bank & Cards Watch" não entra');
  assert.ok(html.includes(EXPLICA_SEM_NOTA));
  for (const c of ed0001.cartoesBancosItens) {
    assert.ok(html.includes(`href="${c.url}"`), `item "${c.nome}" com fonte linkada`);
  }
  assert.ok(html.includes('fora da régua TL'));
});

test('0001: Clipping ordenado por relevância — acionáveis no topo, hotel no fim, sem rótulo de tier', () => {
  const html = renderBeehiivHtml(ed0001);
  assert.ok(html.includes('<h2>Clipping</h2>'));
  const inter = html.indexOf('Inter oferece 54% de desconto');
  const aliexpress = html.indexOf('AliExpress');
  const qatar = html.indexOf('Qatar Airways');
  const hotel = html.indexOf('Hotéis em Belo Horizonte');
  assert.ok(inter >= 0 && aliexpress > 0 && qatar > aliexpress && hotel > qatar,
    `ordem inesperada: inter=${inter} aliexpress=${aliexpress} qatar=${qatar} hotel=${hotel}`);
  assert.ok(!/TIER \d/.test(html), 'taxonomia interna não vaza para o leitor');
});

test('0001: O que fechou nesta semana — nomes legíveis, tipo do leitor, dd/mm', () => {
  const html = renderBeehiivHtml(ed0001);
  assert.ok(html.includes('<h2>O que fechou nesta semana</h2>'));
  assert.ok(html.includes('Amex Membership Rewards → Hilton Honors'));
  assert.ok(html.includes('Itaú → Azul Fidelidade'));
  assert.ok(html.includes('Múltiplos cartões → Smiles'));
  assert.ok(html.includes('Transferência bonificada a 115%, encerrou em 15/07'));
  assert.ok(html.includes('Hotelaria a 20%, encerrou em 14/07'));
});

test('0001: disclaimer íntegro, footer e merge tags no fecho', () => {
  const html = renderBeehiivHtml(ed0001);
  assert.ok(html.includes(DISCLAIMER));
  assert.ok(html.includes('{{live_url}}'));
  assert.ok(html.includes('{{unsubscribe_url}}'));
});

test('0001: zero emoji e zero jargão interno no HTML renderizado (D-059)', () => {
  const html = renderBeehiivHtml(ed0001);
  const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  assert.equal(EMOJI_RE.test(html), false);
  assert.deepEqual(lintJargao(html), []);
});

// ── regra-mãe: seções sem dado somem por inteiro ──
test('edição mínima: sem radar/predictNarrativa/cartões/fecha/clipping → seções ausentes, não vazias', () => {
  const minima = {
    number: 2, date: '2026-07-18', weekday: 'SÁBADO', publishTime: '8H00', readingMinutes: 3,
    signal: 'Sinal com 1 número e candidato smiles.', deals: [],
    sources: [{ label: 'x', url: 'https://www.smiles.com.br' }], disclaimer: DISCLAIMER,
  };
  const html = renderBeehiivHtml(minima);
  assert.ok(!html.includes('No radar, ainda sem confirmação oficial'));
  assert.ok(!html.includes('<h2>Ofertas ativas</h2>'));
  assert.ok(!html.includes('<h2>Cartões e bancos</h2>'));
  assert.ok(!html.includes('<h2>Clipping</h2>'));
  assert.ok(!html.includes(IMG_SECAO_FECHA));
  assert.ok(html.includes(IMG_HEADER), 'header sempre presente');
  assert.ok(html.includes(DISCLAIMER), 'disclaimer sempre presente');
});

test('legado: cartoesBancos (prosa única, DEPRECADO) ainda renderiza como fallback', () => {
  const ed = {
    number: 3, date: '2026-07-18', weekday: 'SÁBADO', publishTime: '8H00', readingMinutes: 3,
    signal: 'x 1 smiles', deals: [], sources: [{ label: 'x', url: 'https://www.smiles.com.br' }],
    disclaimer: DISCLAIMER, cartoesBancos: '5 cartões seguem com campanha viva hoje.',
  };
  const html = renderBeehiivHtml(ed);
  assert.ok(html.includes('<h2>Cartões e bancos</h2>'));
  assert.ok(html.includes('5 cartões seguem com campanha viva hoje.'));
});
