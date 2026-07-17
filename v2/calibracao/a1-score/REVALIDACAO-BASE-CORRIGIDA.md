# A1 · Revalidação da distribuição sobre a base corrigida + fantasmas de percentual

> **Fase:** calibração v2 (D-051/D-052 · mede-e-propõe). **READ-ONLY**: nada gravado,
> nada versionado. Engine **IMPORTADO** (`score.mjs`/`derivacao.mjs`/`cpm`), zero fork
> (D-038); golden 6/6 verde. Base sã atual (guard D-052.1: branch rebaseada sobre
> `origin/claude/loyal-v2-corpus-calibration-9z2utl`, `v2/` presente). **Data:** 2026-07-17.
> Scripts: `revalidacao.mjs` · dados `snapshot-corrigida.json` · saída `revalidacao.json`.

## TL;DR

1. **A base de scoring NÃO mudou.** O snapshot fresco e o da 1ª medição são
   **byte-idênticos** (3.330 ids, 0 percentuais alterados, 0 CPM, 0 rotas). As "duas
   correções" (D-050.1) zeraram `tl_score_bruto` na tabela — coluna que o re-score
   **recomputa**, não lê. Então a régua não se moveu por causa das correções.
2. **A foto original ESTAVA levemente inflada — mas por um BUG DE CÓDIGO, não pelos
   ghosts.** O runner de produção constrói o histórico de rota com `finite(c.percentual)`,
   que **coage `null`/'' → 0** e empurra esses zeros no ECDF. Isso inflava percentil e
   `base_n` de 1.074 bônus reais. Corrigindo: mediana **60 → 58**, "≥70" **12,7% → 8,9%**,
   banda neutra **55,9% → 50,1%**. Número menor honesto.
3. **Os ghosts de percentual (>150) são REAIS mas de baixo impacto na régua**, porque se
   concentram em `compra`/`cartao` (tipos majoritariamente beco/CPM-cego) — as
   **transferências (o conjunto confirmável/publicável) têm só 3 ghosts leves e ZERO
   absurdos**. Capá-los mexe pouco na distribuição.
4. **Veredito:** a **forma** da foto SUSTENTA (pilha em 65, banda neutra dominante,
   mediana em "Só para casos específicos", 0 publicável). A conclusão **"manter
   `score_pesos.v1`" CONTINUA VÁLIDA** — os fantasmas faziam o motor parecer *mais
   generoso/discriminante* do que é; corrigidos, ele fica ainda mais claramente
   conservador. Nenhum ghost escondia sinal que um peso destravaria.

---

## 1. A base de scoring não mudou (o que D-050.1 tocou)

Diff `snapshot.json` (1ª medição) × `snapshot-corrigida.json` (agora):

```
old n 3330 · new n 3330 · ids só-old 0 · ids só-new 0
percentual mudou em 0 · cpm_value mudou em 0 · tipo/origem/destino/publico mudou em 0
```

D-050.1 zerou ~710 `tl_score_bruto` **na tabela**; o re-score computa o bruto em memória
a partir de `percentual`/`cpm_value`/rota, que estão intactos. Logo, revalidar = **medir
o mesmo dado com o cálculo correto** — foi o que expôs o item 2.

Estado atual (SQL): base sã 3.330 · `tl_score_bruto` preenchido 1.996 · null 1.334 (bate
com o beco `conta_nao_calculavel`) · `percentual` preenchido 1.995.

---

## 2. O fantasma dominante: coerção `null → 0` no histórico de rota (BUG do runner)

**Onde.** `v2/M2/rescore/rescore-1.mjs:153-154` e `rescore-2.mjs:204-205`:

```js
const finite = (x) => { const n = Number(x); return Number.isFinite(n) ? n : null; };
...
const p = finite(c.percentual);       // Number(null) === 0 → p = 0 (não null!)
if (p != null) r.historico.push(p);   // empurra 0 no histórico da rota
```

Uma campanha **sem** `percentual` (null) contribui **0** ao histórico da rota. O ECDF de
um bônus real de 40% numa rota com esses zeros embaixo **infla** o percentil do 40%, e o
`base_n` cresce (rota parece ter base suficiente com poucos bônus reais). O componente
percentil do **próprio** item null é tratado certo (guard em `derivarPercentil` → beco);
o vazamento é só no **histórico que os OUTROS itens consomem**.

