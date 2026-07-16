# M2 · Slice 4 — TL Score engine (SPEC, antes de código)

> O coração do produto. Spec-antes-de-código. Determinismo-primeiro (INV-12): score, percentil, conta e overrides nascem de função pura/SQL; LLM nunca calcula. Esta spec cobre o **engine puro**; re-score da base e digest Daily são sub-slices seguintes, cada uma com sua spec. Aprovação do operador exigida antes de qualquer linha.

## 0. Estado atual (aterrissagem no schema real)

`campaigns` tem `tl_score` (int, **11/3610 preenchidos**), `cpm`/`cpm_value`, `tier`. **Não existe** breakdown, percentil, veredito nem log de override. O engine introduz tudo isso de forma aditiva. Os 4 buracos de extração estão fechados (gate + vigência + canonicalização + sentinela), então o input é confiável — é a hora da régua.

## 1. Régua + overrides como funções puras versionadas (INV-12)

`v2/lib/score.mjs` puro, com golden files (`v2/golden/score-gold.json`): **mesmo input → mesmo score, sempre.** Mesma disciplina do matcher e do gate.

**Pesos NÃO são hardcoded.** Vivem em tabela versionada `score_pesos` (brief §6). O engine é função pura **sobre entradas que incluem o vetor de pesos** — `calcularScore(entradas, pesos)` — não pura com pesos embutidos. Motivo: o accuracy loop (brief §13) recalibra pesos trimestralmente contra desfecho real, **sem deploy e sem quebrar golden**. Consequências:
- Golden files fixam **os pesos de uma versão** (`v1`) + input → output. Mudar peso = **nova versão** de `score_pesos` + novo conjunto de golden + changelog. O golden testa determinismo *dado o vetor*, não um número mágico eterno.
- O breakdown grava **qual `versao_pesos`** produziu cada score → um score histórico continua explicável depois de recalibração.

```
score_pesos(versao text pk, peso_percentil, peso_eficiencia, peso_raridade,
            peso_vigencia, peso_abrangencia, shrink_k, min_samples, nota, criado_em)
```

**Régua (faixa → veredito):**
`85–100 Vale agir · 70–84 Vale olhar · 55–69 Só casos específicos · 40–54 Esperaria · 0–39 Evitaria.`

**Três overrides → `Não confirmado`** (INV-07), aplicados **depois** do cálculo:
1. **vigência não confirmada** (`vigencia_confiavel=false` ou estado `indeterminada`).
2. **sem TIER 1** (`campanha_fontes` não tem `tier=1`) — INV-02.
3. **conta não calculável** (falta dado para CPM/VPM/spread — INV-03/07).

A régua e cada override são funções puras nomeadas e **versionadas** (`versao_regua`), para o re-score ser reprodutível e auditável no tempo.

## 2. Breakdown auditável por componente (INV-03)

Todo score carrega o **porquê**, gravado em tabela nova `tl_breakdown` (append-only, versionada):

```
tl_breakdown(id, campaign_id, versao_regua, componente, valor, peso, contribuicao,
             base_n, janela, calculado_em)
```

Componentes (pesos a fixar na spec, não no código-surpresa): **percentil** (do bônus/valor vs histórico da rota), **CPM/VPM/spread**, **raridade** (frequência da rota/tipo), **vigência** (janela restante), **abrangência** (público: geral > cartão > clube). Cada componente registra `base_n` e `janela`.

**Base curta rebaixa confiança, nunca vira percentil cheio** (decisão do M1): se `base_n < minSamples`, o componente percentil entra **amortecido** (shrink para a mediana global) e o breakdown marca `base_curta=true`. Sem amostra suficiente, o engine **não finge** um percentil — coerente com o predict engine (minSamples bloqueia). Fórmula: `percentil_efetivo = (percentil_bruto·base_n + 0,5·shrink_k) / (base_n + shrink_k)` — base pequena puxa para 0,5 (neutro).

### 2.1 Redistribuição vs override (a fronteira que evita afundar item legítimo)

- **Sub-métrica de eficiência faltando** (ex.: tem percentil, mas CPM não fecha): o peso do componente ausente **redistribui proporcionalmente** para os presentes — `score = Σ_presentes pesoᵢ·valorᵢ / Σ_presentes pesoᵢ`. **Nunca** um zero que afunda um item legítimo que só não tem conta fechável.
- **`conta_nao_calculavel` (override → Não confirmado)**: só quando **não há sinal de valor computável nenhum** (sem % de bônus, sem percentil possível, sem CPM) — INV-07. Não é "faltou uma sub-métrica"; é "não dá para dar veredito". A fronteira é explícita: redistribuição para o parcial, override para o vazio total.

