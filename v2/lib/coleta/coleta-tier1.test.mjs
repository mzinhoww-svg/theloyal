// Tests do runner de coleta TIER 1 (nucleo puro, fetch injetado). node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectarJanela, extrairEscala, analisarRegulamento, urlOficialDe,
  decisaoNoLimiar, avaliarViva, coletarLote, LIMIAR_PARTIDA, PISO_VALOR,
} from './coleta-tier1.mjs';

// HTML sinteticos espelhando os padroes reais observados no lote.
const HTML_HILTON = 'Transfira seus pontos. Valido das 10h do dia 01/07 ate as 23h59 do dia 31/07/2026. 50% de bonus para todos os participantes creditados em ate 48h.';
const HTML_EVERGREEN = '<title>Compra de Pontos</title> Compre pontos Esfera. Aplique seu cupom de desconto. Parcelamento em ate 12x.';
const HTML_SMILES = 'Periodo de Vigencia de 15/07 a 17/07. Participante com cadastro ativo no Clube Smiles nos planos 1.000, 2.000, 20.000 recebe ate 375% de bonus. Base: 315% de bonus. Categoria Diamante 375% de bonus.';

// ── detectarJanela ─────────────────────────────────────────────────────────
test('detectarJanela: janela datada Livelo -> fim 2026-07-31', () => {
  const j = detectarJanela(HTML_HILTON);
  assert.equal(j.tem, true);
  assert.equal(j.fim_date, '2026-07-31');
});

test('detectarJanela: evergreen sem janela -> tem=false', () => {
  assert.equal(detectarJanela(HTML_EVERGREEN).tem, false);
});

test('detectarJanela: intervalo "de 15/07 a 17/07" detectado', () => {
  assert.equal(detectarJanela(HTML_SMILES).tem, true);
});

// ── extrairEscala ──────────────────────────────────────────────────────────
test('extrairEscala: Hilton -> [{50, geral}]', () => {
  const e = extrairEscala(HTML_HILTON);
  assert.equal(e.length, 1);
  assert.equal(e[0].pct, 50);
  assert.equal(e[0].publico, 'geral');
});

test('extrairEscala: Smiles -> inclui 375 e 315 (escala clube)', () => {
  const e = extrairEscala(HTML_SMILES);
  const pcts = e.map((x) => x.pct);
  assert.ok(pcts.includes(375));
  assert.ok(pcts.includes(315));
});

test('extrairEscala: ignora % fora de contexto de bonus', () => {
  assert.equal(extrairEscala('Parcelamento em 12x. 5% de desconto no PIX. width:100%.').length, 0);
});

// ── analisarRegulamento ────────────────────────────────────────────────────
test('analisarRegulamento: Hilton = campanha (nao evergreen)', () => {
  const r = analisarRegulamento(HTML_HILTON);
  assert.equal(r.evergreen, false);
  assert.equal(r.termos_legiveis, true);
});

test('analisarRegulamento: Esfera compra = evergreen', () => {
  assert.equal(analisarRegulamento(HTML_EVERGREEN).evergreen, true);
});

// ── urlOficialDe ───────────────────────────────────────────────────────────
test('urlOficialDe: regulamento_url oficial resolve', () => {
  const o = urlOficialDe({ regulamento_url: 'https://www.livelo.com.br/livelo-para-parceiros/hilton-honors/HILTransfer', tipo: 'hotelaria', destino_code: 'hilton' }, []);
  assert.equal(o.via, 'regulamento_url');
});

test('urlOficialDe: regulamento_url de blog NAO resolve como oficial', () => {
  const o = urlOficialDe({ regulamento_url: 'https://passageirodeprimeira.com.br/algo', tipo: 'compra', destino_code: 'esfera' }, []);
  assert.equal(o, null);
});

test('urlOficialDe: sem regulamento -> null', () => {
  assert.equal(urlOficialDe({ regulamento_url: null, tipo: 'compra', destino_code: 'aliexpress' }, []), null);
});

// ── decisaoNoLimiar (matriz D-049) ─────────────────────────────────────────
test('decisaoNoLimiar: limpo acima do limiar -> auto publica', () => {
  assert.equal(decisaoNoLimiar(1.0, 'corrobora_limpo', 0.75), 'auto: publica (3 portoes)');
});
test('decisaoNoLimiar: limpo abaixo do limiar -> revisao', () => {
  assert.equal(decisaoNoLimiar(0.6, 'corrobora_limpo', 0.75), 'revisao humana');
});
test('decisaoNoLimiar: refuta alta confianca -> remove/rebaixa (firmeza)', () => {
  assert.equal(decisaoNoLimiar(1.0, 'refuta', 0.75), 'auto: remove/rebaixa (firmeza)');
});
test('decisaoNoLimiar: ajuste sempre a revisao (separar por publico)', () => {
  assert.match(decisaoNoLimiar(1.0, 'corrobora_com_ajuste', 0.60), /separar por publico/);
});

