# RFC-001 — Blueprint (esqueleto, não conteúdo)

**Version 0.1 — Blueprint**
**Status:** Estrutura aprovada para preencher · *este documento modela a RFC-001; não a escreve.*
**Precede:** RFC-001 (o conteúdo).
**Sucede:** DDD-001 (Discovery) e DDD-002 (Decision).

> **O que este documento é.** O molde da RFC-001: capítulos, seções, dependências, fluxos, entidades, diagramas, objetivos, critérios de aceite, matriz de decisões e de dependências, e roadmap. Cada seção traz apenas seu **propósito** e seus **critérios de pronto** — nunca a especificação em si.
>
> **O que este documento NÃO é.** Não define schema, não desenha arquitetura, não escreve regra de validação, não modela entidade em detalhe, não produz o diagrama final. Onde a RFC vai decidir o *como*, aqui há apenas um **slot** marcado `⟦preencher na RFC⟧`.
>
> **Regra de ouro.** A RFC-001 **implementa** o DDD-002; **não reabre** nenhuma decisão dele. Todo capítulo abaixo rastreia para um ou mais Decision Records (DR-*) / Rulings (R-*). Um capítulo sem rastreio é ruído e deve ser cortado.

---

## Sumário do blueprint

- **§A** — Objetivos da RFC-001
- **§B** — Mapa de Capítulos (esqueleto TOC + propósito de cada seção)
- **§C** — Entidades a modelar (enumeração, não modelagem)
- **§D** — Fluxos a especificar
- **§E** — Diagramas a produzir (tipo + escopo, não o desenho final)
- **§F** — Matriz de Decisões → Seção (rastreabilidade DDD-002 → RFC)
- **§G** — Matriz de Dependências entre capítulos
- **§H** — Critérios de Aceite (por capítulo + globais)
- **§I** — Roadmap de implementação (ondas pós-aprovação)
- **§J** — Placeholders / TBD que a RFC deve fechar

---

## §A — Objetivos da RFC-001

> Metas que a RFC deve atingir. Derivadas do DDD-002. Cada objetivo é verificável (ver §H).

- **O1.** Especificar **um** modelo canônico de Edição (implementa DR-01, R-AGG, R-01).
- **O2.** Definir o **contrato de dados único** (schema) e a linguagem ubíqua de campos (DR-03, DR-05, DR-08, DR-10, DR-13, DR-14).
- **O3.** Definir a **fonte única do shared kernel** (tokens, veredito+faixas, disclaimer, fórmulas) e como as superfícies derivam dela (DR-07, DR-11, DR-12).
- **O4.** Especificar o **pipeline único** de comandos e seus gates (DR-02, DR-06, DR-09, DR-11, DR-17, DR-25).
- **O5.** Especificar **renderers/canais** e o **publisher** como projeções/transporte puros (R-03..R-07, R-10, DR-22, DR-23).
- **O6.** Especificar o **ciclo de vida da Edição** (estados, imutabilidade, errata) e do **conteúdo `illustrative`** (DR-15, DR-16, DR-17).
- **O7.** Especificar a **assinatura real** e as **superfícies web navegáveis** (DR-20, DR-24).
- **O8.** Delimitar **escopo de produto v1** (Daily + Pro) e a fronteira produto↔canal (DR-19, DR-19b, DR-21).
- **O9.** Definir o **plano de migração** dos artefatos legados para o modelo canônico, com custo de retrocompatibilidade ≈ 0 (premissa DDD-002).
- **O10.** Garantir que **nenhuma regra inviolável** do CLAUDE.md é enfraquecida (gate transversal).

---

## §B — Mapa de Capítulos (esqueleto)

> Cada seção lista **Propósito** (o que vai conter) e **Rastreio** (DR/R que implementa). Conteúdo = `⟦preencher na RFC⟧`.

