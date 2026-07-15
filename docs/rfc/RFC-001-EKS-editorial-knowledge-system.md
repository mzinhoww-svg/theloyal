# The Loyalty — Editorial Knowledge System

**Version 1.0 · Status: Draft (founding) · RFC-001 do AAP-000**

> Documento fundador do sistema de conhecimento do The Loyalty.
> Produzido sob o **Architectural Authority Protocol (AAP-000)** e o **EKS Master Authoring Protocol v1.0**.
> Horizonte de projeto: **10 anos**. Esta RFC precede e governa RFC-002 (RES), RFC-003 (CRS), RFC-004 (PES), RFC-005 (AES).
> Nenhuma RFC posterior pode contradizer esta. Emendas seguem o processo de versionamento em §13.

| Metadado | Valor |
|---|---|
| Título | The Loyalty — Editorial Knowledge System (EKS) |
| Versão | 1.0 |
| Estado | Draft fundador (aguardando ratificação humana — ver §12) |
| Autoridade | AAP-000 — Autoridade Arquitetural |
| Escopo | Domínio de conhecimento editorial; contratos que todos os produtos herdam |
| Fora de escopo | Escolha de framework, esquema físico de banco, layout de e-mail, copy final |
| Precede | RFC-002 RES · RFC-003 CRS · RFC-004 PES · RFC-005 AES |
| Fonte de verdade sobre | O que é conhecimento no The Loyalty e como ele nasce, vive, é auditado e morre |

---

## 0. Como ler este documento

Este documento é longo por obrigação: ele funda uma disciplina, não descreve uma feature.

- **Se você é humano de produto/editorial:** leia §1, §5, §8, §13.
- **Se você é engenheiro:** leia §1, §4, §7, §9, §12, §14.
- **Se você é uma IA operando o sistema (Claude, Cowork, futuras):** §3, §4, §6 são seu contrato cognitivo. §6 é lei.
- **Se você quer só a decisão:** cada seção termina em **Decisão** e **Trade-offs**. As decisões consolidadas estão em §14 (ADRs).

Convenção: **MUST / MUST NOT / SHOULD / MAY** têm o sentido do RFC 2119. Termos com Inicial Maiúscula (Knowledge Object, Edition, Verdict) são entidades definidas em §4 e no glossário (Apêndice A).

**Regra-mãe deste documento:** o domínio é maior que qualquer tecnologia. JSON é serialização. React é renderer. Beehiiv é canal. Nenhum deles é a verdade.

---

## 1. Contexto e descobertas (Discovery)

O AAP-000 proíbe escrever arquitetura antes de descobrir o sistema real. Esta seção registra o que **de fato existe** hoje no repositório, não o que a documentação afirma. **Comportamento real vence documentação.**

### 1.1 O que o The Loyalty é, de fato

Uma **mídia editorial vertical** sobre loyalty (pontos, milhas, cartões, bancos, varejo, cashback, CRM, comportamento de consumo). A promessa operacional: *em 5 minutos o leitor entende o que mudou, por que importa, qual é a conta e qual é o risco*. O produto central não é texto — é **julgamento auditável**: cada oportunidade recebe uma **conta feita**, um **TL Score** e um **veredito** rastreável até a fonte.

Produtos observados no repo:

| Produto | Cadência | Artefato real | Contrato |
|---|---|---|---|
| **Daily** | Diário | `content/editions/NNNN.json` | `content/edition.schema.json` |
| **Pro** | Período (mensal) | `content/pro/AAAA-MM.json` | `content/pro-report.schema.json` |
| **Landing / Web** | Contínuo | `app/**`, `components/**` | Tokens de marca em `tailwind.config.ts` |

Produtos mencionados no AAP mas **ainda inexistentes** no código: Weekly, Lab, Special. São *futuros* — o EKS deve acomodá-los sem reforma (§4, §15).

### 1.2 A cadeia de valor que já existe (comportamento real)

```
  PESQUISA          VALIDAÇÃO         CÁLCULO           EDIÇÃO           AUDITORIA        RENDER            QA              PUBLICAÇÃO
  (Cowork)          (Cowork)          (Cowork)          (Cowork)         (skill)          (skill)           (skill)         (humano)
     │                 │                 │                 │                │                │                │                │
  fontes 1–4 ───► vigência ────► CPM/VPM/spread ──► JSON editorial ─► tl-source-audit ─► tl-digest ─► tl-qa ────► PR + Beehiiv
     │            confirmada       TL Score          (schema-valid)     REPROVA se G1     e-mail/plain/web  bloqueia G1     (manual, draft)
     ▼                                                     ▼                                    ▼
  "nível" da fonte                                  npm run validate               out/email · out/plain · /edicao/NNNN
```

Fatos verificados:
- **Cowork é o Research Editor.** Ele pesquisa, valida, calcula, classifica e entrega **apenas JSON editorial validado**. Não publica, não envia e-mail, não copia fonte externa (`COWORK.md`). Seu output para no passo 1.
- **A auditoria é um gate.** `tl-source-audit` emite parecer; Grupo 1 ⇒ REPROVADO. `tl-qa` bloqueia qualquer regra inviolável quebrada.
- **A publicação é humana e manual.** Beehiiv por padrão cria só rascunho; sem credenciais opera em modo mock. Nenhuma IA publica sozinha.
- **Fórmulas são públicas e auditáveis** (`COWORK.md`): CPM, CPM final, VPM, preço implícito (P+D), spread. Taxa de conversão nunca é assumida sem fonte.

### 1.3 Divergências encontradas (a documentação mente em pontos específicos)

Estas são descobertas, não opiniões. Cada uma vira item de reconciliação (§12) e ADR (§14).

**D-1 — A hierarquia de verdade aponta para arquivos-fantasma.**
`CLAUDE.md` declara a hierarquia `THE-LOYALTY-LLM-SYSTEM.md > DESIGN.md > THE-LOYALTY-BRAND-GUIDELINES.md > PONTO-MASCOTE-GUIA.md > TL-GRAPHICS.md > Operating Manual v1`. **Nenhum dos seis arquivos existe no repositório.** As fontes de verdade *reais* são: `CLAUDE.md`, `content/edition.schema.json`, `content/pro-report.schema.json`, o código em `renderer/` e as três skills (`tl-digest-template`, `tl-qa`, `tl-source-audit`). O "Operating Manual v1" é citado em números de seção (§5.2, §5.4, §8, §11, §14) que não têm documento correspondente.
→ **Risco:** decisões referenciam autoridade inexistente. O conhecimento normativo está espalhado e parcialmente órfão.

**D-2 — Duas taxonomias de veredito coexistem e divergem.**

| Fonte | Tokens de veredito |
|---|---|
| `content/edition.schema.json` | `vale-agir, vale-olhar, casos-especificos, esperaria, evitaria, nao-confirmado` (6) |
| `renderer/edition.schema.json` + `renderer/tokens.mjs` | `vale-agir, vale-olhar, depende, esperaria, nao-vale, evitaria, nao-confirmado` (7) |
| `CLAUDE.md` (mapa semântico) | Vale agir, Vale olhar, Só para casos específicos, Esperaria, Evitaria, Não confirmado (6) |

`content` e `CLAUDE.md` concordam em 6 valores; o `renderer` tem 7, introduzindo `depende` e `nao-vale` que **não existem** no modelo editorial nem no vocabulário canônico. Isso quebra a própria regra "vocabulário proprietário com grafia fixa".
→ **Risco:** o mesmo julgamento pode serializar-se de forma incompatível entre pipelines. Auditoria de longo prazo fica ambígua.

**D-3 — Duas serializações da mesma Edition, drifted.**

| Conceito de domínio | `content/edition.schema.json` | `renderer/edition.schema.json` |
|---|---|---|
| Sinal do dia | `signal` | `sinal_do_dia` |
| Deal Desk | `deals[]` | `deal_desk` |
| Conta feita | `conta { rows, result }` | `conta_feita { linhas, total }` |
| O que evitaria | (ausente como campo) | `o_que_evitaria` (obrigatório) |

São dois **contratos de serialização** do mesmo Knowledge Object, evoluídos separadamente. Exatamente o sintoma que o AAP prevê quando JSON é tratado como domínio em vez de projeção dele.
→ **Risco:** custo de manutenção dobrado, e qualquer novo canal precisa escolher "qual JSON" — decisão que não deveria existir.

**D-4 — O conhecimento não persiste entre edições.**
Cada edição é um arquivo isolado (`0027.json`, `0028.json`). Não há entidade que ligue "esta oportunidade de hoje" a "a mesma oportunidade de três semanas atrás", nem memória de que "o CPM normal de transferência Livelo→Smiles é X". O Pro Report calcula `tlScorePeriod.average` mas não há *lineage* do número até as edições que o compõem.
→ **Risco:** conhecimento é produzido e descartado. Não acumula. Sem acúmulo, não há vantagem editorial composta em 10 anos.

