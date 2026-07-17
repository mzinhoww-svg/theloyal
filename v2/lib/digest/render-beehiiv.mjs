// render-beehiiv.mjs — renderiza a edição Daily no DIALETO TIPTAP que o
// Beehiiv `save_post`/`edit_post_content` aceita (S2-D1, achado da
// SPEC-SLICE-VERIFICACAO-BEEHIIV-MCP.md).
//
// ACHADO QUE MOTIVA ESTE ARQUIVO: `save_post` NÃO aceita HTML cru. O
// `html_content` é parseado no schema Tiptap do editor — `style="..."` inline
// é DESCARTADO no parse, exceto na mark `textStyle` (span específico). Layout
// de card usa o nó `section` (atributos `data-*`, nunca `style=`); tabelas
// usam tokens de TEMA para borda (não CSS por célula) — por isso "Conta
// Feita"/linhas de card aqui usam `columns` (label+valor lado a lado), não
// `<table>`. O renderer/email.mjs (HTML cru) continua sendo o alvo certo
// para preview/web-embed/QA — este arquivo é o SEGUNDO alvo, só para o
// envio real via MCP. Mesma fonte de dado (edition JSON), dois renders.
//
// REGRA MÃE (D-053 §2.1, aplicada aqui também): sem Deal Desk, a seção
// inteira é omitida do documento — nunca um `section` vazio.
//
// v3 (D-057, SPEC-SLICE-DIGEST-ENGINE.md v3): ordem final — Sinal do dia
// (Resumo fundido) → Ofertas ativas → Deals do dia → Vence em até 72h →
// Cartões & bancos → Clipping → O que fechou nesta semana → Radar VPM →
// Loyalty Lab → Predict. `resumoDoDia` deixa de ser seção própria; `radar`
// (janelas) migrou para dentro do teaser Predict; `sinaisRapidos` fica
// obsoleto como bloco de render (absorvido por `ofertasAtivas`).
//
// Cores: tokens do CLAUDE.md (fill hex, não classe Tailwind — este não é
// componente React). Números em mono via textStyle fontFamily monospace
// (fallback do lado do Beehiiv/cliente de e-mail; sem garantia de
// JetBrains Mono carregar, mesmo problema estrutural do e-mail cru).
import { formatarTeaserPredict } from './dia-fraco.mjs';

const INK = '#111111', PAPER = '#FAF7F0', PAPER_DARK = '#F1ECE1', SURFACE = '#FFFFFF';
const LINE = '#E5E0D5', GRAY700 = '#3D3A34', GRAY500 = '#555555', GRAY400 = '#8A8578';
const GREEN600 = '#00A878', GREEN100 = '#D9F4E9';
const RED600 = '#D64545', BLUE600 = '#315CFF';
const MONO = 'JetBrains Mono, ui-monospace, monospace';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const VERDICT_LABEL = {
  'vale-agir': 'Vale agir', 'vale-olhar': 'Vale olhar', 'casos-especificos': 'Só para casos específicos',
  esperaria: 'Esperaria', evitaria: 'Evitaria', 'nao-confirmado': 'Não confirmado',
};
const VERDICT_COLOR = {
  'vale-agir': GREEN600, 'vale-olhar': BLUE600, 'casos-especificos': GRAY400,
  esperaria: '#7A5B00', evitaria: RED600, 'nao-confirmado': GRAY400,
};

