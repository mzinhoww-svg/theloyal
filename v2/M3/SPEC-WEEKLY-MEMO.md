# M3 · Weekly Memo — consolidação com revalidação de vigência (SPEC, antes de código)

> **Slice:** M3.1 (`v2/ROADMAP.md`) — "Consolidação com recheck obrigatório de todo
> status; contrato v2 do Weekly." Must-have do ROADMAP: **"Nenhum status herdado sem
> recheck."** Requisito de saída: **REQ-41** + **INV-05** (`v2/REQUIREMENTS.md`).
>
> **Modo:** SPEC primeiro. Este documento não constrói nada executável — descreve o
> contrato, o fluxo e o gate. Nada de migration, nada público.
>
> **Tese-mãe herdada (HANDOFF-CHAT §0):** *determinismo primeiro, LLM depois.* Todo
> número (score, CPM, percentil, vigência) sai de SQL/função pura testada; a LLM
> escreve/explica, nunca calcula nem decide vigência.

---

## 0. Conflito a destacar no topo (dado vence relato)

**O contrato do Weekly JÁ EXISTE e a decisão "schema próprio vs. extensão" já está de
fato tomada no repo.** `content/weekly.schema.json` existe como **schema aditivo próprio**
(`$id: https://theloyalty/weekly.schema.json`), com edições reais validando contra ele
(`content/weekly/2026-W28.json`, `2026-W29.json`). Existe também um **motor de
consolidação já implementado** — `scripts/weekly-consolidate.mjs` (`consolidate()`,
`buildFios()`, `weeklyState()`, `weeklySignals()`) — e o **design doc de produto**
`docs/design/weekly-daily-consolidation.md` (DD-WEEKLY-001) que fixa a unidade de síntese
(o **Fio**), a ordem de blocos e as regras de dedup.

