-- =====================================================================
-- Migration 016 — SÍNTESE do Clipping em `news_raw` (`summary` + proveniência)
-- + estágio `sintese_clipping` no ledger de LLM. M2.7 · slice SÍNTESE-CLIPPING.
--
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PROPOSTA — NÃO APLICADA. Este arquivo é para o operador aprovar e    │
-- │ rodar (apply_migration) no ambiente de ingest. O código da slice já  │
-- │ está pronto para gravar nas colunas abaixo; enquanto a migration não │
-- │ for aplicada, o passo de síntese roda em mock (INV-03) e o Clipping   │
-- │ apenas omite. NADA aqui foi executado pelo autor da slice.           │
-- └─────────────────────────────────────────────────────────────────────┘
--
-- ADITIVA e IDEMPOTENTE. Só DDL: adiciona colunas nullable a `news_raw` e
-- estende (drop+add) o CHECK de `estagio` em `llm_jobs`/`model_registry` para
-- admitir o estágio novo. NÃO remove nem reescreve nada existente. Estilo:
-- migrations 004/011/015 (aditiva, sem seed que precise aprovação).
--
-- POR QUÊ (contrato): `montarClipping` (v2/lib/digest/montar-edicao.mjs) só
-- surfaceliza news_raw que tenham `summary`, e o schema (INV-04) exige que esse
-- summary seja síntese PRÓPRIA — "nunca reprodução do texto/título original".
-- Hoje `news_raw` não tem a coluna, então o Clipping é sempre omitido. Esta
-- migration cria a coluna + a proveniência que liga cada síntese ao seu custo.
--
-- TOKENS/CUSTO (INV-03/INV-12): a fonte única de custo é `llm_jobs` (uma linha
-- por chamada real, estágio `sintese_clipping`). As colunas de token aqui são
-- CÓPIA de conveniência da proveniência por item — NULL até haver chamada real,
-- NUNCA 0 (0 mentiria que a chamada foi de graça). `summary_job_ref` correlaciona
-- com `llm_jobs.job_ref` (que, por convenção do ledger, guarda `news_raw.id`).
-- Tipo TEXT (não uuid): `llm_jobs.job_ref` e `news_raw.id` são ambos TEXT — uuid
-- não casaria com nenhum dos dois lados. Não é FK (o job pode não existir: mock,
-- erro registrado, ou síntese pré-existente sem job).
--
-- Referências: INV-03, INV-04, INV-12, REQ-34. Baseline: 015_llm_jobs.sql.
-- =====================================================================

-- 1) news_raw: a síntese própria + proveniência (tudo nullable, tudo aditivo).
alter table public.news_raw add column if not exists summary               text;
alter table public.news_raw add column if not exists summary_model         text;
alter table public.news_raw add column if not exists summary_tokens_in     integer;
alter table public.news_raw add column if not exists summary_tokens_out    integer;
alter table public.news_raw add column if not exists summary_job_ref        text;
alter table public.news_raw add column if not exists summary_review_reason  text;

comment on column public.news_raw.summary is
  'Síntese PRÓPRIA (1-2 frases, "o que mudou") escrita pelo LLM e APROVADA no anti-cópia (v2/lib/digest/sintese-clipping.mjs). NULL = ainda sem síntese aprovada; o Clipping omite a notícia. Nunca reprodução do texto/título original (INV-04).';
comment on column public.news_raw.summary_model is
  'Modelo que escreveu a síntese (proveniência). NULL enquanto não houver chamada real.';
comment on column public.news_raw.summary_tokens_in is
  'Tokens de input observados na síntese. NULL = sem chamada real; NUNCA 0 forçado (INV-03). Fonte de custo é llm_jobs; aqui é cópia de conveniência.';
comment on column public.news_raw.summary_tokens_out is
  'Tokens de output observados na síntese. NULL = sem chamada real; NUNCA 0 forçado (INV-03).';
comment on column public.news_raw.summary_job_ref is
  'Correlação com llm_jobs.job_ref (= news_raw.id por convenção do ledger). Não é FK: o job pode não existir (mock/erro/síntese pré-existente).';
comment on column public.news_raw.summary_review_reason is
  'Preenchido quando a síntese candidata REPROVOU no anti-cópia/guardrail: o summary NÃO é gravado e a notícia fica para revisão humana (regra inviolável 2). NULL = sem pendência.';

-- 2) Ledger: admitir o estágio `sintese_clipping`. O CHECK de `estagio` em 015
--    é inline (nome auto: <tabela>_estagio_check). Drop-if-exists + add torna a
--    extensão idempotente. Os dois CHECKs (llm_jobs e model_registry) seguem
--    duplicados de propósito (mesma nota de 015: telemetria desacoplada de config).
alter table public.llm_jobs drop constraint if exists llm_jobs_estagio_check;
alter table public.llm_jobs add constraint llm_jobs_estagio_check check (estagio in (
  'extracao_campanhas', 'radar_vpm_match', 'radar_vpm_promo',
  'radar_vpm_extracao', 'gate_rejeicao_b', 'sintese_clipping'
));

alter table public.model_registry drop constraint if exists model_registry_estagio_check;
alter table public.model_registry add constraint model_registry_estagio_check check (estagio in (
  'extracao_campanhas', 'radar_vpm_match', 'radar_vpm_promo',
  'radar_vpm_extracao', 'gate_rejeicao_b', 'sintese_clipping'
));

-- SEM INSERT / SEM SEED. O preço do modelo de síntese em `model_registry` é seed
-- a aprovar depois, com fonte e data (mesmo padrão de 015). Enquanto o preço for
-- NULL, o custo em USD do painel fica NULL — nunca 0 (INV-03).
