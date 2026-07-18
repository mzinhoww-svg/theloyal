# RE-SCORE LADO-ÚNICO — os 1.220 `sem_destino` com o vetor `lado_unico.v1` (GRAVADO)

> Aplica a PROPOSTA aprovada (`PROPOSTA-VETOR-LADO-UNICO.md`, D-042) com as **5
> decisões do operador** (D-047). Re-pontua **só** os 1.220 lado-único
> (`destino_code='sem_destino'`, `lado_unico=true`, `identidade_id NOT NULL`)
> reusando `v2/lib/lado-unico.mjs` + `score.mjs` **importados, zero fork** (INV-12).
> Não inventa dado (INV-03). Dry-run + verificação antes E depois de gravar (D-038).
> **Correção de número, não de portão** (D-044): nenhum override muda, nada vira
> publicável — todos os 1.220 seguem Não confirmado.

## Decisões do operador aplicadas (D-047)

1. **Fallback cross-merchant DESLIGADO** (`fallback_tipo=false`). Merchant fino
   (pop < `min_merchant`) → **neutro sinalizado (0,5)**, nunca cross-merchant.
2. **Raridade por FREQUÊNCIA DO MERCHANT**, buckets de D-037 (n=1→0,85 … 50+→0,10),
   chave `freq-merchant`.
3. **`min_merchant=3` · `min_tipo=8`**.
4. **`conta_nao_calculavel` → NÃO-VALOR:** `tl_score_bruto = NULL` e
   `veredito_bruto = 'Não confirmado'`. Não desinfla — **anula** (não grava o número
   de raridade+abrangência, nem a banda derivada dele, como se fosse valor).
5. **Versionado em `derivacao_config`** (`lado_unico.v1`); o re-score lê o vetor do banco.

## Migration aplicada

- **`v2_014_derivacao_config_lado_unico`** (`v2/db/migrations/014_derivacao_config_lado_unico.sql`)
  — ADITIVA/idempotente. Adiciona `percentil_min_tipo`, `percentil_fallback_tipo`
  (nullable → `derivacao.v1` fica intacta) e semeia a linha `lado_unico.v1`.
- Vetor `lado_unico.v1` no banco (lido pelo re-score):
  `percentil janela=tipo-merchant · min_merchant=3 · min_tipo=8 · fallback_tipo=false`
  · `eficiencia ecdf-inverso/cpm-populacao-global` · `raridade freq-merchant` (buckets
  D-037) · `abrangencia {geral 1,0 · cartao 0,6 · selecionados 0,45 · clube 0,3}`.

## Ajuste do código (puro, versionado, testado)

- `LADO_UNICO_V1.percentil.fallback_tipo`: `true → false` (decisão 1).
- Nova função pura `marcarNaoValorLadoUnico(resultado)` (decisão 4): `override
  = conta_nao_calculavel` → `tl_score_bruto=null`, `veredito_bruto='Não confirmado'`;
  idempotente. Demais itens intactos.
- Testes: **16/16 verdes** em `lado-unico.test.mjs` (cobre default fallback OFF,
  neutro honesto, não-valor null+veredito, idempotência). Suíte lib inteira **88/88**.

## Dry-run (em memória, nada gravado)

Universo de população = **lado-único** (classe natural, D-042). Cobertura reproduz a
PROPOSTA §1(a) **exatamente**:

| métrica | valor |
|---|---|
| alvos | **1.220** |
| cobertura do percentil | **merchant 497** · tipo 0 · **neutro 99** · sem-%(null) 624 |
| override HOJE = PROPOSTA | `sem_tier1` **591** · `conta_nao_calculavel` **624** · nenhum **5** — **inalterado** |
| não-valor (null) na proposta | **624** (= todos os `conta_nao_calculavel`) |
| bruto sobe / desce / igual (só computáveis não-null, n=596) | **38 / 94 / 464** |
| banda 65 exata (HOJE 79) que **sai** de 65 | **4** |
| fila valor ≥70 **e** computável | HOJE **116** → PROPOSTA **113** |
| trava publicável (itens sem override) | HOJE 5 · PROPOSTA 5 · **novos 0 · perdidos 0** |

