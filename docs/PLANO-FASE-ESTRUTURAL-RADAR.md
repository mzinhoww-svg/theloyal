# Plano da Fase Estrutural — Radar Preditivo de Campanhas

> **Natureza deste documento:** arquitetura, decisões e backlog. **Não implementa
> código, não cria migration, não altera banco/dados, não abre PR de
> implementação, não reutiliza a branch do PR #54.** Produzido na branch documental
> `docs/radar-structural-architecture`.
>
> **Hierarquia de verdade herdada:** `THE-LOYALTY-LLM-SYSTEM.md` > `DESIGN.md` >
> guias de marca. No domínio Radar: os ADRs `proposed` (001–010) + `§27f`
> (regra-mãe) precedem qualquer preferência de implementação.
>
> **Regra-mãe (ADR-008 §27f):** *nenhum modelo, motor ou estrutura compensa uma
> cronologia corrompida.* A validação temporal (ADR-010) e a identidade/deduplicação
> (ADR-009) vêm **antes** de tudo o mais nesta fase.
>
> **Documentos-irmãos:** `MATRIZ-ADRS-FASE-ESTRUTURAL.md` (estado de cada ADR e o
> que exige aprovação humana) · `BACKLOG-FASE-ESTRUTURAL-RADAR.md` (ondas S0–S7,
> item a item).

---

## 1. Estado de partida

### 1.1 O que o P1 (mergeado) entregou
Camada de composição e experiência **em runtime** sobre C0/C0.2 + motores
Forecast/Predict, **sem persistência nova**:

- interface unificada (`/admin/radar` + detalhe por `seriesKey`);
- Forecast como baseline; Predict como motor principal; reconciliação **recomendada
  em runtime** (rótulo "não persistida");
- qualidade C0/C0.2 (`assessCampaignQuality`, `.quality`), filtros, filas, detalhe,
  alertas, operação e handoff (`docs/HANDOFF-P1-RADAR.md`).

Fonte única já estabelecida (`RECONCILIACAO-FASE-C0.md`): `campaign-quality` →
`buildForecast`/`buildPredict` (só `eligibleRows`) → `editorialGate` →
`forecast-freshness` → `radar-consistency`. Módulos puros: `radar-view-model`,
`radar-filters`, `radar-detail`, `radar-operations`, `radar-empty`, `radar-vocab`.
I/O só em `lib/admin-radar.ts`.

### 1.2 O que ficou fora do P1 (escopo desta fase)
Identidade persistida · deduplicação auditável · snapshot canônico · aprovação
editorial · histórico · outcomes · calibração · Editorial Score · Daily · Weekly ·
Pro · automação assistida.

### 1.3 O que a fase estrutural **cura** (não apenas contém)
O C0.2 **contém em runtime** o sintoma do caso `livelo→connectmiles` (943 d): a
duplicata com data fabricada (`suspect_year`) sai da série e o par vira "duplicidade
provável". A causa raiz — `id = origem-destino-tipo-vigencia_fim` embutir um campo
mutável/errável — só é **curada** com identidade estável persistida (ADR-009) e
validação temporal na origem (ADR-010).

### 1.4 Base técnica atual (schema relevante já existente)
Migrations aplicadas (`supabase/migrations/`):

| Tabela | Papel hoje | Padrão RLS |
|---|---|---|
| `campaigns` (edge fn `campaigns` v13) | ledger; `id = makeId(origem-destino-tipo-vigencia_fim)` | service_role |
| `predict_snapshots` (`0002_predict_engine_mvp.sql`) | histórico de previsão Predict; `unique (series_key, as_of_date)` | RLS on, policy `service_role` only |
| `forecast_snapshots` (`0001_admin_forecast_predict_area.sql`) | snapshots do Forecast (`payload jsonb`) | RLS on, sem policy anon/auth |
| `forecast_config` | config única (`id=1`) do motor | RLS on |
| `forecast_overrides` | `pin`/`mute`/`confidence` por rota (`unique (scope,route)`) | RLS on |

**Padrão de segurança herdado (inviolável nesta fase):** RLS **ligado**, acesso
apenas por `service_role` (admin server-only). Nenhuma tabela nova pode expor dado a
`anon`/`authenticated` sem decisão humana explícita (ver Decisão H12).

---

## 2. Princípios estruturais invioláveis

Precedem qualquer otimização de esquema. Derivam dos ADRs `proposed` e das regras de
CLAUDE.md.