**Vetor do bug (SQL):** **145 rotas mistas** (têm null-% e bônus real juntos) · **1.074
bônus reais inflados** · **695 zeros-fantasma** empurrados no ECDF.

**Antes → depois (computáveis, n=1.996; `revalidacao.json`):**

| cenário | Q1 | mediana | Q3 | IQR | σ | distintos | entropia | em 65 | banda 55–69 | ≥70 |
|---|---|---|---|---|---|---|---|---|---|---|
| **A — bug runner (= foto original)** | 51 | **60** | 66 | 15 | 11,93 | 61 | 5,273 | 14,3% | **55,9%** | **12,7%** |
| **B — null-preservado (correto)** | 45,8 | **58** | 65 | 19,3 | 13,33 | 65 | 5,305 | 16,4% | **50,1%** | **8,9%** |

O cenário A **reproduz a foto original bit-a-bit** (med 60 · em65 14,3% · banda 55,9%),
provando que a 1ª medição carregava o bug. Corrigindo (B): a distribuição **alarga** (IQR
15→19,3; σ 11,93→13,33), a banda neutra **encolhe** (−5,8 pp) e **3,8 pp a menos** de
itens atingem "Vale olhar+" (12,7%→8,9%). O bug empurrava ~76 itens falsamente para ≥70.
A pilha em 65 **sobe** (14,3→16,4%): sem a inflação-0, mais itens base-curta voltam ao
neutro verdadeiro. **Nada disso muda a forma** — só desincha números que estavam altos.

**Confirmável (CPM vivo, n=164):** A med 51 / IQR 25 / dist 37 → B med 50 / IQR 24 / dist
43. `em65` sobe 0,6%→10,4% (itens cujo percentil era inflado por zeros caem ao neutro).

---

## 3. Os ghosts de percentual > 150 (a preocupação declarada)

**Quantificação (SQL).** Na base sã: **237** com `percentual > 150`, **188 > 300**, **72
> 1000**, **max = 120000**. Distribuição por tipo do ghost (>150):

| tipo | ghosts >150 | 150–300 | >300 | natureza |
|---|---|---|---|---|
| **compra** | 201 | 42 | 159 | bônus de compra/pontos mal-parseado (>300% implausível) |
| cartao | 25 | 1 | 24 | bônus de adesão em PONTOS (27.500…120.000) no campo % |
| clube | 6 | 3 | 3 | idem |
| **transferencia** | **3** | 3 | **0** | leves; nenhum absurdo |
| hotelaria | 2 | 0 | 2 | parse-error |

Os extremos (120000, 100000, 50000, 27500) são todos `tipo=cartao`/`clube` com
`valor_leitura` vazio — **valor absoluto de pontos gravado como percentual**. O sinal-texto
do **R1 (D-053, "até X%")** está **ausente na base sã** (`valor_leitura ~ 'até'`: 1 linha,
**0** para público geral) — R1 é correção de **rótulo de candidato** (frente A2), não move
a distribuição pontuada aqui.

**Contaminação de rota:** 67 rotas têm ≥1 ghost>150; **378 bônus reais** vivem nelas e são
deflacionados. Mas por tipo: 47 rotas `compra`, 11 `cartao`, 4 `clube`, **3
`transferencia`**, 2 `hotelaria`. Ou seja, a contaminação por ghost mora nos tipos
**CPM-cego/beco** — não nas transferências que formam o conjunto publicável.

**Antes → depois do cap de sanidade (sobre B, null-preservado):**

| cenário | ghosts nulados | beco | n comput. | mediana | IQR | σ | em 65 | banda | ≥70 |
|---|---|---|---|---|---|---|---|---|---|
| B — sem cap | 0 | 1.334 | 1.996 | 58 | 19,3 | 13,33 | 16,4% | 50,1% | 8,9% |
| **C — cap 300** | 188 | 1.521 | 1.809 | 58 | 19 | 12,93 | 16,7% | 52,8% | 8,0% |
| **D — cap 200** | 225 | 1.558 | 1.772 | 58,5 | 18 | 12,88 | 17,1% | 52,8% | 8,0% |
| E — cap 150 | 237 | 1.570 | 1.760 | 58 | 18 | 12,9 | 17,1% | 52,8% | 7,9% |

