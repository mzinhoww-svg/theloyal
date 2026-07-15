# RFC-004 — Publisher & Dispatch Contract
**Version 1.0 · Status: Proposed · Layer: Domain (fronteira de saída)**

| Campo | Valor |
|---|---|
| Conforma-se a | RFC-001 (§9.3), DDD-002, Architecture Review |
| Resolve | dessincronização de ledger (achado A-2), reforça I-14 |
| Precedência | … > RFC-001 > **RFC-004** |

## 1. Propósito
Formalizar o **Despacho**: o ato de mover uma Edição `Approved + Rendered` para o mundo externo. Publicar é **irreversível e externo**; portanto o contrato existe para garantir **gatilho humano**, **idempotência** e **não-reescrita**. Descrito em domínio — sem nomear plataforma, protocolo ou representação.

**Princípio.** *O Publisher transporta uma decisão já tomada; nunca a toma.*

## 2. Ubiquitous Language (adições)
| Termo | Definição |
|---|---|
| **Despacho** | O ato de tornar uma Edição externamente existente (rascunho, agendada ou publicada). |
| **Impressão digital de conteúdo** | Identidade lógica do que será despachado (número + canal + conteúdo aprovado). |
| **Ledger de Despacho** | Registro append-only, **autoritativo**, do que foi despachado e seu estado externo. |
| **Armar** | Ato humano explícito que autoriza um Despacho irreversível. |
| **Canal** | Superfície de saída abstrata (o domínio não nomeia qual). |

## 3. Entidade: **DESPACHO**
- **Responsabilidade.** Executar a saída de uma Edição sem alterá-la.
- **Objetivo.** Garantir que o que sai é exatamente o que foi aprovado, uma única vez.
- **Propriedades.** Identidade da Edição; Canal; Impressão digital; Estado; Identidade externa resultante; Marca temporal; Autoria do "Armar".
- **Relacionamentos.** 1 Edição → N Despachos (um por Canal), cada um único.
- **Lifecycle.** `Preparado → Rascunho → (Teste) → Armado → {Publicado | Agendado} → Registrado`; falha → `Erro (retryável)`.
- **Ownership.** Papel Publisher executa; **Editor-Chefe arma**.
- **Versionamento.** O Despacho é imutável após `Publicado`; correção = Errata (RFC-008).
- **Governança.** Ver invariantes P-x.

## 4. A fronteira de irreversibilidade
```
 Preparado → Rascunho → Teste → [ ARMAR (humano) ] → Publicado/Agendado
 └──────── reversível ────────┘   │   └────── irreversível ──────┘
                                gatilho humano explícito, por Despacho
```

## 5. Idempotência (como conceito de domínio)
- **Identidade lógica** de um Despacho = (número da Edição, Canal, Impressão digital).
- INVARIANTE: uma mesma identidade lógica **despacha no máximo uma vez**.
- **Fonte de verdade = identidade externa registrada no Ledger** (resolve a dessincronização: o Ledger reflete o mundo externo, não uma cópia local otimista).
- Reexecução com mesma impressão digital = **no-op**; com impressão diferente sob mesma Edição/Canal = **atualização da peça existente**, nunca duplicação.

## 6. Contrato
| Obrigações (DEVE) | Proibições (NÃO DEVE) | Garantias |
|---|---|---|
| Consumir só Edição `Approved + Rendered`. | Reescrever/reordenar conteúdo. | Idempotência por identidade lógica. |
| Rascunho por padrão. | Despachar Ilustrativa (I-14). | Rastreabilidade append-only. |
| Publicação/agendamento exige **Armar** humano. | Inferir aprovação de contexto anterior. | Reversível até Armar; irreversível depois. |
| Registrar identidade externa no Ledger. | Alterar Veredito/Conta/Score. | Nenhum duplo-disparo. |

## 7. Política de retentativa (domínio)
Retentativa **DEVE** ser idempotente e limitada; um `Erro` nunca deixa o Despacho em estado ambíguo (é `Erro` explícito, retryável). "Cortesia de despacho" (respeitar limites do Canal) é obrigação, mas **abstrata** — o domínio não conhece números de rate limit.

## 8. Invariantes (P-x)
P-1 gatilho humano por Despacho irreversível · P-2 idempotência por identidade lógica · P-3 não-reescrita · P-4 não despachar Ilustrativa · P-5 Ledger é a verdade externa · P-6 imutável após publicado.

## 9. Examples / Counter-examples
- ✅ Rascunho criado; humano revisa; Arma; publica; Ledger grava identidade externa.
- ❌ Automação publica ao passar no gate, sem Armar → viola P-1.
- ❌ Reexecução gera segunda peça sob o mesmo número → viola P-2.
- ❌ Ledger local diz "publicado" mas o mundo externo não tem a peça → viola P-5 (verdade é externa).

## 10. Anti-patterns
Aprovação inferida · duplo-disparo por retry ingênuo · ledger otimista desalinhado do mundo · publisher que "melhora" o texto.

## 11. Alternativas descartadas
- *Publicação automática pós-gate* → remove o freio humano na ação irreversível; recusada (RFC-001 §14.6).
- *Idempotência por número apenas* → impede atualização legítima de rascunho; identidade lógica (número+canal+impressão) vence.

## 12. Dependências
Depende de RFC-005 (o gate precede o Despacho) e RFC-001 (estados). Interage com RFC-008 (correção pós-publicação).
