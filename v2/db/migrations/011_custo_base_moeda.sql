-- =====================================================================
-- Migration 011 — tabela de CUSTO-BASE por moeda (M2 · CPM, D-032).
-- ADITIVA e IDEMPOTENTE. NÃO aplicar aqui — a aplicação em produção é
-- serializada pelo orquestrador, e os VALORES de custo-base são PROPOSTA a
-- aprovar antes de popular (v2/M2/PROPOSTA-CUSTO-BASE.md). Este arquivo só
-- escreve/valida o DDL. Não remove nem reescreve nada de `campaigns`.
-- SEM SEED: nenhuma linha de valor é inserida aqui. Custo-base sem aprovação
-- envenena todo o CPM de transferência (o grosso da base) — INV-03.
--
-- Por que a tabela existe (o achado, PROPOSTA-VETOR-DERIVACAO §0):
--   `cpm_value` está preenchido em só 10/3.621 campanhas (leitura manual; o
--   pipeline nunca automatizou). Para `transferencia`, o CPM (R$/milheiro) do
--   destino deriva do CUSTO DE FABRICA do milheiro da moeda de ORIGEM:
--     CPM_destino ≈ custo_milheiro(origem) / (1 + bonus/100) / ratio_base
--   (ratio_base = razao de conversao base origem:destino, 1 na maioria dos hubs;
--    ver PROPOSTA §4, caveat Livelo→ConnectMiles). Esta tabela é a referencia de
--   `custo_milheiro(origem)` — o insumo que hoje falta para reconstruir CPM em
--   escala. `derivarEficiencia` (v2/lib/derivacao.mjs) consome o CPM ja pronto;
--   NAO toca esta tabela nem a derivacao — esta slice so PRODUZ o dado de custo.
--
-- Proveniencia obrigatoria por linha (INV-01/INV-03): todo `custo_milheiro`
-- carrega `fonte` (de onde veio o numero) e `verificado_em` (quando). Sem ancora
-- defensavel a moeda NAO entra na tabela (fica "a confirmar" na PROPOSTA, nao um
-- numero chutado). Recalibrar = novo UPDATE com nova `fonte`/`verificado_em`.
--
-- Referencias: D-032, INV-01/INV-03/INV-12. Baseline: v2/db/schema-atual.sql.
-- Estilo: migrations 001–009.
-- =====================================================================

create table if not exists public.custo_base_moeda (
  moeda          text primary key,             -- codigo da moeda de origem (= campaigns.origem_code)
  custo_milheiro numeric,                       -- R$/milheiro (custo de fabrica). NULL = "a confirmar".
  fonte          text,                          -- proveniencia do numero (INV-01/03): id de campanha-ancora, promo, etc.
  verificado_em  date,                          -- quando a ancora foi observada/verificada
  nota           text,                          -- incerteza, faixa, ressalvas (ratio nao-1:1, piso vs padrao...)
  atualizado_em  timestamptz not null default now()
);

comment on table  public.custo_base_moeda is
  'Custo de fabrica do milheiro por moeda de origem, insumo do CPM de transferencia (D-032). Toda linha exige fonte+verificado_em (INV-01/03). Valores aprovados pelo operador antes de popular.';
comment on column public.custo_base_moeda.custo_milheiro is
  'R$/milheiro. NULL = moeda sem ancora confiavel ("a confirmar"): nunca chutar (INV-03).';
comment on column public.custo_base_moeda.fonte is
  'Proveniencia obrigatoria: id(s) de campanha-ancora do banco, promo/piso citado, ou referencia externa datada.';

-- SEM INSERT. Popular so apos aprovacao da PROPOSTA (v2/M2/PROPOSTA-CUSTO-BASE.md).
