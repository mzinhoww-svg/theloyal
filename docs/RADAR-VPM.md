# Radar de VPM não-aéreo (Shopping) — Go-live

Guia do que falta para o Radar de VPM observado sair do mock e rodar em produção.
Fronteira inviolável: só **VPM observado** de catálogo público. Teto de CMI interno,
dado de auditoria e qualquer métrica proprietária **nunca** entram — o gate
`INTERNAL_RE` bloqueia no build/QA.

## Já feito

- Código no `main`: coletor (`scripts/collect/*`, `scripts/collect-skus.mjs`), admin
  com gestão completa, seção `shoppingWatch` no Daily e coluna `vpmObservado` no Pro.
- **Migration aplicada** no Supabase `qjqnqcsdnpvvmyzkavoq`: tabelas `sku_catalog`,
  `sku_sources`, `sku_observations`, `retail_valuations`; `runs` estendida com
  `kind` e `skus_observed`; RLS ligada.

## Falta fazer (checklist)

### 1. Secrets (host de deploy + GitHub Actions)
| Secret | Onde | Observação |
|---|---|---|
| `SUPABASE_URL` | Vercel + Actions | público |
| `SUPABASE_ANON_KEY` | Vercel + Actions | publishable (RLS protege) |
| `SUPABASE_SERVICE_KEY` | Vercel + Actions | **server-only** (admin lê tudo, coletor escreve) |
| `TAVILY_API_KEY` | Actions | descoberta de URLs |
| `OPENROUTER_API_KEY` | Actions | match/promo/extração; `OPENROUTER_MODEL` como *var* |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Vercel | Basic-Auth do `/admin` |
| `GH_DISPATCH_TOKEN` | Vercel | fine-grained, `actions:write`; `GH_REPO`, `GH_COLLECT_REF` opcionais |

Sem chaves, tudo degrada em mock/leitura limitada (seguro por construção).

### 2. GitHub Actions
- Habilitar Actions no repo.
- `collect.yml` precisa estar na **branch padrão** para o `workflow_dispatch` (botão
  do admin) funcionar. O cron diário roda às 09:00 UTC (~06:00 BRT).

### 3. Semear o catálogo
- `content/sku-basket.json` é a **semente**. Popular `sku_catalog` com os produtos
  reais (marca, modelo, GTIN, categoria) e `sku_sources` com a URL pública de cada
  player. Aprovar os SKUs no `/admin` (só `approved` entra na banda).

### 4. Afinar os adapters (o passo mais manual)
- `scripts/collect/adapters/{azul,smiles,latam}.mjs` têm padrões de ponto/JSON-LD que
  são **ponto de partida** — precisam ser ajustados contra as páginas ao vivo de cada
  portal. O modo mock já exercita toda a matemática (VPM, mediana, MAD, promo).
- Rodar `npm run collect -- --mock` para validar a math; depois `npm run collect`
  (live) e conferir se pontos/preço estão sendo extraídos por player.

### 5. Primeira coleta live e conferência
- Disparar pelo `/admin` (botão) ou `npm run collect`. Conferir `retail_valuations`
  e a seção "Shopping · VPM observado" do admin. Banda com amostra < 3 → `n/c`.

### 6. Levar ao editorial (revisado por humano)
- Pro: `npm run pro:vpm -- --write content/pro/AAAA-MM.json` injeta o VPM na matriz.
- Daily: preencher `shoppingWatch[]` na edição (ou pré-preencher a partir da banda) e
  passar `npm run validate && npm run render && npm run qa`.

### 7. Segurança
- RLS: `sku_catalog`, `sku_sources`, `sku_observations` têm RLS ligada **sem policy**
  → acessíveis só pela service key (admin/coletor). `retail_valuations` tem leitura
  anon (agregado público). Confirmar essa postura no painel do Supabase.
- Mover a **anon key hoje hardcoded** em `app/admin/route.ts` (mantida só como
  fallback) para `SUPABASE_ANON_KEY` e remover do código.

## Comandos

```bash
npm run collect -- --mock                        # valida a matemática sem tocar API
npm run collect                                  # live (precisa dos secrets)
npm run pro:vpm                                  # VPM por player da banda atual
npm run pro:vpm -- --write content/pro/2026-07.json
```

## Reconciliação (resolvida)

- `runs.product` é `NOT NULL` sem default → o coletor grava `product='radar-vpm'`
  ao registrar a rodada. Confirmado contra o schema ao vivo.
