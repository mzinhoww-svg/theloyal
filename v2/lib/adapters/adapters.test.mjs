// Testes dos adapters TIER 1 contra FIXTURES reais (HTML/XML salvo de páginas
// oficiais em 2026-07-16). Puro, sem rede. node --test v2/lib/adapters/adapters.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import smiles from './smiles.mjs';
import livelo from './livelo.mjs';
import esfera from './esfera.mjs';
import tap from './tap.mjs';
import {
  parseSitemap, descobrirUrls, urlPermitida, decodeEntidades,
  canonical, extrairPercentual, slugDe, extrairCampanha,
} from './base.mjs';
import { adapterPara, confirmarUrl } from './run.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const fx = (f) => readFileSync(join(DIR, 'fixtures', f), 'utf8');

// ── base: sitemap parsing ────────────────────────────────────────────
test('parseSitemap distingue index de urlset', () => {
  assert.equal(parseSitemap(fx('livelo-sitemapindex.xml')).tipo, 'index');
  assert.equal(parseSitemap(fx('smiles-sitemap.xml')).tipo, 'urlset');
});

test('parseSitemap desembrulha CDATA (Esfera)', () => {
  const { locs } = parseSitemap(fx('esfera-static-sitemap.xml'));
  assert.ok(locs.includes('https://www.esfera.com.vc/campanha-aniversario'));
  assert.ok(locs.every((u) => !u.includes('CDATA') && !u.includes(']]')));
});

// ── base: robots/ToS compliance ──────────────────────────────────────
test('urlPermitida bloqueia query e pdf (robots Smiles)', () => {
  const dis = smiles.robots;
  assert.equal(urlPermitida('https://www.smiles.com.br/busca?x=1', dis), false);
  assert.equal(urlPermitida('https://www.smiles.com.br/regulamento.pdf', dis), false);
  assert.equal(urlPermitida('https://www.smiles.com.br/aereas/campanha-gol/20260512', dis), true);
});

test('urlPermitida bloqueia rotas de conta (robots TAP/Esfera)', () => {
  assert.equal(urlPermitida('https://www.flytap.com/pt_br/minha-conta', tap.robots), false);
  assert.equal(urlPermitida('https://www.esfera.com.vc/checkout', esfera.robots), false);
});

// ── base: decode/canonical/slug/percentual ───────────────────────────
test('decodeEntidades resolve canonical entity-encoded da Smiles', () => {
  const c = canonical(fx('smiles-campanha.html'));
  assert.equal(c, 'https://www.smiles.com.br/aereas/campanha-gol/20260512');
});

test('extrairPercentual: slug tem prioridade e proveniência', () => {
  assert.deepEqual(extrairPercentual('bancos-banestes-ate-90-11-10', ''), { valor: 90, evidencia: 'slug:ate-90' });
  assert.deepEqual(extrairPercentual('x', 'bônus de 100% na transferência'), { valor: 100, evidencia: 'texto:100%' });
  assert.deepEqual(extrairPercentual('sem-numero', 'sem percentual'), { valor: null, evidencia: '' });
});

test('slugDe descarta sufixo /encerrada', () => {
  assert.equal(slugDe('https://www.smiles.com.br/aereas/campanha-nordeste-18-08/encerrada'), 'aereas/campanha-nordeste-18-08');
});

// ── Smiles ───────────────────────────────────────────────────────────
test('Smiles descobre campanhas e exclui home/query/pdf/encerrada', () => {
  const { urls } = smiles.descobrirUrls(fx('smiles-sitemap.xml'));
  assert.ok(urls.includes('https://www.smiles.com.br/aereas/campanha-gol/20260512'));
  assert.ok(urls.includes('https://www.smiles.com.br/bancos-banestes-ate-90-11-10'));
  assert.ok(!urls.some((u) => u.includes('?')));            // robots
  assert.ok(!urls.some((u) => u.endsWith('.pdf')));         // robots
  assert.ok(!urls.some((u) => u.endsWith('/encerrada')));   // excluir
  assert.ok(!urls.includes('https://www.smiles.com.br'));   // home não é campanha
});

