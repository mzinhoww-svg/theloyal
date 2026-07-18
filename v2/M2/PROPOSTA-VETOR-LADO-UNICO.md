# M2 · Vetor de derivação LADO-ÚNICO — PROPOSTA a aprovar (D-042, SPEC Parte B)

> **STATUS: PROPOSTA. NÃO APLICADA. NENHUM re-score. NADA gravado em prod.**
> Resolve a dívida **D-042** ("derivação de lado-único no score — como shopping/
> acúmulo/compra pontua **sem rota**"). Mesma disciplina do vetor de pesos e do
> vetor de derivação geral: **o operador aprova o vetor ANTES de re-scorar os
> 1.220** `sem_destino` — derivação errada envenena 1.220 linhas. A camada (código
> + testes) está pronta e verde; falta só o **OK ao vetor**. O re-score em escala
> fica **fora** desta entrega.
>
> **Ortogonal à Parte A** (coleta/TIER 1): esta frente **não toca fonte**, só score.
>
> Código: `v2/lib/lado-unico.mjs` (puro, `LADO_UNICO_V1`, **não ligado ao re-score**)
> · Testes: `v2/lib/lado-unico.test.mjs` (12 verdes, `node --test`).

---

## 0. O que é lado-único e por que o score dele é semi-artificial

**Lado-único** = `destino_code='sem_destino'`, `lado_unico=true`: compra/acúmulo/
shopping/clube de **um lado só** (comprar pontos Livelo, acumular no Mercado Livre,
abastecer na Shell, cruzeiro Costa…). **1.220 itens** na base sã — todos
`lado_unico=true`, zero transferência com destino perdido (o M1 separou certo,
D-040). Não têm destino → **não têm rota** → não têm "percentil-de-rota".

Diagnóstico read-only do banco (nada mutado). Composição dos 1.220:

| corte | n | leitura |
|---|--:|---|
| por tipo | compra 818 · hotelaria 111 · cartão 100 · estrutural 85 · clube 85 · resto 21 | dominado por **compra de pontos** |
| com `percentual` | **596 / 1.220** | metade tem bônus; a outra metade é acúmulo sem % |
| com `cpm_value` | **1 / 1.220** | eficiência praticamente **sempre ausente** (acúmulo não compra milheiro) |
| override atual | `conta_nao_calculavel` 624 · `sem_tier1` 591 · nenhum 5 | **todos** terminam **Não confirmado** (nenhum publica hoje) |
| rotas finas distintas | **337** (`tipo\|origem\|sem_destino\|público`) | rota fina demais → base curta |

### 0.1 De onde vem o "65 semi-artificial" (os dois artefatos, medidos)

A derivação geral (`derivacao.mjs`) mede o percentil do bônus contra o histórico da
**mesma rota** `tipo|origem|destino|público`. Para lado-único o destino é sempre
`sem_destino`, então a "rota" vira `tipo|origem|sem_destino|público` — **tão fina
que o bônus não consegue discriminar**:

- **Artefato 1 — a banda 65 (rota única neutraliza o bônus).** **79 itens** pontuam
  **exatamente 65**. Desses, **49 são rota de um item só** (`n=1`): o percentil de
  uma amostra de 1 é 0,5 por definição, o engine amortece para 0,5, o CPM está cego
  → o **tamanho do bônus some da conta**. A média de `percentual` desses 79 é
  **1.304%** e **todos dão 65** — um bônus de 6% e um de 1.800% caem no mesmo lugar.
  Isso é o mesmo "ponto fixo de derivação" do sintoma 3 de D-040, agora localizado.
- **Artefato 2 — o bruto inflado dos itens sem bônus (raridade da rota fina).** Os
  **624** itens sem `%` e sem CPM disparam `conta_nao_calculavel` (correto → Não
  confirmado). Mas o `tl_score_bruto` deles vem **só de raridade + abrangência**, e
  a raridade hoje é medida na **rota fina**: quase toda rota lado-única é `n=1` →
  raridade 0,85 → um shopping **sem nenhum dado de valor** ganha bruto **69–91**. Ex.
  real: `amazon compra selecionados` sem % → **bruto 69**; `visa hotelaria` sem % →
  **bruto 91**. É bruto sem lastro. Fica escondido pelo override hoje, mas **envenena
  o ranking / track-record (D-046) e o corte de valor ≥70 da Parte C**.

**A regra-mãe (SPEC Parte B / D-042):** não inventar percentil-de-rota onde não há
rota. Ranquear o bônus contra a **população do mesmo tipo+merchant** (a classe de
comparação natural do lado-único), não contra uma rota inexistente. Sem população
defensável → **neutro sinalizado**, nunca fabricado (INV-03). É o mesmo princípio
que **rejeitou o bônus-absoluto em D-042/c2** — ver §2.1.

---

## 1. O vetor proposto (`LADO_UNICO_V1`)

Quatro componentes no mesmo shape que `calcularScore` consome (o **engine é
intacto** — INV-12; só a **derivação** muda). Ausente → `null` → o engine
**redistribui** (D-024), nunca zero que afunda.

### (a) Percentil — o bônus contra a população do MESMO tipo+merchant *(o núcleo)*
- **Classe de comparação = `tipo|origem_code` (merchant)**, ECDF-midrank do bônus
  contra **todas as ofertas daquele merchant naquele tipo**, cruzando público
  (compra-Livelo ranqueia entre compras-Livelo; acúmulo-ML entre acúmulos-ML). É a
  escala de valor coerente do lado-único: os pontos acumulados são da **mesma moeda**
  do merchant, então comparar bônus dentro dela é like-with-like.
- **Cobertura medida (n=596 com %):** `merchant` (pop ≥ 3) cobre **497**; fallback
  `tipo` **96**; `neutro` **3**. Ou seja **83%** ganham uma população de merchant
  defensável — contra os **24%** que a rota fina jogava em base curta hoje.
- **Sem população de merchant (pop < 3):** fallback opcional para a população do
  **tipo inteiro** (cross-merchant) — **sinal fraco**, exige barra maior
  (`min_tipo=8`) E entra **marcado `base_curta`** para o engine **amortecer parte do
  peso** (não dar crédito cheio a um ranqueio misto). Ver a decisão do operador em §4.1.
- **Sem tipo defensável tampouco → NEUTRO (0,5, `base_n=0`)**, não fabricado: o
  engine puxa integralmente para 0,5. "Faltou referência → classifica" (INV-03).
- **Sem `%` → `null`**: sem sinal de valor. Se também não há CPM, o engine dispara
  `conta_nao_calculavel` → Não confirmado (inalterado).

### (b) Eficiência — CPM (idêntica à derivação geral)
- ECDF-inverso do `cpm_value` (menor CPM = melhor valor). **Ausente → `null` →
  redistribui** (D-024). Hoje **cego** no lado-único (1/1.220 tem CPM).
- **Rota de crescimento honesta (D-039):** quando o extrator de preço de
  `compra_pontos` encher `cpm_value` (a maior fatia do lado-único é compra), a
  **eficiência vira o eixo de valor real** e o percentil-de-bônus passa a
  secundário — a mesma história do re-score-2 para transferência, sem mudar o vetor.

### (c) Raridade — por frequência do MERCHANT (não da rota fina)
- No lado-único não existe "frequência de rota". Usa a **frequência do merchant no
  tipo** (quantas vezes o merchant roda esse tipo de oferta): merchant que roda
  compra todo mês é **comum**; oferta de merchant de uma vez só é **rara**. Mesmos
  buckets de D-037 (n=1→0,85 … 50+→0,10), keyados no merchant.
- **Corrige o Artefato 2 de quebra:** um `amazon compra` sem % agora é *comum*
  (freq 41 → raridade 0,10), não *raro* (0,85). O bruto sem lastro desce ao pé.

### (d) Abrangência — mapa público → [0,1] (idêntica à geral, D-037)
`geral 1,0 · cartão 0,6 · selecionados 0,45 · clube 0,3`. Ajuste fino (peso 0,10).
Fora do mapa → `null` (redistribui).

---

## 2. Por que isto NÃO é o bônus-absoluto rejeitado em D-042/c2

D-042/c2 rejeitou comparar **40% de uma rota de transferência contra 40% de outra**
— porque destinos diferentes têm **moedas de valor diferentes** (p50 numa rota =
p99 noutra), então o número absoluto engana. **Aqui não há destino:** o bônus de
compra-Livelo é ranqueado **só entre bônus de compra-Livelo** — mesmo contexto de
aquisição, mesma moeda, mesma escala. É comparação **like-with-like dentro do
merchant**, não cross-rota. O teste `percentil merchant: o MESMO % ranqueia DIFERENTE
em merchants diferentes` trava exatamente isso.

**O resquício do risco c2 mora só no fallback por-tipo** (cross-merchant). Por isso
ele é **sinal fraco, amortecido e opcional** — a decisão §4.1.

---

## 3. Preview — 10 itens `sem_destino` reais (HOJE = valor gravado no banco vs PROPOSTA)

Calculado **em memória** com o engine e os pesos v1 do banco, sobre a base sã real.
**Nada gravado.** `HOJE` = `tl_score_bruto`/`veredito_bruto`/override gravados
(re-score-2). `pop` = fonte do percentil na proposta.

| # | item (tipo\|merchant\|público) | % | pop merchant | HOJE | PROPOSTA | por quê |
|---|---|--:|--:|---|---|---|
| 1 | compra·hopihari·selecionados | 99 | 90 | **52** Esperaria | **67** Só p/ casos `[merchant]` | 99% é alto na pop. do merchant (antes: rota fina neutralizava) |
| 2 | compra·mercado_livre·selecionados | 40 | 112 | **61** Só p/ casos | **68** Só p/ casos `[merchant]` | ranqueia contra as 112 compras-ML, não a rota fina de selecionados |
| 3 | compra·livelo·geral | 1800 | 54 | **77** Vale olhar | **77** Vale olhar `[merchant]` | já discriminava (rota geral ≈ merchant) → **estável** |
| 4 | compra·livelo·geral | 6 | 54 | **28** Evitaria | **28** Evitaria `[merchant]` | bônus baixo continua no pé — o percentil funciona nos dois sentidos |
| 5 | compra·lifemiles·geral | 165 | 8 | **71** Vale olhar | **71** Vale olhar `[merchant]` | estável |
| 6 | clube·latam_pass·clube | 70 | 15 | **65** Só p/ casos | **65** Só p/ casos `[merchant]` | 70% ≈ mediana do clube-LATAM → neutro **honesto**, não artefato |
| 7 | estrutural·xbox·geral | 35 | **1** | **65** Só p/ casos | **70** Vale olhar `[tipo]` | **caso-limite**: merchant de 1 oferta → fallback cross-merchant **cruza banda** (§4.1) |
| 8 | compra·amazon·selecionados | *(sem %)* | 41 | **69** Só p/ casos `[conta_nao_calc]` | **33** Evitaria `[conta_nao_calc]` | Artefato 2: raridade agora por merchant (amazon é comum) → desinflaciona o bruto |
| 9 | compra·azul_fidelidade·selecionados | *(sem %)* | 70 | **69** Só p/ casos `[conta_nao_calc]` | **24** Evitaria `[conta_nao_calc]` | idem — bruto sem lastro cai ao pé (segue Não confirmado) |
| 10 | compra·shopee·cartão | *(sem %)* | 13 | **75** Vale olhar `[conta_nao_calc]` | **51** Esperaria `[conta_nao_calc]` | idem — parava de mostrar 75 sem nenhum dado de valor |

Leitura: **onde já havia população boa (3, 5), o score é estável** — a proposta não
mexe no que já estava certo. Onde a rota fina **neutralizava um bônus real (1, 2)**,
o valor aparece. Onde o bruto era **inflado sem dado (8, 9, 10)**, ele desce (o
veredito final segue Não confirmado — muda o número interno, não a publicação). O
**caso 7 é o alerta**: o fallback cross-merchant pode empurrar um item de merchant-
único para uma banda acima — decisão §4.1.

---

## 4. Efeito agregado nos 1.220 (em memória, sem gravar)

| métrica | valor |
|---|---|
| bruto: sobe / desce / igual | **97 / 108 / 1.015** |
| origem do percentil na proposta | merchant **497** · tipo **96** · neutro **3** · sem-% (null) **624** |
| override (final) HOJE vs PROPOSTA | `sem_tier1` 591 / `conta_nao_calculavel` 624 / nenhum 5 — **inalterado** |
| banda 65 (exatos) que saem de 65 | **54 de 79** |
| corte de valor ≥70 **e** computável (fila Parte C) | HOJE **116** → PROPOSTA **118** (entram 6, saem 4) |
| fidelidade da reconstrução do "HOJE" | sem_destino **1.220/1.220** exato; base inteira 3.279/3.330 (os 51 são `transferencia` off-by-1 de arredondamento de CPM, **não** lado-único) |

**Interpretação honesta:** o movimento é **modesto e localizado** (1.015 de 1.220
não mudam de bruto). O motivo é um achado que vale registrar: o re-score-2 **já não
estava tão quebrado** para lado-único quanto D-042 temia — a rota `tipo|origem|
sem_destino|geral` **já aproximava** a população de merchant no caso `geral`
dominante. O ganho real da proposta é (i) **desneutralizar ~54 itens de rota fina**
(o "65 semi-artificial" de fato), (ii) **desinflacionar o bruto dos 624 sem dado**
(honestidade de ranking/track-record e do corte de valor), e (iii) dar ao lado-único
um **vetor próprio versionado** em vez de tomar emprestada a rota geral por acidente.
Isso **muda 6 entradas/4 saídas na fila da Parte C** — não é cosmético.

**Overrides não mudam:** nenhum `sem_destino` vira publicável por esta mudança —
todos seguem `sem_tier1` ou `conta_nao_calculavel` (Não confirmado). A proposta
corrige **o número**, não o portão. TIER 1 e vigência continuam mandando (D-044).

---

## 5. Decisões que aguardam o operador

### 4.1 — Fallback por-tipo (cross-merchant): LIGADO ou DESLIGADO? *(a principal)*
96 itens têm merchant fino demais (pop < 3). Duas posturas:
- **`fallback_tipo=true` (default no código):** ranqueia contra o tipo inteiro,
  amortecido. Dá discriminação a mais 96 itens — mas é o **resquício do risco c2**
  (cross-merchant). Medido: difere de "desligado" em 90 itens; **5 deles cruzam UM
  para a banda "Vale olhar"** por sinal fraco (o caso 7, `xbox`).
- **`fallback_tipo=false` (recomendado):** merchant fino → **neutro sinalizado**.
  Mais neutros honestos, zero cross-merchant. É a leitura **mais conservadora e mais
  fiel a INV-03/D-042** — o mesmo espírito de "faltou referência → classifica".
- **Recomendo `false`.** O ganho estrutural mora nos 497 `merchant`; os 96 do tipo
  são exatamente onde a comparação fica cinza. **Decida:** ligar o fallback (mais
  cobertura, algum risco c2) ou deixá-lo neutro (conservador)?

### 4.2 — Raridade por merchant: buckets de D-037 servem?
Reuso os limiares aprovados em D-037 (n=1→0,85 … 50+→0,10), só troco a chave (rota
fina → frequência do merchant). **Confortável travar assim**, ou o lado-único pede
buckets próprios (ex.: acúmulo de shopping é intrinsecamente recorrente)?

### 4.3 — `min_merchant` / `min_tipo`
`min_merchant=3` (alinhado a `score_pesos.min_samples`) e `min_tipo=8` (barra maior
p/ o cross-merchant). Travar, ou calibrar?

### 4.4 — Bruto dos `conta_nao_calculavel`: desinflar (proposta) ou zerar/omitir?
A proposta **baixa** o bruto sem lastro (69→24 etc.), mas ainda calcula um número de
raridade+abrangência. Alternativa mais radical: para `conta_nao_calculavel`, **não
publicar bruto** (é descritor, não valor). **Decida** se o bruto desinflado basta ou
se prefere marcá-lo como não-valor no track-record (D-046).

### 4.5 — Versionamento: tabela `derivacao_config` ou constante de código?
Recomendo **espelhar em `derivacao_config`** uma linha `lado_unico.v1` (simetria com
`derivacao.v1`), para o re-score ler o vetor do banco e o breakdown referenciá-lo.
Deixo a decisão junto com a 009 existente — **nenhuma migration aplicada aqui.**

---

## 6. O que está pronto (e o que explicitamente NÃO foi feito)

- **Pronto:** `v2/lib/lado-unico.mjs` (função pura `derivarLadoUnico` /
  `montarEntradasLadoUnico`, vetor `LADO_UNICO_V1`) + `v2/lib/lado-unico.test.mjs`
  (12 testes verdes). **Não importado por nenhum runner de re-score.**
- **NÃO feito (aguarda OK):** re-score dos 1.220; qualquer `UPDATE` em `campaigns`;
  qualquer migration; qualquer toque em fonte/TIER 1 (Parte A). **Nada em prod.**

**Enquanto §4.1–4.5 não forem respondidas, PARO no vetor.** O re-score em escala só
depois do OK — mesma trava do vetor de pesos e do vetor de derivação geral (D-032/
D-037/D-038). Derivação errada envenena 1.220 linhas.

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
