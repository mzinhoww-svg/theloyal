# DDD-002 — The Loyalty Domain Decision Report

**Version 1.0**
**Status:** Decisão — *este documento resolve; não descobre.*
**Precede:** RFC-001 (só pode ser escrita **depois** deste documento).
**Sucede:** DDD-001 (Domain Discovery Report v1.0), que catalogou os conflitos aqui resolvidos.

> **Autoridade.** No DDD-001, as decisões do Apêndice D foram represadas por exigirem input do dono do produto. Este documento é esse input, exercido sob o AAP. Cada decisão abaixo é **oficial e vinculante** a partir da v1.0. Onde uma decisão contradisser um artefato existente, o artefato está errado e será corrigido — não o contrário.
>
> **Limite de escopo.** Este documento decide **domínio**: qual é a linguagem ubíqua oficial, o que cada conceito significa, qual modelo é canônico, quais regras valem. Ele **não** escreve arquitetura, schema, componente, renderer ou JSON. Toda pergunta de *como implementar* é explicitamente delegada à RFC-001 com a marca **→ RFC-001**.

---

## Premissa habilitadora (vale para todo o documento)

**Não existe produção.** Fato apurado no DDD-001:

- As duas únicas edições (Nº 27, Nº 28) e o relatório Pro têm `illustrative: true` — são exemplos.
- Nenhuma newsletter real foi enviada (Beehiiv em modo mock; ledger só com `draft`/`mock`).
- O formulário de assinatura é mock client-side; não há base de assinantes proveniente do site.
- Não há leitor, número de edição de produção, nem conteúdo publicado a preservar.

**Consequência:** o custo de retrocompatibilidade é **próximo de zero**. Não há dado vivo, audiência ativa ou contrato externo a quebrar. Isto autoriza decisões limpas agora, antes que a dívida se torne cara. Cada seção **Retrocompatibilidade** abaixo parte desta premissa; quando disser "sem impacto de produção", é por isto.

---

## Sumário

- **Parte I — Rulings Conceituais** (as definições oficiais: domínio, agregado raiz, e os 11 "o que é")
- **Parte II — Decision Records** (DR-01…DR-24, cada um com Problema / Alternativas / Trade-offs / Escolha / Justificativa / Impacto / Migração / Retrocompatibilidade)
- **Parte III — Decision Matrix** (todas as decisões oficiais, uma linha cada)
- **Parte IV — Nova Hierarquia de Verdade** e liberação para a RFC-001

---

# Parte I — Rulings Conceituais

> Definições oficiais. Curtas, vinculantes. Resolvem a lista "Resolva:" do pedido. Cada ruling recebe um ID `R-*` e entra na Decision Matrix.

## R-CORE · Qual é o domínio principal

**O Core Domain é o Julgamento Editorial Auditável.**

A transformação de sinais de mercado ruidosos em um **veredito** com **conta feita**, **vigência confirmada** e **TL Score**, sob **hierarquia de fontes** e **regras invioláveis**. É o único ativo insubstituível do The Loyalty: a marca vende *confiança verificável*, e o núcleo é o método que a produz.

Tudo o mais — rendering, canais, distribuição, landing, Pro, mascote — é **supporting** ou **generic** e existe para *entregar* esse núcleo **sem contaminá-lo**. Nenhuma decisão neste documento pode enfraquecer o core em nome de conveniência de entrega. Quando entrega e credibilidade colidem, **credibilidade vence** (herdado de `CLAUDE.md`).

## R-AGG · Qual é o agregado raiz

**O agregado raiz é a Edição (`Edition`).**

- A **Edição** é a fronteira de consistência e de transação editorial. Seus invariantes (disclaimer íntegro, ≤3 deals no Deal Desk, um Sinal do dia, todas as fontes com URL, coerência TL Score↔veredito) só fazem sentido no conjunto.
- **Deal (Oportunidade)**, **Conta feita**, **Veredito**, **TL Score**, **Fecha logo**, **Fonte**, **Vigência** são **entidades e value objects internos** à Edição. Um Deal **não existe** fora de uma Edição.
- O **Relatório Pro (`ProReport`)** é um **agregado raiz separado**, com ciclo de vida próprio, identificado por período (`YYYY-MM`). Não é uma Edição do Daily.
- O **Leitor (`Reader`)** é um **agregado externo** (ver R-08/DR-18): referenciado por identidade, nunca contido.

> A escolha de agregado é decisão de domínio (fronteira de invariantes), não de persistência. **Como** persistir/serializar → RFC-001.

## R-01 · O que é uma Edição

**Uma Edição é um snapshot editorial imutável-após-publicação, identificado por `(produto, número)`, que existe como UM conteúdo canônico e é projetado em múltiplos canais.**

- **Nasce** quando o conteúdo é aprovado no QA (estado `Validada`). Antes disso é `Rascunho`.
- **Torna-se imutável** ao ser publicada (`Publicada`). Correção posterior **não** é edição silenciosa: é **Errata versionada** ou **nova Edição** (DR-15).
- **Nunca deixa de existir**: é registro histórico permanente. O que expira é a **vigência da oferta**, não a edição (DR-16).
- **Uma Edição, cinco projeções** (JSON, e-mail, plain, web, post). As projeções são derivadas; a Edição é a fonte.
- **Identidade:** `(produto, número)`. Numeração é **por produto** (DR-06).

## R-02 · O que é Conteúdo

**Conteúdo é o conhecimento editorial em si — a carga semântica (Sinal, Deals, Conta, Veredito, Fontes, seções) independente de qualquer apresentação ou formato.**

Conteúdo é o que o Editor **autora**; é agnóstico a canal e a formato. Conteúdo vive no **modelo canônico** (R-09/DR-01). O JSON é uma *serialização* do Conteúdo, não o Conteúdo. Se todo JSON sumisse, o Conteúdo sobreviveria em qualquer outra codificação.

## R-03 · O que é Canal

