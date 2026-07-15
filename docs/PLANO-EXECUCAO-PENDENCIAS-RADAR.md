# Plano de Execução — Pendências do Radar/Digests

> Plano **executável** do que resta, cruzando o **diagnóstico** e o **backlog** com o
> **código atual do `main`**. Sucede a Política Canônica do Radar (mergeada) e a Régua
> de Publicação (já implementada). Foca **apenas no que está aberto**.
>
> **Fontes:** `BACKLOG-FASE-ESTRUTURAL-RADAR.md` (E0–E7), `DECISOES-PRODUTO-RADAR.md`
> (D1–D18), `MONETIZACAO-BACKLOG.md`, `plano-melhorias-forecast-predict.md`,
> `REGUA-PUBLICACAO-DIGESTS.md`, ADR-RADAR-001…010, e verificação direta do código.
>
> **Regra de preservação:** reusa a fundação (campaign-quality → forecast/predict →
> reconciliação → régua). Nenhuma segunda fonte de verdade; nenhum motor reescrito.

## 0. Linha de base — o que JÁ está feito (não replanejar)

Verificado em código:

- **Política Canônica do Radar** (Predict canônico, fallback rotulado, nota de corte
  `readerPublishable`, reconciliação override-aware, reader-radar do resultado canônico).
- **Régua de Publicação — Fases 0–3**: gate unificado (`scripts/lib/disposition.mjs`,
  wired em `validate.mjs`), tiers de fonte (`resolveTier` + `content/entities`),
  score + reconciliação `Σ(crit×peso)==tlScore` (`scripts/lib/score.mjs`), motor de
  acurácia read-only (`scripts/accuracy.mjs`), thresholds adaptativos
  (`content/ruler-config.json`), publisher que só publica faixa A
  (`beehiiv-publish.mjs`).
- **Consolidação rastreável Weekly←Daily** (`scripts/lib/weekly-consolidate.mjs`,
  flag `consolidateFromDaily`, `sourceEditions`) — **premissa 5 fechada**.
- **Ledger de exceções** append-only (`scripts/lib/exceptions.mjs`) + log de publicação.
- **Radar P1** (`/admin/radar` unificado) e a **camada de aquisição de monetização**
  (Pro waitlist, `/anuncie`, VPM/shopping-VPM).

## 1. Sequência recomendada (visão)

```
FASE A (sem migration)  →  FASE B (estrutural, migration + ADR)  →  FASE C (monetização)
   destrava já              gated por [APROVAÇÃO HUMANA] H1–H12
```

**Gate duro da Fase B (não começar sem):** fechar as decisões **H1–H12**
(`BACKLOG-FASE-ESTRUTURAL-RADAR.md` E0-2) e **promover as ADRs 001–007, 009, 010** de
`proposed` a `accepted` (só a 008 está aceita). Migrations **nunca** são aplicadas em
produção como parte de um merge — vão como arquivo + revisão + passo de deploy.

---

## FASE A — Sem migration (destravável já)

