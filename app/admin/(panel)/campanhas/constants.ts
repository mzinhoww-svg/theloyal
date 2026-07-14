// Vocabulário de veredito (grafia fixa do sistema). Fora do arquivo "use server"
// porque módulos de Server Action só podem exportar funções async.
export const VERDICTS = [
  "vale-agir",
  "vale-olhar",
  "casos-especificos",
  "esperaria",
  "evitaria",
  "nao-confirmado",
] as const;
