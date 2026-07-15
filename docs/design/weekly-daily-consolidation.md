# The Loyal — Como a Weekly consolida a Daily

**Versão 1.0 · Status: Draft (decisão de produto) · Design Doc DD-WEEKLY-001**

> Documento de decisão operacional e de produto. Responde: *como a Weekly deve
> usar a Daily sem repetir conteúdo?*
> Herda os contratos do **RFC-001 (EKS)** e a camada de previsão do **RFC-009 /
> ADR-RADAR-003..010**. Não pode contradizê-los.
> Fonte de verdade sobre: a relação Daily → Weekly (consolidação, deduplicação,
> narrativa e estrutura de blocos da Weekly).

| Metadado | Valor |
|---|---|
| Escopo | Relação entre `content/editions/NNNN.json` (Daily) e `content/weekly/AAAA-Wnn.json` (Weekly) |
| Fora de escopo | Cálculo do TL Score, nota de corte de publicação, motor de acurácia (são pré-requisitos, ver §1.3) |
| Depende de | `content/edition.schema.json`, `content/weekly.schema.json`, `content/forecast.schema.json`, `content/entity.schema.json`, `lib/campaign-quality.ts`, `scripts/taxonomy.mjs` |
| Precede | `weekly.schema.json v2`, `render-weekly.mjs v2`, um coletor `weekly-consolidate.mjs` |

---

## 0. Decisão em uma frase

> **A Daily é o diário de bordo do dia (eventos com conta feita). A Weekly não é
> um resumo desses eventos — é a leitura do estado da semana organizada por Fio
> (thread temático ancorado numa entidade/rota canônica). A Daily fala em
> *deals*; a Weekly fala em *o que mudou nesse Fio, onde ele está agora e o que
> vem*. A unidade de repetição da Daily (o deal) nunca é a unidade de exibição da
> Weekly (o Fio).** Isso é o que impede a Weekly de virar uma Daily
> semanalizada — e o que a diferencia do Predict, que fala só do futuro.

O resto do documento sustenta essa decisão com granularidade, trade-offs e
casos-limite.

---

## 1. Contexto real (comportamento, não intenção)

### 1.1 O que a Daily produz hoje

`content/edition.schema.json`. A Daily é uma sequência de **eventos com julgamento
auditável**. Blocos:

- `signal` — o sinal do dia (tese curta).
- `deals[]` — **Deal Desk**. É o átomo do sistema. Cada deal carrega
  `category`, `title`, `context`, `conta` (rows + result), `verdict`, `tlScore`,
  `scoreBreakdown` (8 critérios, soma ponderada 25/15/15/10/10/10/10/5),
  `vigencia` (ISO; ausente ⇒ `verdict` obrigatoriamente `nao-confirmado`),
  `source`/`sourceUrl`.
- `fechaLogo[]` — o que vence em ≤72h.
- `shoppingWatch[]` — VPM observado (R$/milheiro) por player/categoria, com
  `sampleN`; `"n/c"` quando a amostra é insuficiente.
- `radar` — janelas de previsão coladas do forecast (proveniência `forecast`).

### 1.2 O que a Weekly produz hoje

`content/weekly.schema.json`. Hoje a Weekly é **centrada no Radar** e o resto é
digitado à mão:

- `signal` — tese da semana (manual).
- `radar` — **declarado "o centro do weekly"**; se ausente, o render puxa
  `digest.radarWeekly` de `content/forecast.json` (só se fresco — gate C0 em
  `scripts/forecast-freshness.mjs`).
- `movements` — `novas` / `venceram` / `seguem`, três arrays de string
  **digitados à mão**.
- `highlights[]` — `title`/`note`/`verdict?`/`score?`, **digitados à mão**.
- `watch[]` — o que monitorar (manual).

