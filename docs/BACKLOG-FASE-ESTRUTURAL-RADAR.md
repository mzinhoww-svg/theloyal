# Backlog da Fase Estrutural — Radar Preditivo de Campanhas

> Execução em **ondas S0–S7**. Cada item traz **problema · valor · dependência ·
> risco · migration · rollback · aceite · testes**. **Não implementa código, não
> escreve SQL, não altera banco.** As migrations são **conceituais** (desenho em
> `PLANO-FASE-ESTRUTURAL-RADAR.md §4`); aqui indica-se **qual** migration cada item
> consome, nunca o DDL.
>
> **Bloqueio global:** nenhuma onda S1+ inicia sem (a) aprovação das Decisões H1–H12
> (PLANO §7), (b) promoção dos ADRs relevantes (MATRIZ §3), e (c) o relatório
> pós-merge lido em S0. **A implementação permanece bloqueada até aprovação humana.**
>
> Convenção de IDs: `E{onda}-{n}`. Prioridade: P0 (bloqueante da onda) → P2.

---

## Onda S0 — Preparação (sem migration)

Objetivo: destravar a fase com segurança. Não toca banco.

### E0-1 — Consumir a rodada 1 do pós-merge (PR #63) e o A1 integrado (PR #64)
- **Problema:** a fase precisa partir do diagnóstico real, não de premissa. A rodada 1
  do pós-merge está no PR #63 (`docs/VALIDACAO-POS-MERGE-RADAR.md`); a correção A1 do
  PR #64 **já está integrada na base** (`e7c98ba`).
