# M2 · Slice 4 — TL Score engine (SPEC, antes de código)

> O coração do produto. Spec-antes-de-código. Determinismo-primeiro (INV-12): score, percentil, conta e overrides nascem de função pura/SQL; LLM nunca calcula. Esta spec cobre o **engine puro**; re-score da base e digest Daily são sub-slices seguintes, cada uma com sua spec. Aprovação do operador exigida antes de qualquer linha.

## 0. Estado atual (aterrissagem no schema real)

`campaigns` tem `tl_score` (int, **11/3610 preenchidos**), `cpm`/`cpm_value`, `tier`. **Não existe** breakdown, percentil, veredito nem log de override. O engine introduz tudo isso de forma aditiva. Os 4 buracos de extração estão fechados (gate + vigência + canonicalização + sentinela), então o input é confiável — é a hora da régua.

## 1. Régua + overrides como funções puras versionadas (INV-12)

`v2/lib/score.mjs` puro, com golden files (`v2/golden/score-gold.json`): **mesmo input → mesmo score, sempre.** Mesma disciplina do matcher e do gate.

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

**Base curta rebaixa confiança, nunca vira percentil cheio** (decisão do M1): se `base_n < minSamples`, o componente percentil entra **amortecido** (shrink para a mediana global) e o breakdown marca `base_curta=true`. Sem amostra suficiente, o engine **não finge** um percentil — coerente com o predict engine (minSamples bloqueia).

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
4. Medição contra um golden de scoring (a montar): a régua bate o esperado; **quantos dos itens seriam elegíveis se TIER 1** (o tamanho da fila de confirmação).
5. Fecho `gsd-output-formatter`.

---

**Aguardo aprovação desta spec — em especial da estrada (§4) e dos pesos/componentes do breakdown (§2) — antes de codar o engine.**
