# M2 · Tabela de CUSTO-BASE por moeda — PROPOSTA a aprovar (D-032)

> **STATUS: PROPOSTA. NÃO POPULADA. Migration 011 NÃO aplicada.**
> Esta é a tabela de referência do **custo de fábrica do milheiro da moeda de
> ORIGEM** — o insumo que falta para reconstruir o **CPM de `transferência`** em
> escala. **PARO no vetor:** proponho os números com fonte+data; o operador
> aprova ANTES de qualquer `INSERT`. **Custo-base errado envenena todo o CPM**
> (é divisor de milhares de campanhas), então cada linha passa pela mesma trava
> do vetor de pesos e do vetor de derivação.

Migration (aditiva, idempotente, **inerte**): `v2/db/migrations/011_custo_base_moeda.sql`
(DDL **sem seed**). Helper puro + teste: `v2/lib/cpm/custo-base.mjs` /
`custo-base.test.mjs` (7 verdes). Não toca `derivacao.mjs`/`score.mjs`.

---

## 0. Por que esta tabela e por que ela trava (o achado)

Inspeção **read-only** do banco (`campaigns`, 3.621 linhas — nada mutado):

| sinal | preenchido | leitura |
|---|--:|---|
| `cpm_value` | **10 / 3.621** (0,3%) | CPM quase sempre AUSENTE (leitura manual; pipeline nunca automatizou) |
| `transferência` (tipo) | **753 / 3.621** | o **grosso** que precisa de CPM reconstruído |

Para `transferência`, o CPM do **destino** não vem da campanha — vem do **custo
de fábrica do milheiro da moeda de ORIGEM** mais o bônus:

```
CPM_destino ≈ custo_milheiro(origem) / ((1 + bônus/100) × ratio_base)
```

`ratio_base` = razão de conversão base origem:destino antes do bônus (1 na maioria
dos hubs). Fórmula isolada e testada em `v2/lib/cpm/custo-base.mjs`
(`cpmDeCustoBase`). **A peça que falta é `custo_milheiro(origem)`** — esta tabela.

**A trava:** o custo-base é **divisor** de todo CPM de transferência daquela
origem. Um erro de R$5 no custo-base do Livelo desloca o CPM de **113
transferências** de uma vez. Por isso nenhum número entra sem **âncora com
fonte+data** (INV-01/INV-03); sem âncora defensável → **"a confirmar"**, nunca um
chute.

---

## 1. Moedas de origem que existem na base (por volume de transferência)

Contagem real (`campaigns.origem_code`, `tipo='transferencia'`), read-only:

| origem | transf. | tem âncora de custo? |
|---|--:|---|
| `esfera` | 114 | **sim** (compra observada) |
| `livelo` | 113 | **sim** (3 compras observadas) |
| `itau` | 97 | **não** — ponto de banco, sem mercado de compra |
| `c6` | 72 | **não** — ponto de banco |
| `smiles` | 36 | **sim** (piso citado) · origem atípica (moeda terminal) |
| `inter` | 31 | **não** — só 1 CPM de transferência P+D, não é custo de compra |
| `credicard` | 26 | **não** — ponto de banco |
| `azul_fidelidade` | 25 | **não** — moeda terminal (aérea) |
| `latam_pass` | 23 | **não** — moeda terminal (aérea) |
| `brb` · `sicredi` · `caixa` · `btg` · `premmia` · `revolut` … | 10–19 cada | **não** — ponto de banco |
| `multiplos_cartoes` | 19 | **N/A** — agregado ("bancos→X"), não é moeda única |

**Consequência dura:** só **3** das grandes origens têm âncora confiável na base
hoje (Livelo, Esfera, Smiles). As **duas maiores origens de banco — Itaú (97) e
C6 (72) — não têm mercado de compra**, então o custo-base delas **não é** um preço
de compra e fica **"a confirmar"**. Isso explica os casos C/D do vetor de
derivação (`itau→latampass` com **sem CPM**): sem custo-base, a transferência de
banco não reconstrói CPM por esta via.

---

## 2. Custo-base PROPOSTO (âncora + data + incerteza)

Todas as âncoras abaixo são **internas ao banco** (`campaigns` lidas read-only,
IDs citados) — proveniência rastreável, INV-01/03. Datas = `verificado_em` da
campanha-âncora.

### 2.1 Moedas com âncora — proponho popular

