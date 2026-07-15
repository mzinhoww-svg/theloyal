# ADR-RADAR-005 — Tratamento de outliers

- **Status:** proposed
- **Data:** 2026-07-15
- **Relacionado:** arquitetura §14, §27d.6; auditoria §16

## Contexto
Nenhum dos motores detecta outlier. O intervalo de 943 dias entra cru na
mediana/hazard e joga a data prevista para ~1,5 ano no futuro, sem alerta.

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
Alternativa 4. Marca `outlier` quando o intervalo desvia > k·MAD da mediana
(com ≥6 ondas — senão `sparse`). O ponto permanece; a confiança cai; se o outlier
vem de fragmentação de rota, aciona o fallback de cluster (ADR-003). Regime novo
consistente vira `regime_change` (usa só o regime recente). O backtest considera o
outlier como ponto real (não trapaceia removendo-o).

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
