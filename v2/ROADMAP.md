# The Loyal v2 — ROADMAP.md

> Roadmap GSD2 (Milestone → Slice → Task) do ciclo v2. Saída do M0.
> **Reajuste central ao estado real:** o brief presumia backfill a construir. A auditoria mostrou que **coleta e backfill já operam em escala** (40.191 notícias, 3.593 campanhas, ~18 meses, 25 crons). Logo, o M1 real é **canonicalização, identidade e limpeza** sobre um corpus grande e sujo — não coleta nova. Isso encurta M1/M4.
> Cada slice fecha com resumo no padrão `gsd-output-formatter` e commits sob `structured-dev-workflow`. Nada de código antes da aprovação do operador às decisões de `PROJECT.md` §5.

---

## Gate de entrada (antes do M1) — ✅ RESOLVIDO

As decisões estão registradas em `v2/DECISIONS.md` (D-001…D-008), aprovadas pelo operador em 2026-07-16. Resumo:
1. Taxonomia dos 9 tipos (5.4) ratificada; duplicatas via aliases + `campanha_versoes` (D-001).
2. Extração do `schema.sql` autorizada; snapshot antes de migration destrutiva (D-002).
3. Fontes TIER 1 = primeira slice; regra interina de confirmação manual (D-003).
4. Brief v2.1 é autoridade única; `METHODOLOGY.md` nasce no M2 (D-004).
5. Coexistência v1/v2 confirmada; landing intocada até M3 (D-005).
6. Reuso in-place do banco, com trilha em `campanha_versoes` (D-006).
7. Re-score histórico vira slice do M2 (D-007).
8. Segmentos Beehiiv viram slice do M2 (D-008).

---

## M0 — Auditoria ✅ (concluído, PR #83 mergeado)

**Entregue:** `v2/PROJECT.md`, `v2/REQUIREMENTS.md`, `v2/ROADMAP.md`; matriz de compatibilidade v1→v2; verificação do Beehiiv MCP; extração do estado real do banco.
**Must-have:** matriz de compatibilidade — **aprovada pelo operador.**

---

## M1 — Fundação de dados (canonicalização primeiro)

Objetivo: transformar o corpus grande e sujo já existente em base canônica confiável.

| Slice | Tarefas | Must-have verificável |
|---|---|---|
| **M1.0 Baseline do schema** ✅ | Extrair `schema.sql` real do banco vivo → `v2/db/schema-atual.sql`. | Feito (M1.0): 32 tabelas, RPCs, views, policies, crons documentados. |
| **M1.1 Schema canônico** | Re-versionar as 20 migrations linearmente; corrigir numeração duplicada; remover credenciais hardcoded (env-only); `verify_jwt`/rede nas edge functions. | Banco novo reprovisionável só das migrações; grep sem literais de credencial. |
| **M1.2 Domínios como tabela** | `programas`, `fontes`, `pares_transferencia`; seed dos programas do contrato; mapear as 4 fontes atuais + registrar tiers. | Novo programa/fonte por INSERT, sem migration. |
| **M1.3 Resolução de identidade** | Matcher `(tipo, origem, destino, publico)` + janelas; normalizar 458 origens → programas reais; normalizar taxonomia (`statusmatch`→`status_match` etc.); `vigencia_fim` texto→date + `vigencia_confiavel`. | Amostra auditada de 50: zero duplicata canônica; nenhum valor não-data em `vigencia_fim`. |
| **M1.4 Event sourcing + FSM** | `campanha_versoes` (mudança de % = evento); máquina de estados de vigência com transições por cron + trigger TIER 1. | Caso "80%→100%" = 1 campanha + 2 versões; recheck ativo `<72h`. |
| **M1.5 job_queue unificado** | Unificar os 3 mecanismos de fila (`news_raw`-polling, `backfill_queue`, `shopping_collection_queue`) num `job_queue` (SKIP LOCKED, backoff, dead-letter); backfill resumível/idempotente. | Backfill interrompido e retomado sem duplicação; dead-letter visível no admin. |
| **M1.6 Adapters TIER 1 + golden set** | Adapters das páginas oficiais prioritárias (a partir do gate §3); golden set de 100 notícias rotuladas. | Detecção `<=60 min` em teste com 10 posts reais; precision `>=95%`, recall `>=90%`. |

**Saída do M1:** ~18 meses de campanhas canônicas sem duplicata; base pronta para score e percentil.

---

## M2 — TL Score engine + Daily

