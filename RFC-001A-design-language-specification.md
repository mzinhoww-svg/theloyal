# RFC-001A — The Loyalty Design Language Specification (DLS)

**Version 1.0**
**Status:** Founding · Normative · Channel-independent
**Authority:** Distinguished Engineer / Principal Design Systems Architect / Principal Information Architect, sob o Architectural Authority Protocol (AAP).
**Precede:** toda implementação futura (Website, Beehiiv, PDF, LinkedIn, RSS, API, CLI, App, Slides, Dashboard) e todo agente (Claude Research, Claude Cowork, qualquer IA/automação).
**Sucede:** DDD-001 (Discovery), DDD-002 (Decision), RFC-001 Blueprint.

> **O que este documento é.** A especificação fundadora da **linguagem** do The Loyalty: como o conhecimento é percebido, organizado, lido e comunicado — **independente de tecnologia**. Uma equipe que nunca viu o código atual deve conseguir construir qualquer canal apenas interpretando este documento.
>
> **O que este documento não é.** Não define React, Next.js, Tailwind, Beehiiv, HTML, CSS ou qualquer renderer. Não contém código. Define a **gramática** que todos eles devem obedecer.
>
> **A Única Verdade.** Existe uma só verdade: **o conhecimento**. Todo o resto — e-mail, página, PDF, post, feed — é **representação**. O domínio **nunca** conhece um canal. Um canal **nunca** inventa conhecimento. Esta é a lei que a DLS protege.

---

## 0. Convenções normativas

### 0.1 Palavras-chave (RFC-2119 adaptado)

- **DEVE / NÃO DEVE** — requisito absoluto. Quebrá-lo é não-conformidade.
- **DEVERIA / NÃO DEVERIA** — requisito forte; exceções exigem justificativa registrada.
- **PODE** — opcional, à discrição do implementador de canal.
- **NUNCA** — proibição inviolável (herda o peso das regras invioláveis do CLAUDE.md).

### 0.2 Camadas de conformidade

Um canal declara seu **nível de conformidade** com a DLS:

```
Nível A  (Essencial)   Semântica + hierarquia + acessibilidade + regras invioláveis.
Nível AA (Editorial)   A + gramática editorial completa + ritmo + progressive disclosure.
Nível AAA(Assinatura)  AA + expressão de marca plena (tipografia, cor, mascote, data-art).
```

Beehiiv/e-mail e PDF miram **AA** (expressão limitada pelo meio). Website mira **AAA**. RSS/API miram **A**. Nenhum canal DEVE cair abaixo de **A**.

### 0.3 Como ler

Este documento vai do abstrato ao concreto: filosofia → gramática → arquitetura da informação → sistema → componentes → governança. Cada Parte é normativa salvo onde marcada *(não-normativo: contexto)*.

### 0.4 Relação com os documentos anteriores

```
CLAUDE.md ............. contrato de marca e regras invioláveis (fonte moral)
DDD-001 ............... o que o domínio É (descoberta)
DDD-002 ............... o que o domínio DECIDE (decisões vinculantes)
RFC-001 Blueprint ..... como a RFC-001 se estrutura (esqueleto de implementação)
RFC-001A (este) ....... a LINGUAGEM que toda representação obedece
```

Onde a DLS conflitar com uma decisão de implementação do DDD-002, a DLS governa a **camada de linguagem** (percepção, semântica, leitura); o DDD-002 governa a **camada de domínio** (modelo, dados, pipeline). Conflitos reais são registrados como **ADR candidatos** (Apêndice A) — não resolvidos silenciosamente.

---

# PARTE I — DESIGN DISCOVERY
*(Fase 1 · fundação conceitual · parcialmente não-normativa)*

## 1.1 O que é uma Design Language

Uma **Design Language** (DL) não é um kit de UI, uma paleta ou uma biblioteca de componentes. É o **sistema de significado** que torna qualquer artefato reconhecível como pertencente a uma mesma plataforma — em qualquer meio, por qualquer autor, ao longo do tempo. Um *design system* é a **implementação** de uma DL num conjunto de tecnologias; a DL é a **gramática** que sobrevive à troca de tecnologia.

Analogia normativa: a DL está para o design system assim como uma **língua** está para um **dicionário de uma editora**. A língua define o que pode ser dito e como se estrutura sentido; o dicionário fixa grafias numa edição. Trocar de dicionário (Tailwind → outro) não muda a língua.

## 1.2 As oito camadas da linguagem

A DLS distingue oito camadas. Confundi-las é a origem histórica da inconsistência do The Loyalty (ver DDD-001: dois modelos, três taxonomias, kernel triplicado). Cada camada tem dono e fronteira.

```
┌──────────────────────────────────────────────────────────────────────┐
│  CONTENT LANGUAGE      o que é dito (fatos, contas, vereditos)         │  ← domínio
│  EDITORIAL GRAMMAR     como o dito se organiza em uma peça              │  ← domínio/editorial
│  INFORMATION LANGUAGE  como o sentido é hierarquizado e revelado       │  ← IA
│  EDITORIAL IDENTITY    a voz: cética, analítica, Sage                   │  ← marca editorial
│  INTERACTION LANGUAGE  como o leitor navega/decide (scan, disclosure)  │  ← IA/UX
│  VISUAL GRAMMAR        como peso, espaço e cor carregam significado     │  ← design
│  VISUAL IDENTITY       tipografia, cor, mascote, data-art (assinatura) │  ← marca visual
│  BRAND                 a promessa e o arquétipo (por que confiar)      │  ← marca (topo)
└──────────────────────────────────────────────────────────────────────┘
        abstrato/duradouro  ───────────────────────────►  concreto/mutável
```

| Camada | Pergunta que responde | Muda com |
|---|---|---|
| Brand | Por que confiar? | quase nunca |
| Editorial Identity | Como soa? | raramente |
| Visual Identity | Como se parece? | por rebrand |
| Editorial Grammar | Como se estrutura a peça? | por evolução de produto |
| Information Language | Como se lê e decide? | raramente |
| Interaction Language | Como se navega? | por canal |
| Visual Grammar | Como o peso significa? | quase nunca |
| Content Language | O que é dito? | a cada edição |

**Regra fundadora (F-1):** as camadas superiores (Brand, Identity, Grammars, Information) são **channel-agnostic** e DEVEM ser idênticas em todos os canais. Apenas **Interaction** e a *realização* de Visual Identity variam por canal. Um canal NUNCA reinterpreta Brand, Editorial Grammar, Information Language ou Content Language.

## 1.3 Qual problema uma DLS resolve

1. **Entropia de consistência.** Sem uma DL, cada superfície diverge (comprovado: DDD-001 achou dois "Daily", três vereditos, dois nomes de marca). A DL é a força restauradora.
2. **Custo de onboarding.** Uma equipe nova reimplementa por interpretação da linguagem, não por engenharia reversa do código.
3. **Independência de fornecedor.** Beehiiv/Vercel/qualquer SaaS vira detalhe; a linguagem persiste (DDD-002 R-06).
4. **Escala editorial.** 1 ou 20 produtos, 2 ou 2.000 edições: a gramática não muda, só o volume.
5. **Confiança.** No The Loyalty a consistência **é** o produto — credibilidade se demonstra por método, e método se percebe por consistência (arquétipo Sage).

## 1.4 Prior art *(não-normativo: contexto)*

