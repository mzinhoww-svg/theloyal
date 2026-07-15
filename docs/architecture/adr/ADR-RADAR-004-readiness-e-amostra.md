# ADR-RADAR-004 — Readiness e gates de amostra por finalidade

- **Status:** proposed
- **Data:** 2026-07-15
- **Relacionado:** arquitetura §13, §15, §16, §27d.1

## Contexto
Forecast publica com 2 ondas (1 intervalo) e gera janela ±3 dias de aparência
precisa; Predict bloqueia com <3. Os estados `backfill_incomplete` e
`data_quality_blocked` existem no tipo mas nunca são atribuídos. Três ondas dão
só dois intervalos — insuficiente para publicar.

## Problema
Um gate global único é inadequado: exibir dados, calcular internamente, publicar,
atribuir confiança, detectar outlier e confiar no backtest exigem tamanhos de
amostra diferentes.

## Alternativas
1. Gate global único (2 ou 3).
2. Subir o gate global para 6 (perde exibição interna de séries curtas).
3. **Gates separados por finalidade** (§27d.1): exibição ≥1; exploratório ≥3;
   Forecast publicável ≥5; Predict publicável ≥6; média ≥6; alta ≥10; outlier ≥6;
   backtest ≥4 obs.

## Decisão proposta
Alternativa 3, com readiness completo (implementar de fato `backfill_incomplete`
e `data_quality_blocked`).

## Consequências positivas
- Séries curtas ainda são inspecionáveis no admin sem virar manchete.
- Fim da previsão de Fev/2028 de 2 ondas.

## Consequências negativas
- Mais estados para explicar no admin e na Digest.
- Menos séries publicáveis no curto prazo (cobertura menor até o backfill melhorar).

## Riscos
- Gates altos demais escondem sinais legítimos de séries raras.
- Gates baixos demais republicam o problema atual.

## Questões em aberto
- Números exatos de cada gate (5/6/10 são propostas).
- Interação com o fallback de cluster (ADR-003).

## Critério para `accepted`
Aprovação do usuário dos limiares de cada gate.
