// Smoke test do renderer realinhado ao formato v4 (D-059 — formato aprovado
// pelo operador nas rodadas editoriais; estrutura D-057 mantida por baixo).
// node --test renderer/email.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderEmail } from './email.mjs';
import { DEAL_DESK_MARKER } from '../v2/lib/digest/gate-5-5.mjs';
import { lintJargao, EXPLICA_SEM_NOTA } from '../v2/lib/digest/editorial.mjs';
import { IMG_HEADER, IMG_SECAO_SINAL, IMG_SECAO_FECHA, IMG_DIVISOR_LINHA } from '../v2/lib/digest/render-beehiiv.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const diaForte = JSON.parse(readFileSync(join(DIR, 'examples', 'dia-forte.json'), 'utf8'));
const diaFraco = JSON.parse(readFileSync(join(DIR, 'examples', 'dia-fraco.json'), 'utf8'));

test('dia-forte: renderiza sem lançar, HTML bem formado (doctype + html + body fecham)', () => {
  const html = renderEmail(diaForte);
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<\/body><\/html>$/);
});

test('dia-forte: imagens do template v4 presentes (header, sinal, divisor) — arte FECHA LOGO fora (rótulo oficial é Vence em até 72h)', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes(IMG_HEADER));
  assert.ok(html.includes(IMG_SECAO_SINAL));
  assert.ok(!html.includes(IMG_SECAO_FECHA), 'arte com o nome antigo não entra');
  assert.ok(html.includes('Vence em até 72h'));
  assert.ok(html.includes(IMG_DIVISOR_LINHA));
});

test('dia-forte: linha meta no formato v4 — Nº · DIA · dd/mm/yyyy · leitura de N min', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('Nº 41'));
  assert.ok(html.includes('08/07/2026'));
  assert.ok(html.includes('leitura de 6 min'));
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

test('dia-forte: Fecha Logo é caixa amarela (fill yellow-100, borda yellow-500) com os 2 itens e link (fonte)', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('Vence em até 72h'), 'título oficial da seção');
  assert.ok(html.includes('VENCE EM 48H'));
  assert.ok(html.includes('VENCE EM 24H'));
  assert.ok(html.includes('background-color:#FCF0CE; border-left:4px solid #F2C94C'));
  assert.ok(html.includes('>fonte</a>'), 'item com url ganha link (fonte)');
});

test('dia-forte: Ofertas ativas usa rotaDisplay — compra exibe o próprio programa, nunca "sem destino"', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('Ofertas ativas'));
  assert.ok(html.includes('Livelo → Smiles'));
  assert.ok(html.includes('Smiles → Smiles'), 'compra com destino null vira programa próprio');
  assert.ok(html.includes('Esfera → Esfera'), 'compra brl→esfera vira programa próprio');
  // A regra é sobre a ROTA exibida ("→ sem destino"), não sobre prosa legítima
  // que use as palavras (ex.: "sai caro sem destino fechado").
  assert.ok(!html.includes('sem_destino'));
  assert.ok(!/→\s*sem destino/i.test(html));
});

test('dia-forte: Ofertas ativas mostra CPM em mono + "por milheiro" e sublinha com tipo/nota/prazo', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('R$ 16,60'));
  assert.ok(html.includes('por milheiro'));
  assert.ok(html.includes('Transferência bonificada (Clube)'));
  assert.ok(html.includes('TL 88'));
  assert.ok(html.includes('vence 09/07'));
});

test('dia-forte: renderiza os blocos na ordem v4 — Sinal → Ofertas → Deals → Fecha logo → Cartões e bancos → Clipping → O que fechou → Radar VPM → Loyalty Lab → Predict', () => {
  const html = renderEmail(diaForte);
  const idx = (needle) => html.indexOf(needle);
  const sinal = idx('Sinal do dia');
  const ofertas = idx('Ofertas ativas');
  const deals = idx('Deals do dia');
  const fecha = idx('Vence em até 72h');
  const cartoes = idx('Cartões e bancos');
  const clipping = idx('>Clipping<');
  const fechouSemana = idx('O que fechou nesta semana');
  const radarVpm = idx('Radar VPM');
  const lab = idx('Loyalty Lab');
  const predict = idx('>Predict<');
  assert.ok(
    sinal >= 0 && ofertas > sinal && deals > ofertas && fecha > deals && cartoes > fecha &&
    clipping > cartoes && fechouSemana > clipping && radarVpm > fechouSemana && lab > radarVpm && predict > lab,
    `ordem inesperada: sinal=${sinal} ofertas=${ofertas} deals=${deals} fecha=${fecha} cartoes=${cartoes} clipping=${clipping} fechouSemana=${fechouSemana} radarVpm=${radarVpm} lab=${lab} predict=${predict}`,
  );
});

test('dia-forte: Sinal do dia funde resumoDoDia com números em negrito + link fonte oficial', () => {
  const html = renderEmail(diaForte);
  assert.ok(!html.includes('>RESUMO DO DIA<'), 'não deveria haver eyebrow própria "Resumo do dia"');
  assert.ok(html.includes('Latam Pass revisou a tabela de resgate'));
  assert.ok(html.includes('<strong>36</strong>'), 'números do item confirmado em negrito');
  assert.ok(html.includes('>fonte oficial</a>'));
});

