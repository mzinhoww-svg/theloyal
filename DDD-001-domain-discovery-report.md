# DDD-001 — The Loyalty Domain Discovery Report

**Version 1.0**
**Status:** Discovery — *modelagem de domínio, não arquitetura*
**Escopo:** documentar o domínio como ele existe hoje no repositório. Este documento **não** propõe arquitetura, **não** desenha componentes, **não** cria renderers, **não** escreve JSON e **não** resolve conflitos. Ele apenas descobre, mapeia, nomeia e sinaliza.

> Regra deste documento: onde há conflito, o conflito é **registrado**, não decidido. Toda decisão pendente é empurrada para o Capítulo 8 (Decisões) e para o Capítulo 10 (Perguntas Abertas). Nada é "resolvido" aqui.

> Nota de método: "melhor do que os criadores" significa registrar também o que os artefatos *afirmam existir mas não existe*, o que existe *em duplicidade divergente*, e o que a documentação *promete e o código não entrega*. Essas lacunas são domínio tanto quanto o que funciona.

---

## Sumário

1. O Problema
2. Mapa do Domínio (DDD)
3. Linguagem Ubíqua
4. Fluxos (Mapa do Conhecimento)
5. Atores
6. Eventos
7. Objetos
8. Decisões
9. Riscos
10. Perguntas Abertas
- Apêndice A — Mapa Editorial
- Apêndice B — Mapa Técnico
- Apêndice C — Mapa das Fontes de Verdade (documentos-fantasma)
- Apêndice D — Decisões que ainda NÃO podem ser tomadas

---

## Capítulo 1 — O Problema

### 1.1 Qual problema o The Loyalty resolve

No mercado de loyalty brasileiro (pontos, milhas, cartões, bancos, varejo, cashback, CRM), **a manchete e o valor real divergem sistematicamente**. Um bônus de "110%" ou um desconto de "40%" é um número de marketing; o custo real de um milheiro só aparece depois de considerar clube, cartão, taxa de conversão, prazo de crédito, vigência e liquidez de resgate. A landing formula o problema literalmente: *"Quase tudo parece bom no título… Sem esses insumos, a manchete não é informação. É banner."*

O problema, então, tem três camadas:

1. **Assimetria de informação** — o regulamento (verdade) é público mas ilegível; o banner (ruído) é claro mas incompleto.
2. **Custo cognitivo e de tempo** — fazer "a parte chata" (ler regulamento, confirmar vigência, calcular CPM/VPM/spread) é trabalhoso e a maioria não faz.
3. **Ausência de veredito confiável e independente** — as fontes existentes (blogs de cupom, comunicação oficial de programas) têm conflito de interesse ou não fazem a conta.

O produto resolve isso entregando, em ~5 minutos, **um veredito auditável com a conta aberta**: o que mudou (Sinal), quanto custa de verdade (Conta feita), por que mudou (Contexto) e o que fazer (Ação/veredito com TL Score).

### 1.2 Para quem

A landing declara seis leituras/perfis, agrupados em três intenções ("decidir, otimizar e construir"):

| Perfil | Intenção | O que busca |
|---|---|---|
| Consumidor inteligente | Decidir | Se pontos/milhas/cashback valem a pena antes de mudar hábito |
| Heavy user | Otimizar | Conta, timing, vigência, risco de estoque |
| Alta renda | Decidir | Cartão, anuidade, sala VIP, benefício sem depender do gerente |
| Profissional de loyalty | Construir | Lê movimentos de programas como sinal de estratégia |
| Bancos e cartões | Construir | Como pontos/benefícios afetam aquisição, ativação e gasto |
| Varejo e CRM | Construir | Coalizões, cashback e dados como alavanca de retenção |

Os três primeiros são **consumidores** (público do Daily gratuito). Os três últimos são **profissionais** (público-alvo do Pro, B2B). O produto tem, portanto, **dois mercados** com uma raiz analítica comum.

### 1.3 Por quê (a razão de existir)

A promessa de marca é **credibilidade por método**, não por tom (arquétipo *Sage*). O diferencial não é "ter as ofertas" — é **o rigor do julgamento**: hierarquia de fontes, vigência confirmada, fórmulas públicas e auditáveis, e a recusa explícita a chutar ("Faltou dado → Não confirmado"). O produto vende **confiança verificável**, e por isso carrega regras invioláveis que protegem essa confiança (sem dado interno/CMI, sem cópia, sem promessa de ganho, sem urgência artificial).

### 1.4 Quem sofre esse problema

- Quem **age** no mercado de loyalty com dinheiro real (compra pontos, transfere, resgata) e pode perder valor agindo pela manchete.
- Quem precisa **decidir sob incerteza** (qual cartão, quando comprar, transferir agora ou esperar) sem ferramenta de cálculo própria.
- Profissionais que precisam **ler o mercado** e hoje dependem de sinais fragmentados e enviesados.

### 1.5 Quem nunca sofre esse problema

- Quem **não usa** pontos/milhas/cashback como variável de decisão (indiferente ao milheiro).
- Quem **já tem** o cálculo internalizado e acesso primário ao regulamento (o próprio operador do programa; um analista com CMI interno — que aliás o produto se proíbe de usar como fonte).
- Quem decide por **valor de face / conveniência** e não por custo efetivo — para quem "banner bonito" basta.

> **Observação de domínio.** O problema pressupõe um leitor que *aceita fazer conta* (ou aceita que alguém a faça por ele) e que trata loyalty como decisão econômica. O produto não atende — e não tenta atender — quem trata pontos como brinde emocional. Isso define a fronteira externa do domínio.

---

## Capítulo 2 — Mapa do Domínio (DDD)

> Este capítulo classifica o que **existe** no repositório em termos de DDD. A classificação é descritiva (as-is), não prescritiva. Onde dois contextos modelam a mesma coisa de formas diferentes, isso é registrado como fato, não corrigido.

### 2.1 Core Domain

**Julgamento Editorial Auditável** — a transformação de sinais de mercado ruidosos em um **veredito** com **conta feita**, **vigência confirmada** e **TL Score**, sob uma **hierarquia de fontes** e **regras invioláveis**.

É o único lugar onde o produto é insubstituível. Materializa-se em:
- as **fórmulas** (CPM, CPM final, VPM, preço implícito, spread, custo de elegibilidade);
- o **TL Score** (8 critérios ponderados 25/15/15/10/10/10/10/5);
- a **taxonomia de veredito** (Vale agir → Evitaria → Não confirmado);
- os **overrules** (sem vigência ⇒ Não confirmado; sem fonte ⇒ fora do Deal Desk; conversão não confirmada ⇒ não calcular CPM final);
- a **hierarquia de fontes** (níveis 1–5);
- as **regras invioláveis** (sem CMI, sem cópia, sem promessa, sem urgência, sem emoji).

Tudo o mais existe para **entregar** esse núcleo sem contaminá-lo.

### 2.2 Supporting Domains

