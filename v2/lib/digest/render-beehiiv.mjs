// render-beehiiv.mjs — renderiza a edição Daily no DIALETO TIPTAP que o
// Beehiiv `save_post`/`edit_post_content` aceita (S2-D1, achado da
// SPEC-SLICE-VERIFICACAO-BEEHIIV-MCP.md).
//
// ACHADO QUE MOTIVA ESTE ARQUIVO: `save_post` NÃO aceita HTML cru. O
// `html_content` é parseado no schema Tiptap do editor — `style="..."` inline
// é DESCARTADO no parse, exceto na mark `textStyle` (span específico). Layout
// de card usa o nó `section` (atributos `data-*`, nunca `style=`); NUNCA
// `<table>` (tokens de tema, não CSS por célula) — linhas lado a lado usam
// `columns`. Imagens entram como `<img>` puro. O renderer/email.mjs (HTML cru)
// continua sendo o alvo do preview/QA — este é o SEGUNDO alvo, para o envio
// real via MCP. Mesma fonte de dado (edition JSON), dois renders.
//
// v4 (D-059, formato aprovado pelo operador nas rodadas editoriais): layout
// com imagens de template (header/divisores/footer), Sinal do dia como caixa
// com item confirmado + radar sem confirmação + narrativa do Predict, Ofertas
// ativas em columns com rota legível/CPM, Fecha Logo como caixa amarela,
// Cartões e bancos por item com fonte linkada, Clipping ordenado por
// relevância, O que fechou com nomes legíveis. Regra-mãe intacta: seção sem
// dado real é OMITIDA por inteiro, nunca vazia. Radar VPM / Loyalty Lab /
// Predict formal mantêm a lógica D-057.
//
// Cores: tokens do CLAUDE.md (fill hex, não classe Tailwind — este não é
// componente React). Números em mono via textStyle fontFamily monospace.
import { formatarTeaserPredict } from './dia-fraco.mjs';
import {
  rotaDisplay, tipoLabel, nomePrograma, ordenarClippingPorRelevancia,
  EXPLICA_SEM_NOTA, formatarDataBr, formatarDiaMes,
} from './editorial.mjs';

const INK = '#111111', PAPER = '#FAF7F0', PAPER_DARK = '#F1ECE1', SURFACE = '#FFFFFF';
const LINE = '#E5E0D5', GRAY700 = '#3D3A34', GRAY500 = '#555555', GRAY400 = '#8A8578';
const GREEN600 = '#00A878';
const RED600 = '#D64545', BLUE600 = '#315CFF';
const YELLOW100 = '#FCF0CE', YELLOW500 = '#F2C94C';
const MONO = 'JetBrains Mono, ui-monospace, monospace';

// Imagens do template aprovadas no rascunho v4 (assets já hospedados no
// Beehiiv). A seção "Cartões e bancos" NÃO tem arte própria de propósito —
// a arte existente é em inglês ("Bank & Cards Watch"); título em texto até
// existir arte em português (decisão da rodada editorial).
const IMG_BASE = 'https://media.beehiiv.com/cdn-cgi/image/fit=scale-down,format=auto,onerror=redirect,quality=80/uploads/asset/file';
export const IMG_HEADER = `${IMG_BASE}/429fd6ef-2caa-4ff2-acb9-ce7b89e73adb/tl-header-1200x300.png`;
export const IMG_SECAO_SINAL = `${IMG_BASE}/d68358a8-4508-4329-bad3-a9c55abe41cd/tl-secao-sinal-do-dia-1200x64.png`;
export const IMG_SECAO_FECHA = `${IMG_BASE}/751b8087-4bed-4736-93cd-6714dcfc2fb3/tl-secao-fecha-logo-1200x64.png`;
export const IMG_DIVISOR_LINHA = `${IMG_BASE}/1e52deee-d18d-465e-8605-146f920d9288/tl-divisor-linha-1200x24.png`;
export const IMG_FOOTER = `${IMG_BASE}/673c48e0-e5bf-43ee-9218-91ae5566bc41/tl-footer-1200x170.png`;

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const VERDICT_LABEL = {
  'vale-agir': 'Vale agir', 'vale-olhar': 'Vale olhar', 'casos-especificos': 'Só para casos específicos',
  esperaria: 'Esperaria', evitaria: 'Evitaria', 'nao-confirmado': 'Não confirmado',
};
// Cores de veredito: yellow-500 nunca como texto (regra 7) — Esperaria usa o
// tom escuro de leitura sobre fill claro já sancionado no e-mail (#7A5B00).
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
// Parágrafo com HTML interno já montado (links/strong) — quem chama escapa.
function pRaw(innerHtml) { return `<p>${innerHtml}</p>`; }
function heading(text, level = 2) { return `<h${level}>${esc(text)}</h${level}>`; }
function img(src, alt = '') { return `<img src="${esc(src)}" alt="${esc(alt)}">`; }
function link(url, innerHtml) {
  return `<a class="link" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${innerHtml}</a>`;
}
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
function mono(text, { color = INK, size = '0.85rem', weight } = {}) {
  const w = weight ? `; font-weight: ${weight}` : '';
  return `<span style="color: ${color}; font-family: ${MONO}; font-size: ${size}${w}">${esc(text)}</span>`;
}

