# ADR-RADAR-008 — Papéis de Forecast e Predict e reconciliação

- **Status:** accepted
- **Data:** 2026-07-15 · **Revisado:** 2026-07-15 (evidência forense) ·
  **Aceito:** 2026-07-15 (por `docs/POLITICA-CANONICA-RADAR.md`)
- **Relacionado:** arquitetura §15, §16, §17, §27d.1, §27f; ADR-RADAR-009, ADR-RADAR-010;
  `docs/POLITICA-CANONICA-RADAR.md` (política canônica que promove este ADR)

## ⚠ Nota canônica
A reconciliação Predict>Forecast opera **sobre séries temporalmente válidas e
deduplicadas** (ADR-010, ADR-009). O fato de, no caso 943d, o Predict bloquear e o
Forecast prever Fev/2029 **não** é um problema de reconciliação — é dado corrompido a
montante. Nenhuma regra de precedência entre motores conserta cronologia falsa;
"escolher o motor certo" pressupõe que a série **exista**. A regra-mãe (§27f) precede
este ADR: **nenhum modelo compensa uma cronologia corrompida.**

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

## Decisão (aceita)
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

## Questões em aberto — resolvidas na aceitação
- **Divergência máxima:** resolvida em faixas (não um limiar único), sobre a data
  central, com sobreposição de janela como atenuante: ≤14d compatível · 15–30d
  warning · >30d revisão · >60d bloqueio (`APROVACAO-MVP-RADAR.md` Decisão 2;
  `lib/radar-view-model.ts` `computeDivergence`).
- **Forecast ao leitor:** **pode** chegar, **apenas como fallback rotulado "cadência
  aproximada"** e rebaixado — nunca manchete sozinho (`POLITICA-CANONICA-RADAR.md`
  §1.5, §7.2).

## Nota de corte de publicação (adicionada na aceitação)
Uma série só vira **previsão ao leitor** quando **todas** verdadeiras:
`datasetComplete ∧ fresh ∧ readiness∈{ready,ready_with_warnings} ∧ confiança≥média ∧
(backtest.observations≥3 → windowHitRate≥0,5) ∧ divergência∉{revisão,bloqueio} ∧
aprovação_editorial_vigente`. Abaixo disso: monitoramento honesto ou corte — nunca
número em silêncio. Definição completa e granular em `POLITICA-CANONICA-RADAR.md` §7.4.

## Critério para `accepted` — atendido
Aprovação do motor canônico (Predict), do papel do Forecast (baseline + fallback
rotulado + comparação) e das regras de reconciliação, formalizada em
`POLITICA-CANONICA-RADAR.md` (2026-07-15).