- **Rendering / Formatação** — transformar uma edição validada em e-mail email-safe, plain text e página web. Apoia o core (não o define), mas carrega invariantes de marca (mono nos números, Conta Block, chip de veredito com rótulo textual).
- **Quality Assurance / Compliance** — o gate que protege as regras invioláveis antes da publicação. Apoia o core reforçando-o mecanicamente.
- **Brand / Design System** — tokens de cor, tipografia, mascote Ponto, TL Graphics. Apoia todas as superfícies; tem regras próprias (amarelo nunca texto, verde-texto = green-600, Paper nunca branco).
- **Pro Analytics** — relatório executivo de período (benchmarks, players, matriz, alertas). Deriva do core (agrega vereditos e métricas do período) mas tem modelo e tom próprios (B2B, executivo).

### 2.3 Generic Domains

- **Distribuição / Envio de Newsletter** — Beehiiv (SaaS externo). Genérico e substituível.
- **Captação de Assinante** — formulário, honeypot, rate limit, double opt-in. Padrão de mercado.
- **Web hosting / SSG** — Next.js/Vercel. Infra genérica.
- **Analytics de leitura** — aberturas, cliques (hoje inexistente no repo; só previsto).

### 2.4 Bounded Contexts (observados no código)

| # | Bounded Context | Onde vive (as-is) | Linguagem dominante |
|---|---|---|---|
| BC-1 | **Reader Acquisition** (Landing) | `app/page.tsx`, `components/{shell,sections,SubscribeForm,EdicaoMock}.tsx`, `app/api/subscribe` | Marketing/reader-facing PT |
| BC-2 | **Research & Editorial Judgment** | `COWORK.md`, skill `tl-source-audit`, fórmulas, hierarquia de fontes | Editorial/analítica PT (Operating Manual) |
| BC-3 | **Edition Authoring** (modelo da edição) | `content/edition.schema.json`, `content/editions/*.json` **E** `renderer/edition.schema.json`, `renderer/examples/*` | **Dois dialetos** (ver 2.6) |
| BC-4 | **Rendering** | `scripts/render.mjs` + `components/EditionArticle.tsx` (flat) **E** `renderer/{email,plaintext}.mjs` + `components/daily/DailyEdition.tsx` (19 seções) | **Dois dialetos** |
| BC-5 | **QA / Compliance** | `scripts/{validate,qa,qa-daily}.mjs`, `renderer/{validate,audit,contrast}.mjs`, skills `tl-qa`/`tl-source-audit` | Regras/invariantes |
| BC-6 | **Distribution** (Beehiiv Publisher) | `scripts/beehiiv-publish.mjs`, `content/beehiiv-status.json`, `out/beehiiv/*` | Post/ledger/idempotência |
| BC-7 | **Pro Analytics** | `content/pro-report.schema.json`, `content/pro/*.json`, `lib/pro.ts`, `components/ProReport.tsx`, `scripts/pro.mjs`, `app/pro/*` | Executiva/benchmark B2B |
| BC-8 | **Brand / Design System** | `tailwind.config.ts`, `renderer/tokens.mjs`, `scripts/lib.mjs`, `components/{PontoMascot,graphics,ui}.tsx`, `public/brand/*` | Tokens/mascote |

### 2.5 Context Mapping (relações observadas — descritivo)

- **BC-8 → todos:** relação de **Shared Kernel pretendido**. Os tokens e a taxonomia de veredito deveriam ser um kernel único. **Na prática o kernel está bifurcado** (`scripts/lib.mjs` vs `renderer/tokens.mjs` mantêm cópias divergentes). Ver 2.6 e Cap. 8.
- **BC-2 → BC-3:** relação de **produtor/consumidor** (o Research Editor entrega JSON validado que alimenta a autoria). Handoff explícito e humano (COWORK §Handoff).
- **BC-3 → BC-4 → BC-6:** pipeline linear (autoria → render → distribuição). Existe **em duas versões paralelas** que não se cruzam.
- **BC-5** é **transversal**: audita BC-1 (código de landing), BC-3 (JSON), BC-4 (HTML renderizado). Mas cada pipeline traz seu próprio QA com regras diferentes (Cap. 8, D-C4).
- **BC-7** é **Conformist derivado** de BC-2 (usa a mesma taxonomia de veredito e disclaimer, mas modelo próprio).
- **BC-6 → Beehiiv (externo):** relação com **sistema genérico externo**; o publisher opera como *anti-corruption* leve (deriva campos do post a partir da edição) e é idempotente por content-hash.

### 2.6 Shared Kernel — declarado vs. real

O kernel **declarado** (o que deveria ser compartilhado por todos os contextos):
- paleta de tokens de cor;
- taxonomia de veredito + faixas do TL Score;
- disclaimer oficial (frase exata);
- fórmulas de cálculo;
- regras invioláveis.

O kernel **real** está **triplicado e divergente**:

| Elemento do kernel | Cópia A (flat) | Cópia B (19 seções) | Cópia C (marca) |
|---|---|---|---|
| Tokens | `scripts/lib.mjs TOKENS` | `renderer/tokens.mjs TOKENS` | `tailwind.config.ts` |
| Veredito | 6 valores, com faixas numéricas | 7 valores, sem faixas | mapa semântico em `CLAUDE.md` |
| Disclaimer | substring-check | igualdade exata / campo livre | presença semântica |
| Verde de `vale-olhar` | blue (CLAUDE.md/lib) | green (`renderer/tokens.mjs`) | — |

> **Este é o achado estrutural central do Discovery:** existe um Shared Kernel *conceitual* forte (a marca é obsessiva com consistência), mas *materialmente* ele foi implementado como **cópias independentes que já divergiram**. Registrado. Não resolvido aqui.

### 2.7 Os oito "domínios" citados no briefing, mapeados

O pedido lista: Customer, Publisher, Research, Knowledge, Edition, Distribution, Analytics, Automation. Onde cada um vive hoje:

- **Customer** → BC-1 (aquisição) + o modelo de leitor. **Não há entidade de leitor persistida no repo** — o leitor vive só no Beehiiv (externo). Domínio real, mas **sem representação local**.
- **Publisher** → BC-6. Concreto (`beehiiv-publish.mjs` + ledger).
- **Research** → BC-2. Concreto na *documentação* (COWORK, skill), **inexistente em código** (nenhum script faz pesquisa; é trabalho de um agente/humano).
- **Knowledge** → transversal; ver Cap. 4 e Apêndice A. Não tem "lugar" — é o conteúdo que flui.
- **Edition** → BC-3. **Duplicado** (Cap. 2.6).
- **Distribution** → BC-6 (Beehiiv) + web (SSG). Dois canais.
- **Analytics** → BC-7 (Pro, análise editorial de mercado) **e** analytics de leitura (previsto, inexistente). Termo **ambíguo** (Cap. 3).
- **Automation** → a rotina diária do Cowork (COWORK) + idempotência do publisher. **Parcialmente documentada, não orquestrada em código.**

---

## Capítulo 3 — Linguagem Ubíqua

> Todos os termos encontrados, com significado, quem usa, onde aparece, sinônimos, conflitos, ambiguidades e termos perigosos. A coluna **Camada** indica se o termo é de **Domínio** (D), de **Implementação** (I) ou **ambos** (D/I).

### 3.1 Vocabulário editorial nuclear (Domínio)