### Cap. 0 — Front matter
- 0.1 Metadados, status, versão · **Propósito:** identificação. · **Rastreio:** —
- 0.2 Referências normativas (DDD-001, DDD-002, CLAUDE.md) · **Propósito:** ancorar a hierarquia de verdade. · **Rastreio:** DDD-002 Parte IV
- 0.3 Convenções e ponteiro de glossário · **Propósito:** termos = glossário DDD-001 §3 + DDD-002. · **Rastreio:** DR-03

### Cap. 1 — Objetivo e Escopo
- 1.1 Objetivo da RFC · **Propósito:** o que a RFC entrega. · **Rastreio:** §A
- 1.2 Escopo incluído / excluído · **Propósito:** fixar bordas (v1 = Daily+Pro). · **Rastreio:** DR-19b, DR-18, DR-21
- 1.3 Premissas (não-produção) · **Propósito:** justificar migração barata. · **Rastreio:** DDD-002 Premissa

### Cap. 2 — Modelo de Domínio
- 2.1 Agregado raiz: Edição · **Propósito:** fronteira de consistência e invariantes. · **Rastreio:** R-AGG, R-01
- 2.2 Entidades internas (Deal, Fecha logo, Fonte) · **Propósito:** identidade e ciclo dentro do agregado. · **Rastreio:** R-AGG, DR-01
- 2.3 Value objects (Conta feita, Veredito, TL Score, Vigência) · **Propósito:** objetos sem identidade própria. · **Rastreio:** DR-06, DR-09, DR-10
- 2.4 Agregado ProReport · **Propósito:** agregado separado, id por período. · **Rastreio:** R-AGG, DR-14, DR-19
- 2.5 Agregado externo Reader · **Propósito:** referência por identidade, sem PII local. · **Rastreio:** R-08, DR-18
- 2.6 Invariantes do agregado · **Propósito:** lista das regras que o agregado garante. · **Rastreio:** DR-06, DR-09, DR-11

### Cap. 3 — Linguagem Ubíqua e Contrato de Dados
- 3.1 Vocabulário oficial (pt-BR) · **Propósito:** termos canônicos dos campos. · **Rastreio:** DR-03, DR-14
- 3.2 Taxonomia de veredito e faixas · **Propósito:** 6 valores + faixas + cores. · **Rastreio:** DR-05, DR-06, DR-07
- 3.3 Critérios e pesos do TL Score · **Propósito:** os 8 critérios e a soma 100. · **Rastreio:** DR-08
- 3.4 Schema canônico da Edição · **Propósito:** contrato único (draft/keys). · **Rastreio:** DR-01, DR-10, DR-13
- 3.5 Schema do ProReport · **Propósito:** contrato do relatório. · **Rastreio:** DR-14, DR-19

### Cap. 4 — Shared Kernel
- 4.1 Fonte única (tokens, veredito, disclaimer, fórmulas) · **Propósito:** onde vive o kernel. · **Rastreio:** DR-12
- 4.2 Derivação para superfícies (config, renderer, QA) · **Propósito:** como cada superfície consome o kernel. · **Rastreio:** DR-07, DR-11, DR-12
- 4.3 Fórmulas auditáveis (CPM/CPM final/VPM/preço implícito/spread/elegibilidade) · **Propósito:** definição única e testável. · **Rastreio:** R-CORE, DR-12

### Cap. 5 — Pipeline Editorial
- 5.1 Etapas e comandos (validate→render→publish→beehiiv; edition) · **Propósito:** superfície única de comandos. · **Rastreio:** DR-02
- 5.2 Gate de QA e severidades · **Propósito:** o que bloqueia vs avisa. · **Rastreio:** DR-06, DR-09, DR-11, DR-25
- 5.3 Handoff Research→Edição→QA→Publicação · **Propósito:** papéis e limites (Cowork só JSON). · **Rastreio:** DDD-001 Cap.4/5, R-05

### Cap. 6 — Renderers e Canais
- 6.1 Renderer como projeção pura · **Propósito:** contrato determinístico Conteúdo→Canal. · **Rastreio:** R-04, R-10
- 6.2 Canal e-mail (email-safe) · **Propósito:** invariantes de e-mail. · **Rastreio:** R-03, R-10
- 6.3 Canal web (arquivo + leitura) · **Propósito:** SSG das projeções. · **Rastreio:** R-07, DR-16, DR-20
- 6.4 Canal plain text · **Propósito:** fallback. · **Rastreio:** R-04
- 6.5 Componentes vs domínio · **Propósito:** fronteira UI↔domínio. · **Rastreio:** R-11, R-12