**D-5 — Confiança é modelada implicitamente, não como primeira classe.**
O sistema já sabe representar incerteza: `nao-confirmado`, a pose `lupa` do mascote, o "nível" 1–4 da fonte, e a regra "sem vigência ⇒ nao-confirmado". Mas confiança/vigência/nível estão espalhados como campos e convenções, não como um **Knowledge Confidence** unificado com regras de decaimento.
→ **Oportunidade:** promover confiança a cidadã de primeira classe (§4.7, §6.6).

### 1.4 Ativos que já estão certos (não mexer sem motivo)

- **Determinismo de fórmula.** CPM/VPM/spread são funções puras de entradas verificáveis. Isto é ouro. O EKS o preserva como **invariante de cálculo** (§5.3).
- **Gate de vigência.** "Sem vigência confirmada ⇒ `nao-confirmado`" é a regra de honestidade mais importante do sistema. Vira invariante global (§6.6, §8.3).
- **Separação Cowork↔publicação humana.** Nenhuma IA publica. Governança humana já é default. O EKS a formaliza (§8).
- **Disclaimer const.** A frase oficial é `const` no schema — imutável por construção. Padrão a replicar para outros invariantes textuais.

---

## 2. State of the Art — o que sistemas editoriais e de conhecimento fazem

Não copiamos nenhum. Extraímos princípios e classificamos: **adotar / adaptar / descartar**.

### 2.1 Mídia editorial de alta performance

| Referência | Faz bem | Faz mal / limite | Princípio para o EKS |
|---|---|---|---|
| **Morning Brew / The News** | Voz consistente, densidade útil por minuto, cadência confiável | Conhecimento vive no texto; nada acumula entre edições | **Adaptar:** densidade e cadência como contrato; **descartar** o texto como memória |
| **Axios ("Smart Brevity")** | Estrutura atômica (o quê / por quê importa / vá fundo) | Estrutura é de apresentação, não de dado | **Adotar** a atomicidade — mas na *camada de conhecimento*, não na de render |
| **The Information / Stratechery** | Tese autoral rastreável, autoridade por método | Tese fica implícita, difícil auditar anos depois | **Adotar:** Tese como Knowledge Object versionável com evidência ligada |
| **Bloomberg** | Dado estruturado como cidadão de primeira classe; terminal separa dado de apresentação | Complexidade e custo enormes | **Adotar** a separação dado↔apresentação; **descartar** o peso |
| **The Economist / FT** | Voz institucional durável, correções rastreáveis, arquivo canônico | Pouca estrutura de máquina; arquivo é texto | **Adotar:** correção rastreável e arquivo canônico; **adaptar** para máquina-legível |

### 2.2 Consultoria e inteligência de decisão

| Referência | Faz bem | Faz mal | Princípio |
|---|---|---|---|
| **McKinsey / Gartner** | Frameworks reutilizáveis, benchmarks, "Magic Quadrant" como objeto durável | Opinião embalada como certeza; fonte às vezes opaca | **Adotar** benchmark/matriz como objetos (já existem no Pro!); **descartar** a certeza sem evidência |
| **Decision Intelligence** | Separa dado → modelo → decisão → resultado; feedback loop | Requer disciplina alta | **Adotar** o loop decisão→resultado (medir se o Verdict envelheceu bem) |

### 2.3 Engenharia de conhecimento e ferramentas de pensamento

| Referência | Faz bem | Faz mal | Princípio |
|---|---|---|---|
| **Wikipedia** | Verificabilidade obrigatória, cada afirmação com fonte, histórico total, NPOV | Consenso lento, vandalismo | **Adotar:** "no citation → no claim" e histórico imutável |
| **Semantic Web / Linked Data / RDF** | Sujeito-predicado-objeto; identidade global; grafo | Complexidade e adoção baixa; over-engineering | **Adaptar:** grafo *interno* leve, sem abraçar a torre de ontologias |
| **Google Knowledge Graph** | Entidades canônicas reconciliadas de muitas fontes | Fechado, caro | **Adotar** a ideia de **entidade canônica** (um "Livelo" só) |
| **Obsidian / Roam / Logseq** | Links bidirecionais, conhecimento emergente por conexão | Vira caos sem governança; sem tipos fortes | **Adotar** links tipados; **descartar** o "tudo conecta com tudo" |
| **Notion** | Modelo flexível, banco+doc unificado | Schema fraco, apodrece em escala | **Descartar** flexibilidade sem contrato |

### 2.4 Plataformas de engenharia (o modo de pensar, não a tecnologia)

| Referência | Princípio universal | Aplicação no EKS |
|---|---|---|
| **Stripe** | API como produto; versionamento explícito; docs como contrato | Contratos de conhecimento versionados e documentados como produto |
| **Kubernetes** | Modelo declarativo desejado→reconciliação; recursos versionados (`apiVersion`) | Todo Knowledge Object carrega `schemaVersion`; estado declarado, render reconcilia |
| **Amazon** | "Working backwards" do cliente; um-way vs two-way doors | Decisões irreversíveis (taxonomia, IDs) tratadas como one-way doors |
| **Anthropic / OpenAI** | Model/eval specs; guardrails explícitos; humano no loop | §6 (arquitetura cognitiva) e §8 (governança humana) |
| **DDD (Domain-Driven Design)** | Linguagem ubíqua; bounded contexts; agregados | §3 (linguagem), §4 (agregados), §9 (contexts por canal) |
| **Academic / Scientific publishing** | Peer review, DOI imutável, retração rastreável, provenance | Review gate, ID canônico imutável, retração como estado (§7), lineage (§4.13) |

### 2.5 Síntese — os oito princípios universais que sobrevivem

1. **Verificabilidade obrigatória.** Nenhuma afirmação sem fonte. (Wikipedia, ciência)
2. **Separação dado ↔ apresentação.** (Bloomberg, DDD)
3. **Entidade canônica.** Uma coisa do mundo → um objeto no sistema. (Knowledge Graph)
4. **Versionamento explícito e imutabilidade do passado.** (Stripe, K8s, ciência)
5. **Provenance / lineage total.** De onde veio, quem tocou, por quê. (ciência, Wikipedia)
6. **Confiança e ausência representadas, não escondidas.** (decision intelligence)
7. **Governança com humano no loop para atos irreversíveis.** (Anthropic, editorial sério)
8. **Simplicidade defensável.** Complexidade só quando paga por si. (contra Semantic Web/Notion)

O que **descartamos** ativamente: ontologias RDF completas, flexibilidade sem schema, texto como memória, certeza sem evidência, e "tudo conecta com tudo".

---

## 3. First Principles — antes de qualquer tecnologia

Ignoramos software, HTML, Beehiiv, React, JSON, banco, API. Começamos do conhecimento.

### 3.1 A cadeia dado → conhecimento

```
   DADO ──────► INFORMAÇÃO ──────► CONHECIMENTO ──────► SABEDORIA EDITORIAL
   (fato        (dado em          (informação          (conhecimento que
    bruto,       contexto,          validada, ligada,     guia ação e se
    sem juízo)   com significado)   confiável, reusável)  acumula ao longo do tempo)

   "CPM = R$     "CPM R$ 12/mil    "Esta transferência   "Transferências casadas
    12/milheiro"  nesta transf.     vale agir para o       com compra de origem em
                  bonificada"       público do clube,      desconto abrem janelas
                                    fonte oficial,         curtas; o padrão se
                                    vigência até sexta"    repete a cada bônus"
```

**Definições operacionais** (não filosóficas — precisam ser executáveis por uma IA):

- **Dado** — um fato bruto mensurável ou citável. Sem contexto e sem juízo. Ex.: `R$ 38,00 /mil`. Tem valor zero sozinho.
- **Informação** — dado situado em contexto e tempo. Ex.: "compra de pontos Esfera a R$ 38/mil, promoção vigente hoje". Responde *o quê* e *quando*.
- **Conhecimento** — informação **validada** (fonte de nível adequado), **ligada** (a entidades e a outras informações), **com confiança explícita** e **reutilizável**. Responde *e daí?* — permite julgar e agir.
- **Insight** — conhecimento não óbvio que emerge de conexão entre informações. Ex.: "quando bônus e desconto de origem coincidem, a janela é curta". Vale mais que a soma das partes.
- **Tese** — uma afirmação autoral, direcional, sobre como o domínio se comporta, sustentada por evidência acumulada e falsificável. Ex.: "o custo de aquisição de milha via transferência está em aperto estrutural em 2026". Uma Tese é o ativo editorial mais valioso e o mais perecível se não for revisada.
- **Evidência** — dado ou informação, ligado a uma fonte de nível conhecido, que suporta ou refuta uma afirmação. Evidência tem **direção** (suporta/refuta) e **peso** (nível da fonte).
- **Hipótese** — afirmação ainda não suportada por evidência suficiente. Estado legítimo e explícito, nunca disfarçado de conhecimento. Mapeia para `nao-confirmado`.
- **Verdade** — no EKS não existe verdade absoluta; existe **melhor afirmação sustentável dada a evidência atual e sua vigência**. Toda "verdade" tem prazo.
- **Confiança** — grau em que uma afirmação pode ser sustentada, função de (nível da fonte × frescor/vigência × corroboração × ausência de contradição). É medida, não sentida.
- **Contexto** — o conjunto de condições que tornam uma afirmação válida ("para quem já é do clube", "até sexta"). Sem contexto, um Verdict é desonesto.
- **Sinal** — mudança no domínio que merece atenção agora. É o átomo de pauta. (No produto: "o sinal do dia".)
- **Ruído** — mudança aparente sem consequência para decisão. O trabalho editorial é o filtro sinal/ruído.
- **Aprendizado** — atualização de uma Tese/heurística quando novo conhecimento contradiz ou refina o anterior. Aprendizado deixa rastro (o que mudou, por quê).
- **Memória** — conhecimento retido e recuperável ao longo do tempo, com identidade estável, para comparação e acúmulo.
- **Inteligência (editorial)** — a capacidade do sistema de transformar sinal em conhecimento confiável e conhecimento em julgamento acionável, repetidamente e de forma auditável.
- **Descoberta** — o ato de encontrar sinal antes de ser óbvio, e de reencontrar conhecimento arquivado quando volta a ser relevante (rediscovery).
- **Conhecimento editorial** — conhecimento que carrega **julgamento** (Verdict), **conta** (cálculo), **contexto** e **fonte**, produzido para um leitor que precisa decidir. É a especialidade do The Loyalty.

