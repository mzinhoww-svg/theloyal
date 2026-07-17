# RESULTADO — Extrator de preço de `compra_pontos` (CPM)

**Slice:** M2 · extrator de preço de milheiro
**Arquivos:** `v2/lib/cpm/extrator-preco.mjs` (puro) · `v2/lib/cpm/extrator-preco.test.mjs` (node --test)
**Status:** 17/17 testes verdes. Validado contra os registros reais de `campaigns.tipo='compra'`.

## O que faz

Em compra de pontos/milhas, o preço anunciado **é o CPM diretamente** (você paga R$X por 1.000 pontos). O extrator lê esse preço do texto da campanha e devolve o `cpm_value` que `derivacao.mjs` (`derivarEficiencia`) consome — sem tocar na derivação.

```js
extrairPrecoMilheiro(texto) → { cpm_value:number, evidencia:string, piso?:boolean, aproximado?:boolean } | null
```

## Formatos reconhecidos (todos vistos no banco)

| Formato real | Campo | Saída |
|---|---|---|
| `R$ 29,93 /milheiro` | `cpm` | `29.93` |
| `R$35/milheiro` (colado) | `cpm` | `35` |
| `R$ ~28/milheiro` (aproximado) | `cpm` | `28`, `aproximado:true` |
| `16.84` (número já isolado) | `cpm` | `16.84` |
| `... por R$ 30,50 o milheiro` | `notes` | `30.5` |
| `Turbo Livelo - milheiro por R$ 29,50` | `notes` | `29.5` |
| `Milheiro Azul por R$ 9,50` | `notes` | `9.5` |
| `milheiro a R$ 16,12` | `notes` | `16.12` |
| `milheiro a partir de R$ 16,84` (**piso**) | `valor_leitura` | `16.84`, `piso:true` |
| `Milheiro cai de R$70 para R$35` (**queda**) | `notes` | `35` (preço final; R$70 é tabela) |

- **Vírgula BR** (`30,10`), **ponto decimal** (`16.84`) e **ponto de milhar** (`1.234`) tratados em `parsePrecoBR`.
- **`a partir de`** → marcado `piso:true` (piso da faixa, **não** o preço exato de toda ela).
- **`de R$X para R$Y`** → devolve `Y` (preço vigente), descarta `X` (tabela).
- **`~`** (aproximado) → marcado `aproximado:true`.

## Disciplina (INV-16 / INV-03) — só afirma com evidência

- **Âncora obrigatória:** só extrai um R$ quando ele está amarrado ao token `milheiro` (janela de 40 chars; 60 para `de/para`). Sem essa âncora → `null`.
- Isso separa compra-de-milhas de **cupons de varejo classificados como `compra`** (Mercado Livre, AliExpress, Shopee, cinema, parques, "converter R$ 500", "passagem a partir de R$ 135,23"): todos têm `R$` mas **nenhum tem `milheiro`** → corretamente `null`. Zero falso-positivo nesses casos.
- `valor_leitura` textual sem preço (`caro`, `caro vs teto 27`) → `null`.
- Único caso de "número solto": quando o **texto inteiro é o número** (ex.: campo `cpm = "16.84"` / `"R$35"`), aí o número está literalmente no texto e o contexto de compra é do chamador. Não há varredura de número solto no meio de frase (evita capturar `R$ 500` de "converter R$ 500").

## Cobertura sobre as compras reais do banco

- **1.845** campanhas `tipo='compra'` no total.
- **6** têm hoje `cpm`/`cpm_value` estruturado.
- **22** têm um preço de milheiro **extraível** do texto já armazenado (`cpm` + `valor_leitura` + `notes`).
- Rodando o extrator sobre essas 22: **22/22 extraídas, 0 divergências** contra os 6 `cpm_value` já gravados.

**Ganho:** de 6 → 22 compras com CPM estruturável a partir do texto atual (**3,7x**), sem chutar nenhuma das outras 1.823. A cobertura é baixa em termos absolutos porque **a maioria das linhas `compra` não é compra-de-milhas** (é cupom de varejo) e/ou **não traz o preço no texto coletado** — não é limitação do parser, é ausência de evidência (correto devolver `null`).

## Decisões novas (para o orquestrador — NÃO editei DECISIONS.md)

1. **Âncora `milheiro` é o gate anti-falso-positivo.** `tipo='compra'` no banco mistura compra-de-milhas com cupom de varejo. O preço só é afirmado quando amarrado a `milheiro`. Se o pipeline futuro tiver um `tipo` mais fino (ex.: `compra_pontos` vs `compra` varejo), a âncora continua valendo como segunda trava.
2. **`piso:true` precisa fluir para a derivação/veredito.** `a partir de R$X` é o piso da faixa; o CPM real de boa parte das aquisições fica **acima** disso. Consumir um piso como se fosse preço médio superestima a eficiência. Sugestão: `derivarEficiencia` (ou a camada acima) tratar `piso` de forma conservadora, ou o veredito sinalizar "a partir de".
3. **`aproximado:true`** (`~R$28`, câmbio de programa em USD) idem: é estimativa, não preço fechado — candidato a "Não confirmado"/nota de rodapé conforme regra de negócio.
4. **`de R$X para R$Y` → Y.** Confirmado que o preço vigente é o segundo valor; o primeiro é tabela/ancoragem promocional.
5. **Precisão:** saída arredondada a 2 casas (centavos). Bate exatamente com os `cpm_value` já gravados.
6. **Extrator é puro e stateless** — não decide de qual campo ler. Sugestão de precedência para o chamador: `cpm` → `valor_leitura` → `notes` → título/trecho, primeiro `!== null` vence.
