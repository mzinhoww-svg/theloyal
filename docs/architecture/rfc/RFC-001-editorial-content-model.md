# RFC-001 — Editorial Content Model
**Version 1.0 · Status: Proposed → Ratified by Architecture Board · Layer: Domain**

| Campo | Valor |
|---|---|
| RFC | 001 |
| Título | Editorial Content Model |
| Versão | 1.0 |
| Status | Ratified (Architecture Board) — condicional aos P0 da auditoria |
| Camada | Domain (Ubiquitous Language + Aggregates + Contracts) |
| Conforma-se a | DDD-001, DDD-002, Blueprint, Architecture Review |
| Autoridade suprema | Regras Invioláveis (CLAUDE.md) · Operating Manual v1 |
| Escopo | Domínio editorial. **Não** cobre implementação (render/serialização/plataforma) |

> **Nota de conformidade.** Esta RFC não introduz nenhuma decisão nova de arquitetura. Ela *formaliza como domínio* o que DDD-001 (linguagem/agregados), DDD-002 (contratos e fronteiras), o Blueprint (mapa de contexto) e a Architecture Review (as quatro fronteiras de contrato: Research, Renderer, Publisher, Automation) já aprovaram. Qualquer conflito percebido resolve-se pela hierarquia de verdade do projeto — a RFC cede.

---

## 0. Linguagem normativa (RFC-2119, pt-BR)

| Termo | Significado |
|---|---|
| **DEVE / NÃO DEVE** | Requisito absoluto. Violação = defeito de domínio; bloqueia publicação. |
| **DEVERIA / NÃO DEVERIA** | Forte recomendação; desvio exige justificativa registrada. |
| **PODE** | Opcional, sem penalidade. |
| **INVARIANTE** | Propriedade que **nunca** pode ser falsa em estado válido do agregado. |

As INVARIANTES desta RFC herdam das Regras Invioláveis. Uma INVARIANTE **não pode ser relaxada por RFC** — apenas por emenda às Regras Invioláveis, acima de qualquer RFC.

---

## 1. Contexto e motivação

### 1.1 Problema
The Loyalty é uma **mídia Sage**: autoridade vem do **método**, não do tom. O ativo defensável é a *garantia* de que todo veredito é rastreável a uma fonte vigente e a uma conta reproduzível. Sem modelo de domínio explícito, "conteúdo" degenera em strings livres e as garantias viram convenção. Sintoma observado (Architecture Review, A-3): uma edição, ao atravessar uma fronteira de serialização, **perdeu** veredito colorido, conta como bloco e proveniência — sobrou texto. Prova de que a garantia estava na apresentação, não no domínio. Esta RFC move a garantia para o domínio.

### 1.2 Princípio-mãe
> **O conteúdo é dado, não documento.** Uma edição é uma estrutura verificável de fatos, contas e vereditos — a apresentação é uma *projeção*, nunca a fonte.

### 1.3 Por que agora
A Architecture Review aprovou quatro fronteiras de contrato. Um modelo de domínio compartilhado é pré-condição para que elas não redefinam "edição" cada uma à sua maneira (anti-padrão "modelo anêmico duplicado", já materializado como dois formatos rivais no repositório — §14.1).

---

## 2. Escopo

### 2.1 Em escopo
Ubiquitous Language; agregados, entidades e value objects e invariantes; lifecycle; ownership e governança; os quatro contratos (Research, Renderer, Publisher, Automation) como **obrigações de domínio**.

### 2.2 Fora de escopo
| Fora | Por quê |
|---|---|
| Formatos de serialização | Detalhe de implementação. |
| Superfícies (e-mail, web, PDF, plataforma) | São **projeções** governadas pelo Renderer Contract. |
| Layout, tokens de cor, tipografia | Vivem no sistema de marca; o domínio só referencia *semântica*. |
| Weekly/Lab/Pro/Special | Especializações do núcleo (RFC-006). Esta RFC define o núcleo. |

### 2.3 Fronteira de abstração
Esta RFC **NÃO DEVE** mencionar artefato de implementação. Serialização é problema de outra camada.

---

## 3. Ubiquitous Language

