# The Loyal v2 — PROJECT.md

> Documento fundacional do ciclo v2. Saída do **M0 (auditoria, sem código)** do BUILD BRIEF v2.1 (15/07/2026).
> Escopo deste documento: estado real auditado, arquitetura-alvo, matriz de compatibilidade v1→v2, capacidades verificadas do Beehiiv MCP e decisões que exigem o operador.
> **Regra de precedência (do brief):** este documento prevalece na *arquitetura*; os arquivos do repo prevalecem na *taxonomia editorial já publicada*.
> Status: **RASCUNHO PARA APROVAÇÃO DO OPERADOR.** Nenhum código de implementação foi escrito. Nenhuma migração foi aplicada. A auditoria foi read-only.

---

## 0. Como este documento foi produzido

Auditoria de três frentes (contrato editorial/schemas; motores de cálculo; camada de dados/pipeline) sobre o tronco real `claude/loyal-v2-architecture-nfvoh1` (baseado no default `claude/loyalty-landing-page-v1-7vbjq7`, 636 arquivos). Complementada por **inspeção read-only do banco Supabase ao vivo** (`the-loyalty`, ref `qjqnqcsdnpvvmyzkavoq`) e por **verificação funcional do Beehiiv MCP** (publicação `The Loyal`, `pub_ff1dca66-ed29-42e7-b248-0d2e67f2a752`).

Nível de evidência: **A** (execução/consulta direta) para tudo que envolve o banco vivo, os schemas e os scripts; **B** (leitura de código) para lógica; decisões de produto marcadas explicitamente como pendentes do operador.

---

## 1. Estado real (o que existe de verdade, com números)

### 1.1 Dados — muito além do que o repo sugere

O snapshot `content/forecast.json` no repo (119 linhas, maioria 1 amostra) é um **export offline defasado** e não representa o estado real. O banco ao vivo contém:

| Tabela | Linhas reais | Leitura |
|---|---:|---|
| `news_raw` | **40.191** (100% `processed=true`) | Coleta e extração já operam em escala. |
| `campaigns` | **3.593** | Ledger de campanhas extraídas populado. |
| `backfill_queue` | **39.922** | Backfill histórico já executado. |
| `backfill_tracker` | 138 | Checkpoints de backfill por fonte/período. |
| `shopping_observations` / `shopping_metrics` | 189 / 189 | Radar VPM de varejo com dados reais. |
| `predict_snapshots` | 49 | Motor predict já gera snapshots versionados. |
| `editions` | 10 | Edições registradas (maioria ilustrativa). |
| `campaigns.tl_score` preenchido | **10 de 3.593** | **Score quase não aplicado ao ledger.** |
| `campaigns.verdict` preenchido | **14 de 3.593** | Idem veredito. |

**Janela de detecção real:** 2025-01-14 → 2026-07-15 (~18 meses). **Crons ativos:** ~25 jobs `pg_cron` (20 `backfill-*`, `backfill-process` a cada minuto, `extract-2h` a cada 5 min, 3 `ingest-*` diários).

### 1.2 Fontes — todas TIER 2, zero TIER 1

`news_sources` (4 fontes): **Passageiro de Primeira, Pontos pra Voar, Melhores Destinos, Melhores Cartões**. Todas são **mídia editorial de terceiros (TIER 2)**. **Não há nenhuma fonte TIER 1** (página oficial/regulamento de programa) na coleta. O brief exige que todo item de Deal Desk tenha fonte TIER 1 — logo, **hoje nenhuma campanha extraída é elegível para Deal Desk pela regra do brief**. Esta é a lacuna nº 1 do produto.

### 1.3 Taxonomia real de campanha (a origem da confusão "Módulos A-H")

**"Módulos A-H" não existem no repositório.** Não há taxonomia com letras A→H de tipos de conteúdo. A taxonomia real é o campo `tipo` de `campaigns`, cuja distribuição real é:

```
compra:1828  transferencia:748  clube:343  cartao:293  hotelaria:182  estrutural:161
+ cauda ruidosa: assinatura:9, sorteio:8, resgate:7, promocao:2, cashback:2,
  cadastro:2, "status match":2, statusmatch:1, abertura:1, desconto:1, leilao:1,
  upgrade:1, concurso:1
```