### Cap. 7 — Publisher e Distribuição
- 7.1 Publisher como transporte · **Propósito:** transporta, não edita. · **Rastreio:** R-05, DR-22
- 7.2 Idempotência (content-hash), modos, ledger · **Propósito:** ratificar comportamento. · **Rastreio:** DR-22
- 7.3 Gates de dispatch (QA + illustrative + --force) · **Propósito:** o que nunca pode vazar. · **Rastreio:** DR-17, DR-23
- 7.4 Beehiiv como canal substituível · **Propósito:** isolar o SaaS externo. · **Rastreio:** R-06

### Cap. 8 — Ciclo de Vida da Edição
- 8.1 Estados: Rascunho→Validada→Publicada→(Errata) · **Propósito:** máquina de estados. · **Rastreio:** DR-15
- 8.2 Imutabilidade pós-publicação e Errata versionada · **Propósito:** regra de correção. · **Rastreio:** DR-15
- 8.3 Permanência e vigência expirada · **Propósito:** edição não arquiva; oferta expira. · **Rastreio:** DR-16
- 8.4 Identidade e numeração por produto · **Propósito:** id `(produto, número)`. · **Rastreio:** R-01, DDD-001 C-7

### Cap. 9 — Aquisição e Superfícies Web
- 9.1 Assinatura real (form→rota; mock server-side) · **Propósito:** fim do mock client. · **Rastreio:** DR-24
- 9.2 Landing e navegação para `/edicao` e `/pro` · **Propósito:** superfícies navegáveis. · **Rastreio:** DR-20
- 9.3 Acessibilidade como gate (contraste) · **Propósito:** AA bloqueante. · **Rastreio:** DR-25

### Cap. 10 — Escopo de Produto
- 10.1 Produtos v1 (Daily, Pro) · **Propósito:** o que existe. · **Rastreio:** DR-19b
- 10.2 Produto vs Canal (taxonomia) · **Propósito:** separação oficial. · **Rastreio:** DR-19
- 10.3 Roadmap de produto (Weekly, Lab, Special) · **Propósito:** futuros sem contrato. · **Rastreio:** DR-19b
- 10.4 Analytics: Market vs Engagement · **Propósito:** fronteira de domínio. · **Rastreio:** DR-21

### Cap. 11 — Migração e Retrocompatibilidade
- 11.1 Inventário do legado (2 modelos, 2 pipelines, kernel triplo) · **Propósito:** o que converge. · **Rastreio:** DR-01, DR-02, DR-12
- 11.2 Plano de convergência · **Propósito:** ordem e passos. · **Rastreio:** §I
- 11.3 Custo e risco (≈0 produção) · **Propósito:** justificar segurança. · **Rastreio:** DDD-002 Premissa

### Cap. 12 — Critérios de Aceite e Rastreabilidade
- 12.1 Critérios por capítulo · **Propósito:** definição de pronto. · **Rastreio:** §H
- 12.2 Matriz de rastreabilidade DR→Seção · **Propósito:** cobertura total. · **Rastreio:** §F
- 12.3 Gate de regras invioláveis · **Propósito:** nada afrouxado. · **Rastreio:** O10

### Apêndices
- Ap. A — Glossário normativo (ponteiro) · Ap. B — Diagramas · Ap. C — Exemplos convertidos (edições Nº 27/28/41 → modelo canônico, marcados illustrative)

---

## §C — Entidades a modelar (enumeração, não modelagem)

> Apenas a lista e a classificação. **A modelagem detalhada é conteúdo da RFC (Cap. 2/3).** `⟦atributos/relações = preencher na RFC⟧`.

**Agregado raiz**
- Edição (Daily)

