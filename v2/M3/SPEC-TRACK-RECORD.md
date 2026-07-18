# M3 · Track Record — a prova de metodologia (SPEC, antes de código)

> **Por que (D-046/D-050/D-051).** A máquina está provada; o Deal Desk vivo espera
> **oferta forte** (offer-triggered). Enquanto espera, o produto tem conteúdo real: o
> **track record** — "estas foram as melhores ofertas que já passaram, **com nossa conta
> e nosso veredito**". É o **Sage/mídia** demonstrando a régua funcionando ao longo do
> tempo, base do **accuracy loop**. Dá substância à estreia **sem publicar item vivo
> morno** (D-050). NÃO é o Deal Desk vivo; é o arquivo/prova.
>
> **Regra-mãe herdada:** *o produto não mostra número que o próprio sistema sabe suspeito.*
> Vale para valor (não-valor onde não há conta) **e para TEMPO** (§3 — dependência do predict).

---

## 0. O que é

Superfície **pública** (página M3) que lista ofertas **históricas** (encerradas) que
o sistema pontuou como fortes, cada uma com o **breakdown, a conta em reais e o
veredito** que o The Loyal deu **na época**. É editorial + prova de método, não
recomendação viva (as ofertas já passaram). Segue **integralmente o design system da
marca** (CLAUDE.md: TL Score, vocabulário de veredito, números em mono, `ContaBlock`,
disclaimer, zero urgência/emoji).

---

## 1. Régua de inclusão (quais ofertas entram)

- **Encerradas** (`estado in ('historica','encerrada')`) — oferta viva é do Deal Desk,
  não do track record.
- **Com valor real** — `tl_score_bruto` não-null (exclui os não-valor / `conta_nao_calculavel`,
  D-050.1) e idealmente banda forte na época ("Vale olhar"/"Vale agir"). Mostrar a régua
  **acertando E recusando**: incluir também exemplos fortes-que-a-conta-desmascarou
  (o `livelo→azul` 115%-blog→50%-oficial "Evitaria" é o caso didático — prova do rigor).
- **Fonte rastreável** — de preferência TIER 1 (regulamento); TIER 2 marcado como tal.
- **Dentro da janela temporal confiável** (§3) — inegociável.

## 2. Campos públicos por item (o que aparece)

Por oferta: **TL Score** + **veredito** (vocabulário fixo, cor semântica) + **conta em
R$** (`ContaBlock`: CPM/milheiro, como se montou — custo-base × ratio × bônus) +
**breakdown por componente** (quanto veio de percentil/eficiência/raridade/abrangência,
com `base_n`) + **período de vigência** (§3) + **fonte** (link + tier). Números em
**JetBrains Mono**. **Disclaimer obrigatório** (recomendação histórica ainda é recomendação):
*"Promoções podem mudar sem aviso. Confira sempre as regras no site oficial…"*.

## 3. DEPENDÊNCIA TEMPORAL — inviolável (coordenação com o chat de predict)

O track record exibe **vigência e datas** de ofertas históricas. O chat de predict
descobriu que a **camada temporal está corrompida** (janela confiável **~24 meses**,
reconstrução em curso). Logo:

- **Não exibir data de oferta fora da janela confiável** até a reconstrução fechar —
  mostrar vigência errada ao público é **exatamente o erro que o produto existe para não
  cometer**.
- O track record **herda a janela de confiabilidade temporal do predict**: ofertas
  **dentro de ~24 meses** (pós-reconstrução) são seguras; **mais antigas** dependem da
  reconstrução **ou** aparecem marcadas **"data não-confiável"** (nunca uma data que o
  sistema sabe suspeita).
- **Consequência:** o track record pode ser **construído já** (ranking, scores, contas,
  vereditos são sólidos), mas a **exibição de datas** espera a reconstrução temporal /
  usa a janela confiável. Não estreia com data suspeita. Alinhar via HANDOFF.

---

## 4. Fora de escopo

- Não é o **Deal Desk vivo** (offer-triggered, D-050). Track record = arquivo, não oferta acionável.
- Não liga auto-publish nem toca a calibração (frente paralela, caminho crítico do vivo).
- Não constrói o motor de score (provado); consome o que já está gravado.

## 5. Definição de pronto

