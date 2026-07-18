# RE-SCORE-1 sobre a BASE SÃ — relatório

> Continuação da slice de re-score (D-038, D-040/041/042/043). Determinismo-primeiro
> (INV-12): o número saiu do engine JS testado **importado** (`v2/lib/score.mjs` +
> `v2/lib/derivacao.mjs`), nunca de cópia/fork nem de SQL que re-implemente. Não se
> inventou dado (INV-03).

Banco: Supabase `qjqnqcsdnpvvmyzkavoq` ("the-loyalty"), Postgres. Gerado 2026-07-17.

## O que é a base sã

- `campaigns` total: **3.621**.
- Base sã (`identidade_id IS NOT NULL`): **3.330** — o conjunto pontuado e gravado.
- Em revisão (`identidade_id IS NULL`): **291**, dos quais os **13 self-loops de
  transferência** (origem = destino) mandados à revisão na recanonicalização. Ficam
  **fora** do conjunto pontuado por construção.

## 1. Gate de fidelidade (BLOQUEANTE) — PASSOU

- **Golden replay do engine importado: 6/6.** A=77 · B=59 · C=79 · D=37 · E=44 · F=27
  (bruto/veredito/override idênticos ao esperado da PROPOSTA §2).
- **`node --test v2/lib/score.test.mjs v2/lib/derivacao.test.mjs`: 32/32 pass, 0 fail.**

Nenhuma gravação teria ocorrido se qualquer um falhasse.

## 2. Runner e reuso (zero fork)

`v2/M2/rescore/rescore-1.mjs` é adaptação MÍNIMA de `rescore-dryrun.mjs`. A **única**
mudança de seleção: `identidade_id` entrou no `select` e o fetch filtra
`identidade_id=not.is.null`. `montarEntradas`/`calcularScore`/baldes/anomalias são
**importados**, idênticos ao dry-run. Vetores lidos do banco: `score_pesos.v1`
(0.45/0.30/0.15/0.10, shrink_k 5, min_samples 3) e `derivacao_config.derivacao.v1`
(raridade n=1 → **0,85**, como no dry-run). Leitura via PostgREST anon; `score_pesos`
(RLS bloqueia anon) veio por `SCORE_PESOS_V1_JSON` — a mesma linha do banco.

Totais da base sã: 3.330 campanhas · 1.053 rotas · população CPM n=10.

## 3. Trava de anomalia (D-038) — LIMPA

- **Self-loops de transferência no conjunto pontuado = 0** (confirmado; os 13 estão
  ausentes por `identidade_id` nulo).
- **Nenhuma classe de anomalia NOVA.** As 21 flags por programa são exatamente as três
  classes conhecidas/esperadas do dry-run anterior, todas derivação D-042 (não bloqueiam):
  - `score_identico` banda 65 — avios, disney, airbnb;
  - `beco_quase_total` (conta_nao_calculavel) — btg, elo, emirates, sams_club,
    aliexpress, turkish, etihad;
  - `destino_nunca_resolvido` (sem_destino lado-único) — outro, mercado_livre,
    hoteis_com, nike, british_airways, connectmiles, disney, costa_cruzeiros, renner, msc…
  - Anomalias por linha: sem_destino percentil saturado = 0, percentil saturado
    base≥20 = 0 (iguais ao dry-run).
- Nenhum novo self-loop nem identidade colapsada nova por efeito do guard.

## 4. Gravação — 3.330 linhas, verificada

Gravado só nas linhas da base sã: `tl_score_bruto`, `veredito_bruto`,
`override_aplicado`, `versao_pesos='v1'`. UPDATE batelado idempotente via
`mcp__Supabase__execute_sql` (5 lotes), sempre com guarda `AND identidade_id IS NOT NULL`.
`tl_score` (legado) **não** tocado; backup **não** tocado.

Verificação end-to-end no banco:

| Verificação | Resultado |
|---|---|
| Linhas base sã gravadas (`versao_pesos='v1'`) | **3.330** |
| Base sã sem `tl_score_bruto` | 0 |
| Linhas `identidade_id NULL` gravadas por engano | **0** |
| Em revisão (intocadas) | 291 |
| Backup `campaigns_bkp_prev2_20260716` | **3.610** (intacto) |

`veredito_bruto` foi derivado no SQL por um espelho EXATO da régua `vereditoDaFaixa`
(provado localmente: 0 divergências vs o `veredito_bruto` do engine nas 3.330 linhas);
`override_aplicado` foi transmitido do engine (não é derivável — `sem_tier1` /
`conta_nao_calculavel` / null). As distribuições no banco batem 1:1 com a saída do engine.

Distribuição `veredito_bruto` (pré-override) — banco == engine:

| veredito_bruto | n |
|---|---|
| Só para casos específicos | 1.401 |
| Esperaria | 707 |
| Vale olhar | 531 |
| Evitaria | 347 |
| Vale agir | 344 |

