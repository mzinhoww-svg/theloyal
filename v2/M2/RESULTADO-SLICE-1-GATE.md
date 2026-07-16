# M2 · Slice 1 — Gate de rejeição · RESULTADO

> Medido contra os 86 rótulos do golden. Reprodutível: `node v2/golden/gate-run.mjs` (grava `GATE-METRICAS.json` + `GATE-A-LOCK.json`). Testes de não-regressão: `node --test v2/lib/gate.test.mjs`. Data: 2026-07-16.

## Portão — as duas métricas lado a lado

| métrica | alvo (declarado antes de codar) | medido | veredito |
|---|---|---:|---|
| **precision de rejeição** (público, saía de 0/31) | ≥ 0,90 | **1,00** (30/30) | ✅ |
| **recall de campanha** (das 55, quantas sobrevivem) | ≥ 0,95 | **1,00** (55/55) | ✅ |
| recall de rejeição (secundário) | ≥ 0,70 | **0,968** (30/31) | ✅ |

**0 campanhas reais derrubadas.** 1 negativo em **revisão** (abstenção, não rejeição) — `smiles-melhores destinos` (disponibilidade de resgate 62k milhas, confidence 0,55 < limiar). O portão bate; ver §"honestidade" antes de comemorar.

## Split das camadas (determinismo-primeiro funcionando)

- **Camada A (determinística): 24 rejeições**, precision 1,0 (invariante travado, D-017). Motivos: cupom_varejo 11 · perk_sem_pontos 8 · tarifa_pacote_dinheiro 4 · produto_blog 1.
- **Camada B (LLM): 6 rejeições + 1 revisão** sobre 7 negativos que subiram. Os 55 positivos passaram intactos.

**A pega ~77% dos negativos (24/31) com regra pura.** A LLM só julga o resto.

## Resposta à sua pergunta: dos que sobem para B, ambíguo real vs regra faltante

Dos 7 negativos que a camada A não resolveu:

- **Ambíguo real (5)** — exigem julgamento, ficam na LLM: `azul-patrocínio` (stunt), `delta-IA` (ops), `qatar-retoma-voos` (ops), `latampass R$148/milhas` (tarifa), `smiles 62k milhas` (disponibilidade de resgate).
- **Regra faltante (2)** — padrão determinístico ainda não escrito, **candidatos a descer para a camada A**: `livelo-magalu` e `mastercard-azul`. São **cupons de varejo** que a camada A deixou passar porque o `guard de emissor` (origem = programa emissor) foi largo demais: `livelo`/`mastercard` aparecem como origem espúria, mas o conteúdo é cupom. Refinamento proposto (não aplicado, aguarda seu aval): quando houver sinal forte de cupom **e** o destino for agência/varejo (`azul viagens`, `magalu`, `amazon`), o cupom vence o guard. Isso desce 2 casos de B para A por regra, não por deploy do julgamento.

## As 24 determinísticas travadas (não-regressão no CI)

Congeladas em `v2/golden/GATE-A-LOCK.json`; `gate.test.mjs` falha o CI se qualquer uma mudar de motivo, sumir, ou se a camada A passar a rejeitar campanha real. Regra classifica hoje = classifica amanhã. O LLM evolui; a camada A não drifta.

## Honestidade da medição (não é 1,0 de verdade no mundo)

Os números são **in-sample**: as regras da camada A foram derivadas destes 86. O que confio:
1. **Camada A é determinística** — o 1,0 dela vale enquanto o conteúdo casar os padrões; **fora da amostra pode dar falso-positivo** (ex.: "% de desconto" num phrasing raro de campanha real). Mitigação: a fila de revisão (`rejeicoes`) é auditada; cada falso-positivo vira ajuste de regra.
2. **Camada B é UM passe de Claude offline** (`gate-llm.mjs`), não a LLM viva em produção. A LLM real varia; o **limiar de confidence + abstenção** é o que protege o recall de campanha, não a assunção de que a LLM acerta sempre.
3. O recall de rejeição de 0,968 **já embute uma abstenção honesta** (o caso borderline foi para revisão, não inflei rejeitando no escuro).

O número que vai para a metodologia pública não é "1,0" — é: **a base saiu de rejeitar 0/31 para rejeitar 30/31 dos não-campanha sem derrubar nenhuma campanha real**, com trilha auditável e 1 caso honestamente em revisão.

## Uma decisão que a implementação expôs (aguarda seu aval)

**`anuidade grátis` de cartão sem pontos** (`bradesco`, `nubank`, `santander` — 3 casos) estão rotulados **campanha** (`promocao_emissao`) no golden e a camada A **não os toca** (não são perk pela regra atual). Mas sob leitura estrita de D-012 (perk sem mecânica de ponto = fora), "cartão com anuidade grátis, sem bônus de pontos" seria `perk_sem_pontos`. Mantive como campanha (aquisição de cartão é evento do beat de cartões). Se você ler estrito, eles viram `nao_campanha` e a camada A ganha uma regra `anuidade_sem_pontos` — é a mesma família dos borderline_perk (D-012). **Não flipo sem seu aval.**

## Estado

- Migration `004` aplicada (`motivos_rejeicao` seed 6 + `rejeicoes` com trilha). `rejeicoes` **vazia** — não populei produção; a população real acontece quando o gate for ligado como job na `job_queue` (entre extração e identidade), não por backfill nas campanhas já canonicalizadas.
- Camada A: `v2/lib/gate.mjs` (pura, testada). Camada B: `v2/lib/gate-llm.mjs` (contrato de prompt+schema + passe offline).
- Testes: 4 do gate + 16 do matcher M1, verdes.

## Pronto para a slice 3 (vigência)?

O gate bate o portão. Antes de fechar a slice 1, preciso de você em dois pontos: (a) aval do refinamento que desce os 2 `regra_faltante` para a camada A; (b) ruling sobre `anuidade grátis`. Resolvidos, fecho a slice 1 e sigo para a slice 3 (parser de vigência/ano — o pior campo, 31% de precision).