function p(text, { color = GRAY700, size, weight, mono = false } = {}) {
  const style = [`color: ${color}`, size ? `font-size: ${size}` : null, weight ? `font-weight: ${weight}` : null]
    .filter(Boolean).join('; ');
  const inner = mono
    ? `<span style="${style}; font-family: ${MONO}">${esc(text)}</span>`
    : (style ? `<span style="${style}">${esc(text)}</span>` : esc(text));
  return `<p>${inner}</p>`;
}
function heading(text, level = 2) { return `<h${level}>${esc(text)}</h${level}>`; }
function eyebrow(text, color = GREEN600) {
  return `<p><span style="color: ${color}; font-family: ${MONO}; font-size: 0.75rem">${esc(text.toUpperCase())}</span></p>`;
}
function section(innerHtml, attrs = {}) {
  const a = Object.entries(attrs).map(([k, v]) => `data-${k}="${esc(String(v))}"`).join(' ');
  return `<div class="node-section" ${a}>${innerHtml}</div>`;
}
function columns(pairs) {
  const cols = pairs.map((c, i) => `<div data-type="column" data-position="${i}" data-width="${c.width || `${Math.round(100 / pairs.length)}%`}">${c.html}</div>`).join('');
  return `<div data-type="columns" data-stack-on-mobile="false">${cols}</div>`;
}
function verdictChip(verdict) {
  const label = VERDICT_LABEL[verdict] || verdict;
  const color = VERDICT_COLOR[verdict] || GRAY400;
  return `<p><span style="color: ${color}; font-family: ${MONO}; font-size: 0.75rem; font-weight: 700">${esc(label.toUpperCase())}</span></p>`;
}

// Formata rota "origem->destino" (ou só origem para lado único).
function rotaLabel(origem, destino) {
  return destino ? `${origem} → ${destino}` : String(origem || '');
}
function percentualLabel(percentual) {
  return percentual !== null && percentual !== undefined ? `${percentual}%` : '—';
}
function dataLabel(iso) {
  return iso ? String(iso).slice(0, 10) : 'sem data';
}

/** Conta (rows + result) como columns lado a lado — nunca <table> (sem borda por célula). */
function contaBlock(conta, { onDark = false } = {}) {
  const textColor = onDark ? PAPER : GRAY700;
  const keyColor = onDark ? GRAY400 : GRAY400;
  const rows = (conta.rows || []).map(([k, v]) => columns([
    { html: p(k, { color: keyColor, mono: true, size: '0.85rem' }), width: '55%' },
    { html: p(v, { color: textColor, mono: true, size: '0.85rem' }), width: '45%' },
  ])).join('');
  const result = conta.result
    ? columns([
      { html: p(conta.result[0], { color: onDark ? PAPER : INK, mono: true, weight: '700' }), width: '55%' },
      { html: p(conta.result[1], { color: GREEN600, mono: true, weight: '700' }), width: '45%' },
    ])
    : '';
  return rows + result;
}

/** Ofertas ativas (§1.1, D-057): uma linha por item, columns — nunca <table>. */
function ofertaAtivaRow(o) {
  return columns([
    { html: p(rotaLabel(o.origem, o.destino), { color: GRAY700, weight: '700' }), width: '28%' },
    { html: p(String(o.tipo || '').replace(/_/g, ' '), { color: GRAY500, size: '0.8rem' }), width: '22%' },
    { html: p(percentualLabel(o.percentual), { color: INK, mono: true }), width: '16%' },
    { html: p(dataLabel(o.prazo), { color: GRAY500, mono: true, size: '0.8rem' }), width: '18%' },
    { html: verdictChip(o.leitura), width: '16%' },
  ]);
}

/** Deals do dia (§1.2, D-057 — antes "Deal Desk") — array de deals já elegíveis
 * (o gate 5.5 confirma isso antes; este módulo só renderiza), numerado,
 * `contaProsa`/`leitura` aditivos com fallback (leitura → verdictNote). */
function renderDeal(d, index) {
  const numero = typeof index === 'number' ? `${index + 1}. ` : '';
  const leituraTexto = d.leitura || d.verdictNote || '';
  const inner = [
    eyebrow(d.category || ''),
    heading(`${numero}${d.title || ''}`, 3),
    p(d.context || '', { color: GRAY500 }),
    contaBlock(d.conta || {}),
    d.contaProsa ? eyebrow('A conta', GRAY400) : '',
    d.contaProsa ? p(d.contaProsa, { color: GRAY700, size: '0.85rem' }) : '',
    verdictChip(d.verdict),
    d.verdictNote ? p(d.verdictNote, { color: GRAY700, size: '0.85rem' }) : '',
    leituraTexto ? eyebrow('Leitura', GRAY400) : '',
    leituraTexto ? p(leituraTexto, { color: GRAY700, size: '0.85rem' }) : '',
    p(d.source || '', { color: GRAY400, size: '0.8rem' }),
  ].join('');
  return section(inner, { 'background-color': SURFACE, 'border-color': LINE, 'border-style': 'solid', 'border-width-top': 1, 'border-width-right': 1, 'border-width-bottom': 1, 'border-width-left': 1, 'padding-top': 16, 'padding-right': 18, 'padding-bottom': 16, 'padding-left': 18, 'margin-bottom': 12 });
}