Estudamos oito sistemas. Extraímos padrões; descartamos o que não serve a uma **mídia editorial de confiança**.

| Sistema | Essência | Adotar | Descartar |
|---|---|---|---|
| **Stripe** | clareza extrema, densidade calma, docs como produto, "mostrar a conta" | densidade calma; números como cidadãos de 1ª classe; exemplos > adjetivos | estética SaaS/produto; gradientes de marketing |
| **Apple HIG** | deferência ao conteúdo, hierarquia por tipografia, restrição | deferência ao conteúdo; hierarquia tipográfica; "clareza, deferência, profundidade" | densidade baixa demais para leitura densa; foco em toque/gesto |
| **IBM Carbon** | tokens em camadas, grid 2x, governança rígida, temas | **arquitetura de tokens semânticos**; governança formal; multi-tema | peso corporativo; escala industrial excessiva |
| **Material** | elevação, motion expressivo, componentes ricos | acessibilidade sistemática; estados definidos | elevação/sombra; motion expressivo (conflita com sobriedade) |
| **Atlassian** | tom de voz codificado, conteúdo+design juntos | **content language como parte do sistema**; guia de voz | densidade de produto/app |
| **GOV.UK** | prosa como interface, "design a partir do conteúdo", A11y radical, plain language | **conteúdo primeiro**; acessibilidade como lei; testar com o texto real | austeridade estatal; ausência de assinatura de marca |
| **Material/GOV.UK combinados** | — | plain-language + tokens | — |
| **Vercel/Geist** | monocromático, tipografia técnica, mono para dados, dark-first | **mono para dados**; sobriedade; dark como par legítimo | frieza técnica sem calor editorial |

**Síntese (F-2):** o The Loyalty senta na interseção de **GOV.UK (conteúdo primeiro, A11y como lei)** + **Stripe (a conta é dado, densidade calma)** + **Carbon (tokens semânticos + governança)** + **Atlassian (a voz faz parte do sistema)**, com a **sobriedade editorial** que exclui o expressivo (Material) e o frio (Geist puro). Nenhum deles resolve **representação de incerteza e risco financeiro** — essa é contribuição original da DLS (Parte II e VI).

---

# PARTE II — DESIGN PHILOSOPHY
*(Fase 2 · normativa)*

## 2.1 Doutrina Sage

O The Loyalty é uma autoridade cuja legitimidade vem do **método**, não do tom. A linguagem, portanto, **mostra o trabalho** em vez de afirmar competência. Tudo o que a plataforma exibe DEVE poder ser verificado pelo leitor. Isto gera a diretriz-raiz:

> **F-3 (A Imagem é Dado).** Toda expressão visual DEVE carregar informação. Ornamento sem dado é proibido. Onde a maioria das mídias mostra foto, o The Loyalty mostra a conta.

## 2.2 Os dez princípios da linguagem

Numerados, normativos, invocáveis por ID em revisões (P-1…P-10).

- **P-1 · Conhecimento antes de canal.** A peça é escrita como conhecimento; o canal apenas a projeta. Nenhuma decisão editorial PODE depender do meio.
- **P-2 · A conta é o herói.** O cálculo aberto é o elemento de maior peso semântico de qualquer edição. Números de análise têm tratamento tipográfico próprio e inconfundível (monoespaçado). *(liga DDD-002 R-CORE)*
- **P-3 · Ceticismo estrutural.** A dúvida é representável de primeira classe. "Não confirmado" NUNCA é ausência de conteúdo — é um estado explícito, desenhado, com dignidade igual à de uma recomendação. *(liga regra inviolável 9)*
- **P-4 · Sem sensacionalismo.** NUNCA urgência artificial, superlativo vazio, contagem regressiva, vermelho de pânico, promessa de ganho. A intensidade vem do dado, não do adjetivo.
- **P-5 · Hierarquia é significado.** Posição, peso e espaço comunicam importância **antes** da cor. Remova toda a cor: a hierarquia DEVE sobreviver.
- **P-6 · Cor é semântica, nunca decoração.** Cada matiz tem um significado fixo (afirmar/observar/esperar/evitar/incerto/sinal). Usar cor fora do seu significado é não-conformidade. *(liga DDD-002 DR-05/DR-07)*
- **P-7 · Densidade calma.** Alta densidade informacional com baixa ansiedade visual: espaço generoso entre blocos, ritmo previsível, zero ruído.
- **P-8 · Progressive disclosure.** O leitor entende em camadas: veredito → conta → contexto → evidência. Cada camada é opcional para quem já decidiu.
- **P-9 · Acessibilidade é lei, não recurso.** Contraste AA, alvos, foco, movimento reduzido, semântica textual do veredito são gates de publicação, não melhorias. *(liga DDD-002 DR-25)*
- **P-10 · Consistência é confiança.** A mesma coisa PARECE a mesma coisa em todo canal e toda edição. Divergência percebida = credibilidade perdida.

## 2.3 Como a linguagem comunica cada coisa

| A plataforma comunica… | …assim (normativo) |
|---|---|
| **Conhecimento** | como afirmação verificável, sempre com fonte alcançável; nunca opinião sem lastro |
| **Cálculo** | como "conta feita": entrada→entrada→resultado, em mono, com o resultado destacado |
| **Incerteza** | como estado explícito e nomeado ("Não confirmado"), visualmente distinto de "ruim" |
| **Risco** | como categoria própria ("O que evitaria" / Warning), separada da recomendação positiva |
| **Contexto** | como prosa curta que explica *por que* o mercado se moveu, nunca como recheio |
| **Confiança** | pela exposição do método (fórmula pública, nível de fonte, vigência, disclaimer) |
| **Recomendação** | como veredito nomeado + faixa numérica auditável (TL Score), nunca como "compre" |

## 2.4 Modelo de construção de confiança

```
        MÉTODO EXPOSTO                 →   PERCEPÇÃO DE RIGOR
  (fórmula, fonte, vigência, nível)         (o leitor vê o trabalho)
                                                     │
        CONSISTÊNCIA                    →            ▼
  (mesma coisa parece o mesmo)              PREVISIBILIDADE  →  CONFIANÇA
                                                     ▲
        RECUSA A EXAGERAR               →            │
  (sem urgência, sem promessa)               AUSÊNCIA DE MANIPULAÇÃO
```

**F-4:** confiança é uma função de (método exposto × consistência × recusa a manipular). A DLS existe para maximizar as três. Qualquer decisão de design que aumente conversão às custas de uma delas DEVE ser rejeitada.

## 2.5 Anti-sensacionalismo (catálogo de proibições)

NUNCA: contagem regressiva; "imperdível/corra/última chance/garanta já/milhas grátis"; vermelho como alarme de urgência (vermelho é reservado a *veredito Evitaria* e *risco*, não a pressão); superlativo sem número; emoji no corpo editorial; foto de estoque, avião, cartão 3D; gradiente decorativo; promessa de ganho; o mascote falando em 1ª pessoa com promessa. Estas proibições são **camada Brand** (F-1) e valem em **todos** os canais e níveis de conformidade.

---

# PARTE III — EDITORIAL LANGUAGE (GRAMÁTICA EDITORIAL)
*(Fase 3 · normativa)*

## 3.1 A ontologia editorial

A linguagem editorial tem **nove tipos semânticos** de conhecimento. Cada peça do The Loyalty é composta desses tipos e de nada mais. Definir isto com precisão elimina a ambiguidade histórica (DDD-001 §3).