1. **Proveniência valida, não substitui.** `data_publicacao`/`first_seen`/
   `observed_at`/`created_at` acionam bloqueio/reprocessamento/revisão, mas **nunca**
   entram na série como data de evento e **nunca** autocorrigem uma data (ADR-002,
   ADR-010).
2. **Nunca autocorrigir data.** Data suspeita sai da série (`include_in_prediction=
   false`), fica visível com motivo, entra em fila — jamais é reescrita
   automaticamente (ADR-010).
3. **Identidade não depende de campo mutável.** A chave natural da campanha **não**
   usa `vigencia_fim` (ADR-009).
4. **Merge nunca automático quando a evidência é ambígua.** Só `confirmed_duplicate`
   por revisão humana com justificativa e auditoria; todo merge é **reversível**
   (unmerge) (ADR-009, Decisão-MVP 9).
5. **Snapshot fixa os registros.** Reprodutibilidade por `dataset_hash + campaign_ids
   + config_version + model.version + reconciler_version` — nunca "reler a tabela de
   novo" (ADR-006, §18/§19).
6. **Bloqueio crítico vence qualquer score.** Dataset incompleto, temporal crítico,
   duplicidade provável crítica, programa inválido, stale e expiração **nunca**
   recebem override nem automação (D16, §8.3).
7. **Nada cru vai do motor ao Digest.** Todo resultado passa por qualidade →
   reconciliação → decisão editorial antes de qualquer produto de leitor (D8).
8. **"Publicado" é propriedade do uso, não do snapshot.** Um snapshot `approved`
   alimenta vários produtos sem mudar de estado analítico (§27d.8).
9. **Não criar estrutura sem uso de produto definido.** Cada tabela desta fase aponta
   a decisão de produto que a justifica (D22).
10. **Backtest ≠ outcome.** Backtest mede o modelo (antes de publicar); `prediction_
    outcome` mede o produto (previsto × real). Só o outcome valida calibração de
    produção (§27d.9).

---

## 3. Blocos arquiteturais

Os 17 objetivos, agrupados em sete blocos. Cada bloco fecha o modelo conceitual; o
esquema físico está em §4 (migrations conceituais) e a execução em `BACKLOG`.

### Bloco A — Identidade, observação de fonte e versionamento
*(objetivos 1, 2, 3 · ADR-009, ADR-010, ADR-002)*

Modelo de quatro entidades (ADR-009):

```
campaign_identity   # a campanha real, estável
campaign_version    # versões da mesma identidade no tempo
source_observation  # cada leitura de fonte (N obs → 1 identidade)
campaign_wave       # onda analítica (datas ≤ epsilon colapsadas) usada na série
```

- **`campaign_identity`** — a campanha real e estável.
  - **Chave natural (proposta, Decisão H1):** `origem · destino · tipo · mecânica ·
    segmento` + **janela de vigência RESOLVIDA e validada** (ADR-010), **nunca**
    `vigencia_fim` cru. A janela entra como faixa validada, não como valor mutável —
    é o ponto delicado que exige aprovação (reintroduzir mutabilidade seria regressão).
  - **Campos normalizados:** `origem`/`destino` canonizados por `normProgram`
    (catálogo de programas/aliases — Decisão H também toca aqui), `tipo`, `mecânica`,
    `segmento`, `data_evento` (por prioridade `exact_start > announcement_date >
    exact_end`, ADR-002), `vigencia_type` (`transient|permanent|mixed_anchor`).
  - **Proveniência:** `first_seen`/`observed_at`/`created_at` **não** compõem a chave;
    vivem em `source_observation`.
  - **Reversibilidade:** identidade é derivada e recomputável a partir das
    observações + regras versionadas; nada é destruído (`vigencia_raw` preservado).
  - **Versionamento:** `identity_resolution_version` (versão das regras que
    compuseram a chave) + `config_version`.
- **`campaign_version`** — fases da mesma identidade:
  `lancamento | prorrogacao | ultimo_dia | reedicao | correcao`. Uma prorrogação **não**
  é nova onda nem nova campanha (ADR-010, ADR-009).
- **`source_observation`** — cada leitura de fonte: `url`, `data_publicacao`
  (=`first_seen`), `observed_at`, `texto`, `confianca`, `campaign_version` inferida.
  Base para `source_count` e confiança. Uma **republicação** (mesmo conteúdo, nova
  `data_publicacao`) é observação adicional, **não** nova campanha (ADR-010).
- **`campaign_wave`** — onda analítica; colapsa datas dentro de `wave_epsilon_days`;
  é o que a série consome. Permanentes entram como **estado**, não como onda (ADR-002).

