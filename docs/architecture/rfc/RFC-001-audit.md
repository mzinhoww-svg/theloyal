# Auditoria — RFC-001 Editorial Content Model v1.0

**Revisor:** Principal Architect (independente) · **Disposição:** *Conditionally Approved — NÃO FINAL até resolver os P0.* · **Score global ≈ 81/100.**

A RFC é acima da média em intenção de domínio e rigor de invariantes, mas tem contradições internas reais, um vazamento de camada que ela própria proíbe, e três invariantes hoje não-testáveis. Nenhum é fatal; todos bloqueiam "FINAL".

## 1. Catálogo de achados

Severidade: **P0 = Blocker** · **P1 = Major** · **P2 = Minor**.

### P0 — Blockers
| ID | Categoria | Achado | Onde |
|---|---|---|---|
| **F-01** | Contradição / camada | Vazamento de apresentação que a própria RFC proíbe: §2.3 proíbe mencionar apresentação; §6.6 usa "fill amarelo, texto escuro" e institui "semântica de cor" como propriedade de domínio. Domínio deve possuir **polaridade/severidade**; o mapa para cor é da marca. | §2.3 vs §6.6/§9.2 |
| **F-02** | Contradição / testabilidade | "Gate determinístico" super-afirmado. I-2 (cópia), I-3 (promessa), I-13 (voz do Ponto) **não** são verificáveis por máquina. | §8, §9.4 |
| **F-03** | Ambiguidade | Obrigatoriedade do Disclaimer inconsistente: §6.1 "quando há recomendação" vs I-6/§16 incondicional. Falta definir "recomendação". | §6.1 vs §7/§16 |
| **F-04** | Conceito mal definido | Vocabulário de Categoria alegado "fechado" mas nunca enumerado. | §6.4 |
| **F-05** | Testabilidade | I-9/I-10 exigem tolerância numérica, que §17 Q-3 deixa aberta → gate não roda. | §6.5/§6.8 vs §17 |
| **F-06** | Redundância / modelagem | Fonte modelada em dois lugares (Deal→Fonte 1:1 e Edição→Fontes 1:1..*) sem reconciliação. | §6.4/§6.11/§11.2 |

### P1 — Major
| ID | Achado | Onde |
|---|---|---|
| F-07 | Published Language = modelo interno inteiro → acopla consumidores a mudanças internas. | §4.2 |
| F-08 | `Ilustrativa` como propriedade é guard de publicação dentro do domínio (deveria ser lifecycle). | §6.1 |
| F-09 | Fecha logo "derivada" e "curada" ao mesmo tempo (contradição automação vs humano). | §6.9 |
| F-10 | §6.1 fixa mecanismo de errata que §17 Q-2 diz estar aberto. | §6.1 vs §17 |
| F-11 | Constantes mágicas (3, 72h, 5min, 0–100, níveis) sem governança. | §6.3/§6.9/§6.11 |
| F-12 | Circularidade: onde a Ubiquitous Language realmente vive (RFC vs DDD-001)? | §0 vs §15.4 |
| F-13 | Editor-Chefe é gargalo único e ponto de falha (bus-factor). | §11.1 |
| F-14 | Falta value object **Unidade** (produto é sobre CPM/VPM). | §6.5 |

### P2 — Minor
F-15 invariantes repetidos em 5 lugares (DRY) · F-16 mecanismo da "ressalva" do Nível 3 indefinido · F-17 Veredito quase função de (Score, overrules) não declarado · F-18 namespace de numeração entre produtos · F-19 sem caminho de migração de artefatos demo/legado · F-20 tipos "Money"/"Razão" indefinidos.

## 2. Avaliação por capítulo (síntese)
Cabeça (0–5) e cauda (10–14) sólidas. Fraqueza concentrada no **Cap. 6** (entidades) e nos **Contratos (Cap. 9)** por falta de oráculos de teste. Cap. 10 (decision trees) é o mais testável.

## 3. RFC Score (0–100)
| Dimensão | Score |
|---|---|
| Domínio | 88 |
| DDD | 76 |
| Arquitetura | 80 |
| Editorial | 91 |
| Escalabilidade | 69 |
| Governança | 79 |
| Legibilidade | 85 |
| Qualidade | 83 |
| Longevidade | 82 |
| Consistência | 72 |
| **Global ponderado** | **≈ 81** → "Conditionally Approved" |

