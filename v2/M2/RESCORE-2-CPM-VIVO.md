# RE-SCORE-2 — CPM VIVO de transferência (base sã, 3.330)

> Continuação do re-score-1 (D-032/D-035/D-039). Re-pontua a **base sã**
> (`identidade_id IS NOT NULL`, 3.330) alimentando a eficiência com o **CPM VIVO**
> de transferência — reconstruído de `custo-base(origem) × ratio(par)` quando não
> há CPM observado. Engine JS **importado, zero fork** (INV-12). Não inventa dado
> (INV-03). `ratio-null ⇒ CPM-null` (D-039), origem sem custo-base ⇒ CPM-null
> (D-035); **nunca 1:1 implícito**.

## O que mudou vs re-score-1

Único delta de lógica: para `tipo='transferencia'`, o CPM que entra em
`derivarEficiencia` deixa de ser só `campaigns.cpm_value` (preenchido em 10/3.330)
e passa a ser o **CPM efetivo**:

1. `cpm_value` real e válido (>0) → usa o observado (observado vence);
2. senão `cpmDeCustoBase(custo_milheiro(origem), percentual, ratio(par))`;
3. origem sem linha em `custo_base_moeda` → **CPM null** (D-035, ex.: origem de banco);
4. par sem `ratio` (ausente ou NULL) → **CPM null** (D-039), **não** chama o helper;
5. sem `percentual` (bônus é fator do divisor) → **CPM null** (não coage null→0).

O CPM efetivo entra em `campanha.cpm_value` e segue pela **mesma**
`montarEntradas / derivarEficiencia / calcularScore`. A **população de referência
da eficiência** (ECDF) passa a ser a população de CPM **efetivo** (observados +
reconstruídos): subiu de **n=10 → n=164**, então a eficiência deixa de ser inócua.

Para os demais tipos, comportamento idêntico ao re-score-1 (`cpm_value` como está).

## Gates (bloqueantes) — todos verdes

- **Golden 6/6 (engine importado, `golden-replay.mjs`):**
  A=77 · B=59 · C=79 · D=37 · E=44 · F=27 — 6/6 OK.
- **Golden CPM vivo 2/2 (`golden-cpm.mjs`, caminho NOVO custo-base×ratio):**
  - **CPM-1 (reconstruído):** `livelo→connectmiles`, bônus 40%, custo 30, ratio 0,3333
    → `cpmDeCustoBase(30,40,0,3333) = 64,29`. Passa por `derivarEficiencia` contra
    população fixa → eficiência **0,25** → `tl_score_bruto` **53** (Esperaria).
    Exercita a reconstrução ponta-a-ponta (não o CPM 60 pronto do caso E).
  - **CPM-2 (contrato D-039):** par sem ratio → `cpmDeCustoBase(30,40,undefined)=null`
    e `(…,null)=null` → eficiência **ausente** → redistribui → `tl_score_bruto` **65**
    (Só para casos específicos); **não** cai em `conta_nao_calculavel`, **não afunda**.
- **`node --test v2/lib/**/*.test.mjs`:** 51/51 (inclui o teste-âncora 30:
  livelo→connectmiles 40% → CPM 64,29).
- **Blindagem de vetor stale:** raridade `n=1` lida do banco
  (`derivacao_config.derivacao.v1`) = **0,85** (D-037) — asseverado antes de
  qualquer gravação. OK.

## CPM vivo — cobertura das 700 transferências (base sã)

| origem do CPM | linhas | leitura |
|---|---:|---|
| **reconstruído** (custo×ratio) | **154** | CPM vivo em R$, conta fechada |
| observado (`cpm_value>0`) | 4 | CPM real já no banco |
| `null_sem_custo_origem` (D-035) | 447 | origem sem custo-base (bancos, itaú, elo, cias…) |
| `null_sem_ratio` (D-039) | 83 | origem tem custo, par sem ratio confiável |
| `null_sem_percentual` | 12 | sem bônus → divisor indefinido, não chuta |

`custo_base_moeda`: 4 moedas (livelo 30, esfera 35, smiles 21, ihg 28).
`custo_base_ratio`: 8 pares não-nulos (livelo/esfera → azul/latam/smiles = 1;
→ connectmiles = 0,3333). Só `livelo` e `esfera` são origem com custo **e** ratio —
por isso 447 transferências (origem sem custo-base) seguem CPM-null **por natureza**.

## Baldes — B4 pós-CPM vs 102 do re-score-1

**B4 total: 102 → 101** (net −1). Composição por programa:

| programa | B4 r1 | B4 r2 | Δ |
|---|---:|---:|---:|
| smiles | 41 | 40 | −1 |
| azul_fidelidade | 13 | **17** | **+4** |
| livelo | 15 | 15 | 0 |
| esfera | 14 | 14 | 0 |
| latam_pass | 10 | **7** | **−3** |
| connectmiles | 1 | **0** | **−1** |
| accor / amazon / outro | 3 / 3 / 2 | 3 / 3 / 2 | 0 |

Movimento a nível de item: **entraram 4, saíram 5**.

- **Entraram (4)** — todos `azul_fidelidade`, `livelo→azul 115%`, bruto **69→76**:
  CPM reconstruído ≈ R$13,95 (custo 30 / 2,15) → eficiência alta → cruzou 70.
- **Saíram (5)** — CPM caro derrubou:
  - `esfera→latam_pass 35%` ×3: CPM ≈ R$25,93 → bruto **74→57**;
  - `esfera→smiles 90%`: bruto **75→66**;
  - `esfera→connectmiles 75%`: CPM ≈ R$60,00 (ratio 3:1) → bruto **71→51**.

