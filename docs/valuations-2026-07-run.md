# The Loyal — Ritual mensal de valuations · 2026-07

**Run:** 2026-07-11 · **Repo:** github.com/mzinhoww-svg/theloyal · **Fonte da régua:** Supabase `the-loyalty` (`qjqnqcsdnpvvmyzkavoq`), tabela `valuations` (`is_current=true`).

## Veredito do mês: MANTER TODA A RÉGUA. Nenhum Special exigido.

Sem cash de referência de resgate confiável (banco D de `passagens` vazio), a régua
não se move — ajusta-se apenas confiança quando há base. Não houve base para mexer
em confiança neste run. Regra de ouro preservada: a régua não muda em silêncio.

## Régua vigente (period 2026-07) — inalterada

| Programa | Piso | Teto | Confiança | Fonte |
|---|---|---|---|---|
| aadvantage | 30 | 45 | media | milhasbot-jul2026 |
| aeroplan | 24 | 36 | media | milhasbot-jul2026 |
| azul | 17 | 21 | alta | milhasbot-jul2026 |
| esfera | 21 | 27 | alta | milhasbot-jul2026 |
| iberia | 30 | 42 | media | milhasbot-jul2026 |
| latampass | 27 | 33 | alta | milhasbot-jul2026 |
| lifemiles | 25 | 38 | media | milhasbot-jul2026 |
| livelo | 23 | 29 | alta | milhasbot-jul2026 |
| smiles | 21 | 27 | alta | milhasbot-jul2026 |
| tap | 20 | 26 | media | milhasbot-jul2026 |

## Banco D — cobertura

- **`passagens` (resgates, base do VPM): 0 observações.** Sem preço de tarifa em
  dinheiro verificável → VPM implícito não calculável este mês. Este é o gargalo
  a resolver para que a régua possa se mover com base.
- **`campaigns` (ledger): 76 linhas.** Observações de transferência com CPM (custo
  de aquisição, não valor de resgate):
  - azul — 2 obs, CPM médio 12,65 (11,85–13,44), última 2026-07-10
  - smiles — 1 obs, CPM 15,37, última 2026-07-10
  - connectmiles — 1 obs, CPM 60, última 2026-07-11 (fora da régua)

  CPM abaixo do piso do programa indica **bom negócio de compra**, não erro da régua.
  CPM não é insumo de piso/teto (que são valuation/VPM). Nenhum gatilho de drift.

## Programa a programa

Nenhum programa moveu: sem observação de resgate (VPM) para nenhum deles, o teste
de drift material (≥5% sustentado ou evento estrutural) não tem insumo. Mantidos
piso, teto e confiança de todos os 10.

## Estrutura de versão

- Único período em `valuations`: **2026-07** (semeado 2026-07-10, `milhasbot-jul2026`).
- Estamos em meados de julho: **não há bump pendente**. O próximo scaffold é
  **2026-08**, no fecha-mês de agosto, copiando 2026-07 como `previous` e ajustando
  só o que tiver base.

## Ações executadas neste run

- Leitura da régua vigente e do banco D no Supabase (somente leitura).
- Nenhuma escrita em `valuations`. Régua intacta.
- Relatório entregue (este arquivo).

## Pendências para a rotina funcionar sozinha (ver runbook novo)

1. **Alimentar `passagens`** com observações de resgate (origem/destino/programa/
   milhas/taxas/tarifa-cash) — sem isso a régua nunca terá base para se mover.
2. **Rotina lê/escreve via conector Supabase** (persistente entre runs agendados),
   não via arquivos `.mjs` inexistentes. Runbook reescrito em `docs/VALUATIONS-RUNBOOK.md`.
3. **Push mensal ao repo** depende de credencial persistente (o ambiente é efêmero).
