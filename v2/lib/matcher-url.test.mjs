// Testes do matcher URL->campanha. node --test v2/lib/matcher-url.test.mjs
// Fixtures espelham a saída de extrairCampanha (adapters/base.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirIndices } from './identidade.mjs';
import { casarUrlCampanha } from './matcher-url.mjs';

const SEED = {
  programas: [
    { code: 'livelo', name: 'Livelo', kind: 'bancario', aliases: ['livelo'] },
    { code: 'esfera', name: 'Esfera', kind: 'bancario', aliases: ['esfera'] },
    { code: 'smiles', name: 'Smiles', kind: 'aereo', aliases: ['smiles', 'gol'] },
    { code: 'latam_pass', name: 'LATAM Pass', kind: 'aereo', aliases: ['latampass', 'latam', 'latam pass'] },
    { code: 'azul_fidelidade', name: 'Azul Fidelidade', kind: 'aereo', aliases: ['azul', 'tudoazul'] },
  ],
  ruido: ['desconhecido', 'null', 'na'],
  generico_recuperavel: ['banco', 'bancos', 'cartao', 'cartoes', 'parceiros'],
  buckets: { aereo: 'aerea_outra', bancario: 'banco_outro', hotel: 'hotel_outro', default: 'outro' },
};
const IX = construirIndices(SEED);
const REF = '2026-07-16';

// Payload real-ish da página de transferência Livelo->Smiles (fixture livelo-transfer.html).
const LIVELO_SMILES = {
  programa: 'livelo',
  url_canonica: 'https://www.livelo.com.br/livelo-para-parceiros/smiles/SMLTransfer',
  titulo: 'Transfira seus Pontos Livelo para Smiles e Aproveite Benefícios Exclusivos',
  descricao: 'Converta seus pontos Livelo em milhas Smiles com mais vantagens.',
  slug: 'smiles/SMLTransfer',
  percentual: 90,
  evidencia_percentual: 'slug:ate-90',
  tier: 1,
  papel: 'confirmacao_oficial',
  vigencia_fim: '2026-09-01',
  verificado_em: '2026-07-16',
};

test('confirmar: casa rota Livelo->Smiles já existente pela identity_key', () => {
  const existentes = [
    { identity_key: 'transferencia_bonificada|livelo|smiles|geral', campaign_id: 'camp_123' },
    { identity_key: 'transferencia_bonificada|esfera|latam_pass|geral', campaign_id: 'camp_999' },
  ];
  const r = casarUrlCampanha(LIVELO_SMILES, IX, existentes, REF);
  assert.equal(r.acao, 'confirmar');
  assert.equal(r.campaign_id, 'camp_123');
  assert.equal(r.identity_key, 'transferencia_bonificada|livelo|smiles|geral');
  // evidência com proveniência p/ campanha_fontes.payload (D-034)
  assert.equal(r.evidencia.url, LIVELO_SMILES.url_canonica);
  assert.equal(r.evidencia.percentual, 90);
  assert.equal(r.evidencia.tier, 1);
  assert.equal(r.evidencia.papel, 'confirmacao_oficial');
});

test('criar: rota não existe -> nasce já com fonte TIER 1', () => {
  const r = casarUrlCampanha(LIVELO_SMILES, IX, [], REF);
  assert.equal(r.acao, 'criar');
  assert.equal(r.identidade.identity_key, 'transferencia_bonificada|livelo|smiles|geral');
  assert.equal(r.identidade.origem_code, 'livelo');
  assert.equal(r.identidade.destino_code, 'smiles');
  assert.equal(r.identidade.tipo, 'transferencia_bonificada');
  assert.equal(r.payload_campanha.estado, 'ativa'); // vigência futura + tier1
  assert.equal(r.payload_campanha.percentual, 90);
  assert.equal(r.payload_campanha.url, LIVELO_SMILES.url_canonica);
  assert.equal(r.evidencia.tier, 1);
});