// Números (R$, %, datas dd/mm, contagens) em negrito no parágrafo do item
// confirmado — o operador aprovou o resumo com os números saltando à vista.
function boldNumbers(text) {
  return esc(text).replace(/(R\$\s?)?\d+(?:[.,/]\d+)*%?/g, (m) => `<strong>${m}</strong>`);
}

function percentualLabel(percentual) {
  return percentual !== null && percentual !== undefined ? `${percentual}%` : '—';
}

/** Conta (rows + result) como columns lado a lado — nunca <table>. */
function contaBlock(conta, { onDark = false } = {}) {
  const textColor = onDark ? PAPER : GRAY700;
  const rows = (conta.rows || []).map(([k, v]) => columns([
    { html: p(k, { color: GRAY400, mono: true, size: '0.85rem' }), width: '55%' },
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

/** Ofertas ativas (v4): rota legível + sublinha, %, CPM, leitura — columns, nunca <table>. */
function ofertaAtivaRow(o) {
  const sub = [
    `${tipoLabel(o.tipo)}${o.publico ? ` (${o.publico})` : ''}`,
    o.nota !== null && o.nota !== undefined ? `TL ${o.nota}` : null,
    o.prazo ? `vence ${formatarDiaMes(o.prazo)}` : null,
  ].filter(Boolean).join(' · ');
  const col0 = pRaw(`<strong>${esc(rotaDisplay(o))}</strong>`) + p(sub, { color: GRAY500, size: '0.75rem' });
  const col2 = o.cpm
    ? pRaw(`${mono(o.cpm)} <span style="color: ${GRAY400}; font-size: 0.7rem">por milheiro</span>`)
    : p('—', { color: GRAY400, mono: true, size: '0.85rem' });
  return columns([
    { html: col0, width: '34%' },
    { html: pRaw(mono(percentualLabel(o.percentual))), width: '14%' },
    { html: col2, width: '22%' },
    { html: verdictChip(o.leitura), width: '30%' },
  ]);
}

/** Deals do dia (D-057) — inalterado na v4: numerado, contaProsa/leitura aditivos. */
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

/** Item do radar sem confirmação, dentro da caixa do Sinal do dia. */
function radarSemConfirmacaoItem(r) {
  const partes = [
    `${link(r.url, `<strong>${esc(r.titulo)}</strong>`)} — ${esc(r.detalhe)}`,
    r.nota !== null && r.nota !== undefined ? mono(`TL ${r.nota}`, { color: GRAY700, size: '0.8rem' }) : null,
    r.vence ? `<span style="color: ${GRAY500}; font-size: 0.85rem">vence ${esc(formatarDiaMes(r.vence))}</span>` : null,
    `<span style="color: ${GRAY400}; font-size: 0.8rem">(${esc(r.fonte)})</span>`,
  ].filter(Boolean);
  return pRaw(partes.join(' · '));
}

/** Fecha Logo (v4): item da caixa amarela — lead em negrito + corpo + fonte. */
function fechaLogoItem(f) {
  const partes = [
    `<strong>${esc(f.tag || '')}</strong> — ${esc(f.text || '')}`,
    f.cpm ? mono(f.cpm, { color: GRAY700, size: '0.8rem' }) : null,
    f.url ? `<span style="color: ${GRAY500}; font-size: 0.85rem">(${link(f.url, 'fonte')})</span>` : null,
  ].filter(Boolean);
  return pRaw(partes.join(' '));
}

/** Renderiza a edição inteira no dialeto Tiptap (layout v4 aprovado). */
export function renderBeehiivHtml(ed) {
  const parts = [];

  // 1. Header de marca (imagem) + linha meta.
  parts.push(img(IMG_HEADER, 'The Loyal — Daily'));
  const metaBits = [
    ed.number ? `Nº ${ed.number}` : null,
    ed.weekday || null,
    ed.date ? formatarDataBr(ed.date) : null,
    ed.readingMinutes ? `leitura de ${ed.readingMinutes} min` : null,
  ].filter(Boolean);
  if (metaBits.length) parts.push(p(metaBits.join(' · '), { color: GRAY400, mono: true, size: '0.8rem' }));

  // 2. Sinal do dia — divisor de seção (imagem) + caixa: manchete, item
  // confirmado (números em negrito + fonte oficial), radar sem confirmação e
  // narrativa do Predict. Sempre presente (signal é obrigatório no schema);
  // os sub-blocos internos seguem a regra-mãe (sem dado = ausentes).
  parts.push(img(IMG_SECAO_SINAL, 'Sinal do dia'));
  const sinalInner = [heading(ed.signal || '', 3)];
  if (ed.resumoDoDia) {
    const fonteOficial = Array.isArray(ed.sources) && ed.sources[0]
      ? ` (${link(ed.sources[0].url, 'fonte oficial')})`
      : '';
    sinalInner.push(pRaw(`<span style="color: ${GRAY700}">${boldNumbers(ed.resumoDoDia)}</span>${fonteOficial}`));
  }
  const radar = Array.isArray(ed.radarSemConfirmacao) ? ed.radarSemConfirmacao : [];
  if (radar.length > 0) {
    sinalInner.push(pRaw(`<strong>No radar, ainda sem confirmação oficial:</strong>`));
    for (const r of radar) sinalInner.push(radarSemConfirmacaoItem(r));
  }
  if (ed.predictNarrativa?.texto) sinalInner.push(p(ed.predictNarrativa.texto, { color: GRAY700 }));
  parts.push(section(sinalInner.join(''),
    { 'background-color': PAPER_DARK, 'padding-top': 20, 'padding-right': 20, 'padding-bottom': 20, 'padding-left': 20, 'margin-bottom': 16 }));

  // 3. Ofertas ativas — TODO item vivo com conta feita, sem corte de veredito.
  if (Array.isArray(ed.ofertasAtivas) && ed.ofertasAtivas.length > 0) {
    parts.push(heading('Ofertas ativas', 2));
    parts.push(p('O que está valendo hoje, com a conta feita e a leitura TL:', { color: GRAY500 }));
    for (const o of ed.ofertasAtivas) parts.push(ofertaAtivaRow(o));
  }

  // 4. Deals do dia — REGRA-MÃE: deals.length === 0 → seção OMITIDA por completo.
  if (Array.isArray(ed.deals) && ed.deals.length > 0) {
    parts.push(heading('Deals do dia', 2));
    ed.deals.forEach((d, i) => parts.push(renderDeal(d, i)));
  }

  // Conta Feita — fallback: conta do primeiro deal quando ausente (D-052/S1-D1).
  const contaFeitaSrc = ed.contaFeita || (ed.deals?.[0]?.conta ?? null);
  if (contaFeitaSrc) {
    parts.push(section([eyebrow('Conta feita', PAPER), contaBlock(contaFeitaSrc, { onDark: true })].join(''),
      { 'background-color': INK, color: PAPER, 'padding-top': 18, 'padding-right': 18, 'padding-bottom': 18, 'padding-left': 18, 'margin-bottom': 16 }));
  }

  // 5. Fecha Logo — divisor (imagem) + caixa amarela (fill yellow-100, borda
  // yellow-500 — amarelo só como fill, texto Ink; regra 7).
  if (Array.isArray(ed.fechaLogo) && ed.fechaLogo.length > 0) {
    parts.push(img(IMG_SECAO_FECHA, 'Fecha logo'));
    parts.push(section(ed.fechaLogo.map(fechaLogoItem).join(''), {
      'background-color': YELLOW100, 'border-color': YELLOW500, 'border-style': 'solid',
      'border-width-left': 4, 'padding-top': 14, 'padding-right': 18, 'padding-bottom': 14, 'padding-left': 18, 'margin-bottom': 16,
    }));
  }

  // O que evitar — opcional, mesmo eixo editorial.
  if (ed.oQueEvitar) {
    parts.push(eyebrow('O que evitaria', RED600));
    parts.push(p(ed.oQueEvitar, { color: GRAY700 }));
  }

  // 6. Cartões e bancos — título em TEXTO (português; a arte "Bank & Cards
  // Watch" em inglês NÃO entra). Intro fixa explica a ausência de nota.
  const cartoesItens = Array.isArray(ed.cartoesBancosItens) ? ed.cartoesBancosItens : [];
  if (cartoesItens.length > 0) {
    parts.push(heading('Cartões e bancos', 2));
    parts.push(p(EXPLICA_SEM_NOTA, { color: GRAY500, size: '0.9rem' }));
    const lis = cartoesItens.map((c) => {
      const status = c.status ? ` ${esc(c.status)}.` : '';
      return `<li><p><strong>${esc(c.nome)}</strong> — ${esc(c.descricao)} (${link(c.url, esc(c.fonte))}).${status}</p></li>`;
    }).join('');
    parts.push(`<ul>${lis}</ul>`);
  } else if (ed.cartoesBancos) {
    // Compatibilidade com edições legadas (campo DEPRECADO).
    parts.push(heading('Cartões e bancos', 2));
    parts.push(p(ed.cartoesBancos, { color: GRAY700 }));
  }

  // 7. Clipping — piso 5 (a seleção garante a montante), ordenado por
  // relevância editorial (determinístico). Sem rótulo de tier — taxonomia
  // interna não vaza para o leitor (D-059).
  if (Array.isArray(ed.clipping) && ed.clipping.length >= 5) {
    parts.push(heading('Clipping', 2));
    const lis = ordenarClippingPorRelevancia(ed.clipping).map((item) =>
      `<li><p>${link(item.url, `<strong>${esc(item.title)}</strong>`)} (${esc(item.source || '')}) — ${esc(item.summary || '')}</p></li>`,
    ).join('');
    parts.push(`<ul>${lis}</ul>`);
  }

  // 8. O que fechou nesta semana — recap com nomes legíveis, sem cálculo novo.
  if (Array.isArray(ed.oQueFechouSemana) && ed.oQueFechouSemana.length > 0) {
    parts.push(heading('O que fechou nesta semana', 2));
    const lis = ed.oQueFechouSemana.map((f) => {
      const pct = f.percentual !== null && f.percentual !== undefined ? ` a ${f.percentual}%` : '';
      return `<li><p><strong>${esc(rotaDisplay(f))}</strong> — ${esc(tipoLabel(f.tipo))}${pct}, encerrou em ${esc(formatarDiaMes(f.encerrouEm))}</p></li>`;
    }).join('');
    parts.push(`<ul>${lis}</ul>`);
  }

  // 9. Radar VPM (shoppingWatch[]) — lógica/seletor inalterados (D-057 decisão 7).
  if (Array.isArray(ed.shoppingWatch) && ed.shoppingWatch.length > 0) {
    parts.push(eyebrow('Radar VPM'));
    for (const s of ed.shoppingWatch) {
      parts.push(columns([
        { html: p(`${s.player || ''} · ${s.category || ''}`, { color: GRAY700 }) },
        { html: p(s.vpmObservado || 'n/c', { color: INK, mono: true }) },
      ]));
    }
  }

  // 10. Loyalty Lab — bloco narrativo, lógica inalterada (D-057 decisão 8).
  if (ed.loyaltyLab?.texto) {
    parts.push(eyebrow('Loyalty Lab'));
    parts.push(heading(ed.loyaltyLab.titulo || '', 3));
    parts.push(p(ed.loyaltyLab.texto, { color: GRAY500 }));
  }

  // 11. Predict formal (§1.7, D-057) — teaser, só contagem, nunca valor/janela.
  if (ed.predict && typeof ed.predict.ativos === 'number' && ed.predict.ativos > 0) {
    parts.push(eyebrow('Predict'));
    parts.push(p(formatarTeaserPredict(ed.predict.ativos), { color: GRAY500 }));
  }

  // 12. Fecho — divisor de linha, disclaimer, footer de marca, merge tags
  // confirmadas via learn_post_authoring.
  parts.push(img(IMG_DIVISOR_LINHA, ''));
  parts.push(p(ed.disclaimer || '', { color: GRAY400, size: '0.75rem' }));
  parts.push(img(IMG_FOOTER, 'The Loyal'));
  parts.push(pRaw(`<a class="link" href="{{live_url}}">Ler no navegador</a> · <a class="link" href="{{subscriber_preferences_url}}">Preferências</a> · <a class="link" href="{{unsubscribe_url}}">Cancelar inscrição</a>`));

  return parts.join('\n');
}

// Reexport de conveniência para quem monta a edição a partir deste módulo.
export { rotaDisplay, tipoLabel, nomePrograma };
