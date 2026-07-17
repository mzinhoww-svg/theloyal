# M2 · Slice — Digest Engine (SPEC, antes de código)

> **Gate de entrada:** vetores fechados (P1 aplicada e revisada — mediana 58, ≥70 8,9%,
> n=1.996, zero regressão nos 1.334 `conta_nao_calculavel`). **Modo: build, spec primeiro.**
> GSD2 (Milestone > Slice > Task), must-haves verificáveis, resumo por slice
> (`gsd-output-formatter`), `structured-dev-workflow` no commit. Nenhum código nesta
> entrega — spec + decisões para ratificar. **Não liga auto-publish, não estreia o Daily**
> — isso só depois do gate 5.5 passar nos dois casos (com/sem Deal Desk) e 5 dias
> consecutivos de aprovação de 1 clique (D-050 decisão 3, ainda em vigor).

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

### 1.1 Fonte única de leitura: `campaigns` (mais `campanha_fontes` quando encher — INV-02)

Nenhuma tabela nova. O engine lê `campaigns` (join `campanha_fontes` quando aplicável) e
aplica os **três portões do D-044** como filtro determinístico, **recomputado no momento
da montagem** (nunca confia em um cache de "é Deal Desk" gravado antes):

1. **Estado vivo:** `estado IN ('ativa','detectada','ultimos_dias')`.
2. **TIER 1 confirmado:** hoje `tier = 1` (dívida INV-02 registrada — quando
   `campanha_fontes` encher, o critério migra para lá sem mudar o contrato de saída).
3. **Conta computável:** `tl_score_bruto IS NOT NULL` (D-050.1 já garante que
   `conta_nao_calculavel` nunca chega aqui com número).

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
**Cap de 3** (brief + S1-D3, ainda não ratificada nesta spec — ver §4). Sem corte
silencioso: se houver >3 elegíveis, o engine grava quantos ficaram de fora no relatório
de montagem (não descarta em silêncio).

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

**(b) `scoreBreakdown` do schema NÃO bate com o engine real — achado que precisa de
decisão antes de codar.** O `$defs/scoreBreakdown` do `content/edition.schema.json`
descreve um modelo de **8 critérios** (`valor/regra/vigencia/friccao/aplicabilidade/
liquidez/estoque/fontes`, pesos 25/15/15/10/10/10/10/5) — **resíduo do modelo antigo**
(pré-`score.mjs`, quando o TL Score chegava pronto do LLM). O engine real (`lib/score.mjs`,
SLICE-4, o que a P1 acabou de corrigir) tem **4 componentes**: `percentil/eficiencia/
raridade/abrangencia`, pesos `.45/.30/.15/.10` (`score_pesos.v1`), cada um com
`{valor, valor_bruto, base_n, peso, peso_efetivo, janela}`. **O Digest Engine não tem
como preencher o `scoreBreakdown` do schema atual com dado real** — os campos não
existem no motor. Isto precisa de um patch aditivo no schema (novo `$defs/scoreBreakdown`
de 4 campos, versionado) antes do engine poder popular esse bloco. Decisão no §4.

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
preencher espaço. Candidatos, em ordem de prioridade (determinística, não escolha do LLM):

1. **Radar (`predicoes[]` / `radar.windows[]`)** — já existe no schema como **opcional
   com fallback** (REQ-32) e já tem fonte real (`content/forecast.json`, motor de
   recorrência). Se há janelas com `confidence` e `basis` reais, entram. Se
   `predicoes[]` vier vazio (`base_n` insuficiente), a seção some — não published
   projeção sem lastro (INV-25, `base_n>=3` e série `>=12 meses`).
2. **`shoppingWatch[]`** (Radar VPM) — dado real (`shopping_metrics`, 189 linhas
   populadas). Mesma regra: sem amostra suficiente (`vpmObservado='n/c'` sem
   `sampleN`), o item específico some da lista, não aparece com "n/c" vazio.
3. **Sinais rápidos** — itens que passam os 3 portões (§1.1) mas **não** o corte de
   veredito (ex.: o bruto 55 de hoje) — listados **sem chip de veredito de Deal Desk**
   (nunca "Vale olhar"/"Vale agir" — evita o leitor confundir sinal fraco com
   recomendação). É transparência ("isto existe, não recomendamos"), não teaser.
4. **Loyalty Lab** — o único bloco **editorial/narrativo** (não numérico) da lista.
   Análise curta ancorada em padrão real observado (ex.: por que a janela de calendário
   está seca — ligando ao achado do D-051). **Não é auto-selecionado** como os itens
   1–3 (que são determinísticos, dado bate ou não bate); precisa de revisão humana antes
   de publicar, porque é o único lugar onde a LLM tem liberdade de composição — mais
   perto de correr risco de soar promessa/enchimento se não for revisado.

