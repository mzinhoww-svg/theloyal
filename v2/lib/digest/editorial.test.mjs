// Golden do vocabulário editorial v4 (D-059). node --test v2/lib/digest/editorial.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { URGENCY_RE, EMOJI_RE } from '../../../scripts/lib.mjs';
import {
  NOME_PROGRAMA, nomePrograma, TIPO_LABEL, tipoLabel, rotaDisplay,
  JARGAO_PROIBIDO, lintJargao, STATUS_SEM_CONFIRMACAO, EXPLICA_SEM_NOTA,
  scoreRelevanciaClipping, ordenarClippingPorRelevancia,
  PALAVRA_PROBABILIDADE, formatarPredictNarrativa, formatarDataBr, formatarDiaMes,
} from './editorial.mjs';

// ── nomes de programa ──
test('nomePrograma: códigos conhecidos viram nome do leitor', () => {
  assert.equal(nomePrograma('smiles'), 'Smiles');
  assert.equal(nomePrograma('azul_fidelidade'), 'Azul Fidelidade');
  assert.equal(nomePrograma('latam_pass'), 'LATAM Pass');
  assert.equal(nomePrograma('membership_rewards'), 'Amex Membership Rewards');
  assert.equal(nomePrograma('multiplos_cartoes'), 'Múltiplos cartões');
  assert.equal(nomePrograma('bnb'), 'Banco do Nordeste');
  assert.equal(nomePrograma('flyingblue'), 'Flying Blue');
  assert.equal(nomePrograma('hilton'), 'Hilton Honors');
  assert.equal(nomePrograma('itau'), 'Itaú');
  assert.equal(nomePrograma('c6'), 'C6');
});

test('nomePrograma: código desconhecido cai no próprio código, nunca lança', () => {
  assert.equal(nomePrograma('programa_fantasma'), 'programa_fantasma');
  assert.equal(nomePrograma(null), '');
  assert.equal(nomePrograma(undefined), '');
});

test('NOME_PROGRAMA: cobertura mínima ratificada (D-059)', () => {
  const obrigatorios = [
    'smiles', 'livelo', 'esfera', 'azul_fidelidade', 'latam_pass', 'itau', 'inter', 'c6',
    'bradesco', 'banco_do_brasil', 'caixa', 'brb', 'nubank', 'santander', 'btg', 'xp',
    'picpay', 'membership_rewards', 'multiplos_cartoes', 'hilton', 'lifemiles', 'accor',
    'flyingblue', 'bnb', 'hyatt', 'mercado_livre', 'costa_cruzeiros', 'shell', 'uber', 'aliexpress',
  ];
  for (const code of obrigatorios) {
    assert.ok(code in NOME_PROGRAMA, `NOME_PROGRAMA deveria cobrir "${code}"`);
  }
});

// ── rota de exibição ──
test('rotaDisplay: compra exibe o PRÓPRIO programa — nunca "sem destino" (regra do operador)', () => {
  assert.equal(rotaDisplay({ origem: 'smiles', destino: 'smiles', tipo: 'compra' }), 'Smiles → Smiles');
  assert.equal(rotaDisplay({ origem: 'smiles', destino: 'sem_destino', tipo: 'compra' }), 'Smiles → Smiles');
  assert.equal(rotaDisplay({ origem: 'smiles', destino: null, tipo: 'compra' }), 'Smiles → Smiles');
  // shape legado de fixture: origem "brl", destino = programa comprado.
  assert.equal(rotaDisplay({ origem: 'brl', destino: 'esfera', tipo: 'compra' }), 'Esfera → Esfera');
});

test('rotaDisplay: clube segue a mesma regra de programa próprio', () => {
  assert.equal(rotaDisplay({ origem: 'azul_fidelidade', destino: 'azul_fidelidade', tipo: 'clube' }), 'Azul Fidelidade → Azul Fidelidade');
  assert.equal(rotaDisplay({ origem: 'smiles', destino: null, tipo: 'clube' }), 'Smiles → Smiles');
});

test('rotaDisplay: pontos_mais_dinheiro mantém origem → destino (compra em A, transfere para B)', () => {
  assert.equal(rotaDisplay({ origem: 'esfera', destino: 'smiles', tipo: 'pontos_mais_dinheiro' }), 'Esfera → Smiles');
});

test('rotaDisplay: transferência usa nomes legíveis; destino nulo/sem_destino exibe só a origem', () => {
  assert.equal(rotaDisplay({ origem: 'itau', destino: 'azul_fidelidade', tipo: 'transferencia' }), 'Itaú → Azul Fidelidade');
  assert.equal(rotaDisplay({ origem: 'livelo', destino: null, tipo: 'transferencia' }), 'Livelo');
  assert.equal(rotaDisplay({ origem: 'livelo', destino: 'sem_destino', tipo: 'transferencia' }), 'Livelo');
});