test('Smiles extrai payload TIER 1 do HTML real', () => {
  const p = smiles.extrairCampanha(fx('smiles-campanha.html'));
  assert.equal(p.programa, 'smiles');
  assert.equal(p.url_canonica, 'https://www.smiles.com.br/aereas/campanha-gol/20260512');
  assert.equal(p.tier, 1);
  assert.equal(p.papel, 'confirmacao_oficial');
  assert.ok(p.titulo.length > 0);
});

test('Smiles extrai percentual do slug da URL de bônus', () => {
  const url = 'https://www.smiles.com.br/bancos-banestes-ate-90-11-10';
  const p = smiles.extrairCampanha('<html></html>', url);
  assert.equal(p.percentual, 90);
  assert.equal(p.evidencia_percentual, 'slug:ate-90');
});

// ── Livelo ───────────────────────────────────────────────────────────
test('Livelo: índice -> segue só o static-sitemap', () => {
  const r = livelo.descobrirUrls(fx('livelo-sitemapindex.xml'));
  assert.equal(r.tipo, 'index');
  assert.deepEqual(r.sub_sitemaps, ['https://www.livelo.com.br/sitemap/static-sitemap-0.xml']);
});

test('Livelo: descobre transferências e ofertas, ignora institucional', () => {
  const { urls } = livelo.descobrirUrls(fx('livelo-static-sitemap.xml'));
  assert.ok(urls.includes('https://www.livelo.com.br/livelo-para-parceiros/smiles/SMLTransfer'));
  assert.ok(urls.includes('https://www.livelo.com.br/ofertas-do-dia'));
  assert.ok(!urls.some((u) => u.endsWith('/fale-conosco')));
});

test('Livelo: extrai título e descrição do HTML real', () => {
  const p = livelo.extrairCampanha(fx('livelo-transfer.html'));
  assert.equal(p.url_canonica, 'https://www.livelo.com.br/livelo-para-parceiros/smiles/SMLTransfer');
  assert.match(p.titulo, /Transfira seus Pontos Livelo para Smiles/i);
  assert.match(p.descricao, /pontos Livelo em milhas Smiles/i);
});

// ── Esfera ───────────────────────────────────────────────────────────
test('Esfera: índice CDATA -> segue o staticSitemap', () => {
  const r = esfera.descobrirUrls(fx('esfera-sitemapindex.xml'));
  assert.deepEqual(r.sub_sitemaps, ['https://www.esfera.com.vc/staticSitemap.xml']);
});

test('Esfera: descobre /campanha-* e barra checkout/profile', () => {
  const { urls } = esfera.descobrirUrls(fx('esfera-static-sitemap.xml'));
  assert.ok(urls.includes('https://www.esfera.com.vc/campanha-aniversario'));
  assert.ok(!urls.some((u) => u.endsWith('/checkout')));
  assert.ok(!urls.some((u) => u.endsWith('/profile')));
});

test('Esfera: título via og:title (sem canonical na página)', () => {
  const url = 'https://www.esfera.com.vc/campanha-aniversario';
  const p = esfera.extrairCampanha(fx('esfera-campanha.html'), url);
  assert.equal(p.titulo, 'Aniversário Esfera');
  assert.equal(p.url_canonica, url); // cai na URL de entrada quando não há canonical
});

// ── TAP ──────────────────────────────────────────────────────────────
test('TAP: índice de locales -> segue só pt_br', () => {
  const r = tap.descobrirUrls(fx('tap-sitemapindex.xml'));
  assert.deepEqual(r.sub_sitemaps, ['https://www.flytap.com/pt_br/sitemap.xml']);
});

test('TAP: descobre ofertas/miles-and-go, ignora rotas de voo e conta', () => {
  const { urls } = tap.descobrirUrls(fx('tap-ptbr-sitemap.xml'));
  assert.ok(urls.includes('https://www.flytap.com/pt_br/ofertas-dia-dos-namorados'));
  assert.ok(urls.includes('https://www.flytap.com/pt_br/miles-and-go'));
  assert.ok(!urls.some((u) => u.includes('/voos/')));
  assert.ok(!urls.some((u) => u.includes('/minha-conta')));
});

