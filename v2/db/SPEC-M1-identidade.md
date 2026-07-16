# SPEC — M1 slice de Canonicalização e Identidade

> GSD2: spec antes de código. Escopo: transformar `campaigns` (3.593 linhas, 458 variantes de origem, `vigencia_fim` texto) numa camada canônica com identidade estável, event sourcing e máquina de estados — **aditivo, idempotente, com trilha; nada sobrescrito** (D-006).
> Baseline: `v2/db/schema-atual.sql`. Decisões: `v2/DECISIONS.md` (D-001, D-003, D-006).

## 1. Objetivo e não-objetivos

**Objetivo:** para cada linha de `campaigns`, resolver `(tipo, origem, destino, publico)` canônicos, agrupar variações da mesma campanha sob uma **identidade estável** (sem `vigencia_fim` na chave), registrar cada reclassificação como **evento**, e materializar a **máquina de estados de vigência** — tudo em tabelas novas, sem alterar as colunas existentes de `campaigns`.

**Não-objetivos desta slice:** adapters TIER 1 (slice seguinte do M1), score determinístico (M2), merge/split interativo no admin (M1 posterior), coleta nova.

## 2. Modelo de dados (aditivo)

Reusa o que já existe; cria o que falta. **Nenhuma coluna existente é removida ou reescrita.**

### 2.1 Domínios (reuso + extensão)
- **`loyalty_programs`** (já existe: `code`, `name`, `active`, `base_url`) → estende como o `programas` do brief:
  - `+ kind text` (`aereo | bancario | varejo | hotel | outro`)
  - `+ aliases text[]` (grafias conhecidas; seed inicial + crescido pelo matcher)
- **`news_sources`** (já existe: `id`, `name`, `tier`) → é o `fontes` do brief:
  - `+ tipo_coleta text` (`rss | sitemap | html | api | manual`)
  - `+ saude jsonb` (última coleta, taxa de erro)
- **`pares_transferencia`** (NOVO): `(origem_code, destino_code, paridade_base numeric, ativo bool)` — PK `(origem_code, destino_code)`.

### 2.2 Resolução de aliases (NOVO)
- **`programa_aliases`**: `(alias_normalizado text PK, programa_code text FK loyalty_programs.code, confianca text, origem_deteccao text, criado_em timestamptz)`.
  - `alias_normalizado` = `lower(trim(unaccent(x)))` colapsando espaços.
  - Seed: derivado da query de `distinct lower(trim(origem))` + `destino` (top variantes → programa real). Variantes não resolvidas ficam **sem** alias e a campanha correspondente entra em fila de revisão (nunca chuta — INV-07).

### 2.3 Identidade canônica (NOVO — modelo ADR-RADAR-009)
- **`campanha_identidade`**: `(id uuid PK, tipo text, origem_code text, destino_code text, publico text, identity_key text UNIQUE, criado_em, atualizado_em)`.
  - `identity_key = tipo || '|' || origem_code || '|' || destino_code || '|' || publico`. **Sem vigência na chave** (ADR-009).
  - `publico` ∈ `geral | selecionados | clube | cartao` (default `geral` quando não detectado).
- **`campanha_fontes`** (NOVO): `(id uuid PK, identidade_id FK, campaign_id text, noticia_url text, tier int, papel text [primeira_deteccao|confirmacao_oficial|cobertura], verificado_em date, criado_em)`.
  - **Regra interina TIER 1 (D-003):** confirmação manual no admin insere linha `tier=1, papel='confirmacao_oficial'` com `noticia_url` (página oficial) + `verificado_em`.
- **`campanha_versoes`** (NOVO — event sourcing): `(id uuid PK, identidade_id FK, campaign_id text, evento text, payload_antes jsonb, payload_depois jsonb, origem text, em timestamptz default now())`.
  - Eventos: `canonicalizacao` (origem/destino/tipo resolvidos), `reclassificacao_tipo`, `mudanca_percentual`, `mudanca_estado`, `vigencia_normalizada`, `tie_break_llm`.

### 2.4 Ligação e colunas aditivas em `campaigns`
- `+ identidade_id uuid` (FK `campanha_identidade`, nullable até canonicalizar)
- `+ origem_code text`, `+ destino_code text`, `+ publico text` (resultado da resolução; original preservado em `origem`/`destino`)
- `+ vigencia_fim_date date` (parse de `vigencia_fim`; `"na"`/inválido → NULL)
- `+ vigencia_confiavel boolean` (false quando `vigencia_fim` era `"na"`/ausente)
- `+ estado text` (FSM, §3)
- `+ canonicalizado_em timestamptz`