test('dia-forte: radar sem confirmação dentro do Sinal do dia — título linkado, TL quando há nota', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('No radar, ainda sem confirmação oficial:'));
  assert.ok(html.includes('Coalizão de varejo: bônus de transferência anunciado em rede social'));
  assert.ok(html.includes('TL 61'));
  assert.ok(html.includes('(pontospravoar)'));
});

test('dia-forte: narrativa do Predict no Sinal do dia (probabilidade visível) + teaser formal separado', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('probabilidade alta de uma nova janela'));
  assert.ok(html.includes('2 previsões ativas esta semana no radar'));
  assert.ok(html.includes('Digest Pro'));
});

test('dia-forte: Cartões e bancos por item — intro EXPLICA_SEM_NOTA + fonte linkada', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('Cartões e bancos'));
  assert.ok(html.includes('a nota só sai depois da confirmação'), 'intro canônica EXPLICA_SEM_NOTA');
  assert.ok(html.includes('Itaú · cartões parceiros'));
  assert.ok(html.includes('Ainda sem confirmação oficial'));
});

test('dia-forte: O que fechou usa nomes legíveis e dd/mm', () => {
  const html = renderEmail(diaForte);
  assert.ok(html.includes('Livelo → Azul'));
  assert.ok(html.includes('120%'));
  assert.ok(html.includes('05/07'));
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

// ── dia fraco (espelho da edição canônica nº 1): a garantia central ──
test('dia-fraco: deals=[] → seção Deals do dia AUSENTE do HTML (não vazia, ausente)', () => {
  const html = renderEmail(diaFraco);
  assert.ok(!html.includes(DEAL_DESK_MARKER), 'HTML não deveria conter o marcador de Deals do dia quando deals=[]');
});

test('dia-fraco: signal presente e explica a ausência com números reais', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('Sinal do dia'));
  assert.match(diaFraco.signal, /\d/);
  assert.ok(html.includes('375% de bônus na compra de pontos Smiles'));
});

test('dia-fraco: Ofertas ativas sustenta o dia fraco — Smiles → Smiles, CPM e leitura', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('Ofertas ativas'));
  assert.ok(html.includes('Smiles → Smiles'), 'compra exibe o próprio programa (regra do operador)');
  assert.ok(html.includes('SÓ PARA CASOS ESPECÍFICOS'));
  assert.ok(html.includes('R$ 16,84'));
  assert.ok(html.includes('Compra de pontos (Clube)'));
  assert.ok(!/sem[_ ]destino/i.test(html));
});

test('dia-fraco: sem contaFeita e sem deals → bloco "Conta feita" não aparece (nada para elevar)', () => {
  const html = renderEmail(diaFraco);
  assert.ok(!html.includes('Conta feita'));
});

test('dia-fraco: Fecha Logo lista os 3 itens VENCE HOJE com fonte linkada', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('Vence em até 72h'));
  assert.equal((html.match(/VENCE HOJE/g) || []).length, 3);
  assert.ok(html.includes('Banco do Nordeste → Azul Fidelidade'));
});

test('dia-fraco: radar sem confirmação dentro do Sinal do dia com os 4 itens e vencimentos', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('No radar, ainda sem confirmação oficial:'));
  assert.ok(html.includes('até 110% de bônus'));
  assert.ok(html.includes('Flying Blue: até 45% OFF'));
  assert.ok(html.includes('vence 28/07'));
  assert.ok(html.includes('a melhor nota do dia — nicho hotelaria'));
});

test('dia-fraco: narrativa do Predict aparece mesmo com probabilidade em formação (D-059 §3), sem seção formal', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('em formação'));
  assert.ok(html.includes('sem promoção de transferência à vista'));
  assert.ok(!html.includes('>Predict<'), 'sem janela alta-confiança não há seção formal Predict');
});

test('dia-fraco: Cartões e bancos por item — 5 itens, status honesto, fonte linkada', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('Cartões e bancos'));
  assert.ok(html.includes(EXPLICA_SEM_NOTA.slice(0, 40)));
  assert.ok(html.includes('Itaú · cartão LATAM Pass'));
  assert.ok(html.includes('fora da régua TL'));
  assert.ok(html.includes('Sorteio não tem conta a fazer — sem nota'));
});

test('dia-fraco: Clipping ordenado por relevância — compra/acúmulo antes de hotel, sem rótulo de tier', () => {
  const html = renderEmail(diaFraco);
  const inter = html.indexOf('Inter oferece 54% de desconto');
  const hotel = html.indexOf('Hotéis em Belo Horizonte');
  assert.ok(inter >= 0 && hotel > inter, 'item acionável vem antes do item de experiência');
  assert.ok(!/TIER \d/.test(html), 'rótulo de tier não vaza para o leitor');
});

test('dia-fraco: O que fechou nesta semana com nomes legíveis (recap TIER 1 por baixo)', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('O que fechou nesta semana'));
  assert.ok(html.includes('Amex Membership Rewards → Hilton Honors'));
  assert.ok(html.includes('15/07'));
});

test('dia-fraco: color-scheme travado light no head (mesma garantia dos dois casos)', () => {
  const html = renderEmail(diaFraco);
  assert.ok(html.includes('<meta name="color-scheme" content="light" />'));
});

test('ambos: zero emoji e zero jargão interno no HTML gerado (D-059)', () => {
  const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const ed of [diaForte, diaFraco]) {
    const html = renderEmail(ed);
    assert.equal(EMOJI_RE.test(html), false);
    assert.deepEqual(lintJargao(html), [], 'nenhum termo interno pode vazar no HTML');
  }
});