### 2.2 Pesos `score_pesos.v1` — TRAVADO (aprovado pelo operador)

Vetor final, ancorado nos golden. Vigência **saiu do score** (urgência não é qualidade — peso positivo em vigência-restante premiaria o afogadilho, o "corra, última chance" proibido pelo brief/INV-06). Fontes viraram **override** (não peso). Reconciliação 8→5 = **Opção A** (`RECONCILIACAO-MANUAL-8-para-5.md` / D-022).

| componente | peso v1 | papel | racional |
|---|--:|---|---|
| **percentil** | **0,45** | dominante | bônus/valor vs histórico da própria rota — sinal mais forte que o leitor age. Dominante mas **não maioria**; amortecido por base curta (§2). |
| **eficiência** (CPM/VPM/spread) | **0,30** | a conta | custo/valor. Só pesa quando calculável; ausente → **redistribui** (§2.1), nunca zero que afunda. Absorve `liquidez` do Manual v1. |
| **raridade** | **0,15** | modulador | 100% raro > 100% mensal. Modula atenção, não é o núcleo. Novo no v2 (implícito em "valor" no v1). |
| **abrangência** de público | **0,10** | ajuste fino | geral > cartão > clube. Absorve `aplicabilidade` do Manual v1. |

Soma 1,00. `shrink_k = 5`, `min_samples = 3` (alinhado ao predict engine). **Teto por desenho:** com percentil a 0,45, nem um percentil perfeito sozinho chega a "Vale agir" (85) — exige eficiência + raridade altos. Nenhum componente único força o topo. Protege credibilidade contra hype.

### 2.3 As 3 dimensões órfãs: editoriais, nunca no número (D-022)

`regra` (termos/clawback), `fricção` (esforço de execução), `estoque` (disponibilidade) **não têm fonte determinística** hoje → **não entram no `tl_score`** (fabricar componente sem fonte violaria INV-12). Mas continuam **vivas para o leitor**: o LLM **pode narrá-las no texto do item e no breakdown como qualificação editorial**, citando evidência ("termos exigem clube", "estoque não verificado"), **sem alterar o `tl_score`**. Informação preservada, número não contaminado. Dívida de reintrodução registrada (D-022).

### 2.4 Manual público versionado (condição bloqueante da Opção A — Trilha A)

O texto público do Manual (`components/sections.tsx`) **é atualizado na mesma leva do engine** (não depois): passa a declarar "TL Score **v2**, vigente desde [data]", arquiva os 8 critérios v1 como versão anterior com changelog, e diz **explicitamente** que 3 dimensões (termos/regra, fricção, estoque) são avaliadas editorialmente e **ainda não entram na nota**, com previsão de reintrodução. Admitir o que não se mede é **mais forte** que fingir um peso — o leitor cético confia mais nisso que num 10 inventado. Metodologia auditável **ao longo do tempo**, não só num instante.

## 3. Ordem dos overrides: depois do cálculo, sempre registrados

Um item pode ter **score alto e ser rebaixado**. Não é contradição, é transparência. O dado carrega os dois:
- `tl_score_bruto` — o score que a régua deu.
- `veredito_bruto` — a faixa correspondente (ex.: "Vale agir").
- `veredito` — o veredito **final** exibido (pode ser "Não confirmado").
- `override_aplicado` — qual dos 3 rebaixou (ou `null`).

Log append-only `tl_overrides(campaign_id, versao_regua, override, de_veredito, para_veredito, evidencia, aplicado_em)`. O admin mostra: **"este item seria 88 / Vale agir; rebaixado para Não confirmado por: sem TIER 1"**. O breakdown nunca some o score bruto — ele é o que orienta a curadoria (§4).

## 4. A estrada — como um item vira elegível a Deal Desk (o ponto central)

**Consequência dura que a slice 3 já cravou:** hoje **0/52 do golden vêm de TIER 1**. Então, ligado hoje, o engine **pontua tudo e o override "sem TIER 1" rebaixa quase tudo para "Não confirmado"**. Isso **não é bug — é o produto sendo honesto** (INV-02: Deal Desk exige TIER 1). Uma régua que não pontua nada publicável seria uma Ferrari sem estrada; então a spec define a estrada explicitamente:

**O engine sempre computa `tl_score_bruto` (a Ferrari), mesmo sem TIER 1.** É isso que transforma a falta de estrada de beco-sem-saída em **fila de priorização**:

- **Admin "candidatos a confirmar":** ranqueada por `tl_score_bruto` desc, filtrada por `override = sem_tier1`. O operador vê *"estes 12 itens seriam Vale agir se confirmados"* e sabe exatamente **o que vale a pena confirmar primeiro**. A régua vira o mapa de onde asfaltar.
- **Path A — confirmação manual (já existe):** `confirmar_tier1()` (migration `003`) grava a fonte TIER 1 + evento, promove o estado, **limpa o override "sem TIER 1"** → o item reavalia e, se `tl_score_bruto` ≥ faixa, **entra no Deal Desk**. Loop fechado hoje, sem adapter nenhum.
- **Path B — adapters oficiais (destrava escala):** sitemap+fetch dos **4 programas viáveis** (Smiles, Livelo, Esfera, TAP — `MATRIZ-COLETA.md`, D-009) auto-confirmam TIER 1 e **enchem o Deal Desk sem curadoria manual**. LATAM (D-011) e Azul (D-010) seguem manuais até reavaliação.

**Fluxo completo de um item:** entra → extração → gate (slice 1) → identidade (M1) → **engine pontua `tl_score_bruto` + breakdown** → override "sem TIER 1" rebaixa para "Não confirmado" → aparece na **fila de candidatos ranqueada** → operador confirma via `confirmar_tier1` **ou** adapter confirma → override limpo → **Deal Desk**. A régua e a estrada na mesma peça: **o engine não espera TIER 1 para pontuar; ele pontua para dizer o que confirmar.**

## 5. Fora de escopo desta slice (sub-slices seguintes, specs próprias)
- **Re-score da base** (D-007): rodar o engine sobre os 3.6k canonicalizados — é onde a canonicalização é exercitada em escala; sua própria slice + medição.
- **Digest Daily**: montagem editorial a partir dos elegíveis.
- **Adapters TIER 1** (Path B): slice de coleta.
- LLM só redige/explica o veredito; **nunca calcula** (INV-12).

## 6. Definição de pronto (engine puro)
1. `score.mjs` puro: régua + 3 overrides + assembly de breakdown, versionado. Golden files (`score-gold.json`) travando faixa, overrides e amortecimento de base curta.
2. Migration aditiva: `tl_breakdown`, `tl_overrides`, colunas `tl_score_bruto`/`veredito_bruto`/`veredito`/`override_aplicado` em `campaigns` (idempotente).
3. Teste: mesmo input → mesmo score; cada override rebaixa e loga; base curta não vira percentil cheio; um caso "88 bruto → Não confirmado por sem TIER 1" ponta a ponta.
4. Medição contra um golden de scoring (a montar): a régua bate o esperado; **quantos itens seriam elegíveis se confirmados** (tamanho da fila), **quebrado por programa** (§6.1).
5. Fecho `gsd-output-formatter`.

### 6.1 Medição da fila por programa (liga o tamanho ao esforço real)

Ao medir os would-be-elegíveis, **quebrar por programa (origem/destino)**. Cruzar com a cobertura da Trilha B (adapters sitemap: **Smiles, Livelo, Esfera, TAP**):
- Se os would-be-"Vale agir" concentram nos 4 programas que a Trilha B cobre → **a estrada é curta**, o Deal Desk enche por adapter, carga manual mínima.
- Se espalham em programas só alcançáveis por confirmação manual (Azul D-010, LATAM D-011, cartões) → **carga operacional inicial maior**, confirmação na mão nos primeiros dias.
Esse corte decide se a Trilha B sozinha resolve o arranque ou se o operador precisa confirmar manualmente no início.

## 7. Disparo das três trilhas (após OK ao vetor v1)

Aprovado o vetor `score_pesos.v1`, disparar em paralelo, cada uma em branch empilhada, PR e resumo próprios:
- **Trilha A** — engine puro sobre pesos versionados + golden files (esta spec).
- **Trilha B** — adapters sitemap dos 4 + `confirmar_tier1` ponta a ponta (Path B da estrada).
- **Trilha C** — caça ao `pontos_mais_dinheiro` (tipo com 0 exemplos no golden).

**Ordem de merge:** A → B → C. **Ponto de sincronização:** re-score com as campanhas já confirmadas por TIER 1 → **primeiro Deal Desk real**. O vetor de pesos v1 é o **único bloqueio** antes de disparar.

---

**Aguardo aprovação desta spec — em especial da estrada (§4) e dos pesos/componentes do breakdown (§2) — antes de codar o engine.**
