# Predict — Foto de cobertura de base (input-readiness)

> **Agente 3, fase CALIBRAÇÃO (D-051).** Metade honesta que É mensurável hoje: quanto
> do corpus tem base suficiente para o predict frequencial emitir **probabilidade
> numérica** por par, per REQ-25. A outra metade (auto-ajuste do limiar do gate de
> confiança) está bloqueada por ausência de ledger — ver `GATE-CONFIANCA-BLOQUEIO.md`.
>
> **Natureza desta foto:** é medição de **prontidão de input**, não predição. Não move
> parâmetro, não grava nada, não calibra Brier (não há desfecho para medir). Mede a
> distribuição real de ocorrências e comprimento de série por par canônico.
>
> **Banco (READ ONLY):** Supabase `qjqnqcsdnpvvmyzkavoq`, 2026-07-17. Só SELECT.

---

## 0. Definições (o que é medido, e a régua REQ-25)

- **Par canônico** = `identidade_id` (M1: tipo · origem · destino · público). O corpus
  são-pós-recanonicalização tem **1.008** pares com `identidade_id` não-nulo
  (3.330 campaigns resolvidas / 3.621 totais; 291 em revisão `identidade_id IS NULL`).
- **`base_n` (ocorrências)** = nº de linhas `campaigns` daquele par. É o "quantas vezes
  esta oferta já apareceu".
- **Série (comprimento temporal)** = `max(last_seen) − min(first_seen)` do par, em meses
  (÷30,44). É "há quanto tempo observamos este par aparecer".
- **Régua de honestidade (REQ-25, inviolável nº 9):** probabilidade **numérica** só é
  publicável para o par com **`base_n ≥ 3` E série `≥ 12 meses`**. Abaixo disso →
  **rótulo qualitativo**, nunca percentual. `base_n < 3` OU série `< 12m` → sem número.
- **Robusto** = `base_n ≥ 12` E série `≥ 12m` (base folgada, não só o piso).

### Caveat de série (declarado, não escondido)
A tarefa pedia série derivada de `first_seen`/`published_at`. **`published_at` está
praticamente vazio** (25 de 3.330 linhas — é o timestamp de publicação no The Loyal, não
a data de observação da oferta). Logo a série honesta vem de **`first_seen` → `last_seen`**
(`first_seen` populado em 3.330/3.330; `last_seen` em 3.329/3.330). O endpoint importa:
usar só `first_seen` nas duas pontas (`max(first_seen)−min(first_seen)`) dá **119** pares
no bucket `base_n≥3 & série≥12m`; usar `last_seen` como fim (janela de observação real)
dá **163**. Adoto **`last_seen` como fim** — é a janela de observação genuína do par, e é
a definição que reproduz os agregados já medidos pelo operador. Ambos os números ficam
registrados para auditoria.

Span do corpus: `first_seen` de **2025-01-14** a **2026-07-16** — **~18,0 meses**.

---

## 1. SQL — o par canônico e os buckets

```sql
WITH pares AS (
  SELECT identidade_id,
         count(*)                              AS base_n,
         min(first_seen)                       AS ini,
         max(COALESCE(last_seen, first_seen))  AS fim
  FROM campaigns
  WHERE identidade_id IS NOT NULL
  GROUP BY identidade_id
)
SELECT
  count(*)                                                        AS total_pares,   -- 1008
  round(avg(base_n),2)                                            AS media_base_n,  -- 3,30
  max(base_n)                                                     AS max_base_n,    -- 109
  count(*) FILTER (WHERE base_n>=3)                               AS base_n_ge3,        -- 215
  count(*) FILTER (WHERE base_n>=3  AND (fim-ini)>=365)           AS ge3_serie12m,      -- 163
  count(*) FILTER (WHERE base_n>=12 AND (fim-ini)>=365)           AS robustos          -- 45
FROM pares;
```

Série em meses por par: `round((fim-ini)/30.44, 1)`.

---

## 2. Totais (verificados contra os agregados do operador)

