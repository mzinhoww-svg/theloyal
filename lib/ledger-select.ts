// Fonte ÚNICA da seleção de colunas do ledger (`campaigns`) para as superfícies
// que aplicam a contenção temporal C0.2: o Forecast legado (/admin/forecast) e o
// Radar (/admin/radar). Ambos DEVEM ler as MESMAS colunas para partir da MESMA
// amostra elegível — senão o Forecast diverge do Radar (dívida A1).
//
// Módulo PURO: sem I/O, sem imports, sem side effects. É importável em testes de
// paridade sem carregar admin-db nem tocar no Supabase. NÃO adiciona coluna
// alguma além das já esperadas por lib/campaign-quality.ts. Fase A1.

// Identidade + datas de evento + datas de PROVENIÊNCIA + sinal de duplicidade.
// A ordem é irrelevante para o PostgREST; mantida legível (identidade → evento →
// proveniência → duplicidade).
export const LEDGER_QUALITY_COLUMNS = [
  "id",
  "tipo",
  "origem",
  "destino",
  "percentual",
  "vigencia_inicio",
  "vigencia_fim",
  "first_seen",
  "last_seen",
  "observed_at",
  "created_at",
  "source_url",
  "origin",
] as const;

// Subconjunto de proveniência que `assessCampaignQuality`/`evaluateTemporalPlausibility`
// exigem para disparar `suspect_year` (contenção do caso 943). Sem estas colunas
// a proveniência chega `undefined` e a exclusão temporal nunca acontece.
export const PROVENANCE_COLUMNS = [
  "first_seen",
  "last_seen",
  "observed_at",
  "created_at",
  "source_url",
] as const;

// String de `select` do PostgREST usada pelos loaders.
export const LEDGER_QUALITY_SELECT = LEDGER_QUALITY_COLUMNS.join(",");
