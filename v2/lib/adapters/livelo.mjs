// Adapter TIER 1 — Livelo (bancário/varejo de pontos). sitemap + fetch (D-009).
// robots.txt (verificado 2026-07-16): Allow: / (tudo liberado).
// Sitemap é ÍNDICE -> seguir só o static-sitemap (campanhas/transferências);
// product/category são catálogo de resgate, fora do escopo TIER 1.
// Campanhas: /livelo-para-parceiros/*/Transfer, /ofertas*, /clube*.
import { criarAdapter } from './base.mjs';

export const config = {
  programa: 'livelo',
  sitemap: 'https://www.livelo.com.br/sitemap/sitemap.xml',
  robots: [],
  sub: /static-sitemap/i,
  incluir: /(livelo-para-parceiros\/[^/]+\/[a-z]*transfer|\/ofertas|\/oferta-do-dia|\/clube($|\/|-)|calendario-de-bonus)/i,
  excluir: /(backup-lp|pagina-de-testes|-bk($|\/))/i,
  prefMeta: ['og:title'],
};

export default criarAdapter(config);