### 3.2 A linguagem ubíqua (DDD)

Estes termos têm **grafia fixa** e significado único em todo o sistema — código, prompt, doc, UI. Divergir é bug.

> TL Score · Verdict (Vale agir / Vale olhar / Só para casos específicos / Esperaria / Evitaria / Não confirmado) · Sinal do dia · Deal Desk · Fecha logo · Conta feita · CPM · CPM final · VPM · Preço implícito · Spread · Vigência · Fonte (nível 1–4) · Benchmark · Player.

Ver Apêndice C para a resolução canônica de D-2 (taxonomia única de Verdict).

**Decisão §3:** o domínio é a fonte de verdade. Toda tecnologia posterior projeta este vocabulário; nunca o redefine.

---

## 4. Modelagem — o Knowledge Model

O coração do EKS. Modelamos **conhecimento como objeto**, independente de qualquer serialização. JSON, banco ou grafo são projeções disto.

### 4.1 Princípio de modelagem

> **Um Knowledge Object é a unidade atômica, versionável, rastreável e reutilizável de conhecimento editorial.** Tudo o que o The Loyalty sabe é um Knowledge Object ou uma relação entre eles.

Todo Knowledge Object (KO) MUST ter: **identidade estável**, **tipo**, **versão de schema**, **conteúdo tipado**, **evidência**, **confiança**, **frescor/vigência**, **estado de ciclo de vida**, **proprietário**, e **lineage**. Esses são os campos-envelope; o `payload` tipado varia por tipo.

### 4.2 Envelope canônico (independente de serialização)

```
KnowledgeObject
├── identity
│   ├── id            ULID/UUID imutável — one-way door, nunca reciclado
│   ├── canonicalKey  chave humana estável (ex: "deal:esfera-latampass:2026-07-08")
│   └── type          KnowledgeType (§4.4)
├── schemaVersion     inteiro; contrato de forma do payload (§12)
├── payload           conteúdo tipado por `type` (§4.5–§4.11)
├── evidence[]        KnowledgeEvidence — 1..n (§4.6). "no evidence → no publish"
├── confidence        KnowledgeConfidence (§4.7)
├── freshness         KnowledgeFreshness (§4.8) — vigência, decaimento
├── lifecycle         KnowledgeLifecycle state (§4.12 / §7)
├── ownership         quem cria/valida/aprova (§4 / §8)
├── lineage           KnowledgeLineage — derivadeDe[], contribuiPara[] (§4.13)
├── relations[]       KnowledgeRelationship tipada (§4.3)
└── audit[]           KnowledgeAudit — trilha imutável append-only (§4.14)
```

Regra: o envelope é **estável por décadas**; o `payload` evolui por `schemaVersion`. Isso permite adicionar produtos (Weekly, Lab) sem tocar no envelope.

### 4.3 Ontologia mínima — Entities, Objects, Events, Relationships

Distinguimos quatro naturezas (contra o caos "tudo é nota" do Roam):

- **Knowledge Entity** — uma coisa durável e canônica do mundo: um *programa* (Smiles), um *player* (Livelo), uma *moeda* (milha Latam Pass), um *canal* (transferência bonificada). Entidades são poucas, mudam devagar, e são **reconciliadas** (uma só Livelo). Resolve o D-4 parcial: dá âncora de memória.
- **Knowledge Object** — uma unidade de conhecimento produzida: um Deal, uma Tese, um Benchmark, uma Edition. Muitos, versionados, perecíveis.
- **Knowledge Event** — algo que aconteceu num instante: "bônus de 100% anunciado", "vigência expirou", "Verdict revisado". Imutável, append-only. É a base de auditabilidade e de reconstrução histórica (event-driven thinking do AAP).
- **Knowledge Relationship** — aresta **tipada e direcional** entre nós: `deal SUPPORTS thesis`, `edition CONTAINS deal`, `evidence CORROBORATES claim`, `thesisB SUPERSEDES thesisA`, `dealB CONTRADICTS dealA`. Relações têm confiança própria.

```
   ┌────────────────┐        CONTAINS         ┌──────────────┐
   │  Edition (KO)  │────────────────────────►│  Deal (KO)   │
   └────────────────┘                         └──────┬───────┘
          │ PUBLISHED_AS                              │ ABOUT
          ▼                                           ▼
   ┌────────────────┐                          ┌──────────────┐
   │ Rendition (§9) │                          │ Entity:      │
   │ email/web/...  │                          │ Programa,    │
   └────────────────┘                          │ Player, Moeda│
                                               └──────┬───────┘
   ┌────────────────┐   SUPPORTS / REFUTES            │ INSTANCE_OF
   │  Thesis (KO)   │◄───────────────┐                ▼
   └───────┬────────┘                │         ┌──────────────┐
           │ SUPERSEDES              └─────────│  Deal / Bench │
           ▼                                    └──────────────┘
   ┌────────────────┐   DERIVED_FROM    ┌────────────────────┐
   │ Thesis vN+1    │◄──────────────────│ Learning (Event)   │
   └────────────────┘                   └────────────────────┘
```

### 4.4 KnowledgeType (taxonomia de tipos)

Fechada e versionada. Adicionar tipo é decisão arquitetural (ADR).

| Tipo | Natureza | Exemplo real | Produto |
|---|---|---|---|
| `Signal` | Object | "o sinal do dia" | Daily |
| `Deal` | Object | oportunidade com conta+Verdict | Daily/Deal Desk |
| `FechaLogo` | Object | item que vence ≤72h | Daily |
| `Conta` | Object (embutido) | cálculo CPM/VPM | Daily/Pro |
| `Benchmark` | Object | faixa low/normal/high de CPM | Pro |
| `PlayerMove` | Event→Object | movimento de um player + leitura | Pro |
| `Matrix` | Object | posicionamento x/y de players | Pro |
| `Thesis` | Object | afirmação direcional acumulada | Pro/Lab (futuro) |
| `Insight` | Object | conexão não óbvia | transversal |
| `Alert` | Object | insight/warning/danger | Pro |
| `Learning` | Event | atualização de heurística | transversal |
| `Entity` | Entity | Programa/Player/Moeda/Canal | transversal |
| `Edition` | Object (agregado) | a edição do dia | Daily |
| `Report` | Object (agregado) | relatório do período | Pro |

### 4.5 Deal — o Knowledge Object canônico (modelo, não JSON)

O Deal é onde dado vira julgamento. Modelo conceitual:

```
Deal
├── about: Entity[]            (programa origem, programa destino, canal)
├── category: string          "Transferência bonificada · Livelo → Smiles"
├── title, context: string    contexto = condições de validade (para quem, até quando)
├── conta: Conta              cálculo determinístico (§5.3) — MUST
├── tlScore: 0..100           composto ponderado (§5.4) — SHOULD (MUST se Verdict acionável)
├── scoreBreakdown: 8 critérios ponderados (25/15/15/10/10/10/10/5)
├── verdict: Verdict          taxonomia canônica única (Apêndice C) — MUST
├── verdictNote: string       o julgamento em uma frase
├── evidence[]: Source+nível  MUST ≥1; nível 1–2 para Verdict acionável
└── freshness.vigencia: datetime   MUST; ausente ⇒ verdict = "não confirmado" (invariante §6.6)
```

**Invariante do Deal (I-DEAL):** `verdict acionável (Vale agir/Vale olhar) ⇒ evidence com fonte nível 1–2 E vigencia confirmada E scoreBreakdown fecha com tlScore`. Violou → o Deal MUST rebaixar para `Não confirmado`, nunca publicar o julgamento.

### 4.6 KnowledgeEvidence & KnowledgeSource

