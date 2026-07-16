// Parser de vigência (M2 slice 3). Puro, sem I/O.
// INV-16: nenhuma data afirmada sem evidência de dia+mês+ano. Sem os três → indeterminada.
// Dois eixos SEPARADOS: parsing (esta função) vs confiabilidade de fonte (campanha_fontes TIER 1).
// Este parser NUNCA confirma nada; só lê o que o texto/slug/publicação sustentam.

export const norm = (s) => (s == null ? '' : String(s).toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, ''));

const MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const IN = 'indeterminada';
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const validDM = (d, m) => m >= 1 && m <= 12 && d >= 1 && d <= 31;

// Sinal de que NÃO há data de fim (override de indeterminada).
const SEM_DATA = /(nao (e )?informad|nao ha data|sem data|por tempo indeterminad|enquanto durar)/;
// "a partir de DD/MM" é INÍCIO, não fim — não vira vigência_fim.
const INICIO = /a partir d/;

// "termina hoje" — vigência = dia da publicação.
const HOJE_ANCORA = /(\bhoje\b|ultimo dia|ultimas horas|terminam? hoje|somente hoje|so hoje|apenas hoje|acaba hoje)/;
// slug como proxy de publicação: mmmAA  e  data cheia no slug: N mmm AA (ex.: 9mai25)
const SLUG_YM = /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(\d{2})\b/;
const SLUG_DATA = /\b(\d{1,2})(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(\d{2})\b/;

const ano4 = (aa) => 2000 + Number(aa);

/**
 * @param {{texto:string, slug?:string, publicado_em?:string|null}} inp
 * @returns {{vigencia_fim:string, confiavel:boolean, componentes:{dia:number|null,mes:number|null,ano:number|null},
 *            evidencia:{dia?:string,mes?:string,ano?:string}, motivo:string}}
 */
export function parseVigencia({ texto = '', slug = '', publicado_em = null }) {
  const t = norm(texto);
  const s = norm(slug);

  if (SEM_DATA.test(t)) return indet('sem_data_declarada');

  // 1) data cheia no slug (9mai25) SÓ vale como vigência se o texto amarra ao "hoje"
  //    (senão o NmmmAA do slug é a data de PUBLICAÇÃO, não o fim — evita overprecision).
  const sd = s.match(SLUG_DATA);
  if (sd && HOJE_ANCORA.test(t)) {
    const [, d, mmm, aa] = sd; const dia = +d, mes = MESES[mmm], ano = ano4(aa);
    if (validDM(dia, mes)) return ok(dia, mes, ano, { dia: sd[0], mes: sd[0], ano: `${sd[0]}+"hoje"` }, 'slug_data_cheia_hoje');
  }

  // 2) data cheia no texto: DD/MM/YY(YY), respeitando "a partir de" (início) → ignora
  for (const m of t.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g)) {
    if (ehInicio(t, m.index)) continue;
    const dia = +m[1], mes = +m[2]; let ano = +m[3]; ano = ano < 100 ? ano4(pad(ano)) : ano;
    if (validDM(dia, mes)) return ok(dia, mes, ano, { dia: m[0], mes: m[0], ano: m[0] }, 'data_cheia_texto');
  }

  // 3) DD/MM parcial COM âncora de fim, ano inferido (slug-proxy → publicado_em → indeterminada)
  const parcial = acharParcialComAncora(t);
  if (parcial) {
    const { dia, mes, ev } = parcial;
    const ano = inferirAno({ dia, mes, slug: s, publicado_em });
    if (!ano) return indet('ano_indeterminado', { dia: ev, mes: ev });
    return ok(dia, mes, ano.ano, { dia: ev, mes: ev, ano: ano.ev }, 'parcial_ano_inferido');
  }

  return indet('sem_dia_mes');
}

function ok(dia, mes, ano, evidencia, motivo) {
  return { vigencia_fim: iso(ano, mes, dia), confiavel: true, componentes: { dia, mes, ano }, evidencia, motivo };
}
function indet(motivo, evidencia = {}) {
  return { vigencia_fim: IN, confiavel: false, componentes: { dia: null, mes: null, ano: null }, evidencia, motivo };
}

// "a partir de" nas ~14 chars antes do match → é início.
function ehInicio(t, idx) { return INICIO.test(t.slice(Math.max(0, idx - 16), idx)); }

// Âncora de fim perto de um DD/MM (sem ano). "ate 30/06", "(11/03) ... ultimo dia", "somente hoje (10/10)".
const FIM_ANCORA = /(\bate\b|valid[oa] ate|termina|ultimo dia|vale ate|somente (hoje|nesta|neste|amanha)|so (hoje|amanha|nesta|neste|nesse)|apenas (hoje|nesta)|acaba|encerra)/;
function acharParcialComAncora(t) {
  if (!FIM_ANCORA.test(t)) return null;
  for (const m of t.matchAll(/(\d{1,2})\/(\d{1,2})(?!\/?\d)/g)) {
    if (ehInicio(t, m.index)) continue;
    const dia = +m[1], mes = +m[2];
    if (validDM(dia, mes)) return { dia, mes, ev: `${FIM_ANCORA.exec(t)[0]}...${m[0]}` };
  }
  return null;
}

// Inferência de ano com trava de virada. Retorna {ano, ev} ou null (→ indeterminada).
export function inferirAno({ dia, mes, slug = '', publicado_em = null }) {
  // slug mmmAA como proxy de publicação (mês+ano)
  const sm = slug.match(SLUG_YM);
  if (sm) {
    const pubMes = MESES[sm[1]], pubAno = ano4(sm[2]);
    return anoPorProxy(dia, mes, pubMes, pubAno, `slug ${sm[0]}`);
  }
  if (publicado_em) {
    const [py, pm] = publicado_em.split('-').map(Number);
    return anoPorProxy(dia, mes, pm, py, `publicado_em ${publicado_em}`);
  }
  return null; // sem proxy de ano → não chuta (INV-16)
}

// Alvo depois do mês de publicação → mesmo ano; antes → virada (+1); ambos só se "próximo".
function anoPorProxy(dia, mes, pubMes, pubAno, ev) {
  const JAN_MAX = 11; // janela de proximidade (meses)
  if (mes >= pubMes) {
    if (mes - pubMes <= JAN_MAX) return { ano: pubAno, ev };
    return null;
  }
  // virada de ano: alvo antes do mês de publicação → ano seguinte, se próximo
  if ((12 - pubMes) + mes <= JAN_MAX) return { ano: pubAno + 1, ev: `${ev} (virada)` };
  return null;
}