- Régua de inclusão consulta a base (encerradas + valor real + janela temporal confiável).
- Item renderiza no design system da marca (score/veredito/`ContaBlock`/breakdown/fonte/disclaimer).
- **Nenhuma data fora da janela confiável exibida sem marca de não-confiável.**

---

## 6. Decisões do operador — RATIFICADAS (2026-07-17)

1. **Régua de inclusão: ✅ inclui as recusas selecionadas.** Um track record só de boas
   ofertas parece agregador; um que inclui "esta parecia boa e não era, veja a conta" é o
   The Loyal. O `livelo→azul` "Evitaria" é peça-chave (prova a régua nos dois sentidos).
2. **Janela de datas: ✅ mostra o seguro, marca o resto, não bloqueia.** Dentro dos ~24m
   confiáveis exibe data; mais antigas = "período aproximado / a confirmar".
3. **Campos: ✅ breakdown completo por componente.** É a prova de método — "veja a conta",
   não "confie em nós". O breakdown É o produto.
4. **Superfície: ✅ página própria** (`/track-record`) — ativo permanente referenciável que
   cresce com o tempo, não conteúdo de uma edição.

## 6.1 CONSTRUÇÃO EM HOLD — espera a fundação cravar (decisão de sequência)

**Spec ratificada, construção SEGURADA.** O track record é conteúdo de estreia de um produto
que **ainda não está no ar** — construí-lo agora é encher a prateleira de uma loja fechada.
O que **abre a loja** é a **calibração fechar** (liga o auto-publish), não o track record.
E o track record depende de **fundação ainda em movimento:** herda a **janela temporal
confiável do predict**, que ainda não está cravada (reconstrução depende da âncora/reconciliação
da edge fn). Construir sobre janela que vai mudar = **retrabalho garantido**. Ordem certa:
**(1)** calibração fecha os vetores → auto-publish; **(2)** predict crava a janela ~24m; **(3)**
só então o track record é construído sobre fundação estável (data confiável + score final);
**(4)** fecha o M2. Não é adiar por adiar — é construir na ordem que evita retrabalho.
Gatilho para construir: **janela temporal cravada E vetores fechados.**

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*

---
---

# M3 · CAMADA DE PÁGINA — Track Record + Ativos + Predict (extensão SPEC, 2026-07-18)

> **Modo:** SPEC PRIMEIRO. Esta seção **estende** a spec acima (§0–§6.1, ratificada
> 2026-07-17). Nada aqui constrói página ou aplica migration. Toda migration/view é
> **PROPOSTA** — volta para aprovação antes de aplicar. Ancorada em documentação existente;
> conflitos sinalizados no topo (§M3.0).

## M3.0 — Âncoras e conflitos (ler antes de tudo; dado vence relato)

**Âncoras citadas (arquivo + ID):**
- **`v2/M3/SPEC-TRACK-RECORD.md` §0–§6.1** — a superfície é `/track-record`, arquivo/prova
  de método, não Deal Desk vivo; inclui recusas (livelo→azul "Evitaria"); breakdown completo
  por item; **dependência temporal §3 inviolável** (só exibe data dentro da janela confiável).
- **`v2/DECISIONS.md`:**
  - **D-046** — histórico de alto valor = track record (dívida M3), ativo de marca.
  - **D-047** — público-na-tupla (`tipo|origem|destino|publico` = identidades distintas);
    decomposição por público é **enriquecimento de track record**; adapter detecta campanha
    pela **janela de vigência no regulamento**, não pela URL.
  - **D-048/D-049** — gate de confiança determinístico; **confiança (qualidade da verificação)
    é ORTOGONAL ao resultado** (corrobora/refuta).
  - **D-044** — **3 portões** do publicável vivo: (1) estado vivo, (2) TIER 1 confirmado,
    (3) conta computável. Usados na seção de ativos (§M3.3-A).
  - **D-050 / D-050.1** — estreia recusando; `conta_nao_calculavel` ⇒ **não-valor**
    (`tl_score_bruto=null`, `veredito_bruto='Não confirmado'`). O placar **não** ressuscita cnc.
  - **D-051** — não se constrói infra sem alvo medido; **espera honesta é estado válido**.
    Governa §M3.1 (view antes de tabela agregada) e o hold (§6.1).
  - **D-022 / D-035 / D-037 / D-039** — TL Score v2 (vetor `score_pesos.v1`
    `percentil .45/eficiência .30/raridade .15/abrangência .10`), CPM cego = **asterisco
    tipado** (`nao_calculado_ainda` vs `nao_calculavel_por_natureza`).
  - **D-057** — Predict como seção do digest: teaser que só aparece com janela `confidence='alta'`,
    **contagem apenas** (nunca label/value/window).
  - **D-059 §1/§1b/§3** — benchmark milhasbot: **"Ver análise" por promoção + placar histórico
    por rota + banco por programa** viram slice de M3; **Predict com probabilidade sempre
    visível** (baixa/média/alta), nosso diferencial vs. o benchmark (que só olha para trás);
    zero emoji (o benchmark usa 👍🏆 — nós usamos vocabulário TL + cor semântica).
  - **D-060 / D-061** — verificação **pré-superfície** (`v2/lib/verificacao/pre-superficie.mjs`)
    roda antes de QUALQUER superfície editorial, **incluindo M3**; flag → revisão, nunca descarte.
  - **D-062 / D-065** — item sem confirmação fica na MESMA seção com selo "AGUARDANDO
    CONFIRMAÇÃO OFICIAL"; auto-publish é **elegível só com fila de revisão vazia**.
