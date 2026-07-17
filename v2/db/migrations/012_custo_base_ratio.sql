-- =====================================================================
-- Migration 012 — tabela de RATIO de conversão por par (M2 · CPM, D-039).
-- ADITIVA e IDEMPOTENTE. NÃO aplicar aqui — a aplicação em produção é
-- serializada pelo orquestrador, e os VALORES de ratio são PROPOSTA a aprovar
-- antes de popular (v2/M2/PROPOSTA-RATIOS.md). Este arquivo só escreve/valida o
-- DDL. Não remove nem reescreve nada de `campaigns`. SEM SEED: nenhuma linha de
-- ratio é inserida aqui. Ratio errado envenena todo o CPM de transferência do
-- par (é FATOR do divisor) — INV-03/D-039.
--
-- Por que a tabela existe (o achado, D-039 / PROPOSTA-CUSTO-BASE §3, caso D*):
--   O CPM de `transferencia` reconstrói-se do custo-base da moeda de ORIGEM mais
--   o bônus e o RATIO base do par:
--     CPM_destino ≈ custo_milheiro(origem) / ((1 + bonus/100) * ratio)
--   `ratio` NÃO é 1:1 em vários pares. Ex.: Livelo→ConnectMiles converte 3:1
--   (3 pts origem → 1 milha destino): o CPM real da âncora é R$60,00, mas o
--   cálculo com ratio=1 dá R$21,43 — erro de 2,8×. Sem a tabela de ratios, o CPM
--   de transferência MENTE. custo_base_moeda (migration 011) dá o custo da
--   origem; esta tabela dá o ratio do par. As duas juntas destravam o CPM.
--
-- Semântica do `ratio` (idêntica ao parâmetro `ratioBase` de
-- v2/lib/cpm/custo-base.mjs :: cpmDeCustoBase):
--   ratio = MILHAS de destino por 1 PONTO de origem, ANTES do bônus.
--     paridade 1:1  (1 origem → 1 destino)  => ratio = 1
--     paridade 3:1  (3 origem → 1 destino)  => ratio = 0.3333  (= 1/3)
--     paridade 2:1  (2 origem → 1 destino)  => ratio = 0.5
--   ratio > 1 seria "ganha-se milhas na base" (raro). ratio < 1 é o comum quando
--   o destino é mais "caro" que a origem (ConnectMiles, alguns hotéis).
--
-- Proveniência obrigatória por linha (INV-01/INV-03): todo `ratio` carrega
-- `fonte` (de onde veio — id de campanha-âncora com `paridade`, ou âncoras de
-- origens-irmãs para o mesmo destino) e `verificado_em` (quando). Sem evidência
-- de que o par é 1:1 → NÃO defaultar 1:1: a linha fica `ratio = NULL`
-- ("a confirmar") ou ausente. Ratio ausente/NULL => CPM NÃO reconstruível para o
-- par (o consumidor trata como null, nunca chuta 1:1 — D-039).
--
-- IMPORTANTE (contrato do consumidor): a AUSÊNCIA de linha ≠ ratio 1. O runner de
-- re-score (D-038) só chama cpmDeCustoBase quando existir linha com `ratio` NÃO
-- nulo; par ausente ou `ratio IS NULL` => CPM = null (não reconstruível). O
-- default 1 do helper é uma SUPOSIÇÃO documentada, não deve ser usado às cegas.
--
-- Referências: D-039, D-036, D-035, D-032, INV-01/INV-03/INV-12.
-- Baseline: v2/db/schema-atual.sql. Estilo: migrations 001–011.
-- =====================================================================

create table if not exists public.custo_base_ratio (
  origem        text not null,                 -- moeda de origem  (= campaigns.origem_code)
  destino       text not null,                 -- moeda de destino (= campaigns.destino_code)
  ratio         numeric,                        -- milhas destino por ponto origem ANTES do bônus. NULL = "a confirmar".
  fonte         text,                           -- proveniência (INV-01/03): id(s) de campanha-âncora com paridade, ou âncoras de origens-irmãs.
  verificado_em date,                           -- quando a evidência do ratio foi observada/verificada
  confianca     text,                           -- 'alta' | 'media' | 'baixa'  (grau de evidência do ratio)
  nota          text,                           -- paridade original, ressalvas, base da inferência
  atualizado_em timestamptz not null default now(),
  primary key (origem, destino)
);

comment on table  public.custo_base_ratio is
  'Ratio base de conversão por par origem:destino (milhas destino / ponto origem, antes do bônus). Fator do CPM de transferência (D-039). Toda linha exige fonte+verificado_em (INV-01/03). Valores aprovados pelo operador antes de popular. Ratio NULL ou par ausente => CPM não reconstruível (nunca 1:1 chutado).';
comment on column public.custo_base_ratio.ratio is
  'Milhas de destino por 1 ponto de origem, ANTES do bônus (= ratioBase de cpmDeCustoBase). 1:1=>1, 3:1=>0.3333, 2:1=>0.5. NULL = par sem evidência confiável ("a confirmar"): nunca defaultar 1:1 (INV-03/D-039).';
comment on column public.custo_base_ratio.fonte is
  'Proveniência obrigatória: id(s) de campanha-âncora do banco com paridade observada, ou âncoras de origens-irmãs para o mesmo destino (inferência de comportamento do destino, confianca<=media).';
comment on column public.custo_base_ratio.confianca is
  'alta = âncora de paridade do par exato in-base; media = inferido do comportamento do destino (origens-irmãs); baixa = indício fraco.';

-- SEM INSERT. Popular só após aprovação da PROPOSTA (v2/M2/PROPOSTA-RATIOS.md).