```
KNOWLEDGE (supertipo)
├─ INSIGHT        leitura interpretativa; o "por que importa" acima do fato
├─ SIGNAL         o que mudou de verdade hoje; a tese do dia (1 por edição)
├─ DEAL           uma oportunidade concreta submetida a julgamento
│   ├─ CALCULATION   a conta feita que sustenta o Deal
│   ├─ EVIDENCE      fonte + nível + vigência que autoriza o Deal
│   ├─ RECOMMENDATION o veredito + TL Score derivado
│   └─ CONTEXT       por que o movimento aconteceu
├─ WARNING        risco explícito; "o que evitaria"; categoria própria
└─ CONTEXT        (também autônomo) pano de fundo de mercado
```

### 3.2 Definições precisas (glossário semântico normativo)

| Tipo | Definição | NÃO é | Cardinalidade por edição |
|---|---|---|---|
| **Insight** | Interpretação que agrega sentido a fatos; a camada "e daí?". | fato bruto; opinião sem lastro | 0..n |
| **Signal** | A mudança real do dia, filtrada do ruído; a tese que organiza a edição. | manchete; repost; comunicado requentado | **1 (obrigatório)** |
| **Deal** | Oportunidade concreta com conta, evidência e veredito. | promoção anunciada sem conta | 0..3 no Deal Desk |
| **Calculation** | Cálculo aberto e auditável (CPM/VPM/spread/preço implícito). | número sem fórmula; taxa assumida | 1 por Deal |
| **Context** | O porquê do movimento; comportamento que a empresa induz. | recheio; adjetivação | 0..1 por Deal + 0..n autônomo |
| **Evidence** | Fonte com URL, nível (1–5) e vigência confirmada. | print; rumor; grupo fechado | ≥1 por Deal |
| **Recommendation** | Veredito nomeado + TL Score, para quem vale. | "compre"; promessa | 1 por Deal |
| **Warning** | Risco explícito, categoria própria e obrigatória. | veredito negativo disfarçado | ≥1 (o "O que evitaria") |
| **Knowledge** | O supertipo; tudo acima é uma forma de conhecimento. | — | — |

**Distinção crítica (F-5):** **Recommendation** e **Warning** são eixos **ortogonais**. Um Deal tem uma recomendação (agir…evitaria). Um Warning é risco declarado que existe *independente* da recomendação — inclusive num Deal "Vale agir" ("vale agir, **mas** cuidado com X"). A linguagem NUNCA colapsa risco dentro do veredito. *(Esta é a correção de um acoplamento latente detectado na revisão do DDD-002; ver ADR-A3.)*

**Distinção crítica (F-6):** **Certeza** (confirmado / não confirmado) é um terceiro eixo, ortogonal a recomendação e risco. "Não confirmado" **não** é o pior veredito — é a **ausência de veredito** por falta de dado. A representação DEVE separar visualmente o eixo *certeza* do eixo *recomendação* (ver 6.9 e ADR-A1).

## 3.3 Gramática de composição da edição

Uma edição é uma sentença bem-formada nesta gramática (EBNF conceitual):

```
Edição        := Abertura? Sinal Índice? DealDesk FechaLogo? Watches? Lab?
                 Warning Leitura? Fontes Disclaimer Rodapé
Sinal         := Insight                         (exatamente 1)
DealDesk      := Deal{1,3}
Deal          := Titulo Contexto Calculation Evidence Recommendation Warning?
Warning       := "O que evitaria" (obrigatório na edição)
Fontes        := Evidence{1,n}
Disclaimer    := <frase oficial, íntegra>        (obrigatório, imutável)
```

**Regras de boa-formação (normativas):**
- **G-1:** Uma edição sem Sinal é malformada.
- **G-2:** Um Deal sem Calculation **e** Evidence **e** Recommendation é malformado (não entra no Deal Desk; vira Watch/radar).
- **G-3:** Uma Recommendation sem Evidence de vigência confirmada DEVE ser `Não confirmado` (herda DDD-002 DR-09).
- **G-4:** Toda edição com Recommendation carrega o Disclaimer íntegro.
- **G-5:** O Deal Desk NUNCA excede 3 Deals; excesso vira Watch.

## 3.4 Ciclo de vida da informação

Conhecimento **nasce, cresce, madurece e morre** — mas o **registro** nunca morre (DDD-002 DR-15/DR-16).

```
        NASCE                 CRESCE                MADURECE            MORRE
   sinal de mercado  →  candidato validado  →  Deal com veredito  →  vigência expira
   (nível 4/5:radar)     (vigência conf.)       (publicado)          (oferta acaba)
        │                     │                      │                    │
        ▼                     ▼                      ▼                    ▼
   NÃO é conhecimento   vira conhecimento     é conhecimento        é HISTÓRICO
   ainda                transitório           publicado (imutável)  (permanece como registro)
```

- **Transitório:** vigência, "fecha logo", radar não confirmado. Expira.
- **Permanente:** fórmulas, taxonomia, disclaimer, método. Não expira.
- **Histórico:** a edição publicada. Imutável; corrigível só por **Errata versionada**. Nunca arquivada nem apagada.

**F-7:** a morte da *oferta* (vigência) NUNCA é a morte da *edição*. Um Deal expirado permanece visível no arquivo, marcado como expirado. O leitor pode auditar o passado — isso *é* credibilidade.

---

# PARTE IV — INFORMATION ARCHITECTURE
*(Fase 4 · normativa)*

## 4.1 As quatro hierarquias simultâneas

Cada edição é lida por quatro "leitores" ao mesmo tempo. A IA DEVE servir aos quatro sem conflito.

```
1. INFORMATION HIERARCHY   importância intrínseca do conhecimento
2. READING HIERARCHY       ordem em que o texto é lido linearmente
3. DECISION HIERARCHY      ordem em que o leitor decide agir
4. SCANNING HIERARCHY      ordem em que o olho salta antes de ler
```

**Alinhamento canônico (F-8):** as quatro hierarquias DEVEM convergir no mesmo ápice — a **Recommendation (veredito + TL Score)** e a **Calculation**. Quem escaneia, quem lê, quem decide e o que é mais importante encontram o mesmo pico. Divergência entre hierarquias é um defeito de IA.

Ordem canônica de peso decrescente:

```
Veredito+TL Score  >  Conta feita  >  Sinal do dia  >  Contexto  >
Evidência/Fonte    >  Fecha logo   >  Watches       >  Rodapé/Disclaimer
```

O Disclaimer é **baixo em atenção** e **alto em obrigatoriedade** — a IA reconcilia isso: sempre presente, nunca competindo por atenção.

## 4.2 Modelo de atenção e leitura

A edição promete **5 minutos**. Isso é um **contrato de atenção**, não uma métrica frouxa. Consequências normativas:

- **A-1:** o valor essencial (Sinal + veredito de cada Deal) DEVE ser extraível em **≤60 segundos** por scanning, sem leitura linear.
- **A-2:** a leitura completa DEVE caber em ~5 min para densidade típica (1 Sinal + até 3 Deals + Warning + Fontes).
- **A-3:** seções secundárias (Watches, Lab, Sinais rápidos, Sua leitura) são **opcionais à atenção** — progressive disclosure; sua ausência não quebra a edição, sua presença não estoura o contrato.