| Termo (canônico) | Definição de domínio | Não confundir com |
|---|---|---|
| **Edição** | Unidade atômica de publicação; o agregado-raiz. | "post", "newsletter" |
| **Sinal do dia** | A tese única da edição. | manchete, resumo |
| **Deal Desk** | Conjunto ordenado de análises de oportunidade. | lista de cupons |
| **Deal** | Uma análise de oportunidade individual. | "promoção" (o Deal é a *análise*) |
| **Conta feita** | Registro de cálculo que sustenta um Deal. | tabela decorativa |
| **Veredito** | Julgamento normativo de vocabulário fechado. | opinião livre |
| **Pontuação TL (TL Score)** | Índice numérico [0–100] que ancora o Veredito. | rating de estrelas |
| **Fonte** | Origem verificável, com nível de autoridade e vigência. | link qualquer |
| **Vigência** | Janela de validade confirmada. | "prazo" informal |
| **Fecha logo** | Itens que expiram em ≤72h. | urgência artificial |
| **Não confirmado** | Veredito quando falta dado. | "talvez" |
| **Disclaimer** | Frase oficial, íntegra e imutável. | aviso genérico |
| **Ilustrativa** | Edição-exemplo, não publicável como real. | rascunho |
| **Ponto** | Mascote-companheiro. **Não é selo**; o selo é a Pontuação TL. | logo, autor |

**Regra (INVARIANTE):** todo código, comentário, contrato e projeção **DEVE** usar estes termos. Sinônimo em qualquer fronteira = violação (DDD-001).

---

## 4. Bounded Context e Context Map

```
                        ┌───────────────────────────────────────────┐
                        │        EDITORIAL  (este bounded context)   │
   ┌───────────┐  fatos │   ┌─────────┐   projeta   ┌───────────┐   │  entrega  ┌────────────┐
   │ RESEARCH  │───────▶│   │ EDIÇÃO  │────────────▶│ RENDERER  │   │──────────▶│ PUBLISHER  │
   │ (upstream)│  (ACL) │   │(agregado)│  contrato  │ (contrato)│   │  contrato └────────────┘
   └───────────┘        │   └─────────┘             └───────────┘   │
        ▲               │        ▲                                  │
   ┌───────────┐        │   ┌──────────┐                            │
   │ MARCA/    │ conforma│   │AUTOMATION│  (contrato transversal)    │
   │ OPERATING │────────▶│   └──────────┘                            │
   │ MANUAL    │(supremo)└───────────────────────────────────────────┘
   └───────────┘
```

| Relação | Padrão | Justificativa |
|---|---|---|
| Marca/Operating Manual → Editorial | Conformist (upstream supremo) | Regras Invioláveis são lei. |
| Research → Editorial | Anti-Corruption Layer | Nada cru entra no agregado. |
| Editorial → Renderer | Customer/Supplier via Published Language | Renderer obrigado ao contrato. |
| Editorial → Publisher | Customer/Supplier | Publisher não reescreve. |
| Automation | Transversal (Open Host) | Orquestra sem deter decisão. |

---

## 5. Visão geral do modelo

```
                          ╔═══════════════════════════════╗
                          ║   EDIÇÃO  (Aggregate Root)     ║
                          ╟───────────────────────────────╢
                          ║  Cabeçalho · Ilustrativa ·     ║
                          ║  Disclaimer (invariante)       ║
                          ╚═══════════════╤═══════════════╝
              ┌───────────────────────────┼───────────────────────────┐
   ┌──────────▼─────────┐   ┌─────────────▼────────┐   ┌──────────────▼────────────┐
   │  SINAL DO DIA (VO) │   │  DEAL DESK (1..3)    │   │  FONTES (≥1)               │
   └────────────────────┘   └───────────┬──────────┘   └────────────────────────────┘
                              ┌──────────▼──────────┐
                              │   DEAL (entidade)    │
                              │ Conta · Veredito ·   │── ancorado em ── Pontuação TL
                              │ Breakdown? · Fonte   │── carrega ── Vigência + Nível
                              └──────────────────────┘
```

| Peça | Tipo DDD |
|---|---|
| Edição | Aggregate Root |
| Deal / Deal Desk | Entity |
| Sinal, Conta, Veredito, Pontuação TL, Fonte, Vigência, Nível, Breakdown, Disclaimer | Value Objects |
| Fecha logo | Coleção derivada |

