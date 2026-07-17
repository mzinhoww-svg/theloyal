# M2 · RESCORE-1 — DRY-RUN (D-038)

> **STATUS: DRY-RUN. NADA GRAVADO NA BASE.** O runner computou o TL Score sobre as
> 3.621 campanhas em memória, classificou os 4 baldes por programa e levantou
> anomalias por linha **e** por programa. `tl_score_bruto`/`veredito`/`override`
> **não** foram escritos. A gravação é um 2º passo, só após o operador revisar as
> anomalias abaixo. **Recomendação desta entrega: NÃO gravar ainda — corrigir a
> canonicalização dos programas sinalizados primeiro.**

Runner: `v2/M2/rescore/rescore-dryrun.mjs` · Gate de fidelidade: `v2/M2/rescore/golden-replay.mjs`
Saída-máquina: `v2/M2/rescore/out/rescore-dryrun.json` · Como rodar: `v2/M2/rescore/README.md`

**Regra-mãe cumprida (D-038):** o runner **importa** `montarEntradas` de
`v2/lib/derivacao.mjs` e `calcularScore` de `v2/lib/score.mjs` — os módulos
puros, testados, versionados. **Zero cópia, zero fork.** O runner só orquestra:
lê o dado do banco, agrupa por rota, chama as funções, coleta o resultado. Os
vetores (`score_pesos.v1`, `derivacao_config.derivacao.v1`) são **lidos do
banco**, não do código.

---

## 1. Fidelidade — 6/6 golden (engine importado reproduz a PROPOSTA §2)

`node v2/M2/rescore/golden-replay.mjs` → **6/6**. O engine importado (`score.mjs`)
reproduz **exatamente** os 6 exemplos-golden da PROPOSTA §2:

| # | caso | bruto obtido / esperado | veredito | override |
|---|---|--:|---|---|
| A | livelo→azul %115 CPM11,85 t2 | **77 / 77** | Não confirmado | sem_tier1 |
| B | bancos→smiles %70 CPM15,37 t1 | **59 / 59** | Só para casos específicos | — |
| C | itau→latampass %40 s/CPM t2 | **79 / 79** | Não confirmado | sem_tier1 |
| D | itau→latampass %25 s/CPM t2 | **37 / 37** | Não confirmado | sem_tier1 |
| E | livelo→connectmiles %40 CPM60 t2 | **44 / 44** | Não confirmado | sem_tier1 |
| F | accor→accor clube s/% s/CPM t2 | **27 / 27** | Não confirmado | conta_nao_calculavel |

Esta gate roda com os **componentes derivados congelados** na PROPOSTA §2 (que é
um snapshot do banco de 2026-07-16/17). É a prova de fidelidade do **ENGINE**,
isolada de mudança de dado. A derivação em si é coberta por `derivacao.test.mjs`
(21 verdes) e `score.test.mjs` (11 verdes) — ambos rodados nesta branch.

### 1.1 Golden **vivo** (ponta-a-ponta no banco de hoje) — drift de DADO, não de engine

Rodar os 6 golden **contra o banco atual** dá pequenas diferenças porque as rotas
**cresceram/mudaram** desde o snapshot da PROPOSTA. Isto é drift de **dado**, não
do engine (o engine já provou 6/6 acima):

| # | PROPOSTA | vivo | drift | causa |
|---|--:|--:|--:|---|
| A | 77 | **77** | 0 | rota estável no ponto do bônus |
| B | 59 | **49** | −10 | rota `multiplos_cartoes→smiles` cresceu de n=1 → **n=8**; os 70% agora são o piso da rota (percentil 0,19), não neutro 0,5 |
| C | 79 | **79** | 0 | — |
| D | 37 | **36** | −1 | rota itau→latampass 50 → 49 amostras |
| E | 44 | **44** | 0 | — |
| F | 27 | **51** | +24 | rota accor-clube encolheu → raridade subiu (0,25 → 0,65); **veredito segue Não confirmado [conta_nao_calculavel]** — muda só o bruto descartado |

**Leitura:** o veredito final só muda em **B** (Só para casos específicos →
Esperaria; ambos fora do Deal Desk). Nenhum vira/deixa de ser publicável. Mas o
drift confirma a razão da trava D-038: **o número se move com o dado; gravar sem
revisão petrifica um snapshot que já mudou.** Por isso dry-run + revisão antes.

---

## 2. Dry-run — os 4 baldes (total)

3.621 campanhas · 1.086 rotas distintas · população global de CPM n=10.

| balde | definição | n |
|---|---|--:|
| **B1** confirmar-fila | alto (bruto≥70) + conta computável + só falta TIER 1 | **293** |
| **B2** beco | `conta_nao_calculavel` (sem % e sem CPM) | **1.445** |
| **B3** TIER 1 ausente + score baixo | computável + bruto<70 + sem TIER 1 | **1.857** |
| **B4** alcançável (NÚMERO-CHAVE) | alto + computável + **alcançável pelos 4 sitemaps** (Smiles/Livelo/Esfera/TAP) | **103** |
| — já publicável | alto + computável + **tem TIER 1** hoje | **0** |

Veredito (em memória, não gravado): **3.595 Não confirmado** · 17 Só para casos
específicos · 5 Esperaria · 4 Evitaria. O domínio de "Não confirmado" é esperado:
`campanha_fontes` está **vazia** (0 linhas) → o override `sem_tier1` rebaixa quase
tudo, e 1.445 caem no beco `conta_nao_calculavel` (60% da base sem CPM e sem % —
compra/clube/acúmulo). **Isto não é bug do score; é o estado da base.**

### 2.1 O número-chave: **B4 = 103**