| Termo | Significado | Quem usa | Onde | Camada |
|---|---|---|---|---|
| **The Loyalty** | A mídia/marca | Todos | Marca | D |
| **Sinal do dia** | Tese principal da edição: o que mudou de verdade | Editor, Leitor | `signal`/`sinal_do_dia` | D |
| **Deal Desk** | Quadro de oportunidades com conta feita (máx. 3) | Editor, Leitor | `deals`/`deal_desk` | D |
| **Conta feita** | Ritual de cálculo aberto (chave/valor + resultado) | Editor, Leitor | `conta`/`conta_feita`, `ContaBlock` | D |
| **Veredito** | Classificação de ação sobre uma oportunidade | Editor, Leitor | `verdict`/`veredito`, `TLBadge` | D |
| **TL Score** | Nota 0–100 (8 critérios ponderados) | Editor, Leitor | `tlScore`, `scoreBreakdown` | D |
| **Vale agir** | Veredito 85–100 (verde) | Editor | taxonomia | D |
| **Vale olhar** | Veredito 70–84 | Editor | taxonomia | D |
| **Só para casos específicos** | Veredito 55–69 (cinza) — chave `casos-especificos` | Editor | taxonomia flat | D |
| **Esperaria** | Veredito 40–54 (amarelo) | Editor | taxonomia | D |
| **Evitaria** | Veredito 0–39 (vermelho) | Editor | taxonomia | D |
| **Não confirmado** | Sem dado/vigência (cinza, borda tracejada) | Editor | taxonomia | D |
| **Fecha logo** | Itens que vencem em ≤72h | Editor, Leitor | `fechaLogo`/`fecha_logo` | D |
| **O que evitaria** | Seção obrigatória de risco (19 seções) | Editor | `o_que_evitaria` | D |
| **Vigência** | Janela de validade confirmada da oferta (ISO) | Editor, QA | `vigencia`/`vigencia_iso` | D/I |
| **Fonte** | Origem da informação, com nível (1–5) e URL | Editor, QA | `source`/`sources` | D |
| **Disclaimer** | Frase oficial obrigatória e íntegra | Editor, QA, Legal | `disclaimer` | D/I |
| **Sinal (Pro)** | Direção de mercado do player: `abertura`/`aperto`/`estável` | Analista Pro | `Player.signal` | D |

### 3.2 Vocabulário de cálculo (Domínio, auditável)

| Termo | Significado |
|---|---|
| **Milheiro** | Preço/valor de mil pontos ou milhas (unidade de comparação) |
| **CPM (Custo por Milheiro)** | `valor_pago / (pontos/1000)`; com bônus divide por `(pontos+bonus)/1000` |
| **CPM final (transferência)** | `custo_origem / ((pontos·taxa·(1+bonus%))/1000)` |
| **VPM (Valor por Milheiro)** | `valor_comparavel / (pontos_usados/1000)` — só com preço verificável |
| **Preço implícito (P+D)** | `dinheiro_adicional / ((pontos_cheio − pontos_reduzido)/1000)` |
| **Spread** | `VPM_estimado − CPM_efetivo` |
| **Custo de elegibilidade** | Somar clube/cartão/segmento ao custo real |
| **Transferência bonificada** | Passar pontos de um programa a outro com bônus |
| **Estoque** | Acumular pontos para uso futuro (vs. viagem marcada) |
| **Liquidez** | Facilidade real de usar os pontos sem travas |
| **Benchmark** (Pro) | Faixa de referência low/normal/high por categoria |

### 3.3 Vocabulário de método/fonte (Domínio)

| Termo | Significado |
|---|---|
| **Hierarquia de fonte (nível 1–5)** | 1 oficial completa … 5 rumor sem link (não usar) |
| **Overrule** | Regra que sobrescreve o julgamento (ex.: sem vigência ⇒ Não confirmado) |
| **Radar / Monitoramento** | Item nível 3–4 que não sustenta recomendação |
| **Anti-cópia** | Redação sempre própria; regulamento resumido, nunca reproduzido |
| **CMI** | (Dado interno/proprietário de programa) — **proibido como fonte** |
| **Regra inviolável** | Restrição que não pode ser quebrada nem por pedido direto |
| **Independência** | Nenhum dado interno, nenhuma pauta de programa/banco |

### 3.4 Vocabulário de produto/distribuição

| Termo | Significado | Camada |
|---|---|---|
| **Daily** | Produto editorial diário (SEG–SEX 8h, 5 min) | D |
| **Weekly** | Produto de fim de semana (tese + ranking) — **prometido, não implementado** | D |
| **Lab** | Biblioteca evergreen de mecânicas — **prometido, não implementado** | D |
| **Pro** | Relatório executivo B2B de período — implementado | D |
| **Special / Landing / Website / Newsletter / RSS / PDF / LinkedIn** | Ver Cap. 3.7 (produto vs. canal) | D/I |
| **Edição** | Unidade editorial numerada de um produto | D |
| **Publisher** | Papel/serviço que envia ao Beehiiv | D/I |
| **Beehiiv** | SaaS de newsletter (externo) | I |
| **Preheader / subject / slug / tags** | Metadados do post no Beehiiv | I |
| **Ledger (beehiiv-status)** | Registro idempotente de publicações | I |
| **Content-hash** | SHA-256 do conteúdo+metadados, âncora de idempotência | I |
| **Mock / dry-run / live** | Modos do publisher/subscribe sem/como API | I |

### 3.5 Vocabulário de marca/UI

| Termo | Significado |
|---|---|
| **Ponto** | Mascote vira-lata caramelo cético (companheiro, **não** selo) |
| **TL Score** | (também é o "selo" da marca — o veredito é o selo, o mascote não) |
| **ContaBlock / TLBadge / SectionLabel** | Componentes canônicos de UI |
| **CompareBanner / Sparkline / PontoReadingScene / LedgerTexture** | TL Graphics (data-art) |
| **Paper / Ink / Surface / Line** | Tokens de fundo/texto/card/borda |
| **Conta feita** | (marca) a "assinatura" visual: Ink fixo, resultado verde |

### 3.6 Conflitos, ambiguidades e sinônimos (marcados)

**Sinônimos (mesma coisa, grafias/keys diferentes):**
- `signal` ↔ `sinal_do_dia`; `deals` ↔ `deal_desk`; `conta` ↔ `conta_feita`; `verdict` ↔ `veredito`; `tlScore` ↔ (sem equivalente no modelo 19 seções); `fechaLogo` ↔ `fecha_logo`; `vigencia` ↔ `vigencia_iso`; `number` ↔ `meta.numero`.