**Um Canal é uma superfície de entrega do Conteúdo a um Leitor** — e-mail/newsletter, website, RSS, LinkedIn, PDF.

- Um Canal **não é** um Produto. **Produtos** (Daily, Weekly, Lab, Pro) são *linhas editoriais*; **Canais** são *superfícies de entrega*. (DR-19 fixa produto↔canal.)
- **Uma Edição → muitos Canais.** O Conteúdo é único; os Canais são plurais.
- Beehiiv, Website, LinkedIn, RSS e PDF são canais (R-06, R-07).

## R-04 · O que é Renderer

**Um Renderer é uma projeção pura: Conteúdo (modelo canônico) → representação específica de um Canal.**

- **Nunca acrescenta nem remove conhecimento editorial.** Só formata.
- É **determinístico** e sem efeito colateral sobre o Conteúdo. Rodar duas vezes produz o mesmo artefato.
- Existe um Renderer por par (Canal × formato): e-mail (HTML email-safe), plain text, web. Todos derivam **do mesmo** Conteúdo (DR-01).

## R-05 · O que é Publisher

**O Publisher é o ator/serviço que transporta um artefato renderizado para um Canal externo, gerindo idempotência, agendamento e o ciclo rascunho→publicado.**

- **Transporta; nunca edita Conteúdo.** Lê o artefato já renderizado como imutável (herdado do comportamento atual do `beehiiv-publish`).
- É idempotente por **content-hash** (DR-22 mantém).
- Opera em `mock` / `dry-run` / `live` conforme credenciais (DR-22 mantém).
- Passa pelo **QA gate** e pelo **bloqueio de `illustrative`** antes de qualquer dispatch (DR-11, DR-17).

## R-06 · O que é Beehiiv

**Beehiiv é um Canal de distribuição externo, genérico e substituível** (SaaS de newsletter).

É **detalhe de infraestrutura**, não domínio. O domínio depende da *capacidade* "entregar newsletter a assinantes"; Beehiiv é uma implementação dessa capacidade. Se Beehiiv sumisse amanhã, **o The Loyalty continuaria existindo** (herdado da análise do DDD-001): trocaria-se o Publisher e o Canal, o Core permaneceria intacto. Beehiiv também hospeda o **agregado externo Reader** (R-08).

## R-07 · O que é Website

**O Website é um Canal (superfície web) que publica Edições e Relatórios como páginas, mais a Landing de aquisição.**

- É **entrega e consumo**, não fonte de verdade. As páginas são **projeções** do Conteúdo canônico.
- Inclui: arquivo/índice, página de leitura da edição, páginas Pro, e a Landing (aquisição — subconjunto de marketing, não editorial).
- `/edicao` e `/pro` são **públicos e navegáveis** e devem ser linkados na navegação (DR-20).

## R-08 · O que é o Leitor (implícito na lista, decidido aqui)

**O Leitor é um agregado externo, referenciado por identidade, fora do domínio local na v1** (DR-18). Vive no Canal (Beehiiv). Métricas de leitura são **Engagement Analytics**, fora do domínio v1 (DR-21).

## R-09 · O que é JSON

**JSON é UM formato de serialização do modelo canônico de Conteúdo — a codificação de transporte/armazenamento, não o Conteúdo.**

Conteúdo é *modelo*; JSON é *um fio*. A frase "uma edição = um JSON" (das skills) é reinterpretada oficialmente como: *"uma edição = um Conteúdo canônico, hoje serializado em JSON."* O JSON é substituível sem perda de domínio. **Como** exatamente serializar (schema, draft, keys) → RFC-001.

## R-10 · O que é HTML

**HTML é um formato de saída renderizado para um Canal (e-mail/web) — uma projeção derivada, descartável e regenerável.**

Nunca é fonte. É produto de um Renderer (R-04). Um HTML de e-mail e uma página web são **dois artefatos** do **mesmo** Conteúdo. Apagar todo HTML não perde domínio: re-renderiza-se.

## R-11 · O que é Componente

**Um Componente é uma unidade reutilizável de *apresentação* (UI/marca)** — ContaBlock, TLBadge, SectionLabel, CompareBanner, PontoMascot.

Pertence à camada de **rendering/marca**, não ao domínio. **Distinção crítica:** alguns "componentes" nomeados na marca são **conceitos de domínio vestidos de UI** — **Deal Desk** e **Conta feita** são *domínio* (entidades da Edição); o *ContaBlock* que os desenha é *componente*. O domínio é o que o componente **mostra**; o componente é **como** mostra.

## R-12 · O que é Layout

**Layout é o arranjo espacial/estrutural dos Componentes numa superfície de Canal.** Apresentação pura, específica do Canal (e-mail 600px coluna única vs. web responsivo). Nunca carrega conhecimento editorial.

---

# Parte II — Decision Records

> Cada DR resolve um conflito/ambiguidade do DDD-001. Formato fixo: **Problema · Alternativas · Trade-offs · Escolha · Justificativa · Impacto · Migração · Retrocompatibilidade.**

---

## DR-01 · Modelo canônico de Edição (flat vs 19 seções)

**Problema.** DDD-001 C-8/DC1: existem dois modelos incompatíveis para o mesmo produto Daily — "flat" (`content/`, chaves camelCase, veredito com faixas + `scoreBreakdown`, overrule de vigência como erro) e "19 seções" (`renderer/`, chaves snake_case PT, seções ricas — program/bank/retail watch, lab, sinais rápidos, sua leitura —, veredito categórico, vigência como aviso).

**Alternativas.**
1. Canonizar o **flat** e descartar as seções extras.
2. Canonizar o **19 seções** e descartar o rigor de faixas/breakdown.
3. **Unificar:** núcleo de julgamento do flat (faixas, breakdown, overrule-erro) + amplitude editorial do 19 seções como **seções opcionais**.

**Trade-offs.** (1) perde a riqueza editorial que a landing promete ("bancos e cartões, programas, varejo… sua leitura por perfil"). (2) enfraquece o Core (veredito sem faixa, vigência mole) — inaceitável. (3) modelo maior, porém preserva Core **e** superfície editorial; custo de definição maior, pago uma vez.