Se **nenhum** dos 4 tiver dado real (cenário extremo, não o de hoje), a edição é só
Sinal do Dia + disclaimer. **Isso é uma edição válida**, não um erro — é a aplicação
mais estrita da regra-mãe.

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
- Se `contaFeita` presente (dependente de S1-D1, ainda não ratificada), rastreia a um dos
  deals ou tem override explícito e válido.

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
- Se **Loyalty Lab** está presente, o gate confirma que **um humano aprovou** esse bloco
  especificamente (flag de revisão, distinto da aprovação de 1 clique da edição inteira)
  — é o único conteúdo não-determinístico da edição.

---

## 4. Decisões a ratificar antes do código

1. **Patch aditivo do `scoreBreakdown`** (§1.5b): trocar/estender o `$defs/scoreBreakdown`
   para os 4 componentes reais (`percentil/eficiencia/raridade/abrangencia`, cada um com
   `valor/valor_bruto/base_n/peso/peso_efetivo/janela`), versionado, sem quebrar o campo
   antigo em edições já publicadas (se houver). **Sem isto o engine não populate o
   breakdown com dado real — bloqueante para o código.**
2. **S1-D1/D2/D3 (da spec do template) ainda pendentes de ratificação explícita nesta
   rodada** — só S1-D4 foi confirmada ("schema vence"). O Digest Engine é desenhado para
   **degradar graciosamente** se `contaFeita`/`oQueEvitar` não existirem ainda (a seção
   correspondente some, mesma regra-mãe) — não bloqueia esta spec, mas indico que ratificar
   D1–D3 destrava o contrato completo.
3. **Prioridade determinística dos blocos alternativos do dia fraco (§2.3)** — proponho a
   ordem Radar → Radar VPM → Sinais rápidos → Loyalty Lab (dado mais duro primeiro,
   narrativo por último, sempre com revisão). Ratificar esta ordem ou prefere outra?
4. **Loyalty Lab exige aprovação humana própria** (§3.3, distinta da aprovação de 1 clique
   da edição) — concorda, ou prefere tratá-lo igual aos outros blocos determinísticos
   (sem gate extra)? Minha recomendação é manter o gate extra: é o único bloco gerativo.
5. **Critério de TIER 1 continua `tier=1`** até `campanha_fontes` encher (INV-02, dívida
   já registrada, não nova) — confirmando que o Digest Engine não deve esperar essa
   migração para começar a operar.

---

## 5. Fora de escopo desta entrega

- Código do engine (esta é a spec; código vem depois da ratificação do §4).
- Ligar auto-publish ou estrear o Daily (D-050 decisão 3 continua em vigor: espera o
  gate 5.5 passar nos dois casos + 5 dias de aprovação de 1 clique).
- Construir o Track Record (M3, `SPEC-TRACK-RECORD.md` §6.1, construção em HOLD —
  por isso não está na lista de blocos alternativos do §2.3 ainda).
- Publicação via Beehiiv MCP (M2.7, coordenado com `SPEC-SLICE-VERIFICACAO-BEEHIIV-MCP.md`).
- Painel de custo LLM (spec própria já entregue, `SPEC-SLICE-PAINEL-CUSTO-LLM.md`).

## 6. Definição de pronto (must-haves verificáveis)

1. Função de seleção pura (3 portões + corte de veredito + ranking + cap) com golden
   files sobre fixtures reais (incluindo o dia de hoje: 54 vivo → 1 tier1 → 1 conta → 0
   Deal Desk).
2. Mapa veredito DB→schema testado (golden: os 6 rótulos, sem fallback silencioso).
3. Patch do `scoreBreakdown` aplicado e populado com dado real de pelo menos 1 fixture.
4. Renderer (já existe, `SPEC-SLICE-TEMPLATE-EMAIL-DAILY.md`) recebendo `deals:[]` e
   omitindo a seção — testado no artefato HTML final, não só no JSON.
5. Gate 5.5 implementado com os dois blocos de checks (§3.2 e §3.3), rodando em contexto
   independente, com golden do caso "hoje" (dia fraco real) passando limpo.
6. Zero blocos alternativos com número sem correspondente no banco — testado com fixture
   onde um dos 4 candidatos do §2.3 não tem dado (deve desaparecer, não aparecer vazio).
7. Decisões do §4 ratificadas pelo operador.

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
