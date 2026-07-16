# The Loyal v2 — DECISIONS.md

> Log de decisões do operador (ADR-style). Fonte de verdade das decisões que destravam milestones.
> Precede o PROJECT.md §5 (que passa a apontar para cá).

## D-001 — Taxonomia canônica ratificada
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M1

Os **9 tipos da seção 5.4 do brief** são a taxonomia oficial:
`transferencia_bonificada | promocao_emissao | compra_pontos | clube | status_match | bonus_acumulo | shopping | pontos_mais_dinheiro | outro`.

Duplicatas da base atual (ex.: `statusmatch` vs `status match`, `compra` → `compra_pontos`, `transferencia` → `transferencia_bonificada`) migram via **tabela de aliases**; cada reclassificação é registrada em `campanha_versoes`. `cartao` e `hotelaria` da base atual não têm tipo próprio no enum — mapeiam para `bonus_acumulo`/`outro` conforme o alias definido no matcher (registrado em versão).

## D-002 — Extração do schema.sql real autorizada
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M1

Extrair o DDL real do banco vivo, commitar em `v2/db/schema-atual.sql`, usar como baseline das migrations. **Antes de qualquer migration destrutiva: snapshot/backup do banco.** Migrations idempotentes e resumíveis (brief 8.1).
**Feito:** `v2/db/schema-atual.sql` (M1.0).

## D-003 — Fontes TIER 1: prioridade máxima + regra interina
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M1

Primeira slice funcional do M1: adapters das páginas oficiais dos programas seed (Smiles, LATAM Pass, Azul Fidelidade, Livelo, Esfera, TAP Miles&Go).
**Regra interina** (até os adapters existirem): confirmação TIER 1 **manual** no admin conta como TIER 1 — humano valida a página oficial/regulamento e registra `url + data de verificação` em `campanha_fontes`. **A regra do Deal Desk NÃO relaxa**; muda só o mecanismo de confirmação.

## D-004 — Docs fantasma: brief v2.1 é autoridade única
**Data:** 2026-07-16 · **Status:** Aprovada

Não reconstruir documentos que nunca existiram. `METHODOLOGY.md` nasce **novo no M2**, junto com o score engine, como ativo público. Os artefatos reais ficam registrados no `PROJECT.md` como estado de referência.

## D-005 — Coexistência v1/v2 confirmada
**Data:** 2026-07-16 · **Status:** Aprovada

`v2/` isolado; landing atual **intocada até o M3**, quando as páginas públicas passam a consumir o Supabase.

## D-006 — Reuso in-place do banco confirmado (com 3 condições)
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M1

O v2 evolui o banco `qjqnqcsdnpvvmyzkavoq` in-place. Condições:
1. **Snapshot** antes da primeira migration destrutiva.
2. Canonicalização das 458 variantes de origem **gera eventos em `campanha_versoes`** — nada sobrescrito sem trilha.
3. `vigencia_fim` (texto) migra para a máquina de estados; casos `"na"` viram **vigência indeterminada + flag de revisão**, nunca descartados.

## D-007 — Re-score histórico vira slice do M2
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2

Depois do engine puro de pé, **recalcular TL Score, CPM, VPM e spread de todas as campanhas canonicalizadas**. Destrava percentil com base real (achado: só 10 de 3.593 têm score hoje).

## D-008 — Segmentos Beehiiv viram slice do M2
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M2

Criar os 6 segmentos de perfil (`iniciante | emissao planejada | heavy user | alta renda | completar saldo | cashback first`) é slice do M2, não pendência solta.

## D-009 — Coleta oficial: sitemap + fetch simples é o padrão
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M1/M2 (slice de adapters)

A coleta de fonte oficial (TIER 1) usa **sitemap + fetch HTML simples** como padrão de arquitetura (Smiles, Livelo, Esfera, TAP — confirmado na `MATRIZ-COLETA.md`, dentro do compliance robots/ToS). **Scraper com navegador headless é exceção justificada**, não escolha caso a caso. Hoje só Azul se qualifica como exceção.

## D-010 — Azul: confirmação manual TIER 1 até segunda ordem
**Data:** 2026-07-16 · **Status:** Aprovada · **Milestone:** M1

Azul tem anti-bot no edge (robots 403). **Não construir scraper contra o anti-bot agora** — a `confirmar_tier1` cobre. Reavaliar só se Azul virar recorrente no Deal Desk.

## D-011 — LATAM: investigar a API interna antes de decidir
**Data:** 2026-07-16 · **Status:** Aprovada (pendente investigação) · **Milestone:** M1/M2

LATAM é SPA JS-rendered. Antes de construir qualquer adapter, um corte rápido: a API interna (`__NEXT_DATA__`/JSON) é **pública/estável o suficiente para ler sem violar ToS**, ou exige **token de sessão**? Se for cinza → confirmação manual como Azul. **Não construir nada ainda; registrar o veredito quando investigar.**

## Regra de execução
Aplicar GSD2 (Milestone > Slice > Task) e structured-dev-workflow. Cada slice fecha com resumo `gsd-output-formatter`. **Parada obrigatória para aprovação do operador ao final do M1, antes do M2.**