Dois problemas visíveis: (a) a cauda é **ruído não normalizado** (ex.: `status match` vs `statusmatch` são o mesmo tipo grafado de duas formas); (b) a taxonomia do brief §5.4 (`transferencia_bonificada | promocao_emissao | compra_pontos | clube | status_match | bonus_acumulo | shopping | pontos_mais_dinheiro | outro`) **não coincide 1:1** com a taxonomia real. O M0 pedia mapear "módulos A-H" à taxonomia — como A-H é fantasma, o que existe é o **mapa de normalização abaixo** (§4.3), que precisa de ratificação do operador.

### 1.4 Falta de canonicalização (o gargalo central do v2)

`campaigns` tem **458 valores distintos de `origem`** e **361 de `destino`** para um universo real de ~12 programas. Não há resolução de identidade: cada variação de grafia de fonte vira uma "origem" nova. `vigencia_fim` é **coluna de texto** contendo valores como `"na"` — não é uma data tratável nem uma máquina de estados. Isto confirma o diagnóstico do RFC-009 e do ADR-RADAR-009: **o gargalo é a camada de dados (identidade, dedup, datas, score), não o algoritmo.**

### 1.5 Motores de cálculo — o que é determinístico hoje

| Cálculo | Estado real |
|---|---|
| **TL Score** | **NÃO é motor.** Número 0–100 chega pronto no JSON (LLM/humano). `scripts/lib.mjs` só tem a régua (`verdictForScore`) e os pesos (`TL_WEIGHTS` 25/15/15/10/10/10/10/5); `scripts/validate.mjs` só *valida* coerência (faixa↔veredito, soma do breakdown, overrides). **Não existe `computeTlScore(inputs)`.** `score.mjs` não existe. |
| **VPM** | **Determinístico e versionado.** `scripts/shopping/vpm.mjs` (`shopping_vpm_v1`, com auto-teste `--test`) e `scripts/collect/stats.mjs` (mediana + MAD). Fórmula: `vpm = cash / (pontos/1000)`. |
| **CPM / spread** | **NÃO calculados em runtime.** São strings pré-preenchidas no JSON (`"CPM R$ 19,80"`). As fórmulas existem só como texto na skill `tl-source-audit`. |
| **Predict** | **Maduro mas dormente.** `lib/predict-engine.ts`: sobrevivência/hazard, `P{7,15,30,60,90,180}`, backtesting walk-forward, `minSamples:3` bloqueante (`readiness:insufficient_history`). Só TS, sem espelho `.mjs`, roda no admin, **não no pipeline editorial**. Já grava `predict_snapshots` (49 linhas). **Não há ledger de predições emitidas vs. resolvidas** (o backtest é in-memory). |
| **Forecast** | Recorrência (mediana de intervalos, sem probabilidade). `lib/forecast.ts` ≡ `scripts/forecast-engine.mjs`, com teste de paridade. Gate editorial `minEditorialWaves:5`. |
| **Qualidade/dedup** | `lib/campaign-quality.ts` ≡ `scripts/campaign-quality.mjs`: plausibilidade temporal (`suspect_year` etc.) e dedup por union-find (`probable_duplicate` bloqueia). Roda antes da formação de ondas nos dois motores. **Detecção em runtime, sem merge nem persistência.** |

### 1.6 Pipeline, gates e admin