- **Contrato de dado (`content/edition.schema.json`):** `$defs.predictNarrativa`
  (`probabilidade ∈ {baixa,media,alta,em-formacao}`, `historicoTipicoPercent` nullable,
  `texto` = saída de `formatarPredictNarrativa`), `$defs.predict` (teaser: só `ativos`,
  contagem), `$defs.scoreBreakdown` (4 componentes + `baseN`/`janela`).
- **Artefato Predict (`content/forecast.json`):** `clusters[]` + `routes[]`, cada um com
  `route`/`origem`/`destino`, `confidence`, `typicalPercent`, `windows[]`,
  `windowStart`/`windowEnd`, `lastWindow`, `cadence`, `basis`, `samples`.
- **DB (`v2/db/migrations/001…015`):** `campaigns` (`estado` FSM, `tl_score_bruto`,
  `veredito_bruto`, `origem_code`, `destino_code`, `publico`, `lado_unico`,
  `vigencia_fim_date`, `vigencia_confiavel`, `tier`, `source_url`, `regulamento_url`,
  `first_seen`, `used_in`); `tl_breakdown` (componente, `base_n`, `base_curta`, `versao_pesos`);
  `tl_overrides` (`override_aplicado`); `campanha_versoes` (trilha `evento`/`payload`).
- **Componentes canônicos (`components/`):** `ui.tsx` (`SectionLabel`, `TLBadge` com `Verdict`,
  `ContaBlock`, `Reveal`), `graphics.tsx` (`CompareBanner`, `Sparkline`, `PontoReadingScene`,
  `LedgerTexture`), `shell.tsx` (`Nav`, `Footer`), `PontoMascot.tsx`.

**⚠ CONFLITOS A RESOLVER (sinalizados, não silenciados):**

1. **Rota `/track-record` (SPEC §6.4) vs `/promocoes` (benchmark milhasbot, D-059).**
   A spec ratificada crava `/track-record`; o benchmark que o operador mandou espelhar
   usa `/promocoes/` e combina **ativos + histórico + banco**, um superconjunto do arquivo
   histórico. A página M3 real é esse superconjunto (§M3.3), maior que "track record".
   **Não crava sozinho** — decisão nomeada em **§M3.6(c)**.
2. **Hold de construção (SPEC §6.1) parcialmente satisfeito por D-065.** O §6.1 segura a
   construção até "(1) calibração fechar os vetores → auto-publish; (2) predict cravar a
   janela ~24m". **D-065 já LIGOU o auto-publish e a cadência** (gate 1 satisfeito). Resta o
   **gate 2 (janela temporal ~24m cravada)** — que a TRILHA B (rotulagem
   `limpo|revisao|historico_confirmado`) e o predict fecham. Esta spec é justamente o trabalho
   que **não** depende do gate 2: projeta a camada de dado/UI **contra o contrato** para estar
   pronta quando a janela cravar. Registrado, não overrida o §6.1.