| moeda | custo/milheiro proposto | fonte (id de campanha-âncora) | verificado_em | confiança | nota / incerteza |
|---|--:|---|---|---|---|
| `livelo` | **R$ 30,00** | `livelo-livelo-compra-2026-07-03` (29,93) · `-07-06` (30,06) · `-07-09` (30,10) | 2026-07-09 | **alta** | 3 compras "compre pontos" no mesmo mês, faixa 29,93–30,10. Preço **padrão** (sem P+D). Promo P+D pontual chega mais barato (ver §3, caso A). |
| `esfera` | **R$ 35,00** | `esfera-esfera-compra-2026-07-31` (35) | 2026-07-31 | **média** | 1 obs. Nota da própria campanha: *"caro vs teto 27 (casos-específicos)"* → piso promocional ~R$27. Proponho **35 = padrão**; operador decide padrão-vs-piso. |
| `smiles` | **R$ 21,00** | `smiles-desconhecido-compra-2026-07-17` (nota: *"barato vs piso 21"*; promo Clube 375% atingiu 16,84) | 2026-07-17 | **média** | **21 = piso de referência** citado; promo Clube/Diamante desce a 16,84. Origem **atípica** de transferência (Smiles é moeda terminal) — o custo-base serve mais ao scoring de **compra** que de transferência. |

Âncora adicional fora das origens de transferência (compra de hotel, informativa):

| moeda | custo/milheiro | fonte | verificado_em | nota |
|---|--:|---|---|---|
| `ihg` | **R$ 28,00** | `ihg-ihg-compra-2026-07-16` (US$ 0,005/pt) | 2026-07-16 | 0 transferências (moeda terminal de hotel). **Caveat FX/IOF/spread** na nota da campanha. Incluir só se o operador quiser custo-base para scoring de compra IHG. |

### 2.2 Moedas SEM âncora — **a confirmar** (não popular)

Não proponho número — **sem âncora confiável, INV-03 manda classificar, não
chutar**. Precisam de referência que o operador forneça (assinatura de clube de
pontos, piso de compra do programa, ou custo efetivo de acúmulo):

- **Pontos de banco/cartão:** `itau` (97), `c6` (72), `credicard` (26), `inter`
  (31), `brb` (19), `sicredi` (14), `caixa` (11), `btg` (10), `premmia` (13),
  `revolut` (15), `nubank`, `bradesco`, `santander`, `banco_do_brasil`, `porto`,
  `banestes`, `bv`, `sisprime`, `banrisul`, `safra`, `xp`, `rico`, `genial` …
  → não há mercado de "compre pontos"; o custo de fábrica é acúmulo por gasto ou
  assinatura de clube, **program-specific**, sem número no banco.
- **Moedas terminais como origem** (transferência a partir delas é atípica):
  `azul_fidelidade` (25), `latam_pass` (23), `avios`, `connectmiles`, `tap_milesgo`,
  `qatar`, `iberia`, `united`, `emirates`, `membership_rewards` …
- **Agregado:** `multiplos_cartoes` (19) — não é moeda única; **N/A** por
  construção (é o guarda-chuva "bancos→destino").

**Regra proposta:** origem em §2.2 → `custo_milheiro = NULL` (linha pode existir
como placeholder com `nota='a confirmar'`, ou simplesmente ausente). O CPM de
transferência dessas origens permanece **não reconstruível** por esta via — cai
na fronteira D-024 (`sem_cpm` → redistribui; se também sem percentil →
`conta_nao_calculavel`). **Não é bug: é a honestidade da base.**

---

## 3. Efeito em CPM de transferências reais (âncoras lidas do banco)

CPM calculado com `cpmDeCustoBase(custo_base, bônus, ratio)` — helper testado.
Nada gravado. `*` = discrepância que expõe um caveat.

