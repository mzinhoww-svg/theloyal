# Revalidação do golden pós-canonicalização (M2 slice 2 — medição)

> Mede o ganho estrutural que a migration `001` já entregou em `programa`, sem código novo de extração. Reprodutível: `node v2/golden/postcanon.mjs` (lê o estado canônico de `campaigns.origem_code/destino_code`). Data: 2026-07-16.

## Números (campo `programa`, sobre as 55 campanhas reais)

| fonte | precision | recall |
|---|---:|---:|
| extração crua (run dedicada) | 0,704 | 0,894 |
| **pós-canon — convenção canônica** | **0,788** | **0,830** |
| pós-canon — strict (SD exige `sem_destino`) | 0,636 | 0,797 |

## Leitura (honesta, não é o pulo limpo para 95)

A canonicalização **subiu precision (+8,4pp) e baixou recall (−6,4pp)**. Não é regressão — é **abstenção correta**:

- **Recall caiu porque a canonicalização não chuta.** Onde não resolveu com confiança, gravou `origem_code = null` → revisão, em vez de manter o palpite cru. São 5 origens: os recuperável (`banco→btg`, `cartao azul`), os `multiplos_cartoes` não aplicados (`null-smiles`), e `crypto` (que a extração crua até acertava). Para produto credibility-first, `null` em revisão > rota errada no Deal Desk. **O gap de recall é dívida conhecida (D-013), não ruído novo.**
- **Precision subiu porque destino foi resolvido e self-loops colapsados** (Clube Livelo `livelo→livelo`, 15 casos), quando a extração crua deixava destino sujo/merchant.

## Dois pontos de reconciliação golden ↔ canônico (dívida de manutenção do golden)

1. **Single-sided own-program:** o golden colapsou Clube Livelo / acúmulo próprio em `sem_destino`; o modelo canônico usa **self-loop** (`livelo→livelo`, `lado_unico=false`) e reserva `sem_destino` para lado único genuíno (compra de milhas, bônus de emissão). O modelo canônico é **coerente** — **adoto ele** no golden. É a diferença entre 0,636 (strict) e 0,788 (convenção).
2. **Modelo de shopping:** origem = **merchant** (`casas_bahia` p/ Pontofrio, `shopee`) vs programa. Precisa de convenção fixa: numa campanha de acúmulo em loja, quem é `origem`? Decisão pendente (afeta `pontofrio-smiles`, `shopee-livelo`).

## Implicação para o dimensionamento do M2

O `programa` **não precisa de esforço grande de extração nova**. O gap restante para 90/95 é, em ordem:
1. **Aplicar as dívidas conhecidas** — alias `btg` (3 recuperável), aplicar `multiplos_cartoes` (2), alucinação de rota `latampass→smiles` (1). Fecha a maior parte do recall.
2. **Reconciliar o golden** com a convenção canônica (self-loop + modelo shopping) — sobe a precision medida sem tocar extração.
3. O resto do trabalho de qualidade é **vigência/ano** (o pior campo, 31%) e o **gate de rejeição** (o de maior ROI) — não `programa`.

Ou seja: a slice 1 (gate) e a slice 3 (vigência) são onde está o trabalho; `programa` está a poucas dívidas conhecidas de bater o alvo.