// ── avaliarViva (paths) ────────────────────────────────────────────────────
test('avaliarViva: sem URL oficial -> bloqueado, confianca baixa, nunca forca', () => {
  const r = avaliarViva({ viva: { id: 'x', origem_code: 'livelo', tipo: 'compra', percentual: 25, publico: 'geral', tl_score_bruto: 60 }, oficial: null, resp: null });
  assert.equal(r.status_coleta, 'sem_url_oficial');
  assert.ok(r.confianca < LIMIAR_PARTIDA);
});

test('avaliarViva: Hilton campanha -> corrobora_limpo, confianca alta', () => {
  const r = avaliarViva({
    viva: { id: 'livelo-hilton', origem_code: 'livelo', destino_code: 'hilton', tipo: 'hotelaria', percentual: 50, publico: 'geral', tl_score_bruto: 65 },
    oficial: { url: 'https://www.livelo.com.br/livelo-para-parceiros/hilton-honors/HILTransfer', via: 'regulamento_url', sitemap_confirma: true },
    resp: { status: 200, location: '', html: HTML_HILTON },
  });
  assert.equal(r.status_coleta, 'campanha');
  assert.equal(r.resultado, 'corrobora_limpo');
  assert.ok(r.confianca >= LIMIAR_PARTIDA);
  assert.equal(r.decisoes[LIMIAR_PARTIDA.toFixed(2)], 'auto: publica (3 portoes)');
});

test('avaliarViva: evergreen -> nao confirma', () => {
  const r = avaliarViva({
    viva: { id: 'esfera-compra', origem_code: 'esfera', destino_code: 'esfera', tipo: 'compra', percentual: 50, publico: 'clube', tl_score_bruto: 40 },
    oficial: { url: 'https://www.esfera.com.vc/p/compra-de-pontos/e000100033', via: 'regulamento_url', sitemap_confirma: false },
    resp: { status: 200, location: '', html: HTML_EVERGREEN },
  });
  assert.equal(r.status_coleta, 'evergreen');
  assert.equal(r.resultado, 'nao_verificavel');
});

test('avaliarViva: 3xx -> encerrada, nao confirma', () => {
  const r = avaliarViva({
    viva: { id: 'x', origem_code: 'livelo', tipo: 'hotelaria', destino_code: 'hilton', percentual: 50, publico: 'geral', tl_score_bruto: 65 },
    oficial: { url: 'https://www.livelo.com.br/x', via: 'regulamento_url' },
    resp: { status: 302, location: '/promocao', html: '' },
  });
  assert.equal(r.status_coleta, 'nao_200');
});

test('avaliarViva: corte de valor exposto (piso 70)', () => {
  const r = avaliarViva({ viva: { id: 'x', origem_code: 'livelo', tipo: 'compra', percentual: 12, publico: 'geral', tl_score_bruto: 41 }, oficial: null, resp: null });
  assert.equal(r.passa_corte_valor, false);
  assert.equal(PISO_VALOR, 70);
});

// ── coletarLote (fetch injetado, dry-run) ──────────────────────────────────
test('coletarLote: dry-run com fetch injetado -> contagens coerentes', async () => {
  const vivas = [
    { id: 'hilton', origem_code: 'livelo', destino_code: 'hilton', tipo: 'hotelaria', percentual: 50, publico: 'geral', tl_score_bruto: 65, regulamento_url: 'https://www.livelo.com.br/livelo-para-parceiros/hilton-honors/HILTransfer' },
    { id: 'esfera', origem_code: 'esfera', destino_code: 'esfera', tipo: 'compra', percentual: 50, publico: 'clube', tl_score_bruto: 40, regulamento_url: 'https://www.esfera.com.vc/p/compra-de-pontos/e000100033' },
    { id: 'ali', origem_code: 'livelo', destino_code: 'aliexpress', tipo: 'compra', percentual: 25, publico: 'geral', tl_score_bruto: 60, regulamento_url: null },
  ];
  const fetchImpl = async (url) => {
    if (url.includes('hilton')) return { status: 200, location: '', html: HTML_HILTON };
    if (url.includes('esfera')) return { status: 200, location: '', html: HTML_EVERGREEN };
    return { status: 200, location: '', html: '' };
  };
  const rel = await coletarLote({ vivas, discovered: {}, fetchImpl, ref: '2026-07-17' });
  assert.equal(rel.contagens.total, 3);
  assert.equal(rel.contagens.corrobora_limpo, 1);
  assert.equal(rel.contagens.evergreen, 1);
  assert.equal(rel.contagens.sem_url_oficial, 1);
  assert.equal(rel.contagens.publicariam_no_limiar_partida, 1);
});