Transações cruzam a fronteira do agregado **somente pela raiz**.

---

## 6. Entidades — oito facetas cada

Cada peça: **Responsabilidade · Objetivo · Propriedades · Relacionamentos · Lifecycle · Ownership · Versionamento · Governança.** Propriedades em **tipos de domínio** (Identidade, Texto, Razão, Enum, Timestamp, Referência).

### 6.1 EDIÇÃO (Aggregate Root)
- **Responsabilidade.** Fronteira de consistência de tudo que compõe uma publicação.
- **Objetivo.** Em ~5 min: o que mudou, por que importa, qual a conta, qual o risco.
- **Propriedades.** Número (identidade, monotônica, imutável); Data/Dia; Tempo de leitura; Sinal (1); Deal Desk (1–3); Fecha logo (0..*); Fontes (≥1); Disclaimer; Classificação Ilustrativa.
- **Relacionamentos.** Compõe 1 Sinal, 1 Deal Desk, ≥1 Fonte, 0..* Fecha logo. Referencia o Produto.
- **Lifecycle.** §8.
- **Ownership.** Editor-Chefe.
- **Versionamento.** Imutável após `Published`. Correção = errata versionada (append-only). Número nunca reusado.
- **Governança.** Mudar obrigatoriedade de propriedade = emenda a esta RFC.

### 6.2 SINAL DO DIA (VO)
Tese única. 1:1 com Edição. Imutável após `Written`. Editor-Chefe. INVARIANTE: **um só** por edição.

### 6.3 DEAL DESK (Entity de coleção)
Contém e ordena Deals; impõe cardinalidade. INVARIANTE **1 ≤ Deals ≤ 3**. INVARIANTE: **Ponto NÃO DEVE aparecer dentro do Deal Desk**. Teto de 3 = limite de atenção (promessa "5 min").

### 6.4 DEAL (Entity)
- **Propriedades.** Categoria (Enum fechado); Título; Contexto; Conta; Veredito; Pontuação TL (salvo Não confirmado); Breakdown?; Fonte.
- **Lifecycle.** `Rascunho → Conta fechada → Veredito atribuído → Fonte confirmada`.
- **Ownership.** Analista propõe; Editor-Chefe ratifica.
- **Governança.** INVARIANTE: **sem Fonte, não há Deal.** INVARIANTE: **sem Vigência → Não confirmado** (overrule §10.2).

### 6.5 CONTA FEITA (VO)
Registro reproduzível do cálculo. Linhas (chave→valor) + resultado destacado. INVARIANTE: linhas ≥1 e resultado presente; resultado derivável das linhas; faltou dado → Não confirmado.

### 6.6 VEREDITO (VO)
Vocabulário fechado ancorado à Pontuação TL.

| Rótulo | Faixa TL | Polaridade | Nota |
|---|---|---|---|
| Vale agir | 85–100 | positivo forte | ação recomendada |
| Vale olhar | 70–84 | atenção | merece análise |
| Só para casos específicos | 55–69 | neutro | condicional |
| Esperaria | 40–54 | cautela | — |
| Evitaria | 0–39 | risco | — |
| Não confirmado | sem dado | neutro | sem score |

INVARIANTE: coerente com a faixa; **nunca prometer ganho**; vocabulário **fechado**.

### 6.7 PONTUAÇÃO TL (VO)
Inteiro [0–100]. É o **selo** do produto (não o Ponto). Metodologia versionada (Operating Manual §5.2). Fora de [0–100] é inválido; ausência ⇒ Não confirmado.

### 6.8 BREAKDOWN DE SCORE (VO)
Decompõe a Pontuação nos critérios ponderados (§5.2). 0..1 por Deal. INVARIANTE: se presente, a soma ponderada **reconcilia** com a Pontuação.

### 6.9 FECHA LOGO (coleção derivada)
Itens com vigência ≤72h. Recomputada por edição. INVARIANTE: vigência ≤72h e não vencida; **proibida urgência artificial**.

### 6.10 DISCLAIMER (VO)
Frase oficial **constante e imutável**. Presente sempre que houver recomendação. Paráfrase = violação (defeito A-1).

