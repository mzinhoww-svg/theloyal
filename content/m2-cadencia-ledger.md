# M2 — Contagem dos 5 dias úteis do Daily (modo 1-clique)

> **Gate ativo.** Autopublish **OFF** em todo o período (D-050; `TL_AUTOPUBLISH=off`).
> Cada dia útil: cron 06:30 BRT (ou dispatch manual) gera **rascunho** → operador
> aprova por **1-clique** (envio real) → marca o dia. **5 dias úteis consecutivos
> aprovados = M2 FECHADO.**
>
> **Regras da contagem:**
> - Dia **sem aprovação** do operador **não conta** — e **não pula**: a série trava
>   ali até haver aprovação. Número honesto menor é melhor que um número inflado.
> - Dia que **falha o gate** → reporta, **não envia**, **não conta**; o diagnóstico
>   vira prioridade antes de seguir.
> - "Consecutivos" = dias úteis seguidos, todos aprovados. Um furo reinicia a série.

## Janela dos 5 dias úteis

| # | Data (BRT) | Nº edição | Rascunho (Beehiiv) | Gate | 1-clique (envio) | Conta? |
|---|------------|-----------|--------------------|------|------------------|--------|
| 1 | 2026-07-22 (qua) | 29 | **não gerado** (gate RED) | 🔴 RED (dia fraco) | ☐ — sem rascunho p/ aprovar | ❌ não conta |
| 2 | 2026-07-23 (qui) | — | _(cron 06:30)_ | — | ☐ | — |
| 3 | 2026-07-24 (sex) | — | _(cron 06:30)_ | — | ☐ | — |
| 4 | 2026-07-27 (seg) | — | _(cron 06:30)_ | — | ☐ | — |
| 5 | 2026-07-28 (ter) | — | _(cron 06:30)_ | — | ☐ | — |

**Progresso:** 0/5 dias úteis consecutivos aprovados. **Série não iniciou** — Dia 1
falhou o gate (dia fraco). Diagnóstico é prioridade (regra 3).

## Log de eventos

- **2026-07-22** — Smoke-run do Dia 1 disparado via `workflow_dispatch` (daily.yml,
  ref `claude/loyalty-landing-page-v1-7vbjq7`), modo real (environment Production,
  `TL_AUTOPUBLISH=off`). Run `#29960099135`.
- **2026-07-22** — **Dia 1: GATE RED — dia fraco, rascunho NÃO gerado, NÃO conta.**
  Diagnóstico definitivo do banco vivo (mesma fonte do runner):
  - **55 campanhas vivas hoje, 0 com lastro `campanha_fontes`** → Deal Desk = 0,
    Ofertas ativas = 0. É a consequência HONESTA de C1/D-082: antes ~44 ofertas
    vivas mostravam `tier=1` por claim do LLM (sem confirmação) e enchiam o Deal
    Desk de bônus não confirmado; depois de C1, nenhuma oferta viva está confirmada,
    então o Deal Desk corretamente aparece vazio. Número honesto menor.
  - **Clipping hoje = 0** — nenhuma `news_raw` com `published_at = hoje` e síntese
    própria (as 8 sínteses do A5 não são de hoje; o runner filtra Clipping por dia).
  - Edição nº 29 montada, mas `deals=0, ofertasAtivas=0, clipping=0` → o gate único
    (camada editorial) reprovou o "signal" de dia fraco (exit 1, sem rascunho).
  - Os 3 crons anteriores (20, 21, 22/07, código pré-merge) falharam pelo MESMO
    motivo — o gate RED em dia fraco não é regressão do merge; é o estado real.

## Diagnóstico — por que a série não inicia (prioridade)

**Causa-raiz (dado):** o pipeline de confirmação (`coleta-tier1` → `campanha_fontes`)
ainda não confirmou NENHUMA oferta viva. Sem oferta confirmada, o Deal Desk e as
Ofertas ativas ficam legitimamente vazios (INV-03). A cadência do Daily só produz
rascunho aprovável quando existir conteúdo confirmado do dia OU o Clipping do dia
tiver síntese própria. **Isto é correto, não é bug** — publicar bônus não confirmado
é o que C1 acabou de proibir.

**Ponto a decidir com o operador (não toquei sem ordem):** o gate único hoje dá
**RED com exit 1** num dia fraco — ou seja, um dia legitimamente quieto **não gera
nem rascunho leve** (Clipping/Radar/Resumo). Se a intenção do modo dia-fraco (M2.4
task 12 / gate 5.5) é permitir uma edição mais enxuta em dia sem Deal Desk, o gate
precisa distinguir "dia fraco válido" de "edição vazia inválida". **Não alterei o
gate** para não forçar verde artificial (inflaria a contagem — contra a regra 3).

## Como marcar um dia (operador)

1. Abrir o rascunho do dia no Beehiiv (link na tabela).
2. Conferir: edição fresca do dia, triada, Clipping com síntese própria, gate verde.
3. Aprovar por 1-clique (envio real). A trava durável (`daily_sends`, C2/D-083)
   garante que um único envio acontece por dia, mesmo em re-run.
4. Marcar ☑ na coluna "1-clique" e preencher "Conta? ✅" no dia correspondente.