| Métrica | Medido (A3) | Operador (HANDOFF §1) | Confere |
|---|---:|---:|:---:|
| Pares canônicos | **1.008** | 1.008 | ✅ |
| Média `base_n` | **3,30** (3,304) | 3,30 | ✅ |
| Máximo `base_n` | **109** | 109 | ✅ |
| `base_n ≥ 3` | **215** | 215 | ✅ |
| `base_n ≥ 3` **E** série ≥ 12m | **163** | 163 | ✅ |
| Robustos (`base_n ≥ 12` E ≥ 12m) | **45** | 45 | ✅ |

**Leitura da prontidão:**
- **163 pares (16,2% de 1.008)** são aptos a **probabilidade numérica honesta** hoje (REQ-25).
- **793 pares (78,7%)** têm `base_n < 3` → **só rótulo qualitativo**, jamais percentual.
- **45 pares (4,5%)** têm base folgada (robustos) — onde a probabilidade é mais confiável.
- A distribuição é de **cauda longa e magra**: média 3,30 mas a maioria dos 1.008 aparece
  1–2 vezes. O predict frequencial nasce cobrindo **um sexto** do universo de pares — e isso
  é a foto honesta, não uma falha a esconder.

> **Nota de fronteira (não é o escopo desta foto, mas delimita seu valor):** ter base ≥ o
> piso REQ-25 é condição **necessária, não suficiente** para publicar probabilidade. Falta
> ainda o **ledger de predições emitidas→resolvidas** para calibrar o Brier (REQ-24). Esta
> foto mede o **input**; o loop de acerto continua bloqueado (mesma fronteira estrutural do
> gate de confiança). Ver `GATE-CONFIANCA-BLOQUEIO.md` §Fronteira comum.

---

## 3. Breakdown por TIPO

Ordenado por pares aptos (`base_n≥3 & série≥12m`). Somas conferem: 215 / 163 / 45.

| tipo | pares | ocorrências | `base_n≥3` | **≥3 & ≥12m** | robustos | max `base_n` |
|---|---:|---:|---:|---:|---:|---:|
| compra | 422 | 1.684 | 103 | **77** | 20 | 109 |
| transferencia | 168 | 700 | 48 | **37** | 17 | 49 |
| cartao | 145 | 287 | 24 | **21** | 1 | 19 |
| clube | 93 | 332 | 14 | **11** | 5 | 86 |
| hotelaria | 63 | 169 | 17 | **8** | 2 | 39 |
| sorteio | 8 | 22 | 4 | **4** | 0 | 5 |
| estrutural | 96 | 106 | 2 | **2** | 0 | 4 |
| promocao | 2 | 8 | 2 | **2** | 0 | 4 |
| upgrade | 1 | 10 | 1 | **1** | 1 | 10 |
| resgate | 4 | 5 | 0 | 0 | 0 | 2 |
| assinatura | 2 | 3 | 0 | 0 | 0 | 2 |
| statusmatch / abertura / cashback / status match | 4 | 4 | 0 | 0 | 0 | 1 |
| **Total** | **1.008** | **3.330** | **215** | **163** | **45** | **109** |

**Leitura:**
- **`compra` e `transferencia` carregam a prontidão** (114 dos 163 pares aptos, 70%). São
  também os tipos com conta computável (CPM vivo, D-039) — exatamente onde o Deal Desk vive.
  Predict e score cobrem, portanto, a mesma espinha dorsal.
- **`cartao` (21 aptos)** tem série longa mas base rasa (só 1 robusto, max 19): aparece
  recorrentemente mas em poucas ocorrências por par — frequência baixa.
- **`estrutural` (96 pares, 2 aptos)** é quase todo `base_n<3`: pares vistos uma vez. Ruído
  de cauda, não sinal predizível.
- Tipos residuais (`resgate`, `assinatura`, `statusmatch`…) não têm base para número —
  rótulo qualitativo sempre.

---

## 4. Breakdown por PROGRAMA (origem_code)