## 4. Refactor (lista, sem reescrever)

**P0 — antes de FINAL:**
1. Remover cor do domínio → Polaridade/Severidade (F-01).
2. Bifurcar gate em Mecânico [M] / Julgamento [H]; anotar §16 (F-02).
3. Definir "recomendação" + regra única de Disclaimer (F-03).
4. Enumerar/reclassificar vocabulário de Categoria (F-04).
5. Fixar tolerância de reconciliação (F-05).
6. Reconciliar Fonte (Deal ⊂ coleção da Edição) (F-06).

**P1:** 7 Interchange Language distinta do agregado (F-07) · 8 `Ilustrativa` → lifecycle (F-08) · 9 Fecha logo derivada+confirmada (F-09) · 10 alinhar §6.1↔§17 errata (F-10) · 11 governança de constantes (F-11) · 12 fonte-de-verdade do vocabulário (F-12) · 13 papéis editoriais + delegação (F-13) · 14 value object Unidade (F-14).

**P2:** 15 DRY dos invariantes · 16 mecanismo da ressalva Nível 3 · 17 declarar Veredito=f(Score,overrules) · 18 namespace de numeração · 19 capítulo de migração · 20 taxonomia de tipos.

## 5. Versão final

### 5.1 Disposição
RFC-001 v1.0 **APROVADA CONDICIONALMENTE**. Torna-se **v1.0 FINAL** após os 6 P0 (C-1..C-6). P1 = condições de v1.1. P2 = higiene.

### 5.2 Change list (para FINAL)
| # | Mudança | Corrige | Classe |
|---|---|---|---|
| C-1 | "semântica de cor" → Polaridade/Severidade | F-01 | MINOR |
| C-2 | Bifurcar gate [M]/[H] | F-02 | MINOR |
| C-3 | Definir "recomendação" + Disclaimer | F-03 | MINOR |
| C-4 | Enumerar vocabulário de Categoria | F-04 | MAJOR |
| C-5 | Fixar tolerância de reconciliação | F-05 | MINOR |
| C-6 | Reconciliar Fonte | F-06 | MINOR |

### 5.3 ADRs necessárias
ADR-001 cor pertence à marca · ADR-002 gate em dois níveis · ADR-003 Interchange Language · ADR-004 Ilustrativa é lifecycle · ADR-005 namespace por produto · ADR-006 governança de constantes · ADR-007 fonte-de-verdade da UL · ADR-008 Unidade como VO.

### 5.4 RFCs dependentes
RFC-002 Renderer Projection · RFC-003 Research/Provenance · RFC-004 Publisher/Dispatch · RFC-005 Automation/Gating · RFC-006 Product Specializations · RFC-007 Scoring Methodology · RFC-008 Errata.

### 5.5 Futuras evoluções
Papéis editoriais + delegação (F-13) · Interchange Language (F-07) · migração de legado (F-19) · Unidade e álgebra de unidades (F-14) · séries/referências cruzadas · i18n (Q-5).

## 6. Critério dos 10 anos

**"Eu aprovaria esta arquitetura para um produto que deverá existir durante dez anos?"**

**Sim — condicionada aos seis P0.** O núcleo está certo e é raro: **a garantia mora no domínio, não na apresentação** — o que sobrevive a trocas de stack, plataforma, time e moda. O overrule de vigência, o teto de 3 deals, o vocabulário fechado e o guard contra publicar demo são os freios que impedem a erosão lenta que mata produtos editoriais.

Ainda não é FINAL porque longevidade morre por dois mecanismos aos quais a RFC está exposta: **(1)** contradição interna vira licença para interpretar (cada ambiguidade será resolvida de N formas ao longo de uma década → drift, o anti-padrão 13.4 que ela própria diagnostica); **(2)** invariante não-testável é invariante que não existe (F-02/F-05: um produto de credibilidade que *acredita* ter gate mas não tem publica o erro que destrói a marca no ano 3).

A distância entre 81 e FINAL não é reescrita — são seis correções cirúrgicas. Feitas, esta é uma das poucas RFCs que eu assinaria para durar uma década.

**Recomendação:** *Conditionally Approved · promover a v1.0 FINAL mediante C-1..C-6 · abrir ADR-001..008 · enfileirar RFC-002..008.*