3. **`content/forecast.json` é snapshot `2026-07-14`, todas as rotas `confidence` baixa/em-formacao.**
   Hoje **zero janela `alta`** ⇒ a seção Predict formal (teaser D-057) ficaria omitida, e a
   camada narrativa (D-059 §3) diria "sem base para prever" em quase tudo. **Isso é dado, não
   defeito** (D-050/D-051): a degradação graciosa (§M3.2) é o caminho principal hoje, não a
   exceção.

---

## M3.1 — P1 · CAMADA DE DADO (placar histórico por rota + banco por programa)

### M3.1.1 Conjunto-fonte (consome a rotulagem da TRILHA B)

A TRILHA B classifica todo o backlog de `campaigns` em **`limpo | revisao | historico_confirmado`**
com trilha em `campanha_versoes`. Esta camada projeta **contra o contrato das categorias**
(a distribuição e as rotas elegíveis chegam depois — não são premissa aqui):

| Categoria (Trilha B) | Entra no placar/banco? | Papel |
|---|---|---|
| `historico_confirmado` | **Sim** | Espinha dorsal do placar (janelas datadas confiáveis) |
| `limpo` | **Sim** | Complementa placar/banco; elegível a score de destaque |
| `revisao` | **Não como destaque** | Aparece só como linha "em revisão" **sem score** (estilo `nao-confirmado`), nunca alimenta teto/mediana/melhor-do-ano |

> **Contrato consumido (não invento a coluna física):** a página lê um rótulo
> `classificacao_backlog ∈ {limpo,revisao,historico_confirmado}` por campanha. **A Trilha B
> é dona da materialização** (coluna aditiva em `campaigns` **ou** derivação do último evento
> `campanha_versoes`). Se materializar como coluna, é **migration aditiva da Trilha B** — esta
> spec só a **consome**. Enquanto o rótulo não existir, a camada degrada para o filtro
> conservador atual (`estado in ('historica','encerrada') AND tl_score_bruto IS NOT NULL`,
> SPEC §1) — nunca inventa rótulo.

**Filtros herdados (empilham sobre a categoria):**
- Régua de inclusão da SPEC §1 (encerradas + valor real + fonte rastreável).
- **D-050.1:** onde `override_aplicado='conta_nao_calculavel'` ⇒ `tl_score_bruto IS NULL` ⇒
  **fora** do cálculo de teto/mediana (não-valor não vira número de placar).
- **§3 (temporal):** data só entra "crua" se dentro da janela confiável (`vigencia_confiavel=true`);
  fora ⇒ marcada "período aproximado / a confirmar" (SPEC §6.2). **Placar nunca exibe data que
  o sistema sabe suspeita** — mesma regra-mãe do produto.

### M3.1.2 Placar histórico por rota (`origem_code → destino_code`)

Agregação por par canônico (D-047: `publico` faz parte da identidade fina, mas o **placar de
rota** agrega por `origem_code→destino_code`; a decomposição por público vive no "Ver análise"):

| Campo do placar | Origem | Regra |
|---|---|---|
| `n_janelas` | count de janelas de vigência **distintas** da rota | dedupe por janela (`vigencia_inicio`+`vigencia_fim_date`), não por linha |
| `faixa_bonus_tipica` | mediana + `[min–max]` de `percentual` | mono; ignora `percentual IS NULL` (cnc/não-valor) |
| `teto_historico_datado` | `max(percentual)` **com** a janela em que ocorreu | data exibida só se `vigencia_confiavel`; senão "período aproximado" |
| `mediana`, `nº_registros` | mediana de `percentual`, count | espelha o benchmark 1b |
| `ultima_janela` | `max(vigencia_fim_date)` na janela confiável | proveniência para "quando foi a última vez" |

### M3.1.3 Banco por programa (`destino_code` = programa)

Agrega o placar de todas as rotas que chegam ao programa (`destino_code`), + as campanhas
conhecidas com **estado/vigência** (o "banco de dados por programa" do benchmark 1b-iv):

- **Chips (mono):** média · mediana · teto · melhor-do-ano · nº de registros — todos derivados
  de `campaigns` filtrado por categoria (§M3.1.1).
- **Parágrafo-síntese:** prosa Inter (não Fraunces no corpo), redação própria (regra inviolável 2).
- **Histórico completo datado com veredito por linha:** cada linha = uma campanha com
  `veredito_bruto` (cor semântica) + data confiável; `revisao` sem score.
- **Estado/vigência:** `estado` (FSM) por campanha conhecida — quais estão vivas, encerradas,
  em últimos dias.

