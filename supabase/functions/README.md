# Supabase Edge Functions

Funções deployadas no Supabase (runtime Deno), fora do build do Next.js. A
**fonte de verdade é a versão deployada** no projeto Supabase; os arquivos aqui
são o espelho versionado — mantenha-os em sincronia ao redeployar.

| Função | Cron | Papel |
|---|---|---|
| `campaigns` | `extract-2h` (a cada 5 min) | consome `news_raw` pendente → LLM (OpenRouter) → upsert em `campaigns` |
| `ingest` | `ingest-*` (3×/dia) | coleta notícias dos portais → `news_raw` |
| `backfill` / `backfill-daily` | vários | fila de backfill histórico |

Apenas `campaigns` está espelhado aqui até agora (é o extrator que gera o
ledger). As demais permanecem só no Supabase.

## Deploy

Via MCP do Supabase (`deploy_edge_function`) ou CLI. Variáveis usadas:
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`.
`verify_jwt` fica **desabilitado** (as funções são chamadas pelo cron interno
via `pg_net`, não por usuários).

## Notas de robustez (`campaigns`)

- Guard de `choices`: evita o crash `Cannot read properties of undefined
  (reading '0')` quando o OpenRouter devolve um shape sem `choices` (era a
  causa histórica de ~30 notícias travadas em erro).
- `deaccent` null-safe: evita `.normalize` em `null`.
- Erros por item são capturados e gravados em `news_raw.error` (a notícia fica
  `processed=true`); para reprocessar, zere `error` e ponha `processed=false`.
