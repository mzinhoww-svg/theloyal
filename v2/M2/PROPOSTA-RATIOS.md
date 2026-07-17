# M2 · Tabela de RATIOS de conversão por par — PROPOSTA a aprovar (D-039)

> **STATUS: PROPOSTA. NÃO POPULADA. Migration 012 NÃO aplicada.**
> Esta é a tabela de referência do **ratio base de conversão** de cada par
> `origem→destino` — o **fator** que falta, ao lado do custo-base (011), para
> reconstruir o **CPM de `transferencia`** sem mentir. **PARO no vetor:** proponho
> os ratios com fonte+data+confiança; o operador aprova ANTES de qualquer
> `INSERT`. **Ratio errado envenena o CPM** (é fator do divisor de milhares de
> campanhas), então cada linha passa pela mesma trava do vetor de pesos, do vetor
> de derivação e do vetor de custo-base.

Migration (aditiva, idempotente, **inerte**, sem seed):
`v2/db/migrations/012_custo_base_ratio.sql`.
Consome, sem tocar: `v2/lib/cpm/custo-base.mjs` (`cpmDeCustoBase`, já aceita `ratio`).
Não toca `derivacao.mjs`/`score.mjs`/`custo-base.mjs`/o runner de re-score.

---

## 0. Por que esta tabela e por que ela trava (o achado, D-039)

O CPM de `transferencia` (o **grosso** da base: 753/3.621 campanhas) reconstrói-se
do custo de fábrica da moeda de ORIGEM (tabela 011) **mais o bônus e o ratio do
par**:

```
CPM_destino ≈ custo_milheiro(origem) / ((1 + bônus/100) × ratio)
```

`custo_base_moeda` (011) entrega `custo_milheiro(origem)`. **Falta o `ratio`** — e
ele **não é 1:1** em vários pares. O caso-âncora (lido read-only do banco):

| par | bônus | paridade real (banco) | CPM com ratio certo | CPM com ratio=1 (mentira) | CPM real no banco |
|---|--:|---|--:|--:|--:|
| `livelo→connectmiles` | 40% | **3:1** (`paridade='3:1'`) | **R$ 64,29** | R$ 21,43 | **R$ 60,00** (`cpm_value`) |

Defaultar 1:1 daria **R$ 21,43** contra os **R$ 60,00** reais — erro de **2,8×**.
O ratio 3:1 (=0,3333) reconstrói **R$ 64,29**, coerente com a âncora. **Sem a
tabela de ratios, o CPM de transferência mente.** Por isso: **nunca defaultar
1:1** — só onde há evidência; onde não há → `NULL` ("a confirmar"), CPM não
reconstruível (INV-03/D-039).

**A trava:** o ratio é **fator** do divisor de todo CPM daquele par. Nenhum número
entra sem **âncora com fonte+data** (INV-01/INV-03); sem âncora → **"a confirmar"**.

---

## 1. Semântica do `ratio` (para bater com `cpmDeCustoBase`)

`ratio` = **milhas de destino por 1 ponto de origem, ANTES do bônus** (idêntico ao
parâmetro `ratioBase` do helper testado):

| paridade observada | leitura | `ratio` gravado |
|---|---|--:|
| `1:1` | 1 ponto origem → 1 milha destino | **1** |
| `3:1` | 3 pontos origem → 1 milha destino | **0,3333** (1/3) |
| `2:1` | 2 pontos origem → 1 milha destino | **0,5** |

Verificado com o helper real (`cpmDeCustoBase`): `livelo→connectmiles` 40%, custo
30, ratio 1/3 → **R$ 64,29**; ratio 1 → R$ 21,43. A fórmula e o mapeamento estão
corretos.

---

## 2. De onde vem a evidência de ratio (fontes, read-only)

Duas classes de âncora in-base, ambas rastreáveis (IDs citados):

- **A · Âncora de par exato** — o campo `paridade` da própria campanha do par
  (às vezes com `cpm_value` corroborando). Confiança **alta**.
- **B · Comportamento do destino (origens-irmãs)** — quando o par exato não tem
  `paridade`, mas **todas** as origens observadas para aquele destino convergem no
  mesmo ratio, infere-se o ratio do destino. Confiança **média** (é inferência do
  destino, não do par). Ex.: LATAM Pass recebe **1:1** de `itau`, `credicard`,
  `banco_do_brasil` e `livelo` → `esfera→latam_pass` herda 1:1 como **média**.

