-- =====================================================================
-- Migration 008 — evidência de confirmação TIER 1 em campanha_fontes (D-034)
-- =====================================================================
-- ADITIVA e IDEMPOTENTE. Coluna jsonb nullable: guarda o trecho/evidência que
-- justifica a confirmação (título extraído, %, vigência lida, url canônica) —
-- mesma disciplina de proveniência de INV-01/INV-03. Não altera nada existente.
-- Alimenta a slice do matcher URL→campanha (D-033).
-- =====================================================================

alter table public.campanha_fontes
  add column if not exists payload jsonb;

comment on column public.campanha_fontes.payload is
  'Evidencia da confirmacao TIER 1 (trecho/%/vigencia/url extraidos da pagina oficial). Proveniencia, INV-01/03. D-034.';

-- =====================================================================
-- Rollback: alter table public.campanha_fontes drop column if exists payload;
-- =====================================================================