/** Vence em até 72h (§1.3, D-057 — renomeação de Fecha Logo, MESMO dado
 * fechaLogo[]): lista simples (divisor fino), não mais card com fill amarelo. */
function vence72hItem(f) {
  const inner = [
    `<p><span style="color: #7A5B00; font-family: ${MONO}; font-size: 0.75rem; font-weight: 700">${esc((f.tag || '').toUpperCase())}</span></p>`,
    p(f.text || '', { color: INK }),
    f.cpm ? p(f.cpm, { color: GRAY700, mono: true, size: '0.85rem' }) : '',
    f.note ? p(f.note, { color: GRAY400, size: '0.8rem' }) : '',
  ].join('');
  return section(inner, { 'border-color': LINE, 'border-style': 'solid', 'border-width-bottom': 1, 'padding-top': 8, 'padding-bottom': 8 });
}

/** O que fechou nesta semana (§1.6, D-057): bullet, sem cálculo novo. */
function fechouSemanaRow(f) {
  const rota = rotaLabel(f.origem, f.destino);
  const tipoLabel = String(f.tipo || '').replace(/_/g, ' ');
  const pct = percentualLabel(f.percentual);
  const texto = `${rota} — ${tipoLabel}${pct !== '—' ? ` (${pct})` : ''}, encerrou em ${dataLabel(f.encerrouEm)}`;
  return p(texto, { color: GRAY500, size: '0.85rem' });
}