### M3.1.4 Migration ou view? → **VIEW (PROPOSTA), não tabela agregada**

**Recomendação (default reversível): duas VIEWS de leitura, zero migration destrutiva.**
A base é ~3,6k linhas — agregação em tempo de leitura é trivial; materializar seria otimização
prematura (D-051: não construir infra sem alvo medido).

- `vw_placar_rota` — GROUP BY `origem_code, destino_code` sobre o conjunto filtrado (§M3.1.1).
- `vw_banco_programa` — GROUP BY `destino_code`.

Ambas: **puramente aditivas, reversíveis por `DROP VIEW`, sem tocar dado nem backup**.

> **PROPOSTA — NÃO APLICADA NESTA TRILHA.** Mesmo `CREATE VIEW` sendo aditivo, em modo
> SPEC-PRIMEIRO **não aplico**. As duas views voltam como proposta antes de qualquer execução.
> **Se** o perfil de carga da página exigir materialização (não exige hoje), a alternativa é
> **materialized view refrescada pelo runner de re-score** (nunca cron próprio que duplique
> lógica) — e essa **materialized view / tabela agregada volta como PROPOSTA explícita** antes
> de aplicar, com dry-run e trilha, na disciplina de D-038. Nada de tabela agregada nova sem OK.

---

## M3.2 — P2 · INTEGRAÇÃO PREDICT (contrato de consumo)

A página **consome** o Predict; um **dispatch paralelo entrega as janelas** (artefato
`content/forecast.json`, hoje já existente). A página **não recalcula** o forecast — lê o
artefato por chave de rota.

### M3.2.1 Contrato de consumo (o que a página espera receber)

Por rota (`origem_code→destino_code`) ou cluster (`→destino_code`), a página lê do forecast:

| Campo consumido | Fonte (`forecast.json`) | Uso público |
|---|---|---|
| chave da série | `route` / `origem` / `destino` | casar com a linha do placar |
| **banda de probabilidade** | `confidence` → `{baixa,media,alta,em-formacao}` | rótulo textual + cor semântica (§M3.2.3) |
| histórico típico | `typicalPercent` | "histórico típico ~X%" (é **passado**, pode aparecer) |
| base da projeção | `basis` / `cadence` / `samples` | prosa "N janelas, cadência ~Xd" |

**NÃO consumido na superfície pública gratuita (teaser Pro):** `windowStart` / `windowEnd`
(a **data futura** prevista) e qualquer **valor fino** da próxima janela. Isso é o gated
(decisão §M3.6-a). O contrato bate 1:1 com `edition.schema.json $defs.predictNarrativa`:
`probabilidade` enum idêntico, `historicoTipicoPercent` nullable, `texto` **sempre** a saída
de `formatarPredictNarrativa(...)` (`v2/lib/digest/editorial.mjs`) — a **mesma função** que o
gate 5.5 recomputa, para página e digest **nunca divergirem**.

### M3.2.2 Banda de probabilidade — sem valor fino (D-059 §3)

- Mapeamento direto `confidence → probabilidade`: `alta→alta`, `media→média`, `baixa→baixa`,
  `em-formacao→em formação`. **A banda é o teto de resolução pública**; o valor fino (dia
  exato, %, janela) fica atrás do Pro.
- **Predict formal (teaser D-057):** só renderiza com ≥1 janela `confidence='alta'` em
  `digest.radarDaily`, e mostra **só a contagem** (`ativos`). Hoje = 0 ⇒ omitido (regra-mãe).
- **Camada narrativa (D-059 §3):** aparece **mesmo com probabilidade baixa/em-formação** —
  "o radar acompanha Esfera→Smiles (histórico típico ~70%), mas ainda não há base para prever
  a próxima janela". Mostra o poder da ferramenta nos dois sentidos. **TL Score é intocado** —
  a probabilidade explica a nota, nunca a altera.

### M3.2.3 Degradação graciosa (INV-25 / INV-03 — nunca número inventado)

| Estado da rota no forecast | Comportamento da página |
|---|---|
| `confidence='alta'` + janela | banda **alta** + (teaser Pro para data/valor) |
| `confidence` média/baixa | banda correspondente; sem data pública |
| `confidence='em-formacao'` / `samples < minSamples` | **"sem previsão ainda"** — "radar acompanha, ainda não há base para prever a próxima janela" |
| rota **ausente** do forecast | **"fora do radar"** — nenhuma linha de Predict; nunca fabrica banda |
| `typicalPercent = null` | omite o "~X%"; nunca chuta |

