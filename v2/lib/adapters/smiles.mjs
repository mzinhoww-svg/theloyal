// Adapter TIER 1 — Smiles (aéreo). sitemap + fetch simples (D-009).
// robots.txt (verificado 2026-07-16): Disallow /*?* e /*.pdf; sitemap liberado.
// Campanhas em /aereas/campanha-*, /bancos-*-ate-NN-*, /clube-*, /*-oferta-*.
// O percentual e a data moram no SLUG (`bancos-banestes-ate-90-11-10`) —
// evidência estável, preferida ao HTML ruidoso (INV-16).
import { criarAdapter } from './base.mjs';

export const config = {
  programa: 'smiles',
  sitemap: 'https://www.smiles.com.br/sitemap.xml',
  robots: ['/*?*', '/*.pdf'],
  incluir: /\/(aereas\/campanha|bancos[-/]|campanha[-/]|clube[-/].*oferta|.*[-/]oferta)/i,
  excluir: /\/encerrada(\/|$)/i,
  prefMeta: ['og:title'],
};

export default criarAdapter(config);