Só programas com ≥1 par `base_n≥3`. Ordenado por pares aptos (`≥3 & ≥12m`).

| origem_code | pares | `base_n≥3` | **≥3 & ≥12m** | robustos |
|---|---:|---:|---:|---:|
| livelo | 61 | 24 | **17** | 7 |
| azul_fidelidade | 40 | 14 | **13** | 3 |
| esfera | 39 | 13 | **11** | 8 |
| smiles | 39 | 12 | **10** | 4 |
| itau | 41 | 11 | **9** | 4 |
| latam_pass | 33 | 9 | **7** | 3 |
| c6 | 25 | 7 | **7** | 3 |
| outro | 22 | 7 | **7** | 2 |
| inter | 34 | 9 | **5** | 3 |
| amazon | 8 | 6 | **5** | 1 |
| mastercard | 23 | 5 | **4** | 0 |
| mercado_livre | 18 | 4 | **4** | 1 |
| banco_do_brasil | 17 | 5 | **3** | 0 |
| premmia | 5 | 3 | **3** | 0 |
| nomad | 17 | 3 | **3** | 0 |
| multiplos_cartoes | 5 | 3 | **3** | 0 |
| casas_bahia | 7 | 3 | **3** | 1 |
| bradesco | 17 | 3 | **3** | 0 |
| shell | 6 | 3 | **2** | 2 |
| sicredi | 6 | 3 | **2** | 0 |
| porto | 12 | 3 | **2** | 0 |
| brb | 11 | 3 | **2** | 0 |
| accor | 14 | 5 | **1** | 1 |
| magalu | 9 | 3 | **1** | 0 |
| *(cauda: visa, km_de_vantagens, caixa, aa_advantage, btg, nubank, wyndham, hoteis_com, samsung, ultragaz, renner, santander, uber, sams_club, banestes, british_airways, connectmiles, lifemiles, costa_cruzeiros, marriott, shopee, rentcars, elo, aeroplan, zarpo, booking, boticario, disney, xp, nike, credicard, tap_milesgo, emirates)* | — | 1–2 cada | 0–2 | 0–1 |
| *(base<3 sempre: qatar, picpay, ihg, hilton, turkish, polishop, flyingblue, aliexpress, united, extra, dafiti)* | — | ≤2 | 0 | 0 |

**Leitura:**
- **Os programas seed crawleáveis (livelo, esfera, smiles) e os destinos-âncora
  (azul_fidelidade, latam_pass) concentram a prontidão**: livelo (17), azul (13), esfera (11),
  smiles (10), latam (7). É a mesma vizinhança onde a coleta TIER 1 automática opera (Parte A)
  e onde os ratios de CPM existem (013). Predict, score e coleta convergem no mesmo núcleo.
- **`esfera` tem a maior densidade de robustos (8)** apesar de menos pares aptos que livelo —
  base mais folgada por par.
- **Bancos (itau 9, c6 7, inter 5, bradesco 3)** aparecem via transferência para os destinos
  âncora — série longa, base média. Candidatos legítimos a número.
- **Cauda de programas com 1 par apto** (companhias estrangeiras, varejo pontual): número
  possível só para aquele par específico; o programa não tem massa. Rótulo qualitativo no resto.

---

## 5. Lista completa — os 163 pares aptos a probabilidade numérica (`base_n≥3 & série≥12m`)

Ordenados por `base_n` desc. `R` = robusto (`base_n≥12`). Série em meses.

