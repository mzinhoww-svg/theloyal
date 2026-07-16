// Adapter TIER 1 — Esfera (Santander). sitemap + fetch simples (D-009).
// robots.txt (verificado 2026-07-16): Disallow /cart /checkout /profile
// /searchresults /confirmation /discountutils; promo liberado.
// Sitemap é ÍNDICE -> seguir o staticSitemap (loc vem em CDATA).
// Campanhas em /campanha-*. Título via og:title (Esfera não traz canonical).
import { criarAdapter } from './base.mjs';

export const config = {
  programa: 'esfera',
  sitemap: 'https://www.esfera.com.vc/sitemap.xml',
  robots: ['/cart', '/checkout', '/profile', '/searchresults', '/confirmation', '/discountutils'],
  sub: /staticSitemap/i,
  incluir: /\/campanha-/i,
  prefMeta: ['og:title'],
};

export default criarAdapter(config);