**Validação temporal (ADR-010)** é a porta de entrada: `evaluateTemporalPlausibility
(campaign, provenance)` produz `temporal_status ∈ {valid, missing_event_date,
suspect_year, suspect_month, suspect_day_month, event_far_before_source,
event_after_source, conflicting_event_dates, invalid_date}`, com `include_in_
prediction`, `requires_reprocessing`, `requires_human_review`. **Nenhuma flag
autocorrige.**

### Bloco B — Deduplicação e merge auditável
*(objetivos 4, 5 · ADR-009)*

Estados de duplicidade (por par de registros):

```
unique · possible_duplicate · probable_duplicate ·
confirmed_duplicate · merged · rejected_duplicate
```

- **`possible` / `probable`:** critérios **ponderados, nunca um só** — origem,
  destino, tipo, bônus (base/máx), mecânica, segmento, similaridade de título/texto,
  URLs (domínio/artigo), datas de publicação/observadas, fontes, **proximidade
  temporal** e relação textual "lançamento/último dia/prorrogação". Pesos e limiares
  são **Decisão H2**.
- **`confirmed` / `rejected`:** só por **revisão humana** com justificativa. `possible`
  **nunca** funde sozinho.
- **`merged` (merge manual):** unifica registros numa identidade; **só** com estrutura
  persistida (esta fase). Requer justificativa + auditoria.
- **`unmerge`:** todo merge é **reversível**; o unmerge restaura os registros
  originais e reverte o impacto em séries. É requisito de design, não recurso opcional.
- **Auditoria:** tabela append-only de decisões (`merge`/`unmerge`/`reject`) com
  ator, timestamp, justificativa, `dataset_hash` afetado.
- **Precedência de campos no merge (Decisão H3):** quando dois registros divergem, qual
  valor prevalece por campo — proposta: `data_evento` do registro `valid` sobre o
  `suspect_*`; bônus do registro de maior confiança de fonte; texto/URL acumulados em
  `source_observation`; `vigencia_raw` de ambos preservado. **Nunca** média cega.
- **Impacto em previsões:** um merge colapsa ondas → recomputa a série afetada →
  gera novo snapshot `draft` (nunca altera snapshot já aprovado/publicado; usa
  `superseded_by`). O unmerge reexecuta o mesmo caminho no sentido inverso.

### Bloco C — Snapshot canônico
*(objetivo 6, 7 · ADR-006, §18, §19)*

Três recortes de um mesmo snapshot canônico:

- **Snapshot de cálculo (`generated`):** estado analítico bruto, imutável, produzido
  pelo pipeline. Fixa `dataset_hash`, `campaign_ids`, `config_version`,
  `model.version`, `reconciler_version`, `as_of`, `result` (contrato §18),
  `backtest`, `data_quality`.
- **Snapshot aprovado (`approved`):** o mesmo objeto após decisão editorial (Bloco D);
  ganha `approved_at`/`approved_by`. **Não** vira "published".
- **Snapshot publicado:** **não é estado do snapshot** — é `prediction_snapshot_usages`
  (`snapshot_id · product · edition_id · selected_at/by · published_at ·
  presentation_version`). Um `approved` alimenta Daily+Weekly+Pro sem mudar de estado.

Campos-âncora obrigatórios (§18): `series_key`, `series_type`, `as_of`, **`dataset_
hash`**, **`campaign_ids`**, `model.selected` (**origem do motor**: `predict`/
`forecast`/`none` + `fallback_used`), `readiness`, `confidence`, `editorial_status`,
**`expires_at`**, `superseded_by`. Mais: `generated_at`, `approved_at` (quando houver),
**`divergence`** (Forecast×Predict; `d_max` — Decisão H9) e **qualidade** (`data_
quality`: totais/elegíveis/excluídas/outliers/`backfill_completeness`).

- **`dataset_hash`:** sha256 sobre o conjunto exato de registros usados (composição a
  fixar — Decisão H também toca reprodutibilidade determinística).
- **`generated_at` / `approved_at` / `expires_at`:** frescor honesto; expiração curta
  (~7 d proposto — Decisão H5) + freshness gate no render.
- **`divergência`:** faixa Forecast×Predict (≤14 compatível · 15–30 warning · >30
  revisão · >60 bloqueio; janela sobreposta atenua uma faixa — herdado da Decisão-MVP 2).
- **`origem do motor`:** metadado de proveniência; o leitor nunca vê o nome técnico.

Sucessão: `prediction_snapshots` (nova) **sucede/unifica** `forecast_snapshots` +
`predict_snapshots` — compatibilidade e coexistência tratadas em §4.6.

