# Matriz de ADRs — Fase Estrutural do Radar

> Estado de cada ADR do Radar (todos `proposed`) diante da fase estrutural, com a
> decisão que falta, impacto, dependências e recomendação. **Nenhum ADR é promovido
> automaticamente.** A coluna **Aprovação humana** marca o que exige sua decisão
> explícita antes de qualquer implementação.
>
> Companheiro de `PLANO-FASE-ESTRUTURAL-RADAR.md` (blocos e ondas) e
> `BACKLOG-FASE-ESTRUTURAL-RADAR.md` (execução). As Decisões **H1–H12** citadas estão
> em §7 do PLANO.

---

## 1. Legenda

- **Estado atual:** `proposed` (todos). Entre parênteses, o quanto o P1/C0.2 já
  **contém** em runtime (sem persistência).
- **Aprovação humana:** ✅ exige decisão explícita para promover a `accepted` · ⛔
  bloqueia a onda indicada até ser aprovado.
- **Prioridade da fase** segue a regra-mãe (§27f): validação temporal (010) e
  identidade/dedup (009) primeiro.

---

## 2. Matriz principal

| ADR | Estado atual | Decisão necessária | Impacto | Dependências | Recomendação |
|---|---|---|---|---|---|
| **ADR-RADAR-001** — Produto unificado | `proposed` (P1 já entrega a superfície unificada em runtime) | Confirmar produto único + ordem Predict>Forecast como base persistida | Alto — governança e fim das 3 verdades | 004, 008 | **Promover.** Já validado na prática pelo P1; formaliza a base para S3/S6. Aprovação humana leve |
| **ADR-RADAR-002** — Política de datas e vigência | `proposed` (C0.2 resolve `data_evento` em runtime) | Persistir `data_evento`/`data_evento_source`/`data_confidence`/`vigencia_type` + `vigencia_raw`; `vigencia_fim` text→date | Alto — âncora correta da série; recupera 142 permanentes | 010 (validação) | **Promover com 010.** Requer backfill idempotente **sem autocorreção**. Aprovar prioridade de datas (`exact_start>announcement>exact_end`) |
| **ADR-RADAR-003** — Rota × cluster | `proposed` (rótulos existem no VM; sem pooling) | Aprovar `k`/limiar de shrinkage para pooling hierárquico | Médio — cobertura vs especificidade | 009, 010 | **Adiar para S6/S7.** Não é remédio de cronologia (correção canônica). Depende de 009/010. Decisão H8 |
| **ADR-RADAR-004** — Readiness e gates por finalidade | `proposed` (gates de MVP mantidos: editorial ≥5, Predict interno ≥3) | Elevar gates definitivos (Forecast pub. ≥5 · Predict pub. ≥6 · alta ≥10); implementar de fato `backfill_incomplete`/`data_quality_blocked` | Médio — quanto publica | 007, 009, 010 | **Promover em S3/S6.** Gates operam **depois** de 010/009. Decisão H7 |
| **ADR-RADAR-005** — Outliers | `proposed` (não detectado hoje) | Aprovar política (detectar/rebaixar/segregar, nunca apagar) + `k` (MAD) | Baixo/Médio — honestidade estatística | 009, 010 | **Adiar para S3.** Rede secundária; só sobre série válida+deduplicada. `k≈3·MAD`, ≥6 ondas |
| **ADR-RADAR-006** — Snapshot canônico e uso editorial | `proposed` (nenhum snapshot lido; `NO_SNAPSHOT_MESSAGE` bloqueia deltas) | Aprovar modelo snapshot×uso, TTL de expiração, `presentation_version`, janela de outcome | Alto — reprodutibilidade, fim do stale, base de aprovação/Daily/Weekly/outcomes | 001, 008, 010 | **Promover — núcleo de S3/S4/S5.** Decisões H5, H6, H11 |
| **ADR-RADAR-007** — Completude do backfill | `proposed` (progresso = fila de URLs) | Aprovar completude por seis camadas + limiar de desbloqueio (~0,7) | Médio — silêncio real vs lacuna | 009, 010 | **Adiar para S5/S6.** Não é a causa do 943; necessário para outros intervalos longos |
| **ADR-RADAR-008** — Forecast/Predict e reconciliação | `proposed` (recomendação em runtime, "não persistida") | Persistir reconciliador (`reconciler_version`, `model.selected`, `fallback_used`, `divergence`) + `d_max` definitivo | Alto — uma verdade por série, auditável | 001, 004, 009, 010 | **Promover em S3.** Opera **sobre séries válidas/deduplicadas** (nota canônica). Decisão H9 |
| **ADR-RADAR-009** — Identidade e deduplicação | `proposed` (C0.3 detecta `probable` em runtime, sem merge) | Aprovar 4 entidades, chave natural (sem `vigencia_fim`), pesos de duplicidade, merge/unmerge auditável | **Crítico** — cura a raiz do 943; base de tudo | 002, 010 | **Promover PRIMEIRO (com 010).** Regra-mãe §27f. Decisões H1, H2, H3 |
| **ADR-RADAR-010** — Validação de plausibilidade temporal | `proposed` (C0.2 aplica `evaluateTemporalPlausibility` em runtime) | Aprovar flags, limiares (548d/365d/k·MAD), matriz de bloqueio; princípio "valida, não substitui; nunca autocorrige" | **Crítico** — impede cronologia falsa na origem | 002 | **Promover PRIMEIRO.** Pré-requisito de 009 e de toda a fase. Decisão H4 |

