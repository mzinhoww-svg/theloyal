# M2 · Vetor de DERIVAÇÃO — PROPOSTA a aprovar (D-032)

> **STATUS: PROPOSTA. NÃO APLICADA. NÃO houve re-score em escala.**
> Este documento propõe o **vetor de derivação** — as escolhas de normalização e
> limiares que transformam o dado bruto de uma campanha em cada componente ∈ [0,1]
> que o engine (`score.mjs`) consome. Mesma disciplina do vetor de pesos
> (`score_pesos.v1`): **o operador aprova antes do re-score**, porque derivação
> errada envenena todo o score por baixo. A camada (código + testes) está pronta
> e verde; falta só o **OK ao vetor**. Depois disso é que a varredura de re-score
> muta as 3.610 campanhas — **fora do escopo desta entrega**.

Código: `v2/lib/derivacao.mjs` (puro, `DERIVACAO_V1`) · Testes: `v2/lib/derivacao.test.mjs`
(20 verdes) · Tabela opcional: `v2/db/migrations/009_derivacao_config.sql` (aditiva, **não aplicada**).

---

## 0. Por que a derivação precisa do seu OK (o achado que muda tudo)

Inspeção **read-only** do banco (`campaigns`, 3.621 linhas) — nada mutado:

| sinal | preenchido | leitura |
|---|--:|---|
| `percentual` (bônus) | **2.175 / 3.621** (60%) | sinal de percentil viável na maioria |
| `cpm_value` | **10 / 3.621** (0,3%) | eficiência quase sempre AUSENTE hoje |
| `tl_score` | 11 / 3.621 | confirma: a base nunca foi scorada (D-007) |

**Consequência direta para o vetor:** na base atual a **eficiência derivará para
`null` em ~99% das campanhas** → o engine **redistribui** o peso 0,30 para os
presentes (§2.1). Isso NÃO é bug: é a fronteira D-024 funcionando (faltar CPM ≠
"conta não calculável"; só é beco quando falta percentil **E** eficiência). O
re-score em escala vai reconstruir CPM/VPM para muito mais linhas — mas **isso é a
slice de re-score, não a derivação**. A derivação só precisa normalizar CPM
**quando ele existe**, e não afundar quem não tem.

### 0.1 O achado que trava o desenho do percentil

`percentual` **não é comparável entre rotas**. Distribuição global de `percentual`
(n=2.175): `p10=10 · p25=20 · p50=33 · p75=80 · p90=300 · p99=12.260 · max=120.000`.
Os valores gigantes não são "bônus de 12.260%": são semânticas diferentes
misturadas na mesma coluna (compra de pontos, clube, acúmulo). **Um percentil
global seria lixo.** Por isso o percentil é medido **dentro da MESMA rota**
(`tipo|origem|destino|público`) — um bônus de 40% numa rota cuja mediana é 30%
é forte; o mesmo 40% numa rota de mediana 110% é fraco. Só o histórico da rota
dá esse contraste. **Este é o núcleo da proposta.**

---

## 1. O vetor proposto (`DERIVACAO_V1`)

### (a) Eficiência — normalização do CPM
- **Método:** ECDF-inverso contra a distribuição de referência de CPM.
  `eficiencia = 1 − percentil_do_cpm_na_população`. Menor CPM → eficiência maior.
- **Por que ECDF e não min-max:** a população de CPM tem cauda
  (`min 11,85 · p50 28,97 · p95 48,75 · max 60,00`). Min-max ancoraria tudo no teto
  e comprimiria o meio; o ECDF é robusto a outlier e dá contraste onde a massa está.
- **Ausente → `null`** (CPM não-finito ou ≤ 0). Nunca vira zero que afunda (§2.1).
- **DÚVIDA PARA O OPERADOR (janela/população):** contra **qual** população
  normalizar? Hoje só há 10 CPMs, então a proposta usa `cpm-populacao-global`. Mas
  um milheiro Smiles vale diferente de um Livelo → "bom CPM" é relativo ao
  **programa de destino**. Proposta: **global agora** (dado fino demais), migrar
  para **baseline por família de destino** quando o re-score encher a coluna.
  **Decida:** global v1 aceitável como ponte, ou já exigir por-programa?