Evidência bruta de destino colhida do banco (`campaigns`, `paridade`):

| destino | âncoras de paridade in-base | ratio do destino |
|---|---|--:|
| `latam_pass` | `itau-latampass-*` 1:1 · `credicard-latampass-*` 1:1 · `bb-empresas-latampass-2026-07-08` 1:1 · `livelo-latampass-2026-06-30` 1:1 | **1** |
| `smiles` | `itau-smiles-2026-03-02` 1:1 · `credicard-smiles-2026-03-02` 1:1 · `bancos-smiles-2026-07-10` 1:1 | **1** |
| `azul_fidelidade` | `livelo-azul-2026-07-05` 1:1 (+`cpm_value` 11,85) · `inter-loop-azul-2026-07-10` 1:1 | **1** |
| `connectmiles` | `livelo-connectmiles-2026-07-12` **3:1** (+`cpm_value` 60) | **0,3333** |
| `accor` | `brb-allaccor-na` "3,5:1→4:1" · `curtai-allaccor-na` "pior" · `latampass-all-na` "desconto" | **volátil, não-1:1** |

---

## 3. Vetor de ratios PROPOSTO (fonte + data + confiança)

Priorizados os pares de **origem comprável** (Livelo/Esfera/Smiles) — os que o CPM
vai acender (D-039) — e os **não-1:1** (ConnectMiles). `ratio` na semântica do §1.

### 3.1 Confiança ALTA — âncora de paridade do par exato

| origem | destino | ratio | fonte (id de campanha-âncora) | verificado_em | nota |
|---|---|--:|---|---|---|
| `livelo` | `azul_fidelidade` | **1** | `livelo-azul-transferencia-2026-07-05` (`paridade='1:1'` + `cpm_value=11,85`) | 2026-07-05 | 44 transferências na base. Âncora dupla (paridade + CPM). |
| `livelo` | `latam_pass` | **1** | `livelo-latampass-transferencia-2026-06-30` (`paridade='1:1'`) | 2026-06-30 | 25 transferências. "25% virou o novo patamar LATAM 2026". |
| `livelo` | `connectmiles` | **0,3333** | `livelo-connectmiles-transferencia-2026-07-12` (`paridade='3:1'` + `cpm_value=60`) | 2026-07-12 | **O caso-âncora da trava.** 3:1 (Copa). ratio=1 mentiria 2,8×. |

### 3.2 Confiança MÉDIA — inferido do comportamento do destino (origens-irmãs)

Sem âncora de par exato, mas o destino converge num ratio único entre todas as
origens observadas in-base (§2). **Não é chute**: é inferência do destino com
âncoras citadas. Marcar `confianca='media'`.

| origem | destino | ratio | fonte (âncoras do destino) | verificado_em | nota |
|---|---|--:|---|---|---|
| `livelo` | `smiles` | **1** | destino Smiles 1:1: `credicard-smiles-2026-03-02` · `itau-smiles-2026-03-02` · `bancos-smiles-2026-07-10` | 2026-07-10 | 23 transferências. Sem paridade no par; destino 1:1 consistente. |
| `esfera` | `latam_pass` | **1** | destino LATAM 1:1: `itau-latampass-*` · `credicard-latampass-*` · `bb-empresas-latampass-2026-07-08` + `livelo-latampass` 1:1 | 2026-07-08 | 18 transferências. |
| `esfera` | `smiles` | **1** | destino Smiles 1:1 (mesmas âncoras de `livelo→smiles`) | 2026-07-10 | 19 transferências. |
| `esfera` | `azul_fidelidade` | **1** | destino Azul 1:1: `livelo-azul-2026-07-05` · `inter-loop-azul-2026-07-10` | 2026-07-10 | 30 transferências. |
| `esfera` | `connectmiles` | **0,3333** | destino ConnectMiles 3:1 inferido de `livelo-connectmiles-2026-07-12` (3:1, Copa) | 2026-07-12 | **Não-1:1 priorizado.** 6 transferências. Ver §5, decisão 2 — **não defaultar 1:1**. |

### 3.3 A confirmar — `ratio = NULL` (não popular)

Sem evidência confiável do ratio → **INV-03 manda classificar, não chutar**. Não
proponho número. Pares (todos com origem comprável ou destino relevante):

