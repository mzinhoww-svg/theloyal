# RFC-007 — Scoring Methodology
**Version 1.0 · Status: Proposed · Layer: Domain**

| Campo | Valor |
|---|---|
| Conforma-se a | RFC-001 (§6.7/§6.8), Operating Manual §5.2/§5.4 |
| **Resolve** | **F-05 / C-5** (tolerância de reconciliação), F-17 (veredito derivado) |
| Precedência | … > Operating Manual > RFC-001 > **RFC-007** |

## 1. Propósito
Tornar a **Pontuação TL** explicável, reconciliável e comparável ao longo do tempo. A auditoria da RFC-001 mostrou que I-9/I-10 dependiam de uma tolerância indefinida — o gate mecânico não podia rodar. Esta RFC fecha essa lacuna.

**Princípio.** *A nota é um resumo do método, não um oráculo. Se não fecha, não existe.*

> Nota de fronteira: os **oito critérios** e seus **pesos** são propriedade do Operating Manual §5.2. Esta RFC **referencia, não redefine** — ela governa a *estrutura*, a *reconciliação* e a *comparabilidade*, não a identidade dos critérios.

## 2. Estrutura do score
- Pontuação TL ∈ inteiros [0–100].
- Deriva de **exatamente 8 critérios** (Operating Manual §5.2), cada um com peso; pesos **somam 1**.
- **Agregação:** soma ponderada dos critérios → valor contínuo → **regra de arredondamento** → inteiro.

## 3. Reconciliação (resolve F-05/C-5)
- **Regra de arredondamento (determinística):** o valor contínuo é arredondado ao inteiro mais próximo; empate (0,5) arredonda para baixo (conservador — Sage não infla).
- INVARIANTE M-1 (**tolerância zero após arredondamento**): se há Breakdown, `Pontuação declarada == round(Σ pesoᵢ·critérioᵢ)` **exatamente**. Divergência de 1 ponto já é defeito. Isso torna I-9 **testável mecanicamente** (Gate [M], RFC-005).
- **Conta feita (I-10):** o resultado **DEVE** ser derivável das linhas com a mesma disciplina — reprodução exata sob a unidade declarada (ver RFC de Unidade, futura).

## 4. Mapa faixa → veredito (canônico, herdado)

| Faixa | Veredito |
|---|---|
| 85–100 | Vale agir |
| 70–84 | Vale olhar |
| 55–69 | Só para casos específicos |
| 40–54 | Esperaria |
| 0–39 | Evitaria |
| sem dado | Não confirmado |

## 5. Veredito como função (resolve F-17)
- **Definição:** `Veredito = f(Pontuação TL, overrules)`.
- Sem overrule ativo: o veredito é o rótulo da faixa — **determinístico**, não uma escolha livre.
- **Overrules (precedência, do Operating Manual §5.4):**
  1. **Vigência ausente/vencida** ⇒ `Não confirmado` (sobrepõe qualquer faixa).
  2. **Nível de fonte** (RFC-003): Nível 4 ⇒ `Não confirmado`; Nível 3 sem corroboração ⇒ **teto Vale olhar**.
- INVARIANTE M-2: o veredito publicado **DEVE** ser exatamente `f(score, overrules)`. Um veredito que contradiz a função é defeito mecânico.

## 6. Comparabilidade temporal
- Cada Pontuação carrega a **versão da metodologia** vigente na sua data.
- INVARIANTE M-3: comparar scores de metodologias diferentes **DEVE** sinalizar a diferença de versão (não se compara maçã v1 com maçã v2 silenciosamente).
- Mudança de pesos/critérios = **nova versão de metodologia**, com **data de corte**; scores anteriores **não** são recalculados (imutabilidade da Edição publicada).

## 7. Decision tree — veredito final
```
Pontuação + fatos
 ├─ vigência ausente/vencida? ─ sim ▶ Não confirmado          (overrule 1)
 ├─ fonte Nível 4? ──────────── sim ▶ Não confirmado          (overrule 2a)
 ├─ Nível 3 sem corroboração e faixa > Vale olhar? ─ sim ▶ rebaixa a Vale olhar (2b)
 ├─ breakdown não reconcilia? ─ sim ▶ DEFEITO (M-1)           (bloqueia)
 └─ senão ▶ rótulo da faixa de score                          (M-2)
```

## 8. Invariantes (M-x)
M-1 reconciliação exata pós-arredondamento · M-2 veredito = f(score, overrules) · M-3 comparabilidade sinaliza versão · M-4 arredondamento conservador · M-5 metodologia versionada, sem recálculo retroativo.

## 9. Examples / Counter-examples
- ✅ Critérios ponderados somam 87,4 → arredonda 87 → "Vale agir"; breakdown fecha em 87.
- ❌ Score declarado 88, breakdown soma 86 → viola M-1 (defeito, bloqueia).
- ❌ Score 92 mas vigência não confirmada publicado como "Vale agir" → viola overrule 1 (deveria ser Não confirmado).
- ❌ Comparar TL Score de 2026 (v1) com 2028 (v2) sem nota de versão → viola M-3.

## 10. Anti-patterns
Nota "sentida" sem breakdown · arredondamento que infla · recálculo retroativo de edições publicadas · veredito divergente da função.

## 11. Alternativas descartadas
- *Tolerância ±N pontos* → abre espaço para "quase fecha"; recusada. Tolerância zero pós-arredondamento é mais honesta e testável.
- *Score contínuo publicado* → RFC-001 §14.4; recusado.

## 12. Dependências
Depende do Operating Manual §5.2 (critérios/pesos) e RFC-003 (níveis/overrule). Alimenta RFC-005 (Gate M). Exige a futura **RFC de Unidade** (F-14) para reconciliação de conta com unidades.