**Entidades internas à Edição**
- Deal (Oportunidade)
- Fecha logo (item ≤72h)
- Fonte

**Value objects**
- Conta feita (linhas + total + nota)
- Veredito (6 valores banded)
- TL Score (+ scoreBreakdown de 8 critérios)
- Vigência (janela ISO)
- Sinal do dia
- Disclaimer (constante do kernel)

**Agregado separado**
- ProReport (id por período) — com sub-objetos: Benchmark, Player+Direção, MatrixRow, Alerta, Watch

**Agregado externo**
- Reader (por identidade; fora do domínio v1)

**Conceitos de suporte (não-entidades de domínio)**
- Canal, Renderer, Publisher, Componente, Layout, Ledger de dispatch, Content-hash

---

## §D — Fluxos a especificar

> A RFC deve especificar cada fluxo (atores, passos, gates, artefatos). Aqui só o **inventário**.

- **F1 — Produção editorial:** Pesquisa → Validação de vigência → Cálculo → Curadoria/TL Score → Edição (JSON) → QA → Render → Revisão/PR → Publicação. `⟦detalhar na RFC⟧`
- **F2 — Pipeline técnico:** `validate → render → publish → beehiiv` (e `edition` agregando). `⟦detalhar⟧`
- **F3 — Ciclo de vida da Edição:** Rascunho → Validada → Publicada → (Errata). `⟦detalhar⟧`
- **F4 — Dispatch:** artefato renderizado → gates (QA, illustrative, hash) → mock/dry-run/live → ledger. `⟦detalhar⟧`
- **F5 — Assinatura:** visitante → form → rota real → canal (Beehiiv/mock server-side). `⟦detalhar⟧`
- **F6 — Publicação web:** Conteúdo → SSG → `/edicao`, `/edicao/[n]`, `/pro`, `/pro/[periodo]`. `⟦detalhar⟧`
- **F7 — Fluxo Pro:** agregação de vereditos/métricas → síntese → QA Pro → render (web/e-mail/PDF). `⟦detalhar⟧`
- **F8 — Errata:** correção pós-publicação → nova versão datada ou nova Edição referenciada. `⟦detalhar⟧`

---

## §E — Diagramas a produzir (tipo + escopo)

> Lista dos diagramas que a RFC deve conter. **Só o escopo/nós previstos — o desenho final é conteúdo da RFC.**

- **DIA-1 — Mapa de Contextos (context map):** os 8 bounded contexts do DDD-001 com as relações pós-decisão (kernel único). *Tipo:* context map. `⟦desenhar⟧`
- **DIA-2 — Agregado Edição:** raiz + entidades + value objects + fronteira. *Tipo:* diagrama de agregado. `⟦desenhar⟧`
- **DIA-3 — Máquina de estados da Edição:** Rascunho/Validada/Publicada/Errata + transições e gates. *Tipo:* state machine. `⟦desenhar⟧`
- **DIA-4 — Pipeline:** etapas, comandos, artefatos e pontos de gate. *Tipo:* fluxo de pipeline. `⟦desenhar⟧`
- **DIA-5 — Conteúdo → Canais (fan-out):** uma Edição projetada por N renderers/canais. *Tipo:* fan-out. `⟦desenhar⟧`
- **DIA-6 — Sequência de dispatch:** Publisher × gates × Beehiiv × ledger (mock/live). *Tipo:* sequência. `⟦desenhar⟧`
- **DIA-7 — Shared kernel e derivação:** fonte única → config/renderer/QA. *Tipo:* dependência. `⟦desenhar⟧`
- **DIA-8 — Fronteira produto↔canal:** produtos (linhas) × canais (superfícies). *Tipo:* matriz/grade. `⟦desenhar⟧`

---

## §F — Matriz de Decisões → Seção (rastreabilidade)

> Toda decisão do DDD-002 deve ter ≥1 seção da RFC que a implementa. Cobertura completa é critério de aceite (§H, AC-Global-2).

