# M2 · Slice B — Coleta oficial TIER 1 (A ESTRADA) · RESULTADO

> Adapters de página oficial que alimentam `confirmar_tier1` (migration 003), destravando a elegibilidade a Deal Desk (INV-02). Padrão sitemap + fetch simples (D-009), zero headless. Reprodutível: `node --test v2/lib/adapters/adapters.test.mjs` (25 testes, verdes). Data: 2026-07-16. Trilha B.

## O que fecha esta slice

INV-02 rebaixa a "Não confirmado" tudo sem TIER 1; hoje **0 campanhas** têm fonte oficial. A regra interina D-003 (confirmação manual) já cobre o gap ponta a ponta via `confirmar_tier1`. Esta slice constrói **a estrada automatizada** que descobre e confirma campanhas nas páginas oficiais, mantendo o humano/matcher como quem decide "esta URL = esta campanha".

## Cobertura por programa (dimensionada pela MATRIZ-COLETA)

| Programa | Adapter | Sitemap | robots/ToS aplicado | Descoberta | Extração |
|---|---|---|---|---|---|
| **Smiles** | `smiles.mjs` | `urlset` plano | Disallow `/*?*`, `/*.pdf` (query + pdf barrados) | `/aereas/campanha-*`, `/bancos-*-ate-NN-*`, `*-oferta` | título/desc/canonical + **percentual do slug** |
| **Livelo** | `livelo.mjs` | `sitemapindex` → `static-sitemap` | `Allow: /` (nada barrado) | `*/Transfer`, `/ofertas*`, `/clube*` | og:title + meta description + canonical |
| **Esfera** | `esfera.mjs` | `sitemapindex` (CDATA) → `staticSitemap` | Disallow `/checkout`, `/profile`, `/cart`… | `/campanha-*` | **og:title** (página não traz canonical) |
| **TAP Miles&Go** | `tap.mjs` | `sitemapindex` por locale → `pt_br` | Disallow `*/minha-conta`, `*/api`, `*/_next/data`… | `/pt_br/ofertas*`, `/miles-and-go`, `/milhas*` | og:title + canonical + h1 |

**Azul e LATAM: NÃO construídos, por decisão.** Azul tem anti-bot no edge (robots 403, D-010) → coberto por confirmação manual. LATAM é SPA JS-rendered (D-011) → investigação de API interna pendente, nada construído. Ambos respeitados como o brief manda; a estrada não os toca.

## Live vs fixture (validação honesta)

Tudo foi **verificado ao vivo em 2026-07-16** através do proxy (`NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`), e os **testes rodam contra fixtures** (HTML/XML real salvo em `v2/lib/adapters/fixtures/`), sem dependência de rede no CI.

- **Ao vivo, confirmado:** robots.txt dos 4 (200); sitemaps dos 4 (200, formas index/urlset/CDATA reais); 1 página de campanha real por programa (Smiles gol, Livelo→Smiles Transfer, Esfera aniversário, TAP ofertas). Todos os fixtures HTML/XML são **excertos reais**, não fabricados (regra: "nunca invente conteúdo de campanha").
- **`run.mjs` ao vivo em MOCK** (sem escrever no banco): campanha viva (`campanha-gol/20260512`, HTTP 200) extrai payload TIER 1; campanha encerrada (`bancos-banestes-ate-90-11-10`, HTTP 302 → `/promocao`) é **recusada**, nunca confirmada.
- **Depende de rede:** a varredura completa de sitemap (13k+ URLs no TAP pt_br) e o `fetch` de cada página não rodam no CI; a lógica pura (descoberta, filtro robots, extração, decisão de confirmação) roda 100% offline contra fixture.

## O caminho `confirmar_tier1` (A ESTRADA, ponta a ponta)

```
sitemap oficial ──descobrirUrls()──▶ URLs de campanha (já limpas de robots)
                                          │  (matcher/humano casa URL ↔ campaign_id — D-003)
                                          ▼
URL oficial verificada ──run.confirmarUrl()──▶ fetch (UA identificado, redirect manual)
   │  200 vivo → extrairCampanha() → payload de evidência (título/%/canonical/slug)
   │  3xx (encerrada→/promocao) → PARA, reporta "não confirmável" (nunca força TIER 1)
   │  robots/ToS bloqueia a URL → PARA antes do fetch (D-009)
   ▼
confirmar_tier1(campaign_id, url_canonica, verificado_em)  ← migration 003, inalterada
   → INSERT campanha_fontes (tier 1) + evento em campanha_versoes + promove estado FSM
```

`run.mjs` tem **núcleo puro injetável** (`confirmarUrl({...}, {fetchImpl, confirmar, mock})`): testado com fetch e RPC mockados — nenhuma escrita em produção. O CLI liga o fetch real + RPC PostgREST; sem `SUPABASE_URL`/`SERVICE_ROLE_KEY` cai em MOCK (dry-run).

## Determinismo e anti-invenção (INV-16 / INV-02)