### Bloco D — Aprovação editorial e expiração
*(objetivos 8, 9, 10 · ADR-006, D10, D17)*

Estados persistidos:

```
draft → review_required → approved → published(*)
              ↘ rejected        ↘ expired
              ↘ invalidated (por bloqueio crítico / mudança material)
```

`(*) published` é registrada via `prediction_snapshot_usages` (o snapshot permanece
`approved`).

- **`draft`:** resultado recém-calculado, sem decisão.
- **`review_required`:** `ready_with_warnings`, divergência 15–60, override pendente.
- **`approved`:** editor aprovou; ganha TTL (Decisão H5).
- **`rejected`:** editor recusou (justificativa **obrigatória**).
- **`expired`:** passou do `expires_at` **ou** re-expirou por evento (nova onda,
  exclusão, troca de motor, `datasetComplete=false`, artefato `stale`).
- **`invalidated`:** bloqueio crítico superveniente (níveis 1–4, 9, 11 de §8.3) — **não
  overridável**.
- **Histórico:** toda transição é append-only (`snapshot_id`, de→para, ator,
  timestamp, justificativa) → base do "o que mudou" (13 eventos, D18) e da auditoria.

### Bloco E — Outcomes, calibração e retroalimentação
*(objetivos 11, 12 · §27d.9, D14 Pro, Ev.4)*

`prediction_outcome` por snapshot publicado, resolvido contra a **próxima onda real**:

| Campo | Mede |
|---|---|
| `evento_real` (observed wave) | a onda que resolveu a previsão |
| `date_error_days` | `|central − real|` (**erro de data**) |
| `window_hit` | real ∈ `[start,end]`? (**janela acertada**) |
| `brier_by_horizon` | probabilidade vs evento binário por H (**calibração**) |
| `bonus_pred_vs_obs` | **acurácia de bônus** (previsto × observado) |
| `time_to_event` | real − `as_of` |
| `expired_without_event` | previsão venceu sem onda |
| `superseded_before_resolution` | novo snapshot substituiu antes de resolver |

- **Previsão avaliada:** só snapshots **publicados** (via `usages`) entram no outcome
  — mede produto, não modelo.
- **Janela de resolução (Decisão H11):** quanto esperar antes de declarar
  `expired_without_event`; o que conta como "onda real" que resolve (precisa ser onda
  `valid` e deduplicada, senão o outcome herda o lixo que a fase inteira combate).
- **Calibração:** Brier por horizonte agrega os outcomes → curva de calibração de
  produção. Alimenta a decisão de expor probabilidade e de automatizar (Ev.5).
- **Retroalimentação:** o outcome **não** ajusta o motor automaticamente nesta fase;
  informa a revisão de gates/limiares (humana) e a confiança editorial. Auto-ajuste é
  fase posterior, só após calibração comprovada.

### Bloco F — Editorial Score
*(objetivo 13 · D9, Decisão-MVP 3)*

- **Finalidade:** ordenar a **fila do editor** ("o que merece atenção hoje"). É
  auxílio de priorização, **não** métrica de leitor.
- **Entradas:** iminência da janela, confiança do modelo, magnitude do bônus vs
  típico, relevância editorial do programa, "o que mudou".
- **Pesos:** versionados (`editorial_score_version`) — existência e pesos são
  **Decisão H10**.
- **Limites / bloqueios:** os bloqueios críticos de §8.3 **gatam antes** e **não**
  entram no score. Um score alto **nunca** supera um bloqueio.
- **Explicabilidade:** cada score expõe suas parcelas (por que esta série está no topo).
- **Não substituição de probabilidade:** o score **não** é chance, **não** vai ao
  leitor, **não** promove pauta automaticamente (semi-automático — humano decide).

### Bloco G — Produtos (contratos)
*(objetivos 14, 15, 16, 17 · D11–D14, §20)*

Todos consomem **o mesmo snapshot reconciliado** (§18). Nunca motores diferentes por
produto; nunca duas janelas concorrentes.

- **Admin Radar** — abas Editorial (fila de aprovação por Editorial Score) · Análise
  (Forecast×Predict, divergência, backtest) · Qualidade · Operação · Configuração.
  Consolida `/admin/forecast` + `/admin/predict` + parte de `/admin/observability`
  **sem remover** as telas técnicas (migração incremental — resolve a dívida A1, §5).
- **Daily** — horizonte 7–30 d; **só fresco + elegível + aprovado**; **P30** (faixa
  arredondada); máx 3–5; ausência → texto honesto "sem janelas relevantes hoje". TTL
  de aprovação 24 h.