### 6.11 FONTE (+ Nível + Vigência) (VO)
Rótulo; Referência resolúvel; Nível de autoridade (1–4); Vigência confirmada.

| Nível | Natureza | Efeito |
|---|---|---|
| 1 | Regulamento/comunicado oficial | sustenta pleno |
| 2 | Canal oficial secundário/T&C | sustenta |
| 3 | Cobertura terceirizada | sustenta com ressalva |
| 4 | Sinal social/não-oficial | não sustenta → Não confirmado |

INVARIANTE: nunca dado interno/CMI; nunca copiar; Nível 4 não sustenta veredito.

---

## 7. Tabela-mestra de invariantes

| # | INVARIANTE | Origem |
|---|---|---|
| I-1 | Sem dado interno/CMI | RI-1 |
| I-2 | Sem cópia de fonte | RI-2 |
| I-3 | Nunca prometer ganho | RI-3 |
| I-4 | Sem urgência artificial | RI-4 |
| I-5 | Falta dado → Não confirmado | RI-9 |
| I-6 | Disclaimer presente e íntegro | RI-10 |
| I-7 | Vigência ausente/vencida → Não confirmado | Manual §5.4 |
| I-8 | Veredito ⇄ faixa coerentes | Manual §5.2 |
| I-9 | Breakdown reconcilia | Manual §5.2 |
| I-10 | Conta com linhas + resultado | Método |
| I-11 | 1 ≤ Deals ≤ 3 | Promessa "5 min" |
| I-12 | Exatamente 1 Sinal | Coerência |
| I-13 | Ponto fora do Deal Desk / sem promessa | Guia do Ponto |
| I-14 | Ilustrativa ⇒ não publica como real | §11 |
| I-15 | Vocabulário de veredito fechado | DDD-001 |

Nenhuma cede a pedido pontual.

---

## 8. Lifecycle da Edição

```
IDEAÇÃO → SOURCED → CURATED → WRITTEN → [VALIDATED gate] → APPROVED (humano)
                                             │reprova            │
                                          REJECTED→Curated   → RENDERED
                                                              → PUBLISHED|SCHEDULED (guarda I-14)
                                                              → ARCHIVED (imutável; errata=append)
```

- Nenhuma transição salta `Validated`.
- `Approved` é **exclusivamente humano** (I-14).
- Monotônico após `Published`; correção só por errata versionada.

---

## 9. Os quatro contratos

### 9.1 Research Contract (ACL de entrada)
DEVE: todo fato com Nível + Vigência. NÃO DEVE: dado interno (I-1), cópia (I-2), invenção (I-5). Garante fato rastreável; Nível 4 nunca vira veredito. *(Detalhado em RFC-003.)*

### 9.2 Renderer Contract (projeção)
DEVE preservar Veredito e sua polaridade, Conta como estrutura, Disclaimer íntegro (I-6), posição do Ponto (I-13). NÃO DEVE inventar/omitir/reordenar/degradar. INVARIANTE (Fidelity): *projeção ⊆ domínio*; perda de veredito/conta/proveniência = violação. *(Detalhado em RFC-002 — pendente.)*

### 9.3 Publisher Contract (despacho)
DEVE consumir só `Approved+Rendered`; rascunho por padrão; publicação exige confirmação humana. NÃO DEVE reescrever nem publicar Ilustrativa (I-14). Garante idempotência. *(Detalhado em RFC-004.)*

### 9.4 Automation Contract (orquestração)
DEVE ser determinística; parar em I-x falho; registrar omissões. NÃO DEVE curar/julgar, pular gate, auto-publicar real. *(Detalhado em RFC-005.)*

---

## 10. Decision Trees

### 10.1 Veredito
```
Vigência ausente/vencida? → Não confirmado (I-7)
Fonte Nível 4?            → Não confirmado
Falta dado no cálculo?    → Não confirmado (I-5)
senão → mapear Pontuação → faixa → rótulo canônico (I-8)
```

### 10.2 Overrule de vigência (§5.4)
A vigência tem **precedência** sobre a Pontuação. Score 92 com vigência não confirmada ⇒ Não confirmado.

### 10.3 Publicável?
Ilustrativa? → PROIBIDO (I-14) · Disclaimer? → bloqueia · Gate ok? → bloqueia · Gatilho humano? → aguarda.

