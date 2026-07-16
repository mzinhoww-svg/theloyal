# Reaudit dos 22 `origem_generica_recuperavel` (regra multi-banco)

> Decisão do operador: separar origem genérica **legítima** (multi-banco real) de origem genérica **por erro** (banco específico perdido). Reauditado 1 a 1 com o título/trecho da notícia.

## Resultado: 22 → **3 recuperável** + **19 multi-banco legítimo**

### Recuperável real (3) — a notícia nomeia um banco específico que a extração perdeu
| campaign_id | notícia | origem correta | tipo |
|---|---|---|---|
| `banco-pontos-cartao-na` | "**Ultrablue BTG** Pactual" | btg | bonus_acumulo |
| `banco-banco-estrutural-na` | "Pontos dos cartões **BTG** → programa próprio" | btg | outro (estrutural) |
| `cartao azul-desconhecido-cartao-na` | "**Cartão Azul** Skyline, 100 mil pontos bônus" | azul_fidelidade | bonus_acumulo |

Estes ficam como **defeito de extração a corrigir** → viram treino no golden set.

### Multi-banco legítimo (19) — `multiplos_cartoes` (genérico está CORRETO)
Todas transferências "até X% na transferência **do cartão de crédito** / **todos os parceiros** / **diversos bancos** / **mais de 10 bancos**" para Azul/Smiles/LATAM/Livelo/Esfera. A origem é genuinamente múltipla; a extração não errou.

## Refinamento aplicado (matcher + banco, incremental)

- **Matcher** (`identidade.mjs`): regra nova — origem genérica **+ tipo transferência + destino real** → `origem = multiplos_cartoes` (sentinela canônica válida, `publico=cartao`), **resolvido**. Demais genéricos (não-transferência) → revisão recuperável. 16 golden tests verdes.
- **Banco** (incremental, com trilha): `multiplos_cartoes` adicionado a `loyalty_programs`; **19 campanhas reclassificadas** de revisão → resolvido, cada uma com evento `reclassificacao_multi_banco` em `campanha_versoes`. Sem rebuild.

**Efeito:** campanhas com identidade 3.324 → **3.343** (92,6%); revisão 286 → **267** (251 `origem_nao_resolvida` + 3 recuperável real + 13 `transferencia_sem_destino`). Os `generica` caíram de 22 para **3**, como você previu.
