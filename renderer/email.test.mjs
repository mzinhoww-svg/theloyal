// Smoke test do renderer realinhado (SPEC-SLICE-TEMPLATE-EMAIL-DAILY.md §6/§9,
// atualizado para a estrutura v3 do Digest Engine — D-057).
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

test('dia-forte: contém a seção Deals do dia (3 deals)', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes(DEAL_DESK_MARKER), 'HTML deveria conter o marcador de Deals do dia');
  assert.ok(html.includes('Deals do dia'));
  assert.equal((html.match(/Regulamento oficial/g) || []).length >= 1, true);
});

test('dia-forte: deals numerados ("1. ", "2. ", "3. ")', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('1. 110% de bônus'));
  assert.ok(html.includes('2. 80% de desconto'));
  assert.ok(html.includes('3. 90% de bônus'));
});

test('dia-forte: deal com contaProsa/leitura renderiza "A conta" e "Leitura" (§1.2, D-057)', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('>A conta<'));
  assert.ok(html.includes('rendem 84.000 milhas'));
  assert.ok(html.includes('>Leitura<'));
  assert.ok(html.includes('já bate a referência de mercado'));
});

test('dia-forte: fechaLogo (Vence em até 72h) renderiza os 2 itens (array, não string única)', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('Vence em até 72h'));
  assert.ok(html.includes('VENCE EM 48H'));
  assert.ok(html.includes('VENCE EM 24H'));
});

test('dia-forte: Ofertas ativas renderiza os 5 itens em tabela', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('Ofertas ativas'));
  assert.equal((html.match(/&rarr;/g) || []).length >= 3, true, 'rotas com destino usam seta (origem->destino)');
});

test('dia-forte: renderiza os blocos na ordem final v3 (D-057) — Sinal do dia → Ofertas ativas → Deals do dia → Vence 72h → Cartões & bancos → Clipping → O que fechou → Radar VPM → Loyalty Lab → Predict', () => {
  const html = renderEmail(diaForte);
  const idx = (needle) => html.indexOf(needle);
  const sinal = idx('Sinal do dia');
  const ofertas = idx('Ofertas ativas');
  const deals = idx('Deals do dia');
  const vence72h = idx('Vence em até 72h');
  const cartoes = idx('Cartões &amp; bancos');
  const clipping = idx('>Clipping<');
  const fechouSemana = idx('O que fechou nesta semana');
  const radarVpm = idx('Radar VPM');
  const lab = idx('Loyalty Lab');
  const predict = idx('>Predict<');
  assert.ok(
    sinal >= 0 && ofertas > sinal && deals > ofertas && vence72h > deals && cartoes > vence72h &&
    clipping > cartoes && fechouSemana > clipping && radarVpm > fechouSemana && lab > radarVpm && predict > lab,
    `ordem inesperada: sinal=${sinal} ofertas=${ofertas} deals=${deals} vence72h=${vence72h} cartoes=${cartoes} clipping=${clipping} fechouSemana=${fechouSemana} radarVpm=${radarVpm} lab=${lab} predict=${predict}`,
  );
});

test('dia-forte: Sinal do dia funde resumoDoDia como 2º parágrafo (não é mais seção própria, D-057 decisão 5)', () => {
  const html = renderEmail(diaForte);
  assert.ok(!html.includes('>RESUMO DO DIA<'), 'não deveria haver eyebrow própria "Resumo do dia"');
  assert.ok(html.includes('Latam Pass revisou a tabela de resgate'));
});

test('dia-forte: Predict renderiza o teaser formatado, nunca o valor/janela previstos', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('2 previsões ativas esta semana no radar'));
  assert.ok(html.includes('Digest Pro'));
});

test('dia-forte: Cartões & bancos e O que fechou nesta semana renderizam prosa/bullet reais', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('Itaú lidera as transferências bonificadas'));
  assert.ok(html.includes('120%'));
  assert.ok(html.includes('2026-07-05'));
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
test('dia-fraco: deals=[] → seção Deals do dia AUSENTE do HTML (não vazia, ausente)', () => {
  const html = renderEmail(diaFraco);
  assert.ok(!html.includes(DEAL_DESK_MARKER), 'HTML não deveria conter o marcador de Deals do dia quando deals=[]');
});

test('dia-fraco: signal presente e explica a ausência com números reais', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('Sinal do dia'));
  assert.match(diaFraco.signal, /\d/);
});

test('dia-fraco: Ofertas ativas aparece mesmo sem Deals do dia (§1.1 — sustenta o dia fraco, D-057 §3)', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('Ofertas ativas'));
  assert.ok(html.includes('SÓ PARA CASOS ESPECÍFICOS'));
});

test('dia-fraco: sem contaFeita e sem deals → bloco "Conta feita" não aparece (nada para elevar)', () => {
  const html = renderEmail(diaFraco);
  assert.ok(!html.includes('Conta feita'));
});

test('dia-fraco: Vence em até 72h pode aparecer mesmo sem Deals do dia (eixo independente, §1.3)', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('Vence em até 72h'));
  assert.ok(html.includes('VENCE HOJE'));
});

test('dia-fraco: Predict ausente (0 janelas confidence=alta é o estado real, §1.7) → seção omitida', () => {
  const html = renderEmail(diaFraco);
  assert.ok(!html.includes('>Predict<'));
});

test('dia-fraco: Cartões & bancos renderiza a prosa evergreen', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('Cartões &amp; bancos'));
  assert.ok(html.includes('Itaú e Nubank concentram'));
});

test('dia-fraco: O que fechou nesta semana renderiza o recap TIER 1', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('O que fechou nesta semana'));
  assert.ok(html.includes('2026-07-12'));
});

test('dia-fraco: Clipping renderiza os 5 itens com link, resumo e fonte+tier', () => {
  const html = renderEmail(diaFraco);
  const secao = html.slice(html.indexOf('>Clipping<'), html.indexOf('O que fechou nesta semana'));
  assert.equal((secao.match(/TIER 2/g) || []).length, 5, 'a seção Clipping deve ter exatamente 5 itens TIER 2');
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