**Escolha.** **Alternativa 3.** O modelo canônico único adota o **núcleo de rigor do flat** (TL Score com faixas, `scoreBreakdown` que fecha, overrule de vigência como **erro**, veredito derivado de faixa) e **absorve as seções do 19-seções como conteúdo editorial opcional** (program watch, bank & cards, retail & coalition, loyalty lab, sinais rápidos, sua leitura, o que evitaria). Linguagem ubíqua dos campos editoriais = **pt-BR** (DR-03/DR-24). O schema concreto → RFC-001.

**Justificativa.** O Core não pode ser negociado (R-CORE); logo o rigor do flat é mandatório. As seções do 19 são conteúdo real que o produto já vende na landing; descartá-las mutila o produto. Unificar é a única opção que respeita R-CORE **e** a promessa de produto.

**Impacto.** Um único modelo de Conteúdo passa a existir. Os dois schemas, dois validadores, dois renderers e dois componentes web colapsam em uma linha (implementação → RFC-001). Fim da divergência estrutural.

**Migração.** As edições Nº 27/28 (flat) e o exemplo Nº 41 (19 seções) são reexpressos no modelo unificado como exemplos. → RFC-001 define o schema e converte os exemplos.

**Retrocompatibilidade.** Sem impacto de produção (premissa). Nenhuma edição publicada a converter.

---

## DR-02 · Pipeline único (fim dos dois pipelines / npm scripts)

**Problema.** DDD-001 DC8/4.5: o pipeline **documentado** (`validate/render/publish/edition/beehiiv`, citado 29×) **não está wired**; o único wired (`daily:*`) usa o **outro** modelo. Dois pipelines paralelos para o mesmo produto.

**Alternativas.** (1) Manter os dois. (2) Um pipeline único, alinhado ao modelo canônico de DR-01.

**Trade-offs.** (1) dobra manutenção e garante divergência (rejeitado). (2) uma superfície de comandos, um QA, um render.

**Escolha.** **Pipeline único** sobre o modelo canônico (DR-01). A superfície de comandos oficial é a **documentada** (`validate → render → publish → edition`; `beehiiv` para dispatch), pois é a que as skills, o CLAUDE.md, o COWORK e o content/README descrevem. O trio `daily:*` é **legado** e será absorvido/removido. Wiring exato do `package.json` → RFC-001.

**Justificativa.** A documentação, as skills e o contrato do Research Editor (COWORK) já assumem esse pipeline; alinhá-lo ao código custa menos que reescrever toda a doc.

**Impacto.** Um comando por etapa; QA e render deixam de bifurcar.

**Migração.** → RFC-001 conecta os scripts corretos ao modelo canônico e apaga o pipeline duplicado.

**Retrocompatibilidade.** Sem impacto de produção. Comandos hoje rodados por `node` direto passam a ter wiring; nada quebra externamente.

---

## DR-03 · Linguagem ubíqua oficial = pt-BR

**Problema.** Chaves e termos oscilam entre inglês camelCase (flat) e português snake_case (19 seções); marca oscila entre "The Loyal" e "The Loyalty".

**Alternativas.** (1) Inglês. (2) Português. (3) Misto (status quo).

**Trade-offs.** (1) desalinha da voz de marca e do público pt-BR; (2) alinha marca/voz/leitor; (3) é a origem da confusão.

**Escolha.** **Português (pt-BR) é a linguagem ubíqua oficial** do domínio: Sinal do dia, Deal Desk, Conta feita, Veredito, Fecha logo, Vigência, Fonte, TL Score. A grafia exata das chaves de serialização (camelCase vs snake_case) é **decisão de implementação → RFC-001**, mas os *termos* são os pt-BR acima.

**Justificativa.** Produto, leitor, voz de marca e 5 dos 6 documentos vivos são pt-BR. A linguagem ubíqua deve ser a do domínio, não a de conveniência de código.

**Impacto.** Todo vocabulário conflitante converge. Glossário do DDD-001 §3 vira normativo.

**Migração.** → RFC-001 fixa as chaves; termos passam a ser os do glossário.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-04 · Nome oficial da marca

**Problema.** DDD-001 C-1: "The Loyal" (layout, shell, EdicaoMock, DailyEdition) vs "The Loyalty" (edição, EditionArticle, todo o Pro, CLAUDE.md, schema id).

**Alternativas.** (1) The Loyal. (2) The Loyalty.

**Trade-offs.** Puramente de correção; "The Loyal" aparece só nas superfícies legadas do modelo 19-seções/landing antiga.

**Escolha.** **"The Loyalty".** "The Loyal" é erro legado a corrigir em todas as superfícies.

**Justificativa.** CLAUDE.md (topo da hierarquia vigente), o `$id` do schema (`theloyalty`), o disclaimer, o Pro e a identidade editorial usam "The Loyalty". É o nome do domínio.

**Impacto.** Uma marca, um nome.

**Migração.** → RFC-001/limpeza substitui as ocorrências de "The Loyal".

**Retrocompatibilidade.** Sem impacto de produção; nenhum domínio/e-mail enviado com o nome antigo.

---

## DR-05 · Taxonomia oficial de veredito

**Problema.** DDD-001 C-2/DC2: três taxonomias — flat (6: `vale-agir, vale-olhar, casos-especificos, esperaria, evitaria, nao-confirmado`), 19-seções (7: acrescenta `depende`, `nao-vale`, remove `casos-especificos`), landing (4 na prosa).

**Alternativas.** (1) Set de 6 (flat, com faixas). (2) Set de 7 (19-seções, categórico). (3) Novo set.

**Trade-offs.** (1) ancorado em faixas de TL Score (Core) e é o "mapa semântico obrigatório" do CLAUDE.md; (2) tem termos ambíguos (`depende` sobrepõe `esperaria`/`casos-especificos`; `nao-vale` sobrepõe `evitaria`) e não tem faixas; (3) custo sem ganho.