Dos **293** candidatos de alto valor que passariam os 2 portões assim que a fonte
TIER 1 for confirmada, só **103** são **alcançáveis pelos 4 crawlers que temos
hoje**. Os outros ~190 são altos mas ficam em programas sem adapter → não dá para
confirmar TIER 1 automaticamente. **B4 é o tamanho real do funil acionável do
próximo passo de coleta.**

**B4 por programa** (alcançável = origem OU destino ∈ {smiles, livelo, esfera, tap_milesgo}):

| programa | B4 | n total | B1 | B2 | B3 |
|---|--:|--:|--:|--:|--:|
| smiles | **42** | 415 | 42 | 122 | 242 |
| livelo | **15** | 321 | 15 | 150 | 155 |
| esfera | **14** | 140 | 14 | 52 | 74 |
| azul_fidelidade | **13** | 432 | 47 | 64 | 319 |
| latam_pass | **10** | 344 | 33 | 95 | 212 |
| accor | 3 | 107 | 9 | 26 | 72 |
| amazon | 3 | 96 | 12 | 36 | 48 |
| outro | 2 | 235 | 29 | 110 | 96 |
| connectmiles | 1 | 15 | 1 | 5 | 9 |

(`azul_fidelidade`/`latam_pass` aparecem em B4 quando a **origem** é crawlável —
ex.: livelo→azul é alcançado pelo sitemap da Livelo.)

---

## 3. Anomalias — por LINHA (D-038)

- **self-loop em transferência: 13 linhas.** origem = destino num `tipo=transferencia`
  não é rota real (transferir para si mesmo). Sinal de canonicalização torta na
  linha. Os piores (bruto alto — entrariam como candidatos se não fossem revisados):
  - `livelo-livelo-transferencia-na` → **bruto 91**
  - `loop-loop-transferencia-na` → **bruto 91** (id é literalmente um placeholder)
  - `smiles-smiles-transferencia-2024-03-31` → bruto 71
  - + 10 outras (smiles/azul/accor/avios self-transfer, bruto 41–69)
  Nenhuma é publicável hoje (todas `Não confirmado`), mas todas devem ser
  **recanonicalizadas ou descartadas** antes de gravar — self-transfer não deve
  gerar percentil de rota.
- **`sem_destino` inflando/zerando percentil: 0 linhas.** Nenhuma rota `sem_destino`
  saturou o percentil em 0/1 com base ≥10 — o `sem_destino` está diluído, não
  concentrado numa mega-rota que fabricaria percentil. Bom sinal.
- **percentil saturado (0/1) com base ≥20: 0 linhas.** Nenhuma rota grande colapsou
  para "tudo igual" nos extremos.

## 4. Anomalias — por PROGRAMA (D-038): 21 flags

Um programa inteiro com padrão suspeito = sinal de **canonicalização torta naquele
programa**, não de mercado. Três padrões apareceram:

**(a) score_identico — o sinal mais forte de torta.** Todos os computáveis do
programa saem com o **mesmo** bruto → o score não discrimina nada ali (tipicamente
todas as linhas sem histórico de percentual → percentil neutro 0,5, mesma
raridade/abrangência):
- `destino=avios` (n=12): **7 computáveis, todos bruto 65**
- `destino=disney` (n=9): 5 computáveis, todos 65
- `destino=airbnb` (n=7): 7 computáveis, todos 65

**(b) beco_quase_total — programa inteiro sem conta.** ≥90% em
`conta_nao_calculavel` (sem % e sem CPM): `destino=btg` (5/5); `origem=` elo (12/13),
emirates (11/12), sams_club (10/11), aliexpress (9/9), turkish (6/6), etihad (5/5).
Esperado para varejo/cartão sem bônus, mas confirma que **esses programas não
entram no score por valor** enquanto a coleta não trouxer % ou CPM.

**(c) destino_nunca_resolvido — canonicalização incompleta.** ≥80% das linhas do
programa (origem) têm `destino_code=sem_destino`: `outro` (141/167), `mercado_livre`
(117/137), `nike` (10/10), `disney` (6/6), `costa_cruzeiros` (6/6), `renner` (5/5),
`hoteis_com`, `british_airways`, `connectmiles`, `airbnb`, `msc`. Parte é
semanticamente correta (cashback/varejo credita no próprio lojista), mas
`mercado_livre` e `outro` em volume alto sugerem **destino não resolvido pela
canonicalização** — revisar antes de deixar essas rotas gerarem percentil.

---

## 5. Decisão pendente (gravar ou corrigir canonicalização primeiro)

**Fidelidade: OK (6/6).** O engine é fiel; o runner importa o JS testado; a
derivação lê o vetor do banco (com raridade n=1 tetada em 0,85, D-037).

**Recomendação: NÃO gravar `tl_score_bruto` ainda.** Aparecem **21 anomalias por
programa** e **13 self-loops de transferência** — exatamente a classe de
canonicalização torta que a trava D-038 existe para pegar antes da gravação. Gravar
agora petrificaria:
1. self-transfers (`livelo→livelo`, `loop→loop`) com bruto 91;
2. destinos de score uniforme (avios/disney/airbnb todos 65) que não discriminam;
3. rotas com `destino=sem_destino` mal resolvido (mercado_livre/outro) gerando
   percentil sobre populações heterogêneas.

**Próximo passo proposto ao operador:** (i) recanonicalizar/descartar os 13
self-loops de transferência; (ii) resolver `sem_destino` dominante em
`mercado_livre`/`outro`; (iii) revisar os destinos de score uniforme; (iv) re-rodar
este mesmo dry-run; (v) só então habilitar o 2º passo de **gravação** (fora desta
entrega). B4=103 é o funil acionável que a coleta TIER 1 deve mirar.

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
