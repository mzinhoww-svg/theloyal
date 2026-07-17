-- Fase 1a — plausibilidade temporal (correção da origem, PROPOSTA / não aplicada).
-- Aditiva e idempotente: só adiciona colunas de flag; não altera nem apaga dado.
-- A edge fn `campaigns` (v14) passa a gravar temporal_status/include_in_prediction.
-- suspect_year = marca e exclui da série; NÃO deleta (D-042). NÃO autocorrige (INV-16).
--
-- NOTA (dois mundos de migração): as migrations de identidade/canonicalização vivem em
-- v2/db/migrations (001..012); as da linha RADAR/predict vivem aqui (supabase/migrations,
-- 0001..0007). Estas colunas são consumidas pelos motores (lib/forecast.ts,
-- lib/predict-engine.ts) da linha RADAR, por isso a migration mora aqui. As duas árvores
-- apontam para o mesmo banco vivo — o merge serializa (D-041). A repontagem de `id` e a
-- dedup por identidade canônica são Fase 1b, coordenada com o chat principal (dono do M1).

alter table public.campaigns
  add column if not exists temporal_status text not null default 'valid',
  add column if not exists include_in_prediction boolean not null default true;

comment on column public.campaigns.temporal_status is
  'Fase 1a: valid | suspect_year | event_after_source. suspect_year = evento >365d antes da fonte (ano provavelmente fabricado). Nao autocorrige; sai da serie. Limiar calibravel (Agente 3).';
comment on column public.campaigns.include_in_prediction is
  'Fase 1a: false quando temporal_status=suspect_year — exclui da serie temporal (forecast/predict), sem deletar do corpus (D-042).';

-- Índice parcial: acelera o filtro dos motores (so as linhas elegiveis) e a fila de revisao.
create index if not exists campaigns_include_in_prediction_idx
  on public.campaigns (include_in_prediction) where include_in_prediction = false;
