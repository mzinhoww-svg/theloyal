# M2 · Slice 3 — Parser de vigência · RESULTADO

> Medido contra o gold estrito (evidência por componente). Reprodutível: `node v2/golden/vigencia-run.mjs` (grava `VIGENCIA-METRICAS.json`). Testes: `node --test v2/lib/vigencia.test.mjs`. Data: 2026-07-16.

## Portão — os dois eixos, separados

### Parsing (o bug consertado)

| métrica | alvo | medido | veredito |
|---|---|---:|---|
| **overprecision** (data fabricada) | **0** (invariante bloqueante INV-16) | **0** | ✅ |
| **precision de parsing** | ≥ 0,90 | **1,00** (14/14) | ✅ |
| **recall de parsing** | ≥ 0,85 | **1,00** (14/14) | ✅ |

14 datas afirmadas, todas corretas · 38 `indeterminada` corretas · **0 year_error, 0 wrong, 0 overprecision, 0 missed**. Ver ressalva in-sample abaixo.

### Confiabilidade (o estado legítimo, medido à parte)

**0/52 vêm de TIER 1.** Fontes: `melhorescartoes` 25, `passageirodeprimeira` 16, `melhoresdestinos` 9, `pontospravoar` 2 — todas TIER 2. **100% "não confirmado"** e isso está **certo**: o FSM roteia para `indeterminada`/"Não confirmado" até um `confirmar_tier1`. Parsing bom **não** confirma nada. Os dois eixos ficam em colunas distintas: `vigencia_confiavel` (parse) vs `campanha_fontes` TIER 1 (fonte).

## Como o 0,35 virou 1,0 (os dois padrões, nomeados e mortos)

- **overprecision (era 8/26):** agora **bloqueio por construção** (INV-16). O parser só afirma data com **dia+mês+ano evidenciados**; faltou componente → `indeterminada`. Regras: "a partir de" é início (não fim); "não informado" → indeterminada; slug `NmmmAA` só é vigência com âncora "hoje/último dia" (senão é data de **publicação**, não fim — foi exatamente o caso `inter-uber`).
- **year_error (era 8/26):** inferência de ano por proxy (slug `mmmAA` / `publicado_em`) com **trava de virada** — pub em dez + "até 31/01" → ano seguinte; ambíguo sem proxy → `indeterminada`, não chuta. Coberto por testes sintéticos (a amostra não tem `publicado_em`).

## Achado: o próprio gabarito do M1 tinha overprecision

O gold estrito corrigiu **5 datas que o gabarito do M1 tinha afirmado sem evidência** de dia no texto (vinham do `id`/slug-sem-dia): `banco-banco` ("a partir de" = início), `esfera-esfera-clube`, `livelo-latampass-2026-06-30`, `pontofrio-smiles`, `smiles-clube-jul26` → todas viraram `indeterminada`. **O invariante pegou o erro do próprio rotulador.** Antes/depois em `vigencia-gold.json` (campo `gab_m1` vs `esperado`).

## Honestidade da medição (mesma disciplina do gate, D-019)

O 1,0 é **in-sample** (as regras vieram destes 86). O que **confio de verdade**:
1. **`overprecision = 0` é estrutural, não sorte** — o parser não tem caminho de código que afirme data sem os 3 componentes. Vale fora da amostra por construção (INV-16), não por ajuste.
2. **precision/recall 1,0 é in-sample** — fora da amostra, a inferência de ano depende de `publicado_em` real (ausente no golden) e da trava de virada; por isso os testes sintéticos cobrem a virada, não só os 86.
3. Na dúvida → `indeterminada`, que **nunca** conta como erro de parsing. O parser prefere calar a chutar.

## Estado

- `v2/lib/vigencia.mjs` (parser puro), `vigencia.test.mjs` (10 testes: INV-16, virada de ano, slug-vs-publicação, lock do gold).
- `v2/golden/vigencia-gold.json` (gold estrito, 14 datas + 38 indeterminada, com `gab_m1` para antes/depois).
- INV-16 registrado em `REQUIREMENTS.md`. 30 testes v2 verdes (10 vigência + 4 gate + 16 matcher).
- Sem mudança de banco (parsing é função pura; a coluna `vigencia_confiavel` já existe da migration `001`).

## Slice 3 — FECHADA

Os **quatro buracos de extração do M1** estão fechados ou nomeados: `destino`/`sem_destino` (canonicalização), `multiplos_cartoes` (sentinela), **gate de rejeição** (slice 1), **parser de vigência** (slice 3). O input do TL Score engine agora é confiável. Próximo, na ordem combinada: **TL Score engine puro com golden files → re-score da base → digest Daily**.
