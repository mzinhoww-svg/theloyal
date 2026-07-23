// Golden do rating de auto-publish (decisão do operador): mínimo = gate verde +
// zero pendências de revisão. Qualquer flag baixa o rating → 1 clique.
// node --test scripts/daily.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarRating, decidirEnvio, upsertRascunho } from './daily.mjs';

test('acima do mínimo: gate verde + zero pendências → auto-elegível', () => {
  const r = avaliarRating({ pass: true, revisao: [] });
  assert.equal(r.auto, true);
  assert.equal(r.pendencias, 0);
});

test('abaixo do mínimo: gate verde mas com pendência → não automatiza (1 clique)', () => {
  const r = avaliarRating({ pass: true, revisao: [{ item: {}, flags: [{ flag: 'x' }] }] });
  assert.equal(r.auto, false);
  assert.equal(r.pendencias, 1);
  assert.match(r.motivo, /abaixo do mínimo/i);
});

test('gate vermelho nunca automatiza, mesmo sem pendências', () => {
  const r = avaliarRating({ pass: false, revisao: [] });
  assert.equal(r.auto, false);
  assert.match(r.motivo, /vermelho/i);
});

test('robusto a veredito parcial', () => {
  assert.equal(avaliarRating({}).auto, false);
  assert.equal(avaliarRating({ pass: true }).auto, true); // revisao ausente = 0 pendências
});

// ─── C2: trava de envio (freshness + durável + Beehiiv) ──────────────────────
const HOJE = '2026-07-22';

test('decidirEnvio: não elegível (publicar=false) → rascunho, nunca envia', () => {
  const d = decidirEnvio({ ed: { date: HOJE }, hoje: HOJE, publicar: false });
  assert.equal(d.enviar, false);
  assert.equal(d.acao, 'draft');
});

test('C2 (a) duas rodadas no mesmo dia → um só envio', () => {
  const ed = { date: HOJE, number: 42 };
  // rodada 1: fresca, sem trava prévia → ENVIA
  const r1 = decidirEnvio({ ed, hoje: HOJE, publicar: true, lockRemoto: null });
  assert.equal(r1.enviar, true);
  assert.equal(r1.acao, 'enviar');
  // rodada 2: a trava durável já registra o envio (sobrevive ao runner) → NO-OP
  const r2 = decidirEnvio({ ed, hoje: HOJE, publicar: true, lockRemoto: { enviado: true, post_id: 'post-1' } });
  assert.equal(r2.enviar, false);
  assert.equal(r2.acao, 'ja-enviado');
  assert.equal(r2.postId, 'post-1');
});

test('C2 (b) edição de ontem nunca auto-envia (freshness)', () => {
  const d = decidirEnvio({ ed: { date: '2026-07-21' }, hoje: HOJE, publicar: true, lockRemoto: null });
  assert.equal(d.enviar, false);
  assert.equal(d.acao, 'bloqueado-stale');
  assert.match(d.motivo, /não é de hoje/);
});

test('C2 (c) re-run manual após envio → no-op (trava durável, runner efêmero)', () => {
  // ledger de ARQUIVO zerado (runner novo), mas a trava DURÁVEL sabe do envio.
  const d = decidirEnvio({ ed: { date: HOJE }, hoje: HOJE, publicar: true, lockRemoto: { enviado: true, post_id: 'post-x' } });
  assert.equal(d.enviar, false);
  assert.equal(d.acao, 'ja-enviado');
});

test('C2 (d) idempotência server-side: post do dia já enviado no Beehiiv → não cria segundo', () => {
  const d = decidirEnvio({ ed: { date: HOJE }, hoje: HOJE, publicar: true, lockRemoto: null, postBeehiivEnviado: { id: 'bh-9', status: 'confirmed' } });
  assert.equal(d.enviar, false);
  assert.equal(d.acao, 'ja-enviado-beehiiv');
  assert.equal(d.postId, 'bh-9');
});

// Integração: prova ponta-a-ponta que o CLAIM ATÔMICO deixa só UMA rodada enviar,
// mesmo com o ledger de arquivo zerado (simula runner efêmero). Sem rede real —
// todas as I/O são injetadas.
test('C2 integração: claim atômico → só a 1ª rodada dispara envio real', async () => {
  // env INJETADO (io.env) — zero mutação de process.env global, à prova de corrida
  // com outros arquivos de teste no runner.
  const env = { SUPABASE_URL: 'http://fake', SUPABASE_SERVICE_ROLE_KEY: 'fake', BEEHIIV_API_KEY: 'fake', BEEHIIV_PUBLICATION_ID: 'pub' };
  const ed = { date: '2099-12-31', number: 777, beehiivTitle: 'T' };
  let reservado = false; // estado durável do dia (sobrevive ao "runner")
  const enviosReais = [];
  const io = {
    env,
    lerLock: async () => (reservado ? { enviado: true, post_id: 'p' } : null),
    reservar: async () => {
      if (reservado) return { reservado: false, ja_enviado: true, post_id: 'p' };
      reservado = true; return { reservado: true, ja_enviado: false, post_id: null };
    },
    gravarLock: async () => {},
    buscarPostBeehiiv: async () => null,
    fetchImpl: async (u, opts) => {
      if (opts?.method === 'POST' || opts?.method === 'PATCH') enviosReais.push(u);
      return { ok: true, json: async () => ({ data: { id: 'p', web_url: 'u' } }) };
    },
  };
  const r1 = await upsertRascunho({ ed, html: '<p>x</p>', hoje: '2099-12-31', publicar: true, io });
  const r2 = await upsertRascunho({ ed, html: '<p>x</p>', hoje: '2099-12-31', publicar: true, io });
  assert.equal(r1.enviado, true, 'rodada 1 envia');
  assert.equal(r2.enviado, true, 'rodada 2 reporta já-enviado');
  assert.equal(r2.status, 'ja-enviado');
  assert.equal(enviosReais.length, 1, 'exatamente UMA chamada real ao Beehiiv');
});

// Tier sem API (Launch): o POST de RASCUNHO volta 400. O runner NÃO pode morrer —
// a edição, o render, o gate e o ledger já são o produto do dia; a publicação vira
// manual na UI. Envio real (publicar:true) segue ruidoso e é coberto à parte.
test('rascunho: POST 400 (tier sem API) degrada sem lançar — publicação manual', async () => {
  const env = { SUPABASE_URL: 'http://fake', SUPABASE_SERVICE_ROLE_KEY: 'fake', BEEHIIV_API_KEY: 'fake', BEEHIIV_PUBLICATION_ID: 'pub' };
  const ed = { date: '2099-12-31', number: 778, beehiivTitle: 'T' };
  const io = {
    env,
    lerLock: async () => null,
    reservar: async () => ({ reservado: true, ja_enviado: false, post_id: null }),
    gravarLock: async () => {},
    buscarPostBeehiiv: async () => null,
    fetchImpl: async () => ({ ok: false, status: 400, text: async () => 'publicationid pattern não bate' }),
  };
  const r = await upsertRascunho({ ed, html: '<p>x</p>', hoje: '2099-12-31', publicar: false, io });
  assert.equal(r.enviado, false, 'sem envio no degrade');
  assert.match(r.status, /publicar na UI/i);
});