## 3. Máquina de estados de vigência (FSM)

Estados: `prevista → detectada → confirmada → ativa → ultimos_dias → encerrada → historica`; ramo lateral `indeterminada` (quando `vigencia_confiavel=false`).

Regras de transição (derivadas, nunca por LLM — brief 5.4):
- Sem `vigencia_fim_date` confiável → `indeterminada` + flag de revisão (D-006 cond. 3; INV-05).
- `vigencia_fim_date` no futuro > 72h → `ativa`; ≤ 72h → `ultimos_dias`.
- `vigencia_fim_date` no passado → `encerrada`; > 30d no passado → `historica`.
- `confirmada` exige ≥1 `campanha_fontes.tier=1`; senão fica em `detectada`.
- Transições rodam por cron horário (reuso do pg_cron existente) + recheck ativo de `ultimos_dias`.

## 4. Matcher (função pura + script batch)

`v2/lib/identidade.mjs` (funções puras, testável, sem LLM no caminho feliz):
1. `normalizar(texto)` → `lower(trim(unaccent))`, colapsa espaços/pontuação.
2. `resolverPrograma(textoNormalizado, aliasMap)` → `programa_code | null`.
3. `resolverTipo(tipoBruto, mapaTaxonomia)` → um dos 9 tipos (D-001); `statusmatch|status match → status_match`, `compra → compra_pontos`, etc.
4. `resolverPublico(campanha)` → `geral|selecionados|clube|cartao` (heurística por `notes`/`paridade`/`tipo`).
5. `identityKey(tipo, origem_code, destino_code, publico)`.
6. **Ambiguidade residual** → `tie_break` por LLM econômico, justificativa persistida em `campanha_versoes` (evento `tie_break_llm`). Fora do caminho feliz.

Script `v2/scripts/canonicalizar.mjs` (batch, idempotente, resumível — 8.1):
- Lê `campaigns` em lotes; para cada linha resolve identidade; **upsert** em `campanha_identidade`; grava `campanha_versoes` (evento `canonicalizacao` com antes/depois); atualiza colunas aditivas de `campaigns` via UPDATE por `id`.
- Idempotência: reprocessar a mesma linha não duplica versão se `payload_depois` idêntico ao último. Checkpoint por faixa de `id`.
- Não resolvido → `campaigns.estado='indeterminada'`, sem `identidade_id`, entra na view de revisão.

## 5. Must-haves verificáveis (portão da slice)

1. Amostra auditada de 50 campanhas: **zero duplicata canônica** (mesma identidade sob 2 `identity_key`).
2. 458 variantes de `origem` reduzidas ao conjunto real de programas; variantes não resolvidas **explicitamente** em revisão (contagem reportada, nunca silenciosa).
3. `vigencia_fim` sem valor-não-data em `vigencia_fim_date`; todo `"na"` → `indeterminada` + flag, **nenhum descartado** (D-006).
4. Taxonomia: `statusmatch` e `status match` colapsam em `status_match`; distribuição final só nos 9 tipos + fila `outro`.
5. Toda reclassificação tem linha em `campanha_versoes` (trilha completa; nada sobrescrito sem evento).
6. Migration aditiva reprovisionável; rodar o matcher duas vezes não duplica (idempotência provada em teste).
7. FSM: caso `vigencia_fim` ≤72h → `ultimos_dias`; vencida → `encerrada`; sem vigência → `indeterminada`.

## 6. Sequência de execução (Tasks)

1. Migration `v2/db/migrations/001_canonical_identity.sql` — aditiva (tabelas + colunas + FSM helper). **Snapshot antes** (D-006).
2. Seed de `programa_aliases` + `loyalty_programs.kind/aliases` a partir da query de variantes distintas.
3. `v2/lib/identidade.mjs` + testes (golden de casos de normalização/resolução/identity_key).
4. `v2/scripts/canonicalizar.mjs` — dry-run primeiro (relatório sem escrever), depois run idempotente.
5. Trigger/cron da FSM.
6. Verificar os 7 must-haves; fechar slice com resumo `gsd-output-formatter`.