- **Pipeline editorial:** `validate → render → qa → publish → beehiiv`. Curadoria, QA gate e disparo são **deliberadamente manuais** (trava `confirm:"PUBLICAR"`).
- **Gate de auditoria:** já existe e é maduro, porém **duplicado em 4 implementações** (`validate.mjs`, `qa.mjs`, `renderer/audit.mjs`, `lib/admin-digest-ops.ts`) com rigor divergente (o `runQa` do admin é mais fraco — não roda a aritmética de CPM nem a checagem de vigência). `edition_qa_reports.blocking` já persiste veto; `approveDraftAction`/`dispatchGuarded` já recusam publicação sem gate.
- **Fila de jobs:** **já existe um precedente forte** — `shopping_collection_queue` tem `status (pending|running|success|retry|error|dead_letter)`, `priority`, `attempt_count`, `claimed_at/claimed_by`, `next_retry_at` e índice de claim. É o blueprint direto do `job_queue` v2. Mas convivem **3 mecanismos de fila divergentes** (polling de `news_raw.processed`, `backfill_queue`, `shopping_collection_queue`) a unificar.
- **Distribuição:** hoje via **API própria Beehiiv** (`scripts/beehiiv-core.mjs`, idempotente por hash, draft por default). O brief v2.1 manda migrar para **Beehiiv MCP** (ver §3).
- **Auth/entitlements:** admin por senha única (`ADMIN_TOKEN`, cookie SHA-256). **Não existe tabela de usuários, assinaturas, tiers, entitlements, billing nem RLS por `auth.uid()`.** Assinantes vivem 100% no Beehiiv. Entitlement é **green-field total** — maior esforço isolado do v2.

### 1.7 Schema drift (risco de migração nº 1)

O banco tem **20 migrations aplicadas**; o repo versiona **9 arquivos** (com numeração duplicada — dois `0001`, dois `0002`). Tabelas centrais (`campaigns`, `runs`, `news_raw`, `news_sources`, `editions`, `backfill_queue`, `backfill_tracker`, `valuations`, `passagens`, `campaign_date_reviews`) e RPCs (`admin_*`, `backfill_*`, `shopping_recompute`) e edge functions (`ingest`, `backfill`) **existem só no banco vivo, sem DDL no repo**. Antes de qualquer migração v2 é obrigatório **extrair o `schema.sql` canônico completo** do banco.

---

## 2. Arquitetura-alvo v2 (determinismo primeiro, LLM depois)

Princípio inegociável do brief, confirmado como o caminho certo pela auditoria: **todo número (score, probabilidade, conta, percentil) nasce de SQL ou função pura; o LLM redige, explica e audita — nunca calcula.**

```
                         ┌─────────────────────────────────────────────┐
   Fontes (RSS/          │  COLETA → EXTRACAO → RESOLUCAO → ANALISE     │
   sitemap/HTML/API)  →  │  (adapters)  (regex+LLM)  (identidade)  (hist)│
   TIER 1 + TIER 2       └───────────────┬─────────────────────────────┘
                                         │  job_queue (Postgres, SKIP LOCKED)
                                         ▼
                    ┌──────────────────────────────────────┐
                    │  ENTIDADE CANONICA: campanhas          │
                    │  identidade = (tipo,origem,destino,    │
                    │  publico) + janelas; versoes por evento│
                    │  maquina de estados de vigencia (FSM)  │
                    └───────────────┬──────────────────────┘
                        ┌───────────┴───────────┐
              ┌─────────▼────────┐    ┌──────────▼─────────┐
              │ tl-score-engine  │    │  predict-engine    │
              │ (funcoes puras,  │    │  (frequencial +    │
              │  golden files)   │    │  ledger auditavel) │
              └─────────┬────────┘    └──────────┬─────────┘
                        └───────────┬────────────┘
                                    ▼
                    ┌──────────────────────────────────────┐
                    │  DIGEST ENGINE (contrato JSON v2)     │
                    │  Daily / Weekly / Pro                  │
                    └───────────────┬──────────────────────┘
                                    ▼
                    ┌──────────────────────────────────────┐
                    │  GATE DE AUDITORIA (bloqueante,       │
                    │  contexto independente do gerador)    │
                    └───────────────┬──────────────────────┘
                        ┌───────────┴───────────┐
                        ▼                       ▼
                 Beehiiv (MCP)            Web (SEO) + Brevo (alertas)
                 segmentado por perfil    entitlement Pro (schema pronto,
                                          cobranca DESLIGADA neste ciclo)
```

**Stack-alvo:** Next.js 15 + TS + Tailwind (Vercel); Supabase (Postgres + Edge Functions + pg_cron + RLS); Beehiiv via MCP; Brevo transacional; admin real em `/admin`. **Nota:** o repo está em **Next.js 14.2.15** — o upgrade para 15 é item de migração (M1).

---

