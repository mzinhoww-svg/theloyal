# A1 · Distribuição medida do TL Score sobre a base sã

> **REVALIDADO (2026-07-17) — ver `REVALIDACAO-BASE-CORRIGIDA.md`.** Os números deste
> arquivo foram computados com a mesma coerção `null→0` do runner de produção (histórico
> de rota empurra 0 para % ausente), que inflava percentil/`base_n`. A régua **corrigida**
> é mais baixa: mediana **58** (não 60), ≥70 **~8%** (não 12,7%), banda neutra **~50%**. A
> **forma** (pilha em 65, banda dominante, 0 publicável) e o veredito **"manter v1"** se
> mantêm. Leia este doc pela forma; os valores finais estão na revalidação.


> **Fase:** calibração v2 (D-051 · mede-e-propõe). **Modo:** READ-ONLY.
> **Nada gravado** no banco nem em `score_pesos`/`derivacao_config` (dry-run, `gravou_na_base=false`).
> **Engine:** IMPORTADO (`montarEntradas` ← `derivacao.mjs`, `calcularScore` ← `score.mjs`,
> `cpmDeCustoBase` ← `cpm/custo-base.mjs`), zero fork (D-038). Gate golden 6/6 verde antes de medir.
> **Data:** 2026-07-17 · projeto `qjqnqcsdnpvvmyzkavoq`.

Este documento é só **medição**. A proposta (o que mover / o que manter) está em
`PROPOSTA-VETORES-V2.md`. Scripts: `measure-distribuicao.mjs`, `sensibilidade.mjs`
(saídas anexadas em `medicao.json`, `sensibilidade.json`; dado em `snapshot.json`).

---

## 0. Base e vetores medidos (conferidos live)

| Item | Valor live | Fonte |
|---|---|---|
| Base sã (`identidade_id IS NOT NULL`) | **3.330** campanhas | SQL §A |
| Em revisão (`identidade_id IS NULL`) | 291 | SQL §A |
| Identidades canônicas na base sã | **1.008** | SQL §A |
| Rotas distintas (`tipo|origem|destino|publico`) | **1.053** | §medição |
| `score_pesos.v1` | percentil 0,45 · eficiência 0,30 · raridade 0,15 · abrangência 0,10 · shrink_k=5 · min_samples=3 | SQL §B |
| `derivacao_config.derivacao.v1` | raridade n=1→0,85; buckets `1/2/5/20/50/∞`; abrangência `geral 1,0 / cartão 0,6 / selecionados 0,45 / clube 0,3` | SQL §B |
| `custo_base_moeda` | 4 (esfera 35 · ihg 28 · livelo 30 · smiles 21) | SQL §B |
| `custo_base_ratio` | 8 pares (livelo/esfera → azul/latam/smiles/connectmiles) | SQL §B |

Os vetores no banco batem **exatamente** com os do snapshot usado na medição
(nenhum drift de config entre a leitura e o cálculo).

---

## 1. Distribuição real do TL Score (bruto), computáveis

Lente = itens **computáveis** (não-beco: têm percentil OU eficiência). O beco
(`conta_nao_calculavel`, sem percentil e sem eficiência) é **1.334** itens que não
recebem nota pública — ficam fora do histograma de discriminação.

| Métrica | re-score-1 (CPM-cego) | re-score-2 (CPM vivo) |
|---|---|---|
| n computáveis | 1.996 | 1.996 |
| n beco (conta_nao_calculavel) | 1.334 | 1.334 |
| mín / máx | 22 / 81 | 22 / **85** |
| Q1 · mediana · Q3 | 52 · **60** · 66 | 51 · **60** · 66 |
| IQR | 14 | 15 |
| média · desvio | 58,35 · 11,76 | 58,23 · 11,93 |
| **moda** | **65 (14,3%)** | **65 (14,3%)** |
| valores distintos | 58 | 61 |
| entropia normalizada | 0,894 | 0,889 |
| **empilhamento em 65** | **286 (14,3%)** | **286 (14,3%)** |
| **banda neutra 55–69** | **1.116 (55,9%)** | **1.116 (55,9%)** |

Histograma (re-score-2, faixas de 5, computáveis), de `medicao.json`:

```
20-24     3    | 55-59  336   ██████████████
25-29     8    | 60-64  353   ██████████████
30-34    29    | 65-69  427   █████████████████   ← moda 65 (286)
35-39    75    | 70-74  126   █████
40-44   201    | 75-79   84   ███
45-49   175    | 80-84    5
50-54   173    | 85-89    1
```

Veredito bruto (computáveis, re-score-2): Só para casos específicos 1.116 · Esperaria
450 · Vale olhar 253 · Evitaria 176 · Vale agir 1.

**Leitura.** A mediana do corpus computável é **60 — "Só para casos específicos"** — e
o IQR inteiro (52–66) mora entre "Esperaria" e a banda neutra. A moda é **exatamente 65**
(14,3%). O empilhamento em 65 e a banda 55–69 são **idênticos** entre re-score-1 e
re-score-2 (286 e 1.116) — **o CPM vivo não move a pilha**.