test('rotaDisplay: nunca produz "sem destino"/"sem_destino" para compra/clube', () => {
  const casos = [
    { origem: 'smiles', destino: 'sem_destino', tipo: 'compra' },
    { origem: 'esfera', destino: null, tipo: 'compra' },
    { origem: 'azul_fidelidade', destino: 'sem_destino', tipo: 'clube' },
  ];
  for (const c of casos) {
    assert.doesNotMatch(rotaDisplay(c), /sem[_ ]destino/i);
  }
});

// ── tipo label ──
test('tipoLabel: taxonomia → rótulo do leitor, fallback sem underscore', () => {
  assert.equal(tipoLabel('transferencia'), 'Transferência bonificada');
  assert.equal(tipoLabel('compra'), 'Compra de pontos');
  assert.equal(tipoLabel('pontos_mais_dinheiro'), 'Pontos + dinheiro');
  assert.equal(tipoLabel('tipo_novo'), 'tipo novo');
  assert.equal(tipoLabel(null), '');
  assert.ok('cartao' in TIPO_LABEL);
});

// ── lint de jargão ──
test('lintJargao: pega cada termo interno banido (D-059)', () => {
  assert.deepEqual(lintJargao('só 1 com conta computável hoje'), ['conta computável']);
  assert.deepEqual(lintJargao('56 candidatos vivos no radar'), ['candidato vivo']);
  assert.deepEqual(lintJargao('fonte TIER 1 confirmada'), ['TIER 1']);
  assert.deepEqual(lintJargao('alimentado por tier2'), ['TIER 2']);
  assert.deepEqual(lintJargao('o veredito da régua ficou em 55'), ['veredito da régua']);
  assert.deepEqual(lintJargao('valor recomputado no banco'), ['recomputado']);
  assert.deepEqual(lintJargao('tl_score_bruto=55'), ['tl_score_bruto']);
  assert.deepEqual(lintJargao('veredito_bruto="Vale agir"'), ['veredito_bruto']);
  assert.deepEqual(lintJargao('segue em estado vivo'), ['estado vivo']);
  assert.deepEqual(lintJargao('passou os três portões'), ['três portões']);
  assert.deepEqual(lintJargao('passou os 3 portões'), ['três portões']);
});

test('lintJargao: texto limpo (vocabulário do leitor) retorna vazio', () => {
  const limpo = 'Só uma promoção confirmada em fonte oficial hoje: Smiles com 375% de bônus, TL Score 55 — Só para casos específicos.';
  assert.deepEqual(lintJargao(limpo), []);
  assert.deepEqual(lintJargao(''), []);
  assert.deepEqual(lintJargao(null), []);
  assert.equal(JARGAO_PROIBIDO.length, 10);
});

// ── strings canônicas ──
test('constantes canônicas do estado sem confirmação (fonte única, D-059)', () => {
  assert.equal(STATUS_SEM_CONFIRMACAO, 'Ainda sem confirmação oficial');
  assert.equal(EXPLICA_SEM_NOTA, 'Quando a regra ainda não foi confirmada no site oficial do programa, a oferta aparece sem nota TL — a nota só sai depois da confirmação.');
});

// ── ordenação do Clipping ──
test('scoreRelevanciaClipping: acionável=0, geral=1, lounge/hotel=2', () => {
  assert.equal(scoreRelevanciaClipping({ title: 'Inter oferece 54% de desconto na compra de pontos Loop' }), 0);
  assert.equal(scoreRelevanciaClipping({ title: 'Esfera oferece até 5 pontos por real gasto' }), 0);
  assert.equal(scoreRelevanciaClipping({ title: 'Livelo dá 25 pontos por dólar no AliExpress', summary: 'acúmulo turbinado' }), 0);
  assert.equal(scoreRelevanciaClipping({ title: 'Embarque com reconhecimento facial chega à Qatar Airways' }), 1);
  assert.equal(scoreRelevanciaClipping({ title: 'Hotéis em Belo Horizonte com diárias a partir de R$ 138' }), 2);
  assert.equal(scoreRelevanciaClipping({ title: 'Companhia reabre lounge La Première em Paris' }), 2);
});

