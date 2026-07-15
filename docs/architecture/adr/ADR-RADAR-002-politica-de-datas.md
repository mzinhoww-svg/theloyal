# ADR-RADAR-002 — Política de datas e modelo de vigência

- **Status:** proposed
- **Data:** 2026-07-15
- **Relacionado:** arquitetura §5, §6, §27d.2, §27d.4

## Contexto
`vigencia_fim` é TEXT e aceita lixo (`na`); `vigencia_inicio` é nulo em 90% das
transferências, então `windowDate` ancora a série na data de **fim**. Publicação,
início, fim e captura são tratados sem distinção clara. 140 campanhas sem data
resolvível são descartadas silenciosamente.

## Problema
Sem política canônica de datas, a série mistura semânticas (início vs fim),
descarta dado válido (permanentes) e ancora a cadência no campo errado.

## Alternativas
1. Só converter `vigencia_fim` text→date (insuficiente — não resolve semântica).
2. Campo único "data" resolvido por heurística opaca (status quo).
3. **`data_evento` calculada** por prioridade `exact_start > announcement_date >
   exact_end`, com `data_evento_source`, `data_confidence`, e modelo de vigência
   `{vigencia_inicio, vigencia_fim, vigencia_type, vigencia_raw}` preservando o
   valor bruto.

## Decisão proposta
Alternativa 3. Início e fim têm pesos e incertezas distintos (§27d.4).
`source_publication_date` é só proveniência, nunca evento em produção.
Permanentes (`vigencia_type=permanent`) entram como estado, não como onda.
Migração semântica não destrói `vigencia_raw`.

## Consequências positivas
- Cadência ancorada no início (correto).
- 142 permanentes recuperadas como oferta ativa.
- Auditoria total via `vigencia_raw`.

## Consequências negativas
- Reprocessamento de todo o ledger para popular `data_evento`/`vigencia_type`.
- Séries com âncora mista exigem tratamento (`mixed_anchor`).

## Riscos
- Regras anti-erro (ano, dia/mês) geram falsos positivos de revisão.
- Peso 0,6 do `exact_end` ainda desloca cadência quando é a única âncora.

## Questões em aberto
- Pesos exatos por fonte.
- Limiar de `mixed_anchor` para rebaixar confiança.

## Critério para `accepted`
Aprovação do usuário da prioridade de datas e dos estados de vigência.