**Conflitos (mesmo conceito, definições incompatíveis):**
- **C-1 · Nome da marca:** *"The Loyal"* (layout, shell, EdicaoMock, DailyEdition) vs. *"The Loyalty"* (arquivo de edição, EditionArticle, todo o Pro, CLAUDE.md). A divisão coincide com a fronteira dos dois modelos.
- **C-2 · Taxonomia de veredito:** flat = `{vale-agir, vale-olhar, casos-especificos, esperaria, evitaria, nao-confirmado}` (6); 19-seções = `{vale-agir, vale-olhar, depende, esperaria, nao-vale, evitaria, nao-confirmado}` (7, com `depende`/`nao-vale`, sem `casos-especificos`); landing (prosa) descreve **quatro** ("Vale agir, Vale olhar, Esperaria, Evitaria"). Três vocabulários.
- **C-3 · Cor de `vale-olhar`:** azul (CLAUDE.md 70–84 → blue-600; `lib.mjs` blue100/blue700) vs. verde (`renderer/tokens.mjs` family "green").
- **C-4 · Faixas do TL Score:** existem só no modelo flat (`min/max` em `VERDICTS`); o modelo 19-seções não tem faixas numéricas — veredito é puramente categórico.
- **C-5 · Critérios do TL Score:** a prosa da landing lista *"valor, clareza, vigência, fricção, aplicabilidade, liquidez, risco e fontes"*; o schema/fórmula usa *"valor, regra, vigencia, friccao, aplicabilidade, liquidez, estoque, fontes"*. `clareza`≠`regra`, `risco`≠`estoque`. Dentro da própria landing, a prosa e a fórmula divergem.
- **C-6 · `signal` sobrecarregado:** no Daily = tese editorial (string); no Pro (`Player.signal`) = enum de direção de mercado (`abertura`/`aperto`/`estável`). Mesma palavra, domínios distintos.
- **C-7 · Numeração de edição:** editions reais são Nº 27 e 28; o exemplo do renderer é "Nº 41"; artefatos públicos falam "No 41". Namespaces de número não reconciliados.
- **C-8 · Duas `edition.schema.json`:** `content/` (draft 2020-12, modelo flat) e `renderer/` (draft-07, modelo 19 seções). Mesmo nome de arquivo, contratos diferentes.

**Ambiguidades (termo com fronteira imprecisa):**
- **A-1 · "Edição":** é o JSON? o e-mail? a página web? o post no Beehiiv? (ver Cap. 7.2). Um conceito, cinco encarnações.
- **A-2 · "Analytics":** análise editorial de mercado (Pro) vs. métricas de leitura (aberturas/cliques). O briefing usa ambos.
- **A-3 · "Publisher":** o script `beehiiv-publish.mjs`? o passo `publish` (que só escreve índices, não envia)? o humano que aprova o envio? Três referentes.
- **A-4 · "Render":** `npm run render` (flat, não existe wired) vs. `npm run daily:render` (19 seções, wired) vs. `next build` (web SSG). 
- **A-5 · "Ponto":** mascote **e** unidade (pontos/milhas). Contexto desambigua, mas o termo colide.

**Termos perigosos (uso descuidado quebra regra inviolável ou marca):**
- **CMI / dado interno / "nossa base"** — proibidos como fonte; QA bane (`INTERNAL_RE`).
- **"imperdível", "corra", "garanta já", "última chance", "milhas grátis"** — urgência artificial banida.
- **Emoji / avião (U+2708) / stock photo** — banidos.
- **Amarelo `#F2C94C` como texto** — proibido (só fill).
- **"green-500 como texto sobre Paper"** — proibido (texto verde = green-600).
- **Promessa de ganho** ("aproveite", "bônus alto = valor") — proibido; o mascote nunca fala em 1ª pessoa com promessa.
- **"illustrative"** — marcador perigoso por omissão: **todas** as edições atuais são exemplos; publicar uma sem revisar o flag envia conteúdo fictício como real.

### 3.7 Produtos vs. canais (desambiguação pedida)

| Item | Produto? | Canal? | Formato? | Nota |
|---|---|---|---|---|
| **Daily** | ✅ produto | — | — | Implementado (2 modelos) |
| **Weekly** | ✅ produto | — | — | **Prometido, ausente** |
| **Lab** | ✅ produto | — | — | **Prometido, ausente** |
| **Pro** | ✅ produto | — | — | Implementado |
| **Special** | ? | — | — | Citado no briefing; **sem vestígio no repo** |
| **Newsletter (e-mail)** | — | ✅ canal | HTML email-safe | Via Beehiiv |
| **Website** | — | ✅ canal | Página web SSG | `/edicao`, `/pro`, `/daily/preview` |
| **Landing** | — | ✅ canal (aquisição) | Página `/` | Superfície de conversão |
| **RSS** | — | ✅ canal | XML | **Citado, ausente** |
| **PDF** | — | ✅ canal | PDF | Só no Pro (`out/pro-pdf/*`) |
| **LinkedIn** | — | ✅ canal | Post social | **Citado, ausente** |

> **Leitura:** Daily/Weekly/Lab/Pro/Special são **produtos** (linhas editoriais). Newsletter, Website, Landing, RSS, PDF, LinkedIn são **canais/formatos** de entrega de um produto. O briefing mistura os dois níveis de propósito — a distinção é registrada aqui como fato de domínio, não decidida.

---

## Capítulo 4 — Fluxos (Mapa do Conhecimento)

> "Desenhe conhecimento, não software." Cada seta é uma transformação de conhecimento, não uma chamada de função.

### 4.1 Fluxo editorial principal (conhecimento entrando → saindo)

```
[Mercado] sinais ruidosos (banner, post, comunicado)
   │  (conhecimento bruto, não confiável)
   ▼
PESQUISA (Research Editor / Cowork)  ── descobre candidatos por editoria
   │  classifica fonte (nível 1–5); descarta 5; nível 3–4 vira radar
   ▼
VALIDAÇÃO DE VIGÊNCIA  ── confirma janela na fonte oficial
   │  sem vigência ⇒ o item nasce "Não confirmado" (overrule)
   ▼
CÁLCULO  ── CPM, CPM final, VPM, preço implícito, spread, custo de elegibilidade
   │  conversão não confirmada ⇒ NÃO calcular CPM final
   ▼
CURADORIA / JULGAMENTO  ── TL Score (8 critérios) → veredito por faixa
   │  separa "quem já é elegível" de "quem paga para ser"
   ▼
EDIÇÃO (autoria do JSON)  ── monta sinal, deals, fecha logo, fontes, disclaimer
   │  ENTREGA DO COWORK TERMINA AQUI (só JSON validado)
   ▼
QA / AUDITORIA  ── validador mecânico + tl-source-audit (julgamento)
   │  Grupo 1 (problemas) ⇒ REPROVADO
   ▼
RENDERIZAÇÃO  ── e-mail + plain text + página web (mesmo JSON)
   ▼
REVISÃO HUMANA + PR  ── aprovação
   ▼
PUBLICAÇÃO (Beehiiv)  ── rascunho por padrão; envio manual
   ▼
[Leitor] recebe (e-mail / web)
   ▼
ANALYTICS (aberturas, cliques)  ── PREVISTO, inexistente no repo
```

### 4.2 O que cada etapa **acrescenta** ou **remove** de conhecimento

| Etapa | Conhecimento que entra | O que a etapa faz | Conhecimento que sai |
|---|---|---|---|
| Pesquisa | Sinal bruto do mercado | Filtra ruído, atribui nível de fonte | Candidato com fonte classificada |
| Validação | Candidato | Confirma vigência na fonte oficial | Candidato com vigência (ou "Não confirmado") |
| Cálculo | Candidato + preços | Aplica fórmulas públicas | Métricas auditáveis (CPM/VPM/spread) |
| Curadoria | Métricas + contexto | Pondera 8 critérios | TL Score + veredito |
| Edição | Tudo acima | Redação própria (anti-cópia) | Edição JSON |
| QA | Edição JSON | Verifica invariantes/regras | Edição aprovada ou reprovada |
| Render | Edição aprovada | Formata sem reescrever | E-mail/plain/web |
| Publicação | Artefatos renderizados | Empacota post + idempotência | Post no Beehiiv |
| Analytics | Comportamento do leitor | (previsto) | Métricas de engajamento |