- **Weekly** — horizonte ≤90 d; ranking por Editorial Score; 5–10 séries; deltas da
  semana; **consistente com o Daily** (`radar-consistency`); **P30+P90**; TTL 7 d;
  expira ao fim da semana. Séries bloqueadas relevantes aparecem como "em observação".
- **Pro** — curva completa (P7–P180); campanhas usadas/excluídas com motivo; backtest
  por série; metodologia. **Visão futura:** timeline, histórico de previsões e
  **outcomes** (previsto × real — depende do Bloco E).
- **Automação assistida (objetivo 17):** promoção **sugerida** por Editorial Score,
  **sempre com humano**; auto só após calibração provada (outcomes). Zero publicação
  automática sem gate.

---

## 4. Migrations conceituais (sem SQL nesta etapa)

Desenho conceitual apenas — **não** escrever DDL agora. Cada tabela aponta a decisão
de produto que a justifica (Princípio 9). Padrão herdado: **RLS ligado, acesso
service_role** (revisitado na Decisão H12).

### 4.1 Identidade e observação (S1)
- **`campaign_identity`** — colunas: `id` (uuid, **derivado da chave natural, não de
  `vigencia_fim`**), `natural_key` (texto canônico), `origem`, `destino`, `tipo`,
  `mecanica`, `segmento`, `data_evento`, `data_evento_source`, `data_confidence`,
  `vigencia_type`, `vigencia_inicio`, `vigencia_fim`, `vigencia_raw`,
  `temporal_status`, `include_in_prediction`, `identity_resolution_version`,
  `created_at`. **Chaves/constraints:** unique em `natural_key`; check em
  `vigencia_type`/`temporal_status`. **Índices:** `(destino, data_evento desc)`,
  `(origem, destino)`. **RLS:** service_role. **Backfill:** recomputar identidade a
  partir de `campaigns` + observações (regras versionadas). **Rollback:** drop tabela;
  `campaigns` intacta (aditivo). **Compatibilidade:** `campaigns.id` legado mapeado por
  coluna-ponte `legacy_campaign_id` até paridade.
- **`source_observation`** — `id`, `identity_id` (fk → `campaign_identity`), `url`,
  `data_publicacao`, `observed_at`, `created_at`, `texto_hash`, `confianca`,
  `campaign_version`, `legacy_campaign_id`. **Índices:** `(identity_id)`,
  `(data_publicacao)`. **RLS:** service_role. **N observações → 1 identidade.**
- **`campaign_version`** — `id`, `identity_id` (fk), `version_type`
  (`lancamento|prorrogacao|ultimo_dia|reedicao|correcao`), `vigencia_fim`,
  `effective_from`, `source_observation_id` (fk). **Compat:** aditivo.

### 4.2 Deduplicação e merge (S2)
- **`duplicate_link`** — par de registros: `id`, `left_id`, `right_id`, `state`
  (`possible|probable|confirmed|rejected|merged`), `score`, `signals` (jsonb),
  `decided_by`, `decided_at`, `justification`. **Constraint:** unique `(left_id,
  right_id)` normalizado. **Índice:** `(state)`.
- **`merge_audit`** — **append-only**: `id`, `action` (`merge|unmerge|reject`),
  `identity_id`, `member_ids` (jsonb), `field_precedence` (jsonb — Decisão H3), `actor`,
  `at`, `justification`, `dataset_hash_before/after`. **Rollback do merge:** unmerge
  reaplica o inverso a partir deste registro. **Compat:** merge nunca destrói membros;
  só marca `merged_into`.

### 4.3 Snapshot canônico (S3)
- **`prediction_snapshots`** (sucede `forecast_snapshots` + `predict_snapshots`) —
  `id`, `series_key`, `series_type`, `resolved_from`, `as_of`, **`dataset_hash`**,
  **`campaign_ids`** (jsonb/array), `config` + `config_version`, `model` +
  `model_version`, **`reconciler_version`**, `result` (jsonb — contrato §18),
  `backtest`, `data_quality`, `overrides`, `divergence`, `generated_at`,
  `analytic_state` (`generated|needs_review|approved|rejected|expired|superseded`),
  **`expires_at`**, `superseded_by`, `created_by`, `approved_by`, `approved_at`.
  **Constraint:** unique `(series_key, as_of)`; check em `analytic_state`. **Índices:**
  `(series_key, as_of desc)`, `(analytic_state)`, `(expires_at)`. **Compat:** ler os
  snapshots antigos por adapter durante a transição; não apagar as tabelas antigas até
  paridade (§4.6). **Rollback:** drop; motores voltam a gravar nas tabelas antigas.