O ratio 3:1 do ConnectMiles (D-039) é exatamente o que tira o par do balde: sem
ele, o CPM mentiria 2,8× e o item ficaria alto sem lastro.

## NÚMERO-ASSINATURA — B4 conta fechada vs só-percentil

Dos **101** itens do B4 pós-CPM:

- **28 com CPM efetivo não-null (conta fechada em R$)** — Deal Desk abre em reais:
  `azul_fidelidade 17 · smiles 6 · latam_pass 5`.
- **73 só por percentil-de-rota (CPM null tipado)** — sobem por posição na rota,
  sem conta em reais: `smiles 34 · livelo 15 · esfera 14 · accor 3 · amazon 3 ·
  outro 2 · latam_pass 2`.

Ou seja: **~28% do B4 tem conta aberta em reais**; o primeiro Deal Desk de destino
`azul_fidelidade` (17/17 conta fechada) e `latam_pass` (5/7) é onde o CPM vivo
efetivamente vira número na tela — os `livelo`/`esfera` como *programa* são
compras/rotas sem destino resolvido (CPM null, seguem por percentil).

## Banda 65 (redistribuição sem CPM)

286 itens estavam em `bruto=65` no re-score-1 (percentil neutro + raridade +
abrangência, sem CPM). Com o CPM vivo, **apenas 1 saiu** (um `connectmiles`, para
baixo); **0 subiram**. A banda 65 é estável: é o piso de quem não tem CPM
reconstruível — o CPM vivo age sobre itens que **já tinham sinal de percentil**,
não sobre os que dependiam só da rota.

## Distribuição de `veredito_bruto` (base sã)

| veredito | r1 | r2 | Δ |
|---|---:|---:|---:|
| Só para casos específicos | 1401 | 1397 | −4 |
| Vale olhar | 531 | 529 | −2 |
| Esperaria | 707 | 703 | −4 |
| Vale agir | 344 | 345 | +1 |
| Evitaria | 347 | 356 | +9 |

Deslocamento líquido para **Evitaria (+9)**: CPMs reconstruídos caros puxaram
transferências para baixo — o efeito esperado de acender a conta.

## Anomalias — trava D-038

- **Por linha:** self-loops no conjunto pontuado = **0**; sem_destino percentil
  saturado = 0; percentil saturado base≥20 = 0.
- **Por programa:** **21 flags — idênticas às 21 do re-score-1** (0 novas, 0
  sumidas, 0 motivos alterados). Nenhum programa ganhou score suspeito NOVO.
  Nenhuma identidade colapsada nova. **Trava passou 100% limpo → liberou a gravação.**

Row-level: 162/3.330 mudaram `tl_score_bruto` (67 subiram, 95 desceram; 156 são
transferências, 6 são compras com CPM observado que re-rankearam contra a nova
população de 164). Maior alta +11, maior queda −20.

## Gravação (idempotente, verificada)

- Gravado `tl_score_bruto`, `veredito_bruto`, `override_aplicado`, `versao_pesos='v1'`
  **só onde `identidade_id IS NOT NULL`** via `UPDATE … FROM (VALUES …)` batelado.
- Como o banco já continha o re-score-1, a gravação tocou as **162 linhas que
  diferem** (provado: diff-full = diff-bruto = 162, nenhuma linha com
  veredito/override divergente e bruto igual). Idempotente.
- **Verificação pós-escrita:** `sum(tl_score_bruto)`=202.348 (esperado 202.348),
  Evitaria=356, Vale agir=345, `versao_pesos='v1'` em 3.330, **0 linhas fora da
  base sã tocadas**. Checksum `md5(string_agg(… order by id collate "C"))` da base
  sã no banco = **`9b575bb078217ff1e8e327acc9146174`** = checksum local de
  `rescore-2-rows.json` → **paridade byte-a-byte das 3.330 linhas**.
- **Não tocado:** `campaigns_bkp_prev2_20260716`, `tl_score` legado, linhas com
  `identidade_id` nulo (13 self-loops em revisão).

## Recomendação de backup — `campaigns_bkp_prev2_20260716`

**Liberar (o gatilho do operador foi cumprido), com uma ressalva.** A condição
posta — "segurar até a 2ª escrita em escala fechar verificada" — está **satisfeita**:
o re-score-2 gravou byte-a-byte verificado (checksum + agregados + 0 linhas fora
da base sã), com golden 6/6 + CPM vivo 2/2 e trava de anomalia idêntica (0 novas).

Ressalva: o backup tem **3.610 linhas no schema legado** (origem/destino/cpm/
`tl_score`/`verdict`) — é o rollback da **cadeia M2 inteira** (recanonização +
identidade + re-score), não só das 4 colunas de score. O `DROP` é irreversível e
está **fora do escopo desta slice**; não toquei o backup. Recomendo que o operador
faça o descarte físico de forma consciente (ou o mantenha — custo baixo). Do ponto
de vista **desta 2ª escrita**, nada mais depende dele.

## Reprodutibilidade

```
node v2/M2/rescore/golden-replay.mjs        # 6/6
node v2/M2/rescore/golden-cpm.mjs           # 2/2 (CPM vivo)
node --test v2/lib/**/*.test.mjs            # 51/51
node v2/M2/rescore/rescore-2.mjs            # dry-run (lê out/snapshot.json)
```

Artefatos: `v2/M2/rescore/out/rescore-2.json` (relatório-máquina),
`rescore-2-rows.json` (insumo da gravação), `out/sql-2/update_diff.sql` (UPDATE
das 162 linhas). `out/snapshot.json` é a leitura do banco (via MCP) que alimenta o
runner na ausência de `SUPABASE_ANON_KEY`.