## 3. Capacidades verificadas do Beehiiv MCP (must-have do M0)

Verificação funcional real contra a publicação `The Loyal`:

| Capacidade exigida pelo brief | Tool MCP | Verificado |
|---|---|---|
| Publicação conectada | `list_publications` → `The Loyal` (`pub_ff1dca66-…`), criada 2026-07-08 | ✅ |
| Criar post | `save_post` (+ `edit_post_content`, `duplicate_post`) | ✅ disponível |
| Contrato de conteúdo (HTML) | `learn_post_authoring` (dump do schema Tiptap + merge tags) | ✅ disponível |
| Segmentar por perfil | `list_segments` (respondeu, **0 segmentos hoje**) + `save_segment` | ✅ disponível |
| Enviar / agendar | `save_post` com status (draft/confirmed/schedule) | ✅ disponível |
| Estatísticas (fechar loop) | `get_post_stats`, `get_post_stats_batch` | ✅ disponível |

**Conclusão:** a distribuição via Beehiiv MCP é viável exatamente como o brief v2.1 assume. **Limitações a registrar:** (a) os 6 segmentos de perfil (`iniciante | emissao planejada | heavy user | alta renda | completar saldo | cashback first`) **ainda não existem** — precisam ser criados via `save_segment` e alimentados por custom field; (b) o fluxo atual em produção usa **API própria**, não MCP — a migração para MCP é trabalho de M2 (Daily) e exige preservar a idempotência por hash que o `beehiiv-core.mjs` já garante; (c) aprovação humana de 1 clique continua obrigatória enquanto a regra do M2 vigorar.

---

## 4. Matriz de compatibilidade v1 → v2 (MUST-HAVE do M0)

### 4.1 Schemas e contrato editorial

| Artefato v1 (real) | Alvo v2 | Compatível? | Ação |
|---|---|---|---|
| `content/edition.schema.json` (Daily, camelCase, 6 vereditos, 8 critérios) | Contrato v2 do Daily | **Parcial** | Estender: `schemaVersion`, `estado` (FSM), `tl_breakdown` com `base_n`/`janela_meses`/`base_insuficiente`, `fontes[]` com tier, `predicoes[]` **opcional** com fallback. Manter camelCase e a régua de 6 vereditos. |
| `content/weekly.schema.json` | Contrato v2 do Weekly | **Parcial** | + `schemaVersion`; revalidação obrigatória de status (nenhum herdado). |
| `content/forecast.schema.json` | Saída do predict/forecast v2 | **Compatível** | Reaproveitar; acrescentar ligação ao ledger de predições. |
| `content/pro-report.schema.json` | Pro v2 | **Compatível** | Reaproveitar; ligar a entitlements. |
| `content/entity.schema.json` (`schemaVersion:1`) | Registro de entidades canônicas | **Compatível** | Único schema já versionado — usar como padrão para os demais. |
| `renderer/edition.schema.json` (LEGADO, snake_case, 8 vereditos, `depende`/`nao-vale`) | — | **Incompatível** | **Aposentar.** Remover os vereditos deprecados na v2 da taxonomia. |
| Versionamento textual ("Operating Manual v1") | `schemaVersion` numérico em todos | **Incompatível** | Introduzir versionamento semântico do schema; edições v1 permanecem válidas. |

### 4.2 Modelo de dados

