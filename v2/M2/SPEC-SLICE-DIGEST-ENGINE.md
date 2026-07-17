# M2 · Slice — Digest Engine (SPEC, antes de código) — v2 (emenda do operador)

> **Gate de entrada:** vetores fechados (P1 aplicada e revisada — mediana 58, ≥70 8,9%,
> n=1.996, zero regressão nos 1.334 `conta_nao_calculavel`). **Modo: build, spec primeiro.**
> GSD2 (Milestone > Slice > Task), must-haves verificáveis, resumo por slice
> (`gsd-output-formatter`), `structured-dev-workflow` no commit. Nenhum código nesta
> entrega — spec + decisões para ratificar. **Não liga auto-publish, não estreia o Daily**
> — isso só depois do gate 5.5 passar nos dois casos (com/sem Deal Desk) e 5 dias
> consecutivos de aprovação de 1 clique (D-050 decisão 3, ainda em vigor).
>
> **v2 desta spec (commit anterior `9c39ffc`) incorpora a emenda do operador:** patch do
> `scoreBreakdown` aprovado (deixa de ser decisão aberta); S1-D1/D2/D3 do template
> ratificados agora (formalizados como D-052, ver `DECISIONS.md`); dois blocos novos no
> dia fraco (Clipping, Resumo do dia) com ordem revisada; Loyalty Lab muda de "sempre
> humano" para "automatizável por corte de score, com dependência de Ledger mapeada
> abaixo — registrada como dívida, não bloqueante"; seleção diferencia TIER 1 (Deal Desk)
> de TIER 2 (blocos narrativos). Tudo formalizado em D-053. Continua sendo **spec — zero
> código, zero escrita em produção.**

---

## 0. O que o Digest Engine é (e o que já existe para ele consumir)

O Digest Engine **renderiza a edição Daily a partir do que já está gravado no banco** —
não calcula nada (INV-12: score, CPM, percentil já são determinísticos e vivem em
`campaigns`). O trabalho dele é **seleção + montagem + contrato de saída**, três
funções puras + um passo de render, todas testáveis com golden files.

**Estado real do dia, medido agora (não hipotético — é o dado vivo pós-P1):**

```sql
vivo (estado ∈ ativa/detectada/ultimos_dias):        54
  · com tier=1 (TIER 1 confirmado):                    1
    · com tl_score_bruto não-null (conta computável):  1
      · com veredito_bruto ∈ {Vale agir, Vale olhar}:  0
```

**Hoje É um dia fraco, de verdade** — não um caso de teste sintético. O único item que
passa os três portões (D-044) é `smiles-desconhecido-compra-2026-07-17`, bruto **55 "Só
para casos específicos"**, vence hoje. Pelo D-050 decisão 1 ("não estreia com item
morno"), isso **não é** Deal Desk. Isso confirma exatamente por que a regra 5 (dia fraco
como estado de estreia, não fallback) é a prioridade real desta spec, não um exercício
acadêmico — é o que a engine vai renderizar se ligada agora.

---

## 1. Seleção e montagem — como o Digest Engine escolhe e monta os itens

### 1.1 Fonte única de leitura: `campaigns` + `news_raw` (mais `campanha_fontes` quando encher — INV-02)

Nenhuma tabela nova. O engine lê `campaigns` (join `campanha_fontes` quando aplicável) e
aplica os **três portões do D-044** como filtro determinístico, **recomputado no momento
da montagem** (nunca confia em um cache de "é Deal Desk" gravado antes):

1. **Estado vivo:** `estado IN ('ativa','detectada','ultimos_dias')`.
2. **TIER 1 confirmado:** hoje `tier = 1` (dívida INV-02 registrada — quando
   `campanha_fontes` encher, o critério migra para lá sem mudar o contrato de saída).
3. **Conta computável:** `tl_score_bruto IS NOT NULL` (D-050.1 já garante que
   `conta_nao_calculavel` nunca chega aqui com número).

