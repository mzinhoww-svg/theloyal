// =====================================================================
// Adapters TIER 1 — contrato comum (Trilha B, A ESTRADA). Determinismo-primeiro.
// Funções PURAS, sem I/O: recebem XML/HTML já buscado e devolvem dados.
// O fetch ao vivo (com robots/backoff) mora em run.mjs; aqui nada toca a rede.
//
// Padrão de coleta: sitemap + fetch HTML simples (D-009). Sem headless, sem
// scraper pesado. Compliance robots/ToS é filtro de construção, não pós-checagem:
// descobrirUrls JÁ exclui todo path Disallow do robots (NFR-03).
//
// INV-16 / anti-invenção: só afirmamos o que tem proveniência no documento
// (slug, <title>, meta, canonical). Número sem evidência -> null, nunca chute.
// =====================================================================

// ── normalização/decode ──────────────────────────────────────────────
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodifica entidades HTML numéricas (&#x2f; &#47;) e nomeadas comuns.
 *  Necessário: o canonical da Smiles vem inteiro entity-encoded. */
export function decodeEntidades(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENTIDADES ? ENTIDADES[n.toLowerCase()] : m));
}

const colapsar = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const dedup = (a) => [...new Set(a)];

// ── sitemap ──────────────────────────────────────────────────────────
/** Extrai <loc> de um sitemap, lidando com CDATA (Esfera) e entidades.
 *  @returns {{tipo:'index'|'urlset', locs:string[]}} */
export function parseSitemap(xml) {
  const src = String(xml || '');
  const tipo = /<sitemapindex[\s>]/i.test(src) ? 'index' : 'urlset';
  const locs = [];
  const re = /<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    const u = decodeEntidades(m[1]).trim();
    if (u) locs.push(u);
  }
  return { tipo, locs: dedup(locs) };
}

// ── robots/ToS ───────────────────────────────────────────────────────
/** Converte uma regra Disallow de robots.txt em RegExp ancorada no caminho.
 *  Sintaxe robots: só `*` é curinga; `?` é literal (query-string). `$` final
 *  ancora o fim da URL. `Disallow: /*?*` vira "qualquer path com ?". */
function regraParaRegex(regra) {
  let r = String(regra);
  const fim = r.endsWith('$');
  if (fim) r = r.slice(0, -1);
  const esc = r.replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + esc + (fim ? '$' : ''));
}

/** true se a URL é permitida pela lista de Disallow do robots do programa. */
export function urlPermitida(url, disallow = []) {
  let path;
  try { const u = new URL(url); path = u.pathname + u.search; }
  catch { path = String(url || ''); }
  return !disallow.some((d) => regraParaRegex(d).test(path));
}

// ── descoberta de URLs de campanha ───────────────────────────────────
/**
 * @param {string} sitemapXml
 * @param {{incluir:RegExp, excluir?:RegExp, disallow?:string[], sub?:RegExp}} cfg
 *   incluir  — path/URL de campanha deve casar.
 *   excluir  — descarta (ex.: /encerrada).
 *   disallow — regras robots.txt do programa (compliance embutida).
 *   sub      — quando o sitemap é um índice, quais sub-sitemaps seguir.
 * @returns {{tipo:'index'|'urlset', urls:string[], sub_sitemaps:string[]}}
 *   urlset -> urls preenchido (campanhas). index -> sub_sitemaps a buscar.
 */
export function descobrirUrls(sitemapXml, cfg = {}) {
  const { incluir, excluir, disallow = [], sub } = cfg;
  const { tipo, locs } = parseSitemap(sitemapXml);

  if (tipo === 'index') {
    const sub_sitemaps = locs.filter((u) => (sub ? sub.test(u) : true));
    return { tipo, urls: [], sub_sitemaps };
  }

  const urls = [];
  for (const u of locs) {
    if (!urlPermitida(u, disallow)) continue;          // compliance robots (NFR-03)
    if (incluir && !incluir.test(u)) continue;
    if (excluir && excluir.test(u)) continue;
    urls.push(u);
  }
  return { tipo, urls: dedup(urls), sub_sitemaps: [] };
}