- **`prediction_snapshot_usages`** — `id`, `snapshot_id` (fk), `product`
  (`daily|weekly|pro|admin`), `edition_id`, `selected_at`, `selected_by`,
  `published_at`, `presentation_version` (granularidade — Decisão H6). **Índice:**
  `(snapshot_id)`, `(product, published_at)`.

### 4.4 Aprovação e histórico (S4)
- **`snapshot_transition`** — **append-only**: `id`, `snapshot_id` (fk), `from_state`,
  `to_state`, `actor`, `at`, `justification`, `reason_code`. Base do "o que mudou" e
  da auditoria. **Reuso:** `forecast_overrides` (pin/mute/confidence com nota) é a base
  do mecanismo de override — **não** criar sistema paralelo.

### 4.5 Outcomes (S5)
- **`prediction_outcome`** — `id`, `snapshot_id` (fk, snapshot **publicado**),
  `resolved_wave_id`, `date_error_days`, `window_hit`, `brier_by_horizon` (jsonb),
  `bonus_pred_vs_obs` (jsonb), `time_to_event`, `expired_without_event`,
  `superseded_before_resolution`, `resolved_at`, `resolution_window_version`
  (Decisão H11). **Índice:** `(snapshot_id)`, `(resolved_at)`.

### 4.6 Compatibilidade e convivência
- **Aditivo primeiro:** nenhuma tabela existente é alterada destrutivamente; novas
  tabelas convivem com `campaigns`/`forecast_*`/`predict_snapshots`.
- **Ponte legada:** `legacy_campaign_id` liga identidade ↔ ledger atual; adapter de
  leitura permite ao Radar consumir snapshot novo **ou** antigo durante a transição.
- **Corte controlado:** só depois de paridade comprovada (testes + reprodução do caso
  943) os motores passam a gravar em `prediction_snapshots`; as telas técnicas legadas
  seguem até a unificação (dívida A1).
- **Backfill:** reprocessa `campaigns` → identidade/observações/versões com regras
  versionadas; idempotente; **nunca** autocorrige data (registros suspeitos ficam
  `include_in_prediction=false`, em fila).

---

## 5. Dependências externas ao plano

| Dependência | Estado | Como afeta a fase |
|---|---|---|
| **Dívida A1** (paridade de colunas / unificação das telas técnicas) | Registrada em `VERIFICACAO-FINAL-P1-RADAR.md §15`; **não** há "resultado do A1" como artefato — A1 **é** o trabalho de unificação | Absorvida na onda **S6** (Admin Radar consolidado). Enquanto não fechada, `/admin/forecast` legado (7 colunas, sem proveniência) pode exibir o 943 — o Radar segue a superfície correta |
| **Relatório pós-merge** | **Não disponível** no repositório nesta data | Onda **S0** condiciona o arranque à sua leitura; se ausente, S0 registra a lacuna e não avança para S1 sem ela |
| **Resultado do A1** | Idem — A1 é dívida, não entregável separado | Ver acima |
| Survey da implementação atual | Levantado nesta fase (módulos puros + schema) | Base do §1.4 e das migrations conceituais |

Enquanto o relatório pós-merge e o fechamento do A1 não estiverem disponíveis, a
implementação permanece **bloqueada** (ver Handoff).

---

## 6. Roadmap em ondas (síntese)

Detalhe item a item — com problema, valor, dependência, risco, migration, rollback,
aceite e testes — em `BACKLOG-FASE-ESTRUTURAL-RADAR.md`.

| Onda | Nome | Entrega estrutural | Migration? | Depende de |
|---|---|---|---|---|
| **S0** | Preparação | ler relatório pós-merge + A1; congelar decisões H; promover ADRs aprovados; ambiente de branch de dados | não | aprovação humana das Decisões H |
| **S1** | Identidade e observações | `campaign_identity`, `source_observation`, `campaign_version`; validação temporal na origem (ADR-010) | sim | H1, H4; ADR-009/010/002 |
| **S2** | Deduplicação | `duplicate_link`, `merge_audit`; merge manual + unmerge auditável | sim | S1; H2, H3 |
| **S3** | Snapshots | `prediction_snapshots` + `usages`; `dataset_hash`; reconciler persistido | sim | S1; H5, H6, H9 |
| **S4** | Aprovação | estados persistidos + `snapshot_transition`; "o que mudou" real | sim | S3; H5 |
| **S5** | Outcomes | `prediction_outcome`; calibração (Brier) | sim | S3/S4; H11 |
| **S6** | Integrações editoriais | Daily/Weekly/Pro lendo o snapshot aprovado; Admin consolidado (fecha A1); Editorial Score persistido | parcial | S4; H10 |
| **S7** | Pro e automação | curva completa + outcomes ao Pro; automação **assistida** (humano) | não (usa S5) | S5/S6; H8-MVP |

