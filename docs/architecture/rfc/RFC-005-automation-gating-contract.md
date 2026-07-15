# RFC-005 — Automation & Gating Contract
**Version 1.0 · Status: Proposed · Layer: Domain (transversal)**

| Campo | Valor |
|---|---|
| Conforma-se a | RFC-001 (§9.4), Architecture Review |
| **Resolve** | **F-02 / C-2 / ADR-002** (gate mecânico vs. julgamento) e F-05 (delega tolerância a RFC-007) |
| Precedência | … > RFC-001 > **RFC-005** |

## 1. Propósito
Formalizar o que pode ser **automatizado** e provar que a automação **move**, nunca **decide**. A auditoria da RFC-001 mostrou que o "gate determinístico" era super-afirmado: vários invariantes são semânticos e humanos. Esta RFC **bifurca o gate** e classifica cada invariante.

**Princípio.** *Automação verifica o verificável e para; o julgamento é humano e insubstituível.*

## 2. O gate em dois níveis (o coração — resolve C-2)

```
                       ┌──────────────────────────┐
 Written ─ submete ─▶ │  GATE MECÂNICO [M]        │  determinístico, automatizável
                       │  para em qualquer M-fail  │  → REJECTED (bloqueio)
                       └────────────┬─────────────┘
                          passou    │
                       ┌────────────▼─────────────┐
                       │  GATE DE JULGAMENTO [H]   │  humano, não automatizável
                       │  Editor-Chefe             │  → APPROVED ou REJECTED
                       └────────────┬─────────────┘
                                    ▼  Rendered → Dispatch (RFC-004)
```

## 3. Classificação de cada invariante (a tabela que faltava)

| Invariante (RFC-001) | Gate | Por quê |
|---|:--:|---|
| I-6 disclaimer íntegro | **M** | correspondência exata verificável |
| I-8 faixa↔veredito | **M** | mapeamento numérico |
| I-9 breakdown reconcilia | **M** | aritmética (tolerância = RFC-007) |
| I-10 conta fecha | **M** | aritmética |
| I-7 vigência (overrule) | **M** | comparação de datas |
| I-11 cardinalidade 1–3 | **M** | contagem |
| I-12 um Sinal | **M** | contagem |
| I-14 Ilustrativa | **M** | guarda booleana |
| I-15 vocabulário fechado | **M** | pertencimento a conjunto |
| I-4 urgência artificial | **M(léxico) + H(nuance)** | léxico pega o óbvio; ironia/borderline é humano |
| **I-2 anti-cópia** | **H** | plágio semântico não é mecânico |
| **I-3 não prometer ganho** | **H** | promessa é interpretação |
| **I-13 voz/posição do Ponto** | **H** | tom e adequação |
| I-1 dado interno/CMI | **M(padrões) + H(julgamento)** | padrões conhecidos automatizáveis; o resto humano |

**Consequência:** o §16 da RFC-001 (checklist) **DEVE** marcar cada item [M]/[H]. Um checklist que finge que I-2/I-3 são mecânicos é o defeito F-02.

## 4. Contrato de automação
| Obrigações (DEVE) | Proibições (NÃO DEVE) | Garantias |
|---|---|---|
| Ser determinística e reproduzível. | Curar, cortar ou julgar. | Todo M-check roda sempre. |
| Parar em qualquer **M-fail**. | Pular o gate. | Nenhum cap silencioso (omissões logadas). |
| Registrar tudo que omitiu/limitou. | Auto-aprovar (H é humano). | Idempotência herdada (RFC-004). |
| Entregar o [H] a um humano. | Auto-despachar real. | Replayável e observável. |

## 5. Constantes governadas (resolve F-11, centraliza)
Esta RFC hospeda o **registro de constantes de domínio** e sua governança:

| Constante | Valor atual | Dono | Classe de mudança |
|---|---|---|---|
| Teto do Deal Desk | 3 | Editor-Chefe + Board | MAJOR |
| Janela "Fecha logo" | 72h | Editorial | MINOR |
| Faixa TL Score | 0–100 | RFC-007 | MAJOR |
| Escala de níveis | 1–4 | RFC-003 | MAJOR |
| Janela de frescor | (RFC-003) | Editorial | MINOR |
| Tolerância de reconciliação | (RFC-007) | RFC-007 | MINOR |

## 6. Invariantes (A-x)
A-1 automação não decide · A-2 para em M-fail · A-3 nunca auto-aprova (H humano) · A-4 nunca auto-despacha real · A-5 sem cap silencioso · A-6 determinística e replayável.

## 7. Examples / Counter-examples
- ✅ Edição com conta que não fecha → M-fail → REJECTED, sem chegar ao humano.
- ✅ Edição limpa no M → humano lê, detecta promessa velada (I-3) → REJECTED no H.
- ❌ Automação "aprova" porque passou no M → viola A-3.
- ❌ Automação corta o 4º deal silenciosamente → viola A-5 (deveria logar).

## 8. Anti-patterns
Julgamento automatizado · aprovação inferida · truncamento silencioso · gate único fingindo determinismo sobre semântica.

## 9. Alternativas descartadas
- *Gate único totalmente automático* → o defeito F-02; recusado.
- *Gate único totalmente humano* → não escala e reintroduz erro mecânico; recusado. Dois níveis vencem.

## 10. Dependências
Depende de RFC-007 (tolerâncias) e RFC-003 (níveis). Alimenta RFC-004.