| # | origem → destino | tipo | público | `base_n` | série(m) | R |
|--:|---|---|---|--:|--:|:-:|
| 1 | mercado_livre → sem_destino | compra | geral | 109 | 17,5 | R |
| 2 | outro → sem_destino | compra | geral | 88 | 17,9 | R |
| 3 | livelo → livelo | clube | clube | 86 | 17,9 | R |
| 4 | smiles → smiles | compra | geral | 86 | 17,7 | R |
| 5 | livelo → livelo | compra | geral | 81 | 17,9 | R |
| 6 | azul_fidelidade → sem_destino | compra | geral | 69 | 17,4 | R |
| 7 | latam_pass → sem_destino | compra | geral | 63 | 17,9 | R |
| 8 | livelo → sem_destino | compra | geral | 54 | 17,8 | R |
| 9 | azul_fidelidade → azul_fidelidade | compra | geral | 51 | 17,7 | R |
| 10 | itau → latam_pass | transferencia | geral | 49 | 17,1 | R |
| 11 | esfera → esfera | compra | geral | 47 | 17,8 | R |
| 12 | livelo → azul_fidelidade | transferencia | geral | 44 | 15,6 | R |
| 13 | smiles → smiles | clube | clube | 42 | 17,7 | R |
| 14 | amazon → sem_destino | compra | geral | 40 | 17,9 | R |
| 15 | outro → sem_destino | hotelaria | geral | 39 | 17,9 | R |
| 16 | shell → sem_destino | compra | geral | 38 | 17,5 | R |
| 17 | smiles → sem_destino | compra | geral | 37 | 18,0 | R |
| 18 | itau → azul_fidelidade | transferencia | geral | 31 | 17,8 | R |
| 19 | esfera → azul_fidelidade | transferencia | geral | 30 | 17,5 | R |
| 20 | esfera → esfera | clube | clube | 30 | 12,6 | R |
| 21 | livelo → amazon | compra | geral | 25 | 17,5 | R |
| 22 | livelo → latam_pass | transferencia | geral | 25 | 16,6 | R |
| 23 | c6 → azul_fidelidade | transferencia | geral | 24 | 17,5 | R |
| 24 | credicard → latam_pass | transferencia | geral | 24 | 17,1 | R |
| 25 | casas_bahia → smiles | compra | geral | 24 | 17,0 | R |
| 26 | livelo → smiles | transferencia | geral | 23 | 16,1 | R |
| 27 | c6 → latam_pass | transferencia | geral | 22 | 16,9 | R |
| 28 | itau → sem_destino | compra | geral | 21 | 17,6 | R |
| 29 | inter → azul_fidelidade | transferencia | geral | 21 | 17,2 | R |
| 30 | shell → shell | compra | geral | 20 | 17,6 | R |
| 31 | smiles → smiles | cartao | cartao | 19 | 17,4 | R |
| 32 | inter → sem_destino | compra | geral | 19 | 17,2 | R |
| 33 | esfera → smiles | transferencia | geral | 19 | 17,1 | R |
| 34 | esfera → latam_pass | transferencia | geral | 18 | 17,8 | R |
| 35 | latam_pass → accor | transferencia | geral | 16 | 17,7 | R |
| 36 | esfera → sem_destino | compra | geral | 16 | 17,0 | R |
| 37 | azul_fidelidade → azul_fidelidade | clube | clube | 15 | 17,8 | R |
| 38 | latam_pass → sem_destino | clube | clube | 15 | 17,5 | R |
| 39 | c6 → smiles | transferencia | geral | 14 | 17,9 | R |
| 40 | itau → smiles | transferencia | geral | 14 | 17,5 | R |
| 41 | esfera → accor | transferencia | geral | 14 | 15,4 | R |
| 42 | accor → sem_destino | hotelaria | geral | 12 | 17,9 | R |
| 43 | esfera → iberia | transferencia | geral | 12 | 16,1 | R |
| 44 | shopee → sem_destino | compra | geral | 12 | 14,7 | R |
| 45 | inter → outro | compra | geral | 12 | 13,2 | R |
| 46 | livelo → outro | compra | geral | 11 | 18,0 | |
| 47 | smiles → sem_destino | clube | clube | 11 | 17,5 | |
| 48 | smiles → accor | transferencia | geral | 11 | 15,7 | |
| 49 | latam_pass → latam_pass | compra | geral | 10 | 17,5 | |
| 50 | azul_fidelidade → sem_destino | upgrade | geral | 10 | 17,4 | |
| 51 | nike → sem_destino | compra | geral | 10 | 16,3 | |
| 52 | wyndham → wyndham | compra | geral | 9 | 17,4 | |
| 53 | premmia → latam_pass | transferencia | geral | 9 | 17,0 | |
| 54 | itau → azul_fidelidade | cartao | cartao | 9 | 16,7 | |
| 55 | brb → accor | transferencia | geral | 9 | 14,8 | |
| 56 | livelo → livelo | compra | clube | 9 | 13,3 | |
| 57 | azul_fidelidade → natura | compra | geral | 8 | 17,5 | |
| 58 | lifemiles → sem_destino | compra | geral | 8 | 16,9 | |
| 59 | multiplos_cartoes → smiles | transferencia | cartao | 8 | 16,5 | |
| 60 | azul_fidelidade → magalu | compra | geral | 8 | 16,3 | |
| 61 | livelo → sem_destino | clube | clube | 8 | 15,4 | |
| 62 | tap_milesgo → sem_destino | compra | geral | 8 | 13,9 | |
| 63 | inter → shell | compra | geral | 8 | 12,6 | |
| 64 | azul_fidelidade → casas_bahia | compra | geral | 7 | 17,8 | |
| 65 | outro → sem_destino | cartao | cartao | 7 | 17,0 | |
| 66 | azul_fidelidade → sem_destino | clube | clube | 7 | 16,4 | |
| 67 | azul_fidelidade → accor | transferencia | geral | 7 | 14,9 | |
| 68 | azul_fidelidade → azul_fidelidade | cartao | cartao | 7 | 14,5 | |
| 69 | mastercard → sem_destino | compra | geral | 7 | 14,5 | |
| 70 | bradesco → sem_destino | cartao | cartao | 7 | 13,9 | |
| 71 | c6 → azul_fidelidade | transferencia | cartao | 7 | 13,6 | |
| 72 | caixa → azul_fidelidade | transferencia | geral | 7 | 13,6 | |
| 73 | inter → uber | compra | geral | 7 | 12,5 | |
| 74 | uber → sem_destino | compra | geral | 6 | 17,9 | |
| 75 | caixa → sem_destino | cartao | cartao | 6 | 17,9 | |
| 76 | livelo → latam_pass | compra | geral | 6 | 17,8 | |
| 77 | amazon → latam_pass | compra | geral | 6 | 17,4 | |
| 78 | bradesco → smiles | cartao | cartao | 6 | 17,3 | |
| 79 | multiplos_cartoes → azul_fidelidade | transferencia | cartao | 6 | 16,8 | |
| 80 | esfera → connectmiles | transferencia | geral | 6 | 16,8 | |
| 81 | livelo → carrefour | compra | geral | 6 | 16,6 | |
| 82 | smiles → sem_destino | cartao | cartao | 6 | 16,6 | |
| 83 | aeroplan → sem_destino | compra | geral | 6 | 16,5 | |
| 84 | xp → sem_destino | cartao | cartao | 6 | 15,9 | |
| 85 | latam_pass → latam_pass | clube | clube | 6 | 15,7 | |
| 86 | santander → sem_destino | cartao | cartao | 6 | 15,5 | |
| 87 | smiles → smiles | compra | clube | 6 | 15,4 | |
| 88 | itau → latam_pass | cartao | cartao | 6 | 15,2 | |
| 89 | c6 → sem_destino | compra | geral | 5 | 17,9 | |
| 90 | smiles → uber | compra | geral | 5 | 17,8 | |
| 91 | hoteis_com → sem_destino | hotelaria | geral | 5 | 17,5 | |
| 92 | mastercard → mastercard | compra | geral | 5 | 17,5 | |
| 93 | livelo → amazon | compra | selecionados | 5 | 17,5 | |
| 94 | premmia → sem_destino | compra | geral | 5 | 17,2 | |
| 95 | mastercard → sem_destino | hotelaria | geral | 5 | 17,2 | |
| 96 | disney → sem_destino | compra | geral | 5 | 16,3 | |
| 97 | sicredi → latam_pass | transferencia | geral | 5 | 16,1 | |
| 98 | itau → sem_destino | cartao | cartao | 5 | 16,0 | |
| 99 | costa_cruzeiros → sem_destino | compra | geral | 5 | 15,5 | |
| 100 | aa_advantage → sem_destino | sorteio | geral | 5 | 14,8 | |
| 101 | sicredi → azul_fidelidade | transferencia | geral | 5 | 14,2 | |
| 102 | renner → sem_destino | compra | geral | 5 | 12,6 | |
| 103 | livelo → sem_destino | sorteio | geral | 4 | 17,5 | |
| 104 | marriott → sem_destino | promocao | geral | 4 | 17,5 | |
| 105 | livelo → aliexpress | compra | geral | 4 | 17,5 | |
| 106 | mastercard → outro | compra | geral | 4 | 17,4 | |
| 107 | latam_pass → amazon | compra | geral | 4 | 17,4 | |
| 108 | mercado_livre → mercado_livre | compra | geral | 4 | 17,3 | |
| 109 | azul_fidelidade → camicado | compra | geral | 4 | 16,8 | |
| 110 | samsung → sem_destino | compra | geral | 4 | 16,7 | |
| 111 | emirates → sem_destino | hotelaria | geral | 4 | 16,7 | |
| 112 | nomad → azul_fidelidade | cartao | cartao | 4 | 16,5 | |
| 113 | smiles → smiles | promocao | geral | 4 | 16,1 | |
| 114 | boticario → sem_destino | compra | geral | 4 | 15,9 | |
| 115 | mercado_livre → sem_destino | estrutural | geral | 4 | 15,8 | |
| 116 | porto → sem_destino | cartao | cartao | 4 | 15,3 | |
| 117 | visa → sem_destino | compra | geral | 4 | 15,2 | |
| 118 | magalu → smiles | compra | geral | 4 | 14,0 | |
| 119 | outro → sem_destino | clube | clube | 4 | 13,9 | |
| 120 | outro → outro | compra | geral | 4 | 13,7 | |
| 121 | km_de_vantagens → azul_fidelidade | transferencia | geral | 4 | 13,6 | |
| 122 | esfera → sem_destino | clube | clube | 4 | 13,2 | |
| 123 | brb → tap_milesgo | transferencia | geral | 4 | 12,5 | |
| 124 | nomad → sem_destino | compra | geral | 3 | 17,9 | |
| 125 | km_de_vantagens → smiles | transferencia | geral | 3 | 17,9 | |
| 126 | casas_bahia → sem_destino | compra | geral | 3 | 17,9 | |
| 127 | connectmiles → sem_destino | compra | geral | 3 | 17,9 | |
| 128 | sams_club → sem_destino | compra | geral | 3 | 17,7 | |
| 129 | booking → sem_destino | hotelaria | geral | 3 | 17,7 | |
| 130 | premmia → smiles | transferencia | geral | 3 | 17,7 | |
| 131 | nomad → sem_destino | cartao | cartao | 3 | 17,6 | |
| 132 | rentcars → sem_destino | compra | geral | 3 | 17,5 | |
| 133 | bradesco → sem_destino | sorteio | geral | 3 | 17,4 | |
| 134 | c6 → sem_destino | cartao | cartao | 3 | 17,3 | |
| 135 | outro → livelo | compra | geral | 3 | 17,1 | |
| 136 | british_airways → sem_destino | hotelaria | geral | 3 | 17,0 | |
| 137 | amazon → amazon | compra | geral | 3 | 17,0 | |
| 138 | banco_do_brasil → smiles | transferencia | geral | 3 | 16,8 | |
| 139 | zarpo → sem_destino | hotelaria | geral | 3 | 16,7 | |
| 140 | porto → sem_destino | compra | geral | 3 | 16,7 | |
| 141 | casas_bahia → esfera | compra | geral | 3 | 16,5 | |
| 142 | mercado_livre → sem_destino | compra | selecionados | 3 | 16,5 | |
| 143 | nubank → sem_destino | compra | geral | 3 | 16,3 | |
| 144 | amazon → sem_destino | cartao | cartao | 3 | 16,1 | |
| 145 | livelo → sams_club | compra | geral | 3 | 16,1 | |
| 146 | ultragaz → sem_destino | compra | geral | 3 | 16,1 | |
| 147 | banco_do_brasil → sem_destino | compra | geral | 3 | 16,0 | |
| 148 | itau → itau | cartao | cartao | 3 | 15,8 | |
| 149 | multiplos_cartoes → latam_pass | transferencia | cartao | 3 | 15,6 | |
| 150 | banestes → azul_fidelidade | transferencia | geral | 3 | 15,4 | |
| 151 | amazon → livelo | compra | geral | 3 | 15,2 | |
| 152 | btg → tap_milesgo | cartao | cartao | 3 | 14,7 | |
| 153 | elo → outro | cartao | cartao | 3 | 14,2 | |
| 154 | c6 → outro | compra | geral | 3 | 14,0 | |
| 155 | latam_pass → smiles | transferencia | geral | 3 | 13,5 | |
| 156 | outro → latam_pass | compra | geral | 3 | 13,4 | |
| 157 | livelo → livelo | compra | selecionados | 3 | 13,4 | |
| 158 | banco_do_brasil → livelo | cartao | cartao | 3 | 13,4 | |
| 159 | itau → uber | compra | geral | 3 | 13,3 | |
| 160 | azul_fidelidade → azul_fidelidade | estrutural | geral | 3 | 12,7 | |
| 161 | visa → sem_destino | sorteio | geral | 3 | 12,6 | |
| 162 | esfera → magalu | compra | geral | 3 | 12,2 | |
| 163 | azul_fidelidade → livelo | transferencia | geral | 3 | 12,0 | |

