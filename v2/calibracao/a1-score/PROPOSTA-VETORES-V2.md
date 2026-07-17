# A1 · Proposta de vetores v2 (mede-e-propõe, D-051)

> **Portão (D-051):** movimento que muda a régua pública é **gated** — o operador
> aprova **por vetor** ANTES de qualquer escrita em `score_pesos`/`derivacao_config`.
> Este documento **para** no vetor. Nada foi gravado. Medições: `DISTRIBUICAO-MEDIDA.md`,
> `sensibilidade.json`.

## Veredito de uma linha

**`score_pesos.v1` (os quatro pesos): MANTER.** **`derivacao.v1` (buckets de raridade,
mapa de abrangência): MANTER.** Nenhum movimento de peso ou bucket ganha discriminação
real — só **realoca a pilha neutra** (cosmético) e fabricaria sinal onde não há conta
(viola D-042/INV-03). O único parâmetro com ganho **não-cosmético** medido é a força de
amortização **`shrink_k` (5 → 3)**, e mesmo esse é modesto e **gated** — vai à mesa como
**opção medida**, não como recomendação de mudar.

---

## 1. Pesos `score_pesos.v1` — MANTER (rejeição medida de todo movimento)

**Motivação medida.** A pilha em 65 (286, 14,3%) e a banda neutra (55,9%) são **100%
CPM-cegas, 84% base-curta, 96% público geral** (`DISTRIBUICAO-MEDIDA.md` §2). O que as
neutraliza é a **ausência de conta** (sem CPM, sem rota) — não os pesos. Movimento de peso
não cria conta; só muda **para onde** a pilha vai.

Varredura de candidatos (`sensibilidade.mjs`, lente computáveis n≈1.996 · CPM vivo):

| Candidato | mediana | IQR | σ | distintos | **entropia (bits)** | em 65 |
|---|---|---|---|---|---|---|
| **v1 (baseline)** | 60 | 15 | 11,93 | 61 | **5,273** | 14,3% |
| percentil 0,50 · efic 0,25 | 60 | 15 | 12,14 | 61 | 5,253 | 3,0% |
| efic 0,35 · percentil 0,40 | 61 | 15 | 11,75 | 59 | 5,254 | 3,8% |
| raridade 0,20 · abr 0,05 | 58 | 17 | 12,54 | 64 | 5,246 | 2,1% |
| raridade 0,10 · percentil 0,50 | 62 | 16 | 12,78 | 65 | 5,365 | 1,6% |

**Antes → depois (o que cada movimento realmente faz):** todos derrubam `em 65` para
~2–4% — **mas a entropia (poder real de discriminação) fica praticamente parada** (5,27 →
5,25/5,25/5,25/5,37) e a **banda neutra 55–69 continua ~51–55%**. Ou seja: o movimento
**não separa** os itens — ele só **desloca o ponto fixo** de 65 para um vizinho (58, 62…).
É precisamente o "número inventado que discrimina errado" que **D-042 rejeita**: 40% de uma
rota comparado a 40% de outra, sinal fabricado. `raridade 0,20` chega a **piorar** a
entropia (5,246) e baixar a mediana para 58 premiando rota vista uma única vez (ruído de
cobertura, contra D-037).

**Conclusão.** Nenhum vetor de peso domina o v1 em discriminação honesta. **MANTER v1.**
O confirmável já discrimina bem sob v1 (IQR 41–66, 37 valores distintos, só 28,7% na banda
— `DISTRIBUICAO-MEDIDA.md` §3). O gargalo é **cobertura de CPM (4,9%)**, endereçada pela
frente de cobertura de fontes, não pelo vetor.

**Nota de golden.** Manter v1 **não** mexe em nenhum golden. `golden-replay` (79/37/77/59/
44/27) e os 6 casos A–F seguem travando o comportamento atual.

---

## 2. `shrink_k` 5 → 3 — OPÇÃO medida (gated), não recomendação

**Motivação medida.** `shrink_k` só age em itens que **já têm base_n ≥ min_samples=3** —
isto é, rota com histórico real. Ali, amortecer não é anti-fabricação (o item tem base);
`shrink_k=5` com `min_samples=3` ainda puxa forte uma rota que acabou de qualificar
(base_n=3 → `(3p+2,5)/8`). Baixar para 3 solta esse sinal legítimo **sem** tocar a
base-curta (que continua sinalizada e amortizada a 0,5).

Antes → depois (`sensibilidade.json`):

