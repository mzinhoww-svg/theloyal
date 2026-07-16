# Caça ao tipo `pontos_mais_dinheiro` — fechando a cobertura 9/9

> Trilha C (COBERTURA). O golden cobria 8 dos 9 tipos canônicos (D-001). Faltava `pontos_mais_dinheiro` (pagar resgate/compra com **pontos + dinheiro combinados**). Rotulado no critério **congelado** (`CRITERIO-ROTULACAO.md`). Mudanças **aditivas** — o portão M1/M2 congelado fica intacto.

## 1. O que a busca achou: **0 reais, 4 sintéticos**

Caça dirigida na base com os termos do brief ("pontos + dinheiro", "milhas + dinheiro", "cash and points", "complete com dinheiro", "pague a diferença", "parte em milhas parte em reais") e varredura entre os `outro`/`compra`/`shopping` (candidatos a misclassificação).

**Achado: a base genuinamente não tem nenhum `pontos_mais_dinheiro`.** Confirma o `CRITERIO §3` ("a extração nunca produz esse tipo") por três vias independentes:

| Verificação | Resultado |
|---|---|
| Termos de pagamento combinado em `AMOSTRA-100.json` (dinheiro/complete/diferença/parte em/cash) | Nenhum item de pagamento combinado. O único "R$ ou milhas" (`latampass-desconhecido-compra-2024-09-16`, *"R$ 148 **ou** 2.692 milhas"*) é **either/or** — tarifa alternativa, não split; já é `nao_campanha`. |
| Corpus bruto rotulado por tipo no worktree | Não existe. Só há distribuições de **código de programa** (`v2/db/analise/dist-origem.json`, `dist-destino.json`) — frequência de origem/destino, sem eixo de tipo. |
| Conexão de leitura ao banco vivo | Indisponível no worktree isolado. Trabalhei com os arquivos, como o brief autoriza. |

Como o brief prevê para esse caso (base plausivelmente vazia), construí **4 exemplos sintéticos claramente marcados** só para o golden cobrir o 9º tipo. **Nunca apresentados como reais**: `fonte: "sintetico"`, campo `sintetico: true`, `estrato: "pmd_sintetico"`, `url` `sintetico://...`, trecho iniciado por `SINTÉTICO (nao e noticia real)`, e flag `sintetico` no gabarito. Texto **próprio** (INV-02) — paráfrase da mecânica de produto, sem copiar fonte externa.

## 2. Os 4 rótulos (critério congelado, com proveniência por campo crítico)

Todos: `classe=campanha`, `tipo=pontos_mais_dinheiro`, `destino=sem_destino` (resgate/compra dentro do próprio programa, **sem transferência**), `publico=geral`, **`percentual=null`** (split de pagamento não é bônus → **sem invenção de número, INV-03**), **`vigencia_fim=indeterminada`** (sem data real inventada).

| id (sintético) | origem | mecânica | prov. origem |
|---|---|---|---|
| `pmd-sintetico-smiles-dinheiro-mais-milhas` | `smiles` | "Dinheiro + Milhas": parte da emissão em milhas, resto em reais | trecho nomeia saldo de milhas Smiles |
| `pmd-sintetico-latampass-pontos-mais-dinheiro` | `latam_pass` | "Pontos + Dinheiro": completa o resgate pagando a diferença em reais | trecho nomeia LATAM Pass |
| `pmd-sintetico-azul-pontos-mais-dinheiro` | `azul_fidelidade` | passagem paga em pontos + dinheiro no cartão | trecho nomeia Azul Fidelidade |
| `pmd-sintetico-livelo-pague-com-pontos-e-dinheiro` | `livelo` | resgate de produto pago em pontos + reais | trecho nomeia Livelo |

Spread proposital: resgate aéreo, complemento de resgate, compra de passagem e resgate de produto — quatro origens distintas (aéreo x2, banco/coalizão x2). `percentual` e `vigencia_fim` têm proveniência explícita justificando o `null`/`indeterminada` (não é dado faltando por descuido — é a natureza do tipo).

### Distinção travada vs `compra_pontos` (para não driftar)
`compra_pontos` = **comprar** pontos/milhas com dinheiro (aumenta o saldo). `pontos_mais_dinheiro` = **pagar** um resgate/compra com um **mix** pontos+dinheiro (o cliente leva o bem/passagem). Cada trecho sintético crava a fronteira ("não é compra de milhas", "sem transferência"). Não houve caso ambíguo real a escalar.

## 3. Onde entraram (aditivo, rebase trivial)

- **`AMOSTRA-PMD.json`** (novo) — as 4 amostras sintéticas. `AMOSTRA-100.json` **intocada**.
- **`score.mjs`** — lê `AMOSTRA-PMD.json` e concatena; 4 entradas novas no mapa `G` (flag `sintetico`); os sintéticos são **excluídos** de detecção e campos críticos e escritos em rotulada separada.
- **`AMOSTRA-PMD-ROTULADA.json`** (novo) — saída rotulada dos sintéticos.
- **`AMOSTRA-100-ROTULADA.json`** — **byte-idêntica** à base (sintético não entra aqui de propósito: `gate-run.mjs` consome este arquivo; contaminá-lo sujaria o portão congelado).
- **`METRICAS.json`** — só ganhou `total_com_sinteticos`, `cobertura_tipos` e `sinteticos`. **Nenhum número congelado mudou.**

## 4. Efeito na cobertura: **8/9 → 9/9**

`METRICAS.cobertura_tipos`:

```
transferencia_bonificada 10 | promocao_emissao 5 | compra_pontos 2 | clube 8
status_match 3 | bonus_acumulo 6 | shopping 10 | pontos_mais_dinheiro 4 | outro 8
cobertura: "9/9"  ·  faltando: []
```

Portão congelado **intacto** (verificado): detecção 86/52/34, `precision_deteccao` 0,6047, programa P 0,686 / R 0,886, `tipo_secundario` 30/52. `GATE-METRICAS.json` regenera **sem diff** após `node gate-run.mjs`.

O gap que o tipo expõe: nos 4 sintéticos a extração da base mapearia para `compra`/`shopping` (visível em `extracao_atual`), evidenciando que o pipeline **não tem saída `pontos_mais_dinheiro`** — exatamente o buraco que o golden agora documenta.

## 5. Decisões novas para o orquestrador consolidar (eu NÃO edito DECISIONS.md)

1. **`pontos_mais_dinheiro` fechado só com sintéticos.** Base tem 0 reais (confirmado). Se/quando houver leitura do banco vivo, vale um segundo passe caçando `outro`/`compra` reais com pagamento combinado, para **substituir** os sintéticos por reais (sintético é ponte, não destino).
2. **Sintético fora do agregado congelado, por design.** Rotulada real e `GATE-METRICAS.json` ficam intactos; cobertura vive em `METRICAS.cobertura_tipos` + `AMOSTRA-PMD-ROTULADA.json`. Se o orquestrador quiser o gap medido *dentro* do portão, é uma decisão de convenção (mexe em `gate-run.mjs`, fora do meu escopo) — **sinalizo, não improviso.**
3. **Convenção de campos do tipo:** `pontos_mais_dinheiro` tende a `destino=sem_destino`, `percentual=null`, e vigência frequentemente `indeterminada` (feature de produto contínua, não campanha datada). Vale ratificar como regra do matcher.

## 6. Pergunta bloqueante

Nenhuma. A distinção `pontos_mais_dinheiro` × `compra_pontos` estava clara no critério congelado; não houve caso ambíguo real que exigisse decisão fora dele.