| Decisão (DDD-002) | Implementada em (RFC §) |
|---|---|
| R-CORE (Core domain) | 1.1, 4.3 |
| R-AGG (Agregado raiz) | 2.1, 2.4, 2.5 |
| R-01..R-12 (definições) | 2.x, 3.x, 6.x, 7.x |
| DR-01 (modelo único) | 2.1–2.3, 3.4, 11.1 |
| DR-02 (pipeline único) | 5.1, 11.1 |
| DR-03 (pt-BR) | 0.3, 3.1 |
| DR-04 (marca The Loyalty) | 11.1 (limpeza) |
| DR-05 (veredito 6) | 3.2 |
| DR-06 (veredito↔TL Score) | 2.6, 3.2, 5.2 |
| DR-07 (vale-olhar azul) | 3.2, 4.2 |
| DR-08 (8 critérios) | 3.3 |
| DR-09 (vigência erro) | 2.6, 5.2 |
| DR-10 (conta feita) | 2.3, 3.4 |
| DR-11 (disclaimer exato) | 4.1, 5.2 |
| DR-12 (shared kernel) | 4.1, 4.2 |
| DR-13 (schema único) | 3.4, 3.5 |
| DR-14 (signal/direção) | 2.4, 3.1, 3.5 |
| DR-15 (imutabilidade/errata) | 8.1, 8.2, F8 |
| DR-16 (permanência/vigência) | 8.3, 6.3 |
| DR-17 (illustrative gate) | 7.3 |
| DR-18 (leitor externo) | 2.5, 1.2 |
| DR-19 (produto↔canal) | 10.2 |
| DR-19b (escopo v1) | 1.2, 10.1, 10.3 |
| DR-20 (rotas navegáveis) | 9.2, 6.3 |
| DR-21 (analytics 2 conceitos) | 10.4 |
| DR-22 (publisher ratificado) | 7.1, 7.2 |
| DR-23 (--force) | 7.3 |
| DR-24 (assinatura real) | 9.1 |
| DR-25 (contraste AA) | 5.2, 9.3 |

---

## §G — Matriz de Dependências entre capítulos

> Ordem de escrita/implementação. "→" = "depende de / não pode ser fechado antes de".

| Capítulo | Depende de | Habilita |
|---|---|---|
| 4 Shared Kernel | 3.2, 3.3 | 3.4, 5.2, 6.x, 7.x |
| 3 Ubíqua/Contrato | 2 (modelo), 4 (kernel) | 5, 6, 7 |
| 2 Modelo de Domínio | DDD-002 (fechado) | 3, 8 |
| 5 Pipeline | 3, 4 | 7, 11 |
| 6 Renderers/Canais | 3, 4 | 9 |
| 7 Publisher | 3, 5, 6 | 11 |
| 8 Ciclo de vida | 2 | 6.3, 7.3 |
| 9 Aquisição/Web | 4, 6 | — |
| 10 Escopo de produto | 2, DDD-002 | — |
| 11 Migração | 2, 3, 5, 7 | §I |
| 12 Aceite | todos | fechamento |

**Caminho crítico:** `2 → 4 → 3 → 5 → 7 → 11 → 12`. Capítulos 8/9/10 correm em paralelo após o 2/4.

---

## §H — Critérios de Aceite

> Como saber que a RFC (e cada capítulo) está pronta. Verificáveis, binários.

**Globais**
- **AC-G1.** Todo capítulo rastreia para ≥1 DR/R (nenhum órfão).
- **AC-G2.** Toda decisão do DDD-002 aparece na matriz §F com ≥1 seção (cobertura 100%).
- **AC-G3.** Nenhuma regra inviolável do CLAUDE.md é enfraquecida (checklist explícito no 12.3).
- **AC-G4.** Nenhuma seção reabre uma decisão do DDD-002 (só implementa).
- **AC-G5.** Todos os 8 diagramas (§E) presentes.
- **AC-G6.** Todos os placeholders `⟦…⟧` deste blueprint estão resolvidos na RFC.

