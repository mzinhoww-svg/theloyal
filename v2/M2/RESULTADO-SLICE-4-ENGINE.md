# M2 · Slice 4 — TL Score engine · RESULTADO (engine puro)

> Engine determinístico (INV-12) sobre o vetor **`score_pesos.v1` travado** (D-022). Reprodutível: `node --test v2/lib/score.test.mjs` (11 testes) · `node v2/golden/score-run.mjs` (grava `SCORE-METRICAS.json`). Golden ancorado à versão: `v2/golden/score-gold.json`. Migration: `v2/db/migrations/006_tl_score_engine.sql` (aditiva, idempotente, **não aplicada**). Data: 2026-07-16.

## O que entregou (Definição de Pronto, §6)

| item | entregue | evidência |
|---|---|---|
| `score.mjs` puro: régua + 2 overrides + assembly de breakdown, sobre pesos versionados | ✅ | `v2/lib/score.mjs` — `calcularScore(entradas, pesos)`, pesos NUNCA hardcoded |
| Migration aditiva idempotente (`score_pesos`+seed v1, `tl_breakdown`, `tl_overrides`, 5 colunas em `campaigns`) | ✅ | `v2/db/migrations/006_tl_score_engine.sql` |
| Golden files travando faixa, overrides e amortecimento de base curta | ✅ | `v2/golden/score-gold.json` (8 casos) + `v2/lib/score.test.mjs` |
| Teste: mesmo input→mesmo score; cada override rebaixa e loga; base curta ≠ percentil cheio; "88 bruto → Não confirmado por sem TIER 1" | ✅ | 11/11 verdes |
| Medição por programa (§6.1) | ✅ | `v2/golden/SCORE-METRICAS.json` |
| Manual público v2 na mesma leva do engine (§2.4) | ✅ | `components/sections.tsx` — bloco de metodologia |
| Fecho gsd | ✅ | este doc |

`npm run build` compila (exit 0, `/` estático); `tsc --noEmit` limpo; suíte v2/lib completa **41/41** (score + gate + vigência + identidade, sem regressão).

## A régua e o vetor v1 (travado, D-022 §2.2)

```
TL Score = 0,45·percentil + 0,30·eficiência + 0,15·raridade + 0,10·abrangência
           (score = Σ_presentes pesoᵢ·valorᵢ / Σ_presentes pesoᵢ, cada valorᵢ ∈ [0,1])
85–100 Vale agir · 70–84 Vale olhar · 55–69 Só para casos específicos · 40–54 Esperaria · 0–39 Evitaria
shrink_k=5 · min_samples=3
```

**Teto por desenho confirmado nos números:** com percentil a 0,45, um percentil perfeito sozinho (redistribuído) chega só a ~76 quando faltam os outros — nenhum componente único força "Vale agir" (85). Protege credibilidade contra hype (§2.2).

## Breakdown de exemplo (INV-03 — o número carrega o porquê)

Caso `sem_tier1_88` do golden (o "88 bruto → Não confirmado por sem TIER 1" exigido em §6.3):

| componente | valor usado | peso nominal | peso efetivo | contribuição | base_n | base curta |
|---|--:|--:|--:|--:|--:|:--:|
| percentil | 0,9098 | 0,45 | 0,45 | 0,4094 | 200 | não |
| eficiência | 0,90 | 0,30 | 0,30 | 0,27 | — | — |
| raridade | 0,85 | 0,15 | 0,15 | 0,1275 | — | — |
| abrangência | 0,75 | 0,10 | 0,10 | 0,075 | — | — |
| **Σ** | | | | **0,8819 → 88** | | |

`tl_score_bruto = 88 · veredito_bruto = "Vale agir"` → override **`sem_tier1`** → `veredito = "Não confirmado"`. O bruto **nunca some** (§3): é o que ranqueia a fila de candidatos a confirmar (§4). Σ contribuição = score/100 (reproduzível, testado).

Os 3 amortecimentos/redistribuições que o golden trava:
- **redistribuição** (eficiência ausente): `76` em vez de `54` (o "zero que afunda") — item legítimo sem CPM não é punido (§2.1).
- **base curta**: percentil bruto 0,95 com `base_n=2 (<3)` amortece para 0,63 → score `62` em vez de `76` com base cheia; marca `base_curta=true` (§2). Nunca vira percentil cheio.
- **conta não calculável**: só raridade+abrangência (sem % nem CPM) → bruto computado do resíduo, mas override `conta_nao_calculavel` → Não confirmado.

## Medição por programa (§6.1) — a estrada

Rodando o engine sobre as **52 campanhas** do golden:

| medição | resultado |
|---|---|
| veredito hoje (0/52 TIER 1) | **52/52 Não confirmado** |
| overrides disparados | `sem_tier1` 52 · `conta_nao_calculavel` 52 |
| elegíveis "Vale agir" hoje | **0** |
| **adapter-reachable** (toca Smiles/Livelo/Esfera/TAP) | **26/52 (50,0%)** |
| **manual-only** (Azul/LATAM/cartões) | **26/52** |

Top da fila por programa: `livelo 13 · azul_fidelidade 8 · smiles 7 · latam_pass 6 · esfera 6 · all_accor 3 · inter 3`.
Maiores blocos **manual-only**: `azul_fidelidade 6 · latam_pass 3 · inter 3 · all_accor 2 · btg 2 · revolut 2`.