**Confirmável (CPM vivo): cap 300/200/150 é indistinguível de B** (med 50, IQR 24, dist
41–42) — as transferências não têm ghosts materiais. O cap tira 188–237 itens
(majoritariamente compra/cartao) do computável para o beco e **aperta levemente** a cauda
alta (≥70 8,9%→8,0%). Efeito **pequeno e monotônico**; o teto exato (200 vs 300) quase não
importa na régua.

---

## 4. Veredito da revalidação

- **A foto original SUSTENTA na forma, com números levemente menores (honestos).** Régua
  real corrigida: **mediana 58** (não 60), **banda neutra ~50–53%**, **≥70 ~8%** (não
  12,7%), **pilha em 65 ~16–17%** (não 14,3%). A história é a mesma: massa neutra
  dominante, mediana em "Só para casos específicos", **0 publicável**.
- **Não estava contaminada pelos ghosts de forma que mudasse a conclusão** — estava
  **inflada pelo bug `null→0`** do runner (efeito maior que os ghosts) e, em segundo
  plano, pelos ghosts de `compra`/`cartao` (efeito pequeno, fora do conjunto publicável).
- **"Manter `score_pesos.v1`" CONTINUA VÁLIDA.** Os fantasmas faziam o motor parecer mais
  generoso; corrigidos, ele fica **mais** claramente conservador — o oposto de "esconder
  sinal que um peso destravaria". Nenhum movimento de peso se justifica pela base
  de-fantasmada. A opção `shrink_k=3` (proposta v2 §2) segue de pé, mas **deve ser
  re-medida sobre o histórico de rota corrigido** antes de qualquer aprovação (o `base_n`
  muda quando os zeros-fantasma saem).

---

## 5. Propostas (mede-e-propõe — escrita é do principal, regra de escritor único §0)

Nenhuma aplicada aqui. Duas, independentes:

**P1 — Corrigir a coerção `null→0` no histórico de rota (BUG DE CÓDIGO).**
`rescore-1.mjs:153` e `rescore-2.mjs:204`: trocar `const p = finite(c.percentual)` por um
parse null-preservado (`raw==null||raw===''? null : Number(...)`), de modo que campanha
sem `percentual` **não** empurre 0 no ECDF. Impacto medido: mediana −2, ≥70 −3,8 pp, banda
−5,8 pp. **Não toca golden** (o `golden-replay` alimenta componentes prontos, não passa
por essa construção). **Consequência:** o `tl_score_bruto` já GRAVADO pela cadeia de
re-score de produção está inflado por este bug → re-score de regravação recomendado após o
fix (ação do principal). *Movimento que baixa scores = aumenta cautela = classe livre, mas
é escrita → principal aplica.*

**P2 — Tratar os ghosts de percentual como parse-error de sanidade (DADO).** Propor **teto
= 200%**: `percentual > 200` → tratado como `null` para scoring (fora do percentil, item
cai no beco se não tiver CPM), **sinalizado para revisão** (não deletado — espelha a trava
D-041 R5: número absurdo vai a revisão com motivo, humano confirma; não vira outra coisa no
automático). Teto 300 é o piso ultra-conservador (só os inequívocos, 188 itens); a régua é
quase insensível entre 200 e 300. Afeta 225 itens (majoritariamente `compra`/`cartao`
CPM-cego); **conjunto confirmável/publicável intacto**. *Escrita de dado → principal aplica.*

### Perguntas ao operador (via principal)
1. Aprovar **P1** (fix `null→0` no runner + regravar o `tl_score_bruto` inflado)?
2. Aprovar **P2** e o **teto** (recomendado 200; piso 300)? Itens acima → `percentual` fora
   do percentil + flag de revisão, sem auto-reclassificar.
3. Confirmado que **manter `score_pesos.v1`** segue válido sobre a base de-fantasmada? *(a
   medição diz que sim)*

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
