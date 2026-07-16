# HANDOFF — M1 (em andamento)

> Estado da slice de canonicalização/identidade. GSD2. Atualizado 2026-07-16.

## Feito e verificado (commitado)

- **M1.0 baseline** — `v2/db/schema-atual.sql`: schema real do banco vivo extraído read-only (32 tabelas, constraints, índices, RLS, 8 RPCs, 3 views, ~25 crons).
- **Decisões** — `v2/DECISIONS.md` (D-001…D-008) aprovadas.
- **SPEC** — `v2/db/SPEC-M1-identidade.md` (modelo aditivo, matcher, FSM, 7 must-haves).
- **Migration 001** — `v2/db/migrations/001_canonical_identity.sql`: aditiva/idempotente. Domínios estendidos, `programa_aliases`, `campanha_identidade/fontes/versoes`, colunas aditivas em `campaigns`, FSM `derivar_estado_vigencia`. **Não altera dados.**
- **Matcher puro** — `v2/lib/identidade.mjs` + `v2/lib/identidade.test.mjs`: **9 golden tests verdes** (`node --test v2/lib/identidade.test.mjs`). Cobre normalização, resolução de programa (leftmost-match), tipo (9 canônicos, colapsa duplicatas), público, `identityKey` sem vigência, `parseVigenciaFim` (`"na"`→indeterminada), FSM e idempotência.
- **Script batch** — `v2/scripts/canonicalizar.mjs`: dry-run/apply, idempotente, resumível; aborta sem env (sem mock silencioso).
- **Seed** — `v2/db/seed-aliases.json`: núcleo de programas BR + aliases.

## APLICAÇÃO EXECUTADA — 2026-07-16 (aguardando aprovação do relatório)

**Backup on-demand:** tabela `public.campaigns_bkp_prev2_20260716` (cópia integral de `campaigns`), criada 2026-07-16 17:37:12 UTC, **3.610 linhas = íntegra**. (Não há tool MCP de backup de projeto; a cópia de tabela cobre a única tabela com dados tocados.)

**Sequência aplicada via MCP (execute_sql/apply_migration, privilégio elevado):**
1. Migration `v2_001_canonical_identity` aplicada (aditiva).
2. Domínio semeado: **191 programas** (com kind), **414 aliases**, **6 pares**.
3. Canonicalização set-based (paridade EXATA com o dry-run JS — validada antes de escrever).

**Relatório pós-apply:**

| Métrica | Valor |
|---|---|
| campaigns (linhas) | 3.610 = backup 3.610 (**linhas inalteradas: sim** — aplicação aditiva, nada criado/apagado) |
| canonicalizadas | 3.610 (100%) |
| com identidade (rota+lado único) | **3.324** (= 2.104 rota + 1.220 lado único; bate com o dry-run) |
| em revisão | 286 (251 origem_nao_resolvida + 22 origem_generica_recuperavel + 13 transferencia_sem_destino) |
| identidades canônicas | 1.009 |
| eventos campanha_versoes | 3.610 (1 por campanha; trilha completa) |
| **idempotência (2ª passada)** | **0 eventos novos** — determinismo confirmado |

**Colunas originais de `campaigns` intocadas** (só colunas novas preenchidas). Backup preservado para rollback.

## Bloqueado (não aplicado ao banco) — RESOLVIDO ACIMA

Durante esta sessão o **MCP Supabase ficou instável** (o stream de permissão fechava em toda chamada de escrita/leitura). Além disso, **D-006 exige snapshot antes de qualquer migration destrutiva**. Portanto, a aplicação ao banco vivo NÃO foi feita — por escolha segura, não por omissão.

## Próximos passos (quando a conexão estabilizar + após snapshot)

1. **Snapshot/backup** do banco `qjqnqcsdnpvvmyzkavoq` (D-006, condição 1).
2. **Enriquecer o seed** contra as variantes reais:
   ```sql
   select lower(trim(origem)) v, count(*) n from campaigns group by 1 order by n desc;
   select lower(trim(destino)) v, count(*) n from campaigns group by 1 order by n desc;
   select distinct vigencia_fim from campaigns limit 50;  -- confirmar formatos de data
   ```
   Adicionar variantes não cobertas a `seed-aliases.json` (rodar os testes depois).
3. **Aplicar a migration** `001_canonical_identity.sql` (aditiva — segura).
4. **Semear** `loyalty_programs.kind/aliases`, `programa_aliases`, `pares_transferencia` a partir do seed.
5. **Dry-run:** `node v2/scripts/canonicalizar.mjs --dry-run` → revisar o relatório (resolvidas vs. revisão, programas usados, vigência confiável/indeterminada, distribuição por tipo). Ajustar o seed se a taxa de revisão for alta.
6. **Apply:** `node v2/scripts/canonicalizar.mjs --apply` (ENV `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
7. **Verificar os 7 must-haves** da spec (amostra de 50 sem duplicata canônica; `vigencia_fim` sem valor-não-data; `statusmatch`→`status_match`; trilha em `campanha_versoes`; idempotência de reprocesso).
8. **Cron da FSM** (transições horárias + recheck `<72h`).

## Ainda no M1, após esta slice

- Adapters TIER 1 das páginas oficiais (D-003) + regra interina de confirmação manual no admin.
- Golden set de 100 notícias rotuladas (portão de extração precision≥95%/recall≥90%).
- `job_queue` unificado (blueprint `shopping_collection_queue`).
- Re-versionar as 20 migrations + remover credenciais hardcoded (M1.1).

**Parada obrigatória para aprovação do operador ao final do M1, antes do M2.**