Logo, a decisão (c) do brief ("weekly.schema.json aditivo próprio vs. extensão do
edition.schema.json") **não é uma folha em branco** — é uma **ratificação/evolução** do
que já está no repo. Trato isso em §5 e §6.c: recomendo manter o schema próprio e evoluí-lo
para **v2 aditivo**, não acoplar ao `edition.schema.json`.

**A lacuna real que a M3.1 fecha** (a que justifica o slice, não reescrever o que existe):
o recheck que `weekly-consolidate.mjs` faz hoje é `isExpired(deal.vigencia, windowEnd)`
(`scripts/weekly-consolidate.mjs:67,208`) — ou seja, **reusa a `vigencia` congelada dentro
do JSON da Daily**. Isso é exatamente **status herdado**: o design doc §1.2 reconhece que
"a Weekly herda esse erro [de ingestão] em silêncio". A M3.1 troca esse recheck por uma
**revalidação contra o banco vivo (`campaigns`) na DATA DE PUBLICAÇÃO do Weekly** — é o que
`INV-05`/`REQ-41` exigem e o que o `weekly-consolidate.mjs` v1 não faz.

---

## 1. Consolidação — lê os `content/editions/*.json` da semana E recomputa contra o banco vivo

### 1.1 Fluxo (dois passos, separados por responsabilidade)

O Weekly é montado em dois passos deterministas, na disciplina "quem publica ≠ quem mede"
(design doc premissa 4; `weekly-consolidate.mjs` já separa `consolidate` de `render`):

```
PASSO A — CONSOLIDAR (o que a semana disse)         [read-only nas edições]
  entrada: content/editions/*.json com date ∈ [inicioSemana, fimSemana]
  reuso:   scripts/weekly-consolidate.mjs
             fioKey()      — routeKey > entityKey > cat:slug   (identidade do Fio)
             buildFios()   — agrupa deals da semana em Fios (1 Fio = 1..N deals)
             weeklyState() — NOVO / REABRIU / SEGUE / ENCERROU / VIROU
             weeklySignals() — trajetória verdictStart→verdictEnd (acurácia)
  saída:   rascunho de Fios com lineage {edition, deal} até a Daily de origem

PASSO B — REVALIDAR (o que ainda é verdade HOJE)     [lê o banco vivo]
  entrada: os Fios do Passo A  +  dataPublicacao (ISO)  +  linhas vivas de `campaigns`
  reuso:   v2/lib/digest/selecionar.mjs   passaTresPortoes / elegivelDealDesk
                                          selecionarDealDesk / selecionarFechaLogo
           v2/lib/digest/dia-fraco.mjs    selecionarFechouSemana (recap encerradas)
                                          selecionarPredict (teaser do radar)
           v2/lib/digest/mapear-contrato.mjs  mapVeredito / mapScoreBreakdown
           v2/lib/digest/editorial.mjs    nomePrograma / rotaDisplay / tipoLabel
                                          lintJargao / formatarDataBr / formatarPredictNarrativa
  saída:   Weekly consolidado + LOG de revalidação (o que caiu na revalidação)
```

**Por que dois passos e não um.** O Passo A é a *memória da semana* (o que as Dailies
publicaram — imutável, já auditado no seu dia). O Passo B é o *estado no fechamento* (o que
o banco diz **na data de publicação do Weekly**, que é posterior ao fim da janela). Um item
pode ter sido "Vale olhar / ativo" na quarta e ter **vencido no sábado** — o Passo A o vê
ativo (herança), o Passo B o reprova e o migra para "encerrou nesta semana". Essa separação
é o coração do `INV-05`.

### 1.2 Como a recomputação contra `campaigns` funciona (identidade → estado vivo)

1. **Chave de junção Daily↔banco:** cada Fio carrega `routeKey`/`entityKey`
   (`edition.schema.json`: `deal.routeKey` = `origem->destino` normalizado por entity keys,
   "identidade estável independente de vigencia_fim, ADR-RADAR-009"; `deal.entityKey`). A
   revalidação casa o Fio à(s) linha(s) de `campaigns` pela **mesma identidade canônica**
   `(tipo, origem, destino, publico)` do M1 (HANDOFF-CHAT §1) — não por texto, não por URL.
2. **Estado vivo vem do banco, recomputado, nunca do JSON da Daily:** o `estado`
   (`ativa`/`detectada`/`ultimos_dias`/`encerrada`) e o `vigencia_fim` usados no Passo B são
   **lidos de `campaigns`** (populados pela FSM de vigência do M1: `v2/lib/vigencia.mjs`).
   `passaTresPortoes()` (`selecionar.mjs:24`) reaplica os três portões — estado vivo **E**
   `tier===1` **E** `tl_score_bruto` não-nulo — no momento da montagem, "nunca confia em flag
   pré-gravada" (`selecionar.mjs` cabeçalho).
3. **Recap de encerradas reusa a função pura já testada:** `selecionarFechouSemana(campaigns,
   { hoje: dataPublicacao, janelaDias })` (`dia-fraco.mjs:151`) — filtra
   `estado='encerrada' AND tier=1 AND tl_score_bruto IS NOT NULL AND vigencia_fim ∈ [hoje-janela,
   hoje]`. `hoje` é **sempre injetado** (o módulo lança se ausente — nunca `new Date()`
   interno, INV-16). É a mesma leitura que o Daily já usa em "O que fechou nesta semana"
   (`edition.schema.json` `oQueFechouSemana`), reusada aqui como o balde para onde os itens
   reprovados na revalidação migram.
4. **Nomes legíveis e rota de exibição reusam `editorial.mjs`** (`nomePrograma`, `rotaDisplay`,
   `tipoLabel`) — a Weekly não reimplementa tradução de código→nome. Veredito e breakdown
   reusam `mapVeredito`/`mapScoreBreakdown` (`mapear-contrato.mjs`), que **lançam** em rótulo
   desconhecido (nunca defaultam para "nao-confirmado" — esconderia typo do banco).
5. **Ordenação reusa a seleção existente:** o ranking de "onde está o valor" ordena os Fios
   **vivos revalidados** por `tl_score_bruto DESC`, desempate por `vigencia_fim ASC` (vence
   primeiro sobe) — a mesma regra de `selecionarDealDesk` (`selecionar.mjs:50`). **NÃO se
   reescreve seleção.**

> **Reuso obrigatório cumprido:** seleção de "o que fechou" = `selecionarFechouSemana`; nomes
> legíveis/rota = `editorial.mjs`; ordenação/portões = `selecionar.mjs`; veredito/breakdown =
> `mapear-contrato.mjs`; agrupamento por Fio + estado + lineage = `weekly-consolidate.mjs`.

---

## 2. MUST-HAVE DO GATE (não-negociável) — revalidação de vigência item por item no fechamento

> **Regra em uma frase (INV-05, REQ-41):** *nenhum status é herdado; nada vencido na DATA DE
> PUBLICAÇÃO do Weekly pode aparecer como ativo.* O recheck recomputa `vigencia_fim` vs. a
> data de publicação, **item por item**, contra o banco vivo.

### 2.1 O check — `gateRevalidacaoVigencia(itensAtivos, { dataPublicacao, campaignsVivas })`

**ENTRADA**
- `itensAtivos`: todo item que o Weekly vai exibir **como vivo/ativo/segue** — ou seja, os
  Fios destinados a `ranking` ("onde está o valor"), a `movements.seguem` ("segue vigente"),
  a "o que segue vivo pro fim de semana" e a qualquer `ofertaAtiva`. Cada item traz sua
  identidade canônica (`routeKey`/`entityKey`) e o `estado`/`vigencia` **que a Daily afirmou**
  (o valor herdado que está sob suspeita).
- `dataPublicacao`: ISO date/datetime em que o Weekly será publicado (o "fechamento"). **É a
  referência do recheck** — distinta de `dateEnd` da janela (publicação ocorre depois do fim
  da semana; ver §6.a).
- `campaignsVivas`: linhas de `campaigns` lidas do banco no momento da montagem, chaveadas por
  identidade canônica, cada uma com `estado` e `vigencia_fim` recomputados pela FSM (M1).

**LÓGICA (por item, determinística — INV-12)**
```
para cada item ∈ itensAtivos:
  camp = campaignsVivas[ identidadeCanonica(item) ]          // junção por (tipo,origem,destino,publico)
  1. SEM CONTRAPARTE VIVA        → camp ausente                        ⇒ REPROVA (herança sem recheck)
  2. ESTADO MORTO NO BANCO       → camp.estado ∈ {encerrada, historica} ⇒ REPROVA (migra p/ "encerrou")
  3. VENCIDO NA PUBLICAÇÃO       → isExpired(camp.vigencia_fim, dataPublicacao)  (scripts/lib.mjs)
                                     i.e. vigencia_fim < dataPublicacao          ⇒ REPROVA (migra p/ "encerrou")
  4. VIGÊNCIA INDETERMINADA/     → camp.vigencia_confiavel === false  OU  vigencia_fim nulo
     SEM FONTE                       sem confirmação                            ⇒ REPROVA (vira "Não confirmado", INV-05/INV-03)
  5. DATA FABRICADA/OVERPRECISE  → camp.vigencia marcada overprecision (INV-16) ⇒ REPROVA (bloqueio, envenena a FSM)
  caso contrário (camp vivo + tier1 + vigencia_fim ≥ dataPublicacao) → APROVA como ativo
```
Reusa `isExpired` (`scripts/lib.mjs:84`) para o comparativo de datas e `passaTresPortoes`
(`selecionar.mjs:24`) para o corte vivo+tier1+computável — o gate **não reimplementa** essas
regras, só as encadeia sobre `dataPublicacao`.

**O QUE FAZ PASS**
- **Todo** item de `itensAtivos` tem contraparte viva em `campaigns`, com `estado` vivo,
  `tier===1`, `vigencia_fim` **confiável e ≥ `dataPublicacao`**. Zero status herdado.
- Todo item reprovado (regras 1–5) **saiu** da exibição ativa e **migrou** para o bloco de
  encerradas/`revalidacao.log` — nenhum reprovado vaza para `ranking`/`seguem`.
- O `revalidacao.log` registra cada recheck (aprovado e reprovado) com `fio`, status Daily,
  status recomputado, `vigenciaRecheckada`, `dataPublicacao` e destino (o log que o
  `weekly-memo` skill e o design doc §5.1 exigem).

**O QUE FAZ FAIL (bloqueia a publicação — reprovado nunca envia, M2.4/gate único)**
- Qualquer item exibido como ativo cujo `vigencia_fim` recomputado **< `dataPublicacao`**
  (vencido no fechamento aparecendo como vivo). **Esse é o FAIL canônico do slice.**
- Qualquer item ativo com `estado ∈ {encerrada, historica}` no banco.
- Qualquer item ativo **sem contraparte viva** (status puramente herdado do JSON da Daily,
  sem recheck contra o banco).
- Qualquer item ativo com vigência **indeterminada / sem fonte / não confiável** exibido como
  confirmado (INV-05), ou com **data fabricada/overprecise** (INV-16).
- Presença de jargão interno de pipeline em texto do leitor (`lintJargao` ≠ vazio,
  `editorial.mjs:118`) — herda o lint do gate 5.5/INV-06 (não é o foco do slice, mas o gate é
  único).

### 2.2 Nível de teste (golden, PASS/FAIL explícito)

| # | Cenário | Entrada | Esperado |
|---|---|---|---|
| T1 | vivo de verdade | Fio `esfera->latam_pass`, banco `estado=ativa`, `vigencia_fim=2026-07-25`, `dataPublicacao=2026-07-24`, tier 1 | **PASS** — aparece em ranking/seguem |
| T2 | venceu entre a quarta e a publicação | Daily disse ativo; banco `vigencia_fim=2026-07-22`, `dataPublicacao=2026-07-24` | **FAIL se exibido ativo**; migra p/ "encerrou nesta semana" |
| T3 | status só herdado (sem contraparte) | Fio sem linha viva em `campaigns` | **FAIL** — herança sem recheck |
| T4 | encerrada no banco | banco `estado=encerrada` | **FAIL se ativo**; vira recap |
| T5 | vigência indeterminada | `vigencia_confiavel=false` / `vigencia_fim` nulo | item ativo → **FAIL**; classifica "Não confirmado" (INV-03/05) |
| T6 | data fabricada | `vigencia` overprecision (INV-16) | **FAIL** — bloqueio |
| T7 | semana fraca (nada sobrevive) | todos os Fios reprovam na revalidação | **PASS do gate** — Weekly honesto de "dia fraco de 1ª classe": ranking vazio, recap de encerradas cheio, sem inventar item vivo (ver §3.5) |

`dataPublicacao` é sempre injetada (nunca `new Date()` interno — mesma disciplina de
`selecionarFechouSemana`). Golden files: mesma entrada → mesma saída (INV-12).

---

## 3. Estrutura proposta (ancorada na referência editorial já aprovada)

Herdando a **ordem canônica do design doc §5.2** (arco *mudança → posição → futuro*) e o
vocabulário do Daily (D-057), com a **regra-mãe** aplicada a cada bloco: **sem dado real, o
bloco some** (`dia-fraco.mjs` §2.1 — seção sem dado é OMITIDA, nunca parcial/vazia).

### 3.1 Recap da semana — janelas que abriram / fecharam
- **Abriram:** `movements.novas` (estados NOVO/REABRIU do `weeklyState`), com lineage.
- **Fecharam:** **reusa a lógica de "fechou semana"** — `selecionarFechouSemana(campaigns,
  { hoje: dataPublicacao, janelaDias: 7 })` (`dia-fraco.mjs:151`). É recap, **sem cálculo
  novo** — só leitura de `estado='encerrada' AND tier=1 AND tl_score_bruto IS NOT NULL`. Para
  cá migram os itens que a §2 reprovou por vencimento. Mapeia 1:1 ao `oQueFechouSemana` do
  `edition.schema.json`.
- Regra-mãe: sem abertura e sem fechamento reais na janela → o recap some.

### 3.2 O que segue vivo pro fim de semana
- Os Fios **aprovados pela §2** — vivos, tier 1, `vigencia_fim ≥ dataPublicacao`. Este é o
  bloco que a revalidação protege: **só entra quem passou o recheck.**
- Ordenado por `tl_score_bruto DESC`, desempate `vigencia_fim ASC` (o que vence primeiro sobe
  — mesma regra de `selecionarDealDesk`, `selecionar.mjs:50`). É o `ranking` do design doc
  §5.2 ("onde está o valor"), lido como "o que ainda dá pra fazer no fim de semana".
- Regra-mãe: zero itens aprovados → bloco some (não se fabrica oferta viva; §3.5).

### 3.3 Melhor da semana por categoria
- Por categoria (taxonomia D-001 via `tipoLabel`, `editorial.mjs:66`): o Fio de maior
  `tl_score_bruto` **entre os aprovados na §2** naquela categoria. Um item por categoria; sem
  aprovado na categoria → a categoria não aparece.
- Nunca dois blocos para o mesmo Fio (regra de ouro de saída, design doc §4.2: um Fio, um
  bloco; precedência highlights > ranking > movements).

### 3.4 O que vem no radar (Predict)
- `selecionarPredict(digest.radarWeekly)` (`dia-fraco.mjs:196`) — teaser que aparece **só**
  quando ≥1 janela `confidence='alta'` no `content/forecast.json`; **nunca revela
  valor/janela prevista**, só a contagem/sinal (regra-mãe 3/4). Narrativa opcional via
  `formatarPredictNarrativa` (`editorial.mjs:168`), recomputada pelo gate.
- Território M4 (Predict Ledger) — aqui é ponte para o futuro, nunca veredito nem garantia.
  Ausente/`ativos:0` → seção omitida.

### 3.5 Disciplina de "dia fraco de primeira classe" (regras 5 e 6 do HANDOFF)
As duas regras que o brief destaca:
- **Dia (semana) fraco é de primeira classe** (`v2/lib/gate-unico.test.mjs:11` — "deals:[] →
  dia fraco de primeira classe"; D-050 — "estreia RECUSANDO, não performando"). Se a
  revalidação esvazia o ranking, a Weekly **diz isso com todas as letras** (recap de
  encerradas + tese honesta), **não** promove um item morno a "vivo" para encher a peça.
- **Número honesto menor nunca é maquiado** (INV-03 / regra 9 do CLAUDE.md / D-039 — "faltou
  dado → 'Não confirmado', nunca chuta"; D-050.1 — não-valor onde não há conta). A Weekly
  mostra o número real revalidado, ainda que menor/vazio; não infla, não herda o número maior
  da Daily de segunda se o banco no fechamento diz outra coisa.

### 3.6 Tese da semana + fontes + disclaimer
- `signal` (tese), 1 tese sustentada por evidência dos Fios (weekly-memo skill: ≥3 evidências
  com fonte). `sources` (união dedup por URL das edições — `weekly-consolidate.mjs:260`).
- **Disclaimer obrigatório**, íntegro (regra inviolável 10 / `weekly.schema.json` `const`).

---

## 4. Contrato de saída (campos do Weekly, JSON)

**Decisão:** o Weekly é **schema aditivo próprio** — evolução do `content/weekly.schema.json`
**existente** para uma **v2 aditiva** (não extensão do `edition.schema.json`; ver §6.c e §0).
Campos existentes (`number`, `period`, `dateStart`, `dateEnd`, `publishTime`, `signal`,
`radar`, `movements`, `ranking`, `highlights`, `watch`, `sources`, `disclaimer`, `$defs`
`lineage`/`movementItem`/`radarWindow`/`source`) **permanecem válidos** — W28/W29 continuam
passando. A M3.1 **adiciona** (aditivo, mesma disciplina de M2.3/D-057 "edições v1 permanecem
válidas"):

| Campo novo | Tipo | Função | Regra-mãe |
|---|---|---|---|
| `schemaVersion` | integer (=2) | versão do contrato Weekly. Ausente ⇒ 1 (W28/W29 legadas) | — |
| `dataPublicacao` | string (date-time) | data/hora de fechamento — **referência do recheck** (§2), distinta de `dateEnd` | obrigatório na v2 |
| `revalidacao` | object | **log de revalidação** (INV-05 / weekly-memo skill "o que caiu na revalidação") | ver abaixo |
| `revalidacao.dataRecheck` | string (date-time) | = `dataPublicacao` usada no gate | — |
| `revalidacao.log[]` | array | por item: `{ fio, statusDaily, statusRecheck, vigenciaRecheckada, vigenciaConfiavel, resultado: 'ativo'\|'encerrou'\|'nao-confirmado', destino }` | item sem recheck = erro do gate |
| `segueVivo[]` | array | "o que segue vivo pro fim de semana" — Fios aprovados na §2 (`fio`, `label`, `anchor`, `verdict`, `score`, `vigencia`, `lineage`) | vazio ⇒ bloco some |
| `melhorPorCategoria[]` | array | melhor da semana por categoria (`categoria`, `fio`, `label`, `anchor`, `verdict`, `score`, `lineage`) | sem aprovado ⇒ categoria some |
| `predict` | object | `{ ativos: integer }` — teaser (espelha `edition.schema.json` `$defs/predict`); nunca label/value/window | `ativos:0` ⇒ omitido |
| `porPerfil` | object (opcional) | estratégia por perfil (6 segmentos, weekly-memo skill) — **default OMITIDO** até a captura popular os segmentos (D-065) | ver §6.b |

**Notas de contrato**
- `verdict` reusa o `$defs/verdict` (mesmo enum kebab-case do `edition.schema.json`) — nunca
  um vocabulário paralelo (D-057 decisão 1).
- Todo item aprovado como ativo em `segueVivo`/`melhorPorCategoria` **tem** entrada
  correspondente em `revalidacao.log` com `resultado:'ativo'` — o gate cruza os dois (nenhum
  ativo sem recheck registrado).
- `anchor` cita o **resultado** da conta (`conta.result`, ex. "CPM R$ 12,00"), nunca reimprime
  `conta.rows` (design doc §2.4 — a conta linha a linha é exclusiva da Daily). Números em mono
  no render.
- `movements`/`highlights`/`ranking`/`radar`/`watch` **permanecem** como estão — a v2 só
  acrescenta a camada de revalidação e os blocos de leitura de fim de semana por cima.

---

## 5. Por que schema próprio (fundamento da recomendação de §6.c)

Acoplar o Weekly ao `edition.schema.json` (extensão) quebraria mais o contrato existente do
que mantê-lo separado, por três razões ancoradas no repo:
1. **O `edition.schema.json` é um alvo móvel muito ativo:** D-052, D-053, D-057, D-059
   adicionaram/depreciaram ~15 campos (`ofertasAtivas`, `cartoesBancos`→`cartoesBancosItens`,
   `sinaisRapidos` obsoleto, `predictNarrativa`, etc.). Herdar esse churn no Weekly é herdar
   instabilidade.
2. **As chaves de topo divergem por natureza:** o Daily é indexado por `number`/`date`/
   `weekday`/`publishTime`; o Weekly por `number`/`period`/`dateStart`/`dateEnd` — eixos
   temporais diferentes (evento vs. janela). O design doc §2 fixa que a **unidade** também
   difere (deal vs. Fio).
3. **Já há edições validando contra o schema próprio** (W28/W29) e um render/consolidador que
   o consomem. Trocar a base do contrato é retrabalho sem ganho — a v2 aditiva preserva tudo.

---

## 6. Três decisões a nomear (default REVERSÍVEL + recomendação, NÃO cravado)

### (a) Dia/hora de envio + fuso `America/Sao_Paulo`
- **Default reversível proposto:** **sexta-feira, 09:00 BRT (12:00 UTC), `America/Sao_Paulo`.**
- **Recomendação + justificativa:** sexta de manhã. O bloco "o que segue vivo **pro fim de
  semana**" (§3.2) só faz sentido **antes** do fim de semana — a peça prepara a ação de
  sáb/dom. Sexta 09:00 BRT desacopla do Daily (que sai 06:30 BRT seg-sex, D-065) para não
  competir na mesma caixa de entrada, e a skill `weekly-memo` já assume **relatório na sexta**
  ("Data do relatório: sexta DD/MM/AAAA"). Reversível: é `publishTime` + `scheduledAt` no
  JSON e cron do publisher — trocar para sábado 08:00 BRT é um parâmetro, não um refactor.
  **Alternativa viva:** sábado de manhã (leitor com mais tempo de ler) — deixo nomeada porque
  o trade-off (antecedência × atenção) é do operador.

### (b) Envio único pra base vs. os 6 segmentos
- **Default reversível proposto:** **envio único para a base inteira**, espelhando a estreia
  do Daily (S2-D2 = envio único pra base).
- **Recomendação + justificativa:** único para a base **agora**. Os 6 segmentos existem e
  estão nomeados no Beehiiv (`custom_field perfil`, D-008/D-065 item 2), mas ficam **com 0
  membros até a captura** (quiz de onboarding) popular o campo — segmentar hoje é mandar para
  listas vazias. Além disso, INV-03/regra 9: **não se chuta segmento** (D-064: o critério de
  perfil não existe até a captura). Reversível por design: o `porPerfil` do contrato (§4) já
  está previsto e **omitido por padrão**; no dia em que a captura popular os perfis, liga-se o
  envio segmentado sem tocar no schema. Enquanto isso, a estratégia por perfil pode aparecer
  como **conteúdo dentro do envio único** (1–2 linhas por perfil, weekly-memo skill), sem
  fragmentar a entrega.

### (c) `weekly.schema.json` aditivo próprio vs. extensão do `edition.schema.json`
- **Default reversível proposto:** **schema aditivo próprio** — evoluir o
  `content/weekly.schema.json` existente para **v2 aditiva** (§4).
- **Recomendação + justificativa (qual quebra MENOS o contrato existente):** manter/evoluir o
  schema próprio **quebra menos**. Já existe como schema separado com edições válidas e motor
  próprio (§0, §5); a v2 é 100% aditiva (`schemaVersion` ausente ⇒ 1, W28/W29 seguem válidas —
  mesma disciplina de M2.3). Estender o `edition.schema.json` acoplaria o Weekly ao campo-churn
  do Daily (D-052→D-059) e forçaria eixos temporais/unidade incompatíveis (§5). Reversível:
  como os dois compartilham os `$defs` de `verdict`/`source`, um futuro merge é possível — mas
  **não é o custo certo agora**. Recomendo ratificar o que o repo já fez.

---

## 7. Checklist de saída do slice (M3.1)

1. Recheck lê `campaigns` vivo e recomputa `vigencia_fim` vs. `dataPublicacao` — **item por
   item** (§2). ✅ contrato definido
2. Nenhum status herdado: todo ativo em `segueVivo`/`melhorPorCategoria` tem entrada em
   `revalidacao.log` com `resultado:'ativo'` (REQ-41). ✅
3. Reprovados migram para recap de encerradas via `selecionarFechouSemana` — sem cálculo novo
   (§3.1). ✅ reuso
4. Reuso obrigatório: `selecionar.mjs`, `dia-fraco.mjs`, `mapear-contrato.mjs`, `editorial.mjs`,
   `weekly-consolidate.mjs` — seleção NÃO reescrita. ✅
5. Regra-mãe por bloco: sem dado real, some (§3). Semana fraca = peça honesta (§3.5). ✅
6. Contrato v2 aditivo: W28/W29 legadas seguem válidas (§4). ✅
7. Disclaimer íntegro; vocabulário de veredito canônico; números em mono; zero emoji/urgência;
   `lintJargao` limpo (INV-06). ✅
8. Golden files: mesma entrada → mesma saída (INV-12); `dataPublicacao` sempre injetada. ✅

---

## Anexo — docs/decisões ancorados (arquivo + ID citado)

| Fonte | ID / seção | O que ancorou |
|---|---|---|
| `v2/ROADMAP.md` | M3.1 | slice: consolidação com recheck obrigatório; contrato v2; must-have "nenhum status herdado sem recheck" |
| `v2/REQUIREMENTS.md` | INV-05 | "nenhum status herdado sem revalidação; FSM exige revalidação; Weekly recheca todo status" — âncora do gate §2 |
| `v2/REQUIREMENTS.md` | REQ-41 | "Weekly com revalidação obrigatória; amostra auditada: todo status rechecado hoje" |
| `v2/REQUIREMENTS.md` | INV-16 | data sem evidência por componente = indeterminada; overprecision bloqueia (regra 5 do gate) |
| `v2/REQUIREMENTS.md` | INV-03 / INV-12 / INV-06 | não chutar → "Não confirmado"; determinismo; lint de linguagem |
| `content/edition.schema.json` | `$defs/verdict`, `deal.routeKey`/`entityKey`/`firstSeen`, `oQueFechouSemana`, `predict` | vocabulário, identidade do Fio, recap, teaser reaproveitados |
| `content/weekly.schema.json` | schema inteiro (v1) | base aditiva do contrato v2 (§4) — decisão (c) |
| `v2/lib/digest/selecionar.mjs` | `passaTresPortoes`, `elegivelDealDesk`, `selecionarDealDesk`, `selecionarFechaLogo` | portões vivos + ordenação (reuso, §1.2) |
| `v2/lib/digest/dia-fraco.mjs` | `selecionarFechouSemana`, `selecionarPredict` | "fechou semana" + teaser Predict (reuso, §3) |
| `v2/lib/digest/mapear-contrato.mjs` | `mapVeredito`, `mapScoreBreakdown` | tradução banco→contrato sem fallback silencioso |
| `v2/lib/digest/editorial.mjs` | `nomePrograma`, `rotaDisplay`, `tipoLabel`, `lintJargao`, `formatarPredictNarrativa`, `formatarDataBr` | nomes legíveis, rota, lint, narrativa Predict |
| `scripts/weekly-consolidate.mjs` | `fioKey`, `buildFios`, `weeklyState`, `consolidate`, `weeklySignals` | consolidação por Fio existente; lacuna do recheck herdado (§0) |
| `scripts/lib.mjs` | `isExpired` | comparativo `vigencia_fim < dataPublicacao` (§2.1 regra 3) |
| `docs/design/weekly-daily-consolidation.md` | DD-WEEKLY-001 §1.2, §2, §3 (Fio), §4.2, §5.2 | unidade de síntese, ordem de blocos, regra de não-repetição, "herda erro em silêncio" |
| `v2/HANDOFF-CHAT.md` | §0 (tese-mãe), §1 (identidade canônica M1) | determinismo primeiro; chave (tipo,origem,destino,publico) |
| `v2/lib/gate-unico.test.mjs` | comentário "dia fraco de primeira classe" | regra 5 do brief (§3.5) |
| `v2/DECISIONS.md` | D-008 | 6 segmentos de perfil = slice; nomes dos perfis |
| `v2/DECISIONS.md` | D-065 (itens 2 e 3) | segmentos criados mas 0 membros até captura; cadência Daily 06:30 BRT — base das decisões (a)/(b) |
| `v2/DECISIONS.md` | D-050 / D-050.1 | estreia RECUSANDO; não-valor onde não há conta — regra 6 do brief (§3.5) |
| `v2/DECISIONS.md` | D-039 / D-057 (decisão 1) | ratio ausente ≠ 1:1 (não chutar); vocabulário de veredito único |
| `/root/.claude/skills/weekly-memo/SKILL.md` | protocolo weekly-memo | revalidação obrigatória, log do que caiu, estratégia por perfil, tese com ≥3 evidências |
| `CLAUDE.md` | regras invioláveis 9 e 10 | "Não confirmado" quando falta dado; disclaimer obrigatório |

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de comprar,
transferir ou resgatar.*