### 4.3 Fluxo Pro (paralelo, mensal)

```
[Vereditos e métricas do período]  ── agrega N oportunidades avaliadas
   ▼
SÍNTESE EXECUTIVA  ── TL Score médio + distribuição; benchmarks low/normal/high
   ▼
LEITURA DE MERCADO  ── players (abertura/aperto/estável), matriz x/y, implicações, alertas
   ▼
QA Pro (scripts/pro.mjs)  ── 10 seções, sem CMI, tom executivo
   ▼
RENDER Pro  ── web (/pro), e-mail (out/pro-email), PDF (out/pro-pdf)
```

### 4.4 Fluxo de aquisição (leitor)

```
[Visitante] → Landing (/) → Formulário (email + honeypot)
   │  validação (regex, honeypot, rate limit por IP)
   ▼
POST /api/subscribe → Beehiiv (utm_source=landing) ou MOCK (sem creds)
   ▼
[Assinante no Beehiiv]
```
> **Achado:** o formulário React (`SubscribeForm.tsx`) **não** chama `/api/subscribe`; usa um mock `setTimeout` com TODO. A rota real existe, mas a UI não a exerce. Fluxo documentado ≠ fluxo executado.

### 4.5 Dois pipelines paralelos (a bifurcação do conhecimento)

O **mesmo** produto ("Daily") tem dois fluxos de render/QA que **não se encontram**:

```
FLAT (documentado):   content/editions/NNNN.json
                        → scripts/validate.mjs → scripts/render.mjs → scripts/publish.mjs
                        → scripts/beehiiv-publish.mjs → Beehiiv
                        → web: components/EditionArticle.tsx (/edicao/NNNN)
                        [NENHUM desses tem npm script wired, exceto via `node`]

19-SEÇÕES (wired):    renderer/examples/edition.example.json
                        → scripts/validate-daily.mjs (npm run daily:validate)
                        → scripts/render-daily.mjs   (npm run daily:render)
                        → scripts/qa-daily.mjs       (npm run daily:qa)
                        → web: components/daily/DailyEdition.tsx (/daily/preview)
                        [único pipeline com npm scripts em package.json]
```

> **Inversão registrada:** o pipeline **documentado** (validate/render/publish/edition/beehiiv, citado 29× nas docs) **não está wired** no `package.json`. O pipeline **wired** (`daily:*`) usa o **outro** modelo e **não** é o descrito nas skills/CLAUDE. Documentação e execução apontam para modelos diferentes.

---

## Capítulo 5 — Atores

| Ator | Tipo | Papel no domínio | Fronteira / limite |
|---|---|---|---|
| **Leitor (consumidor)** | Humano externo | Recebe e decide com base no veredito | Não persistido localmente; vive no Beehiiv |
| **Leitor (profissional)** | Humano externo | Consome Pro; lê mercado | Público-alvo, ainda "beta fechado" |
| **Research Editor ("Ele" / Cowork)** | Claude (agente) | Pesquisa, valida, calcula, classifica, **entrega só JSON** | **Nunca** publica, envia e-mail ou copia fonte |
| **Editor** | Humano/Claude | Autoria do JSON; voz editorial | Sujeito às regras invioláveis |
| **Auditor (tl-source-audit)** | Claude (skill) | Julgamento editorial (fonte, cálculo, anti-cópia) | Emite parecer; Grupo 1 ⇒ REPROVADO |
| **QA gate (tl-qa / validadores)** | Sistema | Verificação mecânica de invariantes | Bloqueia merge/publicação |
| **Revisor humano** | Humano | Aprova PR e autoriza envio | Único que pode "publicar de verdade" |
| **Publisher** | Sistema (`beehiiv-publish.mjs`) | Empacota e (opcionalmente) envia ao Beehiiv | Rascunho por padrão; idempotente |
| **Beehiiv** | SaaS externo | Distribuição de e-mail, lista, subscribe | Fora do controle do domínio |
| **Renderer** | Sistema | Formata edição em e-mail/plain/web | Não reescreve conteúdo |
| **Website / Next.js (SSG)** | Sistema | Publica páginas `/edicao`, `/pro`, landing | Canal web |
| **Ponto (mascote)** | Persona de marca | Companheiro do leitor, 3ª pessoa, humor seco | **Nunca** em bloco analítico nem com promessa |
| **Vercel / infra** | Sistema externo | Hospedagem, preview | Modo mock protege preview sem creds |

> **Observações:**
> - O **leitor não tem entidade local** — é conhecimento que sai do domínio e vive num sistema genérico externo. Isso limita analytics e personalização por design atual.
> - O **Research Editor é um ator central mas sem código** — existe como contrato (COWORK) e skill, não como automação. A "automação diária" é uma rotina descrita, não orquestrada.
> - **Publisher, Editor e Auditor podem ser o mesmo agente Claude em momentos diferentes** — os papéis são lógicos, não pessoas distintas.

---

## Capítulo 6 — Eventos (do domínio, observados/implícitos)

> Marcados: **[C]** concreto (há vestígio no código/ledger) · **[I]** implícito (o domínio pressupõe, mas não há registro) · **[P]** previsto (citado, inexistente).

**Ciclo da edição:**
- `EdicaoRascunhada` [I] — JSON criado (`content/editions/NNNN.json`)
- `EdicaoValidada` [C] — `out/qa/NNNN.md` gerado, 0 erros
- `EdicaoReprovada` [C] — validador retorna erros (exit 1)
- `AuditoriaEmitida` [I] — parecer da skill (Problemas/Riscos/Correções)
- `EdicaoRenderizada` [C] — `out/email/NNNN.html`, `out/plain/NNNN.txt`
- `IndicesAtualizados` [C] — `content/latest.json` + `content/index.json` (evento de `publish`, **não** é envio)
- `EdicaoMarcadaIlustrativa` [C] — flag `illustrative: true`

**Distribuição:**
- `RascunhoGerado` [C] — publisher em modo draft/mock (`beehiiv-status.json`, action=draft)
- `EnvioAgendado` [C] — `--schedule` → status `scheduled`
- `EdicaoPublicada` [C] — `--publish` (live) → status `published`, `postId`/`web_url`
- `DispatchBloqueado` [C] — mesmo content-hash + já publicado, sem `--force`
- `PublicacaoFalhou` [C] — erro da API → status `error`

**Aquisição / leitor:**
- `AssinaturaSolicitada` [C] — `POST /api/subscribe`
- `AssinaturaConfirmada` [I] — sucesso Beehiiv (ou mock)
- `AssinaturaRejeitada` [C] — honeypot/regex/rate-limit
- `NewsletterEnviada` [P] — evento do Beehiiv, fora do repo
- `LeitorAbriu` / `LeitorClicou` [P] — analytics previstos, inexistentes
- `LeitorCancelou` [P] — unsubscribe (link obrigatório no footer)