- **Accor** (destino não-1:1 e **volátil** — in-base "3,5:1→4:1", "pior",
  "desconto"): `esfera→accor` (14), `livelo→accor` (3), `smiles→accor` (11). Ratio
  real varia por janela; sem âncora estável do par → **null**.
- **Família Avios/Iberia** (provável 1:1, mas **sem âncora numérica** in-base — só
  `revolut→iberia paridade='1'` confiança baixa): `esfera→iberia` (12),
  `esfera→avios` (1), `livelo→avios` (1). → **null**.
- **FlyingBlue / TAP / United / Turkish / Etihad / Hilton / IHG / Aeroméxico / AA**:
  `esfera→flyingblue` (3), `livelo→flyingblue` (4), `esfera→tap_milesgo` (2),
  `livelo→tap` (1), `livelo→united` (1), `esfera→turkish` (2), `livelo→etihad` (2),
  `esfera→etihad` (`paridade='sim'`, lixo), `livelo→hilton` (2), `esfera→ihg` (2),
  `esfera→aeromexico` (1), `esfera→aa_advantage` (1). Sem âncora de paridade →
  **null**.
- **Origens de banco/terminais** (`itau`, `c6`, `credicard`, `inter`, `brb`,
  `sicredi`, `caixa`, `premmia`, `nubank`, `banco_do_brasil`, `revolut`,
  `latam_pass`, `azul_fidelidade`, `smiles`, `multiplos_cartoes`…): **fora do
  escopo útil da tabela**. O CPM dessas origens já é `null` **por natureza** —
  `custo_base_moeda` é null (D-035, permanente: ponto de banco não tem mercado de
  compra; terminal é moeda-fim). Popular ratio para elas **não acende CPM nenhum**.
  A `paridade` 1:1 delas (Itaú/Credicard→LATAM/Smiles) entra só como **evidência do
  destino** (§2), não como linha de ratio. `brb→accor` (4:1) e `brb→tap` (2:1)
  ficam registrados aqui como observação, mas **não populados** (origem sem
  custo-base).

**Regra proposta:** par em §3.3 → linha ausente **ou** `ratio=NULL`. Contrato do
consumidor (documentado na migration): **ausência/NULL ⇒ CPM não reconstruível**,
nunca `ratio=1` implícito.

---

## 4. Efeito em CPM de transferências reais (âncoras lidas do banco)

CPM via `cpmDeCustoBase(custo_base_origem, bônus, ratio)` — helper testado, nada
gravado. Custo-base da PROPOSTA-CUSTO-BASE (proposta, não aprovada): livelo **30**,
esfera **35**. `*` = expõe a mentira do 1:1.

| # | transferência real (id) | bônus | custo-base | ratio proposto | **CPM (ratio certo)** | CPM se 1:1 | referência no banco |
|---|---|--:|--:|--:|--:|--:|---|
| 1 | `livelo-azul-transferencia-2026-07-05` | 115% | 30 | 1 (alta) | **R$ 13,95** | 13,95 | `cpm_value=11,85` (P+D real; base = piso conservador sem P+D) |
| 2 | `livelo-latampass-transferencia-2026-06-30` | 25% | 30 | 1 (alta) | **R$ 24,00** | 24,00 | (sem CPM no banco) — reconstrói um CPM antes inexistente |
| 3\* | `livelo-connectmiles-transferencia-2026-07-12` | 40% | 30 | 0,3333 (alta) | **R$ 64,29** | **21,43** | `cpm_value=60` — ratio certo bate; 1:1 erra **2,8×** |
| 4 | `esfera-latampass-transferencia-2026-06-30` | 120% | 35 | 1 (média) | **R$ 15,91** | 15,91 | (sem CPM) — coerente com PROPOSTA-CUSTO-BASE caso B |
| 5 | `livelo-smiles-transferencia-2024-11-27` | 100% | 30 | 1 (média) | **R$ 15,00** | 15,00 | (sem CPM) — destravaria 23 transferências Livelo→Smiles |
| 6\* | `esfera-connectmiles-transferencia-2024-09-20` | 75% | 35 | 0,3333 (média) | **R$ 60,00** | **20,00** | (sem CPM) — 1:1 mentiria **3×**; o mesmo trap do #3 |

**O que a bateria prova:**
- **1, 2, 4, 5** — nos pares 1:1, o ratio confirma o CPM que o custo-base já dava:
  a tabela de ratios **não muda** o número, mas **garante** que o 1:1 é evidência,
  não suposição. Sem ela, todo 1:1 seria um palpite.