**Robustos = as 45 primeiras linhas (`base_n≥12`).** As linhas 46–163 têm base no piso
(3–11) — número publicável por REQ-25, mas com o intervalo de confiança largo que a base
curta impõe (`base_curta`, D-025 / REQ-21). O engine deve marcar `base_insuficiente` para
as linhas de `base_n` baixo mesmo dentro do conjunto apto.

---

## 6. Caveats honestos (o que esta foto NÃO diz)

1. **Prontidão ≠ predição.** Ter `base_n≥3 & série≥12m` habilita **emitir** número; não diz
   que o número acerta. A acurácia (Brier) exige o ledger de predições resolvidas (REQ-24),
   que **não existe** — ver `GATE-CONFIANCA-BLOQUEIO.md`.
2. **Série via `first_seen`→`last_seen`, não `published_at`** (vazio). Endpoint `last_seen`
   escolhido por refletir a janela de observação real; alternativa só-`first_seen` daria 119
   pares aptos, registrada para auditoria.
3. **`base_n` conta ocorrências de campanha, não repetições confirmadas da MESMA oferta.** Um
   par com `base_n=40` pode misturar edições distintas da promo ao longo de 18 meses — que é
   exatamente o sinal frequencial que o predict quer, mas a granularidade (é a mesma oferta que
   volta, ou ofertas diferentes no mesmo par?) fica para o modelo de intervalo do predict, não
   para esta foto.
4. **`sem_destino` domina a cauda de alto `base_n`** (mercado_livre 109, outro 88, azul 69,
   latam 63…). São compras/acúmulos lado-único (D-042). Predizer "quando volta a promo de
   compra de pontos" é legítimo e tem base; mas o **valor** desses pares depende da derivação
   lado-único (Parte B), ortogonal a esta foto de frequência.
5. **Nada foi gravado.** Somente `SELECT`. Esta é uma foto read-only do estado 2026-07-17.

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de comprar,
transferir ou resgatar.*
