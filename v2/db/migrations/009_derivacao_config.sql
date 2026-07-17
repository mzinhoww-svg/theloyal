-- =====================================================================
-- Migration 009 — vetor de DERIVAÇÃO versionado (M2 · re-score, D-032).
-- ADITIVA e IDEMPOTENTE. NÃO aplicar aqui — a aplicação em produção é
-- serializada pelo orquestrador, e o vetor v1 é PROPOSTA a aprovar antes
-- (v2/M2/PROPOSTA-VETOR-DERIVACAO.md). Só escreve/valida o DDL.
-- Não remove nem reescreve nada de `campaigns`.
--
-- Análoga a `score_pesos` (migration 006): assim como os PESOS do engine são
-- versionados em tabela para o accuracy loop recalibrar sem deploy, as ESCOLHAS
-- de DERIVAÇÃO (normalização de CPM, limiares de raridade, janela/min_samples do
-- percentil, mapa de abrangência) são versionadas aqui. Motivo (D-032): a
-- derivação tem seu PRÓPRIO vetor a aprovar, mesma disciplina do vetor de pesos;
-- e um score histórico continua explicável se a gente souber qual `versao_pesos`
-- E qual `versao_derivacao` produziram as entradas.
--
-- Fonte de verdade do CÓDIGO: DERIVACAO_V1 em v2/lib/derivacao.mjs. Esta linha
-- espelha aquele objeto para o re-score em escala ler o vetor do banco (e para o
-- breakdown referenciá-lo). Recalibrar = nova versão + novo golden de re-score.
--
-- Nota de coordenação (NÃO aplicada aqui): registrar `versao_derivacao` em
-- tl_breakdown (migration 006, slice 4) fecha a auditoria ponta a ponta. Fica
-- como ponto de sincronização com a slice do engine, fora do escopo desta.
-- Referências: D-032, D-022 (analogia), SPEC-SLICE-4 §2/§2.1, INV-03/INV-12.
-- Baseline: v2/db/schema-atual.sql. Estilo: migrations 001–008.
-- =====================================================================

create table if not exists public.derivacao_config (
  versao              text primary key,
  -- percentil: janela do histórico da rota + min_samples (base curta).
  percentil_janela    text    not null,
  percentil_min_samples integer not null default 3,   -- alinhado a score_pesos.min_samples
  -- eficiência: método de normalização do CPM + janela da população de referência.
  eficiencia_metodo   text    not null,               -- ex.: 'ecdf-inverso'
  eficiencia_janela   text    not null,               -- ex.: 'cpm-populacao-global'
  -- raridade: limiares de bucket por frequência da rota (jsonb: [{max,valor}...]).
  raridade_janela     text    not null,
  raridade_limiares   jsonb   not null,
  -- abrangência: mapa público → [0,1] (jsonb: {geral,cartao,selecionados,clube}).
  abrangencia_janela  text    not null,
  abrangencia_mapa    jsonb   not null,
  nota                text,
  criado_em           timestamptz not null default now()
);

-- Seed v1 — PROPOSTA (não travado; aprovar antes do re-score). Espelha
-- DERIVACAO_V1 de v2/lib/derivacao.mjs. Idempotente.
insert into public.derivacao_config
  (versao, percentil_janela, percentil_min_samples,
   eficiencia_metodo, eficiencia_janela,
   raridade_janela, raridade_limiares,
   abrangencia_janela, abrangencia_mapa, nota)
values
  ('derivacao.v1', 'rota-total', 3,
   'ecdf-inverso', 'cpm-populacao-global',
   'snapshot-rota',
   '[{"max":1,"valor":0.85},{"max":2,"valor":0.85},{"max":5,"valor":0.65},'
   || '{"max":20,"valor":0.45},{"max":50,"valor":0.25},{"max":null,"valor":0.10}]'::jsonb,
   'publico',
   '{"geral":1.0,"cartao":0.6,"selecionados":0.45,"clube":0.3}'::jsonb,
   'APROVADO D-037 (n=1 tetado 0,85). percentil = ECDF do bonus vs historico da MESMA rota '
   || '(% nao e comparavel entre rotas); eficiencia = ECDF-inverso do CPM (menor = melhor), '
   || 'ausente -> redistribui; raridade = bucket por frequencia da rota; abrangencia = mapa publico. '
   || 'limiares.max=null representa Infinity (ultimo bucket).')
on conflict (versao) do nothing;
