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

### 3. Semear o catálogo — **pelo admin, em produção**
- No `/admin`, seção **Catálogo de SKUs**, use o formulário **"adicionar SKU"**:
  nome canônico, marca, modelo, categoria, GTIN e a **URL pública de cada player**.
  Isso grava `sku_catalog` (status `approved`) + `sku_sources` de uma vez.
- Alternativa one-shot: `INSERT` em `sku_catalog`/`sku_sources` via SQL (Supabase).
- Só SKU `approved` com fonte mapeada entra na coleta. `content/sku-basket.json` é
  só a semente do **modo mock** (a math roda sem tocar API).

**Sugestão de cesta inicial** (≥3 por categoria para a banda fechar; confirmar o GTIN
na própria listagem):

| Categoria | SKUs sugeridos |
|---|---|
| smartphone | Galaxy S24 128GB · iPhone 15 128GB · Motorola Edge 50 256GB · Redmi Note 13 128GB |
| tv | Samsung 50" CU8000 4K · LG 50" UR8750 · TCL 50" C645 QLED |
| notebook | Lenovo IdeaPad 3 i5 · Acer Aspire 5 i5 · Samsung Galaxy Book3 i5 |
| audio | JBL Tune 520BT · Sony WH-CH520 · AirPods 2ª geração |
| eletroportatil | Air Fryer Mondial 4L · Nespresso Inissia · Aspirador Electrolux |

Escolha modelos que os **três** portais carregam; o match é por GTIN (exato) ou
marca+modelo+capacidade.

### 4. Afinar os adapters (o passo mais manual)
`scripts/collect/adapters/{azul,smiles,latam}.mjs` trazem `pointsPatterns` e a extração
de preço via JSON-LD como **ponto de partida**. Como afinar:

1. Abra a página pública de um produto no portal do player (ex.: Azul Shopping).
2. Veja o **fonte da página** e procure:
   - `<script type="application/ld+json">` com `Product`/`offers.price` → é o **preço em
     dinheiro** (já lido por `http.mjs`). Se não houver, ajuste para pegar o preço por
     regex/seletor.
   - onde aparecem os **pontos** ("por N pontos" / "N milhas") → ajuste `pointsPatterns`
     para casar com o texto real.
3. Rode `node scripts/collect-skus.mjs` (live, com `SUPABASE_SERVICE_KEY`) e confira se
   `points`/`cash` saem por player nas `sku_observations`.

**Atenção (provável realidade destes portais):** muitos catálogos de resgate renderizam
preço/pontos via **JavaScript (SPA)** e/ou exigem **login** para exibir os pontos. Nesse
caso o `fetch` simples de `http.mjs` não pega os números. Opções:
- subir o adapter para um **headless browser** (Playwright/Chromium já disponível no
  ambiente) que renderiza a página antes de extrair; ou
- usar a **API interna** do portal (a mesma que a página chama via XHR), quando exposta.
Enquanto isso, o `n/c` protege o indicador — nada é inventado.

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