**Pro:**
- `RelatorioPeriodoValidado` [C] — `out/qa/pro-YYYY-MM.md`
- `RelatorioPeriodoRenderizado` [C] — `out/pro-email/*`, `out/pro-pdf/*`

**Eventos do briefing, mapeados:**
- Edition Created → `EdicaoRascunhada` [I]
- Edition Updated → **sem evento explícito**; editar o JSON não versiona nem registra [lacuna]
- Draft Generated → `RascunhoGerado` [C]
- QA Approved → `EdicaoValidada` [C]
- Draft Published → `EdicaoPublicada` [C]
- Edition Archived → **inexistente** — não há conceito de arquivamento/retirada [lacuna]
- Newsletter Sent → `NewsletterEnviada` [P]
- Reader Clicked → `LeitorClicou` [P]

> **Achado:** o domínio tem eventos **de produção** bem definidos (validar/render/publicar) e eventos **de consumo** quase ausentes (tudo que acontece depois do envio é externo/previsto). Há um "buraco de observabilidade" após a entrega.

---

## Capítulo 7 — Objetos (descoberta, sem modelagem)

> Apenas descobrir a existência e as facetas de cada objeto. Não modelar.

### 7.1 Objetos de domínio (permanentes)

- **Edition (Edição)** — unidade editorial numerada. **Facetas:** JSON (fonte), e-mail, plain, página web, post Beehiiv, entrada de índice. Ver 7.2.
- **Deal (Oportunidade)** — item do Deal Desk. Facetas: categoria, título, contexto, conta, veredito, fonte, vigência, TL Score, breakdown.
- **Signal (Sinal do dia)** — tese editorial. (Colide com `Player.signal` do Pro.)
- **Conta (Conta feita)** — cálculo aberto. Duas formas (`rows/result` vs `linhas/total/nota`).
- **Verdict (Veredito)** — classificação. Três taxonomias.
- **TL Score** — nota + breakdown de 8 critérios.
- **Source (Fonte)** — label + URL + nível.
- **Vigência** — janela ISO.
- **FechaLogo** — item que vence ≤72h.
- **Disclaimer** — frase oficial.
- **ProReport** — relatório executivo do período (benchmarks, players, matrix, alerts, watch).
- **Benchmark / Player / MatrixRow / Alert** — sub-objetos do Pro.
- **Reader (Leitor/Assinante)** — **objeto sem representação local** (vive no Beehiiv).
- **Product (Produto)** — Daily/Weekly/Lab/Pro/Special (taxonomia `kind` em `sections.tsx`).
- **Ponto (Mascote)** — persona de marca com poses/estados.

### 7.2 A questão central: **o que é uma "Edição"?**

Investigação profunda (pedida no Discovery Phase 1):

- **O que define uma edição?** Um `number` único, uma `date`, um produto (`productType`), e um corpo editorial (sinal + deals + fecha logo + fontes + disclaimer).
- **Quando nasce?** Quando o JSON é escrito/validado. Não há evento formal de criação — nasce por existência de arquivo.
- **É imutável?** **Ambíguo.** Editar `content/editions/NNNN.json` à mão é possível e não registrado. Mas o publisher trata o conteúdo como **imutável na distribuição** (idempotência por content-hash; nunca reescreve). Então: **mutável na autoria, imutável na publicação.**
- **Pode ser reaberta / corrigida / reprocessada?** Reprocessar render/QA sim (basta rodar de novo). Corrigir após publicar muda o content-hash → o publisher permitiria novo dispatch só com `--force`. Não há semântica de "errata" ou "versão 2".
- **Existe versionamento?** **Não.** Nem no JSON, nem no ledger (o ledger tem `history[]` de *ações de publicação*, não de *versões de conteúdo*). Git é o único versionamento, implícito.
- **Existe identidade própria?** Sim, o `number` (mas com namespaces divergentes: 27/28 vs 41 — C-7).
- **Relacionamento entre edições?** Só ordem temporal (`latest.json`, índice ordenado por número). Não há "edição corrige a Nº X", nem sequência semântica, nem thread.
- **Quando deixa de existir?** **Nunca formalmente** — não há arquivamento, expiração ou retirada. Uma oferta vencida continua na edição publicada; a *vigência* expira, a *edição* não.

> **Conclusão de descoberta (não decisão):** "Edição" é um conceito com **cinco encarnações** (JSON, e-mail, plain, web, post) e **uma identidade frágil** (número com namespaces divergentes, sem versionamento, sem ciclo de vida de fim). É o objeto mais central e o menos formalizado.

### 7.3 Objetos de implementação (acidentais ao domínio)

- **content-hash, ledger (`beehiiv-status.json`), request.json, preview.html** — mecânica de idempotência/distribuição.
- **Tokens (`TOKENS`), APPROVED_HEX, VERDICT_FAMILY, SAFE_FONTS/WEBFONTS, URGENCY_RE/EMOJI_RE** — mecânica de QA/marca.
- **generateStaticParams, route handlers, honeypot, rate-limit map** — mecânica web.
- **`out/*`, `public/daily/*`** — artefatos gerados (não editar à mão).
- **slug/tags/subject/preheader/scheduledAt** — metadados do canal Beehiiv (pertencem ao canal, não ao core editorial).

### 7.4 Conhecimento: taxonomia pedida (entra / sai / nunca deveria / transitório / permanente / histórico / derivado / editorial / técnico)

| Classe | Exemplos |
|---|---|
| **Entra** | Sinais de mercado, regulamentos, preços, vigências |
| **Sai** | Vereditos, contas, TL Scores, e-mails, relatórios |
| **Nunca deveria existir** | CMI/dado interno, métrica proprietária, texto copiado, promessa de ganho |
| **Transitório** | Vigência, "fecha logo", rascunho, radar não confirmado, modo mock/preview |
| **Permanente** | Fórmulas, taxonomia de veredito, disclaimer, regras invioláveis, tokens de marca |
| **Histórico** | Edições passadas, `index.json`, `history[]` do ledger, Pro por período |
| **Derivado** | TL Score (de 8 critérios), veredito (de faixa), CPM/VPM/spread (de fórmulas), distribuição Pro (de vereditos) |
| **Editorial** | Sinal, contexto, título, leitura por perfil, tese Pro |
| **Técnico** | Slug, hash, tokens, rota, schema, modo de execução |

---

## Capítulo 8 — Decisões

### 8.1 Decisões já tomadas (explícitas)

- **D1.** Stack fixa: Next.js 14 App Router · TS strict · Tailwind · **zero dependências** extras.
- **D2.** Fonte editorial única = **um JSON por edição** alimenta e-mail, plain e web.
- **D3.** **Regras invioláveis** têm precedência sobre qualquer pedido (sem CMI, sem cópia, sem promessa, sem urgência, sem emoji).
- **D4.** **Overrule de vigência:** sem vigência confirmada ⇒ veredito `nao-confirmado` (no modelo flat, como erro).
- **D5.** **Faixas do TL Score** ancoram o veredito (85–100 … 0–39) — no modelo flat.
- **D6.** **Publicação = passo humano manual** via Beehiiv; scripts criam **rascunho por padrão**.
- **D7.** **Idempotência por content-hash** no publisher; `--force` para re-disparar conscientemente.
- **D8.** **Modo mock** sem credenciais (subscribe e publisher) para dev/preview.
- **D9.** **Cowork = só produz JSON validado**; não renderiza, não abre PR, não envia.
- **D10.** **Ponto fora de blocos analíticos**; credibilidade vence simpatia.
- **D11.** **Sem hex em componente** (exceto mascote/graphics); só tokens da marca.
- **D12.** **E-mail self-contained** (inline CSS, sem webfont, sem `<img>`, 600px).
- **D13.** **Hierarquia de fontes 1–5**; nível 5 não usar; 3–4 vira radar.