**Regra dura:** rota sem base **nunca** recebe número inventado (INV-25/INV-03) — recebe texto
de ausência. O `formatarPredictNarrativa` já encapsula isso; a página **reusa a função**, não
reescreve a lógica (D-043: código testado vence resumo de spec).

---

## M3.3 — P3 · UI (wireframe textual → componentes canônicos + checklist item a item)

Página `main#conteudo` com **uma única `<h1>`** ("Promoções" ou "Track record" — §M3.6-c),
`header`/`nav` (Nav existente) e `footer` (Footer existente, já carrega o disclaimer). Três
seções, cada uma aberta por `SectionLabel`.

### Seção A — Status / Ofertas ativas
```
[SectionLabel] OFERTAS ATIVAS
[Barra de status viva]  AGORA · N bônus ativos · 1 vence em Xd · Verificado em [data]
   → mono; acento blue-600 (Sinal do dia); SEM vermelho de urgência, SEM countdown
[Tabela de ativos] por linha:
   Rota (mono origem→destino) | Bônus faixa (mono, ex "100–125%") | Milheiro/CPM (mono) |
   Vence (mono; só se vigencia_confiavel) | [TLBadge verdict+score] | "Ver análise" (link blue-600)
```
- **Mapeamento:** `SectionLabel` (ui.tsx); `TLBadge` com `Verdict` + `score` (cor semântica
  automática); números em `font-mono`; link "Ver análise" abre P4.
- **3 portões (D-044):** só item **vivo + TIER 1 + conta computável** exibe `TLBadge` com score
  real. Item sem confirmação fica na **mesma seção** com selo **"AGUARDANDO CONFIRMAÇÃO
  OFICIAL"** + fonte linkada (D-062), nunca como headline pontuado (D-060 `confianca_baixa_para_destaque`).

### Seção B — Placar histórico por rota
```
[SectionLabel] PLACAR HISTÓRICO
[Tabela] por rota:
   DE→PARA (mono) | Teto histórico (mono + mês/ano datado) | Mediana (mono) | Nº registros (mono)
[Sparkline opcional] por rota — cadência das janelas, UM único destaque verde
```
- **Mapeamento:** `SectionLabel`; tabela mono; `Sparkline` (graphics.tsx, `kind`) para cadência
  — um destaque verde por peça. **Sem `TLBadge` em linha agregada** (agregado não é um veredito
  único; o veredito é por-campanha, no "Ver análise").
- **§3:** teto datado só com `vigencia_confiavel`; senão "período aproximado / a confirmar".

### Seção C — Banco por programa
```
[SectionLabel] BANCO POR PROGRAMA
[Card por programa (Surface #FFFFFF)]
   Chips (paper-dark fill, valores mono): média · mediana · teto · melhor-do-ano · nº registros
   Parágrafo-síntese (Inter, redação própria)
   Histórico datado por linha: data (mono) | percentual (mono) | [TLBadge veredito]
     → linha 'revisao' = SEM score, estilo nao-confirmado (borda tracejada gray-400)
```
- **Mapeamento:** `SectionLabel`; card em `surface`; chips em `paper-dark` com valor `font-mono`;
  `TLBadge` por linha histórica (cor semântica); `revisao` → variante `nao-confirmado`.
- **`CompareBanner`** (graphics.tsx) é opcional como abertura data-art de um programa (tese em
  Fraunces, um destaque verde) — nunca dentro de bloco de cálculo.

