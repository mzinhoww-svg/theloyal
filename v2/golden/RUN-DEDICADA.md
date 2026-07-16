# Run dedicada — golden set medido (M1 slice 4 → portão de milestone)

> Rotulado no critério congelado (`CRITERIO-ROTULACAO.md`), sem reabrir decisões. Gabarito com proveniência em `AMOSTRA-100-ROTULADA.json`; métricas reprodutíveis por `node v2/golden/score.mjs` (grava `METRICAS.json`). Data de referência: 2026-07-16.

## 1. O que foi entregue

- **86 itens únicos rotulados** com proveniência por campo crítico (deduplicados das 102 linhas amostradas; ver §6 sobre por que não são 100).
- **55 campanhas reais + 31 negativos** (`nao_campanha`).
- Cobertura de **8 dos 9 tipos** canônicos. `pontos_mais_dinheiro` = 0 na amostra (a base nunca o produz e a amostra estratificada não continha um caso de "pague com pontos + dinheiro"). Buraco honesto, registrado.
- Precision e recall medidos nos campos críticos (**programa, %, vigência**), **com negativos incluídos**.
- **Precision de `nao_campanha` reportada em destaque** (§3) — o número que vai para a metodologia pública.

## 2. Números do portão (campos críticos, sobre as 55 campanhas reais)

Meta do brief §13: **precision ≥ 95%, recall ≥ 90%**.

| Campo crítico | Precision | Recall | Veredito |
|---|---:|---:|---|
| **programa** (origem+destino) | 70,4% | 89,4% | abaixo |
| **percentual** | 69,2% | 100% | abaixo (precision) |
| **vigência** | 31,0% | 42,9% | muito abaixo |

**Não bate 95/90.** Por §7 (regra de honestidade) não forço o número — segue o mapa de erros por tipo (§4). O portão honesto é este, com diagnóstico acionável, não um número ajustado.

Detalhe por dimensão:
- **origem**: 46/55 corretas. Erros: 7 `wrong` (banco genérico/merchant no lugar do programa) + 2 `multi_banco_miss` (`c6-azul`, `null-smiles` — deveria ser `multiplos_cartoes`).
- **destino**: 30/55 corretas, **25 espúrias**. Quase todas são campanhas **de lado único** (clube, shopping, emissão) onde a base preenche `destino` com o **próprio programa** (`livelo→livelo`) ou com o **merchant** (`inter→uber`, `livelo→magalu`) em vez do sentinela `sem_destino`. **É lacuna de modelo, não alucinação** — a canonicalização da migration `001` (regra `lado_unico`/`sem_destino`) corrige isso estruturalmente; o golden mede a extração **crua**, pré-canônica.
- **percentual**: 18/18 bônus reais capturados (recall 100%), mas **8 valores espúrios** — taxa de acúmulo ("15 pontos por real"), pontos absolutos ("15.000 pontos") ou reajuste ("até 15%") lidos como se fossem `%` de bônus. Sujaria o Deal Desk com "bônus" inexistente.
- **vigência**: o campo mais fraco. `year_error` = 10 (dia/mês certos, **ano errado** — típico `2024` onde o slug diz `25`/`26`), `overprecision` = 9 (a base afirma uma data que o conteúdo **não sustenta**; gabarito `indeterminada`). Só 9 datas exatas + 25 `indeterminada` concordantes.

## 3. Precision de `nao_campanha` — número de metodologia pública (destaque §4 do critério)

O risco de produto é **publicar não-campanha como campanha**. A base atual:

- **Rejeita 0 dos 31 negativos.** Toda notícia vira campanha na extração crua.
- **Falso-positivo = 31/86 = 36,0%** do que a base publicaria como campanha **não é campanha**.
- Precision de detecção de campanha = **64,0%** (55/86).

Excluindo os 7 `borderline_perk` (perks de cartão sem pontos — Clube iFood grátis, Gemini grátis, Meli+/Disney+, salas VIP, débito Uber One; ver §5), o falso-positivo cai para **24/86 = 27,9%** e a precision de detecção sobe para **72,1%**.

Padrões de falso-positivo encontrados (além dos 4 previstos no §4):

| Padrão | Exemplos | n |
|---|---|---:|
| cupom de varejo | Mercado Livre ×5, Shell Box ×2, Amazon Apple, rentcars, Azul Viagens, Hoteis.com | ~12 |
| tarifa/pacote em dinheiro | passagens Bahia, LATAM R$148, voos Cidade do Cabo, Vila Galé, Grand Palladium, resorts Tauá | ~6 |
| PR / ops de companhia | patrocínio Azul, Delta IA, Qatar retoma voos, Uber hotéis | 4 |
| produto do blog | UDM cursos | 1 |
| **perk de cartão sem pontos** (novo) | iFood grátis, Gemini grátis, Meli+/Disney+, salas VIP C6 ×2, débito Uber One | 7 |
| seguro/serviço com desconto | Allianz 70% | 1 |

