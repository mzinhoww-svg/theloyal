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

## Bloqueado (não aplicado ao banco)

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