test('índice aceita entrada por {tipo,origem_code,destino_code,publico} sem identity_key', () => {
  const existentes = [
    { tipo: 'transferencia_bonificada', origem_code: 'livelo', destino_code: 'smiles', publico: 'geral', campaign_id: 'camp_abc' },
  ];
  const r = casarUrlCampanha(LIVELO_SMILES, IX, existentes, REF);
  assert.equal(r.acao, 'confirmar');
  assert.equal(r.campaign_id, 'camp_abc');
});

test('revisão: destino ambíguo (2+ programas plausíveis) NÃO força match', () => {
  const ambiguo = {
    ...LIVELO_SMILES,
    url_canonica: 'https://www.livelo.com.br/livelo-para-parceiros/oferta',
    titulo: 'Transfira Livelo para Smiles ou LATAM Pass com bônus',
    slug: 'smiles/latam-pass',
  };
  const r = casarUrlCampanha(ambiguo, IX, [], REF);
  assert.equal(r.acao, 'revisao');
  assert.equal(r.motivo, 'destino_ambiguo');
  assert.deepEqual([...r.detalhe.candidatos].sort(), ['latam_pass', 'smiles']);
});

test('revisão: tipo indefinido (sem sinal na página) abstém', () => {
  const semTipo = {
    programa: 'smiles',
    url_canonica: 'https://www.smiles.com.br/aereas/campanha-gol/20260512',
    titulo: 'Passagens Aéreas - Smiles',
    descricao: '',
    slug: 'aereas/campanha-gol',
    percentual: null,
    tier: 1,
    papel: 'confirmacao_oficial',
  };
  const r = casarUrlCampanha(semTipo, IX, [], REF);
  assert.equal(r.acao, 'revisao');
  assert.equal(r.motivo, 'tipo_indefinido');
});

test('revisão: transferência com destino não resolvido cai na regra por tipo do M1', () => {
  const semDestino = {
    programa: 'livelo',
    url_canonica: 'https://www.livelo.com.br/ofertas/transferencia-bonus',
    titulo: 'Transfira seus pontos com bônus',
    slug: 'ofertas/transferencia-bonus',
    tier: 1,
    papel: 'confirmacao_oficial',
  };
  const r = casarUrlCampanha(semDestino, IX, [], REF);
  assert.equal(r.acao, 'revisao');
  assert.equal(r.motivo, 'transferencia_sem_destino');
});

test('revisão: payload sem url canônica não confirma nada', () => {
  const r = casarUrlCampanha({ programa: 'livelo', titulo: 'x' }, IX, [], REF);
  assert.equal(r.acao, 'revisao');
  assert.equal(r.motivo, 'sem_url_canonica');
});

test('revisão: múltiplas campanhas sob a mesma identidade não adivinha qual', () => {
  const existentes = [
    { identity_key: 'transferencia_bonificada|livelo|smiles|geral', campaign_id: 'camp_A' },
    { identity_key: 'transferencia_bonificada|livelo|smiles|geral', campaign_id: 'camp_B' },
  ];
  const r = casarUrlCampanha(LIVELO_SMILES, IX, existentes, REF);
  assert.equal(r.acao, 'revisao');
  assert.equal(r.motivo, 'multiplas_campanhas_mesma_identidade');
  assert.deepEqual(r.detalhe.candidatos.sort(), ['camp_A', 'camp_B']);
});

test('campos semânticos explícitos no payload são autoritativos', () => {
  const explicito = {
    programa: 'esfera',
    url_canonica: 'https://www.esfera.com.vc/campanha-aniversario',
    titulo: 'Aniversário Esfera',
    slug: 'campanha-aniversario',
    tipo: 'transferencia',
    destino: 'latam_pass',
    tier: 1,
    papel: 'confirmacao_oficial',
  };
  const r = casarUrlCampanha(explicito, IX, [], REF);
  assert.equal(r.acao, 'criar');
  assert.equal(r.identidade.identity_key, 'transferencia_bonificada|esfera|latam_pass|geral');
});