**Escolha.** **Set oficial de 6, ancorado em faixas** (o mapa do CLAUDE.md):

| Faixa TL Score | Veredito (chave) | Rótulo | Cor |
|---|---|---|---|
| 85–100 | `vale-agir` | Vale agir | green-600 |
| 70–84 | `vale-olhar` | Vale olhar | blue-600 (DR-07) |
| 55–69 | `casos-especificos` | Só para casos específicos | gray-400 |
| 40–54 | `esperaria` | Esperaria | yellow-500 fill / texto Ink |
| 0–39 | `evitaria` | Evitaria | red-600 |
| s/ dado | `nao-confirmado` | Não confirmado | gray-400, borda tracejada |

`depende` e `nao-vale` são **depreciados** (aliases: `depende`→`esperaria` ou `casos-especificos` conforme faixa; `nao-vale`→`evitaria`).

**Justificativa.** O veredito é saída do Core e deve derivar do TL Score (DR-06). Só o set de 6 tem faixas. CLAUDE.md, mais alto na hierarquia de verdade, já o declara "obrigatório".

**Impacto.** Um único vocabulário de veredito em todas as superfícies; fim do conflito de rótulo.

**Migração.** → RFC-001 remove `depende`/`nao-vale` do schema/renderer 19-seções e mapeia exemplos.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-06 · Veredito deriva do TL Score (faixas são canônicas)

**Problema.** DDD-001 C-4: faixas existem só no flat; o 19-seções trata veredito como categórico livre.

**Alternativas.** (1) Veredito livre. (2) Veredito **derivado** obrigatoriamente da faixa do TL Score.

**Trade-offs.** (1) permite incoerência nota↔veredito (risco de credibilidade); (2) garante coerência mecânica, custa a disciplina de sempre ter TL Score.

**Escolha.** **Veredito é função da faixa do TL Score** (`verdictForScore`), exceto `nao-confirmado` (que independe de nota). Declarar veredito fora da faixa da nota é **erro de QA bloqueante**.

**Justificativa.** É a garantia central de que o selo (veredito) não mente sobre a nota. Núcleo da auditabilidade.

**Impacto.** Coerência TL Score↔veredito verificável e obrigatória.

**Migração.** → RFC-001 estende a regra ao pipeline unificado.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-07 · Cor de `vale-olhar`

**Problema.** DDD-001 C-3/DC3: azul (CLAUDE.md, `lib.mjs`) vs verde (`renderer/tokens.mjs`).

**Alternativas.** (1) Azul. (2) Verde.

**Trade-offs.** Verde colide com `vale-agir` (85–100), colapsando a distinção visual do topo da escala; azul (token de "Sinal/links/foco") mantém verde exclusivo do tier máximo.

**Escolha.** **blue-600 (`#315CFF`).** O "green" do renderer é bug.

**Justificativa.** CLAUDE.md declara 70–84 → blue-600. Reservar verde só para `vale-agir` preserva a semântica de "só o melhor é verde" e respeita a regra de verde-texto (green-600).

**Impacto.** Escala de cor do veredito consistente e monotônica.

**Migração.** → RFC-001 corrige `renderer/tokens.mjs`.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-08 · Nomes oficiais dos 8 critérios do TL Score

**Problema.** DDD-001 C-5/DC6: prosa da landing usa `clareza`/`risco`; fórmula/schema/pesos usam `regra`/`estoque`.

**Alternativas.** (1) clareza/risco. (2) regra/estoque.

**Trade-offs.** A fórmula e o schema são verdade executável (somam 100, alimentam o QA); a prosa é texto.

**Escolha.** Critérios oficiais e pesos: **`valor` 25 · `regra` 15 · `vigência` 15 · `fricção` 10 · `aplicabilidade` 10 · `liquidez` 10 · `estoque` 10 · `fontes` 5.** `clareza`→`regra`, `risco`→`estoque` são aliases depreciados.

**Justificativa.** A fórmula pública e auditável é o Core; a prosa deve conformar-se a ela, não o inverso.

**Impacto.** `scoreBreakdown` e a comunicação da metodologia passam a usar os mesmos 8 nomes.

**Migração.** → RFC-001/COPY corrige a prosa da landing.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-09 · Overrule de vigência é ERRO bloqueante (não aviso)

**Problema.** DDD-001 DC4/DP3: vigência ausente é **erro** no flat e **aviso** no 19-seções.

**Alternativas.** (1) Aviso. (2) Erro bloqueante + forçar `nao-confirmado`.

**Trade-offs.** (1) permite publicar recomendação sem janela confirmada — viola regra inviolável 9 e overrule 5.4; (2) é mais rígido, custa disciplina editorial.

**Escolha.** **Erro bloqueante.** Sem vigência confirmada ⇒ veredito **obrigatoriamente** `nao-confirmado`; vigência expirada vs. data de referência ⇒ **bloqueio de publicação**.

**Justificativa.** É regra inviolável (DDD-001) e a essência da promessa ("oferta sem data e regra clara não vira recomendação"). Um domínio de credibilidade não pode ter a checagem-âncora como "aviso".

**Impacto.** Nenhuma superfície publica recomendação sem vigência.

**Migração.** → RFC-001 eleva a severidade no validador do pipeline unificado.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-10 · Forma canônica da Conta feita

**Problema.** DDD-001 A-1/C-8: `conta.rows`+`result` (flat) vs `conta_feita.linhas`+`total`+`nota` (19-seções).

**Alternativas.** (1) rows/result. (2) linhas/total/nota. (3) outra forma.

**Trade-offs.** (2) é superconjunto de (1): pares de linhas + total destacado + nota opcional.

**Escolha.** **Conta feita = `linhas` (pares chave/valor) + `total` (par destacado, em verde) + `nota` (opcional).** Termos ubíquos pt-BR (DR-03).

