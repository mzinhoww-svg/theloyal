# Relatório de dry-run — canonicalização de identidade (M1)

> Computado sobre as distribuições reais de `campaigns.origem`/`destino`/`vigencia_fim` (leituras read-only do banco vivo, 2026-07-16). Números do corpo por volume de linhas (total 3.600). Tail estimado a partir da distribuição de frequência; a contagem exata sai do `canonicalizar.mjs` quando a conexão estabilizar.

## Achado que reformula a slice

A premissa do M0 ("458 variantes de origem → ~12 programas") estava **errada**. A realidade:

- **`origem`: 458 variantes distintas** cobrindo o ecossistema inteiro — aéreas (dezenas), bancos (dezenas), varejo/e-commerce, hotéis (redes + hotéis individuais), combustível, streaming, delivery — **mais** ruído e typos.
- **`destino`: 362 variantes distintas**, MAS dominadas por **`desconhecido` = 1.223 linhas (34%)** + `null`/`na` ≈ 13. **Um terço das campanhas não tem destino identificado** → não são "rota" (origem→destino); são campanhas de lado único (promo num varejo/banco sem destino de transferência) ou falha de extração.

Ou seja: canonicalização **não é colapsar variantes de 12 programas** — é **(a)** construir um registro canônico de ~150–250 entidades reais, **(b)** filtrar ruído, e **(c)** decidir o que fazer com ~34% de campanhas sem destino.

## Cobertura por volume (com seed head de ~60 programas)

| Lado | Resolvido (programa real) | Ruído/indefinido | Cauda (marca real fora do seed) |
|---|---|---|---|
| **origem** (3.600 linhas) | **~2.620 (≈73%)** | ~120 (≈3%): `null` 61, `desconhecido` 51, `na` 4 | ~860 (≈24%): kmv, banestes, united, wyndham, dezenas de hotéis/marcas n=1–9 |
| **destino** (3.600 linhas) | **~1.680 (≈47%)** | **~1.236 (≈34%)**: `desconhecido` 1.223 | ~684 (≈19%): iberia/avios/flyingblue, hotéis, varejo n=1–9 |

**Resposta direta à sua pergunta (ruído vs. programa real fora do seed):**
- **Ruído verdadeiro** (não é programa): `null`, `desconhecido`, `na`, `x`, `banco`, `governo`, `cartao`, `pontos`, `dinheiro`, `dolar`, `hoteis`, `3.3`, `cartao151025`, typos (`canda`, `alexpress`, `hellmans`, `lacaoderofertas`). No **destino** o ruído é enorme por causa de `desconhecido` (34%); no **origem** é pequeno (~3%).
- **Programa real fora do seed → vira INSERT em `programas`, não descarte:** a grande maioria da cauda. Aéreas (united, aeroplan, avios, iberia, emirates, etihad, qatar, turkish, lufthansa, delta, avianca, copa/connectmiles, lifemiles, e ~30 internacionais n=1), bancos (banestes, sicoob, safra, banrisul, unicred, bnb, banese…), hotéis (marriott, hilton, ihg, hyatt, wyndham, accor + dezenas de hotéis/resorts individuais), varejo (amazon, magalu, shopee, aliexpress, carrefour, samsclub, americanas, renner…), combustível (shell, premmia, ipiranga/kmv), delivery/serviços (uber, ifood, rappi, 99).

## Vigência (3.600 linhas)

| Classe | Linhas | Ação da FSM |
|---|---|---|
| Data ISO válida | **2.145 (60%)** | `vigencia_fim_date` preenchida, `vigencia_confiavel=true` → estado datado (ativa/últimos_dias/encerrada/histórica) |
| `"na"`/indeterminado | **1.448 (40%)** | `indeterminada` + flag de revisão (D-006; nunca descartada) |
| Formato estranho (7) | 7 | `indeterminada` (o parser rejeita → seguro) |
| DD/MM/YYYY | 0 | — (não há esse formato na base) |

O matcher e a FSM já tratam os três casos corretamente (testado).

## Implicações para o modelo de identidade

1. **~34% das campanhas não têm destino** → precisam de decisão de modelagem: (a) identidade de lado único (`tipo|origem|—|publico`, ex.: `compra_pontos` num banco sem destino), ou (b) fila de revisão. Não é "rota".
2. **Registro de programas** precisa crescer de ~17 para ~150–250, com `kind` expandido: `aereo | bancario | varejo | hotel | combustivel | ecommerce | streaming | servico | outro`.
3. **Profundidade da cauda** é decisão de escopo: hotéis/resorts individuais (n=1) e marcas de varejo n=1 — entram como `programas` ou ficam agrupados (`hotel_individual`, `varejo_outro`) até terem volume?

## Decisões aplicadas (2026-07-16)

1. **Destino desconhecido → regra por tipo.** Implementado: origem resolvida + tipo sem destino → identidade de lado único; `transferencia` sem destino → revisão.
2. **Head + buckets.** Seed expandido para **103 programas** (39 bancário, 23 varejo, 20 aéreo, 9 serviço, 6 hotel, 4 combustível, 2 streaming); cauda → bucket por kind com `origem_bruto`/`destino_bruto` preservados.
3. **Curadoria minha → sua revisão.** Registro em `v2/db/seed-aliases.json` (versionado, revisável no PR #84).

## Números finais pós-A+C (classificação ratificada)

Registro: **191 programas**, **373 aliases**, **109 ruídos** no seed.

| Lado | Programa (head) | Ruído (revisão) | Bucket (cauda) |
|---|---|---|---|
| origem | **87,9%** (3.165 linhas) | 7,5% (271) | 4,6% (164) |
| destino | **59,1%** (2.127) | 37,2% (1.340) | 3,7% (133) |

- **Campanhas que canonicalizam** (identidade de rota OU de lado único): **~92,5%** (origem resolvida a programa ou bucket).
- **Campanhas em revisão `origem_nao_resolvida`**: **~271** (origem = ruído/vazio: `null`, `desconhecido`, cidades, blogs, lixo). Nunca descartadas; `origem_bruto` preservado; volume alimenta o golden set.

### Destino "desconhecido" (34%) — resolvido, NÃO é bloqueio de TL Score

Cruzamento `destino indefinido × tipo` (1.239 campanhas sem destino):

| Situação | Campanhas | Tratamento |
|---|---|---|
| **Transferência** sem destino | **8** | → revisão (`transferencia_sem_destino`). Único caso que não pontua. |
| Tipos de **lado único** (compra/clube/cartão/shopping/status_match) | **1.006** | → identidade de lado único. Pontua normal (CPM não exige destino). |
| Outros tipos (não-transferência) | 225 | → lado único (`outro`). |

**Conclusão:** o destino não precisa de passada própria de classificação. A regra de lado único já cobre 1.231 das 1.239 sem destino; só **8** transferências ficam em revisão. Destino não trava o M2.

## Próximo passo

Nada aplicado ao banco (D-006: snapshot antes; MCP instável nesta sessão). Quando a conexão estabilizar: aplicar migration 001 + rodar `canonicalizar.mjs --dry-run` para os **números finais exatos** (resolvidas/lado-único/bucket/revisão por motivo) sobre as 3.600 linhas, e devolver o relatório para sua aprovação antes do `--apply`.