### (b) Raridade — limiares de bucket por frequência da rota
Ancorados na distribuição real de tamanho de rota (1.637 rotas distintas):

| freq. da rota (n) | rotas | bucket → valor | leitura |
|---|--:|--:|---|
| 1 | 1.300 | **1,00** | ocorrência única — mais rara |
| 2 | 148 | **0,85** | |
| 3–5 | 106 | **0,65** | |
| 6–20 | 58 | **0,45** | |
| 21–50 | 19 | **0,25** | |
| 50+ | 6 | **0,10** | recorrente (livelo→azul, itau→latam…) — comum |

- **DÚVIDA PARA O OPERADOR (rara boa vs ruído):** 1.300 rotas têm n=1. Parte é
  raridade genuína ("100% raro > 100% mensal", SPEC §2.2); parte é **cauda de
  extração / rota nova** que ainda não repetiu. Dar 1,00 a toda rota n=1 pode
  **premiar ruído**. Alternativas: (i) manter (raridade pesa só 0,15 e o percentil
  de base curta é amortizado, então o dano é contido); (ii) **teto de 0,85 para
  n=1** até a rota provar recorrência; (iii) raridade sobre **frequência temporal**
  (quantas vezes/ano), não contagem de snapshot. **Decida o tratamento de n=1.**

### (c) Percentil — janela do histórico e min_samples
- **Janela:** `rota-total` — todo o histórico da própria rota (a campanha incluída),
  ECDF por **midrank** (empates caem no meio, não no topo).
- **`min_samples = 3`** — **alinhado a `score_pesos.v1`**. `base_n < 3` marca
  `base_curta=true`; o engine amortece para 0,5 (não finge percentil cheio, §2).
- Tem `%` mas rota sem histórico → **presente porém neutro** (0,5, `base_n=0`):
  sabemos que há bônus, mas não dá para rankear → o engine puxa tudo a 0,5.
- **DÚVIDA PARA O OPERADOR (janela temporal):** o SPEC §2 cita "janela (ex.: 18m)".
  A proposta usa **rota-total** (sem corte temporal) porque a base é um snapshot e
  cortar por data hoje esvaziaria rotas legítimas. **Decida:** rota-total v1, ou já
  aplicar janela deslizante (ex.: 18m) para não comparar bônus de 2024 com 2026?

### (d) Abrangência — mapa público → [0,1]
`geral 1,0 · cartão 0,6 · selecionados 0,45 · clube 0,3`. Público vem do
`resolverPublico` do M1 (`identidade.mjs`). Ajuste fino (peso 0,10). Público fora
do mapa → `null` (redistribui). **DÚVIDA menor:** os passos (1,0 / 0,6 / 0,45 / 0,3)
são defensáveis mas arbitrários — confortável travar assim?

---

## 2. Exemplos reais ponta a ponta (derivação → `calcularScore` com `score_pesos.v1`)

Rodados com dados **lidos do banco** (histórico real de cada rota + os 10 CPMs
reais). O engine (`score.mjs`) veio da slice 4 (branch do engine); **nada foi
gravado**. `*` = base curta (amortizado). Pesos v1: `0,45 / 0,30 / 0,15 / 0,10`.

