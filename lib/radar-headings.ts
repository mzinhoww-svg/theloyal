// Estrutura semântica de headings da visão geral do Radar (Fase P1-E/M3).
// PURO — fonte única dos títulos de seção, para os componentes renderizarem
// headings reais (não decorativos) e o teste validar a hierarquia (um h1, h2s).

export const RADAR_H = {
  page: "Radar",
  resumo: "Resumo operacional",
  saude: "Saúde do Radar",
  indicadores: "Indicadores",
  filtros: "Filtros",
  series: "Séries",
  alertas: "Alertas operacionais",
} as const;

export interface HeadingNode {
  level: 1 | 2;
  text: string;
}

// Outline esperado da visão geral (`/admin/radar`): um h1 (página) + h2 por seção.
export const RADAR_OVERVIEW_OUTLINE: HeadingNode[] = [
  { level: 1, text: RADAR_H.page },
  { level: 2, text: RADAR_H.resumo },
  { level: 2, text: RADAR_H.saude },
  { level: 2, text: RADAR_H.indicadores },
  { level: 2, text: RADAR_H.filtros },
  { level: 2, text: RADAR_H.series },
];
