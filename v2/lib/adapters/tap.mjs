// Adapter TIER 1 — TAP Miles&Go (aéreo). sitemap + fetch simples (D-009).
// robots.txt (verificado 2026-07-16): Disallow */minha-conta, */search,
// */api, */_next/data, */content/dam/tap, darksite; promo liberado.
// Sitemap é ÍNDICE por locale -> seguir só o pt_br. Campanhas: /ofertas*,
// /promoc*, /miles-and-go, /milhas*. Rotas de voo/aeroporto ficam de fora.
import { criarAdapter } from './base.mjs';

export const config = {
  programa: 'tap_milesgo',
  sitemap: 'https://www.flytap.com/sitemap_index.xml',
  robots: ['*/minha-conta', '*/my-account', '*/search', '*/pesquisar', '*/buscar',
    '*/api', '*/posts/api', '*/_next/data', '*/content/dam/tap', '*/cdn-cgi', '*/application'],
  sub: /\/pt_br\/sitemap\.xml$/i,
  incluir: /\/pt_br\/(ofertas|promoc|miles-and-go|milhas|club)/i,
  excluir: /\/(minha-conta|voos\/)/i,
  prefMeta: ['og:title'],
};

export default criarAdapter(config);
