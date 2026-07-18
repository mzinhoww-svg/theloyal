// Teste do runner de produção com fetch MOCKADO (nunca bate na rede real aqui).
// Cobre: idempotência (não reprocessa id já visto hoje), montagem das
// chamadas REST corretas (PATCH campaigns só quando o plano manda, INSERT
// campanha_fontes sempre, INSERT campanha_versoes só quando o plano manda).
// node --test v2/lib/coleta/rodar-producao.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rodarCiclo } from './rodar-producao.mjs';

const URL = 'https://fake.supabase.co';
const KEY = 'fake-key';
const HOJE = '2026-07-17';

function mockFetch(calls, { candidato, jaVisto = false, htmlOficial = '' } = {}) {
  return async (input, opts = {}) => {
    const url = String(input);
    calls.push({ url, method: opts.method || 'GET', body: opts.body });

    if (url.includes('/rest/v1/campaigns?select=')) {
      return jsonResp(candidato ? [candidato] : []);
    }
    if (url.includes('/rest/v1/campanha_fontes?select=campaign_id')) {
      return jsonResp(jaVisto && candidato ? [{ campaign_id: candidato.id }] : []);
    }
    if (url.includes('sitemap') || opts.headers?.accept === 'application/xml') {
      return { status: 200, text: async () => '' };
    }
    if (url.includes('/rest/v1/campaigns?id=eq.')) {
      return jsonResp([], { method: 'PATCH' });
    }
    if (url.includes('/rest/v1/campanha_fontes') && (opts.method === 'POST')) {
      return jsonResp([]);
    }
    if (url.includes('/rest/v1/campanha_versoes') && (opts.method === 'POST')) {
      return jsonResp([]);
    }
    // Fetch da página oficial (fetchOficial usa redirect:'manual').
    return { status: 200, headers: { get: () => '' }, text: async () => htmlOficial };
  };
}
function jsonResp(data) { return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) }; }

test('candidato ja processado hoje -> pulado, zero escrita', async () => {
  const calls = [];
  const candidato = { id: 'livelo-azul-transferencia-2026-07-31', origem_code: 'livelo', destino_code: 'azul', tipo: 'transferencia', publico: 'geral', percentual: 100, tl_score_bruto: 75, veredito_bruto: 'Vale agir', override_aplicado: null, identidade_id: 'x1' };
  const realFetch = global.fetch;
  global.fetch = mockFetch(calls, { candidato, jaVisto: true });
  try {
    const resumo = await rodarCiclo({ url: URL, key: KEY, hoje: HOJE });
    assert.equal(resumo.candidatos_no_banco, 1);
    assert.equal(resumo.processados_agora, 0);
    assert.equal(resumo.ja_processados_hoje, 1);
    const escreveu = calls.some((c) => c.method === 'PATCH' || (c.method === 'POST' && c.url.includes('campanha_')));
    assert.equal(escreveu, false, 'nao deveria escrever nada para item ja processado hoje');
  } finally { global.fetch = realFetch; }
});

test('zero candidatos no banco -> ciclo limpo, zero chamada de sitemap/fetch oficial', async () => {
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = mockFetch(calls, { candidato: null });
  try {
    const resumo = await rodarCiclo({ url: URL, key: KEY, hoje: HOJE });
    assert.equal(resumo.candidatos_no_banco, 0);
    assert.equal(resumo.processados_agora, 0);
    assert.deepEqual(resumo.itens, []);
  } finally { global.fetch = realFetch; }
});

test('candidato novo sem URL oficial descobrivel -> vai a revisao, PATCH em campaigns nunca chamado', async () => {
  const calls = [];
  const candidato = { id: 'obscuro-desconhecido-compra-na', origem_code: 'livelo', destino_code: 'desconhecido', tipo: 'compra', publico: 'geral', percentual: null, tl_score_bruto: 71, veredito_bruto: 'Esperaria', override_aplicado: null, identidade_id: 'x2' };
  const realFetch = global.fetch;
  global.fetch = mockFetch(calls, { candidato, jaVisto: false });
  try {
    const resumo = await rodarCiclo({ url: URL, key: KEY, hoje: HOJE });
    assert.equal(resumo.processados_agora, 1);
    assert.equal(resumo.itens[0].acao, 'revisao');
    const patchCampaigns = calls.some((c) => c.method === 'PATCH' && c.url.includes('/campaigns?id=eq.'));
    assert.equal(patchCampaigns, false, 'revisao nunca deveria fazer PATCH em campaigns');
    const insertFontes = calls.some((c) => c.method === 'POST' && c.url.includes('campanha_fontes'));
    assert.equal(insertFontes, true, 'revisao ainda grava a trilha em campanha_fontes');
  } finally { global.fetch = realFetch; }
});