**A amostra tem MUITO mais falso-positivo do que os "15–20" previstos** — não é viés de amostragem, é o sinal: a extração crua não tem classificador de rejeição. Esse é o maior buraco de produto do M1, e o mais barato de fechar (um gate de rejeição antes do Deal Desk).

## 4. Mapa de erros por tipo (campos críticos)

| tipo (gabarito) | n | origem✗ | destino✗ | %✗ | vig✗ |
|---|--:|--:|--:|--:|--:|
| shopping | 10 | 3 | 9 | 6 | 3 |
| transferencia_bonificada | 10 | 2 | 0 | 0 | 4 |
| clube | 8 | 0 | 8 | 0 | 6 |
| promocao_emissao | 8 | 1 | 2 | 0 | 4 |
| outro | 8 | 2 | 3 | 1 | 2 |
| bonus_acumulo | 6 | 1 | 2 | 1 | 1 |
| status_match | 3 | 0 | 0 | 0 | 0 |
| compra_pontos | 2 | 0 | 1 | 0 | 1 |

**Leitura:**
1. **`destino` de lado único** (shopping 9/10, clube 8/8): a base não usa `sem_destino`. **Já resolvido estruturalmente** pela canonicalização (migration `001`); revalidar o golden **pós-canônico** deve zerar quase todos esses.
2. **`%` de shopping** (6/10): taxa/valor absoluto lido como bônus. Precisa de regra de extração que distinga "% de bônus" de "pontos por real"/"pontos fixos".
3. **`vigência` em todo tipo**: o parser de data erra o **ano** e **super-especifica** datas que a notícia não dá. É o campo com pior ROI hoje e o que mais engana o estado FSM (`ultimos_dias`/`encerrada`).
4. **`transferencia`**: origem quase sempre certa; os 2 erros são exatamente os `multiplos_cartoes` — a sentinela funciona, a base só não a aplica.
5. **`status_match`**: 3/3 perfeito.

## 5. Decisão que preciso do operador (não travei a run — rotulei com default e marquei)

**`borderline_perk` (7 itens):** perks de cartão/assinatura **sem pontos/milhas/cashback** — Clube iFood grátis (Amex), Gemini grátis (Itaú), Meli+/Disney+ (×2), ampliação/gasto-mínimo de salas VIP C6 (×2), débito com Uber One (Mastercard). Rotulei como **`nao_campanha`** (sem mecânica de pontos → não entra no Deal Desk). Isso move a precision de detecção entre **64,0%** (perks = não-campanha) e **72,1%** (perks = campanha). É política de produto, não de extração — **não congelei sozinho**. Estão marcados com a flag `borderline_perk` em `AMOSTRA-100-ROTULADA.json` para você flipar num único lugar.

Outros `borderline` (5, mantidos como campanha): `all-reward` (assinatura ALL com bônus de pontos), `surpreenda-stanley` (resgate Surpreenda), `tap` (reajuste do Club — mudança de valuation), `shopee-livelo` (cupom + acúmulo real), `nubank-black` (roundup de anuidade grátis).

## 6. Por que 86 e não 100

A amostra pré-selecionada tinha 102 linhas / **86 ids únicos** (a duplicação era proposital: o mesmo id aparecia em vários estratos para testar 1-notícia→N-campanhas). Deduplicado, são 86. Não "topei até 100" com itens novos porque: (a) a cobertura de tipos já chegou a 8/9 re-tipando corretamente os itens existentes (emissão e shopping estavam mascarados como `cartao`/`compra`); (b) inventar itens fora da amostra congelada para bater "100" enviesaria o portão. **Prefiro 86 rastreáveis a 100 inflados** — coerente com §7. O único tipo ainda ausente (`pontos_mais_dinheiro`) precisa de caça dirigida no conteúdo, registrada como dívida para o M2.

## 7. Veredito da slice 4

- Golden set **existe, é rastreável e vira régua de regressão do M2**. ✅
- Portão **não bate 95/90** na extração crua. O diagnóstico aponta que **dois dos quatro buracos já têm correção construída** (canonicalização de `destino`/`sem_destino` e sentinela `multiplos_cartoes` — migrations `001`/matcher), e os outros dois são trabalho de M2: **gate de rejeição** (`nao_campanha`, o de maior ROI) e **parser de vigência/ano**.
- Recomendação: **revalidar o golden pós-canonicalização** (deve subir `programa`/`destino` de imediato) e abrir o M2 com o gate de rejeição como primeira slice, medindo contra estes 86 rótulos.

Números completos e reprodutíveis: `METRICAS.json`. Rótulos com proveniência: `AMOSTRA-100-ROTULADA.json`.