**Tensão registrada (risco cognitivo R-COG-1):** o modelo de 19 seções (DDD-001) versus o contrato de 5 minutos. A DLS resolve por **densidade em camadas**: as seções existem, mas a hierarquia garante que só as camadas 1–2 são obrigatórias à leitura. Um canal NUNCA DEVE apresentar as 19 seções com peso uniforme (seria ruído). Ver ADR-A4.

## 4.3 Progressive disclosure (modelo de camadas)

```
CAMADA 0  (glance)      Veredito + TL Score + Fecha logo         ~10s
CAMADA 1  (scan)        + Sinal do dia + títulos dos Deals        ~60s
CAMADA 2  (read)        + Conta feita + Contexto                  ~3min
CAMADA 3  (verify)      + Evidência/Fonte + fórmula + vigência    ~5min
CAMADA 4  (deep)        + Watches + Lab + Sua leitura + Pro        opcional
```

**D-1:** cada camada DEVE ser compreensível sozinha. Quem para na Camada 0 obteve uma decisão honesta; quem vai à Camada 3 obteve a auditoria. **D-2:** nenhuma camada esconde uma ressalva material que mudaria a decisão da camada anterior (proibido "enterrar" o risco em camada profunda).

## 4.4 Ritmo, densidade e cadência

- **Ritmo editorial:** blocos separados por respiro previsível; o olho aprende o pulso da edição. Um "SectionLabel" (divisor + rótulo) marca cada mudança de tipo semântico.
- **Densidade:** alta em informação, baixa em ornamento (P-7). Medida: proporção sinal/ruído → 100% do peso visual carrega dado.
- **Cadência de produto:** Daily = pulso diário curto (SEG–SEX 8h); Pro = pulso mensal denso. A cadência é **camada Brand** e NUNCA muda por canal.

## 4.5 Peso visual × peso semântico (a equação de peso)

```
PESO VISUAL PERCEBIDO  DEVE SER PROPORCIONAL A  PESO SEMÂNTICO
```

**F-9 (Lei do Peso):** o elemento com maior peso semântico (veredito, conta) DEVE ter o maior peso visual (tamanho, contraste, posição, espaço ao redor). É **proibido** dar peso visual a elemento de baixo peso semântico (ex.: um botão de compartilhar não pode competir com o veredito). Ferramentas de peso, em ordem de força: **posição > tamanho > contraste > espaço > cor > mono/serif**. Cor é a *penúltima* alavanca — nunca a primeira (P-5).

---

# PARTE V — DESIGN SYSTEM PHILOSOPHY
*(Fase 5 · normativa · define linguagem, não componentes)*

## 5.0 O modelo de tokens semânticos (a ponte channel-independent)

Este é o mecanismo que torna a DLS implementável em qualquer tecnologia. **Três tiers.**

```
TIER 0  INTENT (semântico, eterno)     ex.: intent/verdict/act, intent/uncertain,
                                            surface/page, ink/primary, data/numeric
        └─ o domínio e a DLS SÓ conhecem este tier. NUNCA um valor.
TIER 1  REFERENCE BINDING (a marca)    a realização canônica do intent
                                            (a paleta/tipografia atuais são UMA binding)
TIER 2  CHANNEL ADAPTATION             como cada canal materializa o Tier 1
        └─ e-mail: hex inline; print: tinta segura; dark: par; mobile: escala
```

**Regras (normativas):**
- **T-1:** o conteúdo e os componentes DEVEM referir-se **apenas a intents (Tier 0)**. NUNCA a um valor concreto. *(Elimina "hex em componente" — DDD-002 DR-12.)*
- **T-2:** existe **uma** binding canônica (Tier 1) por token. Divergência entre superfícies é não-conformidade. *(Mata o kernel triplicado.)*
- **T-3:** um canal PODE adaptar o Tier 2 (e-mail inlina, print converte), mas NUNCA muda o significado do Tier 0.
- **T-4:** a binding atual da plataforma (paleta e tipografia do CLAUDE.md) é **a binding de referência v1** — normativa como *exemplo de conformidade*, substituível sem tocar no Tier 0.

### Catálogo mínimo de intents (Tier 0)

```
surface/page          fundo de leitura (calmo, nunca branco puro)
surface/card          superfície de bloco
ink/primary           texto principal (contraste máximo)
ink/secondary         texto de apoio
ink/meta              metadados (menor ênfase, ainda AA)
line/divider          separadores e bordas
intent/verdict/act        recomendação máxima positiva
intent/verdict/watch      recomendação positiva condicional
intent/verdict/specific   recomendação de nicho
intent/verdict/wait       recomendação de espera
intent/verdict/avoid      recomendação negativa
intent/state/uncertain    ausência de veredito por falta de dado  (EIXO CERTEZA)
intent/signal/accent      destaque de "sinal/foco/link"
intent/risk               risco/warning (eixo ortogonal ao veredito)
data/numeric              tratamento de número de análise (mono)
```

Cada intent tem **um** significado e **uma** binding. A tabela intent→binding→cada-canal é o **coração operacional** da DLS (Apêndice C).

## 5.1 Spacing Philosophy

Espaço é **sintaxe**, não sobra. Uma escala harmônica (base 4) cria o pulso. Espaço **separa tipos semânticos**; blocos do mesmo tipo respiram junto, tipos diferentes respiram mais. **SP-1:** o espaço ao redor de um elemento é proporcional ao seu peso semântico (a conta feita respira mais que uma linha de metadado). **SP-2:** ritmo previsível > densidade máxima; nunca comprimir para "caber mais".

## 5.2 Typography Philosophy

Três vozes tipográficas, cada uma com **um** papel semântico fixo:

```
SERIF (display)      autoridade editorial   →  SÓ títulos. NUNCA corpo.
SANS (texto)         clareza neutra          →  corpo, rótulos, UI. ≥ tamanho legível.
MONO (dados)         precisão auditável      →  TODO número de análise (CPM/VPM/R$/%/TL Score)
```

**TY-1:** número de análise em MONO é inviolável — é a assinatura de "conta feita" e o marcador de "isto é auditável". **TY-2:** serif fora de título é não-conformidade. **TY-3:** hierarquia tipográfica (tamanho/peso) DEVE sustentar a hierarquia de informação sem depender de cor (P-5). **TY-4:** a família concreta (Fraunces/Inter/JetBrains Mono) é **binding**, substituível; os *papéis* (display/texto/dados) são eternos. Fallbacks seguros por canal (serif/sans/mono genéricos) são obrigatórios onde webfont não é garantida (e-mail).

## 5.3 Color Philosophy

Cor é **linguagem semântica fechada** (P-6). Regras invioláveis herdadas e elevadas a lei de linguagem:

- **CL-1:** cada matiz = um significado (ver intents 5.0). Cor NUNCA decora.
- **CL-2:** cor NUNCA é o único portador de significado — sempre acompanha rótulo textual e/ou posição (A11y + P-5).
- **CL-3:** o fundo de leitura é **calmo** (Paper), NUNCA branco puro; cartões são superfície distinta.
- **CL-4:** o amarelo do veredito "Esperaria" NUNCA é cor de texto (só fundo com texto escuro por cima). O verde de recomendação como **texto** usa o tom de maior contraste; o verde vivo é só preenchimento/dado.
- **CL-5:** vermelho pertence a **Evitaria** e a **Risco** — NUNCA a urgência ou pressão comercial (P-4).
- **CL-6 (correção de linguagem):** o veredito "Vale olhar" é **azul** (o tom de sinal/foco), reservando o verde exclusivamente para "Vale agir". Verde é escasso: só o topo da escala e o resultado da conta. *(DDD-002 DR-07.)*