### 8.2 Decisões implícitas (tomadas por omissão, nunca declaradas)

- **DI1.** "Edição" é **mutável na autoria** (editar o JSON é permitido e não rastreado).
- **DI2.** **Sem versionamento de conteúdo**; git é o único histórico.
- **DI3.** **Sem ciclo de vida de fim** (edição nunca é arquivada/retirada).
- **DI4.** **Leitor não é entidade do domínio local** (delegado ao Beehiiv).
- **DI5.** O pipeline **wired** (`daily:*`) é o de 19 seções; o pipeline **documentado** (flat) roda só via `node`. Ninguém decidiu isso — resultou de duas construções paralelas.
- **DI6.** A marca aceita **dois nomes** ("The Loyal"/"The Loyalty") na prática.
- **DI7.** **Analytics de leitura fica fora do domínio** (nenhuma captura prevista em código).
- **DI8.** O **número da edição** é atribuído manualmente (sem gerador/sequência única).
- **DI9.** Weekly, Lab, Special existem como **promessa de landing** sem contrato de dados.

### 8.3 Decisões conflitantes (duas decisões incompatíveis coexistindo)

- **DC1.** Dois modelos de edição para o mesmo produto (flat vs 19 seções) — C-8.
- **DC2.** Duas taxonomias de veredito (6 vs 7 valores) — C-2.
- **DC3.** `vale-olhar` é azul **e** verde — C-3.
- **DC4.** Vigência é **erro bloqueante** (flat) **e** **aviso** (19 seções). Mesma regra inviolável, severidades opostas.
- **DC5.** Disclaimer verificado de **quatro** formas (substring / igualdade exata / semântica / comprimento).
- **DC6.** Critérios do TL Score nomeados de duas formas na própria landing (clareza/risco vs regra/estoque) — C-5.
- **DC7.** Kernel de tokens **triplicado** (lib.mjs / tokens.mjs / tailwind.config) — 2.6.
- **DC8.** Comandos `npm run` documentados **não existem** no `package.json` — 4.5.

### 8.4 Decisões perigosas (risco alto se não observadas)

- **DP1.** **Todas as edições atuais são `illustrative`.** Sem um gate que impeça enviar exemplo como real, um `npm run beehiiv --publish` numa edição de exemplo publica conteúdo fictício com números inventados — quebrando a regra-mãe de credibilidade.
- **DP2.** **Divergência de veredito entre pipelines** pode fazer o mesmo conteúdo receber classificações/cores diferentes conforme o renderer — risco direto à confiança.
- **DP3.** **Vigência como aviso** (19 seções) permite publicar oportunidade sem janela confirmada — viola o overrule 5.4 dependendo do pipeline usado.
- **DP4.** **Form de assinatura mock** dá falso positivo de sucesso ao visitante sem inscrevê-lo de fato.
- **DP5.** **Documentos-fonte-de-verdade ausentes** (Apêndice C): as regras citam seções (§4.1, §5.2, §5.4…) de documentos que não estão no repo — a "verdade" é inauditável.
- **DP6.** **`--force` no publisher** contorna a trava anti-duplicação (não pula QA, mas pula a proteção de idempotência).

---

## Capítulo 9 — Riscos

### 9.1 Editorial
- Divergência de taxonomia/cor de veredito entre superfícies (DC2, DC3) corrói a autoridade do veredito.
- Vigência tratada como aviso (DP3) pode publicar recomendação sem confirmação — o oposto da promessa.
- Anti-cópia depende de julgamento humano/LLM (skill), não é mecanicamente garantido — risco residual permanente.
- "Não confirmado" é a rede de segurança; se o overrule falha por pipeline, a rede tem furo.

### 9.2 Tecnológico
- Dois pipelines paralelos (DC1) dobram a superfície de manutenção e garantem divergência ao longo do tempo.
- Kernel triplicado (DC7): mudar um token exige três edições sincronizadas manualmente.
- Comandos documentados não wired (DC8): quem seguir a doc executa comandos inexistentes.
- Dois JSON Schema (draft 2020-12 vs draft-07) para "a mesma" edição.
- Zero testes automatizados de conteúdo além dos validadores; nenhum teste de unidade das fórmulas.

### 9.3 Operacional
- Rotina diária (COWORK) é **documento, não automação** — depende de execução manual/agente disciplinado.
- Publicação manual + `--force` disponível: risco humano de enviar rascunho/exemplo (DP1).
- Sem gerador de número de edição: colisão/gap de numeração possível (C-7).
- Observabilidade pós-envio nula (Cap. 6): não se sabe o que aconteceu depois do Beehiiv.

### 9.4 Produto
- Weekly, Lab, Special prometidos na landing e ausentes: **dívida de promessa** ao assinante.
- Pro está "beta fechado" mas já tem pipeline completo — descompasso entre maturidade técnica e disponibilidade declarada.
- `/edicao` e `/pro` existem como rotas mas **não são linkadas** no nav da landing — produto entregue e inacessível pela navegação.

### 9.5 Marca
- Dois nomes ("The Loyal"/"The Loyalty") — inconsistência de identidade na própria home.
- Achado conhecido de contraste (`gray400` sobre Paper ~3.44:1) abaixo de AA em rótulos — gate de acessibilidade marcado como aviso, não bloqueio.
- Risco de emoji/urgência é mitigado por QA, mas cada pipeline tem regex/severidade diferente.

### 9.6 Escalabilidade
- Modelo "arquivo por edição" + índice reescrito inteiro: simples hoje (2 edições), custo cresce com volume.
- Leitor fora do domínio: personalização/segmentação exigem sempre ida ao Beehiiv.
- Adicionar um produto novo (Weekly/Lab) hoje significaria **um terceiro modelo** se seguir o padrão atual — a divergência escala com o catálogo.
- Sem separação clara produto↔canal (3.7), cada novo canal (RSS, LinkedIn) tende a virar código ad-hoc.

---

## Capítulo 10 — Perguntas Abertas

> Nada é resolvido. Cada pergunta é uma decisão adiada.

**Sobre a Edição:**
1. Uma edição é imutável após publicada? Existe errata/versão 2 ou só nova edição?
2. Qual é o namespace único de numeração (por produto? global?) e quem o gera?
3. Quando uma edição "deixa de existir"? Há arquivamento/expiração?
4. Edição e post-Beehiiv são a mesma entidade ou entidades relacionadas?

