# ADR-RADAR-008 — Papéis de Forecast e Predict e reconciliação

- **Status:** proposed
- **Data:** 2026-07-15
- **Relacionado:** arquitetura §15, §16, §17, §27d.1

## Contexto
Forecast (recorrência simples) e Predict v2 (hazard/backtest) coexistem. Só o
Forecast chega ao leitor, embora o Predict seja mais defensável (probabilidades,
censura, backtest). Não há reconciliação: para a mesma série, um prevê e o outro
bloqueia (ex.: rota `livelo→connectmiles`).

## Problema
Sem regra de precedência, os dois motores produzem mensagens independentes e
potencialmente contraditórias, e o motor "melhor" não chega ao produto.

## Alternativas
1. Manter os dois publicando independentemente (status quo).
2. Aposentar o Forecast e publicar só Predict (perde cobertura de séries curtas).
3. **Predict canônico; Forecast como fallback interno rotulado**, com
   reconciliador: `Predict ready → Predict`; `ready_with_warnings → Predict +
   revisão`; `Predict blocked + Forecast elegível → Forecast (fallback)`; `ambos
   blocked → Não confirmado`. Divergência acima do limiar → revisão obrigatória.

## Decisão proposta
Alternativa 3. Forecast sobe o gate de publicação (≥5 ondas, ADR-004), nunca é
manchete sozinho, e serve de baseline/fallback e comparação. Daily e Weekly leem
o **mesmo** resultado reconciliado (nunca motores diferentes por produto).

## Consequências positivas
- Fim das mensagens independentes e das divergências Daily×Weekly.
- Motor mais forte (Predict) chega ao leitor; cobertura preservada pelo fallback.

## Consequências negativas
- Reconciliador é mais uma peça a versionar e testar.
- Forecast rebaixado reduz o número de manchetes de curto prazo.

## Riscos
- Fallback frequente ao Forecast pode confundir se mal rotulado.
- Limiar de divergência mal calibrado gera revisões demais ou de menos.

## Questões em aberto
- Divergência máxima aceitável (ex. 30 dias de centro).
- Se o Forecast pode chegar ao leitor ou fica só no admin.

## Critério para `accepted`
Aprovação do usuário do motor canônico (Predict), do papel do Forecast e das
regras de reconciliação.