**Cobertura merchant 497** bate com a PROPOSTA §1(a) — universo e mecanismo
validados. Casos-âncora §3 reproduzidos: `compra·livelo·geral` **1800%→77 Vale
olhar**, **6%→28 Evitaria**.

### Divergências vs o preview §4 da PROPOSTA — todas explicadas pelas decisões aprovadas

O preview §4 foi rodado com o **default antigo (fallback ON)** e **antes** da decisão
de não-valor. Sob a config aprovada (fallback **OFF** + null):

- **Banda 65 sai 4, não 54.** Dos 79 itens exatamente em 65 HOJE: **59 têm merchant
  fino (pop<3)** → com fallback OFF viram **neutro honesto (0,5) → seguem ~65** (é a
  escolha do operador: "mais neutros honestos"); **20 têm merchant pop≥3**, dos quais
  16 têm bônus perto da mediana do merchant (65 legítimo, ex. clube-LATAM §3/caso 6) e
  **só 4 saem de 65**. O número 65 permanece nesses, mas seu **significado muda de
  artefato de rota-fina para neutro defensável** — exatamente o que a PROPOSTA argumenta.
- **Fila ≥70 vai a 113, não 118.** Os itens que só cruzavam ≥70 via fallback de tipo
  (sinal fraco) agora são neutro → não entram. Mais conservador, fiel a INV-03.
- **`sobe/desce/igual` sobre 596 (não 1.220):** os 624 `conta_nao_calculavel` saíram
  da conta de bruto (viraram não-valor), então a comparação de número roda só nos 596
  computáveis.

Nenhuma divergência toca as **duas travas de parada**: override não muda; nada vira
publicável. Por isso o re-score seguiu para a gravação sem novo OK.

## Gravação (GRAVADO — verificado)

Escrita minimalista, idempotente, guarda tripla no WHERE
(`identidade_id NOT NULL AND destino_code='sem_destino' AND lado_unico`). Grava **só**
`tl_score_bruto` + `veredito_bruto` + `versao_pesos` — **não toca** `override_aplicado`
(dry-run provou inalterado), `tl_score` legado, transferências/compras-com-rota,
fonte/TIER 1, nem o backup.

| passo | instrução | linhas afetadas |
|---|---|---|
| 1/2 | `conta_nao_calculavel` por regra → `null` / `'Não confirmado'` / `v1` | **624** |
| 2/2 | computáveis alterados (VALUES, delta real) | **132** |
| — | computáveis inalterados (já corretos) | 464 (não reescritos) |
| **total tocado** | | **756** dos 1.220 |

### Verificação pós-escrita (todas OK)

- **DB == esperado** nos **1.220/1.220**, **0 divergências** (bruto, veredito_bruto,
  versao_pesos e override conferidos linha a linha).
- `tl_score_bruto NULL` = **624** = itens `conta_nao_calculavel`. `veredito_bruto =
  'Não confirmado'` = **624**. Nenhum computável ficou 'Não confirmado'.
- `soma(tl_score_bruto)`: **76.603 → 36.230** (queda = 624 viram null + 132 mudam).
- **fila ≥70 computável = 113** (bate com o dry-run).
- **override intacto:** `sem_tier1` 591 · `conta_nao_calculavel` 624 · nenhum 5.
- **0 linha fora dos alvos tocada:** nulls na base sã = 624, **fora do alvo = 0**;
  `veredito_bruto='Não confirmado'` fora do alvo = 0.

## Arquivos

- `v2/lib/lado-unico.mjs` · `v2/lib/lado-unico.test.mjs` (fallback OFF + não-valor + testes)
- `v2/db/migrations/014_derivacao_config_lado_unico.sql` (aplicada)
- `v2/M2/rescore/rescore-lado-unico-dryrun.mjs` (dry-run, importa o JS testado)
- `v2/M2/rescore/gen-lado-unico-sql.mjs` (gera as 2 instruções de escrita)
- `v2/M2/rescore/out/lado-unico-dryrun.json` · `lado-unico-rows.json` ·
  `lado-unico-changes.json` · `sql-lado-unico/{01_cnc,02_changes}.sql`

*Promoções podem mudar sem aviso. Confira sempre as regras no site oficial antes de
comprar, transferir ou resgatar.*