| Tabela v2 (brief §5) | Correspondente v1 real | Compatível? | Ação |
|---|---|---|---|
| `raw_noticias` | `news_raw` (40.191 linhas) | **~1:1** | Recuperar DDL do banco; renomear/mapear; adicionar `hash`/`simhash` estruturado. |
| `campanhas` (entidade canônica) | `campaigns` (3.593 linhas, 458 origens não-canônicas, `vigencia_fim` texto) | **Parcial** | **Maior trabalho de dados:** resolução de identidade `(tipo,origem,destino,publico)`, `vigencia_fim`→date, FSM de estado, `tl_breakdown`/`overrides` jsonb. |
| `campanha_fontes` | embutido em `campaigns` (`tier` default 2) | **Parcial** | Extrair para tabela de junção com `papel` (primeira_deteccao/confirmacao_oficial/cobertura). |
| `campanha_versoes` (event sourcing) | inexistente (`first_seen`/`last_seen` só) | **Ausente** | Criar tabela de eventos. |
| `job_queue` | `shopping_collection_queue` (blueprint) + 2 filas divergentes | **Parcial** | Unificar 3 mecanismos num `job_queue` único (SKIP LOCKED + dead-letter). |
| `predicoes` + `predicao_resultados` | `predict_snapshots` (49) | **Parcial** | Reaproveitar snapshots; **criar ledger** de predições emitidas→resolvidas. |
| `programas` / `fontes` / `pares_transferencia` (domínios como tabela) | `loyalty_programs` (3), `news_sources` (4), enums espalhados | **Parcial** | Consolidar domínios como tabela; seed dos programas do contrato. |
| `usuarios` / `assinaturas` / `entitlements` | **inexistente** | **Ausente (green-field)** | Construir schema completo; cobrança DESLIGADA; gestão manual no admin. |
| `model_registry` / `score_pesos` / `llm_jobs` | inexistente (pesos hardcoded em `lib.mjs`) | **Ausente** | Criar; migrar `TL_WEIGHTS` para tabela versionada. |
| `referencias_emissao` / `eventos_engajamento` | inexistente | **Ausente** | Criar (M4/M5). |

### 4.3 Taxonomia de campanha (resolução do "A-H" fantasma) — **requer ratificação do operador**

Mapa proposto do `tipo` real → taxonomia do brief §5.4:

| `tipo` real (v1) | Taxonomia v2 (brief) | Observação |
|---|---|---|
| `transferencia` | `transferencia_bonificada` | 748 registros. |
| `compra` | `compra_pontos` | 1.828 — maior volume. |
| `clube` | `clube` | 343. |
| `cartao` | `bonus_acumulo` **ou** novo `cartao` | **Decisão do operador:** o brief não tem `cartao`; sugerir manter `cartao` como tipo próprio. |
| `hotelaria` | `outro` **ou** novo `hotelaria` | 182 — fora do enum do brief. **Decisão.** |
| `estrutural` | `outro` | 161 — mudanças de regra/programa. |
| `status match` + `statusmatch` | `status_match` | **Normalizar duplicata.** |
| `shopping` (brief) | `shopping` | Coberto pelo Radar VPM (`shopping_*`). |
| `pontos_mais_dinheiro` (brief) | — | Sem correspondente v1; nasce vazio. |
| `promocao_emissao` (brief) | — | Hoje coberto informalmente por `compra`/`estrutural`; separar na extração v2. |
| cauda (sorteio, resgate, cashback, cadastro, abertura, desconto, leilao, upgrade, concurso, assinatura, promocao) | `outro` + regra de limpeza | Ruído de extração a normalizar. |

### 4.4 Motores e gates

| Item v2 | Estado v1 | Compatível? | Ação |
|---|---|---|---|
| `tl-score-engine` (funções puras + golden files) | Régua + validador; score gerado por LLM | **Incompatível (construir)** | Criar `computeTlScore(inputs)` determinístico; migrar pesos para `score_pesos`; golden files. |
| CPM/spread deterministas | Strings no JSON + fórmulas em prosa | **Ausente** | Criar `cpm.mjs`/`spread.mjs` puros a partir das 5 fórmulas do `tl-source-audit`. |
| Predict com ledger auditável | Motor maduro dormente, sem ledger | **Parcial** | Ligar ao pipeline; criar Predict Ledger; espelho ou execução TS no runtime. |
| Percentil sobre histórico (com `base_n`/janela) | inexistente | **Ausente** | Construir sobre `campaigns` reais (há volume suficiente para muitos pares). |
| Gate de auditoria bloqueante único | 4 implementações divergentes | **Parcial** | Consolidar num motor único servindo CLI e admin. |
| Compliance de linguagem (lint) | `assertEditorialRules` em `validate.mjs` | **Parcial** | Extrair para lint reutilizável com a lista de proibições do brief §3. |

### 4.5 Distribuição