// ── extração de metadados (HTML já buscado) ──────────────────────────
/** Conteúdo de <meta> por name/property, robusto à ordem dos atributos. */
export function metaContent(html, chave) {
  const src = String(html || '');
  const re = new RegExp(`<meta\\b[^>]*\\b(?:name|property)\\s*=\\s*["']${chave}["'][^>]*>`, 'i');
  const tag = src.match(re);
  if (!tag) return '';
  const c = tag[0].match(/\bcontent\s*=\s*["']([^"']*)["']/i);
  return c ? colapsar(decodeEntidades(c[1])) : '';
}

function tagTexto(html, nome) {
  const m = String(html || '').match(new RegExp(`<${nome}\\b[^>]*>([\\s\\S]*?)</${nome}>`, 'i'));
  return m ? colapsar(decodeEntidades(m[1].replace(/<[^>]*>/g, ' '))) : '';
}

/** href do <link rel="canonical"> (decodifica entidades — Smiles). */
export function canonical(html) {
  const m = String(html || '').match(/<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/i);
  if (!m) return '';
  const h = m[0].match(/\bhref\s*=\s*["']([^"']*)["']/i);
  return h ? decodeEntidades(h[1]).trim() : '';
}

// ── percentual com proveniência (INV-16) ─────────────────────────────
// Slug primeiro (`...-ate-90-...`, `bonus-80`) — evidência estável na URL.
const PCT_SLUG = /(?:ate|bonus|bonus-de)-(\d{1,3})(?=-|\/|$)/i;
// Texto curado (título/meta/h1), NÃO o corpo (corpo tem % de navegação/ruído).
const PCT_TEXTO = /(\d{1,3})\s*%/;

/** Extrai percentual só de fontes com proveniência: slug e texto curado.
 *  @returns {{valor:number|null, evidencia:string}} */
export function extrairPercentual(slug, textoCurado) {
  const s = (slug || '').match(PCT_SLUG);
  if (s) { const n = +s[1]; if (n >= 1 && n <= 100) return { valor: n, evidencia: `slug:${s[0]}` }; }
  const t = (textoCurado || '').match(PCT_TEXTO);
  if (t) { const n = +t[1]; if (n >= 1 && n <= 100) return { valor: n, evidencia: `texto:${t[0]}` }; }
  return { valor: null, evidencia: '' };
}

/** Deriva o slug (últimos segmentos) de uma URL, sem sufixo /encerrada. */
export function slugDe(url) {
  try {
    const p = new URL(url).pathname.replace(/\/(encerrada|index)\/?$/i, '').replace(/\/$/, '');
    const segs = p.split('/').filter(Boolean);
    return segs.slice(-2).join('/') || segs.pop() || '';
  } catch { return ''; }
}

/**
 * Monta o payload de confirmação TIER 1 a partir do HTML da página oficial.
 * PURO. Não decide se confirma — só reúne evidência com proveniência.
 * @param {string} html
 * @param {{url:string, programa:string, prefMeta?:string[]}} cfg
 * @returns {{programa,url_canonica,titulo,descricao,slug,percentual,evidencia_percentual,tier,papel}}
 */
export function extrairCampanha(html, cfg = {}) {
  const { url = '', programa = '', prefMeta = ['og:title'] } = cfg;
  const canon = canonical(html) || url;
  const titulo = prefMeta.map((k) => metaContent(html, k)).find(Boolean)
    || tagTexto(html, 'title') || tagTexto(html, 'h1');
  const descricao = metaContent(html, 'description') || metaContent(html, 'og:description');
  const h1 = tagTexto(html, 'h1');
  const slug = slugDe(canon || url);
  const pct = extrairPercentual(slug, `${titulo} ${descricao} ${h1}`);

  return {
    programa,
    url_canonica: canon,
    titulo,
    descricao,
    slug,
    percentual: pct.valor,
    evidencia_percentual: pct.evidencia,
    tier: 1,
    papel: 'confirmacao_oficial',
  };
}

/**
 * Fábrica de adapter: fecha a config de um programa nas funções do contrato.
 * Cada módulo de programa exporta `criarAdapter({...})`.
 */
export function criarAdapter(cfg) {
  const { programa, sitemap, robots = [], incluir, excluir, sub, prefMeta } = cfg;
  return {
    programa,
    sitemap,
    robots,
    descobrirUrls: (xml) => descobrirUrls(xml, { incluir, excluir, disallow: robots, sub }),
    extrairCampanha: (html, url) => extrairCampanha(html, { url, programa, prefMeta }),
    urlPermitida: (url) => urlPermitida(url, robots),
  };
}