**Justificativa.** Superconjunto preserva tudo; `nota` é útil e não custa. Alinha com a assinatura visual "conta feita" (Ink fixo, resultado verde).

**Impacto.** Uma forma de conta em todos os renderers.

**Migração.** → RFC-001 unifica; conversão trivial de `result`→`total`.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-11 · Integridade do disclaimer = igualdade exata

**Problema.** DDD-001 DC5: disclaimer verificado de 4 formas (substring / igualdade / semântica / comprimento).

**Alternativas.** (1) Substring. (2) Semântica. (3) Igualdade exata byte-a-byte.

**Trade-offs.** (1)/(2) toleram variação de um texto legal que deve ser íntegro; (3) é o único seguro para texto obrigatório.

**Escolha.** **Igualdade exata** da string oficial em toda superfície que carrega recomendação. As demais checagens são depreciadas.

**Justificativa.** É regra inviolável 10 e texto de proteção legal; integridade parcial não é integridade.

**Impacto.** Uma checagem, um texto-fonte único (parte do shared kernel, DR-12).

**Migração.** → RFC-001 uniformiza os validadores.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-12 · Shared Kernel único (tokens, veredito, disclaimer, fórmulas)

**Problema.** DDD-001 DC7/2.6: kernel triplicado (`scripts/lib.mjs`, `renderer/tokens.mjs`, `tailwind.config.ts`) já divergiu.

**Alternativas.** (1) Manter cópias sincronizadas à mão. (2) Fonte única compartilhada.

**Trade-offs.** (1) garante divergência ao longo do tempo; (2) exige uma fonte de verdade e derivação, custo de setup pago uma vez.

**Escolha.** **Uma fonte única** para tokens de cor, taxonomia de veredito+faixas, disclaimer oficial e fórmulas. As três cópias atuais convergem para um kernel derivado. **Onde** vive esse kernel → RFC-001.

**Justificativa.** É o "shared kernel" de DDD (2.6). Um kernel que não é compartilhado não é kernel — é dívida.

**Impacto.** Mudar um token/faixa/fórmula passa a ser edição única.

**Migração.** → RFC-001 escolhe a fonte e faz as demais derivarem.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-13 · Schema canônico único da Edição

**Problema.** DDD-001 C-8: duas `edition.schema.json` (draft 2020-12 flat / draft-07 19-seções).

**Alternativas.** (1) Duas. (2) Uma.

**Escolha.** **Um schema canônico** para o modelo unificado (DR-01). O segundo é removido. Draft, localização e chaves → RFC-001.

**Justificativa.** Um modelo (DR-01) exige um schema. Dois schemas para um conceito é a definição de ambiguidade.

**Impacto.** Um contrato de dados para a Edição.

**Migração.** → RFC-001.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-14 · `signal` desambiguado

**Problema.** DDD-001 C-6/A-5: `signal` = tese editorial (Daily) **e** `Player.signal` = direção de mercado `abertura/aperto/estável` (Pro).

**Alternativas.** (1) Manter homônimos. (2) Renomear um.

**Escolha.** **"Sinal do dia"** permanece para a tese editorial do Daily. A direção de mercado do Pro passa a ser **"Direção" (de mercado)**, valores `abertura/aperto/estável`. Termos distintos, sem colisão.

**Justificativa.** Dois conceitos não relacionados não podem compartilhar termo na linguagem ubíqua.

**Impacto.** Glossário sem homônimo perigoso.

**Migração.** → RFC-001 renomeia o campo no modelo Pro.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-15 · Imutabilidade e Errata da Edição

**Problema.** DDD-001 7.2/DI1/DI2: editar o JSON após publicar é possível e não rastreado; sem versionamento; sem semântica de correção.

**Alternativas.** (1) Edição mutável. (2) Imutável após publicar, com **Errata versionada** para correções. (3) Imutável, correção só via nova Edição.

**Trade-offs.** (1) mina a confiança (o que o leitor recebeu pode não ser o que está no arquivo); (2) preserva o registro e permite corrigir com transparência; (3) mais simples, porém sem forma de corrigir a mesma peça.

**Escolha.** **Alternativa 2.** Estados oficiais: `Rascunho → Validada → Publicada → (Errata)`. Após `Publicada`, o Conteúdo é **imutável**; correção material é uma **Errata versionada e datada**, nunca edição silenciosa. Erro grave pode gerar **nova Edição** referenciando a anterior.

**Justificativa.** Credibilidade exige que o registro publicado seja fiel ao que foi entregue. Errata transparente é a prática de mídia séria (Sage).

**Impacto.** Edição ganha ciclo de vida e identidade estável.

**Migração.** → RFC-001 define como registrar estado/errata (o *como*).

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-16 · Ciclo de vida: a Edição não é arquivada; a vigência expira

**Problema.** DDD-001 7.2/DI3: sem arquivamento/expiração; "Edition Archived" inexistente.

**Alternativas.** (1) Arquivar/expirar edições. (2) Edição é registro histórico permanente; só a **vigência da oferta** expira.

**Escolha.** **Alternativa 2.** A Edição é permanente (histórico). O que expira é a **vigência** de cada Deal; uma oferta vencida numa edição antiga permanece visível como registro, com a vigência claramente expirada. Não há `Edition Archived`.

**Justificativa.** Arquivo editorial é ativo, não lixo. O leitor pode consultar o histórico; a expiração é da oferta, não do texto.

**Impacto.** `/edicao` é um arquivo permanente; nenhuma edição some.

**Migração.** → RFC-001 (apresentação de "vigência expirada" no arquivo).

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-17 · Bloqueio de conteúdo `illustrative` no dispatch

**Problema.** DDD-001 DP1: **todas** as edições são `illustrative`; nada impede publicá-las como reais.

**Alternativas.** (1) Confiar no operador. (2) Bloqueio duro no Publisher e no índice público.