test('ordenarClippingPorRelevancia: determinística e estável (empate mantém ordem original)', () => {
  const itens = [
    { title: 'Hotéis com diárias baratas' }, // 2
    { title: 'Qatar testa embarque facial' }, // 1
    { title: 'Compra de pontos com desconto' }, // 0
    { title: 'Aérea muda app de bordo' }, // 1
    { title: 'Bônus de transferência anunciado' }, // 0
  ];
  const r1 = ordenarClippingPorRelevancia(itens);
  const r2 = ordenarClippingPorRelevancia(itens);
  assert.deepEqual(r1.map((i) => i.title), [
    'Compra de pontos com desconto',
    'Bônus de transferência anunciado',
    'Qatar testa embarque facial',
    'Aérea muda app de bordo',
    'Hotéis com diárias baratas',
  ]);
  assert.deepEqual(r1, r2, 'mesma entrada → mesma saída (INV-12)');
  assert.deepEqual(itens[0].title, 'Hotéis com diárias baratas', 'não muta a entrada');
});

test('ordenarClippingPorRelevancia: vazio/ausente não lança', () => {
  assert.deepEqual(ordenarClippingPorRelevancia([]), []);
  assert.deepEqual(ordenarClippingPorRelevancia(undefined), []);
});

// ── narrativa do Predict ──
test('formatarPredictNarrativa: em-formacao diz sem rodeios que não há janela prevista', () => {
  const texto = formatarPredictNarrativa({ rotaOrigem: 'esfera', rotaDestino: 'smiles', historicoTipicoPercent: 70, probabilidade: 'em-formacao' });
  assert.ok(texto.includes('Esfera → Smiles'), 'cita a rota com nomes legíveis');
  assert.ok(texto.includes('70%'), 'cita o histórico típico');
  assert.ok(texto.includes('em formação'), 'probabilidade visível');
  assert.ok(texto.includes('sem promoção de transferência à vista'));
  assert.ok(texto.includes('Digest Pro'), 'teaser sempre presente');
});

test('formatarPredictNarrativa: baixa também nega janela prevista', () => {
  const texto = formatarPredictNarrativa({ rotaOrigem: 'livelo', rotaDestino: 'azul_fidelidade', historicoTipicoPercent: null, probabilidade: 'baixa' });
  assert.ok(texto.includes('Livelo → Azul Fidelidade'));
  assert.ok(texto.includes('baixa'));
  assert.ok(texto.includes('sem promoção de transferência à vista'));
  assert.ok(!texto.includes('histórico típico'), 'sem histórico quando null');
  assert.ok(texto.includes('Digest Pro'));
});

test('formatarPredictNarrativa: media/alta anunciam janela prevista SEM data/valor', () => {
  for (const [prob, palavra] of [['media', 'média'], ['alta', 'alta']]) {
    const texto = formatarPredictNarrativa({ rotaOrigem: 'itau', rotaDestino: 'latam_pass', historicoTipicoPercent: 23, probabilidade: prob });
    assert.ok(texto.includes(`probabilidade ${palavra}`), `probabilidade ${palavra} visível`);
    assert.ok(texto.includes('Itaú → LATAM Pass'));
    assert.doesNotMatch(texto, /\d{4}/, 'nunca cita ano/data');
    assert.doesNotMatch(texto, /\bde \d{1,2} a \d{1,2}\b/, 'nunca cita janela "de X a Y"');
    assert.ok(texto.includes('Digest Pro'));
  }
});

test('formatarPredictNarrativa: nunca urgência, nunca emoji, nunca data futura', () => {
  for (const prob of Object.keys(PALAVRA_PROBABILIDADE)) {
    const texto = formatarPredictNarrativa({ rotaOrigem: 'esfera', rotaDestino: 'smiles', historicoTipicoPercent: 70, probabilidade: prob });
    assert.doesNotMatch(texto, URGENCY_RE);
    assert.doesNotMatch(texto, EMOJI_RE);
    assert.doesNotMatch(texto, /\d{4}/);
  }
});

test('formatarPredictNarrativa: probabilidade desconhecida lança (sem fallback silencioso)', () => {
  assert.throws(() => formatarPredictNarrativa({ rotaOrigem: 'a', rotaDestino: 'b', probabilidade: 'certeza' }), /probabilidade desconhecida/);
  assert.throws(() => formatarPredictNarrativa({}), /probabilidade desconhecida/);
});

// ── datas ──
test('formatarDataBr/formatarDiaMes: ISO → dd/mm/yyyy e dd/mm; fora do formato volta como veio', () => {
  assert.equal(formatarDataBr('2026-07-17'), '17/07/2026');
  assert.equal(formatarDataBr('2026-07-17T23:59:00-03:00'), '17/07/2026');
  assert.equal(formatarDiaMes('2026-07-15'), '15/07');
  assert.equal(formatarDiaMes('sem data'), 'sem data');
  assert.equal(formatarDataBr(null), '');
});
