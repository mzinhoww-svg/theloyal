# SPEC — M1 slice 2 · job_queue unificado

> GSD2: spec antes de código. Objetivo: uma fila única no Postgres (brief 8.1) que unifica os 3 mecanismos divergentes de hoje e serve de infra para as próximas slices (adapters, recheck de vigência, confirmação TIER 1). Aditivo; não derruba os crons atuais.

## Estado atual (a unificar)
- `news_raw.processed` (polling booleano, sem retry estruturado/claim/dead-letter).
- `backfill_queue` (fila de URLs, status texto).
- `shopping_collection_queue` (a mais completa: status máquina, priority, attempt, claim, next_retry — **blueprint**).

## Alvo: `job_queue` (Postgres, SKIP LOCKED, backoff, dead-letter)

Tabela única, tipada por `tipo`, com idempotência por `(tipo, chave)`:

```
job_queue(
  id uuid pk, tipo text, chave text, payload jsonb,
  status: pending|running|success|retry|error|dead_letter,
  priority int, attempt_count int, max_attempts int,
  claimed_at, claimed_by, run_after (backoff), last_error,
  created_at, updated_at, completed_at)
```

Tipos de job (crescem por INSERT, nunca enum): `coleta_rss | coleta_sitemap | extracao | resolucao | analise | digest | backfill | recheck_vigencia | confirmacao_tier1 | transicao_estado`.

## Contrato de funções (RPC, service-role)
- `jq_enqueue(tipo, chave, payload, priority)` — idempotente: não duplica se já houver job `pending|running|retry` com mesma `(tipo, chave)`.
- `jq_claim(worker_id, batch)` — `FOR UPDATE SKIP LOCKED`: pega até `batch` jobs `pending|retry` com `run_after<=now()`, marca `running`, incrementa `attempt_count`. Retorna as linhas.
- `jq_complete(id)` — `success` + `completed_at`.
- `jq_fail(id, err)` — se `attempt_count>=max_attempts` → `dead_letter`; senão `retry` com backoff exponencial (`run_after = now() + f(attempt)`). Nunca descarta silenciosamente (INV-14).

## Worker (v2/scripts/worker.mjs)
Loop retomável em lote: `jq_claim` → despacha por `tipo` (handlers plugáveis) → `jq_complete`/`jq_fail`. Cada lote persiste progresso; timeout/falha reprocessa só o job corrente. Sem SLA rígido (8.1) — must-have é integridade, não latência.

## Must-haves verificáveis
1. Dois workers concorrentes não pegam o mesmo job (SKIP LOCKED testado).
2. Job falho N vezes vira `dead_letter`, visível no admin; nenhum descartado.
3. `jq_enqueue` idempotente: enfileirar 2× a mesma `(tipo,chave)` não duplica.
4. Backfill retomável (job persiste checkpoint no payload).

## Migração dos mecanismos atuais (faseada, sem quebrar crons)
- v2: coletores novos enfileiram em `job_queue`. Os crons/edge atuais seguem rodando até serem reapontados nas slices seguintes. `job_queue` nasce ao lado, não substitui de imediato — evita downtime da coleta que já opera em escala.
