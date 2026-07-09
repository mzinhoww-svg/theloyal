import type { Metadata } from "next";
import { DailyEdition, type Edition } from "@/components/daily/DailyEdition";
import edition from "@/renderer/examples/edition.example.json";

export const metadata: Metadata = {
  title: "The Loyal Daily — web archive (preview)",
  description: "Preview do web archive do Daily renderizado a partir do JSON editorial.",
  robots: { index: false },
};

/* Web archive: renderiza a edicao de exemplo pelos componentes React.
   Troque a fonte do import por outra edicao (ou carregue por slug) para publicar. */
export default function DailyPreviewPage() {
  return (
    <main className="min-h-screen bg-paper">
      <DailyEdition edition={edition as unknown as Edition} />
    </main>
  );
}
