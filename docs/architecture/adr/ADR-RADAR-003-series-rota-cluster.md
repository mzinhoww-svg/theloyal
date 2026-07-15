# ADR-RADAR-003 — Chave de série: rota, cluster e três resultados

- **Status:** proposed
- **Data:** 2026-07-15 · **Revisado:** 2026-07-15 (evidência forense canônica)
- **Relacionado:** arquitetura §11, §27d.6, §27f; `docs/AUDITORIA-FORENSE-PREDICT-FORECAST.md`
  §11–12; `docs/auditoria/predict-forecast-lineage.md` (L1); ADR-RADAR-009, ADR-RADAR-010

## ⚠ Correção canônica (supersede a versão anterior deste ADR)

A versão original afirmava que **"o intervalo de 943 dias em `livelo→connectmiles`
existe porque as campanhas intermediárias eram de `esfera→connectmiles`"** e que **"o
cluster `→connectmiles` tinha cadência real"**. **A auditoria forense refuta ambas as
afirmações:**

- A rota `livelo→connectmiles` tem **exatamente 2 registros, que são a MESMA campanha**
  (Livelo→ConnectMiles 40%, julho/2026): um correto (`vigencia_fim=2026-07-12`,
  origin=daily) e um com `vigencia_fim=2023-12-12` **fabricada** a partir de um artigo
  "*último dia … até hoje (12)*". **Não há campanha intermediária real.**
- Os registros `esfera→connectmiles` do cluster **também estão mal-datados** (`vigencia_fim`
  2024-02-22 / 2024-09-20, enquanto as URLs das fontes dizem "fev**25**" / "set**25**" e
  `first_seen` = 2025-02-20 / 2025-09-18). O cluster **não tem "cadência real"** — está
  poluído pelo mesmo erro de ano.

**Conclusões que passam a valer:**
1. **Rota versus cluster NÃO é a causa raiz do caso 943d.**
2. **Pooling / fallback para cluster NÃO corrige dado temporal corrompido** — apenas
   diluiria o gap específico numa média de datas igualmente erradas.
3. **A correção precisa começar ANTES dos motores** (validação temporal — ADR-010; e
   identidade/deduplicação — ADR-009).
4. A ausência de detecção/bloqueio de intervalo anômalo pelo Forecast é uma **falha
   secundária** do modelo (ADR-005), não a causa primária.

## Contexto (reformulado)
Independentemente do caso 943d, a chave de rota `origem→destino` **pode** fragmentar o
histórico de um destino quando há origens diferentes atingidas por campanhas distintas,
e o cluster `→destino` **pode** misturar parceiros. Este ADR trata desse trade-off
legítimo de granularidade — **não** como remédio para cronologia corrompida.

## Problema
A rota sozinha, em séries genuinamente esparsas, produz poucas amostras; o cluster
sozinho mistura parceiros e pode inferir comportamento de uma origem a partir de outra.
Ambos pressupõem **datas corretas** — que só a validação temporal (ADR-010) garante.

## Alternativas
1. Só rota (fragmenta séries legítimas).
2. Só cluster (mistura parceiros).
3. Cluster como substituto silencioso da rota (engana o leitor).
4. **Três resultados explícitos e rotulados:** `route_prediction`,
   `destination_cluster_prediction` (declarado "programa-wide, não específico da
   origem"), `no_route_prediction`; com fallback simples → shrinkage → hierárquico.

## Decisão proposta
Alternativa 4, **condicionada à validação temporal e à deduplicação a montante**. O
cluster nunca é apresentado como previsão da rota. **Explicitamente: o fallback de
cluster não é acionado para "resolver" intervalos anômalos — intervalos anômalos são
tratados por ADR-010 (data suspeita) e ADR-009 (duplicidade), não por pooling.**

## Consequências positivas
- Honestidade: o leitor sabe se a previsão é da rota ou do programa.
- Cobertura em séries **legitimamente** esparsas, sem inventar cadência.

## Consequências negativas
- Três caminhos aumentam a complexidade de UI e de texto editorial.
- Shrinkage exige calibrar `k`.

## Riscos
- **Risco corrigido:** tratar o fallback de cluster como solução do 943d — o que
  mascararia o erro temporal. Este ADR passa a proibir esse uso.
- Fallback frequente ao cluster pode diluir a especificidade percebida.

## Questões em aberto
- Valor de `k` no shrinkage.
- Quando o cluster é "bom o suficiente" para publicar (só sobre séries **temporalmente
  válidas**).

## Critério para `accepted`
Aprovação do usuário do uso de rota vs cluster, dos rótulos dos três resultados, **e do
princípio de que rota/cluster não corrige dado temporal (dependência de ADR-009/010).**