**Leitura (§6.1):** a estrada é meio-a-meio. Metade da fila (26/52) enche pelos adapters da Trilha B — **Livelo domina** (13 toques), com Smiles/Esfera fortes; o Deal Desk arranca por adapter para essa metade. A outra metade concentra em **Azul (D-010) e LATAM (D-011)**, que seguem confirmação manual → **carga operacional real nos primeiros dias** ali. TAP aparece pouco (1) no golden: adapter útil, volume baixo nesta amostra.

## Achado que travou a medição por-item (honestidade de dado, não improviso)

**"Quantos seriam elegíveis se confirmados TIER 1" é indeterminado a partir dos arquivos** — e eu **não chutei** (INV-03/INV-12). Motivo: dois dos quatro componentes não são deriváveis do golden:
- **percentil** exige o histórico de bônus da rota (distribuição por par) → só existe depois do **re-score da base canonicalizada (D-007)**;
- **eficiência (CPM/VPM)** exige preço de emissão → fora deste ciclo.

Fabricar esses valores para produzir um ranking de bruto violaria o determinismo. Então a medição sobre os arquivos é honesta: **todo item cai em `conta_nao_calculavel` além de `sem_tier1`**. A **estrada (§4) tem dois portões, não um** — TIER 1 *e* sinal de valor computável. O segundo portão é exatamente o que o re-score (D-007) abre. A parte acionável hoje é a **fila por programa** acima (onde asfaltar/confirmar primeiro), não um veredito por-item.

## Decisões novas que precisei tomar (para o orquestrador consolidar — NÃO editei DECISIONS.md)

1. **Base do branch / base do PR.** Os artefatos do v2 (spec, migrations 001–005, `lib/gate`+`lib/vigencia`, golden) vivem em `claude/loyal-v2-architecture-nfvoh1`; o base literal do task (`claude/loyalty-landing-page-v1-7vbjq7`) **não tem `v2/` nenhum**. Baseei `claude/loyal-v2-m2a-engine` na branch de arquitetura (empilhada, §7) e **abri o PR contra ela**. Um PR contra `loyalty-landing-page-v1` mostraria toda a arquitetura + meu trabalho, irrevisável. **Decisão a ratificar:** ordem de merge A→B→C empilha sobre a branch de arquitetura, que entra antes.

2. **2 overrides no engine, não 3.** Task me escopou a `sem_tier1` + `conta_nao_calculavel`. A SPEC §1 lista um terceiro (**vigência não confirmada**). Implementei 2 (a lista de overrides é ordenada e extensível). Racional: vigência **saiu do score** (D-022) e o "Não confirmado por vigência" já é derivável do FSM (`estado='indeterminada'`, migration 001) — cabe à slice de digest/gate aplicá-lo, não ao engine puro. **Ratificar** que o override de vigência mora no gate/digest, não em `score.mjs`.

3. **Prioridade quando 2 overrides disparam:** `conta_nao_calculavel` > `sem_tier1` em `override_aplicado` (ambos são **sempre logados** em `tl_overrides`). A spec não define desempate. Racional: conta vazia é desqualificação mais fundamental que falta de fonte, e mantém o item **fora** da fila de "confirmar" (§4 filtra por `override=sem_tier1`) — não vale confirmar TIER 1 de algo sem valor computável.

4. **Coluna `base_curta` em `tl_breakdown`** além da lista explícita do task, para cumprir §2 ("o breakdown marca `base_curta=true`"). Aditiva, `default false`. O retorno do engine também expõe `valor_bruto` e `peso_efetivo` por componente (auditabilidade), que **não** viram coluna — o DB guarda `valor` (usado) + `peso` (nominal) + `contribuicao` (Σ = score/100), de onde tudo se reconstrói.

5. **Mapeamento provisório de abrangência na medição** (`geral 1,0 · selecionados 0,7 · cartão 0,6 · clube 0,3`): usado **só** em `score-run.mjs` para exercitar o engine, **não** faz parte de `score.mjs` (que recebe valores prontos). É uma proposta para o re-score, não decisão travada.

## Pergunta bloqueante que parei para não improvisar

**As fórmulas de derivação dos 4 componentes a partir do dado bruto** (como `eficiência` sai de `cpm_value`; como `percentil` é calculado contra o histórico da rota; como `raridade` e `abrangência` são bucketizadas) **não estão definidas na spec aprovada** e eu **não as inventei no engine** — `score.mjs` é puro sobre `entradas` com os valores já ∈ [0,1], coerente com §5 (re-score é slice própria). **Confirmar que essa é a fronteira pretendida:** o engine puro fica com a régua+overrides+breakdown (esta slice), e a derivação dos valores dos componentes (com as fórmulas do `tl-source-audit`/CPM e o percentil contra a base) é a **slice de re-score (D-007)**. Se a intenção era que ESTA slice já definisse as fórmulas de derivação, isso é trabalho adicional que precisa de aprovação do vetor de derivação antes de codar (mesmo padrão do vetor de pesos).

## Estado do Manual público (§2.4)

Atualizado na mesma leva (`components/sections.tsx`, bloco "A conta é aberta"): declara **"TL Score v2, vigente desde 16/07/2026"** com a fórmula nova (percentil/eficiência/raridade/abrangência), o override público ("sem fonte TIER 1 ou sem conta possível → Não confirmado"), diz **explicitamente** que termos/regra, fricção e estoque são avaliados editorialmente e **não entram na nota** (com previsão de reintrodução), e registra que a versão anterior (oito critérios) fica arquivada. Regras de marca respeitadas: tokens só, sem hex, sem emoji, sem urgência, números em mono, `green-500` só sobre Ink. **Compila** (build verde). Redação mínima e conservadora — pode receber revisão editorial fina, mas cumpre a condição bloqueante da Opção A.