> **Status de execução (2026-07-15):** A1 **feito** · A2 **feito** · A5 **já estava
> feito** (PR #76) · **A3 e A4 reclassificados** como modelagem probabilística que
> NÃO deve entrar por auto-merge num motor voltado ao leitor sem um design com
> backtest — ver nota abaixo.

Alto valor, baixo risco, sem tocar banco. Cada item reusa o que existe.

### A1 — Daily lê o radar canônico (hoje é só cross-check)
- **Problema (diag.):** `render-daily.mjs` não referencia radar; `render.mjs` renderiza
  `ed.radar.windows` do JSON da edição. O `digest.radarDaily` canônico só é usado como
  **validação** (`validate.mjs` `validateRadarConsistency`), não como **fonte**. O Daily
  segue autorado à mão. (E6-2, parte sem-migration.)
- **Comportamento:** quando a edição não trouxer `radar` manual, o Daily puxa
  `digest.radarDaily` (resultado canônico, nota de corte aplicada) — espelhando o que a
  Weekly já faz em `resolveRadar`. Ausência → texto honesto ("sem janelas hoje").
- **Reusa:** `buildReaderRadar` / `digest.radarDaily`, padrão `resolveRadar` da Weekly.
- **Arquivos:** `scripts/render-daily.mjs` (ou `render.mjs`), `scripts/validate-daily.mjs`.
- **Risco:** baixo (mesma nota de corte já enforçada). **Aceite:** Daily sem radar manual
  usa o canônico; nunca janela < média. **Testes:** paridade Daily×artefato; ausência→texto.

### A2 — Chip "monitoramento" ao leitor
- **Problema:** disposição já rastreia/enforça, mas o leitor ainda vê `nao-confirmado`
  onde deveria ver **"em monitoramento"** (deferido no plano da régua, linhas 35-37).
- **Comportamento:** série real sem previsão publicável (readerSurface="monitoring")
  renderiza chip **"Em monitoramento"** distinto de "Não confirmado".
- **Reusa:** `readerSurface`/`radarMonitoringWeekly`, vocabulário TL.
- **Arquivos:** render (email/web/plain), `components/` do veredito. **Risco:** baixo
  (render-only). **Aceite:** chip presente, cor semântica correta, sem promessa.

> **Nota A3/A4 (por que não entram por auto-merge agora):** ambos mudam a
> **matemática de um motor voltado ao leitor**. A nota de corte + backtest protegem
> contra publicar confiança baixa, mas um **bug de calibração** (ex.: pooling ou
> sazonal que ELEVA a confiança sem suporte real) pode passar o corte e publicar uma
> janela errada. Isso exige um design com **backtest walk-forward validado sobre o
> ledger real** antes de ligar — não um heurístico rápido. Recomendação: cada um vira
> um design doc + implementação atrás de flag (default off, paridade provada), ligado
> só após o backtest não piorar. A3 é explicitamente "modelo v3" (RFC-009).

### A3 — Componente sazonal no Predict
- **Problema (diag.):** hazard não modela sazonalidade; séries sazonais saem com
  confiança ≤ média + warning (`plano-melhorias-forecast-predict.md`). Ausente em
  `lib/predict-engine.ts` (grep `sazonal/seasonal`=0).
- **Comportamento:** componente sazonal opcional (ex.: ajuste por mês/trimestre sobre o
  hazard) que **eleva confiança apenas quando o padrão sazonal é estatisticamente
  sustentado**; senão mantém o warning. Espelhar no `.mjs` do pipeline.
- **Reusa:** `predict-engine` (Modelo A). **Arquivos:** `lib/predict-engine.ts` (+ espelho).
- **Risco:** médio (matemática nova; manter determinístico e testável). **Aceite:**
  backtest não piora; sazonais ganham janela mais estreita só com suporte. **Testes:**
  série sazonal sintética vs irregular.

### A4 — Shrinkage rota×cluster (k pooling)
- **Problema (diag.):** hoje é só fallback rotulado (`scope route|cluster`); sem
  `w = n_rota/(n_rota+k)` (ADR-003, E7-2). O rótulo `resolved_from=pooled` já cabe no
  contrato §18 — **sem migration**.
- **Comportamento:** rota esparsa combina com o cluster por shrinkage (`k=4` provisório,
  de `ruler-config.json`); saída rotulada "previsão do programa, não específica de {origem}".
- **Reusa:** predict-engine, config externalizada. **Arquivos:** `lib/predict-engine.ts`,
  `content/ruler-config.json`. **Risco:** médio. **Aceite:** rota esparsa vira publicável
  via pooling, sempre rotulada; nunca silencioso. **Testes:** rota 2 ondas + cluster denso.

### A5 — Paridade de colunas nas telas legadas (dívida A1)
- **Problema (diag.):** `/admin/forecast` e `/admin/predict` ainda leem 7 colunas → o
  intervalo de 943 dias pode ressurgir (`ENCERRAMENTO-RADAR-P1.md §6`). `lib/ledger-select`
  já tem o baseline; falta unificar as telas.
- **Comportamento:** telas legadas passam a usar `LEDGER_QUALITY_SELECT` (proveniência)
  como o Radar. **Reusa:** `lib/ledger-select.ts`. **Risco:** baixo. **Aceite:** 943 não
  aparece em nenhuma tela. **Testes:** regressão do caso 943 nas telas.

---

## FASE B — Estrutural (migration + ADR promovido)

> **Gate:** só após fechar H1–H12 e promover ADR-001–007/009/010. Migrations como
> arquivo SQL + revisão; aplicação em prod é passo de deploy, nunca auto-merge.

Ordem por dependência (espelha S1–S7 do `BACKLOG-FASE-ESTRUTURAL-RADAR.md`):

| # | Item | Fecha | Estrutura (nova) | ADR | Depende |
|---|---|---|---|---|---|
| **B1** | Identidade + dedup persistidas | raiz do 943 curada no banco | `campaign_identity`, `campaign_version`, `source_observation`, `duplicate_link`, `merge_audit` | 009 | H1–H3 |
| **B2** | Validação temporal na borda + modelo de vigência | data correta gravada, não só contida | `temporal_status`/`include_in_prediction`; `data_evento`/`vigencia_type`/`vigencia_raw` | 010, 002 | B1 |
| **B3** | Snapshot canônico | reprodutibilidade + fim do stale persistido | `prediction_snapshots` (`dataset_hash`, `campaign_ids`, `expires_at`, `superseded_by`, `analytic_state`) | 006 | B1 |
| **B4** | Reconciliador persistido | Predict>Forecast **gravado** + divergência | `reconciler_version` no snapshot | 008 | B3 |
| **B5** | Aprovação editorial + máquina de estados | nada publica sem `approved` (persistido) | `analytic_state`, `snapshot_transition`, `approved_by/at`, TTL | 006 | B3 |
| **B6** | Daily/Weekly do snapshot **aprovado** | as duas superfícies leem a mesma verdade aprovada | `prediction_snapshot_usages`, `radar_snapshot_ids[]` | 006 | B4, B5 |
| **B7** | Editorial Score persistido/versionado | fila do editor ordenada e auditável | `editorial_score`, `editorial_score_version` | D9 | B5 |
| **B8** | `prediction_outcome` + Brier | acurácia REAL (previsto×realizado), não só backtest | `prediction_outcome`, `expired_without_event` | 006 | B3, B6 |
| **B9** | "O que mudou" — 13 eventos completo | delta reprodutível por `dataset_hash` | (usa B3) | D18 | B3 |
| **B10** | TL Score por critérios no admin | score deixa de ser digitado (premissa 2) | (usa `computeScore` já existente) | D9 | — |

Para cada B*, a entrega inclui: **migration SQL** (não aplicada), **camada `lib/`** de
leitura/escrita, **wiring** no pipeline/admin, **testes** (unidade + paridade), e a
**promoção do ADR** correspondente. Cada B* é um **PR próprio** (não empacotar tudo).

**Aceite global da Fase B:** o leitor recebe previsão só de **snapshot aprovado e
vigente**; o 943 é curado na origem; a acurácia é medida contra a realidade; toda
decisão é reconstruível por `dataset_hash` + ids + `reconciler_version`.

---

## FASE C — Produto e Monetização

Do `MONETIZACAO-BACKLOG.md` (status `Ideia`/`Planejado`) — o motor existe; falta a
camada de cobrança e distribuição:

| # | Item | O que falta | Natureza |
|---|---|---|---|
| **C1** | Preço/ciclo + gateway + corte free×Pro | Stripe vs Beehiiv premium; enforcement do corte de conteúdo | código + config |
| **C2** | Patrocínio | tabela de preço, formato "patrocínio da edição" (exige números de audiência verificáveis) | produto |
| **C3** | Automação de e-mail | régua D0/D3/D7 + upsell Pro | Beehiiv Automations (config) |
| **C4** | Guia 2 (VPM) + tráfego pago | lead magnet + aquisição | conteúdo + growth |
| **C5** | Destravadores externos | `BEEHIIV_API_KEY`/`PUBLICATION_ID` em prod; `/api/contato` → e-mail real; automações no Beehiiv | ops (não-código) |

---

## 2. Riscos e princípios

- **Não aplicar migration em prod via merge.** Arquivo + revisão + deploy explícito.
- **Fase B é gated por decisão humana** (H1–H12) e promoção de ADR — não iniciar antes.
- **Sazonal e pooling (A3/A4)** mudam números ao leitor: entram atrás da nota de corte e
  do QA gate, com backtest como guarda.
- **Menos e verdadeiro > mais e frágil** segue valendo: cada item só publica com suporte.

## 3. O que eu recomendaria fazer primeiro

**Fase A inteira** (destrava valor sem banco e sem gate humano): A1 (Daily canônico) e
A2 (chip monitoramento) primeiro — fecham a experiência do leitor coerente com a política
já mergeada; depois A3/A4 (sazonal + pooling) para **existir janela publicável** com os
dados atuais (hoje 0 passam a nota de corte); A5 encerra a dívida do 943 nas telas.
A Fase B só após você fechar H1–H12 e promover as ADRs.
