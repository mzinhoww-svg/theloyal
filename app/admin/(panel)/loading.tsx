import { PageSkeleton } from "@/components/admin/ui";

// Skeleton exibido na troca entre telas do painel (Suspense do App Router).
// Sem spinner: mantém o layout e o frescor percebido durante a leitura ao vivo.
export default function Loading() {
  return <PageSkeleton />;
}