```
KnowledgeSource (Entity-like)
├── label, url (https MUST)
├── tier: 1..4    1=oficial/regulamento · 2=oficial secundário · 3=imprensa séria · 4=social/rumor
└── kind: regulamento | página oficial | imprensa | social | cálculo próprio

KnowledgeEvidence
├── source: KnowledgeSource
├── observedAt: datetime      quando foi verificada
├── direction: supports | refutes | contextualizes
└── excerptRef                referência, NUNCA cópia literal (regra anti-cópia)
```

Regra **N-COPY**: evidência referencia e resume; nunca copia texto/título/estrutura de fonte externa. Redação sempre própria (regra inviolável 2 do `CLAUDE.md`).

### 4.7 KnowledgeConfidence (promover confiança a primeira classe — resolve D-5)

Confiança é **derivada e explícita**, nunca inventada:

```
confidence = f(sourceTier, corroboration, freshness, contradiction)

  level ∈ { confirmed, probable, unconfirmed }
  confirmed   ⇐ tier ≤ 2  ∧ vigência válida ∧ sem contradição aberta
  probable    ⇐ tier = 3  ∨ corroboração parcial
  unconfirmed ⇐ tier = 4  ∨ vigência ausente/expirada ∨ contradição aberta
```

`unconfirmed` MUST projetar-se em `verdict = "Não confirmado"` e na pose `lupa` do mascote. **Ausência de informação é um valor de primeira classe, não um vazio.**

### 4.8 KnowledgeFreshness & KnowledgeDecay

Todo conhecimento perece. Modelamos o prazo:

```
freshness
├── observedAt      quando foi verificado
├── vigencia        até quando a afirmação vale (datetime) — para Deals: MUST
├── halfLife        meia-vida do tipo (Deal: horas–dias; Benchmark: semanas; Thesis: meses)
└── state: fresh → aging → stale → expired   (função de now vs vigencia/halfLife)
```

Decaimento é **regra, não evento manual**: quando `now > vigencia`, o KO transita para `expired` e seu Verdict deixa de ser publicável sem revalidação. Isto é o motor da honestidade temporal.

### 4.9 Conta (cálculo determinístico embutido)

`Conta` é um KO embutido, **função pura** de entradas verificáveis. Modelo: `rows: [chave, valor][]` + `result: [chave, valor]`. Fórmulas em §5.3. Invariante **I-CONTA**: o `result` MUST ser reproduzível a partir das `rows` e das fórmulas públicas; nenhum número mágico.

### 4.10 Benchmark, PlayerMove, Matrix (o modelo Pro)

Já existem no `pro-report.schema.json` e são bons objetos de conhecimento acumulável:
- **Benchmark** — `{category, metric, unit, low, normal, high}`: a faixa de referência. É *memória quantitativa* do domínio. Deveria persistir e evoluir entre períodos (hoje é recomputado; §12/§15 propõem lineage).
- **PlayerMove** — `{player, move, reading, signal∈{abertura,aperto,estável}}`: Event observado + leitura autoral.
- **Matrix** — posicionamento x/y de players. Objeto durável tipo "Magic Quadrant" próprio.

### 4.11 Thesis, Insight, Learning (os objetos que faltam — o motor de acúmulo)

Hoje **inexistentes como objetos** (D-4). O EKS os funda porque são o que transforma "newsletter diária" em "autoridade composta em 10 anos":

- **Thesis** — afirmação direcional versionada, com `evidence[]` que suporta/refuta, `confidence`, e relações `SUPERSEDES`/`SUPPORTED_BY`. Uma Tese nunca é apagada; ela é **superada** por uma versão nova (imutabilidade do passado).
- **Insight** — conexão não óbvia entre ≥2 KOs, com a relação que a gerou registrada (explicabilidade).
- **Learning** — Event que registra "a heurística X foi atualizada para X' porque a evidência Y contradisse". É como o sistema **aprende e deixa rastro**.

### 4.12 KnowledgeLifecycle (estado) — detalhado em §7

`draft → validated → classified → linked → published → measured → (refined | deprecated) → archived → (rediscovered → …)` além de `retracted` (caminho de erro) e `expired` (caminho de tempo).

### 4.13 KnowledgeLineage (proveniência)

Todo KO carrega `derivedFrom[]` (quais KOs/evidências o originaram) e por consequência `contributesTo[]`. Exemplos que hoje faltam e o EKS exige:
- `tlScorePeriod.average` (Pro) MUST ter lineage até as Editions/Deals amostrados (`sampled`).
- Um Benchmark v2 MUST apontar o v1 que substituiu e os Deals que moveram a faixa.

Lineage é o que torna qualquer número **explicável anos depois** — critério de aceite §13.

### 4.14 KnowledgeAudit (trilha imutável)

Append-only. Cada mutação relevante gera um registro `{who, role, action, when, before→after, reason}`. Nunca se edita o passado; corrige-se com um novo registro. Base de `Traceability` e `Determinism` do AAP.

### 4.15 Knowledge Contradiction / Conflict / Consensus

Quando dois KOs afirmam coisas incompatíveis sobre a mesma Entity no mesmo tempo:
- registra-se relação `CONTRADICTS`;
- o de maior confiança prevalece na publicação, o outro fica visível na trilha;
- se confiança empata, ambos rebaixam para `unconfirmed` até desempate por evidência. **Nunca se escolhe silenciosamente.**

**Decisão §4:** o envelope KO + a ontologia Entity/Object/Event/Relationship é o modelo canônico. Serializações (RFC-002 RES) o projetam; não o redefinem.

---

## 5. Editorial Intelligence — como o conhecimento nasce

Como nascem, mecanicamente, os artefatos editoriais. Cada um é uma função de KOs de entrada para um KO de saída, com gates.

### 5.1 Árvore de nascimento de um Sinal → Deal → Verdict

```
                 mudança observada no domínio
                          │
                 ┌────────▼─────────┐
                 │ é sinal ou ruído?│  (consequência para decisão do leitor?)
                 └───┬──────────┬───┘
                 ruído          sinal ──► registra Signal (KO)
                 (descarta,          │
                  loga)              ▼
                              tem fonte nível 1–2?
                          ┌─────────┴──────────┐
                         não                   sim
                          │                     │
                    tem vigência?         calcula Conta (§5.3)
                    ┌─────┴─────┐               │
                   não         sim              ▼
                    │           │        computa TL Score (§5.4)
                    ▼           ▼               │
             Verdict =    entra como radar      ▼
           "Não confirmado" (unconfirmed)  Verdict = faixa do Score (§5.5)
             (pose lupa)                         │
                                                 ▼
                                    contexto de validade explícito?
                                    ┌────────────┴───────────┐
                                   não                       sim
                                    │                         │
                            rebaixa p/ casos            publica Deal
                            específicos                  com contexto
```

### 5.2 Como nasce cada artefato (tabela de gênese)

| Artefato | Nasce de | Gate obrigatório | Vira |
|---|---|---|---|
| **Sinal** | mudança observada com consequência | passa no filtro sinal/ruído | `Signal` KO / "sinal do dia" |
| **Insight** | conexão entre ≥2 KOs | a relação é explicitável | `Insight` KO + Relationship |
| **Benchmark** | agregação de Contas comparáveis | ≥N amostras verificáveis | `Benchmark` KO com faixa |
| **Comparativo/Matrix** | ≥2 players na mesma métrica | métrica idêntica e fonte por player | `Matrix` KO |
| **Oportunidade (Deal)** | Sinal + fonte + Conta | I-DEAL (§4.5) | `Deal` KO |
| **Recomendação (Verdict)** | Deal + TL Score + contexto | vigência + fonte 1–2 | campo `verdict` |
| **Narrativa** | Sinal + Contexto + Tese | sem urgência artificial, redação própria | corpo editorial |
| **Learning** | evidência que contradiz heurística | rastro do que mudou | `Learning` Event |
| **Tendência** | série de Sinais na mesma direção | ≥N ocorrências no tempo | evidência de `Thesis` |
| **Alerta** | risco à decisão do leitor | nível (insight/warning/danger) | `Alert` KO |
| **Framework/Regra/Heurística** | padrão recorrente comprovado | falsificável e datado | `Thesis`/regra versionada |

### 5.3 Invariante de cálculo (fórmulas públicas)

Determinismo é lei. As fórmulas são as do `COWORK.md`, elevadas a invariante do sistema:

```
CPM (compra direta)   = valor_pago / (pontos / 1000)
CPM (com bônus)       = valor_pago / ((pontos + bonus) / 1000)
CPM final (transfer.) = custo_origem / ((pontos * taxa * (1 + bonus_%)) / 1000)
Preço implícito (P+D) = dinheiro_adicional / ((pontos_cheio - pontos_reduzido) / 1000)
VPM (resgate)         = valor_comparavel / (pontos_usados / 1000)
Spread                = VPM_estimado - CPM_efetivo
```

**Regra:** taxa de conversão nunca assumida sem fonte. Faltou dado para o cálculo ⇒ resultado é `aguardando confirmação` e Verdict `Não confirmado` (regra inviolável 9). Nenhum número mágico (I-CONTA).

