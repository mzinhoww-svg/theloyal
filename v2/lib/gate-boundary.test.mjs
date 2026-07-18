// M8 + M9 — os dois buracos de BOUNDARY do runner, provados ponta a ponta.
//
// M8 (fila = só vivos): o fetch do runner traz MORTAS (encerrada∧tier1, para o
// recap "O que fechou"). A camada de dado do gate roda a pré-superfície; se ela
// varrer as mortas, um flag numa morta entra em `veredito.revisao` e TRAVA o
// auto-publish de um dia limpo. A fonte única (filtrarVivos) tem de excluir a
// morta — mas continuar pegando um flag em item VIVO.
//
// M9 (fuso): 'hoje' derivado em America/Sao_Paulo, não UTC. Uma rodada 22h BRT
// (= 01:00Z do dia seguinte) tem de resolver para o DIA BRT, senão a montagem, o
// ledger e o gate montam a edição do dia errado.
// node --test v2/lib/gate-boundary.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  montarEdicaoDoDia, reconstruirConjuntoVivo, resolverNumeroEdicao, filtrarVivos,
} from './digest/montar-edicao.mjs';
import { renderBeehiivHtml } from './digest/render-beehiiv.mjs';
import { gate } from './gate-unico.mjs';
import { avaliarRating } from '../../scripts/daily.mjs';
import { hojeSaoPaulo } from '../../scripts/lib.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAW = JSON.parse(readFileSync(join(AQUI, 'digest', 'fixtures', 'campanhas-historico.json'), 'utf8')).campaigns;
const EXISTENTES = [{ number: 1, date: '2026-07-17' }];
const ASOF = '2026-07-14'; // dia forte do fixture (gate verde)

function vereditoCom(extraParaDado = []) {
  const camps = reconstruirConjuntoVivo(RAW, ASOF);
  const { number } = resolverNumeroEdicao(ASOF, EXISTENTES);
  const ed = montarEdicaoDoDia({ asOf: ASOF, campaigns: camps, newsRaw: [], forecast: null, number });
  const renderedHtml = renderBeehiivHtml(ed);
  // A edição NÃO muda; o item extra entra só no conjunto que a camada de dado varre.
  const campaignsFromDb = [...camps, ...extraParaDado];
  return gate(ed, { campaignsFromDb, renderedHtml, now: ASOF, hoje: ASOF });
}

// Campanha MORTA tier 1 com percentual absurdo (400% > teto 300 de compra) — se a
// pré-superfície a varrer, ela FLAGA (percentual_acima_teto). Estado encerrado.
// Linhas como o fetch do runner as entrega: JÁ com `estado` (do banco). Morta =
// encerrada∧tier1 (entra no fetch para o recap). Percentual 400 > teto 300 de
// compra → flagraria a pré-superfície SE fosse varrida.
const MORTA_FLAGRANTE = {
  id: 'morta-tier1-flagrante', origem_code: 'smiles', destino_code: 'sem_destino', tipo: 'compra',
  tier: 1, percentual: 400, publico: 'geral', estado: 'encerrada',
  first_seen: '2026-05-01', vigencia_fim_date: '2026-06-01',
  source_name: 'x', source_url: 'https://example.com/x',
};
// Mesma anomalia, mas VIVA (estado ativa) — esta DEVE aparecer na fila.
const VIVA_FLAGRANTE = {
  ...MORTA_FLAGRANTE, id: 'viva-flagrante', estado: 'ativa', vigencia_fim_date: '2026-08-01',
};

test('M8: filtrarVivos exclui a morta (mesmo tier 1) e mantém a viva', () => {
  const set = reconstruirConjuntoVivo([...RAW, MORTA_FLAGRANTE, VIVA_FLAGRANTE], ASOF);
  const vivos = filtrarVivos(set);
  assert.ok(!vivos.some((c) => c.id === 'morta-tier1-flagrante'), 'morta não pode ser viva');
  assert.ok(vivos.some((c) => c.id === 'viva-flagrante'), 'viva tem de constar');
  // E a morta segue no conjunto completo (o recap precisa dela) — só não é "viva".
  assert.ok(set.some((c) => c.id === 'morta-tier1-flagrante' && c.estado === 'encerrada'));
});

test('M8: flag numa MORTA não entra na fila do gate nem trava o rating do dia limpo', () => {
  const base = vereditoCom([]);
  assert.equal(base.pass, true, `baseline devia passar: ${base.violacoes.join(' | ')}`);
  const baseN = base.revisao.length;

  const comMorta = vereditoCom([MORTA_FLAGRANTE]);
  assert.equal(comMorta.revisao.length, baseN, 'a morta flagrante NÃO pode inflar a fila');
  assert.equal(avaliarRating(comMorta).auto, avaliarRating(base).auto, 'rating não pode mudar por causa da morta');
});

test('M8: flag numa VIVA continua entrando na fila (o filtro não é cego)', () => {
  const base = vereditoCom([]);
  const comViva = vereditoCom([VIVA_FLAGRANTE]);
  assert.equal(comViva.revisao.length, base.revisao.length + 1, 'a viva flagrante TEM de entrar na fila');
  assert.ok(comViva.revisao.some((r) => r.item.id === 'viva-flagrante'));
});

test('M9: hoje resolve no fuso de São Paulo — 22h BRT fica no dia BRT, não no UTC seguinte', () => {
  // 2026-07-20T01:00:00Z = 2026-07-19 22:00 BRT (UTC-3). UTC diria "20"; BRT é "19".
  const t = new Date('2026-07-20T01:00:00Z');
  assert.equal(t.toISOString().slice(0, 10), '2026-07-20', 'sanidade: UTC escorrega para o dia seguinte');
  assert.equal(hojeSaoPaulo(t), '2026-07-19', 'hoje BRT tem de ser o dia local (19), não o UTC (20)');
});

test('M9: meio-dia UTC cai no mesmo dia nos dois fusos (sem regressão)', () => {
  const t = new Date('2026-07-19T12:00:00Z'); // 09:00 BRT
  assert.equal(hojeSaoPaulo(t), '2026-07-19');
});