**Emenda (D-053): TIER 2 sobe de importância, mas só para os blocos narrativos.** Os três
portões acima + o corte de veredito (§1.2) continuam **exclusivos de TIER 1** para Deal
Desk — isso não muda. Mas os blocos do dia fraco que são **conteúdo editorial, não
recomendação acionável** (Clipping, Resumo do dia, Loyalty Lab — §2.3) podem puxar de
**TIER 2**: `news_raw` (todas as fontes ativas são TIER 2 hoje — `melhorescartoes`,
`melhoresdestinos`, `passageirodeprimeira`, `pontospravoar`, mais `tavily`) e de
`campaigns` com `tier=2`, sem exigir os três portões nem o corte de veredito. A
justificativa: TIER 2 já chega com boa parte da apuração feita (jornalismo/blog
especializado real, não boato) — não serve para "isto é uma oferta que vale agir", mas
serve de sobra para "isto aconteceu hoje no mercado" (Clipping/Resumo) ou "este é o
padrão que observamos" (Loyalty Lab). **Continua valendo INV-01** (toda afirmação carrega
fonte + data) mesmo nos blocos TIER 2 — a barra que cai é a de corroboração TIER 1, não a
de proveniência.

### 1.2 Corte de Deal Desk — os três portões não bastam sozinhos