### 5.4 TL Score — composto explicável

Soma ponderada de 8 critérios (0–100 cada), pesos `25/15/15/10/10/10/10/5`:

```
tlScore = 0.25·valor + 0.15·regra + 0.15·vigência + 0.10·fricção
        + 0.10·aplicabilidade + 0.10·liquidez + 0.10·estoque + 0.05·fontes
```

Invariante **I-SCORE:** se há `scoreBreakdown`, a soma ponderada MUST fechar com `tlScore` (tolerância definida em RFC-002). O Score é **explicável por construção** — nunca um número opaco.

### 5.5 Mapa Score → Verdict (canônico)

| Faixa TL Score | Verdict | Cor semântica |
|---|---|---|
| 85–100 | **Vale agir** | green-600 `#00A878` |
| 70–84 | **Vale olhar** | blue-600 `#315CFF` |
| 55–69 | **Só para casos específicos** | gray-400 `#8A8578` |
| 40–54 | **Esperaria** | yellow-500 fill, texto Ink |
| 0–39 | **Evitaria** | red-600 `#D64545` |
| s/ dado | **Não confirmado** | gray-400, borda tracejada |

Esta é a **taxonomia canônica única** (Apêndice C) que resolve D-2. `depende` e `nao-vale` do renderer são **deprecados** e migram (§12).

**Decisão §5:** o julgamento editorial é uma função gate-guarded de KOs. Cada gate é auditável. Nenhuma etapa "chuta".

---

## 6. Cognitive Architecture — como o Claude deve pensar

Não como pesquisar. Como **pensar**. Esta seção é o contrato cognitivo de qualquer IA que opere o EKS (Cowork hoje; futuras amanhã). É lei operacional.

### 6.1 Postura mental (default: ceticismo, igual ao mascote Ponto)

O agente opera como **Research Editor cético**, não como assistente prestativo. Sua função não é agradar nem preencher lacunas — é **proteger a confiabilidade do conhecimento**. Em conflito entre "ser útil rápido" e "estar certo", **estar certo vence** (espelha "credibilidade vence — corta o mascote").

### 6.2 Loop cognitivo obrigatório (o mesmo do AAP)

```
Observar → Modelar → Questionar → Alternativas → Trade-offs → Escolher → Justificar → Registrar
```

Aplica-se a cada afirmação, não só a decisões grandes. "Justificar" e "Registrar" produzem o `verdictNote`, a evidência e o audit.

### 6.3 Como questionar (antes de aceitar qualquer input)

Para toda informação candidata, o agente MUST perguntar:
1. Qual a fonte e o **nível** (1–4)?
2. Tem **vigência**? Ainda vale agora?
3. É **verificável** de forma independente, ou fonte única?
4. **Contradiz** algo que já sabemos? (checar KOs relacionados)
5. É **sinal** ou **ruído** para a decisão do leitor?
6. O que precisaria ser verdade para isto estar **errado**? (falsificação)

### 6.4 Como validar

Validação é gate, não formalidade: schema válido, fonte nível adequado ao Verdict pretendido, vigência confirmada, Conta reproduzível, Score fecha. Falhou qualquer um → não avança de estado (§7).

### 6.5 Como desconfiar (anti-alucinação — regra dura)

- **Nunca** inventar dado, taxa, número, fonte, vigência ou URL.
- Faltou dado → `Não confirmado`. Nunca chutar (regra inviolável 9).
- Fonte única de nível 4 → no máximo "radar", nunca recomendação.
- Se não consegue citar de onde veio, **não afirma**.
- Anti-cópia: nunca reproduzir texto/estrutura de fonte; redação própria.

### 6.6 Como representar confiança e ausência (o invariante de honestidade)

> **Invariante global I-VIGÊNCIA:** sem vigência confirmada, o Verdict é obrigatoriamente `Não confirmado`. Sem exceção, nem por pedido direto no meio da tarefa.

Ausência de informação é **explícita e visível** (`Não confirmado` + pose `lupa`), nunca um silêncio que o leitor confunda com endosso. Confiança segue §4.7 — derivada, nunca sentida.

### 6.7 Como priorizar

Ordem: (1) o que muda a decisão do leitor hoje; (2) maior confiança; (3) maior aplicabilidade; (4) vigência mais curta (janela fechando — mas sem urgência artificial na *linguagem*). Fecha logo ≠ urgência falsa: é fato de vigência.

### 6.8 Como sintetizar

Síntese preserva lineage: toda frase de saída deve ser rastreável a KOs/evidências de entrada. Densidade útil por minuto é meta (state of the art §2.1), mas nunca à custa de contexto de validade.

### 6.9 Como aprender, revisar, esquecer, reavaliar, acumular memória

- **Aprender:** ao encontrar evidência que contradiz uma heurística, emitir `Learning` e propor `Thesis vN+1` (`SUPERSEDES` vN). Humano ratifica (§8).
- **Revisar:** KOs `expired` voltam à fila de revalidação; não somem.
- **Esquecer (deprecação, não deleção):** conhecimento obsoleto vai para `deprecated/archived`, permanece auditável. **Nunca se apaga o passado.**
- **Reavaliar:** mudança de contexto (ex.: novo player) dispara reavaliação de Benchmarks afetados.
- **Acumular memória:** Entities e Benchmarks persistem entre edições/períodos (resolve D-4). A cada ciclo, o sistema sabe mais, não recomeça.

### 6.10 Anti-patterns cognitivos (proibidos)

| Anti-pattern | Por que mata o sistema | Regra que o barra |
|---|---|---|
| Preencher lacuna com plausibilidade | vira alucinação com cara de fato | §6.5 |
| "Deve ser ~X%" sem fonte | quebra determinismo | §5.3 |
| Recomendar sem vigência | desonestidade temporal | I-VIGÊNCIA |
| Copiar frase de fonte | quebra independência e legal | N-COPY |
| Urgência para engajar | quebra confiança (Sage) | inviolável 4 |
| Esconder incerteza | leitor decide errado | §6.6 |
| Publicar sozinho | remove humano do loop | §8 |

**Decisão §6:** o agente é cético por padrão, gate-guarded, e trata ausência/incerteza como cidadãs de primeira classe. Este contrato vale para qualquer IA presente ou futura.

---

## 7. Knowledge Lifecycle

O ciclo de vida completo de um KO, como máquina de estados. Cada transição tem um gate e deixa audit.

```
        ┌─────────┐  validate (§6.4)   ┌───────────┐  classify (type+Verdict)  ┌────────────┐
        │  DRAFT  │───────────────────►│ VALIDATED │──────────────────────────►│ CLASSIFIED │
        └────┬────┘   fail↩ (fica DRAFT)└─────┬─────┘                            └─────┬──────┘
             │ ingest                          │ fail: retrocede                       │ link (Entities, relations)
   external/ │                                 ▼                                        ▼
   research  │                          ┌───────────┐   review gate (audit+QA)   ┌──────────┐
             ▼                          │ RETRACTED │◄───────────────────────────│  LINKED  │
        ┌─────────┐                     └───────────┘   erro detectado           └────┬─────┘
        │ INGESTED│                                                                    │ compose+editorialize
        └─────────┘                                                                    ▼
                                                                               ┌──────────────┐
   ┌──────────────┐  measure (feedback)  ┌───────────┐   human approve (§8)   │ PUBLISHABLE  │
   │  MEASURED    │◄─────────────────────│ PUBLISHED │◄───────────────────────│ (rendered)   │
   └──────┬───────┘                      └─────┬─────┘                         └──────────────┘
          │ refine ▲                            │ vigência expira (§4.8)
          ▼        │ new evidence               ▼
   ┌──────────┐    │                      ┌───────────┐   revalidate?   ┌──────────┐
   │ REFINED  │────┘                      │  EXPIRED  │────────────────►│ ARCHIVED │
   └──────────┘                           └───────────┘   não           └────┬─────┘
                                                                              │ volta a ser relevante
                                                                              ▼
                                                                        ┌──────────────┐
                                                                        │ REDISCOVERED │──► DRAFT (novo ciclo)
                                                                        └──────────────┘
```

Fases nomeadas (protocolo EKS §6), mapeadas às transições:

| Fase | Transição | Gate | Quem |
|---|---|---|---|
| Ingestion | → INGESTED | escopo do domínio | Cowork |
| Validation | INGESTED → VALIDATED | fonte+vigência+schema | Cowork |
| Classification | VALIDATED → CLASSIFIED | type + Verdict + Score | Cowork |
| Linking | CLASSIFIED → LINKED | Entities reconciliadas | Cowork |
| Storage/Retrieval | (transversal) | identidade estável | sistema |
| Composition | LINKED → (agregado) | densidade, coerência | skill digest |
| Editorialization | → PUBLISHABLE | voz, sem urgência, N-COPY | skill + humano |
| Publication | PUBLISHABLE → PUBLISHED | **aprovação humana** | humano |
| Measurement | PUBLISHED → MEASURED | métrica de canal | sistema |
| Feedback/Refinement | MEASURED → REFINED | nova evidência | Cowork+humano |
| Deprecation | → EXPIRED/ARCHIVED | vigência/decaimento | regra automática |
| Rediscovery | ARCHIVED → REDISCOVERED | relevância retomada | Cowork |

