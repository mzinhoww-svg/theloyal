# Diagnóstico de causa-raiz — corrupção temporal do corpus de campanhas

> **Agente 1 · chat de predict (v2) · modo mede-e-propõe · para no diagnóstico.**
> READ-ONLY absoluto: só `execute_sql` com SELECT no Supabase `qjqnqcsdnpvvmyzkavoq`.
> Nenhuma escrita, re-score, migração ou correção foi aplicada. A regra de correção
> abaixo é **proposta**, não aplicada — depende de aprovação do operador + trava de
> anomalia + dry-run (D-040 Parte B, ADR-RADAR-010).
> Evidência, não inferência (D-040 / INV-16): reconstrução de ano só onde há evidência
> textual que sobrevive no registro; sem evidência → `suspect_year`, sai da série,
> **nunca é chutado para dentro**.

---

## 1. Acesso aos dados

**Banco vivo, re-consultado (não é só o snapshot da auditoria).** `list_projects`
confirmou `qjqnqcsdnpvvmyzkavoq` (the-loyalty) `ACTIVE_HEALTHY`. Todas as medições
abaixo são de SELECTs próprios contra o banco vivo em **2026-07-17**, não da auditoria
de 2026-07-15.

Prova de que o banco é mutável e cresceu desde a auditoria: `campaigns` total
**3621** (auditoria: 2543); transferências **753** (auditoria: 507; +246). Todos os
`created_at` entre **2026-07-11 e 2026-07-16** (carga em lote — não é a data da
campanha). Isto reforça, não contradiz, a auditoria: os padrões são ordens de grandeza
estáveis; os valores absolutos subiram porque o pipeline continua escrevendo.

`window_date` reproduzido exatamente como os motores fazem:
`coalesce(vigencia_inicio, data-embutida-no-id (=vigencia_fim), vigencia_fim-válido)`.
Universo: `tipo ilike 'transferencia'`. 562/753 têm `window_date`; **191 sem data**
(excluídas dos dois motores, como na auditoria).

Documentos-base lidos: `CLAUDE.md` (regra 9), `v2/DECISIONS.md` D-040 (A+B),
`ADR-RADAR-010`, `AUDITORIA-FORENSE-PREDICT-FORECAST.md` (§5, §6b, §10, §11-12, §16, §24),
`docs/auditoria/edge-function-campaigns.md`, e os CSVs de lineage/anomalias.

---

## 2. Q1 — O erro de ano é sistemático ou aleatório? → **SISTEMÁTICO**

Distribuição do offset de **ano** entre proveniência e data usada pelos motores,
`(ano de first_seen) − (ano de window_date)`, sobre os 562 registros datados:

| yr_off (fs_ano − wd_ano) | registros | % | origin=auto | origin=daily |
|---|---|---|---|---|
| −1 (evento após a fonte / futuro) | 3 | 0,5% | 3 | 0 |
| **0 (coerente)** | **134** | **23,8%** | 103 | **31** |
| **+1 (ano atrasado 1 ano)** | **307** | **54,6%** | 307 | **0** |
| **+2 (ano atrasado 2 anos)** | 112 | 19,9% | 111 | 1 |
| +3 | 5 | 0,9% | 5 | 0 |
| +6 | 1 | 0,2% | 1 | 0 |

**425 de 562 (75,6%)** têm o ano da `window_date` **atrasado** em relação a `first_seen`
por 1–6 anos, com a massa concentrada em **+1 ano (307)** e **+2 anos (112)**. Métricas
de apoio (banco vivo):

- média `(first_seen − window_date)` = **+333,6 dias** (auditoria: +310).
- **409/562 (72,8%)** com `first_seen` mais de 180 dias após `window_date`.
- pico em 300–430 d (~1 ano): **195**; pico em 665–795 d (~2 anos): **62**; próximo de
  zero (±30 d): 89.

**Veredito: sistemático, não aleatório.** Não é ruído difuso; é um **deslocamento
inteiro de ano** (offset quantizado em ~365/730 dias), com >75% dos registros num
padrão claro de "ano atrasado". Se fosse aleatório, o offset não se concentraria em
múltiplos de ano e 2025-12 seria o piso real. Como é sistemático e o ano correto tem
âncora de proveniência (`first_seen`) mais antiga (jan/2025), **o histórico é
parcialmente recuperável** — não irrecuperável.

**Achado adicional decisivo (origem):** o padrão vive quase inteiramente em
`origin='auto'` (backfill/extração automática). Em `yr_off=+1`, **307 de 307 são
`auto`, 0 são `daily`**; em `yr_off=+2`, 111 de 112 são `auto`; em `yr_off=0`, 31 são
`daily`. O pipeline `daily` (curadoria) está essencialmente limpo. O erro nasce na
extração automática, não na curadoria.

---

## 3. Q2 — Causa e reversibilidade

