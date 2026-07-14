# RFC-006 — Product Specializations
**Version 1.0 · Status: Proposed · Layer: Domain**

| Campo | Valor |
|---|---|
| Conforma-se a | RFC-001 (§2.2), Blueprint |
| **Resolve** | **F-18 / ADR-005** (namespace de numeração) |
| Precedência | … > RFC-001 > **RFC-006** |

## 1. Propósito
Formalizar as **especializações** do núcleo Edição — Daily, Weekly, Lab, Pro, Special — sem duplicar o modelo. Cada produto é o mesmo núcleo com **delta estrutural governado**. Evita o anti-padrão "um modelo por produto" (13.1/14.1).

**Princípio (Liskov editorial).** *Uma especialização PODE adicionar; NUNCA PODE enfraquecer um invariante do núcleo.*

## 2. Regra de especialização
- Toda especialização herda **todos** os invariantes I-x (RFC-001).
- Uma especialização **DEVE NÃO** remover ou relaxar qualquer invariante herdado.
- Uma especialização **PODE** adicionar entidades/invariantes próprios.
- Substituir uma Daily por uma Weekly num ponto que espera "uma Edição" **DEVE** ser seguro (nenhuma garantia perdida).

## 3. Matriz de produtos

| Produto | Cadência | Deal Desk? | TL Score? | Perene? | Disclaimer | Delta próprio |
|---|---|:--:|:--:|:--:|---|---|
| **Daily** | diária | sim (1–3) | por deal | não (efêmera) | sim | — (é o núcleo) |
| **Weekly** | semanal | consolida | **agregado** | não | sim | tese + ranking semanal; referencia Dailies |
| **Lab** | perene | **não** | **não por deal** | **sim** | condicional | conteúdo definicional/educacional; revisões, não numeração diária |
| **Pro** | periódica (B2B) | por player | **por período** | não | sim | benchmarks, sumário executivo, movimentos por player |
| **Special** | avulsa | 0–1 | opcional | não | sim | tema único, formato curto |

## 4. Namespace de numeração (resolve F-18)
- **Identidade global = (Linha de Produto, Número).** Ex.: a numeração da Daily é independente da do Pro.
- INVARIANTE: número **único e monotônico dentro da linha**; **nunca** compartilhado entre linhas.
- Referências cruzadas (Weekly → Dailies) usam a identidade **qualificada** (produto + número).

## 5. Lifecycle por especialização
- Daily/Weekly/Pro/Special: lifecycle da RFC-001 (efêmeras, imutáveis após publicar).
- **Lab (perene):** admite **revisões versionadas** do mesmo artefato ao longo do tempo (não novas "edições numeradas"). A imutabilidade aplica-se **por revisão**; a peça evolui por versão, com histórico.

## 6. Value objects próprios (exemplos)
- Weekly: **Ranking semanal** (ordenação de movimentos), **Tese da semana** (um Sinal ampliado).
- Pro: **Movimento por player**, **Benchmark de período**, **Score de período**.
- Lab: **Definição**, **Problema**, ausência de veredito acionável (é educacional, não recomendação — logo disclaimer é *condicional* à presença de recomendação, coerente com C-3/F-03).

## 7. Invariantes (S-x)
S-1 herda todos I-x · S-2 não enfraquece invariante herdado · S-3 identidade = (linha, número) · S-4 numeração por linha, nunca cruzada · S-5 Lab evolui por revisão versionada.

## 8. Examples / Counter-examples
- ✅ Weekly agrega vereditos de Dailies referenciando-as por identidade qualificada.
- ❌ Lab publicado sem disclaimer **quando contém recomendação** → viola herança de I-6.
- ❌ Pro reaproveitando número da Daily → viola S-4.
- ❌ Special "flexibilizando" o teto de deals do núcleo → viola S-2.

## 9. Anti-patterns
Modelo rival por produto (o defeito histórico dos dois renderers) · numeração global colidente · Lab tratado como efêmero (perde histórico).

## 10. Alternativas descartadas
- *Cinco modelos independentes* → drift garantido; recusado.
- *Numeração global única* → colisão semântica entre produtos; recusado. Namespace por linha vence.

## 11. Dependências
Cada produto merece uma RFC-006-derivada (RFC-006.1 Weekly, .2 Lab, .3 Pro, .4 Special) detalhando seu delta. Interage com RFC-007 (score agregado/por período).