Estados terminais só em aparência: **nada é deletado**; `ARCHIVED` e `RETRACTED` permanecem auditáveis para sempre.

**Decisão §7:** o ciclo de vida é uma máquina de estados explícita com gates e audit. A transição para `PUBLISHED` exige humano — invariante de governança.

---

## 8. Knowledge Governance

Quem pode o quê. Governança humana é inegociável (princípio AAP + prática real).

### 8.1 Papéis (RACI)

| Papel | Cria | Valida | Classifica | Aprova publicação | Deprecia/Arquiva | Nunca faz |
|---|---|---|---|---|---|---|
| **Cowork (Research Editor, IA)** | R | R | R | — | propõe | publicar; usar dado interno/CMI; copiar fonte |
| **Auditoria (skill tl-source-audit)** | — | A (parecer) | verifica | veta (G1=REPROVA) | — | criar conteúdo |
| **QA (skill tl-qa)** | — | A (gate) | — | veta (regra inviolável) | — | criar conteúdo |
| **Editor humano** | contribui | A final | A final | **A (única)** | A | delegar aprovação a IA |
| **Autoridade Arquitetural (AAP)** | RFCs | — | define taxonomia | — | define política | mudar taxonomia sem ADR |

R=responsável · A=aprovador. **Só o humano publica.** Só o AAP altera contratos (schema/taxonomia) — via ADR versionado.

### 8.2 Quem nunca altera o quê (imutáveis)

- O **passado**: audit trail, Events, versões superadas — append-only.
- O **ID canônico** de um KO — one-way door.
- As **regras invioláveis** do `CLAUDE.md` — só mudam por RFC + decisão humana explícita.
- O **disclaimer oficial** — `const` por construção.
- A **taxonomia de Verdict** — só por ADR do AAP (Apêndice C).

### 8.3 Versionamento, auditoria, explicação, rastreamento

- **Versionar:** `schemaVersion` no envelope (forma) + `version` no payload de Theses/Benchmarks (conteúdo). Passado imutável; novo é nova versão que `SUPERSEDES`.
- **Auditar:** todo KO reconstrói sua história por `audit[]` + `Events`. Critério de aceite: dado qualquer número publicado, reconstruir *quem, quando, com que evidência, por quê*.
- **Explicar:** lineage (§4.13) + scoreBreakdown + evidence tornam qualquer Verdict explicável anos depois.
- **Rastrear:** de um render (e-mail enviado) → Edition → Deals → evidências → fontes. Cadeia completa, sempre.

**Decisão §8:** governança é humano-no-loop para publicação e para mudança de contrato; IA para produção e validação; passado imutável.

---

## 9. Automation — como os canais consomem o EKS

Só agora falamos de tecnologia. Regra dura: **conhecimento é produzido uma vez; projetado para N canais.** Nenhum canal é fonte de verdade.

### 9.1 O padrão Source → Projection (renderer/channel-agnostic)

```
                       ┌──────────────────────────────┐
                       │   EDITORIAL KNOWLEDGE SYSTEM  │
                       │   (Knowledge Objects — §4)    │   ← única fonte de verdade
                       └───────────────┬──────────────┘
                                       │ serialização canônica (RFC-002 RES)
                                       ▼
                       ┌──────────────────────────────┐
                       │  Edition/Report (agregado KO) │
                       └───────────────┬──────────────┘
             ┌───────────────┬─────────┼─────────┬────────────────┐
             ▼               ▼         ▼         ▼                ▼
        ┌─────────┐    ┌──────────┐ ┌──────┐ ┌────────┐    ┌────────────┐
        │  E-mail │    │ Plaintext│ │ Web  │ │Beehiiv │    │ LinkedIn / │
        │  (HTML) │    │          │ │/edicao│ │(canal) │    │ futuras IAs│
        └─────────┘    └──────────┘ └──────┘ └────────┘    └────────────┘
         Rendition       Rendition   Rendition  Channel        Rendition/API
```

Cada saída é uma **Rendition** (projeção), não uma cópia editável. Editar a Rendition é proibido; corrige-se o KO e re-renderiza (modelo declarativo tipo K8s).

### 9.2 Consumidores, hoje e futuros

| Consumidor | Papel | Como consome o EKS | Regra |
|---|---|---|---|
| **Cowork** | produtor | escreve KOs (JSON validado) via contrato §4/RFC-002 | para no passo "validado"; nunca publica |
| **Renderer** (`renderer/*`, skill tl-digest) | projetor | lê KO → e-mail/plain/web; tokens de marca | render-agnostic; nunca inventa conteúdo; sem stock/avião/emoji |
| **Website** (`app/edicao`, `/daily`, `/pro`) | projetor | lê KO agregado → páginas React/Tailwind | Paper bg, tokens, uma h1, AA |
| **Beehiiv** | canal | recebe Rendition já pronta via API | idempotente, draft por padrão, humano confirma |
| **LinkedIn** (futuro) | canal | Rendition curta derivada do mesmo KO | mesma verdade, formato do canal |
| **Futuras IAs** | produtor/consumidor | contrato §4 + §6 (cognitivo) | herdam invariantes; nada de exceção |

### 9.3 Invariante de projeção

> **I-PROJ:** toda Rendition é função pura de um KO + um perfil de canal. Dois canais podem diferir em forma; **nunca** em julgamento (Verdict, Conta, fonte). Divergência de conteúdo entre canais é bug, não feature.

Isto resolve D-3 na direção certa: em vez de dois JSONs concorrentes, **um KO canônico** e projeções. RFC-002 (RES) especifica a serialização única; o renderer atual passa a projetar dela (migração §12).

**Decisão §9:** arquitetura Source→Projection. Canais e renderers são plugáveis; a verdade é única e a montante.

---

## 10. Design Review — atacando este documento

O protocolo exige destruir o documento antes de entregá-lo. Ataques reais e respostas:

| # | Ataque | Severidade | Resposta / mitigação |
|---|---|---|---|
| A1 | **Over-engineering:** grafo de conhecimento é pesado demais para uma newsletter diária | Alta | O grafo é *conceitual e mínimo* (§2.5). RFC-002 pode começar com KOs em arquivos JSON + Entities num índice; nada de banco de grafo obrigatório. Complexidade só quando paga (princípio 8). |
| A2 | **Acoplamento:** o envelope KO obriga muitos campos; Cowork vai emperrar | Média | Campos obrigatórios = os que já existem hoje (fonte, vigência, Verdict). O resto (`lineage`, `Thesis`) é incremental e opcional até o produto que o exigir (§15). |
| A3 | **Ambição vs realidade:** Thesis/Insight/Learning não existem; isto é aspiracional | Média | Sim — marcados como *futuros* e faseados (§15). O EKS reserva o lugar sem exigir construção imediata. Backward-compatible: adicionar tipo não quebra existentes. |
| A4 | **Redundância com CLAUDE.md** | Baixa | CLAUDE.md é regra de *marca/código*; o EKS é modelo de *conhecimento*. Complementares. O EKS aponta CLAUDE.md como fonte das regras invioláveis, não as duplica normativamente. |
| A5 | **Risco de virar outro doc-fantasma** (vide D-1) | Alta | Por isso o EKS é versionado, vive em `docs/rfc/`, e §12 exige reconciliar a hierarquia-fantasma. Doc sem gate morre; §13 dá critérios de aceite executáveis. |
| A6 | **Duas taxonomias (D-2) podem quebrar produção ao unificar** | Alta | Migração faseada com mapa de compatibilidade (§12.2). `depende→esperaria`, `nao-vale→evitaria` são mapeáveis sem perda. |
| A7 | **Determinismo vs realidade:** vigências e taxas mudam o tempo todo | Média | É justamente o ponto: decaimento é modelado (§4.8); "verdade tem prazo" (§3.1). O sistema não promete permanência, promete honestidade temporal. |
| A8 | **Escalabilidade de governança humana:** humano no loop não escala para muitos canais | Média | Humano aprova o **KO/Edition uma vez**; projeções para N canais são automáticas (§9). O gargalo humano é O(edições), não O(canais). |

**Refatorações aplicadas após o ataque:** (1) tornar `lineage`/`Thesis` explicitamente incrementais (A2/A3); (2) mover a unificação de taxonomia para um mapa de migração concreto (A6→§12.2); (3) adicionar critérios de aceite executáveis (A5→§13); (4) explicitar que o grafo pode ser "arquivos + índice" no MVP (A1).

---

## 11. Trade-offs e alternativas descartadas

