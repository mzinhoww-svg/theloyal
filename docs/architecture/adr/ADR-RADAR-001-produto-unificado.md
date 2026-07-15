# ADR-RADAR-001 — Produto unificado (Radar Preditivo de Campanhas)

- **Status:** proposed
- **Data:** 2026-07-15
- **Relacionado:** `docs/AUDITORIA-PREDICT-FORECAST.md`, `docs/ARQUITETURA-PRODUTO-RADAR-PREDITIVO.md` §2, §17

## Contexto
Hoje existem dois motores (`forecast` e `predict v2`) em duas telas, com nomes
cruzados na navegação, vocabulário de confiança incompatível (`em-formacao` vs
`insuficiente`), gates distintos (minSamples 2 vs 3) e destinos diferentes:
só o Forecast chega ao leitor; o Predict é invisível fora do admin.

## Problema
Dois motores independentes produzem previsões diferentes para as mesmas séries,
sem reconciliação, sem fonte de verdade única e sem governança comum. Isso gera
resultados incoerentes e Daily×Weekly divergentes.

## Alternativas
1. Manter dois produtos separados (status quo).
2. Aposentar um dos motores e usar só o outro.
3. **Unificar em um produto** ("Radar Preditivo de Campanhas") com motores como
   componentes internos, uma fonte de verdade, uma camada de qualidade, um
   reconciliador e um contrato de saída único.

## Decisão proposta
Alternativa 3. Forecast e Predict deixam de ser telas/produtos e viram
componentes internos. O leitor nunca vê os nomes técnicos; o operador os vê apenas
como metadado de proveniência ("motor selecionado"). Um único snapshot canônico
alimenta Daily, Weekly, Pro e Admin.

## Consequências positivas
- Fim das contradições entre superfícies.
- Governança e métricas comuns.
- Evolução de modelo sem quebrar consumidores (contrato §18).

## Consequências negativas
- Refatoração ampla (admin, render, snapshots).
- Curva de migração e compatibilidade temporária.

## Riscos
- Unificar cedo demais, antes da camada de qualidade, apenas mascara os problemas.
- Resistência editorial à perda do Daily manual.

## Questões em aberto
- Nome visível ao operador do "motor selecionado".
- Quanto do Forecast sobrevive como fallback (ver ADR-008).

## Critério para `accepted`
Aprovação do usuário do conceito de produto único e da ordem Predict>Forecast do
reconciliador (depende de ADR-004 e ADR-008).