### Causa (confirmada pela edge fn v13, `edge-function-campaigns.md`)
O LLM (`llama-4-maverick`, temp 0.1) extrai `vigencia_fim` do texto **sem nenhuma
validação de data** e sem receber a data de publicação. Quando o artigo diz "último dia
… hoje (12)" ou não traz ano explícito, o modelo fabrica/atrasa o ano. Esse
`vigencia_fim` vira o `window_date` (via `id`), enquanto o campo confiável
`first_seen = news_raw.published_at` é gravado mas **ignorado de propósito** pelos
motores.

### Evidência que sobrevive no registro
Testei de que fonte o ano correto poderia ser reconstruído **com evidência textual**,
não heurística:

- **`source_url` (slug):** dos 425 corrompidos, **223 (52,5%)** trazem um token
  mês-ano no slug (ex.: `...esfera-connectmiles-fev25.html`, `...bonus-75-set25.html`).
  **Nenhum** traz ano de 4 dígitos; **nenhum** corrompido está sem URL.
- **Convergência de duas fontes independentes:** dos 223 com token, **209 (93,7%)** têm
  `ano-do-slug == ano de first_seen` e **discordam** do ano (atrasado) da `window_date`;
  14 têm `ano-do-slug == ano de window_date`; **0** não batem com nenhum. Ou seja, em
  ~209 registros o **slug textual** e a **proveniência** convergem no mesmo ano correto,
  contra a data extraída pelo LLM.

### Amostra concreta testada (rota canônica + esfera→connectmiles)

| id | window_date | first_seen | ano-slug | slug (cauda) | reconstruível? |
|---|---|---|---|---|---|
| `esfera-connectmiles-…-2024-02-22` | 2024-02-22 | 2025-02-20 | **2025** | `…esfera-connectmiles-fev25.html` | **sim** (slug=fs=2025; wd atrasado 1 ano) |
| `esfera-connectmiles-…-2024-09-20` | 2024-09-20 | 2025-09-18 | **2025** | `…esfera-copa-bonus-75-set25.html` | **sim** (slug=fs=2025) |
| `esfera-connectmiles-…-2025-04-16` | 2025-04-16 | 2025-06-26 | 2025 | `…copa-abr25.html` | já coerente (yr_off 0) |
| **`livelo-connectmiles-…-2023-12-12`** | **2023-12-12** | **2026-07-12** | **null** | `…ultimo-dia…/` (sem token) | **NÃO → `suspect_year`, sai da série** |
| `livelo-connectmiles-…-2026-07-12` | 2026-07-12 | 2026-07-10 | null | `…prorrogado…/` (origin=daily) | já coerente |

O caso canônico `livelo→connectmiles-2023-12-12` (o dos 943 dias) **não tem token de
ano no slug** e o `first_seen` (2026-07-12) é só proveniência — então **fica
`suspect_year`, `include_in_prediction=false`, e NÃO é autocorrigido para 2026-07-12**,
exatamente como manda a ADR-RADAR-010 / INV-16. Os `esfera→connectmiles-2024-*` têm o
ano no slug (`fev25`/`set25`) corroborado por `first_seen` → reconstruíveis.

### Regra inversa candidata (PROPOSTA — não aplicada)
```
reconstruir_ano(registro):
  se yr_off <= 0:                     manter window_date (coerente com a proveniência)
  se yr_off >= 1 e slug_tem_token_ano e ano_slug == ano(first_seen):
        window_date' := window_date com o ANO trocado por ano_slug (mês/dia preservados)
        # slug textual + first_seen convergem → evidência de duas fontes
  senão (corrompido sem evidência textual de ano):
        temporal_status := suspect_year; include_in_prediction := false
        requires_reprocessing := true; requires_human_review := true
        # NÃO chutar; sai da série
```
Cobertura da regra: **≈209/425 (49%) dos corrompidos reconstruíveis com evidência**;
os demais **~202 ficam `suspect_year` e saem** (têm URL, mas sem token de ano e só com
proveniência — proveniência valida, não substitui). A regra corrige apenas o **ano**
(o erro que destrói a série, gerando os falsos ~365/943 dias); não mexe em mês/dia nem
troca a data de evento pela de publicação.

---

## 4. Q3 — Cobertura recuperável

Recontagem de séries de rota (`origem→destino` normalizado) por cenário, contando
`base_n` = datas distintas e exigindo série ≥ 12 meses (D-040: probabilidade numérica
só com `base_n≥3` **e** série ≥12m):

| Cenário | rotas base_n≥3 | rotas base_n≥3 **e** span≥12m | span médio |
|---|---|---|---|
| **raw** (estado corrompido atual) | 38 | 24 | 26,4 m *(ficção — spans inflados pelos erros de ano)* |
| **evidence_recon** (regra proposta) | 24 | **17** | 18,4 m |
| **policy_pure_drop** (dropar todo corrompido, sem reconstruir) | 16 | 9 | 16,7 m |

- A reconstrução **mantém 360 de 562** registros datados e **descarta 202** como
  `suspect_year` (sem evidência de ano).