**Fato central:** *não existe nenhum caminho de código que leia
`content/editions/*.json` para produzir a Weekly.* O único feed automático da
Weekly é o Radar (forecast), e o forecast é gerado do **ledger** (Supabase), não
das edições da Daily. `movements` e `highlights` são preenchidos manualmente e
não têm rastreabilidade até o deal que os originou. Esta é a lacuna que o
documento resolve (premissa 5: "a Weekly ainda não consolida a Daily de forma
automática e rastreável").

### 1.3 Premissas herdadas (não reabrir)

Tratadas como dadas: produto pré-operação em partes; TL Score é digitado, não
calculado; não há nota de corte madura; o motor que publica ≠ o que mede
acurácia; a comunicação promete além do que entrega em pontos. **Consequência de
projeto:** toda derivação que este doc propõe é **auditável e conservadora** —
onde falta dado ou cálculo, o sistema classifica **"Não confirmado"** e sugere
para curadoria humana, nunca inventa (regra inviolável 9).

### 1.4 O único padrão de rollup que já existe

O relatório **Pro** (`pro-report.schema.json`) tem `tlScorePeriod.derivedFrom` —
lineage explícito `{ edition, deal, verdict, tlScore }` que torna a média
rastreável até a edição de origem. **A Weekly deve herdar exatamente esse
padrão de proveniência** para todo item consolidado. É o precedente do repo, e
não vamos inventar outro.

---

## 2. Papel de cada superfície (o contrato de superfície)

A pergunta 1 do briefing. Definido por **função cognitiva**, não por cadência.

| Dimensão | **Daily** | **Weekly** | **Predict / Radar** |
|---|---|---|---|
| Pergunta que responde | "O que apareceu **hoje** e quanto vale?" | "O que **mudou** na semana, onde está agora e o que vem?" | "**Quando** a próxima janela deve abrir?" |
| Tempo verbal | Presente (evento) | Pretérito + presente (estado) | Futuro (probabilístico) |
| Átomo | Deal (evento com conta) | **Fio** (thread por entidade/rota) | Janela (série estatística) |
| Origem do dado | Curadoria + ledger do dia | **Consolidação das Dailies da semana** | Recorrência do ledger |
| Natureza | Acionável agora | Orientação e memória | Preparação/expectativa |
| Erro que não pode cometer | Errar a conta | **Repetir a Daily** | Virar veredito/garantia |

### 2.1 O que pertence exclusivamente à Daily (1.1)

- A **conta feita** linha a linha (`conta.rows`) — o ritual de cálculo é diário.
- `fechaLogo` (vence em ≤72h) — urgência real de janela curta é do dia; na
  Weekly ela ou já venceu ou vira "watch".
- O veredito **operacional do dia** ("agir hoje").
- O `shoppingWatch` como leitura pontual (a Weekly só mostra a **variação** dele).

### 2.2 O que pertence exclusivamente à Weekly (1.2)

- **Movimento** entre estados (abriu → segue → encerrou) — só existe com ≥2
  pontos no tempo; a Daily, por definição, tem 1.
- **Continuidade e permanência** ("segue vigente pela 3ª semana").
- **Encerramento** com balanço ("a janela X fechou; valeu para quem é do clube").
- **Ranking do período** — comparação entre Fios que só faz sentido acumulada.
- A **tese de semana** que amarra Fios distintos num movimento de mercado.

### 2.3 O que pode existir nas duas (1.3)

- A **entidade/rota** (Livelo→Smiles) — mas com função diferente: na Daily é o
  cabeçalho de um deal; na Weekly é o **eixo do Fio**.
- A **janela de radar** — na Daily como alerta do dia, na Weekly como ponte para o
  Predict (§9). Nunca com os mesmos números apresentados do mesmo jeito.
- O **veredito** de um item — mas na Weekly ele aparece como **estado final da
  semana** (pode ter mudado de `vale-agir` para `evitaria` porque a vigência
  passou), não como o veredito do dia em que saiu.

### 2.4 O que nunca deve aparecer igual nas duas (1.4)

- A **conta feita completa**. A Weekly cita o **resultado** (`conta.result`, ex.
  "CPM R$ 12/milheiro") como evidência do Fio; **nunca** reimprime `conta.rows`.
  Se o leitor quer a conta, ela está na Daily (link de lineage).
- O **texto do `context`** do deal. A Weekly reescreve em chave de síntese
  ("o que isso significou na semana"), nunca copia (regra inviolável 2).
- A janela de radar com o mesmo `basis` e `window`.

### 2.5 Como evitar que a Weekly repita a Daily (1.5) — a regra estrutural

> **Regra de não-repetição:** a Weekly nunca exibe *deals*; exibe *Fios*. Um Fio
> é a consolidação de 1..N deals da semana sobre a mesma entidade/rota canônica.
> A Weekly responde três perguntas que a Daily **não pode** responder porque só
> vê um dia: **(a) mudou?** **(b) onde está agora?** **(c) o que vem?** Se um bloco
> da Weekly não responde uma dessas três, ele é repetição e deve ser cortado.

Esse é o teste de corte editorial e de código. Tudo abaixo o operacionaliza.

---

## 3. A unidade de síntese (o Fio) — a decisão central

A pergunta 2 do briefing lista candidatos: por evento, por tema, por
oportunidade, por janela temporal, por cluster. Avaliação:

| Unidade candidata | Prós | Contra | Veredito |
|---|---|---|---|
| Por **evento/deal** | trivial de derivar (1 deal = 1 item) | **é literalmente a Daily semanalizada** — repetição garantida | ✗ |
| Por **janela temporal** (dia/faixa) | ordena bem | fragmenta o mesmo fato em vários dias | ✗ (é dedup ao contrário) |
| Por **oportunidade** (a conta/CPM) | preciso | oportunidade muda de número dia a dia; instável como eixo | ✗ como eixo, ✓ como métrica |
| Por **tema** (macro: "bônus para aéreo") | ótimo para a tese | grosso demais para ranking/movimento | ✓ **só para a tese** |
| Por **cluster/entidade-rota** | estável, dedupável, rastreável, comparável | exige identidade canônica | ✓ **unidade primária** |

### 3.1 Decisão: unidade primária = **Fio** (cluster por entidade/rota canônica)

Um **Fio** é indexado pela **chave canônica de identidade** já definida no repo:

- a `key` do `content/entity.schema.json` (registro de entidades: reconcilia
  "Livelo"/"livelo" a um objeto), e
- a **rota** `origem→destino` do ledger, com a **identidade estável independente
  de `vigencia_fim`** proposta em **ADR-RADAR-009** (a mesma campanha lida como
  "lançamento", "prorrogada" e "último dia" é **um** Fio, não três).

Um Fio agrega todos os deals da semana cuja identidade reconcilia para a mesma
chave. O deal deixa de ser manchete e passa a ser **evidência** do Fio.

### 3.2 Eixo secundário: **tema**, só para a tese e o agrupamento macro

O `signal` da Weekly e a ordem dos Fios usam o **tema** (ex.: "transferência
bonificada para aéreo", "compra de origem em desconto") para amarrar Fios num
movimento. Tema **não** é unidade de exibição — é a moldura narrativa (§5).

### 3.3 Como agrupar itens similares (2.3)

1. **Reconciliação de entidade** — cada deal → chave canônica via
   `content/entities` (aliases). Sem entrada no registro ⇒ cria candidato e
   marca para curadoria (não agrupa às cegas).
2. **Reconciliação de rota** — `origem→destino` normalizado (mesma normalização
   do forecast: `lib/forecast.ts` colapsa ondas quase simultâneas).
3. **União** — reutiliza `detectProbableDuplicates()` /`pairScore()` de
   `lib/campaign-quality.ts` (union-find já existente) para juntar deals que são
   o mesmo fato re-anunciado. Um Fio = um componente conexo.

### 3.4 Continuidade vs. novidade (2.4) e itens recorrentes (2.5)

Cada Fio recebe um **estado semanal** derivado do cruzamento com a Weekly
anterior e com as datas do deal:

```
                         apareceu nesta semana?
                        /                        \
                     sim                          não
                      |                             |
             estava na semana passada?      (não é Fio desta semana)
             /                    \
           não                    sim
            |                       |
     ┌──────────────┐       vigência ainda ativa?
     │  NOVO (abriu) │        /            \
     └──────────────┘      sim              não
                            |                 |
                   ┌────────────────┐  ┌──────────────────┐
                   │ SEGUE (permanece)│  │ ENCERROU (venceu) │
                   └────────────────┘  └──────────────────┘
```

- **Recorrente que reaparece** (2.5): mesma chave, mas houve uma semana sem
  aparição ⇒ estado **REABRIU** (subtipo de NOVO com nota "já havia aparecido em
  Wnn"). Evita anunciar como inédito algo que o leitor já viu.
- **Mudança de status** (2.6): o Fio guarda `verdictStart` e `verdictEnd` da
  semana. Se `vale-agir` → `evitaria`/expirado, o estado é **VIROU** e isso vira
  candidato natural a `highlight` ("o que era a melhor conta da segunda fechou na
  sexta").

---

## 4. Regras de deduplicação

A pergunta 4. A dedup da Weekly tem **duas fronteiras**: dedup **de entrada**
(vários deals → um Fio) e dedup **de saída** (um Fio → um único bloco).

### 4.1 Dedup de entrada — as quatro camadas (4.1–4.4)

| Camada | Chave | Mecanismo (reuso) | Resolve |
|---|---|---|---|
| **Temporal** (4.1) | mesma chave em dias diferentes da semana | agrupar por chave; manter **estado terminal** da semana | mesmo fato em vários dias vira 1 Fio (4.6) |
| **Semântica** (4.2) | entidade canônica + rota | `content/entities` aliases + normalização de rota | "Livelo"/"livelo"/"Livelo Pontos" = 1 |
| **Origem** (4.3) | `domainOf(sourceUrl)` + proximidade | `provProximity` / `provenanceProximityDays: 15` de `campaign-quality.ts` | duas fontes do mesmo anúncio não viram dois Fios |
| **Oportunidade** (4.4) | tipo + faixa de bônus + `conta.result` | `pairScore()` union-find | "100% Esfera→Latam" lido 2x = 1 |

### 4.2 A regra de ouro de saída (4.5, 4.6, 4.7)

> **Um Fio aparece na Weekly no máximo uma vez, em exatamente um bloco, no seu
> estado terminal da semana.** Blocos diferentes podem *referenciar* o mesmo Fio,
> mas cada bloco responde uma pergunta diferente sobre ele e **nunca com as
> mesmas palavras**.

Operacionalização da não-duplicação entre formatos (4.5):

- Um Fio que está em `ranking` **não** repete sua linha em `movements.seguem` — em
  `movements` ele aparece só se o **estado** é a informação (abriu/encerrou); se
  ele "segue e é o nº 1 do ranking", o ranking já disse isso.
- Um Fio em `highlights` **não** repete em `ranking` a mesma frase — o highlight
  explica *por que mudou*; o ranking dá *a posição e o número*.
- **Precedência de bloco** (quando um Fio qualificaria para mais de um): 
  `highlights` (mudou muito) > `ranking` (é o melhor valor) > `movements`
  (mudou de estado) > omitido. O Fio cai no bloco de maior precedência a que se
  qualifica e some dos demais.

### 4.3 Mesmo fato em vários dias (4.6) e mudança de status (4.7)

- **Vários dias:** colapsa por chave; o Fio herda a **última** vigência e o
  **último** veredito da semana; a nota registra a trajetória ("apareceu
  seg/qua/sex").
- **Mudança de status:** não é duplicata — é **um** Fio com transição
  `verdictStart→verdictEnd`. A transição é o conteúdo, não o ruído.

---

## 5. Narrativa e leitura

A pergunta 5.

### 5.1 O que a Weekly é (5.1, 5.2)

Entre "contar história", "consolidar tendência" e "preparar ação", a Weekly é
**consolidação de estado que prepara ação** — com uma casca de tese. Não é
narrativa longa (isso é Lab/Special), não é só tendência abstrata (isso é
Predict). É: *aqui está o estado do tabuleiro no fim da semana e o que fazer com
ele.*

### 5.2 Ordem canônica dos blocos (5.3, 5.4, 5.5)

A leitura segue o arco **mudança → posição → futuro**:

```
1. TESE DA SEMANA        (signal)        — o movimento dominante, em uma frase
2. O QUE MUDOU           (movements)     — abriu / segue / encerrou  [MUDANÇA]
3. O QUE PESOU           (highlights)    — 1–3 Fios que mudaram a foto  [MUDANÇA↑]
4. ONDE ESTÁ O VALOR     (ranking)       — os melhores Fios vigentes    [POSIÇÃO]
5. O QUE VEM             (radar + watch) — janelas previstas + monitorar [FUTURO]
6. FONTES · DISCLAIMER
```

- **Começo** (tese + o que mudou): entrega a semana em 30 segundos.
- **Meio** (highlights + ranking): a substância — por que mudou e onde está o
  valor agora.
- **Fim** (radar + watch): vira o leitor para a frente — ponte para o Predict e
  para a Daily da próxima semana.

Mudança, permanência e encerramento (5.5) ficam legíveis porque `movements` os
separa explicitamente (abriu/segue/encerrou) e os `highlights` narram as
transições `VIROU`.

### 5.3 Leitura autônoma (5.6)

A Weekly **não pode depender da Daily para fazer sentido**. Regra: todo Fio
citado traz o mínimo autossuficiente — entidade, o que mudou, o número-âncora
(`conta.result`) e o veredito atual — e um **link de lineage** para a Daily de
origem para quem quiser a conta completa. O leitor que só lê a Weekly entende a
semana; o leitor que quer auditar clica.

---

## 6. Diferença para Predict / Radar

A pergunta 6. É a diferença mais fácil de borrar e a mais importante de manter.

### 6.1 Predict/Radar responde "quando"; Weekly responde "o que mudou e quanto vale agora"

O Radar (`forecast.json`, RFC-009) é **projeção estatística de recorrência**:
`confidence`, `cadence`, `windows[]`, `intervals[]` — olha para frente e nunca é
veredito nem garantia. A Weekly é **retrospectiva + estado**: olha a semana que
passou e o valor vigente.

### 6.2 Recomendação forte: **rebaixar o Radar de "centro" para "ponte"**

O `weekly.schema.json` atual declara o radar "o centro do weekly". **Isto deve
mudar.** Enquanto o Radar for o centro, a Weekly é inevitavelmente um "Radar
grande" (o exato risco de 6.3). Decisão:

> O centro da Weekly é a **semana consolidada do ledger** (o que mudou + onde está
> o valor). O Radar entra **apenas** como o bloco "O que vem", ao lado do `watch`,
> como transição para o Predict. Uma janela, não a moldura.

Isso resolve de uma vez:

- **6.3 (não virar "Radar grande"):** o radar é 1 de 6 blocos, no fim.
- **6.4 (não virar "Daily semanalizada"):** a unidade é o Fio, não o deal (§3).
- **6.5 (contribuição exclusiva):** a Weekly é a **única superfície que mede
  movimento entre estados e ranqueia valor no período** — nem a Daily (vê 1 dia)
  nem o Predict (vê o futuro) fazem isso.

---

## 7. `movements`, `ranking`, `highlights`, `watch`

A pergunta 3. Derivação de cada bloco a partir do dado da Daily, com o que cada
um responde e não repete.

### 7.1 `movements` — o que mudou de estado (3.1)

- **Deriva de:** o estado semanal de cada Fio (§3.4), cruzando presença nesta
  semana × semana anterior × `vigencia`.
- **`novas`** = Fios em estado NOVO/REABRIU. **`seguem`** = SEGUE. **`venceram`**
  = ENCERROU/VIROU-expirado.
- **Responde:** "o que abriu, o que continua, o que fechou."
- **Não repete:** valor/conta (isso é ranking); nem re-descreve o deal — descreve
  a **transição**.
- **Conexão com a Daily:** cada linha aponta (lineage) para a edição onde o
  evento apareceu.
- **Automação:** **derivável** (§8). Hoje é 100% manual.

### 7.2 `highlights` — o que pesou (3.2)

- **Deriva de:** os Fios com **maior mudança** na semana — candidatos rankeados
  por (a) transição de veredito (`VIROU`), (b) maior spread confirmado, (c) maior
  salto de `tlScore` entre aparições.
- **Responde:** "por que a semana foi o que foi" — a narrativa das 1–3 viradas.
- **Não repete:** a posição numérica (isso é ranking); conta o *porquê*.
- **Conexão:** carrega `verdict` + `score` **com lineage** ao deal (herda o padrão
  `derivedFrom` do Pro, §1.4).
- **Automação:** **máquina sugere candidatos, humano escreve a nota** (§8). A
  seleção é auditável; a prosa é editorial.

### 7.3 `ranking` — onde está o valor (3.3) — **bloco novo, a criar**

O `weekly.schema.json` **não tem** `ranking` hoje. Proposta de derivação
**conservadora** (respeita premissas 2/3/9 — TL Score digitado, sem nota de corte
madura):

- **Chave de ordenação (auditável, não um "leaderboard mágico"):** melhor
  **valor confirmado** do Fio na semana — spread/CPM de `conta.result` **dentro da
  vigência** —, desempate por `tlScore` do deal, desempate final por frescor da
  fonte.
- **Gate de elegibilidade:** Fio sem `vigencia` confirmada ou sem `conta.result`
  numérico **não ranqueia** — entra como "Não confirmado" (regra 9). Isso impede
  que rumor (`nao-confirmado`) ocupe o topo.
- **Responde:** "se eu só puder olhar 3 coisas desta semana, quais valem mais?"
- **Não repete:** o motivo da virada (isso é highlight); dá **posição + número +
  veredito atual**.
- **Automação:** **máquina sugere a ordem, humano aprova** — enquanto o TL Score
  for digitado (premissa 2) e não houver nota de corte madura (premissa 3), o
  ranking é **sugerido e revisado**, nunca publicado direto. O doc deixa o gancho
  pronto para quando o score passar a ser calculado.

> **Trade-off explícito:** poderíamos adiar o `ranking` até o TL Score ser
> calculado. Recomendo **incluí-lo já como "sugerido+aprovado"**, porque é a
> contribuição exclusiva da Weekly (§6.5) e o gate de elegibilidade + lineage o
> mantêm honesto mesmo com score digitado.

### 7.4 `watch` — o que vem (3.4)

- **Deriva de:** três fontes — (a) janelas do Radar com `confidence` ≥ baixa
  (Predict); (b) itens `nao-confirmado` da semana ainda sem regulamento (rumores
  em aberto); (c) itens cuja `vigencia` cai na **próxima** semana.
- **Responde:** "o que monitorar e por quê."
- **Não repete:** não reafirma o ranking; aponta o **não-resolvido** e o **futuro**.
- **Conexão:** é a costura Weekly → próxima Daily e Weekly → Predict.
- **Automação:** (a) e (c) **deriváveis**; (b) **sugerida**, humano confirma.

---

## 8. Operação e implementação

A pergunta 8. A régua: **derivar tudo que é rastreável; sugerir o que exige
julgamento; deixar para o humano só a prosa e a aprovação.**

| Bloco | Derivável (pipeline) | Sugerido (máquina→humano) | Editorial (humano) |
|---|---|---|---|
| `signal` (tese) | tema dominante (por contagem/peso de Fios) | rascunho de 1 frase | **redação final** |
| `movements` | **sim, integral** (estado por Fio) | — | revisão |
| `highlights` | seleção de candidatos | ordem dos candidatos | **nota do porquê** |
| `ranking` | ordenação por chave auditável | ordem final | **aprovação** |
| `watch` | (a) radar + (c) expira próxima semana | (b) rumores em aberto | confirmação |
| `radar` | **sim** (já: `digest.radarWeekly`, gate C0) | — | — |
| `sources` | **sim** (união das fontes dos Fios) | — | — |

### 8.1 O contrato de dados: o que a Daily precisa emitir para a Weekly consolidar (8.6)

Esta é a mudança de infraestrutura que destrava a automação. Hoje o `deal` **não
tem identidade estável** para join entre edições. Proposta (aditiva, não quebra
nada):

Adicionar ao `deal` de `edition.schema.json`:

- **`entityKey`** (string) — chave canônica do `content/entities` (reconcilia o
  deal a um Fio). Ausente ⇒ Weekly marca para curadoria.
- **`routeKey`** (string, opcional) — `origem→destino` normalizado, para deals de
  transferência. Alinha com a identidade estável de ADR-RADAR-009 (independente
  de `vigencia_fim`).
- **`firstSeen`** (ISO, opcional) — quando o fato apareceu pela 1ª vez (distingue
  NOVO de SEGUE sem depender de heurística).

Com `entityKey` + `vigencia` + `verdict` + `tlScore` + `conta.result` + número da
edição, a Weekly tem tudo para consolidar de forma **automática e rastreável**
(fecha a premissa 5).

### 8.2 O pipeline proposto

```
content/editions/*.json (semana Wnn)
        │
        ▼
scripts/weekly-consolidate.mjs   ← NOVO
   1. carrega as edições da semana + a Weekly anterior (W-1) + entities
   2. reconcilia cada deal → Fio (entities + routeKey + campaign-quality union-find)
   3. calcula estado semanal por Fio (NOVO/SEGUE/ENCERROU/VIROU/REABRIU)
   4. deriva movements (integral), candidatos de highlights, ordem de ranking, watch (a)(c)
   5. emite content/weekly/AAAA-Wnn.draft.json  (com lineage por item)
        │
        ▼
   CURADORIA HUMANA: escreve tese, notas de highlight, aprova ranking, confirma watch(b)
        │
        ▼
content/weekly/AAAA-Wnn.json  →  scripts/render-weekly.mjs (v2)  →  email/plain/web
```

O `draft.json` é a superfície onde máquina e editorial se encontram — **sugerido
pela máquina, aprovado por humano** (8.3). O motor de consolidação é **separado**
do render (respeita a premissa 4: quem publica ≠ quem mede; o consolidador pode
mais tarde exportar sinais para o motor de acurácia sem acoplar).

### 8.3 O que fica para o editorial (8.5) e o que nunca automatizar

Nunca automatizar: a **tese** (redação), a **nota do highlight** (o porquê), a
**aprovação do ranking**. São julgamento — e enquanto o TL Score for digitado, a
máquina não tem autoridade para publicar ordem de valor sozinha.

---

## 9. Estrutura ideal de blocos

A pergunta 7. Estrutura da Weekly madura.

| Bloco | Classe | Justificativa |
|---|---|---|
| `signal` (tese) | **Fixo** | toda semana tem um movimento dominante |
| `movements` | **Fixo** | é a razão de ser da Weekly (estado entre pontos) |
| `watch` | **Fixo** (já `required`) | vira o leitor para a frente |
| `sources` · `disclaimer` | **Fixo** (gate inviolável) | regra 10 |
| `highlights` | **Variável** | 0–3; só quando houve virada real |
| `ranking` | **Variável** | só com ≥2 Fios elegíveis (senão vira lista de 1) |
| `radar` | **Variável** | só se o forecast estiver fresco (gate C0) — e **rebaixado a "O que vem"** (§6.2) |
| `shoppingDrift` (novo, opcional) | **Opcional** | variação de VPM da semana, se `shoppingWatch` teve amostra suficiente |
| — Radar como **centro/moldura** | **Eliminado** | causa o "Radar grande" (§6.2) |
| — `highlights` livres sem lineage | **Eliminado** | viram repetição não-rastreável da Daily |

### 9.1 Esboço de `weekly.schema.json v2` (aditivo)

```jsonc
{
  // ... campos atuais mantidos: number, period, dateStart/End, signal, watch, sources, disclaimer
  "movements": {
    "novas":    [{ "fio": "livelo->smiles", "text": "…", "lineage": { "edition": 27, "deal": 0 } }],
    "seguem":   [ /* idem */ ],
    "venceram": [ /* idem, com verdictStart/verdictEnd quando VIROU */ ]
  },
  "ranking": [
    { "rank": 1, "fio": "esfera->latampass", "anchor": "CPM R$ 12,00/milheiro",
      "verdict": "vale-agir", "score": 88, "lineage": { "edition": 28, "deal": 0 } }
  ],
  "highlights": [
    { "title": "…", "note": "…", "verdict": "evitaria", "score": 30,
      "transition": { "from": "vale-agir", "to": "evitaria" },
      "lineage": { "edition": 28, "deal": 0 } }
  ],
  "radar": { /* inalterado; agora renderizado sob o rótulo "O que vem" */ }
}
```

`lineage` reusa o formato de `pro-report.derivedFrom` (§1.4). Tudo aditivo:
edições antigas sem `lineage` continuam válidas.

---

## 10. Casos-limite

| Caso | Regra |
|---|---|
| Semana sem nenhuma Daily (feriado/hiato) | Weekly opcional; se sair, só Radar + watch, marcada como semana leve. Nunca inventar movimento. |
| Deal `nao-confirmado` a semana toda | Não entra em ranking nem movements.novas; entra só em `watch(b)` ("rumor em aberto"). |
| Mesmo Fio abre e fecha na mesma semana | Estado `VIROU`/janela curta; vai para `highlights` (a virada é o conteúdo), não para `movements` duas vezes. |
| Dois Fios empatam no ranking | Desempate: `tlScore` → frescor de fonte → ordem alfabética estável. Sem empate publicado. |
| `entityKey` ausente (deal legado) | Fio marcado "a reconciliar"; entra em nenhum bloco automático até curadoria — nunca agrupa às cegas. |
| Forecast stale (gate C0 falha) | Bloco Radar some silenciosamente (comportamento atual de `resolveRadar`); Weekly sai sem "O que vem" de previsão, mantém `watch(b)(c)`. |
| Fio some sem vencer (deixou de ser noticiado) | Não vira `venceram` automático (não temos prova de encerramento); vira `watch` "confirmar status" ou é omitido. Encerramento exige `vigencia` passada. |
| Conflito simpatia × credibilidade | credibilidade vence: corta o item duvidoso (alinha CLAUDE.md / mascote). |

---

## 11. Saída final (os 6 entregáveis pedidos)

### 11.1 Arquitetura de consolidação

```
DAILY (eventos/deals, 1 dia)
   └─ reconciliação de identidade (entities + routeKey + campaign-quality union-find)
        └─ FIO (thread por entidade/rota, N deals da semana)
             └─ estado semanal (NOVO/SEGUE/ENCERROU/VIROU/REABRIU) vs. Weekly W-1
                  ├─ movements   (derivado)      "o que mudou"
                  ├─ highlights  (sugerido+nota) "o que pesou / por quê"
                  ├─ ranking     (sugerido+aprov) "onde está o valor"
                  └─ watch        (derivado+sugerido) "o que vem"
   RADAR/PREDICT (forecast, futuro) ─────────────────────────► bloco "O que vem" (ponte, não centro)
```

### 11.2 Unidade de síntese

**O Fio** — cluster por entidade/rota canônica (não o deal, não a janela, não o
dia). O deal é evidência; o Fio é a unidade de exibição. Tema é a moldura da tese.

### 11.3 Regra de deduplicação

**Entrada:** 4 camadas (temporal, semântica/entidade, origem, oportunidade)
reusando `campaign-quality.ts` + `content/entities`. **Saída:** *um Fio aparece
no máximo uma vez, em um único bloco, no seu estado terminal da semana*; a
precedência de bloco é `highlights > ranking > movements > omitido`; blocos podem
referenciar o mesmo Fio mas nunca com as mesmas palavras.

### 11.4 Narrativa da Weekly

Consolidação de estado que prepara ação, com casca de tese. Arco **mudança →
posição → futuro**. Leitura autônoma obrigatória (número-âncora + veredito atual +
lineage), sem depender da Daily para fazer sentido.

### 11.5 Estrutura ideal de blocos

Fixos: **Tese · Movements · Watch · Fontes/Disclaimer**. Variáveis: **Highlights ·
Ranking · Radar**. Opcional: **Shopping drift**. Eliminado: **Radar como centro** e
**highlights sem lineage**.

### 11.6 Recomendação final — como a Weekly usa a Daily sem repetir

1. **A Weekly nunca exibe deals; exibe Fios.** A unidade de repetição da Daily
   deixa de ser a unidade de exibição da Weekly. (Fecha 6.4.)
2. **Todo item consolidado carrega lineage** até a edição/deal de origem (herda o
   padrão `derivedFrom` do Pro). Consolidação automática **e rastreável**. (Fecha
   premissa 5.)
3. **A conta feita fica na Daily; a Weekly cita só o resultado-âncora** e linka.
   (Fecha 1.5/2.4.)
4. **Rebaixar o Radar de centro para ponte** ("O que vem"). (Fecha 6.3.)
5. **`movements` 100% derivado; `highlights`/`ranking` sugeridos e aprovados;
   tese e notas são editoriais.** (Fecha 8.3–8.5.)
6. **Adicionar `entityKey`/`routeKey`/`firstSeen` ao deal** e criar
   `scripts/weekly-consolidate.mjs` separado do render. (Destrava 8.1/8.6 e
   respeita a premissa 4.)
7. **Onde falta dado ou cálculo, "Não confirmado" e curadoria** — nunca chutar
   ranking ou encerramento. (Regra inviolável 9; premissas 2/3.)

---

## 12. Trade-offs consolidados

| Decisão | Ganho | Custo / risco | Mitigação |
|---|---|---|---|
| Unidade = Fio (não deal) | mata a repetição na raiz | exige identidade canônica | reusa entities + ADR-009 + campaign-quality |
| Radar rebaixado a "ponte" | Weekly deixa de ser "Radar grande" | contradiz o schema atual ("centro") | mudança deliberada, documentada aqui |
| `ranking` já, como sugerido | entrega a contribuição exclusiva | TL Score é digitado (premissa 2) | gate de elegibilidade + aprovação humana + lineage |
| `entityKey` no deal | join automático Daily→Weekly | mudança de schema | aditivo; ausência ⇒ curadoria, não erro |
| Consolidador separado do render | não acopla publicação e medição | mais um script | alinha premissa 4; export futuro p/ acurácia |

---

## 13. Próximos passos (fora do escopo deste doc, mas destravados por ele)

1. `weekly.schema.json v2` (aditivo, §9.1) + `entityKey`/`routeKey`/`firstSeen` no
   `deal`.
2. `scripts/weekly-consolidate.mjs` (§8.2) — motor de consolidação.
3. `render-weekly.mjs v2` — renderizar `ranking`, `lineage` e o rótulo "O que vem".
4. Ligação futura ao motor de acurácia (premissa 4): o consolidador exporta
   `verdictStart→verdictEnd` por Fio como sinal de medição.