## 5.4 Contrast Philosophy

Contraste é **acessibilidade e hierarquia**, não estética. **CT-1:** todo par texto/fundo DEVE atingir AA (≥4.5:1 texto normal; ≥3:1 texto grande); metadados pequenos usam o tom de maior contraste, não o mais claro (DDD-002 DR-25). **CT-2:** contraste é uma **alavanca de peso** (F-9): mais contraste = mais peso; usar deliberadamente, não uniformemente. **CT-3:** AA é **gate de publicação** — abaixo dele, o canal está não-conforme, não "quase".

## 5.5 Grid & Composition Philosophy

- **GR-1:** composição de **coluna única** como default editorial — leitura linear, previsível, portável (e-mail, mobile, print convergem). Multi-coluna é exceção justificada (ex.: matriz do Pro).
- **GR-2:** largura de medida (measure) confortável para leitura (~60–75 caracteres); e-mail limita a ~600px como binding de canal.
- **GR-3:** o grid serve à **hierarquia de leitura** (4.1), não à densidade. Alinhamento consistente é peso silencioso.
- **CP-1 (composição):** cada bloco é uma unidade semântica autossuficiente, precedida por um rótulo de seção. A ordem dos blocos segue a hierarquia de peso (4.5), não a conveniência de layout.

## 5.6 Motion Philosophy

- **MO-1:** movimento é **funcional e sóbrio** — revela hierarquia ou confirma ação; NUNCA entretém nem cria urgência. Somente transform/opacity conceituais (a *forma* de expressar é do canal).
- **MO-2:** todo movimento DEVE ter **fallback estático** e DEVE respeitar preferência de movimento reduzido (A11y). Sem movimento, nada de sentido se perde.
- **MO-3:** o mascote (Ponto) é a única fonte de "vida"; ainda assim sóbria, idle sutil, e desligável. Motion NUNCA no bloco analítico.

## 5.7 Accessibility Philosophy

A11y é **camada Brand** (F-1) — vale em todo canal e nível. **AX-1:** semântica antes de estilo (landmarks, uma só h1, ordem de leitura correta em qualquer meio). **AX-2:** veredito sempre com rótulo textual (nunca só cor). **AX-3:** foco visível, alvos ≥44px (onde há interação), navegação por teclado. **AX-4:** movimento reduzido respeitado. **AX-5:** linguagem simples — jargão (milheiro, CPM, spread) sempre acompanhado de acesso a definição (Glossary). A11y é **critério de aceite**, não backlog.

## 5.8 Newsletter (e-mail) Philosophy

O e-mail é o canal mais hostil e o mais importante. **NL-1:** autossuficiente — sem dependência externa (webfont, script, imagem remota); tudo embutido. **NL-2:** coluna única, medida segura, fallbacks tipográficos genéricos. **NL-3:** o veredito e a conta DEVEM sobreviver a clientes que removem estilo — rótulo textual + estrutura carregam o sentido mesmo "pelado". **NL-4:** preheader informa, nunca repete o assunto nem apela. **NL-5:** nível de conformidade **AA**; expressão de marca reduzida é aceitável, semântica e A11y não.

## 5.9 Print / PDF Philosophy

- **PR-1:** o PDF é **arquivo de autoridade** (Pro): denso, executivo, paginado. **PR-2:** cor DEVE degradar graciosamente para tons seguros de impressão; a hierarquia DEVE sobreviver em **preto e branco** (P-5). **PR-3:** links viram referências textuais (URL/fonte por extenso) — nada de dependência de clique. **PR-4:** sem elementos que só fazem sentido em tela (hover, motion).

## 5.10 Dark Theme Philosophy

- **DK-1:** dark é **par legítimo**, não inversão automática. Cada intent (Tier 0) tem binding para claro e escuro. **DK-2:** a **conta feita** mantém fundo escuro fixo em ambos os temas (é sua assinatura); o resto adapta. **DK-3:** contraste AA nos dois temas; o toggle do leitor sempre vence. **DK-4:** o significado da cor NUNCA muda entre temas (verde é agir no claro e no escuro).

## 5.11 Mobile & Responsive Philosophy

- **MB-1:** a leitura é **mobile-first** por realidade de uso (e-mail no telefone). Coluna única já resolve a maior parte. **MB-2:** conteúdo largo (conta, matriz) tem **scroll horizontal contido** — nunca estoura o corpo da página. **MB-3:** responsividade é **reflow da mesma hierarquia**, nunca uma IA diferente por tamanho. **MB-4:** alvos e tipografia respeitam ergonomia de toque e leitura próxima.

---

# PARTE VI — COMPONENT PHILOSOPHY
*(Fase 6 · normativa · define papéis semânticos, não implementações)*

## 6.0 O que é um componente na DLS

Um **componente** é a **realização visual de um papel semântico**. A DLS define o papel (Purpose / Responsibilities / Boundaries / Semantic role / Visual role / Editorial role); o canal escolhe a forma. **CO-1:** um componente NUNCA carrega conhecimento que o domínio não emitiu. **CO-2:** um componente tem **fronteiras** — o que ele NÃO faz é tão normativo quanto o que faz. **CO-3:** conceitos de domínio (Signal, Deal, TL Score) e conceitos de apresentação (Hero, CTA, Footer) são **camadas diferentes**: os primeiros vêm do conhecimento, os segundos servem à leitura/navegação. Confundi-los é o erro histórico (DDD-001 R-11).

Formato de cada ficha: **Propósito · Responsabilidades · Fronteiras (não-faz) · Papel semântico · Papel visual · Papel editorial.**

## 6.1 Hero
- **Propósito:** estabelecer identidade e promessa na primeira dobra de um canal de entrada (landing).
- **Responsabilidades:** enunciar a promessa (a conta feita), o pulso (SEG–SEX 8h/5min) e a ação (assinar).
- **Fronteiras:** NUNCA contém conhecimento editorial real (nenhum Deal/veredito verdadeiro); NUNCA promete ganho.
- **Papel semântico:** porta de entrada / declaração de valor. **Visual:** maior peso tipográfico da superfície (display). **Editorial:** voz de marca, não de edição.

## 6.2 Signal (Sinal do dia)
- **Propósito:** comunicar a única tese que organiza a edição.
- **Responsabilidades:** dizer o que mudou de verdade e por que importa, em prosa curta e densa.
- **Fronteiras:** exatamente **1** por edição (G-1); NUNCA vira lista de manchetes; NUNCA carrega cálculo (isso é do Deal).
- **Papel semântico:** ápice narrativo. **Visual:** alto peso, logo abaixo do veredito na hierarquia. **Editorial:** Insight destilado.

## 6.3 Deal (Oportunidade)
- **Propósito:** submeter uma oportunidade concreta a julgamento auditável.
- **Responsabilidades:** reunir Título, Contexto, Calculation, Evidence, Recommendation e, se houver, Warning.
- **Fronteiras:** 0..3 por edição; NUNCA existe sem conta **e** fonte **e** veredito (G-2); o mascote NUNCA aparece dentro dele.
- **Papel semântico:** unidade de decisão. **Visual:** bloco denso, o mais estruturado da edição. **Editorial:** o produto em miniatura.

