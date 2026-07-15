# ADR-RADAR-003 — Chave de série: rota, cluster e três resultados

- **Status:** proposed
- **Data:** 2026-07-15
- **Relacionado:** arquitetura §11, §27d.6; auditoria §16 (caso 943d)

## Contexto
A chave de rota `origem→destino` fragmenta o histórico do destino: o intervalo de
943 dias em `livelo→connectmiles` existe porque as campanhas intermediárias eram
de `esfera→connectmiles`. O cluster `→connectmiles` tinha cadência real.

## Problema
A rota sozinha produz intervalos artificiais; o cluster sozinho mistura parceiros
e pode inferir comportamento de Livelo a partir de Esfera.

## Alternativas
1. Só rota (fragmenta).
2. Só cluster (mistura).
3. Cluster como substituto silencioso da rota (engana o leitor).
4. **Três resultados explícitos e rotulados:** `route_prediction`,
   `destination_cluster_prediction` (declarado "programa-wide, não específico da
   origem"), `no_route_prediction`; com fallback simples → shrinkage → hierárquico.

## Decisão proposta
Alternativa 4. Começar com fallback simples rotulado (rota se passa o gate; senão
cluster declarado; senão Não confirmado), evoluindo para shrinkage
`w=n_rota/(n_rota+k)`. O cluster nunca é apresentado como previsão da rota.

## Consequências positivas
- Elimina o intervalo artificial de 943 dias sem apagá-lo.
- Honestidade: o leitor sabe se a previsão é da rota ou do programa.

## Consequências negativas
- Três caminhos aumentam a complexidade de UI e de texto editorial.
- Shrinkage exige calibrar `k`.

## Riscos
- Fallback frequente ao cluster pode diluir a especificidade percebida.
- Modelo hierárquico completo é caro (fica como P5).

## Questões em aberto
- Valor de `k` no shrinkage.
- Quando o cluster é "bom o suficiente" para publicar.

## Critério para `accepted`
Aprovação do usuário do uso de rota vs cluster e do rótulo dos três resultados.