**Escolha.** **Bloqueio duro.** Uma Edição/Relatório com `illustrative: true` **nunca** pode ser despachada a Canal real (Beehiiv `publish`/`schedule`) nem entrar no índice público de produção. É válida apenas para preview/dev. `--force` **não** contorna este bloqueio (DR-23).

**Justificativa.** Publicar exemplo com números inventados como se fosse real quebra a regra-mãe de credibilidade — o pior evento possível para a marca.

**Impacto.** Impossível vazar conteúdo fictício para o público.

**Migração.** → RFC-001 adiciona o gate ao Publisher/índice.

**Retrocompatibilidade.** Sem impacto de produção (na verdade, protege a primeira publicação real).

---

## DR-18 · O Leitor não é agregado local na v1

**Problema.** DDD-001 DI4/Q14: não há entidade de Leitor; vive no Beehiiv.

**Alternativas.** (1) Modelar Leitor localmente (base própria). (2) Manter no Canal externo, referenciado por identidade.

**Trade-offs.** (1) habilita segmentação/personalização, mas cria domínio de dados pessoais (LGPD), custo e responsabilidade altos; (2) simples, delega privacidade ao Beehiiv, limita personalização.

**Escolha.** **Alternativa 2 para a v1.** O Leitor é agregado **externo**, referenciado por identidade (e-mail/subscription id). Personalização/segmentação ficam fora do domínio v1. Reavaliar quando/se personalização virar necessidade de Core.

**Justificativa.** Não há valor de Core hoje em possuir a base; há passivo (LGPD, segurança). O produto entrega valor sem deter o leitor.

**Impacto.** Domínio v1 enxuto; sem PII local.

**Migração.** N/A na v1.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-19 · Produto vs Canal (taxonomia oficial)

**Problema.** DDD-001 3.7/A: a landing mistura produtos e canais; Special citado sem vestígio.

**Alternativas.** (1) Tratar tudo como "produto". (2) Separar Produtos (linhas editoriais) de Canais (superfícies de entrega).

**Escolha.** **Separação oficial.**
- **Produtos** (linhas editoriais): **Daily**, **Weekly**, **Lab**, **Pro**, **Special**.
- **Canais/formatos** (entrega): **Newsletter (e-mail)**, **Website**, **Landing**, **RSS**, **PDF**, **LinkedIn**.
- Uma Edição de um Produto é entregue por N Canais.

**Justificativa.** São dois níveis distintos (o que se diz vs. por onde se entrega). Confundi-los gera código ad-hoc por canal.

**Impacto.** Vocabulário de produto/canal fixo; base para DR-19b.

**Migração.** → RFC-001/COPY alinha a landing.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-19b · Escopo de produto da v1: apenas Daily e Pro

**Problema.** DDD-001 9.4/Q10/DI9: Weekly, Lab e Special são promessa de landing sem contrato de dados.

**Alternativas.** (1) Modelar já os cinco. (2) v1 só com Daily + Pro; Weekly/Lab/Special como roadmap sem contrato até terem definição editorial.

**Trade-offs.** (1) modela o que não existe (especulação); (2) foca no real, adia o incerto.

**Escolha.** **Alternativa 2.** O **modelo de domínio v1 cobre Daily e Pro**. **Weekly** e **Lab** são reconhecidos como produtos futuros — candidatos a *derivados* (Weekly = visão sobre Deals ainda vigentes de várias Edições; Lab = conteúdo evergreen desacoplado de vigência) — mas **sem contrato de domínio até serem especificados**. **Special** permanece nome sem definição e **não** entra no domínio. A landing **não deve prometer produto sem contrato** (recomendação de produto; execução → COPY/RFC).

**Justificativa.** Modelar o inexistente é dívida especulativa. Daily+Pro são a base real; Weekly/Lab herdarão o modelo canônico quando definidos.

**Impacto.** Escopo v1 nítido.

**Migração.** N/A (adição futura).

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-20 · `/edicao` e `/pro` são públicos e navegáveis

**Problema.** DDD-001 9.4/K: rotas existem mas não são linkadas no nav da landing.

**Alternativas.** (1) Manter só âncoras. (2) Linkar arquivo e Pro na navegação.

**Escolha.** **Linkar.** O Website (R-07) expõe publicamente o arquivo (`/edicao`) e o Pro (`/pro`); a navegação deve alcançá-los.

**Justificativa.** Produto entregue e inacessível é desperdício; o arquivo é prova de método (reforça credibilidade).

**Impacto.** Superfícies web descobríveis.

**Migração.** → RFC-001/UI adiciona os links.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-21 · "Analytics" desdobrado em dois conceitos

**Problema.** DDD-001 A-2/Q11: "Analytics" = análise de mercado (Pro) **e** métricas de leitura.

**Alternativas.** (1) Um termo. (2) Dois termos distintos.

**Escolha.** **Dois conceitos oficiais:**
- **Análise de Mercado (Market Analytics)** — o produto **Pro**: leitura editorial do mercado (benchmarks, direção de players, matriz, alertas). **Dentro** do domínio (adjacente ao Core).
- **Analytics de Engajamento (Engagement Analytics)** — aberturas/cliques/cancelamentos do Leitor. **Fora** do domínio v1; vive no Canal (Beehiiv).

**Justificativa.** São domínios diferentes (produzir análise vs. medir consumo). Unir o nome esconde a fronteira.

**Impacto.** "Analytics" deixa de ser ambíguo.

**Migração.** N/A.

**Retrocompatibilidade.** Sem impacto de produção.

---

## DR-22 · Publisher: idempotência, modos e imutabilidade de conteúdo (ratificação)

**Problema.** DDD-001 A-3/N: "Publisher" tem três referentes; comportamento de idempotência/modos precisa ser oficializado.

**Alternativas.** (1) Redefinir. (2) **Ratificar** o comportamento existente como oficial.