| # | campanha (real) | componentes derivados | bruto | veredito final |
|---|---|---|--:|---|
| A | livelo→azul transf · %115 · CPM 11,85 · t2 | perc **0,8125** (n40) · efic **0,95** (n10) · rar 0,25 · abr 1,0 | **77** *Vale olhar* | **Não confirmado** `[sem_tier1]` |
| B | bancos→smiles transf · %70 · CPM 15,37 · **t1** | perc **0,5*** (n1) · efic **0,75** (n10) · rar 0,25 · abr 1,0 | **59** | **Só para casos específicos** |
| C | itau→latampass transf · %40 · **sem CPM** · t2 | perc **0,96** (n50) · rar 0,25 · abr 1,0 | **79** *Vale olhar* | **Não confirmado** `[sem_tier1]` |
| D | itau→latampass transf · %25 · **sem CPM** · t2 | perc **0,25** (n50) · rar 0,25 · abr 1,0 | **37** *Evitaria* | **Não confirmado** `[sem_tier1]` |
| E | livelo→connectmiles transf · %40 · CPM 60 · t2 (rota rara n=3) | perc **0,5** (n3) · efic **0,05** (n10) · rar **0,65** · abr 1,0 | **44** *Esperaria* | **Não confirmado** `[sem_tier1]` |
| F | accor→accor clube · **sem %** · **sem CPM** · t2 | rar 0,25 · abr 0,3 (**sem percentil, sem eficiência**) | 27 | **Não confirmado** `[conta_nao_calculavel]` |

**O que cada caso prova:**
- **A** — bônus alto na rota (p81) + melhor CPM da base → 77 bruto; só o `sem_tier1`
  segura (t2). Exatamente a "fila de candidatos a confirmar" da estrada (§4).
- **B** — o **único t1**: passa direto sem override. Percentil neutro (rota de 1
  amostra, `base_curta`) não infla — a eficiência boa carrega o 59.
- **C vs D** — mesma rota, mesmo tudo, **só o bônus muda** (40% vs 25%): 79 vs 37.
  É o percentil-por-rota fazendo o trabalho. CPM ausente **redistribuiu** (peso
  0,30 sumiu, não afundou) — a fronteira §2.1 na prática.
- **E** — a fronteira ao contrário: **tem CPM (péssimo, 0,05) e tem percentil** →
  conta calculável, cai para *Esperaria* pelo mérito, **não** vira
  `conta_nao_calculavel`. Raridade 0,65 (rota rara) segura um pouco.
- **F** — **sem % e sem CPM**: raridade+abrangência descrevem a rota mas **não dão
  veredito de valor** → `conta_nao_calculavel` vence `sem_tier1` (D-024). O beco.

---

## 3. Tabela vs JSON no repo — recomendação

Recomendo **versionar em tabela** (`derivacao_config`, migration 009, **não
aplicada**), **por simetria com `score_pesos`**: o re-score em escala lê o vetor do
banco, e o breakdown de cada score pode referenciar `versao_derivacao` para o score
continuar explicável após recalibração — a mesma razão que pôs os pesos numa tabela
(accuracy loop sem deploy, D-022). A fonte de verdade do **código** segue sendo
`DERIVACAO_V1` em `derivacao.mjs`; a linha da tabela **espelha** o objeto.

Se o operador preferir **adiar a tabela**, o `DERIVACAO_V1` code-versionado
**basta para v1** (o engine também mantém régua/componentes em código, só os pesos
em tabela). Nesse caso: não aplicar a 009 e tratar o vetor como constante de código
até o accuracy loop pedir recalibração fora de deploy. **Deixo a 009 pronta e
inerte para o operador decidir.** Ponto de coordenação registrado: gravar
`versao_derivacao` em `tl_breakdown` (migration 006, slice 4) fecha a auditoria
ponta a ponta — não aplicado aqui.

---

## 4. Decisões que aguardam o operador (resumo)

1. **CPM — população de normalização:** global v1 (ponte) **ou** já por família de
   destino? (§1a)
2. **Raridade n=1:** manter 1,00, tetar em 0,85, ou migrar para frequência
   temporal? 1.300 rotas dependem disto. (§1b)
3. **Percentil — janela:** rota-total **ou** janela deslizante (ex.: 18m)? (§1c)
4. **Abrangência:** travar `1,0 / 0,6 / 0,45 / 0,3`? (§1d)
5. **Versionamento:** aplicar `derivacao_config` (009) **ou** manter só o
   `DERIVACAO_V1` em código por ora? (§3)

**Enquanto estas 5 não forem respondidas, PARO no vetor.** O re-score em escala
(mutar as 3.610) só depois do OK — mesma trava do vetor de pesos.
