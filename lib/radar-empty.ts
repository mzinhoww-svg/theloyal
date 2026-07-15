// Catálogo único de estados vazios e de erro do Radar (Fase P1-D, §10).
// PURO, sem I/O e sem JSX — só o conteúdo (título/descrição/impacto/ação/link),
// para que a mensagem de cada estado seja consistente em toda a experiência e
// testável. Os componentes consomem estas entradas via <EmptyState>.

export interface RadarEmptyState {
  title: string;
  description: string;
  impact: string;
  action: string;
  diagnosticHref?: string;
}

export type RadarEmptyKey =
  | "no_campaigns"
  | "no_series"
  | "no_opportunities"
  | "no_reviews"
  | "no_blocks"
  | "no_prediction"
  | "forecast_unavailable"
  | "predict_unavailable"
  | "both_unavailable"
  | "no_backtest"
  | "no_bonus"
  | "no_duplicates"
  | "no_exclusions"
  | "dataset_incomplete"
  | "stale"
  | "load_error"
  | "series_not_found"
  | "no_filter_results";

export const RADAR_EMPTY: Record<RadarEmptyKey, RadarEmptyState> = {
  no_campaigns: {
    title: "Sem campanhas no ledger.",
    description: "Nenhuma transferência foi coletada ainda.",
    impact: "Nenhuma série pode ser formada.",
    action: "Aguardar a coleta e a extração popularem o ledger.",
  },
  no_series: {
    title: "Nenhuma série formada ainda.",
    description: "Há campanhas, mas nenhuma elegível para formar série.",
    impact: "Sem previsões até haver histórico elegível.",
    action: "Ver as campanhas excluídas para o motivo.",
    diagnosticHref: "/admin/radar?view=operacao",
  },
  no_opportunities: {
    title: "Nenhuma oportunidade elegível agora.",
    description: "Nenhuma série pronta, elegível e com janela iminente.",
    impact: "Nada a promover para pauta neste momento.",
    action: "Acompanhar as revisões e o histórico em formação.",
    diagnosticHref: "/admin/radar?view=revisoes",
  },
  no_reviews: {
    title: "Nada aguardando revisão.",
    description: "Sem divergência, fallback ou ressalva pendente.",
    impact: "Nenhuma decisão editorial necessária agora.",
    action: "Acompanhar as oportunidades.",
    diagnosticHref: "/admin/radar?view=oportunidades",
  },
  no_blocks: {
    title: "Nenhuma série bloqueada.",
    description: "Base completa, dados sãos e sem histórico crítico.",
    impact: "Nenhum trabalho de desbloqueio pendente.",
    action: "Acompanhar as oportunidades.",
  },
  no_prediction: {
    title: "Sem previsão utilizável.",
    description: "Nenhum motor produziu resultado utilizável para a série.",
    impact: "A série não vira pauta.",
    action: "Monitorar até acumular histórico válido.",
  },
  forecast_unavailable: {
    title: "Forecast indisponível.",
    description: "Sem recorrência suficiente para o baseline.",
    impact: "Sem janela por cadência; usar o Predict quando disponível.",
    action: "Ver o Predict.",
  },
  predict_unavailable: {
    title: "Predict indisponível.",
    description: "Sem prontidão do modelo para a série.",
    impact: "Usa o Forecast como fallback quando possível.",
    action: "Ver o Forecast.",
  },
  both_unavailable: {
    title: "Não confirmado.",
    description: "Os dois motores estão bloqueados para esta série.",
    impact: "Nenhuma previsão até resolver dado/histórico.",
    action: "Monitorar e revisar a qualidade.",
  },
  no_backtest: {
    title: "Backtest insuficiente.",
    description: "Sem observações suficientes para validar historicamente.",
    impact: "Confiança não pode ser reforçada pelo backtest.",
    action: "Aguardar mais ondas; não inferir confiança.",
  },
  no_bonus: {
    title: "Bônus não disponível.",
    description: "Sem candidato de bônus utilizável na série.",
    impact: "Sem bônus provável para exibir.",
    action: "Aguardar dado de bônus (nunca inferido).",
  },
  no_duplicates: {
    title: "Nenhuma duplicidade provável.",
    description: "Nenhum par de campanhas provavelmente repetido.",
    impact: "Sem intervalos falsos por duplicidade.",
    action: "Acompanhar novas leituras.",
  },
  no_exclusions: {
    title: "Nenhuma campanha excluída por qualidade nesta série.",
    description: "Todas as campanhas da série passaram na qualidade C0.2.",
    impact: "Série formada sem contenção de dado.",
    action: "Nenhuma ação necessária.",
  },
  dataset_incomplete: {
    title: "Base incompleta — números suspensos.",
    description: "A leitura do ledger não completou.",
    impact: "Nenhum número publica; nenhum override ignora este bloqueio.",
    action: "Reprocessar a leitura do ledger.",
    diagnosticHref: "/admin/radar?view=bloqueios",
  },
  stale: {
    title: "Resultado desatualizado.",
    description: "O artefato de previsão não está fresco.",
    impact: "O Weekly não publica números até atualizar.",
    action: "Recalcular o artefato de previsão.",
    diagnosticHref: "/admin/radar?freshness=stale",
  },
  load_error: {
    title: "Falha ao ler o ledger.",
    description: "A leitura do Supabase não retornou.",
    impact: "O Radar não pode compor as séries.",
    action: "Recarregar a página; verificar credenciais do admin.",
  },
  series_not_found: {
    title: "Série não encontrada.",
    description: "A chave pode ter mudado após um recálculo (o Radar é derivado em runtime).",
    impact: "Não há detalhe para exibir.",
    action: "Voltar ao Radar e abrir a série novamente.",
    diagnosticHref: "/admin/radar",
  },
  no_filter_results: {
    title: "Nenhum resultado após filtros.",
    description: "Nenhuma série corresponde à combinação de filtros.",
    impact: "Nada a exibir com o recorte atual.",
    action: "Ajustar ou limpar os filtros.",
    diagnosticHref: "/admin/radar",
  },
};
