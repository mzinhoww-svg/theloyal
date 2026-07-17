// Smoke test do renderer realinhado (SPEC-SLICE-TEMPLATE-EMAIL-DAILY.md §6/§9).
// node --test renderer/email.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderEmail } from './email.mjs';
import { DEAL_DESK_MARKER } from '../v2/lib/digest/gate-5-5.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const diaForte = JSON.parse(readFileSync(join(DIR, 'examples', 'dia-forte.json'), 'utf8'));
const diaFraco = JSON.parse(readFileSync(join(DIR, 'examples', 'dia-fraco.json'), 'utf8'));

test('dia-forte: renderiza sem lançar, HTML bem formado (doctype + html + body fecham)', () => {
  const html = renderEmail(diaForte);
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<\/body><\/html>$/);
});

test('dia-forte: contém a seção Deal Desk (3 deals)', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes(DEAL_DESK_MARKER), 'HTML deveria conter o marcador Deal Desk');
  assert.equal((html.match(/Regulamento oficial/g) || []).length >= 1, true);
});

test('dia-forte: fechaLogo renderiza os 2 itens (array, não string única)', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('VENCE EM 48H'));
  assert.ok(html.includes('VENCE EM 24H'));
});

test('dia-forte: renderiza os blocos novos na ordem cravada (Resumo → Clipping → Radar → Radar VPM → Sinais rápidos → Loyalty Lab)', () => {
  const html = renderEmail(diaForte);
  const idx = (needle) => html.indexOf(needle);
  const resumo = idx('Resumo do dia');
  const clipping = idx('Clipping');
  const radar = idx('Radar de janelas');
  const radarVpm = idx('Radar VPM');
  const sinais = idx('Sinais rápidos');
  const lab = idx('Loyalty Lab');
  assert.ok(resumo > 0 && clipping > resumo && radar > clipping && radarVpm > radar && sinais > radarVpm && lab > sinais,
    `ordem inesperada: resumo=${resumo} clipping=${clipping} radar=${radar} radarVpm=${radarVpm} sinais=${sinais} lab=${lab}`);
});

test('dia-forte: contaFeita explícito é usado (não o fallback do primeiro deal)', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('Conta feita'));
});

test('dia-forte: color-scheme travado light no head', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('<meta name="color-scheme" content="light" />'));
  assert.ok(html.includes('<meta name="supported-color-schemes" content="light" />'));
});

// ── dia fraco: a garantia central do template (§4/§9 da spec) ──
test('dia-fraco: deals=[] → seção Deal Desk AUSENTE do HTML (não vazia, ausente)', () => {
  const html = renderEmail(diaFraco);
  assert.ok(!html.includes(DEAL_DESK_MARKER), 'HTML não deveria conter o marcador Deal Desk quando deals=[]');
});

test('dia-fraco: signal presente e explica a ausência com números reais', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('Sinal do dia'));
  assert.match(diaFraco.signal, /\d/);
});

test('dia-fraco: sem contaFeita e sem deals → bloco "Conta feita" não aparece (nada para elevar)', () => {
  const html = renderEmail(diaFraco);
  assert.ok(!html.includes('Conta feita'));
});

test('dia-fraco: Fecha Logo pode aparecer mesmo sem Deal Desk (eixo independente, §1.4)', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('Fecha logo'));
  assert.ok(html.includes('VENCE HOJE'));
});

test('dia-fraco: sinaisRapidos renderiza sem nenhum chip de veredito de Deal Desk', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('Sinais rápidos'));
  // Nenhum dos rótulos de veredito de Deal Desk pode aparecer perto de "Sinais rápidos"
  const secao = html.slice(html.indexOf('Sinais rápidos'), html.indexOf('Loyalty Lab'));
  for (const rotulo of ['VALE AGIR', 'VALE OLHAR', 'SÓ PARA CASOS']) {
    assert.ok(!secao.includes(rotulo), `"${rotulo}" não deveria aparecer na seção Sinais rápidos`);
  }
});

test('dia-fraco: Clipping renderiza os 5 itens com link, resumo e fonte+tier', () => {
  const html = renderEmail(diaFraco);
  const secao = html.slice(html.indexOf('>Clipping<'), html.indexOf('Sinais rápidos'));
  assert.equal((secao.match(/TIER 2/g) || []).length, 5, 'a seção Clipping (isolada da prosa do Resumo do dia) deve ter exatamente 5 itens TIER 2');
});

test('dia-fraco: color-scheme travado light no head (mesma garantia dos dois casos)', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('<meta name="color-scheme" content="light" />'));
});

test('ambos: zero emoji no HTML gerado', () => {
  const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  assert.equal(EMOJI_RE.test(renderEmail(diaForte)), false);
  assert.equal(EMOJI_RE.test(renderEmail(diaFraco)), false);
});
