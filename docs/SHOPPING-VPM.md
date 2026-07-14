# Radar de VPM multiprograma por SKU

Compara o valor econômico (R$ por 1.000 pontos) de produtos resgatados em
LATAM Pass, Azul Fidelidade e Smiles. Modelo rico do PROMPT MESTRE.

## Arquitetura

- **Banco (fonte de verdade)** — Supabase `qjqnqcsdnpvvmyzkavoq`:
  `loyalty_programs`, `shopping_categories`, `shopping_products`,
  `shopping_product_sources` (URL produto×categoria, `extraction_method`,
  `requires_browser`), `shopping_collection_runs`, `shopping_collection_queue`
  (claim/retry/dead_letter), `shopping_observations` (pontos separados
  standard/club/card/elite/promotional/hybrid + `hybrid_cash` + `reference_price_*`
  + `availability` + `match_confidence`), `shopping_metrics`
  (VPM padrão/elite/marginal), `shopping_sku_comparisons`,
  `shopping_category_benchmarks` (P25/mediana/P75 datado). RLS service-only.
  Migrações `supabase/migrations/0002_*`, `0003_*`.
- **Cálculo (backend)** — função `shopping_recompute(p_ref_date)`: métricas +
  comparações por SKU + benchmarks. Motor puro em `scripts/shopping/vpm.mjs`
  (validado 5/5 contra os casos §9).
- **Coleta** — `scripts/shopping/collect.mjs` (Playwright headless) roda no
  **GitHub Actions** (`.github/workflows/shopping-collect.yml`, cron 2×/dia +
  disparo manual). Fila com claim/retry/dead_letter; grava observação nova
  (nunca sobrescreve); pós-coleta chama `shopping_recompute`.
- **Admin** — `/admin/shopping-vpm` (cockpit): resumo por programa, comparativo
  por SKU, categorias, catálogo, lacunas, execuções. Botões **Recalcular** (RPC)
  e **Coletar agora** (dispara o workflow).
- **Seed** — `scripts/shopping/seed.mjs` + `supabase/seeds/shopping_seed.sql`:
  catálogo (24), fontes (41) e observações históricas validadas (9) do §6/§7/§8.
  Idempotente. Os dados de 2026-07-14 são **históricos**, não coleta atual.

## Indicadores

- `vpm_standard = reference_price / standard_points × 1000`
- `vpm_elite = reference_price / elite_points × 1000` (só com evidência de clube/elite)
- `vpm_hybrid_marginal = hybrid_cash / (standard_points − hybrid_points) × 1000`
  — **não** comparável ao integral; visão separada.
- Sem preço/pontos → **não calcula** (vira lacuna). Nunca estima preço por pontos.

## O que falta para a coleta ao vivo (bloqueio externo)

A prova técnica (§4) mostrou que LATAM/Smiles renderizam preço/pontos via
JavaScript (SPA) e Azul bloqueia `fetch` — por isso a coleta é **headless**.
Para sair do seed histórico e coletar de verdade:

1. **Secrets no GitHub Actions:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
   (coleta), e `GH_DISPATCH_TOKEN`/`GH_REPO`/`GH_COLLECT_REF` (para o botão
   "Coletar agora" do admin disparar o workflow).
2. **Afinar os adapters** (`scripts/shopping/adapters.mjs`) contra as páginas ao
   vivo de cada programa — seletores JSON-LD e regex de pontos são ponto de
   partida. Azul pode exigir tratamento anti-bot; pontos podem exigir login.
3. Rodar `workflow_dispatch` (mock primeiro, depois live), conferir observações
   e `shopping_recompute`.

Enquanto não afinado, fontes ficam `pending_validation` e o indicador se protege
com `null`/lacuna — nunca inventa número.