---

## 2. Composição do empilhamento em 65 (por que ele existe)

Dos **286** computáveis com bruto exatamente 65 (script `measure`/análise pile65):

| Traço | Quantos | % |
|---|---|---|
| SEM eficiência (CPM cego) | 285 | **100%** |
| público geral (abrangência = 1,0) | 275 | 96% |
| percentil **base-curta** (rota vista ≤2×, amortizado a 0,5) | 241 | 84% |
| raridade = 0,85 (rota n≤2) | 241 | 84% |

Por tipo: compra 185 · transferência 57 · hotelaria 23 · cartão 8 · estrutural 7 · outros 6.

**65 é um ponto fixo aritmético, não um bug.** Item de público geral, rota vista uma
única vez (percentil neutro por base curta = 0,5; raridade 0,85), sem CPM:
`(0,45·0,5 + 0,15·0,85 + 0,10·1,0) / 0,70 = 0,646 → 65`. É **exatamente** a banda neutra
CPM-cego que **D-042 declara CORRETA**: sem rota e sem conta, o motor se recusa a fingir
discriminação. Esses itens não entram no Deal Desk (nenhum é publicável: 0 TIER 1 + alto).

---

## 3. Onde o CPM vivo (re-score-2) discrimina — o subconjunto confirmável

O ganho do CPM vivo **não** está na foto geral (idêntica), e sim no subconjunto que
ele **acende** (CPM efetivo > 0):

| Lente | re-score-1 | re-score-2 |
|---|---|---|
| n confirmável (CPM efetivo vivo) | **10** | **164** |
| mediana | 49 | 51 |
| Q1 · Q3 | 44,75 · 58,75 | **41 · 66** |
| desvio | 11,07 | **14,68** |
| valores distintos | 9 | **37** |
| entropia normalizada | 0,985 | 0,887 |
| em 65 · banda 55–69 | — | 0,6% · 28,7% |
| B4 conta-fechada | 1 | **27** |

O CPM vivo multiplica o conjunto confirmável **10 → 164** e ali a distribuição **espalha**
(IQR 41–66, desvio 14,68, 37 valores distintos, só 28,7% na banda neutra vs 55,9% na foto
geral). Isso é o **destravamento D-042**, não refinamento: o CPM tira o confirmável da
banda; o resto continua CPM-cego e neutro **por estar correto**.

---

## 4. Cobertura de base por par (percentil-de-rota)

SQL §C. Rota = `tipo|origem|destino|publico`; base_n do percentil = nº de `percentual`
finitos na rota.

| Recorte | Rotas | Campanhas |
|---|---|---|
| Total | 1.053 | 3.330 |
| Rota com **base suficiente** (n_pct ≥ 3 = min_samples) | **130** | **1.502** |
| Rota base-curta (1 ≤ n_pct ≤ 2, amortizada D-025) | 406 | 493 |
| Rota sem nenhum `percentual` | 517 | — |
| Campanhas com `percentual` | — | **1.995** |

**Leitura.** Só **130 de 1.053 rotas (12,3%)** têm base_n ≥ 3 — mas elas concentram
**1.502 de 1.995 (75,3%)** das campanhas com bônus. O percentil-de-rota tem base real
onde há volume; a cauda longa (406 rotas, 493 campanhas) é base-curta e **corretamente
amortizada a 0,5** (D-025). Isso alimenta diretamente a pilha do §2.

---

## 5. Cobertura de CPM (D-035/D-039)

SQL §D + `cpm_origem_dist` de `medicao.json` (re-score-2):

| Origem do CPM | n | Natureza |
|---|---|---|
| `nao_transferencia` | 2.624 | compra/clube/cartão/hotelaria — CPM não é de transferência |
| `null_sem_custo_origem` | 447 | transferência de origem sem custo-base (banco: permanente, D-035) |
| `null_sem_ratio` | 83 | moeda comprável, **par ainda sem ratio** (temporário, D-039) |
| `null_sem_percentual` | 12 | transferência sem bônus extraído |
| `reconstruido` (custo-base × ratio) | **154** | acende |
| `observado` (cpm_value>0) | **10** | acende |

**CPM efetivo aceso: 164 de 3.330 = 4,9%.** Das 700 transferências, 164 acendem; 447
ficam null por natureza (banco, honesto e permanente) e 83 por ratio ausente
(destravável ampliando `custo_base_ratio`). O gargalo de discriminação **não é o vetor
de pesos — é a cobertura de CPM/ratio** (frente de cobertura de fontes), exatamente como
D-042/D-050 previram.

---

## 6. Buckets de raridade (D-037) × distribuição real de frequência de rota

SQL §E. Os buckets são cortes sobre a **frequência da rota**, não sobre o score.

