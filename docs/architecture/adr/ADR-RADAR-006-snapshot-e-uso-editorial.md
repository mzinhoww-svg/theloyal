# ADR-RADAR-006 — Snapshot canônico e uso editorial

- **Status:** proposed
- **Data:** 2026-07-15
- **Relacionado:** arquitetura §18, §19, §25, §27d.8, §27d.9

## Contexto
`content/forecast.json` foi gerado com 119 linhas de ledger (o banco tem 2.438);
o Weekly lê esse snapshot stale. Os `predict_snapshots` são gravados mas não
lidos. O Daily é digitado à mão e diverge. Não há reprodutibilidade nem medição
de onde uma previsão foi usada.

## Problema
Falta um snapshot canônico imutável e reprodutível, e falta separar o **estado
analítico** do snapshot do seu **uso editorial** (um snapshot serve vários
produtos sem "virar published").

## Alternativas
1. Manter `forecast.json` + snapshots por motor (status quo, stale/duplicado).
2. Um snapshot único sem rastrear uso (perde medição por edição).
3. **Snapshot canônico** (contrato §18, com `dataset_hash` + `campaign_ids`) com
   estados `generated→needs_review→approved→rejected→expired→superseded`, **mais**
   entidade `prediction_snapshot_usages` (snapshot_id, product, edition_id,
   selected_at/by, published_at, presentation_version), **mais** `prediction_outcome`
   para avaliação posterior.

## Decisão proposta
Alternativa 3. "Publicado" é propriedade do **uso**, não do snapshot.
Reprodutibilidade garantida por `dataset_hash + campaign_ids + config_version +
model.version + reconciler_version`. Expiração curta + freshness gate no render.

## Consequências positivas
- Fim do stale silencioso; Daily e Weekly leem o mesmo snapshot aprovado.
- Medição de uso por edição e avaliação real via `prediction_outcome`.

## Consequências negativas
- Nova entidade e disciplina de expiração.
- Render passa a depender de freshness gate.

## Riscos
- Expiração curta demais gera recomputes frequentes.
- Migrar o Daily manual para consumo de snapshot enfrenta atrito editorial.

## Questões em aberto
- TTL de expiração (proposta ~7 dias).
- `presentation_version` — granularidade.

## Critério para `accepted`
Aprovação do usuário da expiração e do modelo snapshot × uso editorial.