- **Valor:** ancora S0 nos findings classificados e no baseline A1 **já integrado**.
- **Dependência:** PR #63 (rodada 1, aberto/draft/verde); A1 (#64) **mergeado**.
- **Consumir da rodada 1 (#63):** **F1, F2, F3 classificados**; **F4 `blocked`**
  (dado vivo em ambiente permitido) e **F5 `not_confirmed`** ficam **pendentes** para a
  **rodada 2**.
- **A1 (#64) integrado:** `lib/ledger-select.ts`/`LEDGER_QUALITY_SELECT` **presentes na
  base**; Forecast e Radar partilham o SELECT de qualidade; 943 resolvido; Predict fora
  do escopo (pendente em S6).
- **Risco:** iniciar implementação estrutural antes de **F4/F5 e revisão humana** = base
  ainda não validada ao vivo (o A1 já não é bloqueio).
- **Migration:** nenhuma.
- **Rollback:** n/a (documental).
- **Aceite:** rodada 1 sumarizada (F1–F3 classificados; F4/F5 pendentes); **A1
  integrado (Gate A1 concluído)**. Com o A1 fechado, o fechamento de S0 depende de
  **revisão humana, F4 e F5**.
- **Testes:** n/a.

> **Gate A1 — estado atual:** *A1 integrado. Gate concluído.* (Merge do PR #64 na base
> `e7c98ba`, com `lib/ledger-select.ts` presente — integração verificada, não apenas
> PR verde.)

### E0-2 — Congelar as Decisões H1–H12 e promover ADRs
- **Problema:** limiares, chave natural e política de merge ainda são propostas.
- **Valor:** transforma `proposed` em base estável; evita retrabalho de esquema.
- **Dependência:** PLANO §7; MATRIZ §3/§4.
- **Risco:** promover ADR sem decisão fecha esquema errado (irreversível barato só
  antes da migration).
- **Migration:** nenhuma (é pré-condição de S1).
- **Rollback:** reabrir a decisão antes de qualquer S1.
- **Aceite:** H1–H12 respondidas; ADR-010 e ADR-009 promovidos a `accepted`; demais
  ADRs com decisão registrada.
- **Testes:** n/a.

### E0-3 — Preparar ambiente de branch de dados (staging)
- **Problema:** migrations estruturais precisam ser exercidas fora de produção.
- **Valor:** permite backfill e reprocessamento idempotentes sem risco ao ledger real.
- **Dependência:** Supabase branch/staging; padrão RLS service_role.
- **Risco:** testar em produção corromperia o ledger.
- **Migration:** nenhuma (provisiona ambiente).
- **Rollback:** descartar a branch de dados.
- **Aceite:** ambiente isolado com cópia do schema; nenhum acesso `anon`/`authenticated`.
- **Testes:** smoke de conectividade service_role.

---

## Onda S1 — Identidade e observações (migration)

*(ADR-009, ADR-010, ADR-002 · Decisões H1, H4)*

### E1-1 — Persistir validação temporal na origem
- **Problema:** a edge fn grava datas do LLM sem validação; datas fabricadas entram
  na série (77% das transferências >180d antes de `first_seen`).
- **Valor:** cronologia falsa é barrada na origem, não só contida em runtime.
- **Dependência:** ADR-010 `accepted`; H4 (limiares).
- **Risco:** limiar mal calibrado inunda ou esvazia a fila de revisão.
- **Migration:** colunas `temporal_status`, `include_in_prediction`,
  `requires_reprocessing`, `requires_human_review` em `campaign_identity`
  (PLANO §4.1). **Nenhuma flag autocorrige.**
- **Rollback:** colunas aditivas → drop; runtime C0.2 permanece.
- **Aceite:** o caso `livelo→connectmiles` produz `suspect_year` persistido,
  `include_in_prediction=false`, em fila; **sem** autocorreção para 2026-07-12.
- **Testes:** paridade com `evaluateTemporalPlausibility` (runtime); caso canônico
  943; matriz de flags (`valid`/`suspect_*`/`event_far_before`/`conflicting`).

### E1-2 — Criar `campaign_identity` (chave natural sem `vigencia_fim`)
- **Problema:** `id = origem-destino-tipo-vigencia_fim` funde/duplica pela data.
- **Valor:** identidade estável; base de dedup e séries; cura a raiz do 943.
- **Dependência:** E1-1; H1 (composição da chave, ancorada no **início** `±ε`).
- **Risco:** chave larga funde campanhas próximas; estreita fragmenta.
- **Migration:** tabela `campaign_identity` + `natural_key` unique + `legacy_campaign_id`
  ponte (PLANO §4.1); aditiva sobre `campaigns`.
- **Rollback:** drop tabela; `campaigns` intacta.
- **Aceite:** duas leituras da mesma campanha (lançamento/último dia) → **1**
  identidade; chave não muda quando só `vigencia_fim` muda.
- **Testes:** unicidade de `natural_key`; prorrogação não gera nova identidade;
  reprocessamento idempotente.

### E1-3 — Criar `source_observation` e `campaign_version`
- **Problema:** não há como separar "a campanha" de "cada leitura de fonte" nem
  versionar fases (lançamento→prorrogação→último dia).
- **Valor:** `source_count`/confiança reais; republicação não vira nova campanha.
- **Dependência:** E1-2.
- **Risco:** vincular observação à identidade errada polui a série.
- **Migration:** `source_observation` (fk `identity_id`) + `campaign_version`
  (fk `identity_id`, `version_type`) (PLANO §4.1).
- **Rollback:** drop tabelas.
- **Aceite:** N observações → 1 identidade; prorrogação = `campaign_version=prorrogacao`,
  não nova onda; republicação = observação adicional.
- **Testes:** fan-in observações→identidade; versões ordenadas; republicação.

### E1-4 — Persistir `data_evento`/`vigencia_type` + backfill sem autocorreção
- **Problema:** `windowDate` ancora no fim (90% sem início); 142 permanentes
  descartadas silenciosamente; `vigencia_fim` é TEXT com lixo (`na`).
- **Valor:** cadência ancorada no início; permanentes recuperadas como oferta ativa.
- **Dependência:** E1-2; ADR-002; H1.
- **Risco:** backfill que autocorrija violaria o Princípio 2.
- **Migration:** `data_evento`, `data_evento_source`, `data_confidence`,
  `vigencia_type`, `vigencia_raw` (preserva bruto); backfill idempotente.
- **Rollback:** colunas aditivas → drop; `vigencia_raw` garante recomputo.
- **Aceite:** `exact_start>announcement>exact_end`; permanentes viram estado, não onda;
  nenhum registro suspeito reescrito.
- **Testes:** prioridade de datas; permanentes; `vigencia_raw` intacto;
  idempotência do backfill.

---

## Onda S2 — Deduplicação (migration)

*(ADR-009 · Decisões H2, H3)*

### E2-1 — Persistir estados de duplicidade (`duplicate_link`)
- **Problema:** a detecção `probable` é só runtime (C0.3); nada é auditável no banco.
- **Valor:** pares candidatos ficam rastreáveis; base de merge/revisão.
- **Dependência:** S1; H2 (pesos/limiar).
- **Risco:** falso `probable` marca campanhas distintas.
- **Migration:** `duplicate_link` (`state`, `score`, `signals`) unique par
  normalizado (PLANO §4.2).
- **Rollback:** drop tabela; runtime C0.3 permanece.
- **Aceite:** o par 943 fica `probable_duplicate` persistido; `possible` **nunca**
  funde sozinho.
- **Testes:** paridade com `detectProbableDuplicates`; limiares 3/5; par canônico.

### E2-2 — Merge manual auditável + unmerge
- **Problema:** não há como unificar duplicatas no banco de forma reversível.
- **Valor:** cura a duplicata na origem; toda decisão é auditável e reversível.
- **Dependência:** E2-1; H3 (precedência de campos).
- **Risco:** merge indevido perde dado; sem unmerge seria irreversível.
- **Migration:** `merge_audit` **append-only**; `merged_into` em identidade
  (nunca destrói membros) (PLANO §4.2).
- **Rollback:** unmerge reaplica o inverso a partir de `merge_audit`.
- **Aceite:** merge só por humano com justificativa; unmerge restaura membros e
  reverte impacto na série; nenhum merge automático de `possible`.
- **Testes:** merge→unmerge idempotente; precedência de campos (H3); auditoria
  append-only; impacto em série recomputado como `draft`.

### E2-3 — Impacto de dedup em previsões
- **Problema:** merge/unmerge muda ondas e intervalos; snapshots aprovados não podem
  ser reescritos.
- **Valor:** consistência: dedup nunca corrompe um snapshot publicado.
- **Dependência:** E2-2; (prepara S3).
- **Risco:** recomputar sobre snapshot aprovado quebraria reprodutibilidade.
- **Migration:** nenhuma nova (usa `superseded_by` de S3).
- **Rollback:** reverter via unmerge.
- **Aceite:** merge colapsa ondas → novo snapshot `draft`; snapshot aprovado antigo
  vira `superseded`, nunca alterado in-place.
- **Testes:** série pós-merge recomputa; snapshot antigo intacto; `superseded_by` setado.

---

## Onda S3 — Snapshots canônicos (migration)

*(ADR-006, ADR-008, ADR-004, ADR-005 · Decisões H5, H6, H9)*

### E3-1 — Criar `prediction_snapshots` (sucede forecast_/predict_)
- **Problema:** `forecast.json` stale; `predict_snapshots` gravados e não lidos; sem
  reprodutibilidade.
- **Valor:** um snapshot canônico imutável; fim do stale silencioso.
- **Dependência:** S1; H5 (TTL); contrato §18.
- **Risco:** cortar as tabelas antigas cedo demais quebra telas técnicas.
- **Migration:** `prediction_snapshots` (`dataset_hash`, `campaign_ids`,
  `analytic_state`, `expires_at`, `superseded_by`, `result` §18) unique
  `(series_key, as_of)`; adapter lê snapshots antigos na transição (PLANO §4.3/§4.6).
- **Rollback:** drop; motores voltam a `forecast_snapshots`/`predict_snapshots`.
- **Aceite:** série reproduzível de `dataset_hash + campaign_ids + config_version +
  model.version + reconciler_version`; nunca "reler a tabela".
- **Testes:** reprodutibilidade determinística; unicidade `(series_key, as_of)`;
  adapter lê ambos os formatos.

### E3-2 — Reconciliador persistido + divergência
- **Problema:** a recomendação Predict>Forecast é só runtime ("não persistida").
- **Valor:** uma verdade por série, auditável; Daily/Weekly leem o mesmo resultado.
- **Dependência:** E3-1; ADR-008; H9 (`d_max`).
- **Risco:** `d_max` mal calibrado gera revisão de mais/menos.
- **Migration:** `model.selected`/`fallback_used`/`divergence`/`reconciler_version`
  no snapshot.
- **Rollback:** cair para a recomendação runtime do P1.
- **Aceite:** faixas 14/30/60 com janela sobreposta atenuando; guarda o motor perdedor;
  opera **só** sobre série válida+deduplicada (nota canônica ADR-008).
- **Testes:** faixas de divergência; fallback rotulado; reconciler sobre série do 943
  → Não confirmado (não Fev/2029).

### E3-3 — Gates definitivos + outliers sobre série válida
- **Problema:** `backfill_incomplete`/`data_quality_blocked` declarados mas nunca
  atribuídos; outliers não detectados.
- **Valor:** publica só o robusto; 943 e afins ficam visíveis e explicados.
- **Dependência:** E3-1; ADR-004 (H7), ADR-005.
- **Risco:** gate alto esconde sinal raro; baixo republica problema.
- **Migration:** campos de readiness/outlier no `data_quality` do snapshot.
- **Rollback:** manter gates de MVP (≥5 editorial / Predict interno).
- **Aceite:** gates operam **depois** de 010/009; outlier só com ≥6 ondas, rebaixa
  (não apaga); `data_quality_blocked` inclui `suspect_date`/`probable_duplicate`.
- **Testes:** cada gate por finalidade; outlier vs `sparse` vs `regime_change`;
  readiness completo atribuído.

---

## Onda S4 — Aprovação editorial (migration)

*(ADR-006 · Decisão H5)*

### E4-1 — Estados de aprovação persistidos
- **Problema:** nada publica com gate humano persistido; overrides só em runtime.
- **Valor:** governança auditável; nada cru vai ao Digest.
- **Dependência:** S3; ADR-006; reusa `forecast_overrides`.
- **Risco:** TTL mal definido publica aprovação velha.
- **Migration:** `analytic_state` (`draft→review_required→approved→rejected→expired→
  invalidated`) + `approved_by/at`; `snapshot_transition` append-only (PLANO §4.4).
- **Rollback:** drop `snapshot_transition`; estados voltam a conceitual.
- **Aceite:** bloqueio crítico → `invalidated` não overridável; expira por evento
  (nova onda/exclusão/troca de motor/stale); justificativa obrigatória em `rejected`.
- **Testes:** máquina de estados; re-expiração por evento; críticos não overridáveis;
  auditoria append-only.

### E4-2 — "O que mudou" real (diff de snapshots)
- **Problema:** `radarChangeEvents` devolve `unavailable` atrás de `NO_SNAPSHOT_MESSAGE`.
- **Valor:** editor vê o delta real (probabilidade/janela/confiança/aprovação de ontem).
- **Dependência:** E3-1, E4-1.
- **Risco:** granularidade excessiva vira ruído.
- **Migration:** nenhuma nova (consome `prediction_snapshots` + `snapshot_transition`).
- **Rollback:** voltar à mensagem fixa `NO_SNAPSHOT_MESSAGE`.
- **Aceite:** os 13 eventos (D18) derivam de dois snapshots; sem histórico inventado.
- **Testes:** diff de dois snapshots produz os 13 eventos; ausência de snapshot → mensagem.

---

## Onda S5 — Outcomes e calibração (migration)

*(ADR-006 §27d.9, ADR-007 · Decisão H11)*

### E5-1 — `prediction_outcome` (previsto × real)
- **Problema:** só há backtest (mede o modelo), nunca acerto real de produção.
- **Valor:** "taxa de acerto percebida"; base de calibração e de confiança.
- **Dependência:** S3/S4; H11 (janela de resolução).
- **Risco:** resolver com onda-lixo herda o erro que a fase combate.
- **Migration:** `prediction_outcome` (fk snapshot **publicado**; `date_error_days`,
  `window_hit`, `brier_by_horizon`, `bonus_pred_vs_obs`, `expired_without_event`,
  `superseded_before_resolution`) (PLANO §4.5).
- **Rollback:** drop tabela; backtest permanece.
- **Aceite:** só snapshot publicado entra; só onda `valid`+deduplicada resolve;
  `expired_without_event` respeita a janela H11.
- **Testes:** resolução com onda válida; janela de expiração; supersede antes de
  resolver; erro de data e window-hit.

### E5-2 — Calibração (Brier por horizonte)
- **Problema:** probabilidade exposta sem validação de calibração de produção.
- **Valor:** curva de calibração real; insumo para expor probabilidade e automatizar.
- **Dependência:** E5-1; amostra suficiente de outcomes.
- **Risco:** expor acurácia baixa cedo demais.
- **Migration:** agregações derivadas de `prediction_outcome` (view/tabela derivada).
- **Rollback:** ocultar a curva até amostra suficiente.
- **Aceite:** Brier por horizonte agrega outcomes; **não** ajusta o motor
  automaticamente (retroalimentação é humana nesta fase).
- **Testes:** Brier por H; agregação estável; sem auto-ajuste de motor.

---

## Onda S6 — Integrações editoriais (migration parcial)

*(D9, D11, D12, §20, §25 · Decisão H10 · parte do baseline A1 do PR #64, não o recria)*

### E6-1 — Editorial Score persistido e versionado
- **Problema:** priorização da fila é manual/implícita.
- **Valor:** fila ordenada por relevância; nunca ao leitor.
- **Dependência:** S4; D9/H10.
- **Risco:** confundir score com probabilidade.
- **Migration:** `editorial_score` + `editorial_score_version` no snapshot/derivado.
- **Rollback:** ordenar por iminência+confiança (sem score).
- **Aceite:** score interno, explicável (parcelas visíveis), nunca vence bloqueio,
  nunca ao leitor, sem auto-promoção.
- **Testes:** ordenação da fila; bloqueio gata antes do score; ausência ao leitor.

### E6-2 — Daily e Weekly do snapshot aprovado
- **Problema:** Daily manual/divergente; Weekly lê `content/forecast.json` stale.
- **Valor:** ambos leem o **mesmo** snapshot aprovado; fim da divergência Daily×Weekly.
- **Dependência:** E4-1; `prediction_snapshot_usages` (H6); `radar-consistency`.
- **Risco:** falso silêncio; divergir do Daily.
- **Migration:** `prediction_snapshot_usages` (`product`, `edition_id`,
  `presentation_version`); `radar_snapshot_ids[]` em `edition_drafts` (PLANO §4.3).
- **Rollback:** voltar ao artefato `content/forecast.json` (fluxo P1).
- **Aceite:** Daily 7–30d/P30/≤5/ausência honesta; Weekly ≤90d/ranking por score/
  P30+P90/expira na semana; consistência garantida por `radar-consistency`.
- **Testes:** Daily=Weekly sem contradição; ausência → texto honesto;
  `presentation_version` reproduz a edição.

### E6-3 — Admin consolidado (unificação ampla, sobre o baseline A1)
- **Problema:** três telas técnicas ainda divergem; a **unificação estrutural ampla**
  (abas sobre o snapshot) é maior que a correção mínima do A1. A1 já resolve a paridade
  de proveniência do Forecast; S6 unifica as telas.
- **Valor:** uma fonte; a mesma rota nunca aparece com duas janelas.
- **Dependência:** S3/S4; **Gate A1 (#64) concluído** — A1 já **integrado na base**
  (`e7c98ba`); S6 **parte do estado integrado do PR #64**.
- **Baseline A1 (não recriar, não duplicar, não substituir):** tratar
  `lib/ledger-select.ts` (**já na base**) como **baseline de S6**; **preservar**
  `LEDGER_QUALITY_SELECT`; **não duplicar** os SELECTs de Forecast e Radar (fonte única
  compartilhada).
- **Predict:** **revisar separadamente** (fora do escopo do A1) — sua paridade de
  proveniência é item próprio de S6, não do #64.
- **Risco:** remover capacidade das telas técnicas; recriar/duplicar o SELECT do A1.
- **Migration:** nenhuma (consolidação de UI sobre snapshot).
- **Rollback:** manter telas técnicas paralelas (estado P1) + baseline A1.
- **Aceite:** abas Editorial/Análise/Qualidade/Operação/Configuração sobre o snapshot;
  **paridade provada** entre as superfícies (Forecast × Radar × Predict); `LEDGER_
  QUALITY_SELECT` preservado como fonte única; **nenhuma** capacidade removida.
- **Testes:** **regressão partindo do estado integrado do A1**; paridade entre
  superfícies; SELECT não duplicado; **943 não reaberto** (permanece contido); telas
  técnicas preservadas.

---

## Onda S7 — Pro e automação assistida (sem migration nova)

*(D13, ADR-003 · Decisão H8 · usa S5)*

### E7-1 — Pro: curva completa + usadas/excluídas + backtest + outcomes
- **Problema:** leitor Pro sem profundidade nem acerto medido.
- **Valor:** valor imediato; histórico e outcomes quando prontos.
- **Dependência:** S3 (curva), S5 (outcomes).
- **Risco:** escopo inflar; expor acurácia baixa.
- **Migration:** nenhuma (consome snapshot + outcome).
- **Rollback:** Pro sem outcomes (só backtest/metodologia).
- **Aceite:** P7–P180, usadas/excluídas com motivo, backtest, metodologia; outcomes
  só com amostra suficiente.
- **Testes:** curva completa; usadas/excluídas auditáveis; outcomes gated por amostra.

### E7-2 — Pooling rota↔cluster (shrinkage)
- **Problema:** rotas esparsas têm pouca cadência; cluster tem mais amostra.
- **Valor:** cobertura sem esconder falta de dado da rota.
- **Dependência:** S1/S3; ADR-003; H8 (`k`).
- **Risco:** cluster mascarar rota; `k` mal calibrado.
- **Migration:** nenhuma nova (rótulo `resolved_from=pooled` já no §18).
- **Rollback:** só rota ao leitor (sem pooling).
- **Aceite:** `w=n_rota/(n_rota+k)`; fallback **sempre rotulado** ("programa, não
  específica de {origem}"); **nunca** para "resolver" intervalo anômalo.
- **Testes:** shrinkage com `k`; rótulo obrigatório; não aciona em série suspeita.

### E7-3 — Automação assistida (sempre humano)
- **Problema:** promoção manual é lenta; automatizar cedo é arriscado.
- **Valor:** velocidade com segurança; sugestão, nunca publicação automática.
- **Dependência:** S5 (calibração), S6 (aprovação/score).
- **Risco:** excesso de confiança no score.
- **Migration:** nenhuma (marca pauta como "sugerida").
- **Rollback:** promoção 100% manual.
- **Aceite:** zero publicação automática sem gate; bloqueio crítico nunca
  automatizável; auto só após calibração comprovada.
- **Testes:** sugestão não publica sozinha; crítico bloqueia; gate humano obrigatório.

---

## Matriz de dependências entre ondas

```
S0 ─► S1 ─► S2 ─► S3 ─► S4 ─► S5 ─► S6 ─► S7
       │           ▲      │
       └───────────┘      └──► S6 (E6-2 depende de E4-1)
   (S3 depende de S1; S2 prepara superseded p/ S3)
```

- **S1 antes de tudo** (regra-mãe §27f: validação temporal + identidade).
- **S3 antes de S4** (aprovação precisa do snapshot).
- **S4 antes de S6** (Daily/Weekly leem snapshot aprovado).
- **S5 antes de S7** (automação depende de calibração real).

---

## Testes transversais (todas as ondas)

- **Caso canônico 943** (`livelo→connectmiles`): permanece contido/curado em cada onda
  — sem intervalo 943, sem janela 2029.
- **Paridade runtime↔persistido:** cada peça persistida reproduz o comportamento do
  módulo puro correspondente (`campaign-quality`, `radar-view-model`).
- **Idempotência:** backfill e reprocessamento repetíveis sem efeito colateral.
- **Reprodutibilidade:** todo snapshot reconstruível dos campos declarados (§18/§19).
- **Sem autocorreção:** nenhum teste aceita reescrita automática de data suspeita.
- **RLS:** nenhuma tabela nova acessível por `anon`/`authenticated` (Decisão H12).

> **A implementação de qualquer item acima permanece bloqueada até aprovação humana
> explícita das Decisões H1–H12 e da promoção dos ADRs relevantes.**