## 6.4 Calculation (Conta feita)
- **Propósito:** tornar o custo real verificável — mostrar a conta.
- **Responsabilidades:** exibir entradas→resultado em MONO, com o resultado destacado; expor a fórmula quando aplicável.
- **Fronteiras:** NUNCA assume taxa de conversão sem fonte; NUNCA esconde uma variável material; NUNCA mistura pontos de origem com milhas finais.
- **Papel semântico:** **prova** (o herói, P-2). **Visual:** assinatura inconfundível — superfície escura fixa, resultado em verde, mono. **Editorial:** o método tornado visível.

## 6.5 Recommendation / TL Score (Veredito)
- **Propósito:** dar um veredito claro e auditável, para quem ele vale.
- **Responsabilidades:** exibir o veredito nomeado + o TL Score (0–100) + a faixa; indicar o público ("para quem já é do clube").
- **Fronteiras:** o veredito DEVE derivar da faixa do TL Score (DDD-002 DR-06) salvo override editorial **justificado e registrado** (ADR-A2); NUNCA diz "compre"; NUNCA sem TL Score, exceto no estado `Não confirmado`.
- **Papel semântico:** **o selo** (não o mascote — o selo é o veredito). **Visual:** pill de cor semântica + rótulo textual + número em mono; ápice da hierarquia (F-8). **Editorial:** a conclusão do método.

## 6.6 Warning (O que evitaria / Risco)
- **Propósito:** declarar risco explicitamente, como categoria própria.
- **Responsabilidades:** nomear o que evitar e por quê; existir mesmo quando a edição é majoritariamente positiva.
- **Fronteiras:** eixo **ortogonal** à recomendação (F-5); obrigatório na edição; NUNCA usa vermelho como pressão, só como risco.
- **Papel semântico:** contrapeso cético. **Visual:** distinto do veredito negativo; sóbrio. **Editorial:** a honestidade estrutural do Sage.

## 6.7 Source / Evidence (Fonte)
- **Propósito:** autorizar o conhecimento com lastro verificável.
- **Responsabilidades:** exibir fonte + nível (1–5) + vigência + URL alcançável.
- **Fronteiras:** NUNCA nível 5 como sustentação; nível 3–4 é radar, não recomendação; URL DEVE ser real e oficial quando sustenta cálculo.
- **Papel semântico:** **auditabilidade**. **Visual:** baixo peso, alto compromisso — presente, discreto, sempre alcançável. **Editorial:** a base do método.

## 6.8 Glossary
- **Propósito:** remover a barreira do jargão sem diluir o rigor.
- **Responsabilidades:** definir termos (milheiro, CPM, VPM, spread, estoque, liquidez…) em linguagem simples, acessível a partir do ponto de uso.
- **Fronteiras:** NUNCA reescreve o conceito de forma imprecisa para "facilitar"; complementa, não substitui, o termo técnico.
- **Papel semântico:** ponte de acessibilidade cognitiva (AX-5). **Visual:** discreto, sob demanda. **Editorial:** inclusão sem perda de autoridade.

## 6.9 Benchmark (Pro)
- **Propósito:** dar referência de "caro/normal/barato" por categoria.
- **Responsabilidades:** faixas baixo/normal/alto com unidade explícita e nota de condição.
- **Fronteiras:** NUNCA sem unidade; NUNCA usa dado interno/CMI; comparabilidade só com valor verificável.
- **Papel semântico:** régua de mercado. **Visual:** tabela/escala densa, mono nos números. **Editorial:** análise executiva, não editorial-diária.

## 6.10 CTA
- **Propósito:** converter atenção em assinatura, sem manipular.
- **Responsabilidades:** ação única e clara ("Receber o The Loyalty"); expectativa honesta ("sem promessa de milha grátis").
- **Fronteiras:** NUNCA urgência, contagem, ou promessa; NUNCA compete visualmente com o veredito (F-9); um CTA por contexto.
- **Papel semântico:** convite. **Visual:** afirmativo (verde de agir), secundário ao conteúdo. **Editorial:** voz de marca, sóbria.

## 6.11 Footer
- **Propósito:** fechar a peça com identidade, obrigações e saída.
- **Responsabilidades:** disclaimer íntegro, independência declarada, unsubscribe (canais de envio), navegação de marca.
- **Fronteiras:** NUNCA omite o disclaimer; NUNCA esconde o unsubscribe; baixo peso de atenção, alta obrigatoriedade.
- **Papel semântico:** encerramento e conformidade. **Visual:** discreto, estável entre edições. **Editorial:** a assinatura institucional.

## 6.12 Regra de composição de componentes
**CO-4:** componentes compõem seguindo a gramática editorial (3.3) e a hierarquia de peso (4.5). Um componente de navegação/marca (Hero, CTA, Footer) NUNCA se intromete num bloco de conhecimento (Deal, Calculation, Recommendation). O mascote NUNCA entra em bloco analítico. Esta separação é a fronteira domínio↔apresentação tornada visível.

---

# PARTE VII — DESIGN REVIEW BOARD (RED TEAM → REFACTOR)
*(Fase 7 · normativa nas conclusões)*

Assumimos que **tudo acima está errado** e atacamos. Cada ataque tem veredito e, quando procede, refatoração já incorporada acima.

### AT-1 · "A separação em 8 camadas é over-engineering para uma newsletter pré-receita."
**Ataque:** 3 documentos DDD + blueprint + esta RFC, e nenhuma edição real publicada. Ceremônia > entrega.
**Defesa:** a consistência **é** o produto (Sage); a divergência já aconteceu (DDD-001) com apenas 50 arquivos — prova de que a entropia é real e precoce. O custo de definir a linguagem agora, com **retrocompat ≈ 0** (DDD-002), é mínimo; depois é caríssimo.
**Veredito:** ataque **rejeitado**, com mitigação: a DLS DEVE ser aplicável incrementalmente (níveis A/AA/AAA) para não bloquear a primeira publicação real. *(Incorporado em 0.2.)*

### AT-2 · "Veredito de 6 valores num único eixo colapsa três dimensões (recomendação, risco, certeza)."
**Ataque:** "Não confirmado" no mesmo enum que "Evitaria" confunde *ausência de dado* com *dado ruim*; risco não tem lugar próprio.
**Defesa parcial:** o enum único simplifica o pipeline (DDD-002 DR-05).
**Veredito:** ataque **procede**. Refatoração incorporada: **F-5 (risco ortogonal)** e **F-6 (certeza ortogonal)**; a representação separa os três eixos mesmo mantendo o enum de domínio. Registrado como **ADR-A1/A3** — tensão explícita com DR-05/06 a resolver na RFC-001.

### AT-3 · "Progressive disclosure vs contrato de 5 minutos vs 19 seções é contraditório."
**Ataque:** ou é curto ou tem 19 seções; não os dois.
**Defesa:** o contrato é sobre **camadas obrigatórias** (0–2), não sobre total de seções; as demais são Camada 4 (opcional).
**Veredito:** ataque **parcialmente procede** → norma A-3 e D-1/D-2 tornam explícito que peso uniforme nas 19 seções é proibido. **ADR-A4.**

