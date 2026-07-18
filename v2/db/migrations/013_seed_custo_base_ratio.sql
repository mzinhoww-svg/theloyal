-- =====================================================================
-- Migration 013 — SEED do vetor de ratios APROVADO (M2 · CPM, D-039).
-- ADITIVA e IDEMPOTENTE. Popula `custo_base_ratio` (DDL na migration 012) com o
-- vetor que o operador APROVOU (v2/M2/PROPOSTA-RATIOS.md §3/§6). A 012 é
-- DDL-only por disciplina de vetor (aprovar antes de popular); esta 013 é o
-- passo de população pós-aprovação — arquivo separado para manter a 012 imutável.
--
-- Regra-mãe (D-039): NUNCA defaultar 1:1. Só entra linha com evidência
-- (fonte + verificado_em). Par sem evidência confiável => SEM LINHA (o contrato
-- do consumidor é: par ausente OU ratio NULL => CPM não reconstruível, nunca
-- 1:1 implícito — ver comentário da 012 e cpmDeCustoBase). `ratio` na semântica
-- do helper: milhas de destino por 1 ponto de origem ANTES do bônus
-- (1:1 => 1, 3:1 => 0.3333).
--
-- Confiança:
--   alta  = âncora de paridade do par EXATO in-base (às vezes + cpm_value).
--   media = inferido do comportamento do DESTINO (origens-irmãs convergem no
--           mesmo ratio); é inferência do destino, não do par — mas com âncoras
--           citadas, não chute (INV-01/INV-03).
--
-- Janela de validade (decisão 4 do operador): ratios de programa mudam (LATAM
-- foi a 1:1; Accor mexeu 3,5:1→4:1). `verificado_em` é a âncora temporal; a
-- política é REVALIDAR a cada 12 meses (ou antes, se a coleta oficial pegar
-- mudança de paridade). Linha vencida sem revalidação vira candidata a NULL.
--
-- Origens de banco/terminais NÃO entram (decisão 5): o CPM delas já é null por
-- natureza (custo_base_moeda null, D-035) — popular ratio não acende CPM nenhum.
-- A paridade 1:1 delas (Itaú/Credicard→LATAM/Smiles) entra só como EVIDÊNCIA de
-- destino nas linhas `media`, não como linha própria.
--
-- Referências: D-039, D-035, INV-01/INV-03/INV-12. PROPOSTA-RATIOS §3.1/§3.2/§6.
-- Baseline: v2/db/schema-atual.sql. Estilo: migrations 009/011 (seed embutido).
-- =====================================================================

insert into public.custo_base_ratio
  (origem, destino, ratio, fonte, verificado_em, confianca, nota)
values
  -- ---- Confiança ALTA — âncora de paridade do par exato (§3.1) ----
  ('livelo', 'azul_fidelidade', 1,
   'livelo-azul-transferencia-2026-07-05 (paridade=1:1 + cpm_value=11,85)',
   date '2026-07-05', 'alta',
   'Âncora dupla (paridade + CPM). 44 transferências na base. Revalidar até 2027-07-05.'),
  ('livelo', 'latam_pass', 1,
   'livelo-latampass-transferencia-2026-06-30 (paridade=1:1)',
   date '2026-06-30', 'alta',
   '25 transferências. "25% virou o novo patamar LATAM 2026". Revalidar até 2027-06-30.'),
  ('livelo', 'connectmiles', 0.3333,
   'livelo-connectmiles-transferencia-2026-07-12 (paridade=3:1 + cpm_value=60)',
   date '2026-07-12', 'alta',
   'O caso-âncora da trava (D-039): 3:1 (Copa). ratio=1 mentiria 2,8x (R$21,43 vs R$64,29). Revalidar até 2027-07-12.'),

  -- ---- Confiança MÉDIA — inferido do comportamento do destino (§3.2) ----
  ('livelo', 'smiles', 1,
   'destino smiles 1:1 (credicard-smiles-2026-03-02 / itau-smiles-2026-03-02 / bancos-smiles-2026-07-10)',
   date '2026-07-10', 'media',
   '23 transferências. Sem paridade no par; destino Smiles 1:1 consistente entre origens-irmãs. Revalidar até 2027-07-10.'),
  ('esfera', 'latam_pass', 1,
   'destino latam 1:1 (itau-latampass-* / credicard-latampass-* / bb-empresas-latampass-2026-07-08 + livelo-latampass)',
   date '2026-07-08', 'media',
   '18 transferências. Destino LATAM 1:1 consistente. Revalidar até 2027-07-08.'),
  ('esfera', 'smiles', 1,
   'destino smiles 1:1 (mesmas âncoras de livelo->smiles)',
   date '2026-07-10', 'media',
   '19 transferências. Revalidar até 2027-07-10.'),
  ('esfera', 'azul_fidelidade', 1,
   'destino azul 1:1 (livelo-azul-2026-07-05 / inter-loop-azul-2026-07-10)',
   date '2026-07-10', 'media',
   '30 transferências. Revalidar até 2027-07-10.'),
  ('esfera', 'connectmiles', 0.3333,
   'destino connectmiles 3:1 inferido de livelo-connectmiles-2026-07-12 (Copa)',
   date '2026-07-12', 'media',
   'Não-1:1 priorizado (decisão 2): sem âncora do par exato daria R$20 com 1:1, mas destino 3:1 dá R$60 (3x). 6 transferências. Revalidar até 2027-07-12.')
on conflict (origem, destino) do nothing;