**Escolha.** **Ratificar e nomear.** O **Publisher** (R-05) é o serviço de dispatch. Oficial:
- **Idempotência por content-hash** (SHA-256 sobre conteúdo+metadados de envio); dispatch duplicado bloqueado sem `--force`.
- **Modos** `mock` / `dry-run` / `live` conforme credenciais.
- **Imutabilidade de conteúdo:** o Publisher lê artefato renderizado; **nunca** reescreve Conteúdo.
- O passo **`publish`** (índices locais) e o passo **`beehiiv`** (dispatch) são **distintos**; "publicar índices" ≠ "enviar". Ledger é o registro de dispatch.

**Justificativa.** O comportamento atual é são e alinhado ao Core (conteúdo imutável, envio deliberado). Só faltava ser declarado canônico e desambiguado dos homônimos.

**Impacto.** "Publisher" tem um referente; envio é sempre deliberado e idempotente.

**Migração.** N/A (ratificação).

**Retrocompatibilidade.** Preserva o comportamento existente.

---

## DR-23 · Política de `--force` e do gate de QA

**Problema.** DDD-001 DP6/Q18: `--force` contorna a trava anti-duplicação; escopo indefinido.

**Alternativas.** (1) `--force` livre. (2) `--force` restrito e sem poder sobre QA/illustrative.

**Escolha.** **`--force` contorna SOMENTE a idempotência (hash duplicado).** Nunca pula o **QA gate** nem o **bloqueio `illustrative`** (DR-17). Uso restrito ao papel humano Publisher, com intenção explícita.

**Justificativa.** Re-disparo consciente é legítimo; burlar QA ou publicar exemplo, jamais. As duas proteções mais importantes ficam fora do alcance da flag.

**Impacto.** `--force` é seguro por construção.

**Migração.** → RFC-001 garante a ordem dos gates.

**Retrocompatibilidade.** Preserva o `--force` atual, apenas cerca seu poder.

---

## DR-24 · Fluxo de assinatura real (fim do mock client-side)

**Problema.** DDD-001 DP4/J: `SubscribeForm` usa mock `setTimeout` e não chama a rota real `/api/subscribe`.

**Alternativas.** (1) Manter mock no client. (2) Form chama a rota real; mock só server-side quando faltam credenciais.

**Escolha.** **Alternativa 2.** O fluxo sancionado é único: o formulário chama a rota real; o **mock existe apenas no servidor** (sem credenciais, para dev/preview). Falso sucesso client-side é proibido.

**Justificativa.** Dar "inscrito!" sem inscrever engana o leitor — incompatível com a marca. A rota real já existe; falta ligá-la.

**Impacto.** Assinatura real de ponta a ponta; preview continua funcionando via mock server-side.

**Migração.** → RFC-001/UI liga o form à rota.

**Retrocompatibilidade.** Sem impacto de produção (nenhum assinante real veio do form até aqui).

---

## DR-25 · Contraste `gray-400` sobre Paper em texto pequeno = bloqueio

**Problema.** DDD-001 9.5/Q21: `gray-400 #8A8578` sobre Paper ~3.44:1 (< AA 4.5:1) em rótulos/meta; hoje só "aviso".

**Alternativas.** (1) Aviso. (2) Bloqueio para texto pequeno, com `gray-500` como cor de rótulo/meta.

**Escolha.** **Bloqueio para texto pequeno.** Rótulos/meta usam **`gray-500 #555555`**; `gray-400` só onde passar AA (texto grande/decorativo não-essencial). Acessibilidade é gate de publicação (CLAUDE.md).

**Justificativa.** CLAUDE.md lista contraste AA como gate; um gate que passa abaixo do limite não é gate.

**Impacto.** Rótulos legíveis; AA garantido.

**Migração.** → RFC-001/UI troca a cor dos rótulos.

**Retrocompatibilidade.** Sem impacto de produção.

---

# Parte III — Decision Matrix

> Todas as decisões oficiais da v1.0. Vinculantes. `→ RFC-001` marca o que a RFC implementa (o *como*), nunca reabre (o *quê*).

## Rulings conceituais

| ID | Conceito | Ruling oficial |
|---|---|---|
| R-CORE | Domínio principal | **Julgamento Editorial Auditável** (Core). Entrega nunca enfraquece o Core; credibilidade vence. |
| R-AGG | Agregado raiz | **Edição** (Daily). ProReport é agregado separado. Reader é agregado externo. Deal/Conta/Veredito/TL Score/Fonte/Vigência são internos à Edição. |
| R-01 | Edição | Snapshot editorial imutável-após-publicação, id `(produto, número)`, um Conteúdo → cinco projeções. |
| R-02 | Conteúdo | Conhecimento editorial agnóstico a canal/formato; vive no modelo canônico. |
| R-03 | Canal | Superfície de entrega. Não é produto. Uma Edição → N Canais. |
| R-04 | Renderer | Projeção pura Conteúdo→Canal; determinística; não altera conhecimento. |
| R-05 | Publisher | Transporta artefato renderizado a Canal externo; idempotente; não edita Conteúdo. |
| R-06 | Beehiiv | Canal externo genérico e substituível (infra, não domínio). |
| R-07 | Website | Canal web (arquivo + leitura + Pro + Landing); projeção, não fonte. |
| R-08 | Leitor | Agregado externo, referenciado por identidade; fora do domínio v1. |
| R-09 | JSON | Uma serialização do Conteúdo; transporte, não identidade. |
| R-10 | HTML | Saída renderizada por Canal; derivada, descartável, regenerável. |
| R-11 | Componente | Unidade de apresentação (UI/marca). Deal Desk/Conta feita são domínio; o componente só os desenha. |
| R-12 | Layout | Arranjo espacial de componentes por Canal; apresentação pura. |

## Decision Records