**Por capítulo (amostra)**
- **AC-2.** O agregado Edição tem invariantes listados e cada um mapeia a um gate de QA (Cap. 5).
- **AC-3.** Existe **um** schema canônico; veredito, faixas e 8 critérios batem com o kernel (Cap. 4).
- **AC-4.** Existe **uma** fonte para tokens/veredito/disclaimer/fórmulas; superfícies derivam, não duplicam.
- **AC-5.** Cada gate de QA declara severidade (bloqueio/aviso) e a decisão que o origina.
- **AC-7.** Nenhum caminho de dispatch permite `illustrative` ou pula QA; `--force` só afeta idempotência.
- **AC-8.** A máquina de estados cobre correção pós-publicação sem edição silenciosa.
- **AC-9.** O form de assinatura chama a rota real; mock só server-side.
- **AC-11.** Todo artefato legado (2 modelos, 2 pipelines, kernel triplo) tem destino no plano.

---

## §I — Roadmap de implementação (ondas pós-aprovação da RFC)

> Sequência de execução **depois** da RFC aprovada. Ondas, não sprints; cada onda entrega valor verificável.

- **Onda 0 — Kernel & Contrato:** materializar shared kernel único + schema canônico. *Desbloqueia todo o resto.* (Cap. 3, 4)
- **Onda 1 — Modelo & Migração:** converter os exemplos (Nº 27/28/41) ao modelo canônico; remover o modelo/schema duplicado. (Cap. 2, 11)
- **Onda 2 — Pipeline & QA:** um pipeline com gates de severidade correta (vigência erro, disclaimer exato, veredito↔faixa, contraste AA). (Cap. 5)
- **Onda 3 — Renderers & Canais:** convergir renderers para o modelo único; componentes derivando do kernel. (Cap. 6)
- **Onda 4 — Publisher & Gates:** ratificar idempotência; adicionar bloqueio `illustrative`; cercar `--force`. (Cap. 7)
- **Onda 5 — Ciclo de vida:** estados + errata versionada; vigência expirada no arquivo. (Cap. 8)
- **Onda 6 — Aquisição & Web:** ligar form à rota real; navegação para `/edicao` e `/pro`; contraste dos rótulos. (Cap. 9)
- **Onda 7 — Marca & Limpeza:** "The Loyal"→"The Loyalty"; alinhar prosa dos 8 critérios; remover refs a docs-fantasma. (Cap. 11)

**Dependências de onda:** `0 → 1 → 2 → {3,4,5} → 6`; onda 7 pode correr em paralelo a partir da 2.

---

## §J — Placeholders / TBD que a RFC deve fechar

> Pontos deixados abertos **de propósito** — são decisões de *implementação* (o *como*), legítimas na RFC, não no DDD-002.

- **TBD-1.** Grafia das chaves de serialização (camelCase vs snake_case) sob linguagem ubíqua pt-BR. (afeta 3.4)
- **TBD-2.** Localização física da fonte única do kernel e mecanismo de derivação. (4.1)
- **TBD-3.** Draft e localização do schema canônico. (3.4)
- **TBD-4.** Como registrar estado/errata da Edição (campo, arquivo, convenção). (8.2)
- **TBD-5.** Wiring exato do `package.json` para o pipeline único. (5.1)
- **TBD-6.** Como o arquivo web sinaliza "vigência expirada". (6.3, 8.3)
- **TBD-7.** Numeração por produto: gerador/convenção e tratamento dos exemplos fora da sequência. (8.4)
- **TBD-8.** Onde vive o disclaimer-fonte e como as superfícies o consomem exatamente. (4.1)

---

### Estado de saída

O blueprint da RFC-001 está completo: **12 capítulos + apêndices**, **8 entidades/objetos** enumerados, **8 fluxos** inventariados, **8 diagramas** escopados, matriz de decisões→seção com **cobertura total do DDD-002**, matriz de dependências com caminho crítico, critérios de aceite verificáveis, roadmap em 8 ondas e 8 TBDs delimitando o espaço de implementação.

**Nenhum conteúdo foi escrito.** A RFC-001 pode agora ser preenchida seção a seção, sem reabrir o DDD-002.

*Fim do RFC-001 Blueprint v0.1.*
