# ADR-RADAR-007 — Completude do backfill

- **Status:** proposed
- **Data:** 2026-07-15 · **Revisado:** 2026-07-15 (evidência forense)
- **Relacionado:** arquitetura §8, §27d.7, §27f; `docs/AUDITORIA-FORENSE-PREDICT-FORECAST.md`
  §11–12; ADR-RADAR-009, ADR-RADAR-010

## ⚠ Correção canônica
O caso **943d NÃO é lacuna de backfill**: são dois registros da **mesma campanha**
(duplicidade por `id`-com-`vigencia_fim`) com **data fabricada** (erro de extração). A
completude de backfill deste ADR é necessária para **outros** intervalos longos
(silêncio real vs mês não coberto), **não** para o 943d. Ordem correta: primeiro
validação temporal (ADR-010) e deduplicação (ADR-009); só então a completude de
backfill decide se um intervalo **remanescente** é silêncio ou lacuna.

## Contexto
O "progresso" do backfill conta URLs coletadas, não campanhas válidas. Ele pode
marcar 100% com backlog de extração pendente e/ou artigos sem campanha. Não há
como distinguir "mês sem campanha" (silêncio real) de "mês não coberto" (lacuna).

## Problema
Sem cobertura mensurável, um intervalo longo **legítimo** (após corrigir data e
duplicidade) pode ser lacuna de coleta disfarçada de silêncio real — e o motor prevê
como se fosse cadência.

## Alternativas
1. Progresso = fila de URLs vazia (status quo).
2. Completude = existe campanha em cada mês (confunde silêncio com lacuna).
3. **Seis camadas de cobertura:** `source_coverage`, `url_coverage`,
   `news_processing_coverage`, `extraction_coverage`, `campaign_data_quality`,
   `series_coverage`. `backfill_completeness` deriva delas.

## Decisão proposta
Alternativa 3. Um mês só é **silêncio real** quando as camadas de coleta estão
100% e nenhuma campanha foi encontrada; caso contrário é lacuna
(`backfill_incomplete`). Séries `backfill_incomplete` cujo buraco afeta o horizonte
bloqueiam o Predict (Forecast pode entrar como fallback rotulado).

## Consequências positivas
- "Backfill concluído" passa a significar cobertura, não fila vazia.
- Intervalos longos só entram como cadência quando comprovadamente reais.

## Consequências negativas
- Instrumentar seis camadas é trabalhoso.
- Muitas séries ficam `backfill_incomplete` até a cobertura melhorar.

## Riscos
- Definir "fontes relevantes do período" é subjetivo (catálogo de fontes).
- Cobertura falsa-positiva se o catálogo de fontes estiver incompleto.

## Questões em aberto
- Limiar de `backfill_completeness` para desbloquear (ex. 0,7).
- Densidade esperada por programa/mês.

## Critério para `accepted`
Aprovação do usuário do conceito de completude por camadas e do limiar de bloqueio.
