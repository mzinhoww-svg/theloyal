# M2 · Slice 3 — Parser de vigência (SPEC + primeira medição)

> Spec-antes-de-código. O pior campo do golden (precision 0,35). Trava antes de qualquer linha. Mede contra os 86. Traz a medição já quebrada nas **duas causas distintas** — parsing vs confiabilidade de fonte — porque são bugs de natureza diferente e uma delas nem é bug.

## 0. As duas falhas não são a mesma coisa (enquadramento do operador)

| falha | pergunta | natureza | onde vive |
|---|---|---|---|
| **parsing** | "consegui ler a data certa do texto?" | **bug de parser** | slice 3 conserta |
| **confiabilidade** | "li, mas confio na fonte dessa data?" | **estado legítimo do produto** | FSM já trata |

O TL Score já rebaixa vigência não-confirmada para **"Não confirmado"** (override). O parser não pode confundir "não consegui ler" (bug) com "li mas veio de blog TIER 2" (estado correto). A slice 3 conserta **só o parsing**; a confiabilidade **já está resolvida** (FSM `derivar_estado_vigencia` + `confirmar_tier1`).

## 1. Primeira medição — o 0,35 quebrado nas duas causas (52 campanhas)

**Parsing** (das 26 datas que a extração afirma, quantas batem o que o texto diz):

| resultado | n | % das afirmadas |
|---|--:|--:|
| correta | 9 | 35% |
| **year_error** (dia/mês certos, **ano errado**) | 8 | 31% |
| **overprecision** (afirmou data que o texto **não dá**) | 8 | 31% |
| wrong / missed | 2 | 8% |
| **precision de parsing** | **9/26 = 0,346** | |

Além dessas, **25 casos `indeterminada` corretos** (texto sem data → não afirmou nada, certo).

**Confiabilidade** (eixo separado): **0 das 52 vêm de TIER 1.** Fontes do golden: `melhorescartoes` 44, `passageirodeprimeira` 23, `melhoresdestinos` 17, `pontospravoar` 2 — **todas TIER 2**. Logo, **100% das datas são "não confirmadas"** por definição — e isso está **certo**: o FSM as roteia para `indeterminada`/"Não confirmado" até um `confirmar_tier1`. **Não é bug de parsing; é o produto funcionando.**

**Conclusão:** os 65% de erro de parsing são **quase inteiros dois padrões** — `year_error` (31%) e `overprecision` (31%). Consertar esses dois leva a precision de parsing de 0,35 para ~0,9 sem tocar confiabilidade.

## 2. Os dois bugs de parsing, nomeados

### 2.1 `overprecision` — afirmar data que o texto não dá (o mais barato de matar)
Ex.: "até sábado (17)" sem mês/ano → a extração cravou `2024-08-17`. **Regra:** se o texto não dá **dia+mês+ano deriváveis com confiança**, emite `indeterminada`, **nunca** fabrica. Mata 8/17 erros de imediato. Custo ~zero, ganho máximo. Determinismo puro.

### 2.2 `year_error` — inferir o ano errado
Ex.: "válida até 30/06" num artigo de mai/2025 → cravou `2024-06-30`. O ano quase nunca está no trecho; vem de **contexto**: `publicado_em` da notícia, slug (`mai25`, `abr26`), ou "hoje (29/04)" + data de publicação. **Regra de inferência de ano, em ordem de confiança:**
1. ano explícito no texto (`29/09/25`, `2026`) → usa.
2. `publicado_em` da notícia: se dia/mês ≥ publicação → mesmo ano; se < → ano seguinte (vigência no futuro próximo).
3. slug com `mmmAA` (`abr26`) → ano do slug.
4. nada disso → **`indeterminada`** (volta para 2.1: não chuta ano).

## 3. Separação dos dois eixos no dado (não conflar)

Já existem colunas distintas (migration `001`) — a slice **mantém e alimenta** a separação:
- `vigencia_fim_date` + `vigencia_confiavel` = **parsing** (li uma data válida?). O parser **nunca** seta confiança de fonte.
- confirmação de fonte = **`campanha_fontes` TIER 1** (via `confirmar_tier1`). Só isso promove a `ativa` no FSM.
- `derivar_estado_vigencia(...temTier1...)` já combina os dois. Parsing bom **não** vira "confirmado"; continua "Não confirmado" até TIER 1. Isso é invariante, não bug.

## 4. Métrica do portão da slice (medida contra os 86)

| métrica | alvo que defendo | racional |
|---|---|---|
| **overprecision** (datas fabricadas) | **0** | nunca afirmar data que o texto não sustenta; é o pior erro (engana o FSM `ultimos_dias`/`encerrada`) |
| **precision de parsing** (das afirmadas, quantas certas) | **≥ 0,90** | matar overprecision + inferência de ano fecha a maior parte |
| **recall de parsing** (das datas que o texto dá, quantas lidas) | **≥ 0,85** | ler o que está lá; na dúvida `indeterminada`, não chute |
| confiabilidade | **medida à parte**, não misturada | 0/52 TIER 1 é estado correto, não meta a "melhorar" |

Regra de honestidade (§7 do critério): se não bater, mapa de erro por padrão (year vs overprecision vs outro), sem forçar. Abstenção (`indeterminada`) **nunca** conta como erro de parsing — é o comportamento seguro.

## 5. Fora de escopo
- Não constrói coleta TIER 1 (dívida de adapters, M2/M3). A confiabilidade continua vindo do `confirmar_tier1` manual/interino.
- Não recalcula TL Score (slice do engine).
- Não mexe no gate (slice 1, fechada).

## 6. Definição de pronto
1. Parser de vigência (puro, testável) com as regras 2.1 + 2.2; golden files travando o comportamento.
2. Medição contra os 86: **precision/recall de parsing + overprecision=0**, com a confiabilidade reportada **à parte** (0/52 TIER 1, estado correto).
3. Mapa de erro por padrão se não bater.
4. Fecho `gsd-output-formatter`.

---

**Aguardo aprovação desta spec (e dos alvos) antes de codar o parser.**