| Lente | métrica | shrink_k=5 (v1) | **shrink_k=3** | shrink_k=2 | shrink_k=8 |
|---|---|---|---|---|---|
| **base-suficiente** (n=1.580) | IQR | 19 | **21** | 22 | 18 |
| | desvio | 12,84 | **13,76** | 14,41 | 11,87 |
| | banda 55–69 | 44,6% | **40,4%** | 37,7% | 49,6% |
| | distintos | 61 | **64** | 65 | 59 |
| **confirmável** (n=164) | IQR | 25 | **26** | 26 | 24 |
| | distintos | 37 | **41** | 39 | 40 |
| | desvio | 14,68 | **15,27** | 15,58 | 14,05 |
| computáveis (n≈1.996) | em 65 | 14,3% | 13,8% | 13,3% | 13,6% |
| | entropia | 5,273 | 5,308 | 5,359 | 5,163 |

**Diferença deste movimento vs os de peso:** aqui a entropia **sobe** (5,273 → 5,308) e a
banda neutra **cai** (44,6% → 40,4%) **no conjunto com base real** — ganho não-cosmético,
porque só afeta itens com histórico ≥ 3. A base-curta e a pilha do §2 permanecem neutras
(em 65 mal se move: 14,3 → 13,8%). `shrink_k=2` estende um pouco mais o efeito; `shrink_k=8`
piora (mais amortização).

**Por que é gated e não livre.** Baixar `shrink_k` **abre** a distribuição para longe do
neutro — alguns itens sobem de 65 para ≥70 ("Vale olhar"). É movimento que **aumenta a
propensão a pontuar alto** → gate do operador (D-051). O ganho é **modesto** (IQR +2,
entropia +0,035) e nenhum item novo vira publicável hoje (0 TIER 1 + alto permanece).

**Recomendação honesta.** Este é o **único** parâmetro com ganho real na mesa, mas o ganho
é pequeno e o v1 é saudável. Vai como **opção** para o operador decidir se o ganho de
separação no conjunto com base justifica versionar. **Meu voto:** aceitável manter v1;
se mover, `shrink_k=3` é o alvo (não 2 — retorno decrescente e mais risco).

**Nota de golden (trava obrigatória se aprovado).** `shrink_k` entra na amortização, então
mudar 5→3 **altera 2 dos 6 golden** (rodado no engine importado, valores exatos):

| Golden | componentes | bruto @ shrink_k=5 | bruto @ shrink_k=3 |
|---|---|---|---|
| **A** (livelo→azul %115) | percentil 0,8125 · base_n 40 | 77 | **78** |
| **C** (itau→latam %40) | percentil 0,96 · base_n 50 | 79 | **80** |
| D (itau→latam %25) | percentil 0,25 · base_n 50 | 37 | 37 (inalterado) |
| B, E (percentil 0,5) | base_n 1 / 3 | 59 / 44 | 59 / 44 (0,5 é ponto fixo da amortização) |
| F (sem percentil) | — | 27 | 27 (inalterado) |

Só **A e C** driftam (+1 cada; percentil alto em base grande é onde a amortização mais
solta). Aprovar `shrink_k=3` exige **re-congelar A (77→78) e C (79→80)** sob um novo bloco
`PESOS_V2` em `golden-replay.mjs` (disciplina D-022/D-032: recalibrar = nova versão + novo
golden). Sem esse re-freeze, a gate de fidelidade travaria o próprio re-score. Valores
acima rodados no engine importado (`score.mjs`), não estimados à mão.

---

## 3. `derivacao.v1` — buckets de raridade e mapa de abrangência: MANTER

**Raridade.** Os 6 buckets são materialmente povoados (20,8 / 9,2 / 12,1 / 18,3 / 19,0 /
20,6% — `DISTRIBUICAO-MEDIDA.md` §6); nenhum bucket morto, cortes **batem com o corpus**.
O lump de 30% em 0,85 (n=1 e n=2) é decisão deliberada de D-037 (não premiar ruído de
cobertura). **Sem movimento.**

**Abrangência.** Quase-constante (77% geral → 1,0), mas pesa só 0,10 (ajuste fino, D-022).
Mexer no mapa não muda discriminação material. **Sem movimento.**

---

## Pergunta de aprovação ao operador (por vetor)

1. **`score_pesos.v2` (pesos):** confirmar **MANTER v1**? A medição não achou movimento de
   peso que ganhe discriminação honesta (só realoca a pilha neutra — D-042). *[recomendado:
   sim, manter]*
2. **`shrink_k` 5 → 3:** aprovar versionar `score_pesos.v2` só com `shrink_k=3` (pesos
   idênticos), **re-congelando os golden A (77→78) e C (79→80)**? Ganho medido: IQR base-suficiente +2,
   entropia +0,035, banda neutra −4,2 pp; **gated** por abrir a distribuição para cima.
   *[opcional — meu voto: aceitável manter v1; mover só se o ganho de separação valer o
   re-freeze]*
3. **`derivacao.v1` (raridade/abrangência):** confirmar **MANTER**? *[recomendado: sim]*

Nenhuma escrita ocorre sem a resposta explícita a estas três. O gargalo real de
discriminação é **cobertura de CPM/ratio (4,9%)** — frente de cobertura de fontes, fora do
escopo do vetor de score.