Overrides aplicados — banco == engine:

| override | n |
|---|---|
| sem_tier1 | 1.971 |
| conta_nao_calculavel | 1.334 |
| (nenhum) | 25 |

Distribuição de **veredito final** (pós-override, panorama; não é coluna gravada):

| veredito | n |
|---|---|
| Não confirmado | 3.305 |
| Só para casos específicos | 17 |
| Esperaria | 4 |
| Evitaria | 4 |

(96,9% "Não confirmado" reflete o portão TIER 1 — `campanha_fontes` ainda vazia, INV-02 —
e a `conta_nao_calculavel`; é comportamento esperado, não anomalia.)

## 5. Baldes na base sã (vs dry-run sujo)

| Balde | Base sã | Dry-run sujo | Δ |
|---|---|---|---|
| B1 (alto+computável, só falta TIER 1) | 256 | 293 | −37 |
| B2 (beco `conta_nao_calculavel`) | 1.334 | 1.445 | −111 |
| B3 (TIER 1 ausente + score baixo) | 1.715 | 1.857 | −142 |
| **B4 (alto+computável+alcançável 4 crawlers)** | **102** | **103** | **−1** |
| publicável agora (alto+computável+TIER 1) | 0 | 0 | 0 |

### Balde 4 recalculado por programa (base sã) — total 102

| B4 | programa | n |
|---|---|---|
| 41 | smiles | 404 |
| 15 | livelo | 320 |
| 14 | esfera | 140 |
| 13 | azul_fidelidade | 429 |
| 10 | latam_pass | 344 |
| 3 | accor | 105 |
| 3 | amazon | 96 |
| 2 | outro | 234 |
| 1 | connectmiles | 15 |

**A queda 103 → 102 é a canonicalização funcionando:** o slot removido era
`smiles-smiles-transferencia-2024-03-31` (bruto 71, um self-loop de transferência
espúrio que inflava o B4 de smiles na base suja). Removê-lo tirou 1 falso "alto
alcançável" — nenhum B4 legítimo foi perdido.

## 6. Golden vivo (drift vs PROPOSTA snapshot)

| Caso | PROPOSTA | vivo (banco) | drift | nota |
|---|---|---|---|---|
| A livelo→azul %115 | 77 | 77 | 0 | exato |
| B bancos→smiles %70 | 59 | 49 | −10 | drift de DADO (rota mudou), = dry-run |
| C itau→latampass %40 | 79 | 79 | 0 | exato |
| D itau→latampass %25 | 37 | 36 | −1 | drift de DADO, = dry-run |
| E livelo→connectmiles %40 | 44 | 44 | 0 | exato |
| F accor→accor clube | 27 | 51 | +24 | drift de DADO, = dry-run |

Todos os drifts são **idênticos** aos do dry-run anterior → é drift de DADO (rotas
cresceram/mudaram desde o snapshot da PROPOSTA), não do engine — que já provou 6/6 na
golden-replay hermética. F/B mantêm o override correto (`conta_nao_calculavel` / null).

## 7. Recomendação de backup: **LIBERAR** `campaigns_bkp_prev2_20260716`

Justificativa: o backup ficou retido até o re-score confirmar que a canonicalização
não precisa de rollback (D-Regra de execução). O re-score confirmou:

1. Fidelidade do engine 6/6 + 32/32 testes.
2. Self-loops de transferência no conjunto pontuado = 0; os 13 recanonicalizados isolados
   em revisão, sem contaminar score.
3. Zero classe de anomalia nova — só as classes esperadas de derivação (D-042).
4. O único efeito líquido da recanonicalização no B4 foi **remover 1 self-loop espúrio**
   (smiles 71) — sinal de correção, não de dano.
5. Gravação verificada 1:1 contra o engine; base suja intocada no backup como referência.

Não há sinal de canonicalização torta que exija rollback. Recomendo **liberar** o backup.
Ressalva operacional leve: se preferir margem, manter o backup mais uns dias custa pouco —
mas tecnicamente nada pendente o exige.

## Artefatos

- Runner: `v2/M2/rescore/rescore-1.mjs` (importa o engine; zero fork).
- Saída-máquina: `v2/M2/rescore/out/rescore-1.json`.
- Linhas gravadas (insumo do batch): `v2/M2/rescore/out/rescore-1-rows.json`.
- SQL batelado idempotente: `v2/M2/rescore/out/sql/chunk_0{0..4}.sql`.

## Dívida registrada (não bloqueia)

`tem_tier1` hoje deriva de `Number(tier)===1` porque `campanha_fontes` está vazia. Quando
encher, `tem_tier1` deve vir de lá (INV-02) e o balde "publicável agora" (0 hoje) passa a
povoar. Igual ao dry-run — sem mudança de engine.