| Decisão do EKS | Alternativa descartada | Por que descartada |
|---|---|---|
| KO canônico + projeções | Manter dois schemas (content + renderer) | Custo dobrado, decisão "qual JSON" que não deveria existir (D-3) |
| Grafo conceitual mínimo (arquivos+índice no MVP) | Banco de grafo (Neo4j) desde já | Complexidade e dependência sem payoff no volume atual (A1) |
| Taxonomia de Verdict única (6 valores) | Manter 7 do renderer | Quebra vocabulário canônico; `depende`/`nao-vale` redundantes (D-2) |
| Confiança derivada (tier×frescor×corroboração) | Confiança manual "alta/média/baixa" | Subjetiva, não auditável, aluciável |
| Imutabilidade + deprecação | Editar/deletar in-place | Perde auditoria e memória; impossível explicar o passado |
| Humano publica | IA publica com aprovação implícita | Remove governança; risco reputacional e legal |
| Envelope estável + payload versionado | Um schema monolítico por produto | Não escala para Weekly/Lab/Special sem reforma |
| Entities canônicas | Strings livres (como hoje: "Livelo" solto) | Sem memória, sem reconciliação, sem lineage (D-4) |
| Markdown/JSON como serialização | Beehiiv/HTML como fonte | Canal vira dono do conteúdo; anti-portabilidade (hard rule AAP) |

---

## 12. Versionamento e Migração

### 12.1 Versionamento

- **Esta RFC:** SemVer de documento. 1.0 → 1.x (emendas compatíveis) → 2.0 (mudança de modelo). Toda mudança normativa é um ADR (§14) referenciado.
- **KO:** `schemaVersion` no envelope; `version` de conteúdo em Theses/Benchmarks. Passado nunca reescrito.
- **Regra de compatibilidade:** adicionar campo opcional ou tipo novo = minor. Remover/renomear campo obrigatório ou valor de enum = major, exige migração + janela de compatibilidade.

### 12.2 Reconciliações obrigatórias (dívida descoberta em §1.3)

Ordem sugerida, cada uma vira PR próprio com QA gate:

**M-1 — Unificar taxonomia de Verdict (resolve D-2).** Mapa de migração:

| Origem (renderer) | Destino canônico |
|---|---|
| `vale-agir` | `vale-agir` |
| `vale-olhar` | `vale-olhar` |
| `depende` | `esperaria` (ou `casos-especificos` conforme contexto — decisão humana por caso) |
| `esperaria` | `esperaria` |
| `nao-vale` | `evitaria` |
| `evitaria` | `evitaria` |
| `nao-confirmado` | `nao-confirmado` |
| — (novo) | `casos-especificos` |

Passos: (1) ratificar Apêndice C; (2) alinhar `renderer/tokens.mjs` e `renderer/edition.schema.json` à taxonomia canônica; (3) atualizar `renderer/README.md`; (4) QA. Zero edição publicada muda de julgamento — só de rótulo interno.

**M-2 — Convergir as duas serializações da Edition (resolve D-3).** RFC-002 (RES) define a serialização canônica única. Estratégia: eleger `content/edition.schema.json` como base (é o "modelo editorial único" declarado), adicionar o campo faltante `o_que_evitaria`/equivalente, e reescrever o renderer para projetar dela via um adaptador temporário. Janela de compatibilidade: adaptador aceita ambos os formatos por 1 ciclo.

**M-3 — Reconciliar a hierarquia-fantasma (resolve D-1).** Duas opções (decisão humana — ver §16 Q1): (a) criar os documentos referenciados (Operating Manual, DESIGN, etc.) extraindo o conteúdo hoje implícito no código/skills; ou (b) reescrever a hierarquia do `CLAUDE.md` para apontar às fontes que existem de fato (schemas, skills, este EKS). Recomendação da Autoridade: **(b) primeiro** (barato, honesto, imediato), **(a) incremental** conforme cada doc ganhe dono.

**M-4 — Introduzir Entities e lineage (resolve D-4).** Incremental: começar por um índice de Entities (`content/entities/*.json`) e adicionar `derivedFrom` ao `tlScorePeriod` do Pro. Sem big-bang.

### 12.3 Estratégia de migração (princípios)

Expand → migrate → contract. Nunca quebra-tudo. Cada reconciliação: aditiva primeiro, período de dupla escrita/leitura, depois remoção do legado. Sempre atrás do QA gate. Sempre reversível em um passo (two-way door) exceto IDs canônicos.

---

## 13. Critérios de aceite e checklists

### 13.1 Critérios de aceite do EKS (o documento está "bom o suficiente para 10 anos"?)

O EKS v1.0 é aceito quando um leitor consegue responder **sim** a todos:

- [ ] Consigo classificar qualquer artefato editorial atual como um KnowledgeType (§4.4)?
- [ ] Cada campo obrigatório do envelope KO existe hoje ou tem caminho incremental (§4, §15)?
- [ ] Toda afirmação publicável é rastreável a uma fonte de nível conhecido (§4.6, §6)?
- [ ] Ausência e incerteza têm representação de primeira classe (§4.7, §6.6)?
- [ ] Existe uma taxonomia de Verdict **única** e um mapa de migração das divergentes (§5.5, §12.2)?
- [ ] Nenhum canal é fonte de verdade; todos são projeções (§9)?
- [ ] Publicação exige humano; contrato só muda por ADR (§8)?
- [ ] O passado é imutável e auditável (§4.14, §7, §8.2)?
- [ ] Novos produtos (Weekly/Lab/Special) cabem sem reformar o envelope (§4.1)?
- [ ] As divergências descobertas (D-1..D-5) têm plano de reconciliação (§12)?

### 13.2 Checklist de aceite de um Knowledge Object (operacional, para Cowork/QA)

- [ ] Tem `id` estável e `type` válido?
- [ ] `evidence[]` ≥ 1 com fonte e URL https; nível adequado ao Verdict pretendido?
- [ ] `vigencia` presente? Se ausente → Verdict é `Não confirmado`?
- [ ] `conta.result` reproduzível a partir de `rows` + fórmulas públicas?
- [ ] Se há `scoreBreakdown`, soma ponderada fecha com `tlScore`?
- [ ] `verdict` está na taxonomia canônica (6 valores) e coerente com a faixa do Score?
- [ ] Contexto de validade explícito ("para quem", "até quando")?
- [ ] Redação própria (N-COPY); zero emoji; zero urgência artificial?
- [ ] Disclaimer oficial íntegro quando há recomendação?
- [ ] Sem dado interno/CMI/métrica proprietária?
- [ ] Passa `npm run validate` / `daily:validate` com 0 erros?

### 13.3 Checklist de mudança de contrato (para a Autoridade)

- [ ] A mudança tem ADR (§14)?
- [ ] É aditiva (minor) ou quebra (major)? Se major, há migração e janela?
- [ ] Nenhuma RFC anterior é contradita?
- [ ] Passado permanece legível?
- [ ] Humano ratificou?

---

## 14. ADR Candidates

Decisões arquiteturais candidatas, prontas para ratificação. Formato curto (contexto → decisão → consequência). Cada uma responde à Decision Matrix do AAP.

- **ADR-001 — Knowledge Object como unidade canônica.** Contexto: conhecimento hoje vive em JSONs de canal (D-3). Decisão: adotar o envelope KO (§4.2) como modelo canônico; serializações o projetam. Consequência: um contrato para todos os produtos; migração M-2. Alternativa descartada: schema por canal.
- **ADR-002 — Taxonomia de Verdict única (6 valores).** Decisão: Apêndice C é canônica; `depende`/`nao-vale` deprecados. Consequência: migração M-1; renderer alinhado. Trade-off: mexe em código do renderer.
- **ADR-003 — Confiança derivada e de primeira classe.** Decisão: `KnowledgeConfidence` (§4.7) computada de tier×frescor×corroboração×contradição. Consequência: `Não confirmado` deixa de ser ad hoc. 
- **ADR-004 — Invariante de vigência.** Decisão: sem vigência ⇒ `Não confirmado`, global e inegociável (§6.6). Consequência: honestidade temporal por construção.
- **ADR-005 — Imutabilidade do passado + deprecação.** Decisão: nunca deletar/editar in-place; superar/arquivar. Consequência: auditoria e memória garantidas; custo de storage cresce (aceitável).
- **ADR-006 — Governança: humano publica, AAP muda contrato.** Decisão: §8. Consequência: gargalo humano O(edições), não O(canais).
- **ADR-007 — Source→Projection (renderer/channel-agnostic).** Decisão: §9. Consequência: LinkedIn e futuros canais entram sem tocar no conhecimento.
- **ADR-008 — Entities canônicas + lineage incremental.** Decisão: introduzir índice de Entities e `derivedFrom` (M-4). Consequência: acúmulo de memória; base para Thesis.
- **ADR-009 — Reconciliar a hierarquia-fantasma.** Decisão: reapontar `CLAUDE.md` para fontes reais primeiro (M-3b), criar docs faltantes incrementalmente (M-3a). Consequência: fim das referências órfãs.
- **ADR-010 — RFC como fonte de verdade arquitetural, versionada em `docs/rfc/`.** Decisão: toda decisão de contrato vive como RFC/ADR. Consequência: não repete o erro D-1.

