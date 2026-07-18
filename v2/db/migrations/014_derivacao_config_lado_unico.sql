-- =====================================================================
-- Migration 014 — vetor de DERIVAÇÃO LADO-ÚNICO versionado (M2 · re-score
-- lado-único, D-042/D-047). ADITIVA e IDEMPOTENTE. Não remove nem reescreve
-- nada de `campaigns`; só estende `derivacao_config` (migration 009) e semeia
-- a linha `lado_unico.v1`.
--
-- Simetria com `derivacao.v1` (migration 009): assim como a derivação GERAL tem
-- seu vetor versionado em tabela para o re-score ler do banco (e o breakdown
-- referenciá-lo), a derivação LADO-ÚNICO (compra/acúmulo/shopping/clube de UM
-- lado só — destino_code='sem_destino') ganha o SEU próprio vetor versionado.
-- Motivo (D-042): lado-único não tem rota/destino → não tem percentil-de-rota;
-- ranqueia o bônus contra a população do MESMO tipo+merchant. Ter vetor próprio
-- versionado em vez de tomar a rota geral emprestada por acidente fecha a
-- auditoria: um score histórico continua explicável sabendo `versao_pesos` E
-- `versao_derivacao` (aqui `lado_unico.v1`).
--
-- Fonte de verdade do CÓDIGO: LADO_UNICO_V1 em v2/lib/lado-unico.mjs. Esta linha
-- espelha aquele objeto. Recalibrar = nova versão + novos testes.
--
-- Duas colunas novas (aditivas, NULLABLE → a linha `derivacao.v1` fica intacta
-- com NULL, pois a derivação geral não tem fallback de merchant):
--   percentil_min_tipo       — barra mínima do fallback cross-merchant (sinal fraco)
--   percentil_fallback_tipo  — liga/desliga o fallback cross-merchant
-- Para o lado-único, `percentil_min_samples` REPRESENTA `min_merchant` (população
-- mínima do merchant p/ ranqueio cheio) e `raridade` é keyada na FREQUÊNCIA DO
-- MERCHANT (janela 'freq-merchant'), não na rota fina.
--
-- DECISÕES DO OPERADOR APROVADAS (D-047):
--   §4.1  fallback cross-merchant DESLIGADO (percentil_fallback_tipo=false) —
--         merchant fino → neutro sinalizado, nunca cross-merchant (INV-03/D-042/c2).
--   §4.2  raridade reusa os buckets de D-037 (n=1→0,85 … 50+→0,10), keyada no merchant.
--   §4.3  min_merchant=3 (=score_pesos.min_samples) · min_tipo=8.
--   §4.4  conta_nao_calculavel → NÃO-VALOR (tl_score_bruto=null) — decisão do
--         RE-SCORE (marcarNaoValorLadoUnico), não do vetor; registrada na nota.
--   §4.5  versionado aqui em `derivacao_config` (simetria com derivacao.v1).
-- Referências: D-042, D-047, D-037, D-024, D-032, INV-03/INV-12.
-- Baseline: migrations 001–013. Estilo: migration 009.
-- =====================================================================

alter table public.derivacao_config
  add column if not exists percentil_min_tipo      integer,
  add column if not exists percentil_fallback_tipo boolean;

-- Seed lado_unico.v1 — espelha LADO_UNICO_V1 de v2/lib/lado-unico.mjs. Idempotente.
insert into public.derivacao_config
  (versao, percentil_janela, percentil_min_samples, percentil_min_tipo, percentil_fallback_tipo,
   eficiencia_metodo, eficiencia_janela,
   raridade_janela, raridade_limiares,
   abrangencia_janela, abrangencia_mapa, nota)
values
  ('lado_unico.v1', 'tipo-merchant', 3, 8, false,
   'ecdf-inverso', 'cpm-populacao-global',
   'freq-merchant',
   '[{"max":1,"valor":0.85},{"max":2,"valor":0.85},{"max":5,"valor":0.65},'
   || '{"max":20,"valor":0.45},{"max":50,"valor":0.25},{"max":null,"valor":0.10}]'::jsonb,
   'publico',
   '{"geral":1.0,"cartao":0.6,"selecionados":0.45,"clube":0.3}'::jsonb,
   'APROVADO D-047. Derivacao LADO-UNICO (destino_code=sem_destino, D-042). '
   || 'percentil = ECDF-midrank do bonus vs populacao do MESMO tipo+merchant (min_samples=min_merchant=3); '
   || 'fallback cross-merchant DESLIGADO (fallback_tipo=false, §4.1): merchant fino -> neutro sinalizado (INV-03); '
   || 'min_tipo=8 fica registrado para auditoria mas nao e usado com fallback OFF. '
   || 'eficiencia = ECDF-inverso do CPM (cego hoje no lado-unico), ausente -> redistribui (D-024). '
   || 'raridade = bucket por FREQUENCIA DO MERCHANT (janela freq-merchant), buckets de D-037. '
   || 'abrangencia = mapa publico. limiares.max=null representa Infinity (ultimo bucket). '
   || 'RE-SCORE: override conta_nao_calculavel => tl_score_bruto=null (NAO-VALOR, §4.4), '
   || 'aplicado por marcarNaoValorLadoUnico fora do vetor.')
on conflict (versao) do nothing;