---

## 2.1 Baseline do PR #64 (A1) e os ADRs — correção, não aprovação

O PR #64 (A1) foi **integrado na base** (`e7c98ba`): `lib/ledger-select.ts` com
`LEDGER_QUALITY_SELECT` como **fonte única** das colunas de qualidade lidas do ledger
está **presente na base**, compartilhada por Forecast e Radar, com a proveniência do
Forecast corrigida e o caso 943 **resolvido** também no Forecast legado.

- **ADRs de identidade, proveniência e qualidade — 002, 009, 010 (e 004)** — passam a
  considerar `lib/ledger-select.ts`/`LEDGER_QUALITY_SELECT` como o **baseline** de
  leitura de proveniência/qualidade. O modelo de identidade (009), a política de datas
  (002) e a validação temporal (010) devem **partir** dessa fonte única, não de um
  SELECT paralelo.
- **ADR-009 e ADR-010 continuam os primeiros candidatos à promoção** (regra-mãe §27f);
  o baseline do #64 **não** altera essa ordem.
- **O PR #64 não promove nenhum ADR automaticamente.** É uma **correção corretiva
  compatível** com os princípios `proposed` (proveniência valida; contenção do 943),
  **não** uma aprovação arquitetural. Todos os ADRs seguem `proposed`.
- **Predict continua pendente** no escopo estrutural — o A1 não o toca; sua paridade
  fica para revisão separada em S6.

---

## 3. Ordem de promoção recomendada (não automática)

```
010 (temporal)  ─┬─►  009 (identidade/dedup)  ─►  002 (datas persistidas)
                 │
                 └──►  006 (snapshot) ─► 008 (reconciliação) ─► 004 (gates)
                                       └─► 005 (outliers) ─► 007 (backfill)
                       003 (rota×cluster) ── último (pooling), depende de 009/010
                       001 (produto) ── transversal, formaliza a base
```

**Regra dura:** promover **010 e 009 antes** de qualquer outro. Nenhum ADR de motor
(003/004/005/007/008) opera sobre série corrompida — todos pressupõem 010+009
resolvidos (notas canônicas dos próprios ADRs).

---

## 4. ADRs que exigem aprovação humana antes da implementação

Todos os dez são `proposed` e **exigem** aprovação humana para virar `accepted`.
Marcados por criticidade e onda bloqueada:

| ADR | Aprovação humana | Bloqueia | Decisões H associadas |
|---|:---:|---|---|
| ADR-RADAR-010 | ✅ ⛔ | **S1** (e, por dependência, tudo) | H4 |
| ADR-RADAR-009 | ✅ ⛔ | **S1/S2** | H1, H2, H3 |
| ADR-RADAR-002 | ✅ ⛔ | **S1** | H1 (janela na chave) |
| ADR-RADAR-006 | ✅ ⛔ | **S3/S4/S5** | H5, H6, H11 |
| ADR-RADAR-008 | ✅ ⛔ | **S3** | H9 |
| ADR-RADAR-004 | ✅ | S3/S6 | H7 |
| ADR-RADAR-003 | ✅ | S6/S7 | H8 |
| ADR-RADAR-005 | ✅ | S3 | (k·MAD) |
| ADR-RADAR-007 | ✅ | S5/S6 | (limiar 0,7) |
| ADR-RADAR-001 | ✅ (leve) | S3 | — |

> **Nada aqui promove um ADR.** Este documento apenas mapeia o que falta decidir. A
> promoção `proposed → accepted` é ato humano, registrado no próprio ADR, a partir das
> Decisões H1–H12 (PLANO §7) e das 9 decisões de MVP já fechadas
> (`APROVACAO-MVP-RADAR.md`).

---

## 5. Questões em aberto herdadas (por ADR) que a fase precisa fechar

| ADR | Questão em aberto (do próprio ADR) | Fecha em |
|---|---|---|
| 009 | Composição final da `campaign_identity`; pesos/limiar de `possible`/`probable`; momento de persistir `merged` | H1, H2, H3 · S1/S2 |
| 010 | Limiares exatos (548d/365d/k·MAD); como incorporar evidência textual ("último dia", ano explícito) — depende do schema de extração v2 | H4 · S1 |
| 002 | Pesos exatos por fonte; limiar de `mixed_anchor` | H1 · S1 |
| 006 | TTL de expiração (~7d); granularidade de `presentation_version` | H5, H6 · S3 |
| 008 | Divergência máxima aceitável; se o Forecast chega ao leitor ou fica no admin | H9 · S3 |
| 004 | Números exatos de cada gate; interação com fallback de cluster | H7 · S3/S6 |
| 003 | Valor de `k`; quando o cluster é "bom o suficiente" | H8 · S6/S7 |
| 005 | Valor de `k` (MAD); separar `outlier` de `regime_change` | S3 |
| 007 | Limiar de `backfill_completeness`; densidade esperada por programa/mês | S5/S6 |
| 001 | Nome visível do "motor selecionado"; quanto do Forecast sobrevive | S3 |

---

## 6. Observações de precisão (nomenclatura confirmada no código/arquitetura)

- A chave de identidade ancora no **início** da vigência (`janela_de_inicio±ε`,
  §27d.5), **não** no fim — coerente com o Princípio 3 e a Decisão H1.
- Entidades-alvo já nomeadas: `campaign_identity`, `campaign_version`,
  `source_observation`, `prediction_snapshots` (sucede `forecast_snapshots` +
  `predict_snapshots`), `prediction_snapshot_usages`, `prediction_outcome`,
  `predict_config`, catálogo `programs`/`aliases`. Chaves: `campaign_identity_key`,
  `campaign_version_key`, `source_observation_key`, `series_key`, `dedup_key`,
  `wave_key`.
- **Editorial Score não é entidade da ARQUITETURA** — nasce das decisões de produto
  (D9). Não confundir com `editorial_status` (§18) nem com o TL Score editorial da
  marca. Tratado no Bloco F do PLANO e na Decisão H10.
- A tabela `campaigns` **predate** as migrations do repositório (criada direto no
  projeto). Toda migration da fase é **aditiva**; a ponte com o ledger legado é
  `legacy_campaign_id` (PLANO §4.6).
- `NO_SNAPSHOT_MESSAGE` (runtime) recusa deltas dia-a-dia sem snapshot persistido — a
  onda S3/S4 é o que **desbloqueia** o "o que mudou" completo (D18).
