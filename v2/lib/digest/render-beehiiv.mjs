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
// Cores: tokens do CLAUDE.md (fill hex, não classe Tailwind — este não é
// componente React). Números em mono via textStyle fontFamily monospace
// (fallback do lado do Beehiiv/cliente de e-mail; sem garantia de
// JetBrains Mono carregar, mesmo problema estrutural do e-mail cru).
const INK = '#111111', PAPER = '#FAF7F0', PAPER_DARK = '#F1ECE1', SURFACE = '#FFFFFF';
const LINE = '#E5E0D5', GRAY700 = '#3D3A34', GRAY500 = '#555555', GRAY400 = '#8A8578';
const GREEN600 = '#00A878', GREEN100 = '#D9F4E9', YELLOW100 = '#FCF0CE';
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

/** Deal Desk — array de deals já elegíveis (o gate 5.5 confirma isso antes; este módulo só renderiza). */
function renderDeal(d) {
  const inner = [
    eyebrow(d.category || ''),
    heading(d.title || '', 3),
    p(d.context || '', { color: GRAY500 }),
    contaBlock(d.conta || {}),
    verdictChip(d.verdict),
    d.verdictNote ? p(d.verdictNote, { color: GRAY700, size: '0.85rem' }) : '',
    p(d.source || '', { color: GRAY400, size: '0.8rem' }),
  ].join('');
  return section(inner, { 'background-color': SURFACE, 'border-color': LINE, 'border-style': 'solid', 'border-width-top': 1, 'border-width-right': 1, 'border-width-bottom': 1, 'border-width-left': 1, 'padding-top': 16, 'padding-right': 18, 'padding-bottom': 16, 'padding-left': 18, 'margin-bottom': 12 });
}

/** Renderiza a edição inteira no dialeto Tiptap. Regra-mãe: seção sem dado real = omitida. */
export function renderBeehiivHtml(ed) {
  const parts = [];

  parts.push(heading('The Loyal — Daily', 1));
  const metaBits = [ed.number ? `Nº ${ed.number}` : null, ed.date, ed.readingMinutes ? `${ed.readingMinutes} min` : null].filter(Boolean);
  if (metaBits.length) parts.push(p(metaBits.join(' · '), { color: GRAY400, mono: true, size: '0.8rem' }));

  // Sinal do Dia — sempre presente (obrigatório no schema).
  parts.push(section([eyebrow('Sinal do dia'), heading(ed.signal || '', 2)].join(''),
    { 'background-color': PAPER_DARK, 'padding-top': 20, 'padding-right': 20, 'padding-bottom': 20, 'padding-left': 20, 'margin-bottom': 16 }));

  // Resumo do dia — prosa, distinto do Sinal (D-053). Omitido se ausente.
  if (ed.resumoDoDia) {
    parts.push(eyebrow('Resumo do dia', GRAY400));
    parts.push(p(ed.resumoDoDia, { color: GRAY700 }));
  }

  // Clipping — piso 5, nunca parcial (a seleção já garantiu isso a montante; aqui só renderiza).
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

  // Deal Desk — REGRA-MÃE: deals.length === 0 → seção OMITIDA por completo, nunca vazia.
  if (Array.isArray(ed.deals) && ed.deals.length > 0) {
    parts.push(eyebrow('Deal Desk'));
    for (const d of ed.deals) parts.push(renderDeal(d));
  }

  // Conta Feita — fallback: conta do primeiro deal quando ausente (D-052/S1-D1).
  const contaFeitaSrc = ed.contaFeita || (ed.deals?.[0]?.conta ?? null);
  if (contaFeitaSrc) {
    parts.push(section([eyebrow('Conta feita', PAPER), contaBlock(contaFeitaSrc, { onDark: true })].join(''),
      { 'background-color': INK, color: PAPER, 'padding-top': 18, 'padding-right': 18, 'padding-bottom': 18, 'padding-left': 18, 'margin-bottom': 16 }));
  }

  // Fecha Logo
  if (Array.isArray(ed.fechaLogo) && ed.fechaLogo.length > 0) {
    for (const f of ed.fechaLogo) {
      parts.push(section([
        `<p><span style="color: #7A5B00; font-family: ${MONO}; font-size: 0.75rem; font-weight: 700">${esc((f.tag || '').toUpperCase())}</span></p>`,
        p(f.text || '', { color: INK }),
        f.cpm ? p(f.cpm, { color: GRAY700, mono: true }) : '',
      ].join(''), { 'background-color': YELLOW100, 'border-color': '#F2C94C', 'border-style': 'solid', 'border-width-left': 4, 'padding-top': 12, 'padding-right': 14, 'padding-bottom': 12, 'padding-left': 14, 'margin-bottom': 12 }));
    }
  }

  // Radar (predicoes[] / radar.windows[]) — só janelas com dado real (seleção a montante já filtrou).
  if (ed.radar?.windows?.length) {
    parts.push(eyebrow('Radar de janelas'));
    for (const w of ed.radar.windows) {
      parts.push(columns([
        { html: p(w.label || '', { color: GRAY700 }) },
        { html: p(w.window || '', { color: INK, mono: true }) },
      ]));
    }
  }

  // Radar VPM (shoppingWatch[])
  if (Array.isArray(ed.shoppingWatch) && ed.shoppingWatch.length > 0) {
    parts.push(eyebrow('Radar VPM'));
    for (const s of ed.shoppingWatch) {
      parts.push(columns([
        { html: p(`${s.player || ''} · ${s.category || ''}`, { color: GRAY700 }) },
        { html: p(s.vpmObservado || 'n/c', { color: INK, mono: true }) },
      ]));
    }
  }

  // Sinais rápidos — NUNCA carrega chip de veredito Deal Desk (transparência, não teaser).
  if (Array.isArray(ed.sinaisRapidos) && ed.sinaisRapidos.length > 0) {
    parts.push(eyebrow('Sinais rápidos', GRAY400));
    for (const s of ed.sinaisRapidos) {
      parts.push(p(`${s.origem || ''} → ${s.destino || ''} (${s.tipo || ''}) — ${s.motivoNaoQualifica || ''}`, { color: GRAY500, size: '0.85rem' }));
    }
  }

  // Loyalty Lab — único bloco narrativo/gerativo.
  if (ed.loyaltyLab?.texto) {
    parts.push(eyebrow('Loyalty Lab'));
    parts.push(heading(ed.loyaltyLab.titulo || '', 3));
    parts.push(p(ed.loyaltyLab.texto, { color: GRAY500 }));
  }

  // O que evitar
  if (ed.oQueEvitar) {
    parts.push(eyebrow('O que evitaria', RED600));
    parts.push(p(ed.oQueEvitar, { color: GRAY700 }));
  }

  // Disclaimer — sempre presente (const no schema).
  parts.push(p(ed.disclaimer || '', { color: GRAY400, size: '0.75rem' }));

  // Rodapé — merge tags confirmadas via learn_post_authoring.
  parts.push(section([
    `<p><a class="link" href="{{live_url}}">Ler no navegador</a> · <a class="link" href="{{subscriber_preferences_url}}">Preferências</a> · <a class="link" href="{{unsubscribe_url}}">Cancelar inscrição</a></p>`,
  ].join(''), { 'padding-top': 16, 'padding-bottom': 16 }));

  return parts.join('\n');
}