| # | transferência real (id) | bônus | custo-base origem | CPM reconstruído | referência no banco | leitura |
|---|---|--:|--:|--:|---|---|
| A | `livelo-azul-transferencia-2026-07-05` | 115% | Livelo 30 | **R$ 13,95** | `cpm_value=11,85` (P+D real) | base dá o CPM **conservador "sem P+D"**; a promo P+D bateu abaixo. Ambos "barato". |
| B | `esfera-latampass-transferencia-2026-06-30` | 120% | Esfera 35 | **R$ 15,91** | (sem CPM no banco) | reconstrói um CPM antes inexistente para LATAM. |
| C | `esfera-azul-transferencia-2024-11-19` | 130% | Esfera 35 | **R$ 15,22** | (sem CPM) | mostra o mesmo custo-base servindo várias rotas de uma origem. **Caveat temporal:** rota de 2024, custo-base de jul/2026 — a §4 pede janela. |
| D\* | `livelo-connectmiles-transferencia-2026-07-12` | 40% | Livelo 30 (ratio 1) | **R$ 21,43** | `cpm_value=60` (nota *"via Livelo"*) | **discrepância 2,8×.** Custo-base sozinho, com `ratio=1`, **subestima**. ConnectMiles (Copa) não converte 1:1 a partir de Livelo → o CPM real precisa do `ratio_base`. **Sinaliza que custo-base + bônus NÃO bastam quando a razão base ≠ 1:1.** |
| E | `itau-latampass-transferencia-*` (caso C do vetor de derivação) | 40% | Itaú **a confirmar** | **null** | (sem CPM) | a maior origem de banco **não reconstrói CPM** por esta tabela — o gap de §2.2 na prática. |

**O que a bateria prova:**
- **A** — custo-base entrega um piso conservador de CPM; promoções P+D específicas
  da campanha ficam **abaixo** dele. Bom: o custo-base nunca "infla" a oferta.
- **B/C** — uma âncora de origem reconstrói CPM para **toda** rota daquela origem
  (114 transferências Esfera de uma vez). É exatamente o alavancamento — e o
  **risco**: erro na âncora contamina todas.
- **D\*** — o caveat que **precisa** de decisão: sem `ratio_base` por parceiro,
  origens com conversão ≠ 1:1 (ConnectMiles, alguns hotéis) saem com CPM
  subestimado. O helper já aceita `ratio`, mas a **tabela de ratios não existe**.
- **E** — a fronteira honesta: Itaú/C6 (169 transferências somadas) ficam **sem
  CPM** até haver âncora. Não invento.

---

## 4. Decisões que aguardam o operador (paro aqui)

1. **Padrão vs piso** para `esfera` (35 padrão / 27 piso-casos-específicos) e
   `smiles` (21 piso / 16,84 promo Clube): o custo-base do CPM deve refletir o
   preço **padrão** (conservador) ou o **piso alcançável**? (§2.1)
2. **`ratio_base` por parceiro** (caso D\*): aprovar só as origens 1:1 (Livelo,
   Esfera → aéreas nacionais) e marcar parceiros não-1:1 (ConnectMiles, hotéis)
   como **a confirmar**, ou já levantar a tabela de ratios? Sem isso, CPM de
   parceiro não-1:1 é subestimado.
3. **Janela temporal da âncora** (caso C): custo-base é um snapshot jul/2026.
   Aplicar a rotas de 2024/2025 mistura épocas de preço. Travar validade da
   âncora (ex.: só rotas ≤ 6 meses da `verificado_em`) ou aceitar como ponte?
4. **Origens de banco sem mercado** (Itaú 97, C6 72, credicard, brb…): manter
   **a confirmar** (CPM não reconstruível, honesto) ou o operador fornece uma
   referência de custo de acúmulo/clube por programa? 169+ transferências dependem.
5. **`ihg`/moedas de hotel** entram na tabela (para scoring de **compra**) ou a
   tabela fica restrita a origens de **transferência**? (§2.1)
6. **Versionamento:** aplicar a 011 (tabela) agora e popular só as 3 âncoras
   após seu OK, ou adiar a tabela até fechar (1)–(4)?

**Enquanto (1)–(6) não forem respondidas, PARO no vetor.** Nada é populado; a
migration 011 fica inerte. Popular só depois do OK — mesma disciplina do vetor
de pesos e do vetor de derivação.

---

## 5. Resumo do vetor de custo-base (o que proponho gravar após aprovação)

```
livelo   30,00  fonte=livelo-livelo-compra-2026-07-03/06/09  verificado=2026-07-09  conf=alta
esfera   35,00  fonte=esfera-esfera-compra-2026-07-31          verificado=2026-07-31  conf=média (padrão; piso ~27)
smiles   21,00  fonte=smiles-desconhecido-compra-2026-07-17    verificado=2026-07-17  conf=média (piso; Clube ~16,84)
ihg      28,00  fonte=ihg-ihg-compra-2026-07-16                verificado=2026-07-16  conf=média (compra hotel; FX/IOF) — opcional
—— a confirmar (NULL, não popular): itau, c6, credicard, inter, brb, sicredi, caixa,
   btg, premmia, revolut, nubank, bradesco, … + moedas terminais como origem.
```

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes
de comprar, transferir ou resgatar.*