- **Janela temporalmente confiável após reconstrução:** datas reconstruídas de
  **2024-07 a 2026-07** (o `2026-10` é uma vigência futura legítima), cobrindo **~24–26
  meses distintos** — **não** os 34 meses do corpus bruto, e **não** o piso pessimista
  de 2025-12. Âncoras de proveniência: `min(first_seen)=2025-01-17`,
  `min(observed_at)=2026-01-02`.

**Resposta honesta de Q3:** o predict pode falar com números para **~17 rotas de
transferência** (`base_n≥3`, série ≥12m) sobre uma janela confiável de **~24 meses**,
**se** a regra de reconstrução por evidência for aprovada e aplicada. Sem reconstrução
(política estrita de drop), caem para **9 rotas**. O estado atual (24 rotas "raw") é
**fictício**: seus 26 meses médios de span existem só porque os erros de ano inflam os
intervalos. Recuperamos, portanto, da ordem de **24 dos 34 meses**, não os 34.

---

## 5. Ponto de corrupção no pipeline + está vivo?

**Onde:** **na EXTRAÇÃO** (LLM da edge fn `campaigns` v13). Não é coleta (o slug da
fonte carrega o ano certo — `set25`), não é timezone/parsing na ingestão (o erro é de
**ano inteiro**, não de ±1 dia). A edge fn não valida datas (`edge-function-campaigns.md`:
"Validação das datas: NENHUMA") e não passa a data de publicação ao prompt. O erro é
então **petrificado no `id`** (`makeId = origem-destino-tipo-vigencia_fim`), o que faz a
mesma campanha com anos diferentes gerar `id`s diferentes e **não deduplicar** — é a
origem do artefato de 943 dias. O campo confiável (`first_seen`) existe mas é descartado
pelos motores.

**Está vivo?** **SIM.** A edge fn v13 está `ACTIVE` e continua processando
`news_raw where processed=false`. O corpus cresceu **+246 transferências** desde a
auditoria; o dia de `created_at` mais recente (**2026-07-16**) ainda produziu registro
corrompido (`yr_off≥1`). A corrupção está concentrada no caminho `origin='auto'`
(extração automática); o `origin='daily'` (curadoria) está limpo. **Corrigir 34 meses de
histórico sem corrigir a extração = enxugar gelo**: a próxima rodada de `auto` reinfecta
o corpus.

---

## 6. Recomendação

1. **Parcialmente reconstruível — reconstruir o ANO por evidência textual.** Regra da §3:
   trocar só o ano da `window_date` pelo `ano-do-slug` quando este iguala o ano de
   `first_seen` (convergência de duas fontes). Cobre ~209/425 corrompidos (~49%).
2. **O resto sai como `suspect_year` (não chutar).** ~202 corrompidos sem token de ano
   e as 191 sem data ficam fora da série, com motivo visível e fila de reprocessamento/
   revisão (ADR-RADAR-010). O caso `livelo→connectmiles-2023-12-12` é o exemplar: **não**
   autocorrigir para 2026.
3. **Cobertura resultante:** ~17 rotas com probabilidade numérica sobre ~24 meses
   confiáveis; ~9 se a reconstrução não for aprovada. O predict deve declarar essa
   fronteira, não os 34 meses.
4. **A origem PRECISA de correção também (bloqueante para durar).** Sem consertar a
   extração (validar `vigencia_fim` contra `published_at`; passar a data de publicação ao
   prompt; parar de embutir a data no `id`; usar `first_seen` como validador), qualquer
   limpeza histórica é temporária. Sinalizo isto explicitamente como item de origem.

---

## 7. O que fica para aprovação do operador (antes de qualquer aplicação)

Nada abaixo foi aplicado. Tudo passa por aprovação + trava de anomalia + dry-run
(D-040 Parte B):

- [ ] **A regra de reconstrução de ano** da §3 (troca de ano só com `ano-slug ==
  ano-first_seen`; mês/dia preservados; nunca substituir evento por proveniência).
- [ ] **A política de descarte** `suspect_year` para os ~202 sem evidência + 191 sem
  data (sai da série; entra em reprocessamento/revisão) — já ratificada em princípio
  pela ADR-RADAR-010, mas os **limiares** (548 d / 365 d) são alvo de calibração do
  Agente 3, não desta etapa.
- [ ] **Confirmar a fronteira de cobertura** que o predict pode afirmar (~17 rotas /
  ~24 meses) como a superfície honesta pós-reconstrução.
- [ ] **Correção da origem** (edge fn `campaigns`): validação de data na extração,
  passar `published_at` ao prompt, `id` sem data embutida, dedup por identidade estável.
  Sem isto, a limpeza histórica não se sustenta.

---

*Etapa de diagnóstico. Nenhuma escrita no banco, nenhum re-score, nenhum parâmetro
alterado. Medições em `qjqnqcsdnpvvmyzkavoq` (banco vivo, 2026-07-17) via `execute_sql`
SELECT. A regra de correção é proposta, não aplicada.*