| Bucket (freq da rota) | valor | Campanhas | % |
|---|---|---|---|
| n=1 | 0,85 | 692 | 20,8% |
| n=2 | 0,85 | 308 | 9,2% |
| n=3–5 | 0,65 | 402 | 12,1% |
| n=6–20 | 0,45 | 608 | 18,3% |
| n=21–50 | 0,25 | 633 | 19,0% |
| n>50 | 0,10 | 687 | 20,6% |

**Os buckets batem com o corpus** — cada um é materialmente povoado (nenhum bucket
morto). Ressalva: n=1 e n=2 juntam **30%** no topo (0,85) por decisão deliberada de
D-037 ("rara mas não premiar ruído"). Não é degenerescência.

Abrangência (público), SQL §F: geral **77,1%** (→1,0) · cartão 11,3% (→0,6) · clube 10,8%
(→0,3) · selecionados 0,7% (→0,45). Abrangência é **quase-constante** (77% no teto 1,0),
mas pesa só 0,10 — ajuste fino por desenho (D-022), não motor de discriminação.

---

## Apêndice — SQLs executados (READ-ONLY)

**§A — base sã**
```sql
SELECT (SELECT count(*) FROM campaigns) AS total,
 (SELECT count(*) FROM campaigns WHERE identidade_id IS NOT NULL) AS sana,
 (SELECT count(*) FROM campaigns WHERE identidade_id IS NULL) AS revisao,
 (SELECT count(DISTINCT identidade_id) FROM campaigns WHERE identidade_id IS NOT NULL) AS identidades;
-- → total 3621 · sana 3330 · revisao 291 · identidades 1008
```

**§B — vetores live** — `SELECT * FROM score_pesos`, `derivacao_config`,
`custo_base_moeda`, `custo_base_ratio` (batem com snapshot; ver tabela §0).

**§C — cobertura de base por rota**
```sql
WITH base AS (
  SELECT id, percentual::numeric AS pct,
         (tipo||'|'||origem_code||'|'||destino_code||'|'||publico) AS rota
  FROM campaigns WHERE identidade_id IS NOT NULL),
rota_stats AS (SELECT rota, count(*) n_camp,
  count(pct) FILTER (WHERE pct IS NOT NULL) n_pct FROM base GROUP BY rota)
SELECT (SELECT count(*) FROM base) campanhas,
 (SELECT count(*) FROM rota_stats) rotas,
 (SELECT count(*) FROM rota_stats WHERE n_pct>=3) rotas_base_sufic,
 (SELECT count(*) FROM rota_stats WHERE n_pct BETWEEN 1 AND 2) rotas_base_curta,
 (SELECT count(*) FROM rota_stats WHERE n_pct=0) rotas_sem_pct,
 (SELECT count(*) FROM base WHERE pct IS NOT NULL) camp_com_pct,
 (SELECT count(*) FROM base b JOIN rota_stats r USING(rota) WHERE b.pct IS NOT NULL AND r.n_pct>=3) camp_pct_base_sufic,
 (SELECT count(*) FROM base b JOIN rota_stats r USING(rota) WHERE b.pct IS NOT NULL AND r.n_pct<3) camp_pct_base_curta;
-- → campanhas 3330 · rotas 1053 · base_sufic 130 · base_curta 406 · sem_pct 517
--   camp_com_pct 1995 · pct_base_sufic 1502 · pct_base_curta 493
```

**§D — cobertura de CPM**
```sql
SELECT count(*) total,
 count(*) FILTER (WHERE cpm_value IS NOT NULL AND cpm_value>0) cpm_observado,
 count(*) FILTER (WHERE tipo='transferencia') transferencias,
 count(*) FILTER (WHERE tipo='transferencia' AND (cpm_value IS NULL OR cpm_value<=0)) transf_sem_obs,
 count(*) FILTER (WHERE tier=1) tier1
FROM campaigns WHERE identidade_id IS NOT NULL;
-- → total 3330 · cpm_observado 10 · transferencias 700 · transf_sem_obs 696 · tier1 42
```

**§E — buckets de raridade × frequência de rota**
```sql
WITH base AS (SELECT (tipo||'|'||origem_code||'|'||destino_code||'|'||publico) rota
  FROM campaigns WHERE identidade_id IS NOT NULL),
rf AS (SELECT rota, count(*) freq FROM base GROUP BY rota)
SELECT count(*) FILTER (WHERE freq<=1) n1, count(*) FILTER (WHERE freq=2) n2,
 count(*) FILTER (WHERE freq BETWEEN 3 AND 5) n3a5, count(*) FILTER (WHERE freq BETWEEN 6 AND 20) n6a20,
 count(*) FILTER (WHERE freq BETWEEN 21 AND 50) n21a50, count(*) FILTER (WHERE freq>50) n50p
FROM base b JOIN rf USING(rota);
-- → 692 / 308 / 402 / 608 / 633 / 687
```

**§F — abrangência (público)**
```sql
SELECT publico, count(*) n FROM campaigns WHERE identidade_id IS NOT NULL GROUP BY publico ORDER BY n DESC;
-- → geral 2569 · cartao 377 · clube 361 · selecionados 23
```