Status inicial de todos: **Proposed** (aguardando ratificação humana — §16 Q1).

---

## 15. Roadmap

Faseado para não exigir big-bang. Cada fase entrega valor e é reversível.

```
FASE 0 — Fundação (esta RFC)                        [ ← você está aqui ]
  · Ratificar EKS v1.0 e Apêndice C (taxonomia)
  · Aprovar ADRs 001–010 (Proposed → Accepted)

FASE 1 — Reconciliação (dívida descoberta)          [ semanas ]
  · M-1 taxonomia única (renderer alinha)
  · M-3b reapontar hierarquia CLAUDE.md p/ fontes reais
  · RFC-002 (RES): serialização canônica da Edition

FASE 2 — Convergência de serialização                [ 1 ciclo ]
  · M-2 renderer projeta do schema canônico (adaptador temporário)
  · Contract: remover schema duplicado

FASE 3 — Memória                                     [ incremental ]
  · M-4 Entities canônicas + lineage no Pro
  · Benchmarks persistentes entre períodos

FASE 4 — Acúmulo editorial                           [ quando houver Lab/Weekly ]
  · Thesis / Insight / Learning como KOs
  · Rediscovery de conhecimento arquivado
  · RFC-003 (CRS), RFC-004 (PES), RFC-005 (AES)
```

Nada na Fase 3–4 é pré-requisito para operar hoje. O sistema **funciona na Fase 0/1** e melhora composto ao longo dos anos.

---

## 16. Perguntas abertas e riscos

### 16.1 Perguntas abertas (precisam de decisão humana)

- **Q1 — Ratificação e D-1:** aprovar os ADRs 001–010? E resolver a hierarquia-fantasma por reaponte (M-3b) ou por criação dos docs (M-3a)? *Recomendação: aprovar ADRs; M-3b primeiro.*
- **Q2 — `depende` → mapeamento:** ao unificar Verdict, `depende` vira `esperaria` ou `casos-especificos`? Pode depender do caso; definir regra default. *Recomendação: default `esperaria`; `casos-especificos` quando o julgamento for "existe público, mas estreito".*
- **Q3 — Persistência de Entities/Benchmarks:** arquivos versionados (git) bastam por quanto tempo, ou haverá índice/DB? *Recomendação: arquivos+git até volume justificar índice; decidir em RFC-002.*
- **Q4 — Onde vivem Theses:** produto Lab, seção do Pro, ou store transversal? Afeta RFC-004 (PES).
- **Q5 — Métrica de sucesso do conhecimento:** o que é "MEASURED"? Aberturas? Cliques? Acerto do Verdict no tempo (o Deal envelheceu bem)? *Recomendação: registrar acerto do Verdict como o KPI editorial de longo prazo.*

### 16.2 Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| EKS vira doc-fantasma (como D-1) | Média | Alto | Gates executáveis (§13), viver em `docs/rfc/`, ADRs ratificados |
| Migração de taxonomia quebra produção | Baixa | Alto | Mapa M-1 + QA gate + zero mudança de julgamento |
| Over-engineering afasta operação diária | Média | Médio | Fase 0/1 mínima; Entities/Thesis incrementais |
| Governança humana vira gargalo | Baixa | Médio | Aprovação O(edições); projeções automáticas |
| Conhecimento continua sem acumular | Média | Alto (10 anos) | Fase 3 (Entities/lineage) priorizada assim que o diário estabilizar |
| Drift volta (novos campos divergem) | Média | Médio | Envelope estável + `schemaVersion` + ADR obrigatório para contrato |

---

## Apêndice A — Glossário

Dado, Informação, Conhecimento, Insight, Tese, Evidência, Hipótese, Verdade, Confiança, Contexto, Sinal, Ruído, Aprendizado, Memória, Inteligência editorial, Descoberta: ver §3.1. Knowledge Object/Entity/Event/Relationship/Source/Evidence/Confidence/Freshness/Lifecycle/Lineage/Audit: ver §4. Rendition, Projection, Channel: ver §9.

## Apêndice B — Índice de invariantes

| ID | Invariante | Seção |
|---|---|---|
| I-VIGÊNCIA | Sem vigência confirmada ⇒ Verdict `Não confirmado` | §6.6 |
| I-DEAL | Verdict acionável exige fonte 1–2 + vigência + score coerente | §4.5 |
| I-CONTA | `result` reproduzível das `rows`; sem número mágico | §4.9, §5.3 |
| I-SCORE | Soma ponderada do breakdown fecha com `tlScore` | §5.4 |
| I-PROJ | Rendition = f(KO, canal); julgamento idêntico entre canais | §9.3 |
| N-COPY | Nunca copiar texto/estrutura de fonte; redação própria | §4.6, §6.5 |

## Apêndice C — Taxonomia canônica de Verdict (normativa)

Fonte única de verdade para o veredito. Resolve D-2. Qualquer código, schema, prompt ou UI diverge = bug.

| Token canônico | Rótulo (grafia fixa) | Faixa Score | Cor | Confiança |
|---|---|---|---|---|
| `vale-agir` | Vale agir | 85–100 | green-600 `#00A878` | confirmed |
| `vale-olhar` | Vale olhar | 70–84 | blue-600 `#315CFF` | confirmed/probable |
| `casos-especificos` | Só para casos específicos | 55–69 | gray-400 `#8A8578` | probable |
| `esperaria` | Esperaria | 40–54 | yellow-500 fill / Ink | probable |
| `evitaria` | Evitaria | 0–39 | red-600 `#D64545` | confirmed/probable |
| `nao-confirmado` | Não confirmado | s/ dado | gray-400 tracejado | unconfirmed |

Deprecados (migram, ver §12.2): `depende` → `esperaria`/`casos-especificos`; `nao-vale` → `evitaria`.

## Apêndice D — Mapa domínio → artefato real (rastreabilidade da modelagem)

| Conceito EKS | Onde vive hoje | Estado |
|---|---|---|
| Edition (KO agregado) | `content/editions/NNNN.json` | existe (schema a convergir, D-3) |
| Report (KO agregado) | `content/pro/AAAA-MM.json` | existe |
| Deal | `deals[]` | existe |
| Conta | `conta{rows,result}` | existe |
| TL Score / breakdown | `tlScore` / `scoreBreakdown` | existe |
| Verdict | `verdict` | existe (taxonomia a unificar, D-2) |
| Source/Evidence | `sources[]`, `source`, `sourceUrl` | existe (nível informal em texto) |
| Freshness/Vigência | `vigencia` | existe |
| Benchmark/PlayerMove/Matrix | `pro-report.schema.json` | existe |
| Entity | — | **a criar** (M-4) |
| Confidence (1ª classe) | implícito (`nao-confirmado`, nível) | **a promover** (ADR-003) |
| Thesis/Insight/Learning | — | **futuro** (Fase 4) |
| Lineage/Audit | — | **a criar** incremental |
| Rendition | `out/email`, `out/plain`, `/edicao`, Beehiiv | existe |

## Apêndice E — Status de implementação (vivo)

Registro do que já saiu do papel. Atualizar a cada entrega. Não altera as decisões acima — só marca o progresso.

| Item | Estado | Onde |
|---|---|---|
| **Fase 1.1** — CI gate (validate/render/qa/build) | ✅ já existia | `.github/workflows/ci.yml` |
| **Fase 1.2** — Testes das funções puras (R-1) | ✅ entregue | `tests/stats.test.mjs`, `tests/lib.test.mjs`, job `test` no CI |
| Achado: `URGENCY_RE` não pegava "última chance" (acento) | ✅ corrigido | `scripts/lib.mjs` (fronteiras Unicode) |
| **M-1** — Taxonomia de Verdict única (D-2) | ✅ entregue | `scripts/taxonomy.mjs` (fonte única), `tests/taxonomy.test.mjs` (trava) |
| **M-2** — Convergência (núcleo de taxonomia) | ✅ núcleo entregue | ambos os pipelines derivam de `taxonomy.mjs`; parity test |
| **M-2** — Convergência total da serialização (D-3) | ⏳ deferido | requer RFC-002 (RES) + revisão humana |
| **M-3** — Hierarquia-fantasma (D-1) | ⏳ pendente | decisão humana (Q1): reapontar vs criar docs |
| **M-4** — Entities + lineage (D-4) | ✅ base entregue | `content/entities/`, `content/entity.schema.json`, `tlScorePeriod.derivedFrom` |
| ADRs 001–010 | 🟡 Proposed | aguardam ratificação humana (§16 Q1) |

Deprecações em janela de compatibilidade (RFC §12.2): `depende → esperaria`, `nao-vale → evitaria` — ainda resolvem, remover na v2 da taxonomia.

---

*Fim do RFC-001 — The Loyalty Editorial Knowledge System v1.0.*
*Próximo na cadeia AAP: RFC-002 (RES — Serialização canônica). Nenhuma RFC posterior pode contradizer esta sem emenda versionada e ratificação humana.*