---

## 11. Matrizes

### 11.1 Ownership (RACI)
| Peça | Executa | Aprova |
|---|---|---|
| Sinal | Editor-Chefe | Editor-Chefe |
| Deal/Conta | Analista | Editor-Chefe |
| Veredito/Pontuação | Analista | **Editor-Chefe** |
| Fonte/Vigência | Analista/Research | Editor-Chefe |
| Disclaimer | Marca/Jurídico | Marca/Jurídico |
| Modelo (esta RFC) | Architecture Board | Architecture Board |

### 11.2 Cardinalidade
Edição→Sinal 1:1 · Edição→Deal Desk 1:1 · Deal Desk→Deal 1:1..3 · Deal→Conta 1:1 · Deal→Veredito 1:1 · Veredito→Pontuação 1:0..1 · Deal→Fonte 1:1 · Edição→Fonte 1:1..* · Edição→Fecha logo 1:0..*.

---

## 12. Examples & Counter-examples
- ✅ Deal com Conta que fecha, Fonte Nível 1 vigente, Pontuação 88 → "Vale agir".
- ❌ Mesma conta, Pontuação 92, vigência não confirmada → "Vale agir" viola I-7.
- ❌ Conta em prosa sem estrutura → viola Renderer Fidelity.
- ❌ "Conversão média interna" como fonte → viola I-1.
- ❌ 6 Deals e dois Sinais → viola I-11 e I-12.

---

## 13. Anti-patterns
Modelo anêmico · sinais múltiplos · veredito livre · garantia na borda · fonte órfã · overrule ignorado · cap silencioso · aprovação inferida · Ponto como selo.

---

## 14. Alternativas descartadas
- **14.1** Um modelo por canal → origem dos dois formatos rivais; descartado. Um modelo canônico + projeções vence.
- **14.2** Fatos crus no agregado → ACL no Research vence.
- **14.3** Deal Desk ilimitado → teto 1–3 vence.
- **14.4** Score contínuo livre → faixa→rótulo vence.
- **14.5** Errata por sobrescrita → append versionado vence.
- **14.6** Aprovação automatizável → gate humano vence (julgamento não é verificável por máquina).

---

## 15. Governança e versionamento

### 15.1 Versionado
Vocabulário, cardinalidades, invariantes, escala de níveis, os quatro contratos. Metodologia de score versionada à parte (Manual §5.2).

### 15.2 Semver de domínio
| Mudança | Classe |
|---|---|
| Propriedade opcional nova | MINOR |
| Novo rótulo de veredito | MAJOR |
| Afrouxar invariante | Proibido por RFC |
| Endurecer invariante | MAJOR |
| Renomear termo canônico | MAJOR |

### 15.3 Emenda
RFC de emenda → checagem de não-contradição → ratificação do Board → data de corte. Nada retroativo sobre publicadas.

### 15.4 Precedência
```
Regras Invioláveis > Operating Manual > DDD-001/002 > Blueprint
   > Architecture Review > RFC-001 > RFCs derivadas
```

---

## 16. Conformance Checklist
1 Sinal (I-12) · 1–3 Deals (I-11) com Conta/Veredito/Fonte · vigência (I-7) · Nível 4 não sustenta · breakdown reconcilia (I-9) · disclaimer íntegro (I-6) · sem promessa/urgência/CMI · Ponto fora do Deal Desk (I-13) · Ilustrativa resolvida (I-14) · vocabulário canônico (I-15).

> Nota da auditoria (RFC-005): cada item DEVE ser marcado [M] mecânico ou [H] humano.

---

## 17. Questões abertas (v1.1+)
Q-1 Weekly/Lab/Pro/Special (RFC-006) · Q-2 política de errata (RFC-008) · Q-3 tolerância de reconciliação (RFC-007) · Q-4 ciclo de vida de Fonte reutilizada · Q-5 i18n do vocabulário.

---

## Apêndice A — Invariantes ↔ Regras Invioláveis
I-1↔RI-1 · I-2↔RI-2 · I-3↔RI-3 · I-4↔RI-4 · I-5↔RI-9 · I-6↔RI-10 · I-7↔Manual §5.4 · I-8/I-9↔Manual §5.2 · I-13↔Guia do Ponto.
