// Golden do outcomes-ledger (GAMMA · D-048/D-202). node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  montarLinhasOutcome, sinaisDaFonte, linhaAcaoHumana, linhaDesfecho, SECOES,
} from './ledger.mjs';

// Uma campanha viva, TIER1 confirmado, conta computável, veredito Deal Desk.
function campanhaDealDesk(over = {}) {
  return {
    id: 'livelo-latam_pass-transferencia-2026-07-30',
    origem_code: 'livelo', destino_code: 'latam_pass', tipo: 'transferencia',
    estado: 'ativa', tem_tier1: true, triagem_categoria: 'limpo', tl_score_bruto: 82, veredito_bruto: 'Vale agir',
    percentual: 30, vigencia_fim: '2026-07-30', vigencia_fim_date: '2026-07-30',
    ...over,
  };
}

// Payload real de campanha_fontes (papel confirmação): breakdown dos 5 sinais.
const FONTE_ALTA = {
  payload: {
    confianca: 0.85, resultado: 'corrobora_limpo',
    breakdown: [
      { sinal: 'fonte_oficial', presente: true },
      { sinal: 'janela_vigencia_clara', presente: true },
      { sinal: 'estado_vivo_200', presente: true },
      { sinal: 'publico_inequivoco', presente: false },
      { sinal: 'termos_legiveis', presente: true },
    ],
  },
};

test('captura de 1 edição gera as linhas certas (deals + ofertas_ativas)', () => {
  const c = campanhaDealDesk();
  const ed = { date: '2026-07-30', number: 37, clipping: [] };
  const rows = montarLinhasOutcome({ ed, campaigns: [c], fontesById: { [c.id]: FONTE_ALTA } });

  // o mesmo item passa em Deal Desk E em ofertas ativas (3 portões) → 2 seções.
  const secoes = rows.map((r) => r.section).sort();
  assert.deepEqual(secoes, ['deals', 'ofertas_ativas']);

  const deal = rows.find((r) => r.section === 'deals');
  assert.equal(deal.edition_date, '2026-07-30');
  assert.equal(deal.edition_number, 37);
  assert.equal(deal.campaign_id, c.id);
  assert.equal(deal.route_key, 'livelo->latam_pass');
  assert.equal(deal.veredito, 'vale-agir');
  assert.equal(deal.banda, 'vale-agir');
  assert.equal(deal.tl_score, 82);
  // sinais LIDOS da confirmação (não recomputados)
  assert.equal(deal.sinal_fonte_oficial, true);
  assert.equal(deal.sinal_publico_inequivoco, false);
  assert.equal(deal.confianca_confirmacao, 0.85);
  assert.equal(deal.resultado_confirmacao, 'corrobora_limpo');
});

test('desfecho e ação humana nascem NULL — nunca coagidos a 0/valor (INV-03, regra 8)', () => {
  const c = campanhaDealDesk();
  const ed = { date: '2026-07-30', number: 37, clipping: [] };
  const [row] = montarLinhasOutcome({ ed, campaigns: [c], fontesById: {} });
  // captura não inventa desfecho nem ação
  assert.equal('desfecho' in row, false, 'linha de captura não carrega desfecho');
  assert.equal('acao_humana' in row, false, 'linha de captura não carrega ação humana');
  // sem confirmação disponível → sinais NULL, jamais false/0
  assert.equal(row.sinal_fonte_oficial, null);
  assert.equal(row.confianca_confirmacao, null);
  assert.equal(row.tl_score, 82); // score É capturado (foi mostrado)
});

test('nullable não coage: confianca 0 real ≠ ausência (null)', () => {
  const zero = sinaisDaFonte({ payload: { confianca: 0, resultado: 'refuta', breakdown: [] } });
  assert.equal(zero.confianca_confirmacao, 0, 'confiança 0 medida é 0, não null');
  const ausente = sinaisDaFonte(null);
  assert.equal(ausente.confianca_confirmacao, null, 'ausência é null, não 0');
});

test('ação humana registrada valida o domínio fechado', () => {
  const ok = linhaAcaoHumana({ acao: 'aprovado_1clique', em: '2026-07-30T11:00:00Z' });
  assert.equal(ok.acao_humana, 'aprovado_1clique');
  assert.equal(ok.acao_humana_motivo, null);
  assert.equal(ok.acao_humana_em, '2026-07-30T11:00:00Z');
  const corr = linhaAcaoHumana({ acao: 'corrigido', motivo: 'ajuste de percentual' });
  assert.equal(corr.acao_humana_motivo, 'ajuste de percentual');
  assert.throws(() => linhaAcaoHumana({ acao: 'publicar' }), /acao inválida/);
});

test('desfecho valida domínio fechado e nunca é chamado por montagem', () => {
  const d = linhaDesfecho({ desfecho: 'confirmou_real', em: '2026-08-01T00:00:00Z', fonte: 'regulamento oficial' });
  assert.equal(d.desfecho, 'confirmou_real');
  assert.equal(d.desfecho_fonte, 'regulamento oficial');
  assert.throws(() => linhaDesfecho({ desfecho: 'talvez' }), /desfecho inválido/);
});

test('clipping vira linha por url, sem campanha nem sinais', () => {
  const ed = {
    date: '2026-07-30', number: 37,
    clipping: [{ title: 'X', url: 'https://ex.com/a', source: 'S', summary: 'síntese própria' }],
  };
  const rows = montarLinhasOutcome({ ed, campaigns: [], fontesById: {} });
  const clip = rows.find((r) => r.section === 'clipping');
  assert.equal(clip.item_key, 'https://ex.com/a');
  assert.equal(clip.campaign_id, null);
  assert.equal(clip.confianca_confirmacao, null);
});

test('EPSILON: viva triada SEM lastro → 0 deals (C1 intacto), mas 1 ofertas_ativas com selo nao-confirmado', () => {
  const ed = { date: '2026-07-22', number: 29, clipping: [] };
  const vivaSemLastro = campanhaDealDesk({ tem_tier1: false }); // triada (limpo), sem lastro
  const rows = montarLinhasOutcome({ ed, campaigns: [vivaSemLastro], fontesById: {} });
  assert.equal(rows.filter((r) => r.section === 'deals').length, 0, 'Deal Desk exige lastro (C1)');
  const oa = rows.filter((r) => r.section === 'ofertas_ativas');
  assert.equal(oa.length, 1, 'transparência mostra a oferta viva triada');
  assert.equal(oa[0].veredito, 'nao-confirmado', 'sem lastro → selo nao-confirmado (INV-03)');
});

test('dia fraco genuíno: viva NÃO-triada → zero linhas de campanha (não inventa)', () => {
  const ed = { date: '2026-07-22', number: 29, clipping: [] };
  const vivaNaoTriada = campanhaDealDesk({ tem_tier1: false, triagem_categoria: null });
  const rows = montarLinhasOutcome({ ed, campaigns: [vivaNaoTriada], fontesById: {} });
  assert.equal(rows.filter((r) => r.section === 'deals').length, 0);
  assert.equal(rows.filter((r) => r.section === 'ofertas_ativas').length, 0);
});

test('SECOES é o domínio fechado esperado', () => {
  assert.deepEqual([...SECOES], ['deals', 'ofertas_ativas', 'fecha_logo', 'cartoes_bancos', 'clipping', 'sinal']);
});
