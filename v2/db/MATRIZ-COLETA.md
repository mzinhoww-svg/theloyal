# Matriz de coleta por programa seed (para revisão antes de qualquer adapter)

> Levantamento solicitado antes de escrever scraper (compliance do brief: respeitar robots.txt/ToS, **preferir RSS/sitemap/API a scraping de HTML**). Checado em 2026-07-16 via robots.txt + busca de páginas de promoção públicas.

| Programa | Sitemap público | Promoções em página pública (fetch simples) | robots.txt / ToS | **Recomendação de coleta** | Scraper pesado? |
|---|---|---|---|---|---|
| **Smiles** | ✅ `smiles.com.br/sitemap.xml` | ✅ `/portal/promocoes/…`, `/portal/campanhas/…` indexáveis (ex.: `bancos-c6-bank-04-2026`, `bancos-esfera-05-2026`) | crawl liberado (bloqueia só `?query` e PDF) | **sitemap + fetch simples** | ❌ |
| **Livelo** | ✅ `livelo.com.br/sitemap/sitemap.xml` | ✅ crawlável | `Allow: /` (tudo liberado) | **sitemap + fetch simples** | ❌ |
| **Esfera** | ✅ `esfera.com.vc/sitemap.xml` | ✅ promoções crawláveis (bloqueia só conta/checkout) | promo liberado | **sitemap + fetch simples** | ❌ |
| **TAP Miles&Go** | ✅ `flytap.com/sitemap.xml` + `sitemap_index.xml` | ✅ promo/campaign allowed | bloqueia só conta/API/CDN | **sitemap + fetch simples** | ❌ |
| **LATAM Pass** | ✅ `latamairlines.com/sitemapindex.xml` (mas dirs de locale majoritariamente `Disallow`; conteúdo é **SPA JS-rendered**) | ⚠️ conteúdo carrega via JS, não HTML pré-renderizado | SPA; muitos paths de usuário bloqueados | **verificar se o sitemap lista páginas de promoção; se não, headless OU API interna (`__NEXT_DATA__`/JSON)** | talvez (SPA) |
| **Azul (TudoAzul)** | ❌ `voeazul.com.br/robots.txt` → **HTTP 403** (bloqueado no edge) | ❌ bloqueado por anti-bot | anti-bot no edge (confirma achado do M0) | **scraper pesado real OU adiar; cobrir por confirmação manual TIER 1 (D-003) até valer o custo** | ✅ / adiar |

## Leitura

**4 de 6 programas (Smiles, Livelo, Esfera, TAP) são sitemap + fetch simples — zero scraper, zero Playwright, dentro do compliance.** Esses cobrem o núcleo de transferência bonificada (Livelo/Esfera → Smiles/LATAM/Azul; TAP). O trabalho "pesado" encolheu de 6 para:
- **LATAM Pass:** SPA — provável API interna JSON (`__NEXT_DATA__`) ou headless. Verificar o sitemap de promoções antes de decidir.
- **Azul:** único com anti-bot real. Recomendo **não** gastar sessão contra o anti-bot agora — cobrir por **confirmação manual TIER 1** (a `confirmar_tier1` já pronta faz isso ponta a ponta) até o volume justificar o scraper.

## Consequência para o escopo

Os adapters TIER 1 viram uma slice própria **dimensionada pela matriz**: 4 adapters de sitemap/fetch (leves, mesmo padrão), 1 de SPA (LATAM, a investigar), e Azul coberto por confirmação manual. Podem escorregar para o começo do M2 sem travar o fechamento do M1 — a `confirmar_tier1` cobre o gap do Deal Desk enquanto isso.

**Fontes:** smiles.com.br/robots.txt + busca de promoções; livelo.com.br/robots.txt; esfera.com.vc/robots.txt; flytap.com/robots.txt; latamairlines.com/robots.txt; voeazul.com.br/robots.txt (403).