### AT-4 · "Tokens em 3 tiers exigem build/codegen — conflita com 'zero dependências'."
**Ataque:** derivar Tier 1→Tier 2 (e-mail inline, print) sem ferramenta é trabalho manual e fonte de divergência (o kernel triplicado nasceu disso).
**Defesa:** o Tier 0 é conceitual (não precisa de build); a binding única (Tier 1) pode viver num único módulo consumido por todos; a adaptação de canal é responsabilidade do renderer, que já existe.
**Veredito:** ataque **procede como risco operacional (R-OPS-1)**: sem **uma** fonte física de binding, T-2 é aspiracional. A DLS **exige** fonte única (T-2) e delega o *como* à RFC-001 (TBD-2). Não resolver isso reintroduz a tripla cópia.

### AT-5 · "Reader externo (Beehiiv) contradiz a promessa de 'três leituras por perfil'."
**Ataque:** "Sua leitura por perfil" precisa de perfil; se o leitor vive fora do domínio (DDD-002 DR-18), a personalização é impossível.
**Defesa:** "Sua leitura" v1 é **editorial** (o autor escreve blocos por perfil na edição), não **personalizada** (não depende de dados do leitor).
**Veredito:** ataque **neutralizado por definição**, mas registrado: personalização real fica fora do escopo v1; se virar requisito, DR-18 e esta cláusula DEVEM ser reabertas. **ADR-A5.**

### AT-6 · "Coluna única + mono para dados quebra no PDF executivo e no dashboard."
**Ataque:** Pro é denso, tabular, multi-coluna; a doutrina de coluna única não serve.
**Defesa:** GR-1 já admite exceção justificada (matriz/benchmark); a coluna única é *default editorial diário*, não dogma universal.
**Veredito:** ataque **rejeitado**; norma já prevê a exceção. Reforço: exceções de composição DEVEM preservar a hierarquia de peso (F-9).

### AT-7 · "Cor semântica fechada não internacionaliza (verde=bom é cultural)."
**Ataque:** em alguns contextos as associações de cor diferem; e daltonismo.
**Defesa:** CL-2 já proíbe cor como único portador (sempre há rótulo textual + posição); daltonismo é coberto por rótulo + contraste + não-redundância só-cor.
**Veredito:** ataque **rejeitado para o mercado atual (pt-BR)**, mas i18n de cor/idioma é **pergunta aberta (Q-7)** para expansão futura.

### AT-8 · "Sem eixo de eventos/observabilidade, a plataforma 'auditável' não audita a si mesma."
**Ataque:** o core é auditabilidade do conteúdo, mas não há registro de o-que-foi-publicado-quando.
**Defesa:** fora do escopo da *linguagem* (é domínio/infra, DDD-002 DR-22 ledger).
**Veredito:** ataque **procede como lacuna de escopo** — a DLS não cobre observabilidade (correto), mas **aponta** o risco à RFC-001 (R-OPS-2). Registrado.

**Conclusão do Board:** a linguagem **sobrevive** ao ataque com três refatorações incorporadas (F-5, F-6, A-3/D-2) e cinco riscos/ADRs registrados. Nenhum ataque derruba a espinha (conhecimento único, camadas, tokens semânticos, hierarquia de peso, A11y como lei).

---

# PARTE VIII — GOVERNANÇA, VERSIONAMENTO, MIGRAÇÃO, ROADMAP

## 8.1 Governança
- **GV-1 · Dono da linguagem:** a DLS tem um **owner** (papel Principal Design/Information Architect). Mudança de Tier 0 (intents) ou de camada Brand exige RFC + revisão do Board.
- **GV-2 · Conformidade:** todo canal declara nível (A/AA/AAA) e passa por um **checklist de conformidade** (Apêndice E) antes de ir ao ar. Não-conformidade em item inviolável = bloqueio.
- **GV-3 · Precedência:** em conflito, a ordem é **regras invioláveis (CLAUDE.md) > DLS Tier 0/Brand > DDD-002 > implementação**. Camada de linguagem e camada de domínio não se sobrepõem (0.4).
- **GV-4 · Agentes:** Claude Research, Cowork e qualquer IA/automação são **consumidores de primeira classe** da DLS. Um agente NUNCA emite valor concreto (cor/fonte) — emite **intents e conhecimento**; o renderer materializa. Um agente que viola a DLS é tratado como canal não-conforme.

## 8.2 Versionamento da linguagem (SemVer semântico)
```
MAJOR  muda significado de um Tier 0 / camada Brand / gramática  (raro; quebra canais)
MINOR  adiciona intent/componente/regra sem quebrar               (aditivo)
PATCH  esclarece redação, corrige binding sem mudar significado   (seguro)
```
- **VE-1:** remover ou ressignificar um intent é **MAJOR** e exige migração de todos os canais.
- **VE-2:** a binding de referência (Tier 1) pode mudar em **MINOR/PATCH** desde que o Tier 0 e a A11y se mantenham.
- **VE-3:** toda versão registra um changelog e o impacto por nível de conformidade.

## 8.3 Migração (do estado atual à DLS v1)
Aproveita o **custo ≈ 0** (DDD-002). Ordem:
```
M0  Consolidar Tier 0 (intents) + binding única (Tier 1)         [desbloqueia tudo]
M1  Reexpressar conteúdo em intents (remover valores dos comps)   [T-1]
M2  Unificar veredito/tipografia/escala sob a binding única       [T-2, CL-6]
M3  Elevar A11y a gate (contraste, rótulos, foco)                 [AX-*, DR-25]
M4  Convergir renderers de canal para adaptação Tier 2            [T-3]
M5  Corrigir marca (nome, prosa dos critérios), remover fantasmas [DDD-002 DR-04/08]
```
Migração é **por canal**, começando pelo de maior conformidade (Website, AAA) e validando a linguagem antes de propagar.

## 8.4 Roadmap da linguagem
```
v1.0  esta RFC — fundação channel-independent (Daily + Pro)
v1.1  bindings de canal formais: PDF, LinkedIn, RSS (níveis A/AA)
v1.2  linguagem de dados/dataviz (Sparkline, CompareBanner, matriz) formalizada
v1.3  Dark theme como par completo em todos os canais
v2.0  i18n da linguagem (idioma + cor culturalmente neutra) — se houver expansão
```

---

# APÊNDICES

## Apêndice A — ADR candidatos
*(decisões de arquitetura a ratificar na RFC-001; a DLS aponta, não fecha)*

- **ADR-A1 · Certeza como eixo separado.** Representar `Não confirmado` fora da escala de recomendação (eixo certeza, F-6). *Tensão:* DDD-002 DR-05 (enum único). *Recomendação:* manter enum de domínio, separar **na representação**.
- **ADR-A2 · Override editorial do veredito.** Permitir que o autor sobreponha a faixa do TL Score **com justificativa registrada**. *Tensão:* DR-06 (derivação estrita). *Recomendação:* permitir override auditável, nunca silencioso.
- **ADR-A3 · Risco como componente ortogonal.** Warning existe dentro de Deals positivos (F-5). *Impacto:* gramática 3.3 e componente 6.6.
- **ADR-A4 · Peso não-uniforme nas seções.** Proibir apresentar as 19 seções com peso igual; camadas obrigatórias 0–2 (A-3).
- **ADR-A5 · Personalização de leitura.** "Sua leitura" é editorial em v1; personalização real reabre DR-18.
- **ADR-A6 · Fonte física única do kernel.** Exigir um único módulo de binding (T-2) para evitar a tripla cópia. *Liga:* TBD-2 do Blueprint.
- **ADR-A7 · Mono para dados como invariante de marca.** Elevar TY-1 a inviolável de linguagem (número de análise sempre mono, todo canal).