/** Renderiza a edição inteira no dialeto Tiptap. Regra-mãe: seção sem dado real = omitida. */
export function renderBeehiivHtml(ed) {
  const parts = [];

  parts.push(heading('The Loyal — Daily', 1));
  const metaBits = [ed.number ? `Nº ${ed.number}` : null, ed.date, ed.readingMinutes ? `${ed.readingMinutes} min` : null].filter(Boolean);
  if (metaBits.length) parts.push(p(metaBits.join(' · '), { color: GRAY400, mono: true, size: '0.8rem' }));

  // 1. Sinal do Dia — sempre presente (obrigatório no schema). v3 (D-057
  // decisão 5): resumoDoDia funde aqui como 2º parágrafo, não é mais seção própria.
  const sinalInner = [eyebrow('Sinal do dia'), heading(ed.signal || '', 2)];
  if (ed.resumoDoDia) sinalInner.push(p(ed.resumoDoDia, { color: GRAY700 }));
  parts.push(section(sinalInner.join(''),
    { 'background-color': PAPER_DARK, 'padding-top': 20, 'padding-right': 20, 'padding-bottom': 20, 'padding-left': 20, 'margin-bottom': 16 }));

  // 2. Ofertas ativas (§1.1) — TODO item vivo com conta computável.
  if (Array.isArray(ed.ofertasAtivas) && ed.ofertasAtivas.length > 0) {
    parts.push(eyebrow('Ofertas ativas'));
    for (const o of ed.ofertasAtivas) parts.push(ofertaAtivaRow(o));
  }

  // 3. Deals do dia — REGRA-MÃE: deals.length === 0 → seção OMITIDA por completo, nunca vazia.
  if (Array.isArray(ed.deals) && ed.deals.length > 0) {
    parts.push(eyebrow('Deals do dia'));
    ed.deals.forEach((d, i) => parts.push(renderDeal(d, i)));
  }

  // Conta Feita — fallback: conta do primeiro deal quando ausente (D-052/S1-D1).
  const contaFeitaSrc = ed.contaFeita || (ed.deals?.[0]?.conta ?? null);
  if (contaFeitaSrc) {
    parts.push(section([eyebrow('Conta feita', PAPER), contaBlock(contaFeitaSrc, { onDark: true })].join(''),
      { 'background-color': INK, color: PAPER, 'padding-top': 18, 'padding-right': 18, 'padding-bottom': 18, 'padding-left': 18, 'margin-bottom': 16 }));
  }

  // 4. Vence em até 72h (renomeação de Fecha Logo, mesmo dado).
  if (Array.isArray(ed.fechaLogo) && ed.fechaLogo.length > 0) {
    parts.push(eyebrow('Vence em até 72h'));
    for (const f of ed.fechaLogo) parts.push(vence72hItem(f));
  }

  // O que evitar
  if (ed.oQueEvitar) {
    parts.push(eyebrow('O que evitaria', RED600));
    parts.push(p(ed.oQueEvitar, { color: GRAY700 }));
  }

  // 5. Cartões & bancos (§1.4) — prosa evergreen.
  if (ed.cartoesBancos) {
    parts.push(eyebrow('Cartões & bancos'));
    parts.push(p(ed.cartoesBancos, { color: GRAY700 }));
  }

  // 6. Clipping — piso 5, nunca parcial (a seleção já garantiu isso a montante; aqui só renderiza).
  if (Array.isArray(ed.clipping) && ed.clipping.length >= 5) {
    parts.push(eyebrow('Clipping'));
    for (const item of ed.clipping) {
      parts.push(section([
        `<p><a class="link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(item.title)}</a></p>`,
        p(item.summary || '', { color: GRAY500, size: '0.9rem' }),
        p(`${item.source || ''}${item.tier ? ` · TIER ${item.tier}` : ''}`, { color: GRAY400, size: '0.75rem', mono: true }),
      ].join(''), { 'padding-top': 8, 'padding-bottom': 8, 'border-color': LINE, 'border-style': 'solid', 'border-width-bottom': 1 }));
    }
  }

  // 7. O que fechou nesta semana (§1.6) — recap TIER 1, sem cálculo novo.
  if (Array.isArray(ed.oQueFechouSemana) && ed.oQueFechouSemana.length > 0) {
    parts.push(eyebrow('O que fechou nesta semana'));
    for (const f of ed.oQueFechouSemana) parts.push(fechouSemanaRow(f));
  }

  // 8. Radar VPM (shoppingWatch[]) — lógica/seletor inalterados, só posição
  // (D-057 decisão 7: bloco próprio).
  if (Array.isArray(ed.shoppingWatch) && ed.shoppingWatch.length > 0) {
    parts.push(eyebrow('Radar VPM'));
    for (const s of ed.shoppingWatch) {
      parts.push(columns([
        { html: p(`${s.player || ''} · ${s.category || ''}`, { color: GRAY700 }) },
        { html: p(s.vpmObservado || 'n/c', { color: INK, mono: true }) },
      ]));
    }
  }

  // 9. Loyalty Lab — único bloco narrativo/gerativo, lógica inalterada,
  // só posição (D-057 decisão 8: bloco próprio, corte 0,85 inalterado).
  if (ed.loyaltyLab?.texto) {
    parts.push(eyebrow('Loyalty Lab'));
    parts.push(heading(ed.loyaltyLab.titulo || '', 3));
    parts.push(p(ed.loyaltyLab.texto, { color: GRAY500 }));
  }

  // 10. Predict (§1.7) — teaser, só contagem, nunca valor/janela. `radar`
  // (janelas) migrou para dentro daqui (D-057 decisão 6) — não há mais bloco
  // "Radar de janelas" próprio.
  if (ed.predict && typeof ed.predict.ativos === 'number' && ed.predict.ativos > 0) {
    parts.push(eyebrow('Predict'));
    parts.push(p(formatarTeaserPredict(ed.predict.ativos), { color: GRAY500 }));
  }

  // Disclaimer — sempre presente (const no schema).
  parts.push(p(ed.disclaimer || '', { color: GRAY400, size: '0.75rem' }));

  // Rodapé — merge tags confirmadas via learn_post_authoring.
  parts.push(section([
    `<p><a class="link" href="{{live_url}}">Ler no navegador</a> · <a class="link" href="{{subscriber_preferences_url}}">Preferências</a> · <a class="link" href="{{unsubscribe_url}}">Cancelar inscrição</a></p>`,
  ].join(''), { 'padding-top': 16, 'padding-bottom': 16 }));

  return parts.join('\n');
}