**Sobre os modelos:**
5. Qual dos dois modelos de Daily (flat / 19 seções) é o canônico? Coexistem por quê?
6. Qual taxonomia de veredito é oficial (6 ou 7 valores)? `depende`/`nao-vale`/`casos-especificos` — quais existem?
7. `vale-olhar` é azul ou verde?
8. Vigência ausente é erro ou aviso — a regra inviolável admite grau?
9. Os 8 critérios do TL Score chamam-se clareza/risco ou regra/estoque?

**Sobre produto e canal:**
10. Weekly, Lab e Special são produtos reais do roadmap? Com que contrato?
11. "Analytics" significa análise de mercado (Pro) ou métricas de leitura — ou os dois domínios?
12. Qual a fronteira entre produto e canal para o negócio (a landing mistura)?
13. `/edicao` e `/pro` devem ser públicos/navegáveis? Por que não linkados?

**Sobre atores e conhecimento:**
14. O leitor deve ser entidade do domínio (para segmentação/leitura por perfil) ou permanecer no Beehiiv?
15. A rotina diária do Cowork deve virar automação orquestrada ou permanece manual?
16. Onde vive a "verdade" (Operating Manual, DESIGN.md, LLM-SYSTEM.md) que o código cita mas o repo não contém?

**Sobre distribuição:**
17. Qual o critério que impede publicar uma edição `illustrative`?
18. Qual a política de `--force` e quem pode usá-la?
19. LinkedIn/RSS/PDF são canais suportados ou aspiração?

**Sobre marca:**
20. O nome é "The Loyal" ou "The Loyalty"?
21. O achado de contraste (gray400) é aviso aceitável ou bloqueio?

---

## Apêndice A — Mapa Editorial

```
PRODUTOS (linhas editoriais)
├─ Daily      SEG–SEX 8h · 5 min · Sinal+DealDesk+ContaFeita+FechaLogo · [implementado, 2 modelos]
├─ Weekly     fim de semana · tese+ranking+estratégia por perfil        · [prometido, ausente]
├─ Lab        2–4/mês · evergreen (mecânicas)                            · [prometido, ausente]
├─ Pro        período (mensal) · benchmark+players+matriz+alertas · B2B  · [implementado, beta]
└─ Special    ?                                                          · [citado, sem vestígio]

ESTRUTURA DE UMA EDIÇÃO DAILY (o que o leitor lê)
Abertura → Sinal do dia → Deal Desk (≤3: categoria/título/contexto/CONTA/veredito/TL Score/fonte)
        → Fecha logo (≤72h) → [19 seções: program/bank/retail watch, lab, sinais rápidos, sua leitura]
        → Fontes & metodologia → Disclaimer → Footer (unsubscribe)

VOZ: analítico, independente, cético, premium editorial (Sage). Mascote Ponto: 3ª pessoa, humor seco, fora do analítico.
LINHA VERMELHA: sem CMI, sem cópia, sem promessa, sem urgência, sem emoji; "faltou dado → Não confirmado".
```

## Apêndice B — Mapa Técnico

```
app/                 Next.js App Router (landing /, /edicao, /edicao/[numero], /pro, /pro/[periodo], /daily/preview, api/subscribe)
components/           ui, shell, sections, EdicaoMock, EditionArticle (flat), daily/DailyEdition (19 seções), ProReport, PontoMascot, graphics
lib/                 editions.ts (flat loader), pro.ts (Pro loader)
content/             edition.schema.json (flat, 2020-12), editions/*.json, pro-report.schema.json, pro/*.json, index/latest/beehiiv-status
renderer/            edition.schema.json (19 seções, draft-07), tokens, validate, email, plaintext, qa, audit, contrast, examples/
scripts/             flat: validate/render/publish/qa/pro/beehiiv-publish/lib · 19-seções: validate-daily/render-daily/qa-daily
out/                 artefatos gerados (email/plain/qa/beehiiv/pro-*)
.claude/skills/      tl-digest-template, tl-qa, tl-source-audit
package.json         wired: dev/build/start/lint + daily:{validate,render,qa}  ·  NÃO wired: validate/render/publish/edition/beehiiv/qa/pro
integrações         Beehiiv (subscribe + publish, server-only, mock sem creds) · Vercel (host)
```

## Apêndice C — Mapa das Fontes de Verdade (documentos-fantasma)

A hierarquia de verdade declarada em `CLAUDE.md` e `README.md` referencia documentos que **não existem no repositório**:

| Documento citado | Papel declarado | Existe no repo? |
|---|---|---|
| `THE-LOYALTY-LLM-SYSTEM.md` | Topo da hierarquia de verdade | ❌ ausente |
| `DESIGN.md` | 2º na hierarquia (citado: "DESIGN.md 1.3") | ❌ ausente |
| `THE-LOYALTY-BRAND-GUIDELINES.md` | Guia de marca | ❌ ausente |
| `PONTO-MASCOTE-GUIA.md` | Guia completo do mascote | ❌ ausente |
| `TL-GRAPHICS.md` | Especificação de data-art | ❌ ausente |
| `Operating Manual v1` | Base de §4.1, §5.2, §5.3, §5.4, §6, §8, §9.4, §11 | ❌ ausente |

**Presentes de fato:** `CLAUDE.md`, `COWORK.md`, `README.md`, `COPY-LANDING.md`, `content/README.md`, `renderer/README.md`, `renderer/QA-SYSTEM.md`, `renderer/QA-CHECKLIST.md`, as 3 skills.

> **Consequência de domínio:** as regras invioláveis e as fórmulas vivem **espalhadas e replicadas** em código, skills e CLAUDE.md, citando um cânone (Operating Manual) que não está versionado. A "fonte de verdade" é, hoje, **implícita e distribuída** — o que explica boa parte das divergências do Cap. 8.

## Apêndice D — Decisões que ainda NÃO podem ser tomadas

> Registradas explicitamente para impedir que a RFC-001 as tome prematuramente. Cada uma exige input do dono do produto/editorial antes de virar arquitetura.

1. **Unificação de modelo de edição** (flat vs 19 seções) — não decidir sem saber qual é canônico e o que Weekly/Lab exigirão.
2. **Taxonomia oficial de veredito** (6 vs 7; cores) — decisão editorial, não técnica.
3. **Severidade da vigência** (erro vs aviso) — decisão de risco editorial.
4. **Ciclo de vida da edição** (imutabilidade, versão, errata, arquivamento) — decisão de produto.
5. **O leitor como entidade** (local vs Beehiiv) — decisão de produto/privacidade.
6. **Automação da rotina de Research** — decisão operacional.
7. **Fronteira produto↔canal** e catálogo real (Weekly/Lab/Special/RSS/LinkedIn) — decisão de roadmap.
8. **Localização do cânone** (materializar Operating Manual/DESIGN/LLM-SYSTEM) — decisão de governança.
9. **Nome oficial da marca** — decisão de identidade.
10. **Política de publicação segura** (bloqueio de `illustrative`, quem usa `--force`) — decisão de compliance.

---

### Estado de saída

Discovery concluído. **Nenhuma** arquitetura, componente, renderer ou JSON foi proposto. O domínio está mapeado, a linguagem ubíqua catalogada, os conflitos sinalizados e as decisões represadas. A RFC-001 só pode começar após as decisões do Apêndice D receberem input humano.

*Fim do DDD-001 v1.0.*
