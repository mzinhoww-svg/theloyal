// Replay determinístico da montagem DB→edição (M2.7). Prova, offline, sobre
// dado histórico REAL (fixtures/campanhas-historico.json, projeto Supabase
// qjqnqcsdnpvvmyzkavoq):
//   - 2 dias passados DISTINTOS → 2 edições diferentes, refletindo o banco de
//     cada dia (nenhuma é a 0001), AMBAS passando o gate único;
//   - um dia FORTE (rico: ~8 ofertas ativas + Vence em 72h + O que fechou) e um
//     dia FRACO (esparso) — os dois como dia-fraco de 1ª classe (o banco real
//     NÃO tem nenhuma campanha TIER 1 Vale agir/olhar, então Deal Desk é
//     genuinamente vazio em todo dia histórico; ver slice summary);
//   - o caminho Deal Desk (deals.length>0) é exercitado por uma campanha
//     SINTÉTICA elegível (rotulada), provando que a montagem produz um Deal
//     Desk que passa o gate quando o banco tiver material;
//   - numeração idempotente por data e nunca reusando a 0001.
// node --test v2/lib/digest/montar-edicao.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  montarEdicaoDoDia, montarCartaoItem, reconstruirConjuntoVivo, reconstruirEstado, resolverNumeroEdicao,
} from './montar-edicao.mjs';
import { renderBeehiivHtml } from './render-beehiiv.mjs';
import { gate } from '../gate-unico.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAW = JSON.parse(readFileSync(join(AQUI, 'fixtures', 'campanhas-historico.json'), 'utf8')).campaigns;
// Edições já existentes no corpo (0001 é reservada/ilustrativa — nunca reusada).
const EXISTENTES = [{ number: 1, date: '2026-07-17' }];

function montarDia(asOf, { extra = [] } = {}) {
  const camps = reconstruirConjuntoVivo([...RAW, ...extra], asOf);
  const { number } = resolverNumeroEdicao(asOf, EXISTENTES);
  const ed = montarEdicaoDoDia({ asOf, campaigns: camps, newsRaw: [], forecast: null, number });
  const renderedHtml = renderBeehiivHtml(ed);
  const veredito = gate(ed, { campaignsFromDb: camps, renderedHtml, now: asOf, hoje: asOf });
  return { ed, camps, veredito };
}

test('reconstrução de estado é determinística e relativa ao asOf', () => {
  const row = { first_seen: '2026-07-10', vigencia_fim_date: '2026-07-15' };
  assert.equal(reconstruirEstado(row, '2026-07-05'), 'futuro'); // ainda não visto
  assert.equal(reconstruirEstado(row, '2026-07-14'), 'ultimos_dias'); // vence em ≤72h
  assert.equal(reconstruirEstado(row, '2026-07-11'), 'ativa');
  assert.equal(reconstruirEstado(row, '2026-07-16'), 'encerrada');
});

test('DIA FORTE (2026-07-14): edição rica passa o gate único como dia-fraco de 1ª classe', () => {
  const { ed, veredito } = montarDia('2026-07-14');
  assert.equal(veredito.pass, true, `gate reprovou: ${veredito.violacoes.join(' | ')}`);
  assert.equal(ed.deals.length, 0, 'banco real não tem Deal Desk elegível');
  assert.ok(ed.ofertasAtivas.length >= 6, `ofertas: ${ed.ofertasAtivas?.length}`);
  assert.ok(ed.fechaLogo.length >= 1, 'esperava itens em Vence em até 72h');
  assert.ok(ed.oQueFechouSemana.length >= 1, 'esperava recap semanal');
  assert.ok(ed.cartoesBancosItens.length >= 1, 'esperava Cartões e bancos');
  assert.match(ed.signal, /\d/);
});

test('DIA FRACO (2026-02-25): edição esparsa passa o gate único', () => {
  const { ed, veredito } = montarDia('2026-02-25');
  assert.equal(veredito.pass, true, `gate reprovou: ${veredito.violacoes.join(' | ')}`);
  assert.equal(ed.deals.length, 0);
  assert.ok(ed.ofertasAtivas.length >= 1 && ed.ofertasAtivas.length <= 3, `esparso: ${ed.ofertasAtivas.length}`);
  assert.match(ed.signal, /\d/);
});

test('as 2 edições do replay são DIFERENTES e refletem o banco de cada dia', () => {
  const forte = montarDia('2026-07-14').ed;
  const fraco = montarDia('2026-02-25').ed;
  assert.notEqual(forte.date, fraco.date);
  assert.notEqual(forte.signal, fraco.signal);
  assert.notEqual(JSON.stringify(forte), JSON.stringify(fraco));
  // Dia forte tem estritamente mais ofertas que o fraco (reflete o banco).
  assert.ok(forte.ofertasAtivas.length > fraco.ofertasAtivas.length);
});