- **3\*** — o caso-âncora: ratio 3:1 reconstrói **R$ 64,29** (coerente com os
  **R$ 60** reais); o default 1:1 dá **R$ 21,43**. A tabela **conserta a mentira**.
- **6\*** — a razão de o item priorizar não-1:1: `esfera→connectmiles` **não tem
  âncora de CPM**, então um 1:1 silencioso passaria batido dando **R$ 20** — quando
  o ratio 3:1 do destino ConnectMiles dá **R$ 60** (3× de diferença). É exatamente
  o buraco que a regra "nunca defaultar 1:1" fecha.

---

## 5. Decisões que aguardam o operador (paro aqui)

1. **Aprovar o vetor §3.1 (alta) + §3.2 (média)?** As 3 âncoras de par exato são
   diretas. As 5 inferências de destino (média) são defensáveis mas são
   **inferência**, não âncora do par — o operador aceita popular como `media`, ou
   quer só as **alta** agora e o resto "a confirmar"?
2. **`esfera→connectmiles` (não-1:1 priorizado):** popular **0,3333 média**
   (inferido do destino ConnectMiles/Copa 3:1, corroborado pelo #6), ou deixar
   **null** até haver âncora `esfera→connectmiles` direta? **O que NÃO é opção é
   defaultar 1:1** (mentiria 3×). Recomendo popular 0,3333 média — fecha o trap.
3. **Contrato do consumidor (crítico, D-038):** confirmar que o runner de re-score
   trata **par ausente OU `ratio IS NULL` ⇒ CPM null** (não reconstruível), **nunca
   `ratio=1` implícito**. O default 1 do helper é suposição documentada, não deve
   rodar às cegas. (Não altero o runner — é decisão de contrato do operador.)
4. **Janela temporal do ratio:** ratios de programa mudam (ex.: LATAM foi a 1:1;
   Accor mexeu 3,5:1→4:1). Travar validade da âncora (revalidar a cada N meses) ou
   aceitar o snapshot atual como ponte, revisando quando a coleta oficial pegar
   mudança de paridade?
5. **Origens de banco/terminais:** manter **fora** da tabela (CPM já null por
   natureza — D-035), como proposto, ou o operador quer as linhas registradas para
   documentação, mesmo sem efeito em CPM?
6. **Versionamento:** aplicar a 012 (tabela) agora e popular só o vetor aprovado
   após seu OK, ou adiar a tabela até fechar (1)–(5)?

**Enquanto (1)–(6) não forem respondidas, PARO no vetor.** Nada é populado; a
migration 012 fica inerte. Popular só depois do OK — mesma disciplina dos vetores
de pesos, derivação e custo-base.

---

## 6. Resumo do vetor de ratios (o que proponho gravar após aprovação)

```
# ALTA (âncora de par exato)
livelo  azul_fidelidade  1       fonte=livelo-azul-transferencia-2026-07-05 (1:1 + cpm 11,85)  verif=2026-07-05  conf=alta
livelo  latam_pass       1       fonte=livelo-latampass-transferencia-2026-06-30 (1:1)          verif=2026-06-30  conf=alta
livelo  connectmiles     0.3333  fonte=livelo-connectmiles-transferencia-2026-07-12 (3:1 + cpm 60)  verif=2026-07-12  conf=alta

# MÉDIA (inferido do comportamento do destino)
livelo  smiles           1       fonte=destino smiles 1:1 (credicard/itau/bancos-smiles)        verif=2026-07-10  conf=media
esfera  latam_pass       1       fonte=destino latam 1:1 (itau/credicard/bb + livelo-latampass) verif=2026-07-08  conf=media
esfera  smiles           1       fonte=destino smiles 1:1 (mesmas ancoras)                      verif=2026-07-10  conf=media
esfera  azul_fidelidade  1       fonte=destino azul 1:1 (livelo-azul + inter-loop-azul)         verif=2026-07-10  conf=media
esfera  connectmiles     0.3333  fonte=destino connectmiles 3:1 (livelo-connectmiles)           verif=2026-07-12  conf=media

# A CONFIRMAR (NULL, não popular): *→accor, esfera→iberia/avios/flyingblue/tap/turkish/etihad/ihg/aeromexico/aa_advantage,
#   livelo→avios/flyingblue/tap/united/etihad/hilton. Origens de banco/terminais: fora do escopo (CPM null por natureza).
```

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes
de comprar, transferir ou resgatar.*
