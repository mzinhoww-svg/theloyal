# ADR-RADAR-005 — Tratamento de outliers

- **Status:** proposed
- **Data:** 2026-07-15 · **Revisado:** 2026-07-15 (evidência forense)
- **Relacionado:** arquitetura §14, §27d.6, §27f; `docs/AUDITORIA-FORENSE-PREDICT-FORECAST.md`
  §11–12; ADR-RADAR-009, ADR-RADAR-010

## ⚠ Correção canônica
O intervalo de 943 dias **não é um outlier de cadência** a ser primariamente tratado por
MAD/IQR: é uma **duplicata da mesma campanha com data fabricada** (ADR-009) causada por
**erro temporal de extração** (ADR-010). A detecção de outlier deste ADR é uma **rede de
segurança secundária** — **nunca** a correção do 943d. Um outlier só deve ser afirmado
sobre uma série **temporalmente válida e deduplicada**; caso contrário, o "outlier" é
apenas o sintoma de dado corrompido, e a ação correta é bloquear/reprocessar/revisar
(ADR-010), não rebaixar a confiança de uma cadência inexistente.

## Contexto
Nenhum dos motores detecta outlier. Mesmo após corrigir dado e duplicidade, séries
legítimas terão intervalos atípicos (mudança de regime, lacuna real de coleta) que o
modelo hoje absorve cru na mediana/hazard, sem alerta.

## Problema
É preciso conter intervalos anômalos **sem apagá-los** (princípio 6) e sem
confundir outlier isolado com mudança estrutural de regime.

## Alternativas
1. Cap fixo de intervalo (arbitrário, apaga sinal).
2. Winsorization (ainda distorce).
3. Remoção por IQR/MAD (perde o dado, viola princípio 6).
4. **Detectar (MAD/IQR) + rebaixar confiança + segregar regime**, mantendo o ponto
   no histórico; exclusão só por decisão humana justificada.

## Decisão proposta
Alternativa 4, **aplicada só depois de ADR-010 (data válida) e ADR-009 (deduplicado)**.
Marca `outlier` quando o intervalo desvia > k·MAD da mediana (com ≥6 ondas — senão
`sparse`). O ponto permanece; a confiança cai. **Antes de tratar como outlier, o
pipeline deve verificar se o intervalo é artefato de data suspeita (→ ADR-010) ou de
duplicidade provável (→ ADR-009); se for, a ação é bloquear/reprocessar/revisar, não
rebaixar.** Regime novo consistente vira `regime_change`. O backtest considera o outlier
como ponto real (não trapaceia removendo-o).

## Consequências positivas
- Honestidade estatística; o 943d fica visível e explicado.
- Distinção entre lacuna de coleta, outlier real e mudança de regime.

## Consequências negativas
- Confiança mais baixa em séries irregulares (menos manchetes "alta").
- Requer `k` calibrado e ≥6 ondas para afirmar outlier.

## Riscos
- Falsos outliers em séries curtas (mitigado pelo estado `sparse`).
- Operador excluir outlier real por conveniência (mitigado por justificativa+auditoria).

## Questões em aberto
- Valor de `k` (ex. 3·MAD).
- Regra para separar `outlier` de `regime_change`.

## Critério para `accepted`
Aprovação do usuário da política de outliers (rebaixar vs excluir) e de `k`.