| Item v2 | Estado v1 | Compatível? | Ação |
|---|---|---|---|
| Beehiiv via MCP | API própria (`beehiiv-core.mjs`) | **Parcial** | Migrar para MCP preservando idempotência por hash; criar 6 segmentos de perfil. |
| Alertas transacionais Brevo | inexistente | **Ausente** | Integrar (M4), free tier 300/dia. |
| Aprovação humana de 1 clique | trava `confirm:"PUBLICAR"` | **Compatível** | Manter. |

---

## 5. Decisões que exigem o operador (bloqueiam a implementação)

> **✅ RESOLVIDO (2026-07-16).** Todas aprovadas — ver `v2/DECISIONS.md` (D-001…D-008). O texto abaixo é o registro original das perguntas.

Estas decisões devem ser resolvidas antes/durante o M1. Nenhuma será tomada unilateralmente.

1. **Taxonomia canônica (§4.3):** ratificar o mapa `tipo`→taxonomia, em especial `cartao` e `hotelaria` (manter como tipos próprios ou dobrar em `bonus_acumulo`/`outro`?).
2. **Schema drift:** autorizar a extração do `schema.sql` canônico do banco vivo e a re-versionação das 20 migrations (com correção da numeração duplicada) como primeiro slice do M1.
3. **Fontes TIER 1:** priorizar quais páginas oficiais (Smiles, LATAM Pass, Azul, Livelo, Esfera…) receberão adapters primeiro — sem TIER 1 não há Deal Desk conforme o brief.
4. **Hierarquia de documentos fantasma:** os 6 documentos de autoridade citados no `CLAUDE.md` (THE-LOYALTY-LLM-SYSTEM, DESIGN, BRAND-GUIDELINES, PONTO-MASCOTE-GUIA, TL-GRAPHICS, Operating Manual v1) **não existem no repo**. Decidir: criá-los ou re-apontar o `CLAUDE.md`. O v2 herda essa dívida.
5. **Convívio v1/v2:** o v2 nasce na pasta `v2/` (docs) e evolui para código separado. Confirmar a estratégia de coexistência (branch única evolutiva vs. app paralelo) antes do M1.
6. **Reuso do banco atual:** o banco `qjqnqcsdnpvvmyzkavoq` já tem 40k notícias e 3.6k campanhas reais. Confirmar que o v2 **evolui este banco** (migração in-place) em vez de começar vazio — o que encurta drasticamente M1/M4.

---

## 6. Riscos herdados do v1 (a mitigar no v2)

| Risco | Origem | Mitigação no v2 |
|---|---|---|
| Schema só no banco vivo (sem DDL no repo) | §1.7 | Extrair `schema.sql` canônico no 1º slice do M1. |
| Credenciais/URL hardcoded (`lib/admin-db.ts`, `forecast.mjs`) | Intelligence Report CODE-002 | Env-only; remover fallbacks. |
| `verify_jwt` off nas edge functions | CODE-004 | Restringir rede/JWT. |
| Falha silenciosa (rest/rpc → `[]`/`null`) | CODE-010 | Distinguir erro de vazio; dead-letter visível. |
| Dado sujo (`vigencia_fim="na"`, 458 origens) | §1.4 | Resolução de identidade + normalização de datas no M1. |
| Taxonomia com duplicatas (`statusmatch`) | §1.3 | Normalização na extração v2. |

---

## 7. Definition of Done do M0 (checagem)

- [x] Auditado o contrato editorial, schemas, motores de score/predict e camada de dados.
- [x] Constatado que `score.mjs`, "Módulos A-H" e os 6 docs de autoridade **não existem** — registrado, com os artefatos reais que os substituem.
- [x] Verificadas as capacidades reais do Beehiiv MCP (criar post, segmentar, enviar) e registradas as limitações (§3).
- [x] Extraído o estado real do banco vivo (tabelas, volumes, crons, taxonomia, cobertura temporal).
- [x] Produzida a **matriz de compatibilidade v1→v2** (§4) — must-have verificável do M0.
- [x] Emitidos `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`.
- [ ] **Aprovação do operador** (pendente) — em especial as decisões da §5.

> Enquanto a §5 não for resolvida pelo operador, **nenhum código de implementação do M1 começa** (regra do brief).