- **Percentual só com proveniência:** o número vem do **slug** (`bancos-banestes-ate-90` → 90%, evidência `slug:ate-90`) ou de texto curado (título/meta/h1), **nunca do corpo** (corpo tem `%` de navegação/ruído). Sem evidência → `null`, nunca chute. Achado real: os slugs da Smiles carregam `ate-NN` de forma estável, mais confiável que o HTML.
- **Redirect = não confirmável:** campanha encerrada devolve 302 → `/promocao`. A estrada trata 3xx como "página oficial não existe mais nesta URL" e recusa. Confirmar TIER 1 sobre um redirect envenenaria o FSM (INV-16, mesma família).
- **Compliance é filtro de construção, não pós-checagem:** `descobrirUrls` já exclui todo path `Disallow` do robots do programa; `run` recusa URL bloqueada **antes** do fetch.

## Entregáveis

- `v2/lib/adapters/base.mjs` — contrato puro: `parseSitemap`, `descobrirUrls`, `urlPermitida`, `extrairCampanha`, `extrairPercentual`, `decodeEntidades`, `canonical`, `criarAdapter`.
- `v2/lib/adapters/{smiles,livelo,esfera,tap}.mjs` — 1 módulo por programa (config + `criarAdapter`).
- `v2/lib/adapters/run.mjs` — A ESTRADA (CLI + núcleo injetável).
- `v2/lib/adapters/fixtures/` — 11 fixtures reais (4 HTML de campanha + 7 sitemaps).
- `v2/lib/adapters/adapters.test.mjs` — 25 testes (descoberta, robots, extração, percentual, road mock).
- `v2/db/migrations/007_coleta_tier1.sql` — `coleta_execucoes` (aditiva, idempotente, **não aplicada**).

## Migration 007 — por que existe (e por que 003/002 não bastam)

`campanha_fontes` é a **trilha de confirmação** (1 linha por fonte confirmada) — não registra a varredura que não confirmou nada, nem o erro de sitemap. `job_queue` é **fila efêmera** (jobs viram `success`/`dead_letter` e saem do backlog) — não é histórico durável. **REQ-09/NFR-03 exigem "saúde por fonte monitorada":** `coleta_execucoes` grava 1 linha por execução de adapter (sitemap buscado, N descobertas/confirmadas/recusadas, status, erro, duração). É telemetria operacional, não verdade de campanha — por isso tabela própria, RLS `service_role`, e a função `registrar_coleta_execucao`. **Não apliquei no banco** (só validei estrutura; espelha o padrão da migration 002).

## Decisões novas propostas (NÃO editei DECISIONS.md — registro para ratificação)

- **D-B1 · Percentual com proveniência de slug > corpo HTML.** O `ate-NN` do slug é a fonte primária do percentual (evidência estável); corpo HTML é ruído. Alinha com INV-16.
- **D-B2 · Redirect 3xx de página oficial = "não confirmável", nunca TIER 1.** Campanha encerrada redireciona a hub genérico; a estrada recusa. Guarda estrutural do FSM.
- **D-B3 · `coleta_execucoes` (migration 007) para saúde por fonte** — separada de `campanha_fontes`/`job_queue` porque nenhuma delas é histórico durável de varredura (REQ-09/NFR-03).
- **D-B4 · Livelo: seguir só o `static-sitemap`** do índice; `product`/`category` são catálogo de resgate (fora do escopo TIER 1). TAP: seguir só o locale `pt_br`.

## Perguntas bloqueantes ao operador

1. **`campanha_fontes` comporta o payload?** O adapter extrai `titulo`, `descricao`, `percentual` e `evidencia_percentual` como evidência de casamento URL↔campanha. A tabela hoje guarda só `noticia_url`, `tier`, `papel`, `verificado_em` — o suficiente para `confirmar_tier1`. **Não estendi o schema** (disciplina do brief: não improvisar schema). Se o operador quiser persistir a evidência de extração (para auditoria do casamento), é um `payload jsonb` aditivo em `campanha_fontes` — **decisão do operador, não improviso meu.** Por ora a evidência vive no retorno do runner/log, não no banco.
2. **Quem faz o casamento URL ↔ campaign_id?** A estrada assume que o matcher/humano já verificou o par (D-003). O matcher automático de URL→campanha (por slug/programa/data) é trabalho separado — não construí, para não invadir a slice de identidade.

## Estado

- **4 de 6 programas** com adapter (Smiles, Livelo, Esfera, TAP). Azul (D-010) e LATAM (D-011) fora por decisão, cobertos por confirmação manual/investigação pendente.
- Testes: **25 verdes** (`adapters.test.mjs`), offline contra fixtures reais. `run.mjs` validado ao vivo em MOCK.
- Migration 007 escrita e validada, **não aplicada**. Nenhuma escrita em produção. Nenhum arquivo de scoring/gate/vigência/identidade/golden tocado.

## Slice B — FECHADA (pendente ratificação das decisões D-B1…B4 e resposta às 2 perguntas)