test('nenhuma edição do replay repete a 0001', () => {
  const zero = JSON.parse(readFileSync(join(AQUI, '..', '..', '..', 'content', 'editions', '0001.json'), 'utf8'));
  for (const asOf of ['2026-07-14', '2026-02-25']) {
    const { ed } = montarDia(asOf);
    assert.notEqual(ed.number, zero.number);
    assert.notEqual(ed.signal, zero.signal);
    assert.notEqual(JSON.stringify(ed), JSON.stringify(zero));
  }
});

test('caminho Deal Desk: campanha SINTÉTICA elegível vira deal que passa o gate', () => {
  // Sintética porque o banco real não tem TIER 1 Vale agir/olhar. Códigos
  // kebab (livelo->smiles) p/ o routeKey bater cru no gate 5.5 e no schema.
  const sintetica = {
    id: 'synthetic-livelo-smiles', origem_code: 'livelo', destino_code: 'smiles', tipo: 'transferencia',
    tier: 1, tem_tier1: true, triagem_categoria: 'limpo', tl_score_bruto: 88, veredito_bruto: 'Vale agir', percentual: '100', paridade: '1:1', cpm: null,
    publico: 'geral', first_seen: '2026-07-10', vigencia_fim_date: '2026-07-24',
    source_name: 'Fonte oficial (sintética)', source_url: 'https://example.com/regra-oficial',
  };
  const { ed, veredito } = montarDia('2026-07-14', { extra: [sintetica] });
  assert.equal(ed.deals.length, 1, 'esperava exatamente 1 deal');
  assert.equal(ed.deals[0].verdict, 'vale-agir');
  assert.equal(ed.deals[0].routeKey, 'livelo->smiles');
  assert.equal(ed.deals[0].tlScore, 88);
  assert.equal(veredito.pass, true, `gate reprovou: ${veredito.violacoes.join(' | ')}`);
});

test('numeração idempotente por data (mesmo dia = mesmo número; nunca reusa 0001)', () => {
  // Data nova → número novo (max+1), nunca 1.
  const nova = resolverNumeroEdicao('2026-07-14', EXISTENTES);
  assert.equal(nova.reused, false);
  assert.equal(nova.number, 2);
  // Rodar 2x no mesmo dia com a edição já gravada → MESMO número, 0 duplicata.
  const jaGravada = [...EXISTENTES, { number: 2, date: '2026-07-14' }];
  const r1 = resolverNumeroEdicao('2026-07-14', jaGravada);
  const r2 = resolverNumeroEdicao('2026-07-14', jaGravada);
  assert.equal(r1.reused, true);
  assert.equal(r1.number, 2);
  assert.deepEqual(r1, r2);
  // Mesma data da 0001 NÃO reusa a 0001 — aloca número novo.
  const naData0001 = resolverNumeroEdicao('2026-07-17', EXISTENTES);
  assert.equal(naData0001.reused, false);
  assert.notEqual(naData0001.number, 1);
});

// ── Cartões e bancos: conteúdo REAL derivado do dado ou OMITIDO (nada de filler) ──
test('montarCartaoItem: item COM dado real vira descrição específica (fonte pelo host)', () => {
  const c = {
    origem_code: 'livelo', destino_code: 'smiles', tipo: 'transferencia',
    percentual: 100, cpm: null, vigencia_fim_date: '2026-07-31',
    source_url: 'https://www.idinheiro.com.br/cartao/x', source_name: 'tavily', // source_name ERRADO
  };
  const item = montarCartaoItem(c);
  assert.ok(item, 'com dado real, não omite');
  assert.match(item.descricao, /100%/);
  assert.doesNotMatch(item.descricao, /acúmulo diferenciado, campanha vigente/); // sem filler
  assert.equal(item.fonte, 'iDinheiro'); // rótulo do HOST, ignora o source_name 'tavily'
});

test('montarCartaoItem: item SEM conteúdo real (só nome+fonte) é OMITIDO (regra-mãe), não filler', () => {
  const c = {
    origem_code: 'bb', destino_code: 'smiles', tipo: 'cartao',
    percentual: null, cpm: null, vigencia_fim_date: null, publico: null,
    source_url: 'https://www.idinheiro.com.br/cartao/x', source_name: 'iDinheiro',
  };
  assert.equal(montarCartaoItem(c), null);
});

test('montarCartaoItem: dois itens com dados distintos NÃO compartilham a mesma frase', () => {
  const a = montarCartaoItem({ origem_code: 'livelo', destino_code: 'azul', tipo: 'transferencia', percentual: 120, source_url: 'https://smiles.com.br/x' });
  const b = montarCartaoItem({ origem_code: 'itau', destino_code: 'latam-pass', tipo: 'transferencia', percentual: 80, source_url: 'https://www.melhorescartoes.com.br/x' });
  assert.notEqual(a.descricao, b.descricao);
});