test('TAP: extrai canonical e título do HTML real', () => {
  const p = tap.extrairCampanha(fx('tap-oferta.html'));
  assert.equal(p.url_canonica, 'https://www.flytap.com/pt_br/ofertas-dia-dos-namorados');
  assert.match(p.titulo, /Dia dos Namorados/i);
});

// ── contrato uniforme ────────────────────────────────────────────────
test('todo adapter expõe o mesmo contrato', () => {
  for (const a of [smiles, livelo, esfera, tap]) {
    assert.equal(typeof a.descobrirUrls, 'function');
    assert.equal(typeof a.extrairCampanha, 'function');
    assert.ok(a.programa && a.sitemap);
    assert.ok(Array.isArray(a.robots));
  }
});

// ── run.mjs: A ESTRADA ponta a ponta (fetch e RPC mockados, sem rede/prod) ──
test('adapterPara resolve pelo host', () => {
  assert.equal(adapterPara('https://www.smiles.com.br/aereas/campanha-gol/20260512'), smiles);
  assert.equal(adapterPara('https://www.flytap.com/pt_br/ofertas-dia-dos-namorados'), tap);
  assert.equal(adapterPara('https://exemplo.com/x'), null);
});

test('confirmarUrl: 200 vivo -> chama confirmar_tier1 com a canonical', async () => {
  const chamadas = [];
  const res = await confirmarUrl(
    { campaignId: 'gol-2026-05-12', url: 'https://www.smiles.com.br/aereas/campanha-gol/20260512', verificadoEm: '2026-07-16' },
    {
      fetchImpl: async () => ({ status: 200, location: '', html: fx('smiles-campanha.html') }),
      confirmar: async (a) => { chamadas.push(a); return { promoveu: true, estado_depois: 'ativa' }; },
    },
  );
  assert.equal(res.ok, true);
  assert.equal(res.payload.tier, 1);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].campaignId, 'gol-2026-05-12');
  assert.equal(chamadas[0].urlCanonica, 'https://www.smiles.com.br/aereas/campanha-gol/20260512');
  assert.equal(chamadas[0].verificadoEm, '2026-07-16');
});

test('confirmarUrl: 302 (campanha encerrada) NÃO confirma', async () => {
  let chamou = false;
  const res = await confirmarUrl(
    { campaignId: 'x', url: 'https://www.smiles.com.br/bancos-banestes-ate-90-11-10' },
    {
      fetchImpl: async () => ({ status: 302, location: 'https://www.smiles.com.br/promocao', html: '' }),
      confirmar: async () => { chamou = true; },
    },
  );
  assert.equal(res.ok, false);
  assert.match(res.motivo, /não confirmável/i);
  assert.equal(chamou, false); // nunca força TIER 1 sobre redirect
});

test('confirmarUrl: URL bloqueada por robots é recusada antes do fetch', async () => {
  let buscou = false;
  const res = await confirmarUrl(
    { campaignId: 'x', url: 'https://www.esfera.com.vc/checkout' },
    { fetchImpl: async () => { buscou = true; return { status: 200, html: '' }; }, confirmar: async () => {} },
  );
  assert.equal(res.ok, false);
  assert.match(res.motivo, /robots/i);
  assert.equal(buscou, false);
});

test('confirmarUrl: modo mock não chama o RPC', async () => {
  let chamou = false;
  const res = await confirmarUrl(
    { campaignId: 'gol', url: 'https://www.smiles.com.br/aereas/campanha-gol/20260512' },
    { fetchImpl: async () => ({ status: 200, html: fx('smiles-campanha.html') }), confirmar: async () => { chamou = true; }, mock: true },
  );
  assert.equal(res.ok, true);
  assert.equal(chamou, false);
  assert.equal(res.confirmacao, undefined);
});