## Apêndice B — Matriz de decisões de linguagem

| ID | Decisão de linguagem | Aceitar | c/ ajuste | Rejeitar | Nota |
|---|---|:--:|:--:|:--:|---|
| F-1 | Camadas superiores são channel-agnostic | ✅ | | | fundadora |
| F-3 | A imagem é dado | ✅ | | | Sage |
| F-5 | Risco ortogonal ao veredito | ✅ | | | corrige acoplamento |
| F-6 | Certeza ortogonal ao veredito | | ✅ | | ADR-A1 vs DR-05 |
| F-8 | Quatro hierarquias convergem no veredito+conta | ✅ | | | IA |
| F-9 | Lei do peso (visual ∝ semântico) | ✅ | | | IA |
| T-1 | Conteúdo só conhece intents | ✅ | | | mata hex-em-componente |
| T-2 | Binding única (Tier 1) | | ✅ | | precisa fonte física (ADR-A6) |
| CL-6 | Vale olhar = azul | ✅ | | | DR-07 |
| GR-1 | Coluna única default, exceção justificada | ✅ | | | Pro é exceção |
| DR-06→A2 | Veredito deriva do score | | ✅ | | override auditável |
| DR-18→A5 | Reader externo | | ✅ | | reabrir se personalizar |

## Apêndice C — Esqueleto da tabela intent → binding → canal *(a preencher na RFC-001; estrutura normativa)*

```
INTENT (Tier 0)        | REF BINDING (Tier 1) | WEB (AAA) | E-MAIL (AA) | PDF (AA) | RSS/API (A)
-----------------------|----------------------|-----------|-------------|----------|------------
surface/page           | ⟦binding⟧            | ⟦adapt⟧   | ⟦inline⟧    | ⟦print⟧  | n/a
ink/primary            | ⟦binding⟧            | …         | …           | …        | text
intent/verdict/act     | ⟦verde-texto⟧        | …         | …           | b/w-safe | label
intent/state/uncertain | ⟦cinza+tracejado⟧    | …         | …           | …        | label
data/numeric           | ⟦mono⟧               | mono      | mono-safe   | mono     | plain
```
Preencher os `⟦…⟧` é trabalho da RFC-001 (implementação); a **estrutura** e os **intents** são normativos aqui.

## Apêndice D — Catálogo de anti-patterns (proibições de linguagem)

```
AP-1  Cor como único sinal (sem rótulo)                    → viola CL-2/AX-2
AP-2  Número de análise fora de mono                        → viola TY-1
AP-3  Serif no corpo                                        → viola TY-2
AP-4  Branco puro como fundo de leitura                     → viola CL-3
AP-5  Amarelo/verde-vivo como texto                         → viola CL-4
AP-6  Vermelho como urgência/pressão                        → viola CL-5/P-4
AP-7  Veredito sem rótulo textual                           → viola AX-2
AP-8  Risco embutido no veredito                            → viola F-5
AP-9  "Não confirmado" tratado como veredito negativo       → viola F-6
AP-10 Peso visual desalinhado do semântico                  → viola F-9
AP-11 Mascote em bloco analítico                            → viola CO-4
AP-12 Valor concreto em conteúdo/componente (hex, fonte)    → viola T-1
AP-13 Binding divergente entre superfícies                  → viola T-2
AP-14 Canal reinterpretando Brand/gramática                 → viola F-1
AP-15 Urgência/promessa/contagem/emoji                      → viola P-4/Brand
AP-16 19 seções com peso uniforme                           → viola A-3/D-1
```

## Apêndice E — Checklist de conformidade (gate de canal)

```
[ ] Nível declarado (A / AA / AAA)
[ ] Hierarquia sobrevive sem cor (P-5)
[ ] Veredito com rótulo textual + mono (AX-2, TY-1)
[ ] Conta feita: mono, resultado destacado, fundo fixo (6.4)
[ ] Contraste AA em todos os pares (CT-1)
[ ] Disclaimer íntegro presente onde há recomendação (G-4)
[ ] Nenhum anti-pattern do Apêndice D
[ ] Conteúdo referencia só intents, não valores (T-1)
[ ] Binding única respeitada (T-2)
[ ] A11y: landmarks, uma h1, foco, movimento reduzido (AX-*)
[ ] Mascote fora de bloco analítico (CO-4)
[ ] 5-min: valor essencial extraível em ≤60s (A-1)
```

## Apêndice F — Critérios de aceite da DLS
- **AC-1:** uma equipe sem acesso ao código atual consegue construir um canal conforme só com esta RFC. *(teste: dar a RFC a um implementador cego e auditar o resultado pelo Apêndice E.)*
- **AC-2:** todo intent tem exatamente um significado e uma binding de referência.
- **AC-3:** nenhuma regra inviolável do CLAUDE.md é enfraquecida.
- **AC-4:** as quatro hierarquias (4.1) convergem; a Lei do Peso (F-9) é verificável em qualquer edição.
- **AC-5:** cada componente (Parte VI) tem Purpose/Boundaries/roles definidos e fronteiras testáveis.
- **AC-6:** todo ataque do Board (Parte VII) tem veredito e, se procede, refatoração ou ADR.

## Apêndice G — Perguntas abertas
- **Q-1:** override editorial do veredito — quando é legítimo e como registrar? (ADR-A2)
- **Q-2:** representação canônica do eixo *certeza* separado do *recomendação* (ADR-A1).
- **Q-3:** onde vive fisicamente a binding única (T-2/ADR-A6) sem violar "zero dependências"?
- **Q-4:** linguagem de dataviz (Sparkline/CompareBanner/matriz) — formalizar em v1.2.
- **Q-5:** LinkedIn/Slides — que subconjunto da gramática sobrevive num canal social/apresentação?
- **Q-6:** API/RSS (nível A) — qual a serialização semântica de intents para consumidores de máquina?
- **Q-7:** i18n de cor e idioma para expansão além de pt-BR (v2.0).
- **Q-8:** observabilidade editorial (o que foi publicado quando) — escopo de domínio, mas a linguagem precisa de um "registro de errata" visível (liga DDD-002 DR-15).

---

## Critério de qualidade — autoavaliação do Board

> *"Este documento é suficientemente bom para ser a linguagem oficial da plataforma por dez anos?"*

**Sim, com as ressalvas registradas.** A DLS: (a) separa **conhecimento** de **canal** de forma executável (tokens semânticos, F-1); (b) codifica a doutrina Sage em princípios invocáveis (P-1…P-10); (c) define a gramática editorial e as quatro hierarquias de forma channel-agnostic; (d) resolve, por representação, os acoplamentos de risco/certeza que o domínio deixou latentes (F-5/F-6); (e) fixa A11y como lei; (f) traz governança, versionamento, migração, anti-patterns e checklist de conformidade que permitem a uma equipe externa construir qualquer canal. As oito perguntas abertas e sete ADRs são o que a **RFC-001** (implementação) deve fechar — nenhuma delas compromete a fundação.

*Fim da RFC-001A — The Loyalty Design Language Specification v1.0.*