### Ponto (mascote)
- **Onde:** um bloco de abertura/intro em tom **Sobre/Metodologia** ("este placar é prova de
  método: a conta que fizemos, não a promessa que nos fizeram"), pose `padrao`, **fora** de
  qualquer `ContaBlock`, tabela de ativos ou linha de veredito. Permitido na superfície de
  metodologia (PONTO-MASCOTE-GUIA). Voz 3ª pessoa, humor seco, sem promessa.
- **Conflito simpatia × credibilidade → corta o Ponto** (regra-mãe do guia): se o mascote
  encostar num veredito real, sai da peça.

### Checklist de saída (CLAUDE.md) — item a item aplicado
1. **Cores só de token** — tabelas/chips/badges via classes; único hex permitido em
   `PontoMascot.tsx`/`graphics.tsx`. **Sem hex em componente de página.**
2. **Números de análise em JetBrains Mono** — CPM, %, R$, TL Score, teto, mediana, datas.
3. **Serif só em título** — Fraunces em h1/h2/tese; corpo e chips em Inter/mono.
4. **Fundo Paper, cards Surface** — página `#FAF7F0`, cards do banco `#FFFFFF`.
5. **Verde de texto = green-600 (#00A878); amarelo só fill com Ink** — `TLBadge` "esperaria"
   é `bg-yellow-500 text-ink` (já no ui.tsx); green-500 nunca como texto sobre Paper.
6. **Veredito com vocabulário + cor semântica** — `Verdict` type do ui.tsx (mapa TL Score).
7. **Zero emoji/stock/avião/gradiente/urgência** — substitui os 👍🏆 do benchmark por vocabulário
   TL (D-059); barra "vence em Xd" sem vermelho de urgência/countdown.
8. **AA / body ≥16px / alvos ≥44px / uma h1 / landmarks + skip link** — h1 única na página;
   Nav/Footer trazem landmarks; skip link já no `layout.tsx`; links "Ver análise" e chips ≥44px.
9. **`prefers-reduced-motion`** — `Reveal`, `Sparkline`, idle do Ponto e tracking de pupila
   com fallback estático (padrão já existente em globals.css).
10. **Disclaimer presente onde há recomendação + fonte citada** — "Ver análise" (P4) e footer;
    redação própria (regra 2).
11. **Ponto dentro do guia** — só no bloco Sobre/Metodologia, fora de cálculo/veredito.
12. **`npm run build` compila sem type error** — TS strict; sem dependência nova.

---

## M3.4 — P4 · "VER ANÁLISE" (o que abre)

Detalhe **por identidade fina** (`tipo|origem|destino|publico`, D-047) — cada faixa de público
é sua própria análise. Conteúdo, de cima para baixo:

1. **Título (Fraunces h2):** rota + tipo + público (ex.: "Livelo → Azul · transferência · clube").
2. **`TLBadge` veredito + TL Score** — `veredito_bruto`/`tl_score_bruto`, **cor semântica**
   (mapa TL Score). cnc/não-valor ⇒ "Não confirmado" (dashed), sem número (D-050.1).
3. **`ContaBlock` — a conta feita:** custo-base × ratio × bônus → CPM/milheiro (D-039). CPM cego
   ⇒ **asterisco tipado** (D-035): `nao_calculado_ainda` ("esperando tabela de ratios") vs
   `nao_calculavel_por_natureza` ("origem sem custo de aquisição de mercado"). Fundo Ink fixo,
   mono Paper.
4. **Breakdown por componente:** `tl_breakdown` — percentil/eficiência/raridade/abrangência com
   `base_n`, marca `base_curta`, `versao_pesos`. É o "veja a conta" (SPEC §6.3 — o breakdown É o produto).
5. **Histórico da rota:** mini-placar (§M3.1.2) — n_janelas, teto datado (janela confiável).
6. **Fonte linkada + tier:** `source_url` / `regulamento_url` + selo TIER 1/2. TIER 1 = corroboração
   dos **termos** (D-045), não só da existência da página.
7. **Predict da rota:** banda de probabilidade (§M3.2) — sem valor fino; "sem previsão ainda"
   quando em formação.
8. **Disclaimer OBRIGATÓRIO (regra inviolável 10):** *"Promoções podem mudar sem aviso. Confira
   sempre as regras no site oficial antes de comprar, transferir ou resgatar."*
- **Ponto NÃO aparece aqui** (é bloco de veredito/cálculo — proibido pelo guia).
- **Profundidade** = decisão nomeada §M3.6-b.

---

## M3.5 — P5 · LISTA DE CHECAGEM DE MARCA (o que a skill `tl-qa` roda na página)

`tl-qa` (`npm run qa` → `scripts/qa.mjs`) audita landing/JSON/e-mail/web e **bloqueia** regra
inviolável quebrada. Na página M3, o gate confere:

**Scan de código (`app/`, `components/` que renderizam a página):**
- [ ] **Hex hardcoded** fora de `PontoMascot.tsx`/`graphics.tsx` → **bloqueia**.
- [ ] **Cor default Tailwind** (`bg-white`, `text-white`, slate/zinc/indigo…) → **bloqueia**
  (gray/green/blue/yellow/red são tokens da marca — ok).
- [ ] **Fundo de página Paper**, nunca branco puro → **bloqueia**.
- [ ] **Disclaimer oficial** presente (footer + "Ver análise" com recomendação) → **bloqueia** se ausente.

**Conteúdo/dado da página (herda o validador de JSON + pré-superfície):**
- [ ] **Zero emoji / zero urgência artificial** ("imperdível/corra/garanta já", countdown,
  vermelho de urgência) → **bloqueia**. (Adaptação D-059: nada dos 👍🏆 do benchmark.)
- [ ] **Amarelo `#F2C94C` só como fill** com texto Ink; nunca texto amarelo → **bloqueia**.
- [ ] **green-500 nunca como texto** sobre Paper (texto verde = green-600).
- [ ] **TL Score coerente com a faixa** e **breakdown que fecha** (soma dos componentes).
- [ ] **Overrule de vigência:** sem vigência ⇒ `nao-confirmado` (nunca data suspeita — SPEC §3).
- [ ] **Fonte com URL por item** que carrega recomendação.
- [ ] **Números de análise em mono**; **serif só em título**.

**Complementos (rodar junto, D-060/D-061 + tl-source-audit):**
- [ ] **`pre-superficie.mjs`** — `vigencia_bug_ano`, `valor_sem_data`, tipo suspeito,
  `confianca_baixa_para_destaque`, `checkSanidadePercentual` → **flag para revisão** (não some
  do produto; não vira destaque).
- [ ] **`tl-source-audit`** — qualidade de fonte, cálculo e anti-cópia (redação própria, regra 2).

---

## M3.6 — P6 · TRÊS DECISÕES A NOMEAR (default reversível + recomendação)

**(a) Página inteira pública vs. histórico público + Predict gated como teaser Pro.**
- **Default (recomendado):** **histórico e ativos 100% públicos; Predict com banda de
  probabilidade pública, mas data/valor da próxima janela atrás do Pro.** Coerente com D-059 §3
  (probabilidade sempre visível = venda orgânica) e com o contrato do schema (o teaser nunca
  carrega window/value). O placar histórico é a prova de método (deve ser público, D-046); a
  previsão fina é o produto pago. **Reversível:** liberar mais/menos do Predict é mudar o corte
  de banda→valor, não a arquitetura.
- **Alternativa:** tudo público (mata o gancho de Pro) ou histórico gated (esconde a prova —
  contra D-046). Não recomendadas.

**(b) Profundidade do "Ver análise".**
- **Default (recomendado):** **profundo — os 8 blocos do §M3.4** (badge + ContaBlock + breakdown
  por componente + histórico + fonte + Predict + disclaimer). O breakdown completo É o produto
  (SPEC §6.3); cortar vira agregador. **Reversível:** começar com breakdown recolhido (accordion)
  e expandir depois é ajuste de render, não de dado.
- **Alternativa:** versão rasa (só badge + conta + fonte) para o MVP e breakdown na v2. Aceitável
  como faseamento, mas perde o diferencial de método na estreia.

**(c) Confirma a rota `/promocoes` e onde entra na Nav (`components/shell.tsx`).**
- **Default (recomendado):** **página única em `/promocoes`** (superconjunto ativos + placar +
  banco, espelhando o benchmark D-059), com **`/track-record` como âncora/redirect** para a
  seção de placar (preserva o nome cravado na SPEC §6.4 sem duplicar página). **Nav:** novo item
  **"Promoções"** entre "Método" e "Edições" no `<nav aria-label="Principal">` do `Nav()`
  (shell.tsx), alvo ≥44px, hover green-700 (padrão existente). **Reversível:** o slug e o rótulo
  de Nav trocam sem tocar dado.
- **Alternativa:** manter `/track-record` só-histórico e criar `/promocoes` só-ativos (duas
  páginas). Mais fiel à SPEC §6.4, mas fragmenta a experiência que o benchmark unifica.
- **Conflito §M3.0(1):** esta decisão resolve a divergência de nomenclatura entre SPEC §6.4 e
  D-059. **Não cravo — proponho o default e aguardo o operador.**

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de comprar,
transferir ou resgatar.*