Passar os três portões torna o item **elegível para a listagem geral** (confirmado,
vivo, com conta) — **não** torna elegível para **Deal Desk**. O corte de Deal Desk é o
**veredito**: `veredito_bruto IN ('Vale agir', 'Vale olhar')` (D-050 decisão 1 — "Só para
casos específicos" e abaixo nunca é card de estreia, mesmo vivo/TIER1/com conta). Isso é
o que torna o "dia fraco" de hoje real: o único item elegível pelos 3 portões (bruto 55)
**não** cruza este quarto corte.

### 1.3 Ranking e cap

Dos elegíveis a Deal Desk: ordenar por `tl_score_bruto DESC`; empate quebrado por
`vigencia_fim ASC` (o que vence primeiro sobe — urgência é informação, não só valor).
**Cap de 3** (brief + S1-D3, **ratificada — D-052**: cap de 3, sem corte silencioso). Se
houver >3 elegíveis, o engine grava quantos ficaram de fora no relatório de montagem
(não descarta em silêncio).

### 1.4 Fecha Logo — eixo diferente de Deal Desk

`fechaLogo[]` não usa o corte de veredito — usa **urgência**: `estado = 'ultimos_dias'`
(vence em ≤72h, já é o gatilho que move o FSM para esse estado), **com ou sem** ser
"Vale agir/olhar". É avisar o leitor que algo vivo está acabando, mesmo que não seja uma
recomendação forte — por isso o item de bruto 55 de hoje **pode** aparecer em Fecha Logo
(ele vence hoje) mesmo **não** aparecendo em Deal Desk. São seções com critérios
diferentes, isso é intencional, não inconsistência.

### 1.5 Mapeamento DB → contrato (função pura, golden-testável)

Dois achados de tradução que o engine precisa resolver — nenhum é cálculo, são mapas
determinísticos 1:1:

**(a) Veredito: rótulo do banco → enum do schema.** `veredito_bruto` grava rótulos em
português (`'Vale agir'`, `'Vale olhar'`, `'Só para casos específicos'`, `'Esperaria'`,
`'Evitaria'`, `'Não confirmado'`); `content/edition.schema.json` (`$defs/verdict`) espera
kebab-case (`vale-agir`, `vale-olhar`, `casos-especificos`, `esperaria`, `evitaria`,
`nao-confirmado`). Precisa de **um mapa fixo, testado, sem fallback silencioso** (rótulo
fora do mapa = erro, nunca "Não confirmado" por default).

**(b) `scoreBreakdown` do schema NÃO batia com o engine real — patch APROVADO (D-052).**
O `$defs/scoreBreakdown` do `content/edition.schema.json` descrevia um modelo de **8
critérios** (`valor/regra/vigencia/friccao/aplicabilidade/liquidez/estoque/fontes`, pesos
25/15/15/10/10/10/10/5) — **resíduo do modelo antigo** (pré-`score.mjs`, quando o TL
Score chegava pronto do LLM). O engine real (`lib/score.mjs`, SLICE-4, o que a P1 acabou
de corrigir) tem **4 componentes**: `percentil/eficiencia/raridade/abrangencia`, pesos
`.45/.30/.15/.10` (`score_pesos.v1`), cada um com `{valor, valor_bruto, base_n, peso,
peso_efetivo, janela}`. **Aprovado aplicar o patch aditivo agora**: novo
`$defs/scoreBreakdown` de 4 campos (o shape real acima), versionado
(`schemaVersion` sobe), sem remover o campo antigo de edições já publicadas que o usem
(se houver — aditivo, não destrutivo). Isto deixa de ser decisão aberta; entra no
escopo de código desta slice.

---

## 2. Caso "dia fraco" — estado de estreia, não fallback

### 2.1 Regra-mãe (regra 5): seção sem conteúdo é omitida, nunca vazia

Quando `deals.length === 0` pós-corte (§1.2), a **seção Deal Desk inteira é omitida do
render** — sem título, sem card vazio, sem placeholder. O mesmo vale para qualquer outra
seção opcional sem dado real (§2.3). Isto já está desenhado no template
(`SPEC-SLICE-TEMPLATE-EMAIL-DAILY.md` §4) — o Digest Engine só precisa alimentar o
renderer com `deals: []` e o comportamento de omissão já existe.

### 2.2 Sinal do Dia carrega a honestidade — com a conta, não só a afirmação

`signal` é **obrigatório sempre** (schema já trava isso). No dia fraco, não pode ser
genérico ("hoje não há ofertas boas") — precisa citar **o que foi avaliado e por que não
passou**, com número real. Usando o dado de hoje como exemplo do que o texto deve conter:
*"Hoje X candidatos vivos passaram pela régua; N tinham TIER 1 confirmado; desses, 1
teve conta fechada — bruto 55, banda 'Só para casos específicos'. Abaixo do corte de
Deal Desk (Vale olhar/Vale agir)."* Isso é **gerado pelo LLM a partir dos números que o
engine já calculou** (redige, nunca calcula — INV-12); o gate 5.5 verifica que o texto
referencia pelo menos um número/candidato real, não é template solto (§3.2).

### 2.3 O que entra no lugar — só dado real, nunca enchimento

Regra dura: **cada bloco alternativo só entra se tiver dado real por trás; se não tiver,
é omitido também** (a regra 2.1 se aplica recursivamente). Nenhum bloco é gerado só para
preencher espaço. **Ordem revisada pelo operador (D-053):** Resumo do dia → Clipping →
Radar → Radar VPM → Sinais rápidos → Loyalty Lab.

0. **Resumo do dia** — síntese editorial curta (2–4 frases) do que aconteceu no mercado
   hoje, **distinta do Sinal do Dia** (que é veredito: "avaliamos X, nenhum passou o
   corte"). Resumo do dia é contexto: "o que rolou" no ecossistema de pontos/milhas hoje,
   sem julgar se algo é oferta ou não. Fonte: `news_raw` do dia (TIER 2, §1.1) +
   `campaigns` extraídas. **Prosa, não lista** — por isso é bloco próprio, separado do
   Clipping (item 1). Gate 5.5 verifica que cada afirmação factual do texto (evento, %,
   programa citado) tem correspondente rastreável em `news_raw`/`campaigns` do dia
   (mesmo princípio do INV-03, aplicado à prosa, não só a números soltos).
1. **Clipping** (bloco novo, D-053) — lista de **≥5** notícias relevantes do dia, cada
   uma com **resumo próprio de 1 linha** (nunca reprodução do texto de terceiro, INV-04),
   link canônico e fonte+tier visível. Fonte: `news_raw` (TIER 2), filtrado por
   relevância determinística (fetched_at = hoje; source ∈ news_sources ativas; dedup por
   `content_hash`). **Piso rígido de 5 — não preenche com menos.** Medido agora: hoje
   haveria 57 candidatos brutos no dia (`news_raw` de hoje, 4 fontes RSS + tavily),
   folga larga acima do piso — mas o piso é o que importa no dia realmente seco, não o
   volume de hoje. **Seção própria, não parte do Resumo do dia** — formatos diferentes
   (lista de itens rastreáveis individualmente vs. prosa síntese) pedem checks de gate
   diferentes (§3.3), e misturar dificultaria auditar "cada link tem resumo próprio, não
   cópia" isoladamente. **Proposta de posição na ordem:** logo depois do Resumo do dia —
   o leitor recebe a síntese primeiro (o que importa, em 5min, promessa da marca) e os
   links de apoio a seguir, antes das seções prospectivas (Radar/Sinais/Lab). Ratificar
   ou preferir Clipping antes do Resumo (itens crus primeiro, síntese depois)?
2. **Radar (`predicoes[]` / `radar.windows[]`)** — já existe no schema como **opcional
   com fallback** (REQ-32) e já tem fonte real (`content/forecast.json`, motor de
   recorrência). Se há janelas com `confidence` e `basis` reais, entram. Se
   `predicoes[]` vier vazio (`base_n` insuficiente), a seção some — não publica
   projeção sem lastro (`base_n>=3` e série `>=12 meses`).
3. **`shoppingWatch[]`** (Radar VPM) — dado real (`shopping_metrics`, 189 linhas
   populadas). Mesma regra: sem amostra suficiente (`vpmObservado='n/c'` sem
   `sampleN`), o item específico some da lista, não aparece com "n/c" vazio.
4. **Sinais rápidos** — itens que passam os 3 portões (§1.1) mas **não** o corte de
   veredito (ex.: o bruto 55 de hoje) — listados **sem chip de veredito de Deal Desk**
   (nunca "Vale olhar"/"Vale agir" — evita o leitor confundir sinal fraco com
   recomendação). É transparência ("isto existe, não recomendamos"), não teaser.
5. **Loyalty Lab** — o único bloco **editorial/narrativo** (não numérico/lista) da
   lista. Análise curta ancorada em padrão real observado (ex.: por que a janela de
   calendário está seca — ligando ao achado do D-051). Fonte: TIER 1 ou TIER 2 (§1.1),
   mais o histórico de padrões já resolvidos no Ledger quando existir (§2.4). **Gate de
   automação redesenhado — ver §2.4.**

Se **nenhum** dos 5 tiver dado real (cenário extremo, não o de hoje), a edição é só
Sinal do Dia + disclaimer. **Isso é uma edição válida**, não um erro — é a aplicação
mais estrita da regra-mãe.

### 2.4 Loyalty Lab — de "sempre humano" para "automatizável por score", com a dependência real do Ledger mapeada

**Emenda do operador (D-053):** Loyalty Lab deixa de exigir gate humano obrigatório e
passa a ter um **score de automação determinístico** — abaixo do corte, vai a revisão
humana; no ou acima do corte, publica direto. Mesmo desenho do gate de confiança TIER 1
(D-048): score objetivo, nunca "nota subjetiva de LLM", piso gated, auto-ajuste só com
volume mínimo de desfechos conhecidos.

**Composição do score (proposta, a ratificar):**
- `ancoragem` — quantas âncoras de dado real o texto cita (número + candidato nomeado
  que bate com `origem_code`/`destino_code` conhecido, ou link do Clipping, ou janela do
  Radar). Mínimo 2 para não ser rascunho vazio; puramente contável, não julgamento.
- `track_record` — fração de resoluções **positivas** do **mesmo tipo de padrão** já
  fechadas no Ledger (§2.4.1). **Sem Ledger, este componente é sempre 0** — e isso, por
  desenho, já é o suficiente para nunca cruzar o corte (ver abaixo).

**Corte proposto: 0,85** — mais conservador que o 0,75 do gate TIER 1 (D-048), porque o
risco de "soar promessa não verificada" em texto livre é mais difícil de conter que
classificar uma campanha por sinais objetivos. Piso gated (baixar exige o operador),
auto-ajuste só depois de volume mínimo de desfechos do **mesmo tipo de padrão narrativo**
(mesma trava 3 do D-048 — não calibra com base insuficiente). **Este é o valor a
ratificar — proponho 0,85, mas é a decisão nomeada do §4.**

#### 2.4.1 A dependência real: o que falta no Ledger antes do Loyalty Lab poder rodar sem humano

O "Ledger" referenciado é o **Predict Ledger** (REQ-24, `ROADMAP.md` M4.3 — predições
emitidas→resolvidas, Brier mensal), **não construído ainda** (confirmado agora: zero
tabela, zero código; só existe como requisito em `REQUIREMENTS.md`/`ROADMAP.md`). Mapeando
o que falta especificamente para o Loyalty Lab (não é o mesmo trabalho de destravar o
Predict numérico, mas reaproveita a mesma arquitetura):

1. **A tabela/ledger em si** (M4.3) — hoje zero. Dependência dura, não é só "faltou
   configurar".
2. **Loyalty Lab precisa emitir suas claims em formato ledger-compatível** (alvo, janela,
   claim, `base_n`, `emitida_em`) — trabalho **novo**, não incluído no M4.3 original (que
   foi desenhado para probabilidade numérica do Predict, não para claim narrativa). É
   uma extensão do formato do ledger, não um ledger paralelo — mesma tabela, tipo de
   claim diferente.
3. **Um passo de resolução** — algo precisa fechar a claim no fim da janela
   (correta/errada/parcial). M4.3 já prevê isso para predições numéricas; estender para
   claims do Loyalty Lab é trabalho adicional, não reuso automático.
4. **Volume mínimo de resoluções do tipo "claim de Loyalty Lab"** antes do corte poder
   auto-ajustar (mesma trava 3 do D-048).

**Veredito: NÃO bloqueante para esta spec — fica como dívida registrada.** M4 (Predict +
Ledger) é milestone **posterior** ao M2 (Daily) no `ROADMAP.md`; bloquear o Digest Engine
nisso significa esperar um milestone inteiro por um recurso que só afeta UM bloco
opcional do dia fraco. **O engine roda com Loyalty Lab sempre em revisão humana desde o
dia 1** — o score de automação (§2.4) existe como fórmula desde já, mas `track_record`
sempre resolve para 0 sem Ledger, então o corte **nunca é cruzado automaticamente** até o
Ledger existir e acumular volume — é "sempre humano" expresso como caso-limite da
fórmula, não como exceção hard-coded separada. Quando M4.3 entregar o Ledger, a
automação liga sem precisar redesenhar o Loyalty Lab.

---

## 3. Contrato de saída — gate 5.5, nos dois casos

O gate roda em **contexto independente do gerador** (REQ-31) — refaz os cálculos e
recomputa os portões a partir do banco, nunca confia no JSON da edição por si só.

### 3.1 Checks comuns aos dois casos (com e sem Deal Desk)

- Schema válido contra `content/edition.schema.json` (+ patches aditivos do §1.5/§4).
- `disclaimer` bate **literal** com a constante (INV-09).
- Lint de linguagem: zero emoji, zero termo da lista INV-06, zero promessa de ganho.
- **Todo número no texto tem correspondente rastreável no banco** (INV-03) — CPM, %,
  score, contagens do Sinal do Dia incluídas (não só os deals).
- Links (`sourceUrl`, `url` de fontes) retornam 200.
- `entityKey`/`routeKey` (quando presentes) existem em `content/entities`.

### 3.2 Checks exclusivos do caso COM Deal Desk (`deals.length >= 1`)

- Cada deal recomputado bate os **3 portões** (§1.1) direto no banco, não no JSON.
- `veredito ∈ {vale-agir, vale-olhar}` — nenhum item mais fraco entra como Deal Desk
  (recusa dura do D-050 decisão 1, verificada no gate, não só na seleção).
- `tl_score_bruto` recomputado bate com o breakdown mostrado (regra existente, `>R$0,05`/
  milheiro ou divergência de score = bloqueio, REQ-31).
- Vigência **não vencida** na data de publicação (`isExpired` já existe em `lib.mjs`).
- Cap de 3 respeitado; se a montagem sinalizou itens cortados, isso está no relatório do
  gate (não é erro, é registro).
- Se `contaFeita` presente (D-052: fallback = `conta` do primeiro item de `deals[]`
  quando ausente), rastreia a um dos deals ou tem override explícito e válido.

### 3.3 Checks exclusivos do caso SEM Deal Desk (`deals.length === 0`) — o caso novo

- **A seção Deal Desk está AUSENTE do artefato renderizado** — este check roda sobre o
  **HTML/output final**, não só sobre o JSON de entrada (a garantia real é "nunca
  renderizado vazio"; um JSON com `deals:[]` que ainda produz um card vazio no HTML é
  falha do renderer, e é isso que este check pega).
- **`signal` não é genérico**: contém pelo menos um número ou candidato nomeado
  (regex/parser simples — não é julgamento de LLM, é checagem estrutural: presença de
  dígito e de pelo menos um token que bata com um `origem_code`/`destino_code`
  conhecido).
- Gate **recomputa o zero** direto no banco (§0's query) — confirma que hoje é
  genuinamente dia fraco, não que o JSON *disse* que era.
- Cada bloco alternativo presente (§2.3) tem a mesma checagem de proveniência do §3.1
  (número rastreável) — **e** nenhum item de "sinais rápidos" carrega chip de veredito
  Deal Desk.
- **Resumo do dia** (se presente): cada afirmação factual (evento, %, programa citado)
  rastreável em `news_raw`/`campaigns` do dia — mesmo padrão do INV-03, aplicado à
  prosa. Gate distingue Resumo do dia (veredito zero, é contexto) de qualquer linguagem
  que soe recomendação — reaproveita o lint INV-06.
- **Clipping** (se presente): **mínimo 5 itens** — presença de 1 a 4 itens é **falha do
  gate**, não "quase lá" (o bloco deveria ter sido omitido, não publicado incompleto).
  Cada item: link retorna 200, resumo é próprio (checagem anti-cópia, similaridade
  contra o `content`/`title` original de `news_raw` — mesmo lint do INV-04), fonte+tier
  exibidos.
- Se **Loyalty Lab** está presente: gate recomputa o **score de automação** (§2.4) direto
  do banco — se `score >= corte` (proposto 0,85), publica sem revisão adicional; se
  `score < corte`, **exige** flag de revisão humana registrada (distinta da aprovação de
  1 clique da edição inteira). **Sem Ledger, `track_record=0` sempre, então hoje todo
  Loyalty Lab exige a revisão** — o gate aplica a mesma fórmula em todos os casos, não
  uma exceção hardcoded para "Ledger não existe ainda".

---

## 4. Decisões — o que já foi ratificado nesta emenda e o que ainda precisa de você

**Ratificadas nesta rodada (registradas em `DECISIONS.md` D-052/D-053, não reabrir):**

- ✅ Patch aditivo do `scoreBreakdown` (4 componentes reais) — D-052.
- ✅ S1-D1 (Conta Feita: fallback = `conta` do primeiro deal), S1-D2 (`oQueEvitar` como
  campo opcional), S1-D3 (cap de 3 no Deal Desk, sem corte silencioso), S1-D4 (schema
  vence, renderer realinha) — todos formalizados como D-052.
- ✅ Clipping e Resumo do dia entram como blocos novos do dia fraco — D-053.
- ✅ Loyalty Lab automatizável por score (fórmula do §2.4) em vez de gate humano fixo;
  dependência do Ledger mapeada e registrada como **dívida, não bloqueio** — D-053.
- ✅ TIER 2 alimenta os blocos narrativos (Clipping/Resumo/Loyalty Lab); Deal Desk
  continua exclusivo de TIER 1 — D-053.
- ✅ Critério de TIER 1 continua `tier=1` até `campanha_fontes` encher (INV-02, dívida já
  registrada, não nova; o Digest Engine não espera essa migração para operar).

**Ainda precisam de você (as únicas 2 decisões nomeadas de fato abertas):**

1. **Onde o Clipping entra na ordem, e se é seção própria.** Proposta em §2.3 item 1:
   seção **própria** (não parte do Resumo do dia — formatos e checks de gate diferentes),
   posicionada **logo após o Resumo do dia** (síntese primeiro, links de apoio depois,
   antes das seções prospectivas). Ratificar, ou prefere Clipping antes do Resumo (itens
   crus primeiro)?
2. **Corte do score de automação do Loyalty Lab.** Proposta em §2.4: **0,85**
   (mais conservador que o 0,75 do TIER1 — texto livre carrega mais risco de soar
   promessa que uma classificação objetiva). Piso gated, auto-ajuste só com volume
   mínimo de resoluções no Ledger (quando existir). Ratificar 0,85, ou prefere outro
   valor de partida?

Nenhuma das duas bloqueia o restante da spec — ambas têm proposta default já registrada
acima; sem sua resposta, o engine constrói com as propostas como estão (posição do
Clipping conforme §2.3, corte 0,85), reversível depois sem re-trabalho estrutural.

---

## 5. Fora de escopo desta entrega

- Código do engine (esta é a spec; código vem depois da ratificação do §4).
- Ligar auto-publish ou estrear o Daily (D-050 decisão 3 continua em vigor: espera o
  gate 5.5 passar nos dois casos + 5 dias de aprovação de 1 clique).
- Construir o Track Record (M3, `SPEC-TRACK-RECORD.md` §6.1, construção em HOLD —
  por isso não está na lista de blocos alternativos do §2.3 ainda).
- Publicação via Beehiiv MCP (M2.7, coordenado com `SPEC-SLICE-VERIFICACAO-BEEHIIV-MCP.md`).
- Painel de custo LLM (spec própria já entregue, `SPEC-SLICE-PAINEL-CUSTO-LLM.md`).
- **Construir o Predict Ledger (M4.3)** — dependência do Loyalty Lab automatizado
  (§2.4.1), registrada como dívida. Loyalty Lab roda com revisão humana até M4.3 entregar.

## 6. Definição de pronto (must-haves verificáveis)

1. Função de seleção pura (3 portões + corte de veredito + ranking + cap) com golden
   files sobre fixtures reais (incluindo o dia de hoje: 54 vivo → 1 tier1 → 1 conta → 0
   Deal Desk).
2. Mapa veredito DB→schema testado (golden: os 6 rótulos, sem fallback silencioso).
3. Patch do `scoreBreakdown` aplicado e populado com dado real de pelo menos 1 fixture.
4. Renderer (já existe, `SPEC-SLICE-TEMPLATE-EMAIL-DAILY.md`) recebendo `deals:[]` e
   omitindo a seção — testado no artefato HTML final, não só no JSON.
5. Gate 5.5 implementado com os quatro blocos de checks (§3.1 comum, §3.2 com Deal Desk,
   §3.3 sem Deal Desk — incluindo Clipping piso-5 e Resumo do dia), rodando em contexto
   independente, com golden do caso "hoje" (dia fraco real) passando limpo.
6. Zero blocos alternativos com número/afirmação sem correspondente no banco — testado
   com fixture onde um dos 6 candidatos do §2.3 (Resumo, Clipping, Radar, Radar VPM,
   Sinais rápidos, Loyalty Lab) não tem dado (deve desaparecer, nunca aparecer vazio ou
   incompleto — inclusive Clipping com <5 itens).
7. Fórmula do score de automação do Loyalty Lab (§2.4) implementada e testada: com
   `track_record=0` (sem Ledger), nunca cruza o corte — golden confirma "sempre humano"
   como caso-limite da fórmula, não branch hardcoded.
8. As 2 decisões nomeadas do §4 ratificadas (ou construído com a proposta default,
   reversível).

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