| ID | Decisão | Escolha oficial | Depreca / substitui | Implementação |
|---|---|---|---|---|
| DR-01 | Modelo de Edição | **Um modelo** = rigor do flat + seções do 19-seções (opcionais) | os dois modelos separados | → RFC-001 |
| DR-02 | Pipeline | **Um pipeline**; comandos `validate/render/publish/edition/beehiiv` | trio `daily:*` legado | → RFC-001 |
| DR-03 | Linguagem ubíqua | **pt-BR** | mix EN/PT | → RFC-001 (chaves) |
| DR-04 | Nome da marca | **The Loyalty** | "The Loyal" | → limpeza |
| DR-05 | Taxonomia de veredito | **6 valores banded** (vale-agir…nao-confirmado) | `depende`, `nao-vale` | → RFC-001 |
| DR-06 | Veredito↔TL Score | **Deriva da faixa**; fora da faixa = erro | veredito categórico livre | → RFC-001 |
| DR-07 | Cor de `vale-olhar` | **blue-600** | green no renderer | → RFC-001 |
| DR-08 | Critérios TL Score | **valor/regra/vigência/fricção/aplicabilidade/liquidez/estoque/fontes** (25/15/15/10/10/10/10/5) | clareza/risco | → COPY/RFC |
| DR-09 | Vigência | **Erro bloqueante** → `nao-confirmado`; expirada bloqueia | vigência como aviso | → RFC-001 |
| DR-10 | Conta feita | **linhas + total + nota** | rows/result | → RFC-001 |
| DR-11 | Disclaimer | **Igualdade exata** | substring/semântica/comprimento | → RFC-001 |
| DR-12 | Shared kernel | **Fonte única** (tokens/veredito/disclaimer/fórmulas) | tripla cópia | → RFC-001 |
| DR-13 | Schema | **Um schema canônico** | dois schemas | → RFC-001 |
| DR-14 | `signal` | Daily = **Sinal do dia**; Pro = **Direção** (abertura/aperto/estável) | homônimo | → RFC-001 |
| DR-15 | Imutabilidade/Errata | Imutável após publicar; correção = **Errata versionada** ou nova Edição | edição silenciosa | → RFC-001 |
| DR-16 | Ciclo de vida | Edição **permanente**; expira a **vigência**, não a edição | "Edition Archived" | → RFC-001 |
| DR-17 | `illustrative` | **Bloqueio duro** no dispatch e índice público | publicar exemplo | → RFC-001 |
| DR-18 | Leitor | **Externo** (Beehiiv), por identidade; sem PII local na v1 | base local | v1: N/A |
| DR-19 | Produto vs Canal | **Separação oficial** (5 produtos / 6 canais) | mistura | → COPY/RFC |
| DR-19b | Escopo v1 | **Daily + Pro**; Weekly/Lab/Special = roadmap sem contrato | modelar o inexistente | futuro |
| DR-20 | `/edicao` e `/pro` | **Públicos e navegáveis** (linkados) | rotas órfãs | → RFC-001/UI |
| DR-21 | Analytics | **Market Analytics** (Pro, in-domain) vs **Engagement Analytics** (out, canal) | termo ambíguo | v1: N/A |
| DR-22 | Publisher | Ratificado: idempotência por hash, modos mock/dry-run/live, conteúdo imutável, `publish`≠`beehiiv` | homônimos | ratificação |
| DR-23 | `--force` | Só contorna idempotência; **nunca** QA nem `illustrative` | force amplo | → RFC-001 |
| DR-24 | Assinatura | Form chama rota real; **mock só server-side** | mock client-side | → RFC-001/UI |
| DR-25 | Contraste | Rótulos/meta em **gray-500**; AA é bloqueio | gray-400 pequeno como aviso | → RFC-001/UI |

---

# Parte IV — Nova Hierarquia de Verdade e liberação da RFC-001

## Hierarquia de Verdade oficial (substitui a fantasma do DDD-001 Apêndice C)

O DDD-001 apurou que a "hierarquia de verdade" citada em `CLAUDE.md`/`README.md` referencia documentos **inexistentes** (Operating Manual v1, DESIGN.md, THE-LOYALTY-LLM-SYSTEM.md, THE-LOYALTY-BRAND-GUIDELINES.md, PONTO-MASCOTE-GUIA.md, TL-GRAPHICS.md). Decisão:

**Hierarquia operativa oficial, do topo para a base:**

```
1. DDD-002 (este documento) — decisões de domínio vinculantes
2. DDD-001 — descoberta (contexto; onde conflitar com DDD-002, vence DDD-002)
3. CLAUDE.md — contrato de marca e regras invioláveis
4. Schema canônico da Edição + shared kernel (DR-12/DR-13)
5. Código (renderers, validadores, componentes)
```

As referências a documentos inexistentes devem ser **materializadas** (se o conteúdo for necessário) ou **removidas**. Até lá, **este documento é o cânone**. Nenhuma regra pode citar como fonte um artefato ausente do repositório.

## Regras invioláveis: preservadas

Nenhuma decisão deste documento revoga as regras invioláveis do `CLAUDE.md` (sem CMI/dado interno, sem cópia, sem promessa de ganho, sem urgência artificial, sem emoji, cores semânticas, "faltou dado → Não confirmado", disclaimer obrigatório). Todas as decisões acima **reforçam** essas regras; nenhuma as afrouxa.

## Estado de saída — liberação

Todas as ambiguidades e decisões represadas no DDD-001 (C-1…C-8, DC1…DC8, DP1…DP6, as 21 perguntas abertas e as 10 decisões do Apêndice D) foram **resolvidas** e registradas na Decision Matrix. O domínio agora tem:

- um **Core** nomeado e protegido,
- um **agregado raiz** definido,
- **12 conceitos** oficialmente definidos (o que é edição/conteúdo/canal/renderer/publisher/Beehiiv/website/JSON/HTML/componente/layout + agregado),
- **25 Decision Records** vinculantes,
- uma **linguagem ubíqua** única (pt-BR),
- um **modelo canônico** de Edição (a implementar),
- uma **hierarquia de verdade** real.

**A partir deste ponto, a RFC-001 pode ser escrita.** Ela implementará (o *como*) as decisões desta matriz — sem reabrir nenhuma delas (o *quê*).

*Fim do DDD-002 v1.0 — Domain Decision Report.*
