# Reconciliação: Manual v1 (8 critérios) → engine v2 (5 componentes)

> Verificação bloqueante antes de ancorar os golden do TL Score. O Manual v1 publicado (`components/sections.tsx:257`) tem 8 critérios ponderados. O vetor v2 proposto tem 5. Esta tabela mostra cada um dos 8: mapeado, absorvido, virou override/sinal, ou **órfão** (sumiu sem casa). Órfão sem decisão = duas metodologias divergentes (uma pública, uma no código) — quebra a promessa de metodologia auditável. Traga a decisão, não esconda a divergência.

## Manual v1 (público, hoje no site)

`25·valor + 15·regra + 15·vigência + 10·fricção + 10·aplicabilidade + 10·liquidez + 10·estoque + 5·fontes` · override: *sem vigência confirmada → Não confirmado*.

## Mapeamento 8 → 5

| # | critério v1 | peso | destino no v2 | tratamento |
|---|---|--:|---|---|
| 1 | **valor** | 25 | **percentil** + **eficiência** | refino: "valor" vira dois sinais — percentil (bônus vs história da rota) + eficiência (CPM/VPM/spread). Não cortado. |
| 2 | **regra** | 15 | **— órfão —** | qualidade dos termos (mín. transferência, clawback, exclusões). **Sem casa nos 5.** |
| 3 | **vigência** | 15 | **removido do score → sinal de urgência** | tua decisão: urgência não é qualidade; sai do peso, vira selo (FSM já deriva `ultimos_dias`). |
| 4 | **fricção** | 10 | **— órfão —** | esforço de execução (passos, prazo de crédito). **Sem casa nos 5.** |
| 5 | **aplicabilidade** | 10 | **abrangência** | público que pode usar → abrangência. Mapeia limpo. |
| 6 | **liquidez** | 10 | **eficiência** (dobra) | facilidade de converter em valor → VPM/spread já captura. Absorvido. |
| 7 | **estoque** | 10 | **— órfão —** | disponibilidade (assentos/estoque de resgate). **Sem casa nos 5.** Exige award search ao vivo. |
| 8 | **fontes** | 5 | **override** (sem TIER 1) | vira override bloqueante (INV-02), não peso de 5 pts. **Mais forte**, não mais fraco — credibilidade primeiro. |
| — | **raridade** | novo | **raridade** (0,15) | **novo no v2**, não existia nos 8. Sinal de "preste atenção" (100% raro > 100% mensal); no v1 estava implícito dentro de "valor". |

## O que a reconciliação expõe

**35 pontos da metodologia pública (regra 15 + fricção 10 + estoque 10) estão órfãos** — não têm componente no v2. Três causas possíveis, e a escolha é tua:

1. **Determinismo-primeiro os bloqueia hoje:** os três exigem dado que o v2 **não tem estruturado** — `regra` precisa de parsing de T&C, `fricção` de modelo de execução, `estoque` de award search ao vivo. Sem fonte computável, um componente determinístico deles seria um número inventado (viola INV-12/INV-03).
2. **`fontes` e `vigência` mudaram de natureza** (peso → override/sinal): evolução defensável e mais rígida, mas **é mudança de metodologia pública** — o texto do site precisa acompanhar.
3. **`raridade` é adição nova** — precisa entrar no Manual público se ficar.

## Decisão que preciso de você (paro aqui, não improviso — sua regra)

**Opção A — evoluir conscientemente para o conjunto computável (recomendo):**
- v2 pontua com o que é **determinístico hoje**: percentil, eficiência, raridade, abrangência. `fontes`→override, `vigência`→urgência.
- `regra`, `fricção`, `estoque` viram **dívida registrada** ("reintroduzir quando houver fonte computável") e o **texto público do Manual é atualizado** para a metodologia v2 — divergência explícita e datada, não escondida.
- Vetor final (pós-remoção de vigência): **percentil 0,45 · eficiência 0,30 · raridade 0,15 · abrangência 0,10**.

**Opção B — manter os 8 e achar proxies computáveis** para regra/fricção/estoque agora (atrasa a Trilha A; estoque provavelmente inviável no M2 sem award search).

**Opção C — 6º componente parcial:** reintroduzir só `regra` (o mais impactante e o mais parseável de T&C) como 6º, deixando fricção/estoque como dívida.

Minha recomendação é **A**, com o Manual público atualizado como dívida na mesma leva — porque B trava a estrada por dado que não temos e C ainda deixa 20 pts órfãos. Mas isto é decisão de metodologia pública, tua alçada. **Não ancoro golden nem disparo trilha até você escolher.**