Ordem inviolável: **S1/validação temporal antes de tudo** (regra-mãe §27f). Snapshot
(S3) antes de aprovação (S4) antes de Daily/Weekly (S6) antes de automação (S7).

---

## 7. Decisões humanas (máx. 12)

Nenhuma é decidida por engenharia sozinha; nenhuma promove ADR automaticamente. As 9
decisões do MVP (`APROVACAO-MVP-RADAR.md`) já estão fechadas — estas **12 são as da
fase estrutural**, mais finas (persistência, limiares, esquema).

| # | Decisão | Recomendação | Alternativa | Risco | Reversibilidade | Impacto | ADR |
|---|---|---|---|---|---|---|---|
| **H1** | Composição final da `campaign_identity` (chave natural) | `origem·destino·tipo·mecânica·segmento` + janela **resolvida/validada** (ADR-010), nunca `vigencia_fim` cru | incluir `data_evento` discretizada (mês) na chave | chave larga funde campanhas próximas; chave estreita fragmenta | Média (recomputável, `vigencia_raw` preservado) | Alto — base de dedup e séries | 009/010/002 |
| **H2** | Pesos e limiares de `possible`/`probable` | conjunto ponderado inicial + limiar calibrável; `probable` bloqueia intervalo | limiar único simples | falso `probable` funde distintas; falso `unique` mantém duplicata | Alta (config) | Alto — qualidade da série | 009 |
| **H3** | Precedência de campos no merge + unmerge | `data_evento` do `valid` sobre `suspect`; bônus por confiança de fonte; texto/URL acumulados; nunca média cega; unmerge sempre disponível | precedência por recência de observação | perda de dado no merge se precedência errada | Alta (unmerge reverte) | Alto — auditoria de dedup | 009 |
| **H4** | Limiares de validação temporal | `suspect_year` 548 d · `event_far_before` 365 d · `suspect_month/day` k·MAD | limiares mais frouxos (menos revisão) | alto = passa erro; baixo = inunda fila | Alta (config) | Alto — cronologia da série | 010 |
| **H5** | TTL de snapshot/aprovação + re-expiração por evento | cálculo 24 h; aprovação Daily 24 h / Weekly 7 d; re-expira por nova onda/exclusão/troca de motor/stale | TTL fixo 3 d para tudo | curto = recalcula muito; longo = publica velho | Alta (parâmetros) | Médio — frescor | 006 |
| **H6** | Granularidade de `presentation_version` e escopo de `usages` | por (produto, edição), versionando apresentação | rastrear só publicação sem versão | granular demais = ruído; grosso = perde reprodução por edição | Alta | Médio — medição de uso | 006 |
| **H7** | Gates de amostra definitivos | Forecast pub. ≥5 · Predict pub. ≥6 · alta ≥10 (ADR-004) | manter 5/gate interno do Predict | alto = esconde sinal raro; baixo = republica problema | Alta (config) | Médio — cobertura publicável | 004 |
| **H8** | `k`/limiar de shrinkage rota↔cluster (pooling) | `k=4` provisório; `w=n_rota/(n_rota+k)`; fallback sempre rotulado | só rota ao leitor (sem pooling) | cluster mascara rota; `k` mal calibrado | Alta | Médio — cobertura vs especificidade | 003 |
| **H9** | `d_max` definitivo + persistir `reconciler_version` | faixas 14/30/60 sobre o centro, janela sobreposta atenua; persistir versão do reconciliador | limiar único 30 d | faixas mal calibradas = revisão de mais/menos | Alta | Alto — reconciliação auditável | 008 |
| **H10** | Existência e pesos versionados do Editorial Score | interno, versionado, nunca ao leitor, nunca vence bloqueio | não ter score; ordenar por iminência+confiança | confundir com probabilidade | Alta | Médio — priorização editorial | (D9) |
| **H11** | Janela de resolução de outcome | esperar até `expires_at`+margem; só onda `valid`+deduplicada resolve | resolver na primeira onda qualquer | resolver com lixo herda erro que a fase combate | Média (recomputável) | Alto — calibração de produção | 006/§27d.9 |
| **H12** | Modelo RLS/permissões e auditoria das novas tabelas | manter service_role-only; auditoria **append-only**; papéis editor/operador na app, não no banco | policies por papel no banco | expor dado editorial cedo; auditoria mutável | Média | Alto — segurança/governança | (herda C0) |

