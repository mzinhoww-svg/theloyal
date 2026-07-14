# RFC-008 — Errata & Correction Policy
**Version 1.0 · Status: Proposed · Layer: Domain**

| Campo | Valor |
|---|---|
| Conforma-se a | RFC-001 (§6.1, §15.3), RFC-004 |
| **Resolve** | **F-10 / Q-2** (mecanismo de errata que estava contraditório) |
| Precedência | … > RFC-001 > **RFC-008** |

## 1. Propósito
Formalizar a **correção pós-publicação**. A RFC-001 afirmava um mecanismo de errata que o §17 dizia estar em aberto (F-10). Esta RFC fecha a contradição: define a Errata como entidade própria, **append-only**, que **referencia** — nunca sobrescreve — a Edição publicada.

**Princípio.** *Uma correção é um ativo de credibilidade, não um constrangimento a esconder. O histórico é a prova do método.*

## 2. Ubiquitous Language (adições)
| Termo | Definição |
|---|---|
| **Errata** | Artefato de correção, com identidade própria, ligado a uma Edição publicada. |
| **Retratação** | Errata que invalida um veredito/afirmação inteiro. |
| **Esclarecimento** | Errata que precisa/ajusta sem invalidar. |
| **Janela de correção** | Período em que a correção ainda é relevante ao leitor. |
| **Divulgação** | Grau de sinalização da correção ao leitor. |

## 3. Entidade: **ERRATA**
- **Responsabilidade.** Corrigir o registro público sem violar a imutabilidade da Edição.
- **Objetivo.** Preservar a confiança tornando o erro **visível e rastreável**.
- **Propriedades.** Identidade própria; referência à Edição-mãe (identidade qualificada, RFC-006); Tipo (Correção factual | Retratação | Esclarecimento); Severidade; Divulgação; Marca temporal; Proveniência re-verificada (RFC-003).
- **Relacionamentos.** N Erratas → 1 Edição-mãe; ordenadas no tempo (append-only).
- **Lifecycle.** `Detectada → Avaliada → Classificada → Emitida (append) → Vinculada`.
- **Ownership.** **Editor-Chefe** emite; Research re-verifica os fatos (RFC-003).
- **Versionamento.** A Errata é imutável após emitida; nova correção = nova Errata.
- **Governança.** Ver invariantes E-x.

## 4. Regra fundamental (resolve F-10)
- INVARIANTE E-1: a Edição publicada é **imutável**; a correção **NÃO DEVE** editá-la.
- INVARIANTE E-2: a Errata é **append-only** e **referencia** a Edição-mãe por identidade qualificada.
- INVARIANTE E-3: o número da Edição **nunca** é reusado; a Errata tem identidade própria.

## 5. Classificação → divulgação (decision tree)
```
Erro detectado
 ├─ inverte o veredito / conta? ─ sim ▶ RETRATAÇÃO — divulgação MÁXIMA (destaque)
 ├─ altera número/fato material? ─ sim ▶ CORREÇÃO FACTUAL — divulgação sinalizada
 ├─ ambiguidade/typo sem mudar sentido? ─ sim ▶ ESCLARECIMENTO — divulgação discreta
 └─ dentro da janela de correção? ─ não ▶ registra histórico, sinaliza contexto
```
- INVARIANTE E-4: **quanto maior o impacto no julgamento, maior a divulgação.** Nunca esconder uma retratação.

## 6. Interação com o Publisher (RFC-004)
- Emitir uma Errata **DEVE** passar pelo gate (RFC-005) e pelo Armar humano (RFC-004) como qualquer Despacho — correções não são exceção ao rigor.
- A identidade externa da Errata é registrada no Ledger, vinculada à da Edição-mãe.

## 7. Invariantes (E-x)
E-1 Edição imutável · E-2 Errata append-only, referencia a mãe · E-3 número nunca reusado; Errata tem identidade própria · E-4 divulgação proporcional ao impacto · E-5 fatos re-verificados (RFC-003) · E-6 Errata também passa por gate + Armar.

## 8. Examples / Counter-examples
- ✅ Conta com erro material → Correção factual emitida, vinculada, sinalizada ao leitor.
- ✅ Veredito "Vale agir" baseado em vigência que se provou falsa → **Retratação** com divulgação máxima.
- ❌ Editar a edição publicada para "consertar" o número → viola E-1 (destrói auditabilidade).
- ❌ Reusar o número da edição para republicar corrigido → viola E-3.
- ❌ Esconder uma retratação como "esclarecimento discreto" → viola E-4.

## 9. Anti-patterns
Correção por sobrescrita · retratação silenciosa · reuso de número · correção que pula o gate/Armar · errata sem re-verificação de fonte.

## 10. Alternativas descartadas
- *Editar a peça publicada* (RFC-001 §14.5) → destrói confiança; recusada.
- *Errata como campo dentro da Edição* → confunde imutável com mutável; entidade própria append-only vence.

## 11. Dependências
Depende de RFC-004 (despacho), RFC-005 (gate), RFC-003 (re-verificação), RFC-006 (identidade qualificada). Janela de correção e limiares de divulgação → constantes governadas (registro em RFC-005 §5).
