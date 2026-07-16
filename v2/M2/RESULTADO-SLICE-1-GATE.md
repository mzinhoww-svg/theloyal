# M2 · Slice 1 — Gate de rejeição · RESULTADO (fechado, pós-rulings)

> Medido contra os 86 rótulos do golden, **pós-correção de gabarito D-020** (52 campanha / 34 negativos). Reprodutível: `node v2/golden/gate-run.mjs` (grava `GATE-METRICAS.json` + `GATE-A-LOCK.json`). Testes de não-regressão: `node --test v2/lib/gate.test.mjs`. Data: 2026-07-16.

## Portão — as duas métricas lado a lado (números finais)

| métrica | alvo (declarado antes de codar) | medido | veredito |
|---|---|---:|---|
| **precision de rejeição** (interno in-sample; ver D-019) | ≥ 0,90 | **1,00** (33/33) | ✅ |
| **recall de campanha** (das 52, quantas sobrevivem) | ≥ 0,95 | **1,00** (52/52) | ✅ |
| recall de rejeição (secundário) | ≥ 0,70 | **0,971** (33/34) | ✅ |

**Número público (D-019, NÃO "precision 1,0"):** a base saiu de rejeitar **0/34 para 33/34** dos não-campanha **sem derrubar nenhuma campanha real**, com trilha auditável e **1 caso honestamente em revisão** (`smiles 62k milhas`, confidence 0,55 < limiar).

## Split das camadas (determinismo-primeiro funcionando)

- **Camada A (determinística): 29 rejeições**, precision 1,0 (invariante travado, D-017). Motivos: cupom_varejo 13 · perk_sem_pontos 8 · tarifa_pacote_dinheiro 4 · anuidade_sem_pontos 3 · produto_blog 1.
- **Camada B (LLM): 4 rejeições + 1 revisão** sobre 5 negativos. Os 52 positivos passaram intactos.

**A pega ~85% dos negativos (29/34) com regra pura.** A LLM só julga o resto.

## Rulings aplicados (fecham a slice)

- **Ruling 1 (cupom forte vence o guard):** `livelo-magalu` e `mastercard-azul` desceram de B → **camada A** (cupom_varejo). A palavra "cupom/OFF" é vocabulário de varejo; programa nunca chama sua promo de cupom.
- **Ruling 2 (regra-mãe D-018):** `anuidade_sem_pontos` na camada A (migration `005`) + **3 flips de gabarito** (bradesco/nubank/santander campanha → nao_campanha, D-020).
- **Efeito no split B:** encolheu de 7 → **5 ambíguo real, 0 regra faltante**. Os 5 que sobram são julgamento genuíno: `azul-patrocínio` (stunt), `delta-IA` (ops), `qatar-retoma-voos` (ops), `latampass R$148/milhas` (tarifa), `smiles 62k milhas` (resgate). É onde o LLM deve estar.

## As 29 determinísticas travadas (não-regressão no CI)

Congeladas em `v2/golden/GATE-A-LOCK.json`; `gate.test.mjs` falha o CI se qualquer uma mudar de motivo, sumir, ou se a camada A passar a rejeitar campanha real. Regra classifica hoje = classifica amanhã. O LLM evolui; a camada A não drifta.

## Honestidade da medição (não é 1,0 de verdade no mundo)

Os números são **in-sample**: as regras da camada A foram derivadas destes 86. O que confio:
1. **Camada A é determinística** — o 1,0 dela vale enquanto o conteúdo casar os padrões; **fora da amostra pode dar falso-positivo** (ex.: "% de desconto" num phrasing raro de campanha real). Mitigação: a fila de revisão (`rejeicoes`) é auditada; cada falso-positivo vira ajuste de regra.
2. **Camada B é UM passe de Claude offline** (`gate-llm.mjs`), não a LLM viva em produção. A LLM real varia; o **limiar de confidence + abstenção** é o que protege o recall de campanha, não a assunção de que a LLM acerta sempre.
3. O recall de rejeição de 0,971 **já embute uma abstenção honesta** (o caso borderline foi para revisão, não inflei rejeitando no escuro).

O número que vai para a metodologia pública não é "1,0" — é: **a base saiu de rejeitar 0/34 para rejeitar 33/34 dos não-campanha sem derrubar nenhuma campanha real** (D-019), com trilha auditável e 1 caso honestamente em revisão.

## Estado

- Migrations `004` (tabelas + seed 6) e `005` (`anuidade_sem_pontos`) aplicadas. `rejeicoes` **vazia** — não populei produção; a população real acontece quando o gate for ligado como job na `job_queue` (entre extração e identidade), não por backfill nas campanhas já canonicalizadas.
- Camada A: `v2/lib/gate.mjs` (pura, testada, 5 regras). Camada B: `v2/lib/gate-llm.mjs` (contrato prompt+schema + passe offline).
- Testes: 4 do gate + 16 do matcher M1, verdes.

## Slice 1 — FECHADA

Portão batido pós-rulings. Rulings 1 e 2 aplicados, gabarito corrigido (D-020), regra-mãe cravada (D-018), enquadramento público fixado (D-019). Próximo: **slice 3 (parser de vigência)** — spec em `SPEC-SLICE-3-VIGENCIA.md`, com o 31% quebrado em parsing vs confiabilidade de fonte.
