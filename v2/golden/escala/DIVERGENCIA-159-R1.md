# Divergência em escala — a família livelo/esfera→azul sob R1 (antes → depois)

> Frente CALIBRAÇÃO / D-051. Retorno pedido explicitamente pelo operador: a família de
> divergência (o caso `livelo→azul` em escala) rotulada sob **R1**, com o **antes** (o que
> a base guarda hoje) → **depois** (geral null + escala na fonte oficial quando existir),
> em **números**, mais os **casos de fronteira** onde R1 poderia errar.
> **Nada público até revisão do operador.** Medição READ-ONLY.

## R1 (aprovado, estendido a shopping)
"até X%" numa transferência = **teto de uma escala por público** (geral < selecionados <
clube-topo) que o blog colapsa num número. → o `percentual` do público **geral = null**; o
teto vira proveniência; a escala real vem da fonte oficial no payload quando existir.

---

## 1. A família no corpus (produção, tabela `campaigns`) — o "antes"
Definição da família: `tipo=transferencia`, `origem_code ∈ {livelo, esfera}`,
`destino_code ∈ {azul_fidelidade, smiles, latam_pass}`. Medido live (2026-07-17):

| métrica | valor |
|---|---|
| campanhas na família | **159** |
| `publico = geral` | **159 (100%)** |
| `publico = selecionados` | **0** |
| `publico` outro/null | 0 |
| com `percentual` preenchido (= **teto do blog gravado como geral**) | **147 / 159** |
| sem `percentual` | 12 |
| teto médio gravado | **81,6%** (min 25 · max 133) |

**O achado, em uma linha:** a produção guarda **147 campanhas** com um bônus "de público
geral" que é, na verdade, o **teto de uma escala** — e o corpus **nunca** registra o eixo
que criaria a escala (`selecionados` = 0). O número existe; o público a que ele se aplica, não.
É exatamente o caso `livelo→azul` (D-048), agora medido em 147 linhas, não em 1.

## 2. A mesma família no golden (nível notícia) — antes → depois sob R1
O golden sorteou **70** transferências marcadas divergentes (estrato divergência + as demais
transferências com "até"). Para cada uma temos o `extracao_snapshot.percentual` (o teto que o
extrator gravou) e o `gabarito.percentual` (o rótulo sob R1):

| | n |
|---|---|
| itens transfer divergentes no golden | **70** |
| **ANTES**: extração gravou o **teto do blog** como `percentual` | **69 / 70** |
| **DEPOIS (R1)**: `percentual` geral → **null** | **68 / 70** |
| base geral **explícita** preservada (não nulada) | **2 / 70** |
| todos com `publico = geral` | **sim** |

Ou seja: R1 limpa **68 de 70** (97%) — transforma "geral recebe X%" em "geral: escala não
confirmada; teto do blog = X% na proveniência". Consistente com os 147/159 da produção.

## 3. Casos de fronteira (o teste da convenção)
O operador pediu explicitamente: onde R1 tratou **errado** — nulou um % geral legítimo, ou
deixou passar um teto como geral. Varredura dos 70:

### 3a. Bases corretamente PRESERVADAS (R1 não nulou — e não devia) — 2 casos
| pct mantido | título | por quê está certo |
|---|---|---|
| 30 | "Latam Pass oferece **30% de bônus** na transferência…" | sem "até" → número flat, é a taxa geral real. R1 não toca. |
| 70 | "Azul oferece **70% de bônus** + **até 30% extra** por tempo de Clube…" | base geral **explícita** (70) + extra de clube (30). R1 grava 70 (geral) e o +30 é a escala. É o caso-piloto. |

Estes **não** são erros — são a prova de que R1 distingue **teto** ("até X") de **base
explícita** ("X% de bônus" sem "até"). Preservar os dois é o comportamento correto.

### 3b. Risco residual da convenção (fronteira teórica, não observada nos 70)
R1 assume **"até X%" ⇒ existe escala**. O falso-positivo possível: um programa que anuncie
"**até** 100%" querendo dizer **100% para todos** (flat), sem escala. Aí R1 nularia um geral
legítimo. **Não encontrei nenhum caso assim nos 70** (todo "até" da amostra correspondeu a
oferta que a experiência do setor sabe ser escalonada), mas **é o único ponto onde R1 pode
super-corrigir**, e só a **fonte oficial** resolve — que é precisamente o que a convenção manda
buscar (geral null até o oficial confirmar). Portanto o risco é **contido por design**: R1
nunca AFIRMA um geral errado; no pior caso deixa `null` (cauteloso), o lado certo do D-051.

## 4. Conclusão para o operador
- **A correção é grande e real:** 147/159 na produção (e 68/70 no golden) hoje afirmam um bônus
  "geral" que é teto de escala. R1 os move para "não confirmado para o geral" + teto na
  proveniência — mais honesto e alinhado ao caso-guia.
- **R1 não gerou falso-positivo de correção** na amostra: preservou as 2 bases explícitas e
  nulou só os tetos "até".
- **O que R1 sozinho NÃO faz:** preencher a escala verdadeira (50/100/105/110/120 por público).
  Isso exige a **fonte oficial no payload** (TIER 1) — e a base tem só 43 TIER 1 / 79 com
  regulamento. R1 é a metade honesta (não afirmar o teto como geral); a outra metade (a escala
  real) depende da cobertura de fontes oficiais.

**Aprovação pedida:** confirmar que a re-canonicalização em produção deve **nular o `percentual`
geral dos 147** (movendo o teto para proveniência) — é movimento que **aumenta cautela** (livre
sob D-051), mas mexe em 147 linhas de produção, então fica registrado como proposta, não gravado.