> **Regra:** enquanto H1–H12 não forem aprovadas, as ondas S1+ não iniciam. Nenhuma
> destas altera um ADR — são o **insumo** para promovê-los de `proposed` a `accepted`.

---

## 8. Riscos estruturais

- **Reintroduzir mutabilidade na chave** (H1) — mitigado por usar janela **validada**,
  não `vigencia_fim` cru, e por identidade recomputável.
- **Merge indevido** — mitigado por nunca fundir automático + unmerge + auditoria.
- **Backfill autocorrigindo data** — proibido; registros suspeitos ficam fora da série
  em fila (Princípio 2).
- **Snapshot stale persistido** — mitigado por `expires_at` + freshness gate + re-
  expiração por evento.
- **Outcome herdando lixo** — mitigado por só resolver com onda `valid`+deduplicada (H11).
- **Corrida com a dívida A1** — telas legadas seguem até a unificação em S6; o Radar
  continua a superfície correta.
- **Score confundido com probabilidade** — interno, rotulado, nunca ao leitor.
- **Expor acurácia baixa cedo** — outcomes ao Pro só depois de amostra suficiente (S7).

---

## 9. HANDOFF PARA RADAR PROGRAM COORDINATOR

- **Chat:** Radar Structural Architecture
- **Estado:** planejamento estrutural **concluído** (arquitetura + matriz de ADRs +
  backlog). **Nenhum** código, migration, banco ou PR de implementação. Implementação
  **bloqueada** até aprovação humana.
- **Branch:** `docs/radar-structural-architecture` (documental, nova — **não** reutiliza
  a branch do PR #54).
- **PR:** documental, separado, aberto como **draft**, **sem merge** (a abrir ao final).
- **Documentos:** `docs/PLANO-FASE-ESTRUTURAL-RADAR.md` (este) ·
  `docs/MATRIZ-ADRS-FASE-ESTRUTURAL.md` · `docs/BACKLOG-FASE-ESTRUTURAL-RADAR.md`.
- **ADRs a aprovar (todos `proposed` → exigem aprovação humana):** ADR-RADAR-001 a 010.
  **Prioridade da fase:** 010 (validação temporal) e 009 (identidade/dedup) primeiro —
  regra-mãe §27f. Nenhum foi promovido automaticamente (ver matriz).
- **Decisões humanas:** H1–H12 (§7). Bloqueiam as ondas S1+. As 9 decisões de MVP já
  estão fechadas (`APROVACAO-MVP-RADAR.md`).
- **Migrations propostas (conceituais, sem SQL):** `campaign_identity`,
  `source_observation`, `campaign_version`, `duplicate_link`, `merge_audit`,
  `prediction_snapshots` (+`usages`), `snapshot_transition`, `prediction_outcome`.
  Aditivas; RLS service_role; rollback por drop; backfill idempotente sem autocorreção.
- **Ondas:** S0 preparação → S1 identidade/observações → S2 deduplicação → S3 snapshots
  → S4 aprovação → S5 outcomes → S6 integrações editoriais (fecha A1) → S7 Pro e
  automação assistida.
- **Dependências do A1:** A1 é dívida de unificação das telas técnicas (não um
  entregável separado); absorvida em S6. Não há "resultado do A1" a aguardar além do
  próprio trabalho de unificação.
- **Dependências da validação pós-merge:** relatório pós-merge **não disponível** nesta
  data; S0 condiciona o arranque à sua leitura. Sem ele, não avançar de S0 para S1.
- **Riscos:** §8 (mutabilidade de chave, merge indevido, backfill autocorrigindo,
  snapshot stale, outcome com lixo, corrida A1, score×probabilidade, acurácia cedo).
- **Implementação autorizada:** **NÃO.** Permanece **bloqueada** até aprovação humana
  explícita das Decisões H1–H12 e da promoção dos ADRs relevantes.
- **Recomendação:** aprovar primeiro **H1, H3, H4** (identidade + merge + temporal) e
  promover **ADR-010 e ADR-009**; iniciar **S0** só após o relatório pós-merge; tratar
  S1/validação temporal como pré-requisito de todas as ondas seguintes; manter merge
  sempre manual/reversível e backfill sem autocorreção.

> **A implementação deve permanecer bloqueada até aprovação humana explícita.**
