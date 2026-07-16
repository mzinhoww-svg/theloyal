# SPEC/HANDOFF — M1 slice 3 · TIER 1 (parte arquitetural) + reescopo dos adapters

> Decisão do operador (2026-07-16): fechar a parte incremental verificável da slice 3 agora; reescopar os adapters pela matriz de coleta; adapters viram slice própria (pode escorregar p/ início do M2 sem travar o M1, pois a confirmação manual cobre o gap).

## Entregue (verificado em produção)

### 1. Reclassificação de tier — feito
Todas as 4 fontes (`news_sources`) eram blogs marcados 1×/2×; reclassificadas para **TIER 2** (TIER 1 = página oficial/regulamento, definição do brief). Resultado: **0 tier 1, 4 tier 2**, `tipo_coleta='rss'`. Pré-condição para o Deal Desk depender de tier corretamente.

### 2. `confirmar_tier1(campaign_id, url, verificado_em, papel)` — feito (migration 003)
Confirmação de fonte oficial **incremental**, cobre a regra interina D-003 ponta a ponta:
- Insere em `campanha_fontes` (tier 1, papel `confirmacao_oficial`, url + `verificado_em`).
- Gera evento `confirmacao_tier1` em `campanha_versoes` (payload antes/depois).
- **Promove o estado** da campanha via FSM (`derivar_estado_vigencia` com `tem_tier1=true`): ex. `detectada → ativa`. **Sem rebuild** — opera numa campanha só (diretriz do operador).
- **Idempotente:** mesma url 2× não duplica fonte nem evento.
- **Testado em produção:** campanha `all→…cartao` foi `detectada→ativa` (1 fonte + 1 evento), 2ª chamada sem duplicata; teste limpo e estado revertido.

Com isso, a confirmação manual TIER 1 já **destrava a elegibilidade a Deal Desk** sem depender de adapters.

### 3. Matriz de coleta — feito (`v2/db/MATRIZ-COLETA.md`)
4/6 programas (Smiles, Livelo, Esfera, TAP) são **sitemap + fetch simples** (sem scraper). LATAM é SPA (API interna/headless a verificar). Azul tem anti-bot (cobrir por confirmação manual até valer o scraper). O "trabalho pesado" encolheu de 6 para ~1.

## Adiado para slice própria (dimensionada pela matriz)
Construção dos adapters TIER 1: 4 de sitemap/fetch (padrão leve), 1 SPA (LATAM), Azul via manual. Enfileiráveis na `job_queue` (`tipo=coleta_sitemap`/`confirmacao_tier1`). Pode iniciar no M2 sem travar o M1.

## Restante do M1
- **Slice 4:** golden set de 100 notícias rotuladas (inclui os 22 `origem_generica_recuperavel`) + re-versionamento das 20 migrations.
- **Portão de milestone M1:** aprovação do operador após slice 4.