| Slice | Tarefas | Must-have verificável |
|---|---|---|
| **M2.1 tl-score-engine** | `computeTlScore(inputs)` puro e versionado; golden files; migrar `TL_WEIGHTS`→`score_pesos`; percentil sobre histórico com `base_n`/`janela_meses`/`base_insuficiente`. | Mesmo input → mesmo output no CI; base curta nunca vira percentil consolidado. |
| **M2.2 CPM/spread deterministas** | `cpm.mjs`/`spread.mjs` puros (5 fórmulas do `tl-source-audit`); golden files. | Toda conta reproduzível por função pura; divergência `>R$0,05`/milheiro bloqueia. |
| **M2.3 Contrato v2 do Daily** | Estender `edition.schema.json`: `schemaVersion`, `estado`, `tl_breakdown`, `fontes[]`, `predicoes[]` opcional + fallback; aposentar `renderer/edition.schema.json`. | Edições v1 permanecem válidas; `predicoes[]` vazio valida com fallback. |
| **M2.4 Gate único** | Consolidar as 4 implementações de QA num gate bloqueante único, em contexto independente; lint de linguagem (INV-06). | Reexecuta todas as checagens do REQ-31; reprovado nunca envia. |
| **M2.5 model_registry + custo** | `model_registry`, `llm_jobs`, `LLM_DAILY_BUDGET_USD`, painel de custo no admin. | Trocar modelo por UPDATE; meta de custo por edição medida. |
| **M2.6 Re-score histórico (D-007)** | Após o engine puro, recalcular TL Score, CPM, VPM e spread de todas as campanhas canonicalizadas; popular percentil com base real. | >90% das campanhas canônicas com score determinístico; percentil deixa de ser base curta. |
| **M2.7 Beehiiv MCP + Daily (D-008)** | Migrar publicação para MCP preservando idempotência; criar os 6 segmentos de perfil; aprovação de 1 clique; fila de revisão no admin. | 5 dias úteis de Daily até 7h com aprovação de 1 clique; zero item sem TIER 1; 6 segmentos criados. |

---

## M3 — Weekly + dashboard público

| Slice | Tarefas | Must-have verificável |
|---|---|---|
| **M3.1 Weekly com revalidação** | Consolidação com recheck obrigatório de todo status; contrato v2 do Weekly. | Nenhum status herdado sem recheck. |
| **M3.2 Dashboard + páginas** | Dashboard filtrável (programa/tipo/estado/veredito) ordenável por TL Score; páginas públicas de edição (SEO); `/sobre`, `/anuncie`, `/privacidade`; metodologia. | Páginas de edição indexadas; filtros sobre dados reais. |

---

## M4 — Predict + fundação Pro (sem cobrança)

| Slice | Tarefas | Must-have verificável |
|---|---|---|
| **M4.1 Predict ligado** | Ligar `predict-engine` ao pipeline; ocorrências históricas por par; heurística calibrada documentada em METHODOLOGY. | Predict gera artefato no pipeline. |
| **M4.2 Backfill dirigido top-5** | Backfill 12–18 meses dos 5 pares mais frequentes (sobre o corpus real). | Top-5 pares com série `>=12 meses`. |
| **M4.3 Predict Ledger** | Ledger de predições emitidas→resolvidas; Brier mensal por segmento; relatório interno de acurácia. | 100% das predições no ledger e resolvidas; nenhum percentual com `base_n<3`/série `<12m`. |
| **M4.4 Fundação Pro + entitlements** | Schema `usuarios`+`assinaturas`+`entitlements`; gestão manual no admin (conceder/revogar/listar, logado); **cobrança DESLIGADA**. | Acesso Pro concedido e revogado via admin com log. |
| **M4.5 Alertas Brevo** | Alertas em tempo real (score alto / `ultimos_dias`); templates no brand system; monitor de consumo. | Alerta entregue em teste ponta a ponta. |
| **M4.6 Simulador referencial** | Comparador de transferência (aritmética pura) + cenários de emissão com snapshot datado. | Duas leituras quando exige clube; disclaimer de preço dinâmico. |

---

## M5 — Escala e receita

| Slice | Tarefas | Must-have |
|---|---|---|
| **M5.1 Backfill 36 meses** | Completar série histórica; migrar pares restantes para prob. numérica. | Série completa sem duplicação. |
| **M5.2 Canais extras** | Alertas WhatsApp/Telegram. | Entrega em teste. |
| **M5.3 Referências de emissão** | Coleta de preço de emissão. | Snapshot datado persistido. |
| **M5.4 Stripe** | Integração plugada em `entitlements` (quando o operador ligar cobrança). | Webhook só INSERE em `entitlements`; zero refactor de acesso. |

---

## Accuracy loop (transversal, a partir do M4)

Desfecho real de vereditos e predições alimenta recalibração trimestral de `score_pesos`, com changelog público de metodologia. Nunca recalibração ad hoc.

---

## Definition of Done global (do brief §16) — checagem contínua

Todo slice preserva: nenhum dado publicado sem fonte datada/verificada; nenhum número sem correspondente no banco; digest reprovado nunca enviado; ledger de predições íntegro; custo LLM visível; nenhum job falho descartado; entitlement auditável; documentos GSD2 atualizados.
