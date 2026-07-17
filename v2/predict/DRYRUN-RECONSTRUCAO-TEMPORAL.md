# Dry-run — regra de reconstrução de ano por evidência (READ-ONLY, nada aplicado)

> Rodado sobre o banco vivo `qjqnqcsdnpvvmyzkavoq` em 2026-07-17, só `execute_sql` SELECT.
> **Nenhuma escrita.** A regra é proposta; o apply depende de aprovação do operador sobre
> esta amostra + origem de fato estancada (edge fn) + trava de anomalia + inscrição prévia
> no handoff. INV-16/D-040: nada é reconstruído sem evidência; sem evidência → `suspect_year`.

## 1. A regra (evidência convergente de duas fontes)

Para cada transferência com data de evento (`vigencia_inicio`, senão `vigencia_fim`) e
proveniência (`first_seen`):
- **`coerente`** — `yr_off ≤ 0` (ano do evento não está atrás da proveniência): mantém.
- **`reconstruido`** — evidência: o slug da `source_url` tem token mês-ano (`set25`,
  `fev25`) **e** `ano_do_slug == ano de first_seen`. Reconstrói **só o ano** da data
  (mês/dia preservados). Duas fontes independentes convergem (slug textual + proveniência).
- **`suspect_year`** — corrompido (`yr_off ≥ 1`) sem token de slug, ou token cujo ano não
  bate com `first_seen`. **Sai da série, não é reconstruído** (não chutar).

**Aperto proposto (recomendado):** exigir também **`mês_do_slug == mês extraído`**
(convergência em mês E ano, não só ano). Ver §4.

## 2. Classificação (562 julgáveis; +191 sem data ficam fora)

| Classe | N | Observação |
|---|---|---|
| `coerente` | 137 | já corretos (yr_off ≤ 0) |
| `reconstruido` (regra base) | **209** | **170 forte (mês bate) + 39 fraco (mês do slug diverge)** |
| `suspect_year` | 216 | sem token de slug ou token diverge de first_seen |

## 3. Cobertura resultante (rotas com `base_n≥3` e série `≥12m`) — a fronteira do predict v1

*(normalização simplificada em SQL; o número exato se crava no apply com o `normProgram` real)*

| Cenário | rotas base_n≥3 | **base_n≥3 e ≥12m (fronteira)** |
|---|---|---|
| **raw** (corrompido atual) | 36 | 24 *(ficção — spans inflados por ano errado)* |
| **reconstruido (regra base)** | 24 | **16** |
| **reconstruido + aperto (mês bate)** | 22 | **12** |

O predict v1 fala com número para **~12–16 rotas** (conforme o aperto), sobre a janela
confiável de ~24 meses. Resto = qualitativo (D-043). Este é o número que substitui o
provisório 163/119 da calibração — **quando o apply fechar.**

## 4. O que auditar — os 39 reconstruídos FRACOS (mês do slug diverge)

39 das 209 reconstruções mantiveram o mês extraído mas o **slug aponta outro mês**. Exemplo
da amostra:

| id | wd_original | slug | ano_reconstruído | mês_bate |
|---|---|---|---|---|
| `livelo-azul-…-2023-03-16` | 2023-03-16 | **mai**26 | 2026-03-16 | **não** — slug diz maio, data diz março |

Aqui a evidência (slug = maio/2026) **contradiz** o mês da data extraída (março). Reconstruir
para 2026-03-16 confia num mês que a própria evidência não corrobora. **Recomendo apertar:**
exigir mês do slug == mês extraído → esses 39 viram `suspect_year` (erra a favor de suspect,
como você pediu). Custo: a fronteira cai de 16 → 12 rotas. Troca conservadora e correta —
série confiável menor > série maior com ano/mês duvidoso.

## 5. Amostra — reconstruídos FORTES (mês bate, evidência convergente) — corretos

| id | wd_original | slug | ano_reconstruído |
|---|---|---|---|
| cartoes-azul-…-2020-03-27 | 2020-03-27 | mar26 | 2026-03-27 |
| livelo-all-…-2023-02-24 | 2023-02-24 | fev26 | 2026-02-24 |
| livelo-smiles-…-2023-11-24 | 2023-11-24 | nov25 | 2025-11-24 |
| itau-smiles-…-2024-01-29 | 2024-01-29 | jan25 | 2025-01-29 |
| esfera-connectmiles-…-2024-02-22 | 2024-02-22 | fev25 | 2025-02-22 |

## 6. Amostra — suspect_year (sem evidência de slug) — corretamente fora

Padrão dominante: URLs `passageirodeprimeira.com` com slug **descritivo** (sem token de
data). Não reconstrutíveis por slug. Recuperá-las exigiria um sinal de ano no **corpo** da
notícia (fonte de evidência futura) — **nunca** `first_seen` sozinho (seria inferência,
INV-16). Ficam suspect corretamente.

| id | wd | first_seen | tem_token_slug |
|---|---|---|---|
| **livelo-connectmiles-…-2023-12-12 (canônico 943d)** | 2023-12-12 | 2026-07-12 | **não → suspect** |
| banestes-azul-…-2024-02-12 | 2024-02-12 | 2026-03-13 | não |
| credicard-latampass-…-2024-04-29 | 2024-04-29 | 2026-05-29 | não |

## 7. Casos conhecidos (gabarito)

| id | classe | resultado |
|---|---|---|
| esfera-connectmiles fev25 (2024-02-22) | reconstruido | → 2025-02-22 ✓ |
| esfera-connectmiles set25 (2024-09-20) | reconstruido | → 2025-09-20 ✓ |
| **livelo-connectmiles (943d)** | suspect_year | **não autocorrigido** ✓ (INV-16) |

## 8. Gates antes do apply (nenhum cumprido ainda)

- [ ] Sua aprovação da regra **sobre esta amostra** (e a decisão do aperto §4).
- [ ] **Origem de fato estancada** — pendente: colisão da edge fn (a v14-shadow do principal
  não tem a âncora; ver `DIAGNOSTICO`/handoff). Reconstruir com a origem ainda corrompendo
  é enxugar gelo.
- [ ] Trava de anomalia no apply (o que grava bate com o que o dry-run previu).
- [ ] Inscrição prévia no handoff + confirmação de que nenhum outro chat escreve nas mesmas
  linhas naquele momento (coordenação com o principal, dono da fundação).

**Nada aplicado. Read-only. Aguarda aprovação sobre a amostra.**
